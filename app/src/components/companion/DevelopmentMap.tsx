import React, { useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { Composition } from "../../design/useComposition";
import { DOMAIN_IDS, domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { lastMomentByDomain, noticedByDomain } from "../../lib/milestones/domainMap";
import type { Observation } from "../../lib/observations";
import type { Milestone } from "../../types";
import { Icon } from "../ui/Icon";
import { growingDomains } from "./milestonesModel";
import { milestonesV10Copy } from "./milestonesV10Copy";

/**
 * v10.1 — the index of My child › Milestones: eight equal, quiet segments, one
 * per area in registry order (DOMAIN_IDS), never reordered by what the record
 * holds. It is the overview and the way in: a segment is a button that picks
 * its area (the map opens it below; the list jumps to it). Areas are told
 * apart by glyph and name only; the picked one is lit in sapphire, the one
 * accent.
 *
 * A segment carries the Seen-it count with its unit, or "No record yet"; and
 * the day of the area's newest kept moment ("Last 12 Nov"). Under the
 * row: one line (tap an area to open it / a blank means no record) and the
 * areas with a new Seen it in the last 30 days.
 *
 * Desk: one row of eight. Phone: the same eight in a sideways-scrolling row.
 *
 * Clinical firewall (law 1): the only numbers are Seen-it counts. No
 * denominator, no share, no bar, no not-yet or not-sure number, no ordering by
 * count, no colour that could read as a state. An area with nothing recorded
 * is the same size as the rest, named in one line.
 */
export interface DevelopmentMapProps {
  milestones: readonly Milestone[];
  /** The child's loaded record, already this child's (the newest moment's day). */
  observations: readonly Observation[];
  /** The picked area (lit). */
  openDomain: DomainId | null;
  onToggle: (domain: DomainId) => void;
  composition: Composition;
  /** The clock the growing line reads (tests pin it). */
  nowMs?: number;
}

export default function DevelopmentMap({ milestones, observations, openDomain, onToggle, composition, nowMs }: DevelopmentMapProps) {
  const { t, uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  const seen = useMemo(() => noticedByDomain(milestones), [milestones]);
  const last = useMemo(() => lastMomentByDomain(observations, milestones), [observations, milestones]);
  const growing = useMemo(() => growingDomains(milestones, nowMs ?? Date.now()), [milestones, nowMs]);
  const day = (at: string) => new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" }).format(new Date(at));
  const desk = composition === "desk";

  return (
    <div className="ms-map" data-testid="dev-map">
      <ul className={`mci${desk ? "" : " m ds-snap-scroll"}`} role="list" aria-label={copy.indexLabel}>
        {DOMAIN_IDS.map((domain) => {
          const moment = last[domain];
          const count = seen[domain];
          const quiet = count === 0 && !moment;
          const open = openDomain === domain;
          return (
            <li key={domain} className="mcs-item">
              <button
                type="button"
                className={`mcs${quiet ? " quiet" : ""}${open ? " on" : ""}`}
                data-testid="dev-map-tile"
                data-domain={domain}
                data-tone={quiet ? "quiet" : "recorded"}
                aria-pressed={open}
                onClick={() => onToggle(domain)}
              >
                <span className="mct">
                  <span className="tg" aria-hidden="true"><Icon name={DOMAIN_ICONS[domain]} size={18} /></span>
                  {count > 0 && <b className="arbor-num" data-testid="dev-map-seen-area">{count}</b>}
                </span>
                <span className="mcn">{domainName(domain, t)}</span>
                <span className="mcm">
                  {count > 0 ? (
                    <span className="mcu">{count === 1 ? copy.seenUnitOne : copy.seenUnitMany}</span>
                  ) : !moment ? (
                    <span data-testid="dev-map-none">{t("companion.devMap.none")}</span>
                  ) : null}
                  {moment && (
                    <span className="mcl-last" data-testid="dev-map-last">
                      {copy.lastShort}{" "}
                      <time dateTime={moment.at} className="ms-nowrap">{day(moment.at)}</time>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mcap">
        <p data-testid="dev-map-note">{copy.tilesHint}</p>
        {growing.length > 0 && (
          <p data-testid="dev-map-growing">
            <strong>{t("companion.milestones.growing")}</strong> {growing.map((domain) => domainName(domain, t)).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
