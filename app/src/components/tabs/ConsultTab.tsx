import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import AskSpecialist from "../sections/AskSpecialist";
import PracticeSummary from "../consult/PracticeSummary";
import { isIntakeProfession, type ExportAudience } from "../../consult/packet";
import { visitForConsult } from "../../lib/today/dayCard";
import { useHashQuery } from "../../hooks/useHashQuery";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fmtDay } from "../../lib/formatDate";
import { Icon } from "../ui/Icon";
import { guidedTierOn } from "../../lib/entitlementsGuided";
import HomeProgramEntry, { HomeProgramDays, homeProfessionForAppointment, nextVisitDayFor, type EntryWrites } from "../program/HomeProgramEntry";
import { activeHomeEnrolments, toggleExerciseDay, type HomeProgramEnrolment } from "../../content/programs/homeProgram";
import type { FamilyGoal } from "../../lib/goals";
import {
  appointmentStatus,
  consultAudienceForProfession,
  makeFollowUp,
  visitAwaitingOutcome,
  type Appointment,
  type AppointmentFollowUp,
} from "../../lib/careTrack";

/* Care › Consult — one verb for "get expert input". The former three facets
   (Ask a specialist / AI handoff brief / Find a professional) and the hidden
   handoff door are collapsed into a single linear flow (b3): a parent-redacted
   packet from the child's record with one action bar — Copy / Download /
   Export as PDF / Send to a professional. The flow itself lives in
   AskSpecialist (the warm-handoff spine). Shell already lazy-loads +
   Suspense-wraps this tab.

   W2-CAREPRO critic round 1 (B-CAREPRO-36, hero part): the HubHero is CUT. Its
   solid CTA "Review the summary" only scrolled ~60 px to the audience row that
   was already visible under it, and it spent ~220 px above step 1. The page
   now opens on the job: H1 "Prepare for a visit", "for {name}" as a muted
   subline, and step 1 directly under it.

   B-CAREPRO-NEW-2a (critic round 2): Consult anchors on the next visit. A
   booking inside its Prepare window (isPrepareDue, <=14 days) names the H1
   ("Prepare for the speech therapist on 9 Oct") and preselects step 1 through
   consultAudienceForProfession. After a visit date passes, ONE in-page open
   loop asks "What did they suggest?" and writes the parent's answer as the
   visit's follow-up (the same apptFollowUps record Appointments keeps), which
   closes the booking. No push, no reminder, no count. */

/** NEXTLEVEL critic r1 — which H1 the Consult page shows. The visit names it
 *  while the chosen audience IS the visit's; any other professional names
 *  the H1 by audience ("self" and nothing chosen keep the generic line). */
export function consultHeading(input: { visitAudience?: ExportAudience; hasVisit: boolean; chosen?: ExportAudience }): "visit" | "audience" | "generic" {
  if (input.hasVisit && (input.chosen === undefined || input.chosen === input.visitAudience)) return "visit";
  if (input.chosen && input.chosen !== "self") return "audience";
  return "generic";
}

const lowerFor = (lang: string, x: string) => (lang === "en" ? x.toLowerCase() : x);

export default function ConsultTab() {
  const { childProfile } = useArbor();
  const { user } = useAuth();
  const query = useHashQuery();
  const scope = JSON.stringify([user?.uid ?? "local", childProfile.id, query.get("appointment")]);
  const owner = useRef({ scope, token: {} });
  if (owner.current.scope !== scope) owner.current = { scope, token: {} };
  const token = owner.current.token;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isOwnerCurrent = useCallback(() => mounted.current && owner.current.token === token, [token]);
  return <ConsultContent key={scope} query={query} isOwnerCurrent={isOwnerCurrent} />;
}

