import React, { useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Fig, Token } from "../../design/primitives";
import type { Composition } from "../../design/useComposition";
import { DOMAIN_IDS, domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { lastMomentByDomain, noticedByDomain } from "../../lib/milestones/domainMap";
import type { Observation } from "../../lib/observations";
import { DOMAIN_ART } from "../../lib/parentArt";
import type { Milestone } from "../../types";
import { Icon } from "../ui/Icon";
import { domainToneStyle, seenTotals } from "./domainTone";
import { growingDomains } from "./milestonesModel";
import { milestonesV10Copy } from "./milestonesV10Copy";

/**
 * v10.1 — the milestone map on My child › Milestones (#/development).
 *
 * Eight areas as territories, walked in registry order (DOMAIN_IDS), never
 * reordered by what the record holds. Each territory is one button: the area
 * glyph and name, then either the Seen-it count with one leaf per thing seen
 * (a shape before a number), or the area's newest kept moment, or the one
 * quiet line "No record yet". The territory a parent opened is ringed; the
 * page shows that area in its own section (desk and phone alike).
 *
 * Desk: three columns with the Seen-it count in the middle (the hub). Phone:
 * two columns; the count moves to the scene's head, so the map holds areas only.
 * Under the map: production's note (a blank is no record) and the areas with
 * a new Seen it in the last 30 days.
 *
 * Clinical firewall (law 1): the only numbers are Seen-it counts. No
 * denominator, no share, no bar, no not-yet or not-sure number, no ordering by
 * count, no verdict colour: a territory's colour names its AREA (production's
 * domain palette), never the child's state. An area with nothing recorded is
 * drawn the same size as the rest, in neutral paper, named in one line.
 */
export interface DevelopmentMapProps {
  milestones: readonly Milestone[];
  /** The child's loaded record (useObservationRecord), already this child's. */
  observations: readonly Observation[];
  /** The page's own words for an entry, so a territory quotes what the record shows. */
  momentText: (observation: Observation) => string;
  /** The open area (ringed). */
  openDomain: DomainId | null;
  onToggle: (domain: DomainId) => void;
  composition: Composition;
  /** The clock the growing line reads (tests pin it). */
  nowMs?: number;
}

/** The number of leaves a territory draws for its Seen-it count (the figure says the rest). */
const LEAVES = 4;
/** The three territory outlines, cycled in registry order (decor, never data). */
const SHAPES = ["sh0", "sh1", "sh2", "sh0", "sh1", "sh2", "sh0", "sh1"] as const;

export default function DevelopmentMap({ milestones, observations, momentText, openDomain, onToggle, composition, nowMs }: DevelopmentMapProps) {
  const { t, uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  const seen = useMemo(() => noticedByDomain(milestones), [milestones]);
  const { seen: seenCount, areas: seenAreas } = useMemo(() => seenTotals(milestones), [milestones]);
  // The quote files a noticed skill on the one area its count uses (domainMap).
  const last = useMemo(() => lastMomentByDomain(observations, milestones), [observations, milestones]);
  const growing = useMemo(() => growingDomains(milestones, nowMs ?? Date.now()), [milestones, nowMs]);
  const day = (at: string) => new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" }).format(new Date(at));
  const desk = composition === "desk";

  const territory = (domain: DomainId, index: number) => {
    const moment = last[domain];
    const count = seen[domain];
    const quiet = count === 0 && !moment;
    const open = openDomain === domain;
    return (
      <li key={domain} className="ms-ter-item">
        <button
          type="button"
          className={`ter ar ${SHAPES[index]}${quiet ? " quiet" : ""}${open ? " sel" : ""}${desk ? "" : " m"}`}
          style={domainToneStyle(domain)}
          data-testid="dev-map-tile"
          data-domain={domain}
          aria-pressed={open}
          onClick={() => onToggle(domain)}
        >
          <span className="th">
            <span className="tg" aria-hidden="true"><Icon name={DOMAIN_ICONS[domain]} size={15} /></span>
            <span className="tn">{domainName(domain, t)}</span>
            {desk && <img className="ter-art" {...DOMAIN_ART[domain]} sizes="48px" alt="" aria-hidden="true" loading="lazy" decoding="async" />}
          </span>
          {count > 0 && (
            <span className="tr" data-testid="dev-map-seen-area">
              <b className="arbor-num">{count}</b>
              <span className="tu">{count === 1 ? copy.seenUnitOne : copy.seenUnitMany}</span>
              <span className="tl" aria-hidden="true">
                {Array.from({ length: Math.min(count, LEAVES) }, (_, i) => (
                  <Token key={i} kind="moment" size="sm" label="" />
                ))}
              </span>
            </span>
          )}
          {quiet ? (
            <span className="tq"><b data-testid="dev-map-none">{t("companion.devMap.none")}</b></span>
          ) : moment ? (
            <span className="tx" data-testid="dev-map-last">
              <span>
                {t("companion.milestones.lastMoment")}
                {" · "}
                <time dateTime={moment.at}>{day(moment.at)}</time>
                {desk && <>{" · "}<span dir="auto">{momentText(moment)}</span></>}
              </span>
              <Icon name="chevron_right" size={14} className="rtl:-scale-x-100" />
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  const hub = desk ? (
    <li key="hub" className="hub" data-testid="dev-map-hub" aria-hidden={seenCount === 0 ? true : undefined}>
      {seenCount > 0 && (
        <span data-testid="dev-map-seen">
          <Fig n={seenCount} unit={copy.hubUnit} sub={seenAreas === 1 ? copy.hubAreasOne : copy.hubAreasMany.replace("{n}", String(seenAreas))} />
        </span>
      )}
    </li>
  ) : null;

  const cells: React.ReactNode[] = DOMAIN_IDS.map(territory);
  if (hub) cells.splice(4, 0, hub);

  return (
    <div className="ms-map" data-testid="dev-map">
      <ul className={`atlas${desk ? "" : " m"}`} role="list">{cells}</ul>
      <div className="ms-map-foot">
        <p className="ms-map-note" data-testid="dev-map-note">{t("companion.devMap.note")}</p>
        {growing.length > 0 && (
          <p className="ms-map-growing" data-testid="dev-map-growing">
            <strong>{t("companion.milestones.growing")}</strong> {growing.map((domain) => domainName(domain, t)).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
