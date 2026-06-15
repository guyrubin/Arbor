import React, { lazy } from "react";
import { Mic, Smile, HeartPulse, Map } from "lucide-react";
import HubTabs from "../ui/HubTabs";

/* Grow › Practice — the targeted drills gathered under one entry. Daily Missions
   moved to Today and Development Journey to My Child › Development, so Practice
   now holds exactly the deliberate skill drills. Panels are the existing tabs. */

const SpeechCoachTab = lazy(() => import("./SpeechCoachTab"));
const MimicStudioTab = lazy(() => import("./MimicStudioTab"));
const FeelingsLabTab = lazy(() => import("./FeelingsLabTab"));
const AdventuresTab = lazy(() => import("./AdventuresTab"));

export default function PracticeHubTab() {
  return (
    <HubTabs
      ariaLabel="Practice drills"
      panels={[
        { id: "speech", label: "Speech Coach", icon: Mic, Comp: SpeechCoachTab },
        { id: "mimic", label: "Mimic Studio", icon: Smile, Comp: MimicStudioTab },
        { id: "feelings", label: "Feelings Lab", icon: HeartPulse, Comp: FeelingsLabTab },
        { id: "adventures", label: "Adventures", icon: Map, Comp: AdventuresTab },
      ]}
    />
  );
}