function ConsultContent({ query, isOwnerCurrent }: { query: URLSearchParams; isOwnerCurrent: () => boolean }) {
  const { user } = useAuth();
  const { childProfile, activeTab, setActiveTab, consultAudienceReceipt } = useArbor();
  const currentChild = useRef(childProfile.id);
  currentChild.current = childProfile.id;
  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const firstName = (childProfile.name || "").split(" ")[0];
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments", { trackConfirmation: true });
  const followUpsCol = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");
  const nowMs = Date.now();
  // B-PROG-09: the home program the professional gave (programs, home-* rows) and the goals the family accepted
  const programsCol = useChildCollection<HomeProgramEnrolment>(childProfile.id, "programs");
  const familyGoalsCol = useChildCollection<FamilyGoal>(childProfile.id, "familyGoals");
  const [homeOpen, setHomeOpen] = useState(false);
  const appointmentId = query.get("appointment");
  const appointmentReady = apptsCol.loaded && !apptsCol.error && apptsCol.confirmed;
  const currentVisit = useMemo(() => appointmentId && !appointmentReady ? null : visitForConsult(apptsCol.items, nowMs, appointmentId), [apptsCol.items, nowMs, appointmentId, appointmentReady]);
  // Keep an already-open target's editor identity through transient source loss.
  // This ref never accepts cache/error rows and is reset by the child/target key.
  const lastConfirmedTarget = useRef<Appointment | null>(null);
  if (appointmentId && appointmentReady && currentVisit) lastConfirmedTarget.current = currentVisit;
  const visit = appointmentId ? currentVisit ?? lastConfirmedTarget.current : currentVisit;
  const targetBlocked = !!appointmentId && (!appointmentReady || !currentVisit);
  const targetOpened = !appointmentId || !!lastConfirmedTarget.current;
  // This read receipt also protects body portals and captured callbacks. A
  // recovered source gets fresh approval; the unsaved editor stays mounted.
  const egressGuard = useMemo(() => appointmentId ? {
    isCurrent: () => isOwnerCurrent() && !targetBlocked && apptsCol.isCurrent()
      && !!currentVisit && !!visitForConsult([currentVisit], Date.now(), appointmentId),
  } : undefined, [appointmentId, targetBlocked, currentVisit, apptsCol.isCurrent, isOwnerCurrent]);
  const awaiting = useMemo(() => visitAwaitingOutcome(apptsCol.items, followUpsCol.items, nowMs), [apptsCol.items, followUpsCol.items, nowMs]);
  const anchorAudience = visit?.profession ? consultAudienceForProfession(visit.profession) : undefined;
  // B-CAREPRO-36 (closure): #/school-brief renders THIS page with the teacher
  // preselected (the School Brief editor inline under step 1). Applied once
  // like the visit anchor, never persisted as the parent's remembered choice;
  // the route stays live and keeps its own contract (build-school-brief).
  const routeAudience: ExportAudience | undefined = activeTab === "school-brief" ? "teacher" : undefined;
  const presetAudience = routeAudience ?? anchorAudience;
  // B-LOOP-12: the professional view's PDF · Copy · Send land here
  // (`#/consult?intake=<profession>`) — the profession preset builds the
  // intake packet (consult/packet buildIntakePacket) and it leaves through
  // the ONE step-3 egress, behind the same reviewed gate.
  const intakeRaw = query.get("intake");
  const intake = isIntakeProfession(intakeRaw) ? intakeRaw : undefined;
  const [outcome, setOutcome] = useState("");
  // NEXTLEVEL critic r1 (P1): the H1 names the audience the parent CHOSE.
  // "Prepare for the speech therapist on 14 Oct" stayed on screen after
  // Pediatrician was picked, so the two loudest lines named two people.
  const [chosen, setChosen] = useState<ExportAudience | undefined>(presetAudience);
  const heading = consultHeading({ visitAudience: anchorAudience, hasVisit: !!visit, chosen });

  const saveOutcome = () => {
    if (!awaiting) return;
    const record = makeFollowUp(awaiting.id, outcome, Date.now());
    if (!record) return;
    void followUpsCol.upsert(record);
    if (appointmentStatus(awaiting) !== "done") void apptsCol.upsert({ ...awaiting, status: "done" });
    setOutcome("");
    toast(t("elev.learnCare.appt.followUp.saved"), "success");
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
    toast(t("elev.homeProgram.saved"), "success");
  };
  const activeHome = activeHomeEnrolments(programsCol.items);

  /* Item 11 (IA-02): the surface contract reaches the DOM. Several routes
     render this one leaf — #/consult (build-share-packet), #/handoff
     (copy-handoff-brief), #/school-brief (build-school-brief, B-CAREPRO-36)
     and the retired #/find-pro — so the stamp's VALUE follows the route.
     W2-CAREPRO r2: AskSpecialist puts it on a real act — "Build the one-page
     summary" under step 1; in the teacher branch the inline School Brief's
     "Save as PDF" (B-CAREPRO-36). */
  const primaryMoveStamp = { "data-primary-move": activeTab === "handoff" ? "copy-handoff-brief" : activeTab === "school-brief" ? "build-school-brief" : "build-share-packet" };

  const audienceRead = consultAudienceReceipt?.read();
  const summaryGuard = useMemo(() => ({
    isCurrent: () => audienceRead?.isCurrent() === true && chosen !== undefined && chosen !== "teacher" && isOwnerCurrent() && (!egressGuard || egressGuard.isCurrent()),
  }), [audienceRead, chosen, isOwnerCurrent, egressGuard]);

  // Initially unconfirmed targets mount no editor. Once opened, retain its
  // unsaved state hidden/inert while blocked. Egress is independently guarded
  // because a body portal is outside this wrapper.
  return <>
    {targetBlocked && <div className="max-w-5xl mx-auto" data-testid="consult-visit-unavailable">
      <p role="status">{t(apptsCol.error || appointmentReady ? "elev.today.visit.unavailable" : "aria.loading")}</p>
      {apptsCol.loaded && <button type="button" className="min-h-11 rounded-full px-4 text-sm font-semibold" onClick={() => setActiveTab("appointments")}>{t("nav.tab.appointments")}</button>}
    </div>}
    {targetOpened && <div hidden={targetBlocked} inert={targetBlocked}>
      <header className="mb-5">
        <h1 data-testid="consult-h1" className="t-xl font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", textWrap: "balance" } as React.CSSProperties}>
          {heading === "visit" && visit
            ? t("elev.consult.h1.visit", { profession: appointmentRoleLabel(visit, t), date: fmtDay(visit.whenIso!, uiLang) })
            : heading === "audience" && chosen
            ? t("elev.consult.h1.audience", { audience: lowerFor(uiLang, t(`elev.carehonesty.consult.audience.${chosen}`)) })
            : t("elev.consult.h1")}
        </h1>
        {visit && heading !== "visit" && (
          <p data-testid="consult-visit-line" className="t-sm mt-1" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.consult.visitLine", { profession: appointmentRoleLabel(visit, t), date: fmtDay(visit.whenIso!, uiLang) })}
          </p>
        )}
        {firstName && (
          <p className="t-sm mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.consult.forName", { name: firstName })}</p>
        )}
        {/* B-PROG-10 (E3 canon): Care is a warm handoff to the family's own
            professionals and, in the guided pilot only, Arbor's light coach. */}
        {guidedTierOn() && (
          <p data-testid="consult-guided-tier" className="t-sm mt-2 leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
            {t("elev.program.care.guided", { name: firstName || t("learn.yourChild") })}
          </p>
        )}
      </header>
      <div data-module="consult-packet">
        {!awaiting && <section className="mb-5 rounded-[var(--r-lg)] border p-4" style={{ borderColor: "var(--arbor-rule)" }}>
          {!homeOpen ? <button type="button" className="min-h-11 rounded-full px-4 text-sm font-semibold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }} onClick={() => setHomeOpen(true)}>{t("elev.pilot.i.have.recommendations.for.home")}</button>
            : <HomeProgramEntry key={childProfile.id} childId={childProfile.id} profession={null} nextVisit={null} rows={programsCol.items} existingGoals={familyGoalsCol.items} onConfirm={saveHomeProgram} onCancel={() => setHomeOpen(false)} />}
        </section>}
        {activeHome.map((e) => (
          <HomeProgramDays key={e.id} enrolment={e} onSave={(exerciseId) => void programsCol.upsert(toggleExerciseDay(e, exerciseId))} />
        ))}
        {awaiting && (
          <section data-testid="consult-visit-outcome" className="mb-5 border-y py-4 flex flex-col gap-2" style={{ borderColor: "var(--arbor-rule)" }}>
            <label htmlFor="consult-visit-outcome-input" className="t-sm font-bold" style={{ color: "var(--arbor-ink)" }}>
              {t("elev.consult.visitOutcome.q", { profession: appointmentRoleLabel(awaiting, t), date: fmtDay(awaiting.whenIso!, uiLang) })}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="consult-visit-outcome-input"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                dir="auto"
                placeholder={t("elev.learnCare.appt.followUp.placeholder")}
                className="flex-1 min-w-0 rounded-xl px-3 min-h-11 t-sm"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
              <button
                type="button"
                data-testid="consult-visit-outcome-save"
                onClick={saveOutcome}
                disabled={!outcome.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 min-h-11 t-sm font-bold disabled:cursor-not-allowed"
                style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}
              >
                <Icon name="check" size={16} /> {t("elev.learnCare.appt.followUp.save")}
              </button>
            </div>
            {/* B-PROG-09: the second answer — the professional gave a home program */}
            {!homeOpen ? (
              <button
                type="button"
                data-testid="consult-home-program-choice"
                onClick={() => setHomeOpen(true)}
                className="inline-flex items-center gap-1.5 self-start rounded-xl px-4 min-h-11 t-sm font-semibold"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
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
        )}
        <AskSpecialist key={appointmentId ?? `${presetAudience ?? "no-visit"}${intake ? `:${intake}` : ""}`} primaryMoveStamp={primaryMoveStamp} anchorAudience={presetAudience} intake={intake} onAudienceChange={setChosen} egressGuard={egressGuard} />
        {chosen !== undefined && chosen !== "teacher" && <PracticeSummary egressGuard={summaryGuard} />}
      </div>
    </div>}
  </>;
}
