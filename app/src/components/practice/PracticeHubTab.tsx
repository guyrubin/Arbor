import React, { lazy } from "react";
import { Mic, Smile, HeartPulse, Map, Target, Sprout, ArrowRight } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import HubTabs from "../ui/HubTabs";

/* Grow › Practice — the targeted drills gathered under one entry. Daily Missions
   moved to Today and Development Journey to My Child › Development, so Practice
   now holds exactly the deliberate skill drills. Panels are the existing tabs.
   B4 line: Practice = deliberate, repeatable drills; Daily Play = the everyday
   activity library (one pick pushed to Today). The two cross-link, never duplicate. */

const SpeechCoachTab = lazy(() => import("./SpeechCoachTab"));
const MimicStudioTab = lazy(() => import("./MimicStudioTab"));
const FeelingsLabTab = lazy(() => import("./FeelingsLabTab"));
const AdventuresTab = lazy(() => import("./AdventuresTab"));

export default function PracticeHubTab() {
  const { t } = useLanguage();
  const { childProfile, setActiveTab } = useArbor();
  const firstName = (childProfile.name || "your child").split(" ")[0];

  return (
    <div className="space-y-5 max-w-[1080px]">
      <header>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
          <Target className="w-3.5 h-3.5" /> {t("practice.eyebrow")}
        </span>
        <h1 className="text-[1.6rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("practice.title", { name: firstName })}
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--arbor-muted)" }}>
          {t("practice.subtitle")}
        </p>
      </header>

      <HubTabs
        ariaLabel="Practice drills"
        panels={[
          { id: "adventures", label: t("nav.tab.adventures"), icon: Map, Comp: AdventuresTab },
          { id: "feelings", label: t("nav.tab.feelings"), icon: HeartPulse, Comp: FeelingsLabTab },
          { id: "speech", label: t("nav.tab.speech"), icon: Mic, Comp: SpeechCoachTab },
          { id: "mimic", label: t("nav.tab.mimic"), icon: Smile, Comp: MimicStudioTab },
        ]}
      />

      {/* B4 reciprocal cross-link: point to Daily Play instead of duplicating it. */}
      <button
        onClick={() => setActiveTab("daily-play")}
        className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[13.5px] font-bold transition active:scale-[0.99] min-h-[44px]"
        style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}
      >
        <Sprout className="w-4 h-4" /> {t("practice.toDailyPlay")} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
      </button>
    </div>
  );
}
