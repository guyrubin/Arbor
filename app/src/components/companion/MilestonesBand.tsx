import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Fig, Scene, StartHere } from "../../design/primitives";
import type { Composition } from "../../design/useComposition";
import MilestonesViewSwitch from "./MilestonesViewSwitch";
import { milestonesV10Copy } from "./milestonesV10Copy";

/**
 * v10.1 — the header band of My child › Milestones, shared by the map and the
 * list: the kicker and Start here, the page's h1 and its line, the one figure
 * with its unit (Seen-it things across areas, only when there is one), the
 * Map / List switch, then the index of eight areas the page hands in.
 */
export interface MilestonesBandProps {
  composition: Composition;
  kicker: React.ReactNode;
  title: React.ReactNode;
  titleId: string;
  sub?: React.ReactNode;
  current: "development" | "milestones";
  totals: { seen: number; areas: number };
  /** The index (DevelopmentMap) and anything under it; the list has none. */
  children?: React.ReactNode;
  /** The list's one-line band (h1, figure, switch): its first Seen it stays above the fold. */
  compact?: boolean;
}

export default function MilestonesBand({ composition, kicker, title, titleId, sub, current, totals, children, compact = false }: MilestonesBandProps) {
  const { uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  const desk = composition === "desk";
  const figure = totals.seen > 0
    ? <span data-testid="dev-map-seen"><Fig n={totals.seen} unit={copy.hubUnit} sub={totals.areas === 1 ? copy.hubAreasOne : copy.hubAreasMany.replace("{n}", String(totals.areas))} size="md" /></span>
    : null;
  return (
    <Scene field="now" className={`ms-band${compact ? " compact" : ""}`} orbs={desk ? [{ size: 440, left: -230, bottom: -290, opacity: 0.65 }, { size: 380, right: -190, top: -250, opacity: 0.65, b: true }] : [{ size: 220, right: -110, top: -140, opacity: 0.65, b: true }]}>
      <header className={`mch${desk ? "" : " m"}`}>
        <div className="mcl">
          {!compact && <p className="kicker">{kicker} <StartHere>{copy.startHere}</StartHere></p>}
          <h1 className="title" id={titleId}>{title}</h1>
          {sub && <p className="ms-sub">{sub}</p>}
        </div>
        <div className="mcr">
          {desk ? <><MilestonesViewSwitch current={current} />{figure}</> : <div className="mcf">{figure}<MilestonesViewSwitch current={current} /></div>}
        </div>
      </header>
      {children}
    </Scene>
  );
}
