import React from "react";
import AskSpecialist from "../sections/AskSpecialist";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";

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
   subline, and step 1 directly under it. */

export default function ConsultTab() {
  const { childProfile, activeTab } = useArbor();
  const { t } = useLanguage();
  const firstName = (childProfile.name || "").split(" ")[0];

  /* Item 11 (IA-02): the surface contract reaches the DOM. TWO routes render
     this one leaf — #/consult (build-share-packet) and #/handoff
     (copy-handoff-brief) — so the stamp's VALUE follows the route. W2-CAREPRO
     r1: the stamp no longer sits on the ~2000 px flow wrapper (its "y" was
     the wrapper top); AskSpecialist puts it on the selected audience chip —
     the move's first act, one 44 px button in step 1. */
  const primaryMoveStamp = { "data-primary-move": activeTab === "handoff" ? "copy-handoff-brief" : "build-share-packet" };

  return (
    <div>
      <header className="mb-5">
        <h1 data-testid="consult-h1" className="t-xl font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", textWrap: "balance" } as React.CSSProperties}>
          {t("elev.consult.h1")}
        </h1>
        {firstName && (
          <p className="t-sm mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.consult.forName", { name: firstName })}</p>
        )}
      </header>
      <div data-module="consult-packet">
        <AskSpecialist primaryMoveStamp={primaryMoveStamp} />
      </div>
    </div>
  );
}
