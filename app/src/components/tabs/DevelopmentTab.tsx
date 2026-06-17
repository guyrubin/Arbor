import React, { lazy } from "react";
import { Gauge, CheckCircle2, UserCircle, CalendarDays } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import HubTabs from "../ui/HubTabs";
import DevScoreCard from "../sections/DevScoreCard";

/* My Child › Development — the four confusable "Development *" leaves
   (Dashboard, Milestones, Profile, Journey) collapsed into one place with
   internal facets. Each panel is the existing, unchanged tab component. */

const DevelopmentCopilot = lazy(() => import("../practice/DevelopmentCopilot"));
const MilestonesTab = lazy(() => import("./MilestonesTab"));
const ChildProfile = lazy(() => import("../sections/ChildProfile"));
const JourneyTab = lazy(() => import("../practice/JourneyTab"));

export default function DevelopmentTab() {
  const { t } = useLanguage();
  return (
    <div className="space-y-5">
      <DevScoreCard />
      <HubTabs
        ariaLabel="Development facets"
        panels={[
          { id: "now", label: t("hub.now"), icon: Gauge, Comp: DevelopmentCopilot },
          { id: "milestones", label: t("hub.milestones"), icon: CheckCircle2, Comp: MilestonesTab },
          { id: "profile", label: t("hub.profile"), icon: UserCircle, Comp: ChildProfile },
          { id: "journey", label: t("hub.journey"), icon: CalendarDays, Comp: JourneyTab },
        ]}
      />
    </div>
  );
}
