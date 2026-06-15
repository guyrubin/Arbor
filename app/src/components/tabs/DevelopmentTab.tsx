import React, { lazy } from "react";
import { Gauge, CheckCircle2, UserCircle, CalendarDays } from "lucide-react";
import HubTabs from "../ui/HubTabs";

/* My Child › Development — the four confusable "Development *" leaves
   (Dashboard, Milestones, Profile, Journey) collapsed into one place with
   internal facets. Each panel is the existing, unchanged tab component. */

const DevelopmentCopilot = lazy(() => import("../practice/DevelopmentCopilot"));
const MilestonesTab = lazy(() => import("./MilestonesTab"));
const ChildProfile = lazy(() => import("../sections/ChildProfile"));
const JourneyTab = lazy(() => import("../practice/JourneyTab"));

export default function DevelopmentTab() {
  return (
    <HubTabs
      ariaLabel="Development facets"
      panels={[
        { id: "now", label: "Now", icon: Gauge, Comp: DevelopmentCopilot },
        { id: "milestones", label: "Milestones", icon: CheckCircle2, Comp: MilestonesTab },
        { id: "profile", label: "Profile", icon: UserCircle, Comp: ChildProfile },
        { id: "journey", label: "Journey", icon: CalendarDays, Comp: JourneyTab },
      ]}
    />
  );
}
