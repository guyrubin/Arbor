import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import AskSpecialist from "../sections/AskSpecialist";
import NoticeCareTarget from "../companion/NoticeCareTarget";
import { isIntakeProfession, type ExportAudience } from "../../consult/packet";
import { visitForConsult } from "../../lib/today/dayCard";
import { useHashQuery } from "../../hooks/useHashQuery";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { ReceiptNoteLine, undoThen, useReceiptNote } from "../ui/Receipt";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fmtDayV10 } from "../../lib/formatDate";
import { Icon } from "../ui/Icon";
import { guidedTierOn } from "../../lib/entitlementsGuided";
import HomeProgramEntry, { HomeProgramDays, homeProfessionForAppointment, nextVisitDayFor, type EntryWrites } from "../program/HomeProgramEntry";
import CareAside from "../care/CareAside";
import CareShared from "../care/CareShared";
import VisitTimeline from "../care/v10/VisitTimeline";
import { careCopy } from "../care/v10/careV10Copy";
import VisitsComposition from "../care/v10/VisitsComposition";
import type { PackedCounts } from "../care/v10/VisitScene";
import { DsRoot } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { parentWords, reportsLeadCounts } from "../../lib/recordCounts";
import type { LangObservation } from "../../growth/vocabAgg";
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
  const scope = JSON.stringify([user?.uid ?? "local", childProfile.id, query.get("appointment"), query.get("notice"), query.get("child")]);
  const owner = useRef({ scope, token: {} });
  if (owner.current.scope !== scope) owner.current = { scope, token: {} };
  const token = owner.current.token;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isOwnerCurrent = useCallback(() => mounted.current && owner.current.token === token, [token]);
  if (query.has("notice")) return <NoticeCareTarget key={scope} query={query} />;
  return <ConsultContent key={scope} query={query} isOwnerCurrent={isOwnerCurrent} />;
}

