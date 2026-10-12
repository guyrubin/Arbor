import React, { useId, useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { DOMAIN_IDS, domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { fmtDay } from "../../lib/formatDate";
import { lastMomentByDomain, noticedByDomain } from "../../lib/milestones/domainMap";
import type { Observation } from "../../lib/observations";
import { DOMAIN_VARS } from "../../lib/tokens";
import type { Milestone } from "../../types";
import { CountPips } from "../ui/CountPips";
import { Icon } from "../ui/Icon";
import { growingDomains } from "./milestonesModel";
import "./developmentMap.css";

/**
 * v3 F-CHILD-1 — "Milestones across areas" on My child (#/development).
 *
 * One row per registry domain, walked in registry order (DOMAIN_IDS). A row
 * is a button (aria-expanded) carrying the domain glyph and name, the Seen-it
 * count as CountPips (VIS-02), the newest moment the parent kept in that
 * area, and a chevron. At most one row is open; the page that owns the open
 * row renders its body inline under it (renderDetail) or in a sheet.
 *
 * The card's head: the 5-minute check (the page's one primary move, stamped
 * by the page through `primaryMoveProps`) and one neutral chip with how many
 * things the parent marked "Seen it". Its foot: the areas with a new Seen it
 * in the last 30 days (names only), then the blank-means-no-record note.
 *
 * Clinical firewall (law 1): the only numbers are Seen-it counts. A domain
 * with no Seen-it skill and no kept moment says "No record yet", never
 * "Not yet". No denominator, no share, no bar, no not-yet or not-sure
 * number, no ordering by count, no verdict colour: a row's colour names its
 * AREA (DOMAIN_VARS), never the child's state. Logical layout only; the
 * chevron turns, it is not a direction, so it never mirrors.
 */
export interface DevelopmentMapProps {
  milestones: readonly Milestone[];
  /** The child's loaded record (useObservationRecord), already this child's. */
  observations: readonly Observation[];
  /** The page's own words for an entry, so a row quotes what the record shows. */
  momentText: (observation: Observation) => string;
  /** The open row; null = every row closed. */
  openDomain: DomainId | null;
  onToggle: (domain: DomainId) => void;
  /** The open row's body, inline under it (wide screens). Absent = shown elsewhere. */
  renderDetail?: (domain: DomainId, detailId: string) => React.ReactNode;
  onCheck: () => void;
  /** The page's primary-move stamp, spread on the check button. */
  primaryMoveProps?: Record<string, string>;
  /** The Development Check's saved re-check date, when no watched skill shows it. */
  recheckDueAt?: string | null;
  /** The clock the growing line reads (tests pin it). */
  nowMs?: number;
}

export default function DevelopmentMap({
  milestones, observations, momentText, openDomain, onToggle, renderDetail, onCheck, primaryMoveProps, recheckDueAt = null, nowMs,
}: DevelopmentMapProps) {
  const { t, uiLang } = useLanguage();
  const headingId = useId();
  const seen = useMemo(() => noticedByDomain(milestones), [milestones]);
  let seenCount = 0;
  for (const domain of DOMAIN_IDS) seenCount += seen[domain];
  // The quote files a noticed skill on the one area its count uses (domainMap).
  const last = useMemo(() => lastMomentByDomain(observations, milestones), [observations, milestones]);
  const growing = useMemo(() => growingDomains(milestones, nowMs ?? Date.now()), [milestones, nowMs]);
  const day = (at: string) => new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" }).format(new Date(at));
  return (
    <section className="dev-map" data-testid="dev-map" aria-labelledby={headingId}>
      <div className="dev-map-head">
        <div className="dev-map-heading">
          <p className="dev-map-kicker">{t("companion.milestones.mapKicker")}</p>
          <h2 id={headingId}>{t("companion.milestones.areasTitle")}</h2>
          <p className="dev-map-sub">{t("companion.milestones.areasSub")}</p>
          {recheckDueAt && <p className="dev-map-recheck" data-testid="dev-map-recheck">{t("elev.growth.recheck.date", { date: fmtDay(recheckDueAt, uiLang) })}</p>}
        </div>
        <div className="dev-map-tools">
          <button type="button" className="dev-map-check" data-testid="dev-map-check" onClick={onCheck} {...(primaryMoveProps ?? {})}>
            <Icon name="fact_check" size={18} />
            <span>{t("companion.milestones.check")}</span>
          </button>
          {seenCount > 0 && (
            <span className="dev-map-chip" data-testid="dev-map-seen">
              <span className="dev-map-chip-dot" aria-hidden="true" />
              <span className="dev-map-chip-n arbor-num">{seenCount}</span>
              <span className="dev-map-chip-label">{t("companion.milestones.seenHeader")}</span>
            </span>
          )}
        </div>
      </div>
      <div className="dev-map-columns" aria-hidden="true">
        <span />
        <span>{t("companion.milestones.seenHeader")}</span>
        <span>{t("companion.milestones.lastMoment")}</span>
        <span />
      </div>
      <ul className="dev-map-rows" role="list">
        {DOMAIN_IDS.map((domain) => {
          const tone = DOMAIN_VARS[domain];
          const moment = last[domain];
          const open = openDomain === domain;
          const detailId = `${headingId}-${domain}`;
          return (
            <li key={domain} className="dev-map-item" data-open={open ? "true" : undefined}>
              <button
                type="button"
                className="dev-map-row"
                data-testid="dev-map-row"
                data-domain={domain}
                aria-expanded={open}
                aria-controls={open && renderDetail ? detailId : undefined}
                onClick={() => onToggle(domain)}
              >
                <span className="dev-map-area">
                  <span className="dev-map-glyph" aria-hidden="true" style={{ color: tone.ink, background: tone.soft }}>
                    <Icon name={DOMAIN_ICONS[domain]} size={22} />
                  </span>
                  <span className="dev-map-name">{domainName(domain, t)}</span>
                </span>
                <span className="dev-map-count">
                  {seen[domain] > 0 ? (
                    <CountPips seen={seen[domain]} domain={domain} size={7} />
                  ) : !moment && (
                    <span className="dev-map-none" data-testid="dev-map-none">{t("companion.devMap.none")}</span>
                  )}
                </span>
                <span className="dev-map-quote">
                  {moment && (
                    <span className="dev-map-last" data-testid="dev-map-last">
                      <time dateTime={moment.at}>{day(moment.at)}</time>
                      {" · "}
                      <span dir="auto">{momentText(moment)}</span>
                    </span>
                  )}
                </span>
                <Icon name="expand_more" size={22} className="dev-map-chevron" />
              </button>
              {open && renderDetail && <div className="dev-map-detail">{renderDetail(domain, detailId)}</div>}
            </li>
          );
        })}
      </ul>
      <div className="dev-map-foot">
        {growing.length > 0 && (
          <p className="dev-map-growing" data-testid="dev-map-growing">
            <Icon name="eco" size={18} />
            <span><strong>{t("companion.milestones.growing")}</strong> {growing.map((domain) => domainName(domain, t)).join(" · ")}</span>
          </p>
        )}
        <p className="dev-map-note" data-testid="dev-map-note">
          <Icon name="info" size={16} />
          <span>{t("companion.devMap.note")}</span>
        </p>
        <p className="dev-map-record" data-testid="dev-map-record">{t("elev.loop.ms.footer")}</p>
      </div>
    </section>
  );
}
