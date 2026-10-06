import React, { useMemo, useState } from "react";
import AskSpecialist from "../sections/AskSpecialist";
import { isIntakeProfession, type ExportAudience } from "../../consult/packet";
import { useHashQuery } from "../../hooks/useHashQuery";
import { appointmentRoleLabel } from "../sections/Appointments";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fmtDay } from "../../lib/formatDate";
import { Icon } from "../ui/Icon";
import {
  appointmentStatus,
  consultAudienceForProfession,
  makeFollowUp,
  nextPrepareVisit,
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
  const { childProfile, activeTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const firstName = (childProfile.name || "").split(" ")[0];
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments");
  const followUpsCol = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");
  const nowMs = Date.now();
  const visit = useMemo(() => nextPrepareVisit(apptsCol.items, nowMs), [apptsCol.items, nowMs]);
  const awaiting = useMemo(() => visitAwaitingOutcome(apptsCol.items, followUpsCol.items, nowMs), [apptsCol.items, followUpsCol.items, nowMs]);
  const anchorAudience = visit?.profession ? consultAudienceForProfession(visit.profession) : undefined;
  // B-LOOP-12: the professional view's PDF · Copy · Send land here
  // (`#/consult?intake=<profession>`) — the profession preset builds the
  // intake packet (consult/packet buildIntakePacket) and it leaves through
  // the ONE step-3 egress, behind the same reviewed gate.
  const intakeRaw = useHashQuery().get("intake");
  const intake = isIntakeProfession(intakeRaw) ? intakeRaw : undefined;
  const [outcome, setOutcome] = useState("");
  // NEXTLEVEL critic r1 (P1): the H1 names the audience the parent CHOSE.
  // "Prepare for the speech therapist on 14 Oct" stayed on screen after
  // Pediatrician was picked, so the two loudest lines named two people.
  const [chosen, setChosen] = useState<ExportAudience | undefined>(anchorAudience);
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

  /* Item 11 (IA-02): the surface contract reaches the DOM. TWO routes render
     this one leaf — #/consult (build-share-packet) and #/handoff
     (copy-handoff-brief) — so the stamp's VALUE follows the route. W2-CAREPRO
     r2: AskSpecialist puts it on a real act — "Build the one-page summary"
     under step 1 (the teacher branch: "Open the School Brief"). */
  const primaryMoveStamp = { "data-primary-move": activeTab === "handoff" ? "copy-handoff-brief" : "build-share-packet" };

  return (
    <div>
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
      </header>
      <div data-module="consult-packet">
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
          </section>
        )}
        <AskSpecialist key={`${anchorAudience ?? "no-visit"}${intake ? `:${intake}` : ""}`} primaryMoveStamp={primaryMoveStamp} anchorAudience={anchorAudience} intake={intake} onAudienceChange={setChosen} />
      </div>
    </div>
  );
}