function ConsultContent({ query, isOwnerCurrent }: { query: URLSearchParams; isOwnerCurrent: () => boolean }) {
  const { user } = useAuth();
  const { childProfile, activeTab, setActiveTab, behaviorLogs, milestones, actionPlans } = useArbor();
  const composition = useComposition();
  const currentChild = useRef(childProfile.id);
  currentChild.current = childProfile.id;
  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  // B-STATUS-01: a kept visit answer or home program answers with ONE receipt
  // line at the head of the packet module (the answered field leaves with the
  // visit), Undo on the follow-up.
  const receipt = useReceiptNote();
  const firstName = (childProfile.name || "").split(" ")[0];
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments", { trackConfirmation: true });
  const followUpsCol = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");
  const nowMs = Date.now();
  // Design v10.1 — "Packed so far" on the visit scene: the whole record's
  // counts, read the way Reports and the summary's since line read them.
  const langObsCol = useChildCollection<LangObservation>(childProfile.id, "langObs", { orderByField: "timestamp", orderDir: "desc", max: 200 });
  const packed = useMemo<PackedCounts>(() => {
    const whole = reportsLeadCounts({ logs: behaviorLogs ?? [], milestones: milestones ?? [], langObs: langObsCol.items, sinceIso: null, nowMs: Date.now(), wholeRecord: true });
    // Design V77: "moments in your words" counts the moments that carry the
    // parent's own words (never an incident's trigger); plan steps are the
    // ones the family marked done in its action plans.
    const ownWords = (behaviorLogs ?? []).filter((l) => parentWords(l) !== "").length;
    const planSteps = (actionPlans ?? []).reduce((n, p) => n + p.phases.reduce((m, ph) => m + ph.steps.filter((st) => st.completed).length, 0), 0);
    return { moments: ownWords, milestones: whole.milestones, words: langObsCol.items.filter((o) => (o.phrase ?? "").trim().length > 0).length, planSteps };
  }, [behaviorLogs, milestones, actionPlans, langObsCol.items]);
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
  // v3 EXTRA-CARE: the visit-outcome answer the parent is saving, or whose
  // save is not confirmed yet. Signed in, Firestore applies the write to this
  // device's cache at once, so the follow-up reaches followUpsCol.items before
  // the server confirms it, and visitAwaitingOutcome would close the loop and
  // unmount the answer. Held, that record does not count until the write is
  // acknowledged: the field, the answer and the same-id retry stay.
  const [heldOutcome, setHeldOutcome] = useState<{ record: AppointmentFollowUp; state: "saving" | "queued" | "failed" } | null>(null);
  const heldId = heldOutcome?.record.id;
  const awaiting = useMemo(
    () => visitAwaitingOutcome(apptsCol.items, heldId ? followUpsCol.items.filter((f) => f.id !== heldId) : followUpsCol.items, nowMs),
    [apptsCol.items, followUpsCol.items, nowMs, heldId],
  );
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
  // v3 EXTRA-CARE: the visit-outcome receipt follows persistence. While the
  // write is pending the save is disabled.
  const savingOutcome = heldOutcome?.state === "saving";
  // NEXTLEVEL critic r1 (P1): the H1 names the audience the parent CHOSE.
  // "Prepare for the speech therapist on 14 Oct" stayed on screen after
  // Pediatrician was picked, so the two loudest lines named two people.
  const [chosen, setChosen] = useState<ExportAudience | undefined>(presetAudience);
  const headingKind = consultHeading({ visitAudience: anchorAudience, hasVisit: !!visit, chosen });
  // v4: Past exports' "Prepare an update" selects that audience in the builder.
  const [audienceRequest, setAudienceRequest] = useState<{ audience: ExportAudience; seq: number } | undefined>(undefined);
  const prepareAgain = (audience: ExportAudience) => setAudienceRequest({ audience, seq: (audienceRequest?.seq ?? 0) + 1 });

  // v3 EXTRA-CARE: "Saved" only after the follow-up write is acknowledged.
  // Offline or unanswered, the answer stays in the field and the toast says
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
    const held = heldOutcome?.record;
    const record = held && held.apptId === awaiting.id && note ? { ...held, note } : makeFollowUp(awaiting.id, note, Date.now());
    if (!record) return;
    setHeldOutcome({ record, state: "saving" });
    const childId = childProfile.id;
    try {
      await followUpsCol.upsert(record, { requireAcknowledgement: true });
    } catch (err) {
      if (currentChild.current !== childId) return;
      const refused = typeof err === "object" && err !== null && "code" in err;
      const queued = followUpsCol.remote && !refused;
      setHeldOutcome({ record, state: queued ? "queued" : "failed" });
      toast(t(queued ? "elev.consult.visitOutcome.queued" : "elev.consult.visitOutcome.saveError"), "error");
      return;
    }
    const before = awaiting;
    const wasDone = appointmentStatus(before) === "done";
    if (!wasDone) {
      try { await apptsCol.upsert({ ...before, status: "done" }); } catch { /* the follow-up already closed the loop */ }
    }
    if (currentChild.current !== childId) return;
    setHeldOutcome(null);
    setOutcome("");
    receipt.show({
      text: t("elev.learnCare.appt.followUp.saved"),
      undo: {
        label: t("elev.loop.notice.undo"),
        testId: "consult-receipt-undo",
        // B-STATUS-01: the line clears (and the note returns) only once the writes went through.
        onUndo: undoThen(async () => {
          await followUpsCol.remove(record.id);
          if (!wasDone) await apptsCol.upsert(before);
        }, () => { receipt.clear(); setOutcome(note); }),
      },
    });
  };

  // B-PROG-09 (assignment in): the ONLY place the home program is written —
  // on the parent's confirm, after every proposed goal was accepted in their
  // words or left out. The exercises, in the parent's words, are the visit's
  // follow-up ("What did they suggest?"), which closes the booking.
  const saveHomeProgram = async (w: Extract<EntryWrites, { ok: true }>) => {
    const childId = childProfile.id;
    const record = awaiting ? makeFollowUp(awaiting.id, w.enrolment.home.exercises.map((e) => e.text).join(" · "), Date.now()) : null;
    // Critic r1: what Undo writes back — the programs this save superseded as
    // they were, and the booking as it was.
    const before = { programs: w.superseded.map((old) => programsCol.items.find((p) => p.id === old.id)).filter((p): p is HomeProgramEnrolment => !!p), visit: awaiting, visitWasDone: !awaiting || appointmentStatus(awaiting) === "done" };
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
    receipt.show({
      text: t("elev.homeProgram.saved"),
      // Critic r1: the save is reversible — Undo removes what it added and
      // writes back what it changed.
      undo: {
        label: t("elev.loop.notice.undo"),
        testId: "home-program-receipt-undo",
        // B-STATUS-01: every write is awaited; a refused one keeps the line
        // (Try again re-runs them all — each is idempotent).
        onUndo: undoThen(async () => {
          await programsCol.remove(w.enrolment.id);
          for (const prev of before.programs) await programsCol.upsert(prev);
          for (const goal of w.goals) await familyGoalsCol.remove(goal.id);
          if (record) await followUpsCol.remove(record.id);
          if (before.visit && !before.visitWasDone) await apptsCol.upsert(before.visit);
        }, receipt.clear),
      },
    });
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
  /* v3 FEAT-09: #/handoff is the Care summary pill — the summary builder
     alone (AskSpecialist: who it is for, what changed, what leaves), under its
     own H1. The visit's open loop, the home program and the guided-coach line
     stay on #/consult, so this page holds one job and the route's one stamp. */
  const summary = activeTab === "handoff";
  /* v3 EXTRA-CARE → v4 (Care, together is ONE screen, no tabs): #/consult is
     the Care landing. Three modules: the next visit card with its three prep
     steps (the builder, holding the route's one move, its template choosing
     a visit summary or a teacher brief), the aside (Help and safety, the
     page's way into #/safety) and what is shared (Who sees what, Past
     exports, the trust line). #/handoff and #/school-brief keep the builder
     alone. At 1600 px and up the aside is an end column (1fr | 20rem) and
     the shared cards run under both; from lg the visit card spans the row
     and Help and safety sits beside the two shared cards (1 | 2); below lg,
     one column in DOM order. The builder already folds into its own two
     panes at lg (1fr | 22rem, the sticky step-3 column, pinned by
     consultVisitAnchor.test), so it always keeps the full width under
     1600 px. Safety stays one tap away in every width (this card and the
     More sheet). */
  const landing = activeTab === "consult";
  const homeEntry = !summary && !awaiting && (
    <section className="rcard care-home">
      {!homeOpen ? <button type="button" className="xrow care-home-open" onClick={() => setHomeOpen(true)}><Icon name="home" size={18} /><span className="grow">{t("elev.pilot.i.have.recommendations.for.home")}</span><Icon name="chevron_right" size={18} className="rtl:-scale-x-100" /></button>
        : <HomeProgramEntry key={childProfile.id} childId={childProfile.id} profession={null} nextVisit={null} rows={programsCol.items} existingGoals={familyGoalsCol.items} onConfirm={saveHomeProgram} onCancel={() => setHomeOpen(false)} />}
    </section>
  );
  const homeDays = !summary && activeHome.map((e) => (
    <HomeProgramDays key={e.id} enrolment={e} onSave={(exerciseId) => void programsCol.upsert(toggleExerciseDay(e, exerciseId))} />
  ));
  /* v3 FEAT-09: on #/handoff the builder never opens in the teacher branch
     (a teacher stored on this device or a teacher visit would put the School
     Brief editor under the summary H1); School brief is its own pill. */
  const heading = (
    <h1 data-testid="consult-h1" id="consult-h1" tabIndex={-1} className="hero care-h1">
      {summary
        ? t("elev.consult.h1.summary")
        : headingKind === "visit" && visit
        // Design V77: on the landing the scene carries the day, so the H1 names who only.
        ? landing
          ? careCopy(uiLang).visits.heading(lowerFor(uiLang, appointmentRoleLabel(visit, t)))
          : t("elev.consult.h1.visit", { profession: appointmentRoleLabel(visit, t), date: fmtDayV10(visit.whenIso!, uiLang) })
        : headingKind === "audience" && chosen
        ? t("elev.consult.h1.audience", { audience: lowerFor(uiLang, t(`elev.carehonesty.consult.audience.${chosen}`)) })
        : t("elev.consult.h1")}
    </h1>
  );
  /* The lines production keeps under the H1: the summary's lede, the visit
     line where the H1 does not name the visit, "for {name}" and the guided
     pilot's coach line. */
  const sublines = (
    <>
      {summary && <p data-testid="consult-summary-lede" className="care-sub">{t("elev.consult.summary.lede")}</p>}
      {/* Design V77: with a visit booked the scene speaks for itself (no sub-line, no "for {name}"). */}
      {landing && !visit && <p data-testid="consult-sub" className="care-sub">{t("elev.consult.sub")}</p>}
      {/* Design V77 (N-Brief): the brief's description is the hero's line. */}
      {!landing && chosen === "teacher" && <p data-testid="consult-teacher-lede" className="care-sub">{careCopy(uiLang).brief.lede}</p>}
      {/* V77 N-Brief-M: the phone brief's hero carries no visit line (the dock keeps its Save as PDF in view). */}
      {/* V77 N-Brief: the brief names its next visit in the stage's header row (desktop) and not at all on a phone. */}
      {visit && (summary || (!landing && headingKind !== "visit")) && chosen !== "teacher" && (
        <p data-testid="consult-visit-line" className="care-sub">{t("elev.consult.visitLine", { profession: appointmentRoleLabel(visit, t), date: fmtDayV10(visit.whenIso!, uiLang) })}</p>
      )}
      {/* The Teacher brief's own title names the child; "for {name}" would say it twice. */}
      {firstName && chosen !== "teacher" && !(landing && visit) && <p className="care-sub muted">{t("elev.consult.forName", { name: firstName })}</p>}
      {/* B-PROG-10 (E3 canon): Care is a warm handoff to the family's own
          professionals and, in the guided pilot only, Arbor's light coach. */}
      {!summary && guidedTierOn() && (
        <p data-testid="consult-guided-tier" className="care-sub">{t("elev.program.care.guided", { name: firstName || t("learn.yourChild") })}</p>
      )}
    </>
  );

  /* The visit's open loop ("What did they suggest?") and the home program:
     on the landing they sit with the appointments (section 4); on the other
     routes, under the summary. #/handoff holds the summary alone. */
  const followUp = !summary && (
    <div className="care-followup">
      <ReceiptNoteLine note={receipt.note} testId="consult-receipt" />
      {awaiting && (
        <section data-testid="consult-visit-outcome" className="rcard care-outcome">
          <label htmlFor="consult-visit-outcome-input" className="rt">
            {t("elev.consult.visitOutcome.q", { profession: appointmentRoleLabel(awaiting, t), date: fmtDayV10(awaiting.whenIso!, uiLang) })}
          </label>
          <div className="care-outcome-row">
            <input
              id="consult-visit-outcome-input"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              readOnly={savingOutcome}
              dir="auto"
              placeholder={t("elev.learnCare.appt.followUp.placeholder")}
              className="care-input min-h-11"
            />
            <button
              type="button"
              data-testid="consult-visit-outcome-save"
              onClick={() => { void saveOutcome(); }}
              disabled={!outcome.trim() || savingOutcome}
              aria-busy={savingOutcome}
              className="mbtn care-btn"
            >
              <Icon name="check" size={16} /> {savingOutcome ? t("elev.consult.visitOutcome.saving") : t("elev.learnCare.appt.followUp.save")}
            </button>
          </div>
          {/* v3 EXTRA-CARE: after the toast fades, the field still says why
              the answer is here: kept on this device, not confirmed yet. */}
          {heldOutcome?.state === "queued" && (
            <p data-testid="consult-visit-outcome-held" className="small">{t("elev.consult.visitOutcome.held")}</p>
          )}
          {/* B-PROG-09: the second answer — the professional gave a home program */}
          {!homeOpen ? (
            <button type="button" data-testid="consult-home-program-choice" onClick={() => setHomeOpen(true)} className="ds-link">
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
      {/* Design V77: on the landing the home door sits in the Share card (desktop) or the getting-ready card (phone). */}
      {/* V77 N-Brief: the Teacher brief carries no home-program door (Visits holds it). */}
      {!landing && chosen !== "teacher" && homeEntry}
      {homeDays}
    </div>
  );

  const builder = (
    <AskSpecialist
      key={`${summary ? "summary:" : ""}${appointmentId ?? `${presetAudience ?? "no-visit"}${intake ? `:${intake}` : ""}`}`}
      primaryMoveStamp={primaryMoveStamp}
      anchorAudience={presetAudience}
      intake={intake}
      onAudienceChange={setChosen}
      egressGuard={egressGuard}
      excludeTeacher={summary}
      landing={landing}
      audienceRequest={audienceRequest}
      layout={{
        component: VisitsComposition,
        props: {
          composition,
          visit,
          heading,
          sublines,
          packed,
          landing,
          followUp,
          homeDoor: landing ? homeEntry : null,
          timeline: landing ? <VisitTimeline appointments={apptsCol.items} followUps={followUpsCol.items} nowMs={nowMs} /> : null,
          aside: landing ? <CareAside /> : null,
          shared: landing ? <CareShared onPrepareAgain={prepareAgain} /> : null,
          nowMs,
        },
      }}
    />
  );

  // Initially unconfirmed targets mount no editor. Once opened, retain its
  // unsaved state hidden/inert while blocked. Egress is independently guarded
  // because a body portal is outside this wrapper.
  return <>
    {targetBlocked && <div className="max-w-5xl mx-auto" data-testid="consult-visit-unavailable">
      <p role="status">{t(apptsCol.error || appointmentReady ? "elev.today.visit.unavailable" : "aria.loading")}</p>
      {apptsCol.loaded && <button type="button" className="min-h-11 rounded-full px-4 text-sm font-semibold" onClick={() => setActiveTab("appointments")}>{t("nav.tab.appointments")}</button>}
    </div>}
    {targetOpened && <DsRoot composition={composition} hidden={targetBlocked} inert={targetBlocked} data-module="consult-packet" data-testid="consult-landing" className="care-v10">
      {builder}
    </DsRoot>}
  </>;
}
