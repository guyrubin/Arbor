import React, { useMemo, useRef, useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useChildCollection, type ChildCollection } from "../../hooks/useChildCollection";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { fmtDay } from "../../lib/formatDate";
import { Icon } from "../ui/Icon";
import { Receipt } from "../ui/Receipt";
import HomeProgramEntry, { HomeProgramDays, homeProfessionForAppointment, nextVisitDayFor, type EntryWrites } from "../program/HomeProgramEntry";
import { activeHomeEnrolments, toggleExerciseDay, type HomeProgramEnrolment } from "../../content/programs/homeProgram";
import type { FamilyGoal } from "../../lib/goals";
import {
  appointmentStatus,
  makeFollowUp,
  visitAskedForOutcome,
  type Appointment,
  type AppointmentFollowUp,
} from "../../lib/careTrack";

/* v3 F-CARE-1 — what the visit left behind, on the visit's own page.
 *
 * The Care landing (#/consult) is the v3 mock: the next-visit card, the aside,
 * the doors. It carries neither the last visit's open loop nor the home
 * program any more; both live here, at the top of #/appointments (the
 * Appointments door), and the landing keeps one line in the visit-card head
 * ("What did they suggest?") that opens this page.
 *
 *   - After a visit date passes (visitAwaitingOutcome: the most recent visit in
 *     the last 14 days, not done, no follow-up), ONE open loop asks "What did
 *     they suggest?" and writes the parent's answer as the visit's follow-up
 *     (the registered apptFollowUps sink), which closes the booking.
 *   - The second answer: the professional gave a home program (B-PROG-09).
 *     With no visit waiting, the same entry opens from "I have recommendations
 *     for home". The active home programs' day marks follow.
 *
 * B-STATUS-01: success answers where it happened, as one Receipt line, and only
 * after the write resolved (v3 EXTRA-CARE: "Saved" follows persistence). Toasts
 * here are errors only. Clinical firewall: nothing here scores the child; the
 * words are the parent's.
 *
 * v3 F-CARE-1 r2: Appointments holds the answer being saved (`held`/`onHeld`)
 * and asks the same rule (careTrack visitAskedForOutcome), so the row capture
 * it suppresses is exactly the visit asked here, a queued answer included.
 * Without those props the component keeps the state itself. */

/** The answer the parent is saving, or whose save is not confirmed yet, for one child. */
export type HeldOutcome = { childId: string; record: AppointmentFollowUp; state: "saving" | "queued" | "failed" };

