import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import KeptThingsPage from "../kept/KeptThingsPage";
import ArborTreeCard from "../growth/ArborTreeCard";
import DevScoreCard from "../sections/DevScoreCard";
import Icon from "../ui/Icon";
import SavedMilestoneHistory from "./SavedMilestoneHistory";

type View = "kept" | "firsts" | "tree" | "history";

/**
 * The keepsake views on My child (parity, 9 Oct 2026) — ONE collapsed
 * disclosure inside the overview, never a module of its own. The companion
 * rewrite unmounted them with the Growth hub:
 *  · parent-kept words and firsts by month (B-ASKJB-36);
 *  · the firsts the parent has noticed, with the CDC/AAP basis line (C4, CI-08);
 *  · the Arbor tree, one leaf per noticed milestone (GP-30);
 *  · exact saved milestone counts from the retired Full Picture (B-GROWTH-22);
 * Counts are the parent's own noticing, never a score, %, or comparison.
 */
export default function PortraitKeepsakes() {
  const { t } = useLanguage();
  const { childProfile } = useArbor();
  const [view, setView] = useState<View>("kept");
  const tabs: { id: View; label: string; icon: string }[] = [
    { id: "kept", label: t("kept.view"), icon: "bookmark" },
    { id: "firsts", label: t("companion.portrait.keepsakes.firsts"), icon: "star" },
    { id: "history", label: t("elev.growthTruth.copilot.history.title"), icon: "history" },
    { id: "tree", label: t("companion.portrait.keepsakes.tree"), icon: "park" },
  ];
  return <details className="portrait-keepsakes" data-testid="portrait-keepsakes">
    <summary><Icon name="auto_awesome" size={20} /><span><strong>{t("companion.portrait.keepsakes.title")}</strong><span>{t("companion.portrait.keepsakes.sub")}</span></span><Icon name="expand_more" size={20} /></summary>
    <div className="portrait-keepsakes-body">
      <div className="portrait-views" role="group" aria-label={t("companion.portrait.keepsakes.title")}>
        {tabs.map((tab) => <button type="button" key={tab.id} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}><Icon name={tab.icon} size={18} />{tab.label}</button>)}
      </div>
      {view === "kept" ? <KeptThingsPage key={childProfile.id} /> : view === "firsts" ? <DevScoreCard /> : view === "history" ? <SavedMilestoneHistory key={childProfile.id} /> : <ArborTreeCard />}
    </div>
  </details>;
}
