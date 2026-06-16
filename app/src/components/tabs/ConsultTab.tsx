import React, { lazy } from "react";
import { Stethoscope, FileBarChart, Search } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import HubTabs from "../ui/HubTabs";

/* Care › Consult — one verb for "get expert input". Collapses the former doors
   (Reports & Handoffs, Find a Professional) into a single flow, led by the warm
   handoff: a parent-redacted packet from the child's record they can export to
   their own professional (Phase 1) or, later, send to a vetted Arbor expert. */

const AskSpecialist = lazy(() => import("../sections/AskSpecialist"));
const Reports = lazy(() => import("../sections/Reports"));
const FindProfessional = lazy(() => import("../sections/FindProfessional"));

export default function ConsultTab() {
  const { t } = useLanguage();
  return (
    <HubTabs
      ariaLabel="Consult steps"
      panels={[
        { id: "ask", label: t("consult.ask"), icon: Stethoscope, Comp: AskSpecialist },
        { id: "brief", label: t("consult.brief"), icon: FileBarChart, Comp: Reports },
        { id: "find", label: t("consult.find"), icon: Search, Comp: FindProfessional },
      ]}
    />
  );
}