export default function VisitOutcome({ apptsCol, followUpsCol, held, onHeld }: {
  apptsCol: ChildCollection<Appointment>;
  followUpsCol: ChildCollection<AppointmentFollowUp>;
  held?: HeldOutcome | null;
  onHeld?: (next: HeldOutcome | null) => void;
}) {
  const { user } = useAuth();
  const { childProfile } = useArbor();
  const currentChild = useRef(childProfile.id);
  currentChild.current = childProfile.id;
  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const nowMs = Date.now();
  // B-PROG-09: the home program the professional gave (programs, home-* rows) and the goals the family accepted
  const programsCol = useChildCollection<HomeProgramEnrolment>(childProfile.id, "programs");
  const familyGoalsCol = useChildCollection<FamilyGoal>(childProfile.id, "familyGoals");
  const [homeOpen, setHomeOpen] = useState(false);
  // v3 EXTRA-CARE: the answer the parent is saving, or whose save is not
  // confirmed yet. Signed in, Firestore applies the write to this device's
  // cache at once, so the follow-up reaches followUpsCol.items before the
  // server confirms it, and visitAwaitingOutcome would close the loop and
  // unmount the answer. Held, that record does not count until the write is
  // acknowledged: the field, the answer and the same-id retry stay.
  const [ownHeld, setOwnHeld] = useState<HeldOutcome | null>(null);
  const anyHeld = onHeld ? held ?? null : ownHeld;
  const heldOutcome = anyHeld && anyHeld.childId === childProfile.id ? anyHeld : null;
  const setHeldOutcome = (next: HeldOutcome | null) => (onHeld ? onHeld(next) : setOwnHeld(next));
  const heldId = heldOutcome?.record.id;
  const awaiting = useMemo(
    () => visitAskedForOutcome(apptsCol.items, followUpsCol.items, heldId, nowMs),
    [apptsCol.items, followUpsCol.items, nowMs, heldId],
  );
  const [outcome, setOutcome] = useState("");
  const savingOutcome = heldOutcome?.state === "saving";
  /** The receipt of the last write that resolved: the follow-up, or the home program. */
  const [saved, setSaved] = useState<"outcome" | "home" | null>(null);

  // v3 EXTRA-CARE: "Saved" only after the follow-up write is acknowledged.
  // Offline or unanswered, the answer stays in the field and the error says
  // what is true: signed in, the write already waits in this device's queue
  // and finishes on reconnect ("not confirmed yet"); a write the server
  // refused, or a device write that failed, was not kept ("wasn't saved").
  // A retry for the same visit reuses the held record's id with the current
  // words, so a queued first write and the retry are ONE follow-up. The
  // follow-up alone closes the visit's loop (visitAwaitingOutcome); marking
  // the booking done is bookkeeping after it.
  const saveOutcome = async () => {
    if (!awaiting || savingOutcome) return;
    const note = outcome.trim();
    const heldRecord = heldOutcome?.record;
    const record = heldRecord && heldRecord.apptId === awaiting.id && note ? { ...heldRecord, note } : makeFollowUp(awaiting.id, note, Date.now());
    if (!record) return;
    setSaved(null);
    const childId = childProfile.id;
    setHeldOutcome({ childId, record, state: "saving" });
    try {
      await followUpsCol.upsert(record, { requireAcknowledgement: true });
    } catch (err) {
      if (currentChild.current !== childId) return;
      const refused = typeof err === "object" && err !== null && "code" in err;
      const queued = followUpsCol.remote && !refused;
      setHeldOutcome({ childId, record, state: queued ? "queued" : "failed" });
      toast(t(queued ? "elev.consult.visitOutcome.queued" : "elev.consult.visitOutcome.saveError"), "error");
      return;
    }
    if (appointmentStatus(awaiting) !== "done") {
      try { await apptsCol.upsert({ ...awaiting, status: "done" }); } catch { /* the follow-up already closed the loop */ }
    }
    if (currentChild.current !== childId) return;
    setHeldOutcome(null);
    setOutcome("");
    setSaved("outcome");
  };

  // B-PROG-09 (assignment in): the ONLY place the home program is written —
  // on the parent's confirm, after every proposed goal was accepted in their
  // words or left out. The exercises, in the parent's words, are the visit's
  // follow-up ("What did they suggest?"), which closes the booking.
  const saveHomeProgram = async (w: Extract<EntryWrites, { ok: true }>) => {
    const childId = childProfile.id;
    const record = awaiting ? makeFollowUp(awaiting.id, w.enrolment.home.exercises.map((e) => e.text).join(" · "), Date.now()) : null;
    if (programsCol.remote) {
      if (!db || !user) throw new Error("Sign in to save");
      const batch = writeBatch(db);
      const path = `users/${user.uid}/children/${childId}`;
      for (const old of w.superseded) batch.set(doc(db, `${path}/programs/${old.id}`), old);
      batch.set(doc(db, `${path}/programs/${w.enrolment.id}`), w.enrolment);
      for (const goal of w.goals) batch.set(doc(db, `${path}/familyGoals/${goal.id}`), goal);
      if (record) batch.set(doc(db, `${path}/apptFollowUps/${record.id}`), record);
      if (awaiting && appointmentStatus(awaiting) !== "done") batch.set(doc(db, `${path}/appointments/${awaiting.id}`), { ...awaiting, status: "done" });
      await batch.commit();
    } else {
      await programsCol.upsert(w.enrolment);
      for (const old of w.superseded) await programsCol.upsert(old);
      for (const goal of w.goals) await familyGoalsCol.upsert(goal);
      if (record) await followUpsCol.upsert(record);
      if (awaiting && appointmentStatus(awaiting) !== "done") await apptsCol.upsert({ ...awaiting, status: "done" });
    }
    if (currentChild.current !== childId) return;
    setHomeOpen(false);
    setSaved("home");
  };
  const activeHome = activeHomeEnrolments(programsCol.items);

  const quietBtn = "inline-flex items-center gap-1.5 self-start rounded-xl px-4 min-h-[44px] t-sm font-semibold";
  const quietStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };

  return (
    <div data-testid="visit-outcome" className="flex flex-col gap-4">
      {saved && (
        <Receipt testId="visit-outcome-saved" tone="kept" size="sm">
          {t(saved === "home" ? "elev.homeProgram.saved" : "elev.learnCare.appt.followUp.saved")}
        </Receipt>
      )}
      {awaiting ? (
        <section
          id="consult-visit-outcome"
          data-testid="consult-visit-outcome"
          className="rounded-[22px] border p-4 sm:p-5 flex flex-col gap-2"
          style={{ borderColor: "var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
        >
          <label htmlFor="consult-visit-outcome-input" className="t-sm font-bold" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.consult.visitOutcome.q", { profession: appointmentRoleLabel(awaiting, t), date: fmtDay(awaiting.whenIso!, uiLang) })}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="consult-visit-outcome-input"
              value={outcome}
              onChange={(e) => { setOutcome(e.target.value); setSaved(null); }}
              readOnly={savingOutcome}
              dir="auto"
              placeholder={t("elev.learnCare.appt.followUp.placeholder")}
              className="flex-1 min-w-0 rounded-xl px-3 min-h-[44px] t-sm"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            />
            <button
              type="button"
              data-testid="consult-visit-outcome-save"
              onClick={() => { void saveOutcome(); }}
              disabled={!outcome.trim() || savingOutcome}
              aria-busy={savingOutcome}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 min-h-[44px] t-sm font-bold disabled:cursor-not-allowed"
              style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}
            >
              <Icon name="check" size={16} /> {savingOutcome ? t("elev.consult.visitOutcome.saving") : t("elev.learnCare.appt.followUp.save")}
            </button>
          </div>
          {/* v3 EXTRA-CARE: after the error fades, the field still says why the
              answer is here: kept on this device, not confirmed yet. */}
          {heldOutcome?.state === "queued" && (
            <p data-testid="consult-visit-outcome-held" className="t-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.consult.visitOutcome.held")}</p>
          )}
          {/* B-PROG-09: the second answer — the professional gave a home program */}
          {!homeOpen ? (
            <button
              type="button"
              data-testid="consult-home-program-choice"
              onClick={() => { setHomeOpen(true); setSaved(null); }}
              className={quietBtn}
              style={quietStyle}
            >
              <Icon name="add" size={16} aria-hidden /> {t("elev.homeProgram.entry.choice")}
            </button>
          ) : (
            <HomeProgramEntry
              key={childProfile.id}
              childId={childProfile.id}
              profession={homeProfessionForAppointment(awaiting.profession)}
              nextVisit={nextVisitDayFor(apptsCol.items, awaiting, nowMs)}
              rows={programsCol.items}
              existingGoals={familyGoalsCol.items}
              onConfirm={saveHomeProgram}
              onCancel={() => setHomeOpen(false)}
            />
          )}
        </section>
      ) : (
        <section data-testid="visit-home-entry" className="flex flex-col gap-2">
          {!homeOpen ? (
            <button type="button" data-testid="visit-home-entry-open" className={quietBtn} style={quietStyle} onClick={() => { setHomeOpen(true); setSaved(null); }}>
              <Icon name="add" size={16} aria-hidden /> {t("elev.pilot.i.have.recommendations.for.home")}
            </button>
          ) : (
            <HomeProgramEntry key={childProfile.id} childId={childProfile.id} profession={null} nextVisit={null} rows={programsCol.items} existingGoals={familyGoalsCol.items} onConfirm={saveHomeProgram} onCancel={() => setHomeOpen(false)} />
          )}
        </section>
      )}
      {activeHome.map((e) => (
        <HomeProgramDays key={e.id} enrolment={e} onSave={(exerciseId) => void programsCol.upsert(toggleExerciseDay(e, exerciseId))} />
      ))}
    </div>
  );
}
