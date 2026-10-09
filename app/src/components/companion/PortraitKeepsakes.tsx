import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import FirstWordsLedger from "../growth/FirstWordsLedger";
import ArborTreeCard from "../growth/ArborTreeCard";
import DevScoreCard from "../sections/DevScoreCard";
import MonthInReview from "../growth/MonthInReview";
import Icon from "../ui/Icon";

type View = "words" | "firsts" | "tree";

/**
 * The keepsake views on My child (parity, 9 Oct 2026) — ONE collapsed
 * disclosure inside the overview, never a module of its own. The companion
 * rewrite unmounted them with the Growth hub:
 *  · first words (GP-33, under 3) and "Things {name} said" (B-GROWTH-36, 3+);
 *  · the firsts the parent has noticed, with the CDC/AAP basis line (C4, CI-08);
 *  · the Arbor tree, one leaf per noticed milestone (GP-30);
 *  · the month in review and its "watch for next" (GP-32), once a month.
 * Counts are the parent's own noticing, never a score, %, or comparison.
 */
export default function PortraitKeepsakes() {
  const { t } = useLanguage();
  const [view, setView] = useState<View>("words");
  const tabs: { id: View; label: string; icon: string }[] = [
    { id: "words", label: t("companion.portrait.keepsakes.words"), icon: "chat_bubble" },
    { id: "firsts", label: t("companion.portrait.keepsakes.firsts"), icon: "star" },
    { id: "tree", label: t("companion.portrait.keepsakes.tree"), icon: "park" },
  ];
  return <details className="portrait-keepsakes" data-testid="portrait-keepsakes">
    <summary><Icon name="auto_awesome" size={20} /><span><strong>{t("companion.portrait.keepsakes.title")}</strong><span>{t("companion.portrait.keepsakes.sub")}</span></span><Icon name="expand_more" size={20} /></summary>
    <div className="portrait-keepsakes-body">
      <MonthInReview />
      <div className="portrait-views" role="group" aria-label={t("companion.portrait.keepsakes.title")}>
        {tabs.map((tab) => <button type="button" key={tab.id} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}><Icon name={tab.icon} size={18} />{tab.label}</button>)}
      </div>
      {view === "words" ? <FirstWordsLedger /> : view === "firsts" ? <DevScoreCard /> : <ArborTreeCard />}
    </div>
  </details>;
}
