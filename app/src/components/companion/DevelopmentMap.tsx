import React, { useId, useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { DOMAIN_IDS, domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { lastMomentByDomain, noticedByDomain } from "../../lib/milestones/domainMap";
import type { Observation } from "../../lib/observations";
import { DOMAIN_VARS } from "../../lib/tokens";
import type { Milestone } from "../../types";
import { CountPips } from "../ui/CountPips";
import { Icon } from "../ui/Icon";
import "./developmentMap.css";

/**
 * v3 FEAT-03 — the development map at the top of My child (#/development).
 *
 * One tile per registry domain, walked in registry order (DOMAIN_IDS), so the
 * grid is four by two on a wide screen and two by four on a phone. A tile
 * carries the domain glyph and name, the Seen-it count as CountPips (VIS-02),
 * the newest moment the parent kept in that area, and opens the domain sheet.
 *
 * Clinical firewall (law 1): the only number is how many things the parent
 * marked "Seen it" in the domain (lib/milestones/domainMap). A domain with
 * none says "No record yet", never "Not yet": a blank is a missing record,
 * not a missing ability, and the legend line says so. No denominator, no
 * fraction, no share, no bar, no not-yet number, no ordering by count.
 *
 * The map is part of the portrait's overview module: it stamps no module of
 * its own and carries no primary move (the portrait's one move stays the
 * record lens). Logical layout only; the chevron mirrors once, in Hebrew.
 */
export interface DevelopmentMapProps {
  /** The child's first name, for the heading. */
  name: string;
  milestones: readonly Milestone[];
  /** The child's loaded record (useObservationRecord), already this child's. */
  observations: readonly Observation[];
  /** The portrait's own words for an entry, so a tile quotes what the record shows. */
  momentText: (observation: Observation) => string;
  onOpenDomain: (domain: DomainId) => void;
  onCheck: () => void;
}

export default function DevelopmentMap({ name, milestones, observations, momentText, onOpenDomain, onCheck }: DevelopmentMapProps) {
  const { t, uiLang } = useLanguage();
  const headingId = useId();
  const seen = useMemo(() => noticedByDomain(milestones), [milestones]);
  const last = useMemo(() => lastMomentByDomain(observations), [observations]);
  const day = (at: string) => new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" }).format(new Date(at));
  return (
    <section className="dev-map" data-testid="dev-map" aria-labelledby={headingId}>
      <div className="dev-map-head">
        <h2 id={headingId}>{t("companion.devMap.title", { name })}</h2>
        <button type="button" className="dev-map-check" data-testid="dev-map-check" onClick={onCheck}>
          <Icon name="fact_check" size={18} />
          <span>{t("companion.devMap.check")}</span>
        </button>
      </div>
      <ul className="dev-map-grid">
        {DOMAIN_IDS.map((domain) => {
          const tone = DOMAIN_VARS[domain];
          const moment = last[domain];
          return (
            <li key={domain}>
              <button type="button" className="dev-map-tile" data-testid="dev-map-tile" data-domain={domain} onClick={() => onOpenDomain(domain)}>
                <span className="dev-map-tile-top">
                  <span className="dev-map-glyph" aria-hidden="true" style={{ color: tone.ink, background: tone.soft }}>
                    <Icon name={DOMAIN_ICONS[domain]} size={20} />
                  </span>
                  <span className="dev-map-name">{domainName(domain, t)}</span>
                  <Icon name="chevron_right" size={18} className="dev-map-chevron rtl:-scale-x-100" />
                </span>
                <span className="dev-map-count">
                  {seen[domain] > 0 ? <CountPips seen={seen[domain]} domain={domain} size={7} /> : <span className="dev-map-none" data-testid="dev-map-none">{t("companion.devMap.none")}</span>}
                </span>
                {moment && (
                  <span className="dev-map-last" data-testid="dev-map-last">
                    <time dateTime={moment.at}>{day(moment.at)}</time>
                    {" · "}
                    <span dir="auto">{momentText(moment)}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="dev-map-note" data-testid="dev-map-note">
        <Icon name="info" size={16} />
        <span>{t("companion.devMap.note")}</span>
      </p>
    </section>
  );
}
