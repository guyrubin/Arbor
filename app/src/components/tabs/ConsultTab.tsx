import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import AskSpecialist from "../sections/AskSpecialist";
import { isIntakeProfession, type ExportAudience } from "../../consult/packet";
import { visitForConsult } from "../../lib/today/dayCard";
import { useHashQuery } from "../../hooks/useHashQuery";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fmtDay } from "../../lib/formatDate";
import { Icon } from "../ui/Icon";
import { guidedTierOn } from "../../lib/entitlementsGuided";
import CareAside from "../care/CareAside";
import CareDoors from "../care/CareDoors";
import CareVisitHead from "../care/CareVisitHead";
import {
  consultAudienceForProfession,
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
   closes the booking. No push, no reminder, no count.

   v3 F-CARE-1: that answer (and the home program a professional gave) now
   lives on #/appointments, the visit's own page (care/VisitOutcome); the
   landing keeps ONE line in the visit card's head that opens it. The Care
   landing's H1 is the door's own sentence ("A shared picture with the people
   who help."); the visit is named in the card. #/school-brief keeps the
   visit- or audience-named H1. */

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
  const { childProfile, activeTab, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const firstName = (childProfile.name || "").split(" ")[0];
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments", { trackConfirmation: true });
  const followUpsCol = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");
  const nowMs = Date.now();
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
  // v3 F-CARE-1: the last visit's open loop ("What did they suggest?"). The
  // answer is written on #/appointments (care/VisitOutcome); here it is one
  // line that opens that page.
  const awaiting = useMemo(
    () => visitAwaitingOutcome(apptsCol.items, followUpsCol.items, nowMs),
    [apptsCol.items, followUpsCol.items, nowMs],
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
  // NEXTLEVEL critic r1 (P1): the H1 names the audience the parent CHOSE.
  // "Prepare for the speech therapist on 14 Oct" stayed on screen after
  // Pediatrician was picked, so the two loudest lines named two people.
  const [chosen, setChosen] = useState<ExportAudience | undefined>(presetAudience);
  const heading = consultHeading({ visitAudience: anchorAudience, hasVisit: !!visit, chosen });

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
     own H1. The visit's open loop and the guided-coach line stay on #/consult,
     so this page holds one job and the route's one stamp. */
  const summary = activeTab === "handoff";
  /* v3 EXTRA-CARE: #/consult is the Care landing. Three modules: the next
     visit card with its three prep steps (the builder, holding the route's
     one move), the aside (Help and safety, Who sees what) and the doors with
     the trust line. #/handoff and #/school-brief keep the builder alone.
     v3 F-CARE-1 (mock :333): from xl (1280) a 1.6fr | 1fr grid — the visit
     card in the start column, the aside stacked in the end column, the doors
     full width under both. The card shows ONE step body at a time there (the
     stepper), so the builder's own lg two-pane fold does not apply on the
     landing. Below xl, one column in DOM order: visit, aside (two cards side
     by side from md), doors. */
  const landing = activeTab === "consult";
  /* v3 F-CARE-1: while the last visit waits for "What did they suggest?",
     the card's head carries ONE line that opens Appointments, where the
     answer and a home program are written. Not a move: no stamp. */
  const outcomeLink = landing && awaiting ? (
    <button
      type="button"
      data-testid="consult-visit-outcome-link"
      onClick={() => setActiveTab("appointments")}
      className="self-start inline-flex items-center gap-2 rounded-xl px-3 min-h-[44px] t-sm font-bold text-start"
      style={{ background: "var(--arbor-sky-wash)", color: "var(--arbor-sky-ink)" }}
    >
      <Icon name="forum" size={18} className="flex-shrink-0" />
      <span className="min-w-0">{t("elev.consult.visitOutcome.q", { profession: appointmentRoleLabel(awaiting, t), date: fmtDay(awaiting.whenIso!, uiLang) })}</span>
      <Icon name="chevron_right" size={18} className="flex-shrink-0 rtl:-scale-x-100" />
    </button>
  ) : undefined;
  /* v3 FEAT-09: on #/handoff the builder never opens in the teacher branch
     (a teacher stored on this device or a teacher visit would put the School
     Brief editor under the summary H1); School brief is its own pill. */
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
      head={landing ? <CareVisitHead visit={visit ?? null} /> : undefined}
      headAfter={outcomeLink}
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
    {targetOpened && <div hidden={targetBlocked} inert={targetBlocked}>
      <header className={landing ? "mb-6 max-w-[46rem]" : "mb-5"}>
        {landing && (
          <p data-testid="consult-kicker" className="t-xs font-bold mb-2" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.consult.kicker")}</p>
        )}
        {/* v3 F-CARE-1: on the landing the H1 is the door's sentence at the
            kit's hero step; the visit is named in the card's head. */}
        <h1 data-testid="consult-h1" className={landing ? "arbor-type-hero" : "t-xl font-extrabold leading-tight"} style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", textWrap: "balance" } as React.CSSProperties}>
          {landing
            ? t("elev.consult.title")
            : summary
            ? t("elev.consult.h1.summary")
            : heading === "visit" && visit
            ? t("elev.consult.h1.visit", { profession: appointmentRoleLabel(visit, t), date: fmtDay(visit.whenIso!, uiLang) })
            : heading === "audience" && chosen
            ? t("elev.consult.h1.audience", { audience: lowerFor(uiLang, t(`elev.carehonesty.consult.audience.${chosen}`)) })
            : t("elev.consult.h1")}
        </h1>
        {summary && (
          <p data-testid="consult-summary-lede" className="t-sm mt-1" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.consult.summary.lede")}</p>
        )}
        {landing && (
          <p data-testid="consult-sub" className="hidden sm:block t-base mt-2.5 max-w-[65ch]" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.consult.sub")}</p>
        )}
        {visit && (summary || (!landing && heading !== "visit")) && (
          <p data-testid="consult-visit-line" className="t-sm mt-1" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.consult.visitLine", { profession: appointmentRoleLabel(visit, t), date: fmtDay(visit.whenIso!, uiLang) })}
          </p>
        )}
        {firstName && !landing && (
          <p className="t-sm mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.consult.forName", { name: firstName })}</p>
        )}
        {/* B-PROG-10 (E3 canon): Care is a warm handoff to the family's own
            professionals and, in the guided pilot only, Arbor's light coach. */}
        {!summary && guidedTierOn() && (
          <p data-testid="consult-guided-tier" className="t-sm mt-2 leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
            {t("elev.program.care.guided", { name: firstName || t("learn.yourChild") })}
          </p>
        )}
      </header>
      <div data-testid="consult-landing" className={landing ? "flex flex-col gap-3.5 xl:grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-4 xl:items-start" : undefined}>
      <div data-module="consult-packet" className="min-w-0">
        {/* v3 EXTRA-CARE: on the Care landing the builder IS the visit card —
            one primary surface holding the visit's head (who, when, in how
            many days, the since counts) directly followed by the steps. */}
        {landing ? (
          <section
            data-testid="consult-visit-card"
            className="arbor-depth-primary rounded-[22px] overflow-hidden"
            style={{ background: "var(--arbor-paper-elevated)" }}
          >
            {builder}
          </section>
        ) : builder}
      </div>
      {landing && <CareAside />}
      {landing && <CareDoors />}
      </div>
    </div>}
  </>;
}
