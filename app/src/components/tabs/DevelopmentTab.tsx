import React, { lazy, useState } from "react";
import { Gauge, CheckCircle2, UserCircle, CalendarDays, ClipboardCheck } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import HubTabs from "../ui/HubTabs";
import DevScoreCard from "../sections/DevScoreCard";
import ScreeningSheet from "../sections/ScreeningSheet";

/* My Child › Development — the four confusable "Development *" leaves
   (Dashboard, Milestones, Profile, Journey) collapsed into one place with
   internal facets. Each panel is the existing, unchanged tab component.
   b2: a quiet inline "Quick development check" opens the screener sheet here,
   replacing the former standalone Screening leaf. */

const DevelopmentCopilot = lazy(() => import("../practice/DevelopmentCopilot"));
const MilestonesTab = lazy(() => import("./MilestonesTab"));
const ChildProfile = lazy(() => import("../sections/ChildProfile"));
const JourneyTab = lazy(() => import("../practice/JourneyTab"));

export default function DevelopmentTab() {
  const { t } = useLanguage();
  const [checkOpen, setCheckOpen] = useState(false);
  return (
    <div className="space-y-5">
      <DevScoreCard />
      <div>
        <button
          onClick={() => setCheckOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl px-4 text-sm font-bold"
          style={{ minHeight: 44, background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          <ClipboardCheck className="w-4 h-4" /> {t("mychild.quickcheck.cta")}
        </button>
      </div>
      <ScreeningSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
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
