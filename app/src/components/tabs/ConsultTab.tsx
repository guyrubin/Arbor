import React, { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { Stethoscope, ListChecks } from "lucide-react";
import AskSpecialist from "../sections/AskSpecialist";
import { HubHero } from "../ui/HubHero";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";

/* Care › Consult — one verb for "get expert input". The former three facets
   (Ask a specialist / AI handoff brief / Find a professional) and the hidden
   handoff door are collapsed into a single linear flow (b3): a parent-redacted
   packet from the child's record with one action bar — Copy / Download /
   Export as PDF / Send to a professional. The flow itself lives in
   AskSpecialist (the warm-handoff spine); reports and the directory fold in as
   actions, not separate doors. Shell already lazy-loads + Suspense-wraps this
   tab, so it renders the spine directly with no HubTabs sub-nav.

   E2: the hub opens with the shared HubHero (eyebrow · job sentence about the
   redaction-controlled summary · ONE CTA that brings the live summary into
   view). No stat trio here on purpose: context holds no share/pro/report
   history, and we show fewer pills rather than invent counts (firewall). */

export default function ConsultTab() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const firstName = (childProfile.name || "").split(" ")[0];

  // The packet builds itself live from the child record below — the hero CTA's
  // honest job is to bring that summary into view (motion-gated scroll).
  const flowRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <HubHero
        // R14 (LC-28): the packet heading sat at 1,440 px at 390. The hero is
        // the first block of that column, so it gives back what it can WITHOUT
        // touching the shared primitive (ui/HubHero.tsx is not this item's to
        // edit): tighter padding and margin below md, and the generic hero sub
        // stands down at the same breakpoint — the child-specific sub in the
        // section header below is the one worth the height at 390.
        // There is no stat trio to drop: this hub passes no `stats` on
        // purpose (see the note above), so `zeroLine` never renders either.
        className="max-md:p-4 max-md:mb-3 max-md:[&_p]:hidden"
        zeroLine={t("elev.growthTruth.hero.empty")}
        tone="sky"
        icon={Stethoscope}
        eyebrow={t("elev.hero.care.eyebrow")}
        title={t("elev.hero.care.title", { name: firstName })}
        subtitle={t("elev.hero.care.sub")}
        cta={{
          label: t("elev.hero.care.cta"),
          icon: <ListChecks aria-hidden="true" size={16} strokeWidth={2.4} />,
          // LC-28 / OBJ-CARE-02: the CTA used to scroll to the TOP of the flow,
          // which at 390 still left the packet at ~1,320 px and the day-0 empty
          // state at ~1,480. It now targets the export bar's audience row — the
          // required first step — and moves focus there, so the packet and its
          // one decision land together. Falls back to the flow when the row is
          // not mounted (day-0 renders the empty state instead of the bar).
          onClick: () => {
            const target =
              (document.getElementById("consult-audience-row") as HTMLElement | null) ?? flowRef.current;
            target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
            target?.focus?.({ preventScroll: true });
          },
          testId: "care-hero-cta",
        }}
        testId="care-hub-hero"
      />
      <div ref={flowRef} style={{ scrollMarginBlockStart: "0.75rem" }}>
        <AskSpecialist />
      </div>
    </div>
  );
}
