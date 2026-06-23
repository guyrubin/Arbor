import React, { lazy } from "react";
import { Mic, Smile, HeartPulse, Map } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import HubTabs from "../ui/HubTabs";
// AP-059: Weekly missions calendar strip — rendered at the TOP of the
// child-facing Learning Studio, above the drill tabs. Reads existing
// missionRecords; no new write path.
import WeeklyMissionsStrip from "./WeeklyMissionsStrip";

/* Grow › Practice — the targeted drills gathered under one entry. Daily Missions
   moved to Today and Development Journey to My Child › Development, so Practice
   now holds exactly the deliberate skill drills. Panels are the existing tabs. */

const SpeechCoachTab = lazy(() => import("./SpeechCoachTab"));
const MimicStudioTab = lazy(() => import("./MimicStudioTab"));
const FeelingsLabTab = lazy(() => import("./FeelingsLabTab"));
const AdventuresTab = lazy(() => import("./AdventuresTab"));

export default function PracticeHubTab() {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      {/* AP-059: 7-day weekly missions progress strip — DISTINCT from the daily-goal
          ring (this is a weekly cadence layer; the ring shows today's circular
          progress and lives in separate components/overview surfaces). */}
      <WeeklyMissionsStrip />
      <HubTabs
        ariaLabel="Practice drills"
        panels={[
          { id: "adventures", label: t("nav.tab.adventures"), icon: Map, Comp: AdventuresTab },
          { id: "feelings", label: t("nav.tab.feelings"), icon: HeartPulse, Comp: FeelingsLabTab },
          { id: "speech", label: t("nav.tab.speech"), icon: Mic, Comp: SpeechCoachTab },
          { id: "mimic", label: t("nav.tab.mimic"), icon: Smile, Comp: MimicStudioTab },
        ]}
      />
    </div>
  );
}
