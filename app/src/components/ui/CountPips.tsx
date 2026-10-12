import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { DomainId } from "../../lib/domains/registry";
import { DOMAIN_VARS } from "../../lib/tokens";

/**
 * v3 VIS-02 — CountPips: one domain's SEEN count, as the number plus filled dots.
 *
 * Clinical firewall (law 1, counts only): the only record input is how many
 * things the parent marked "Seen it" in one domain. There is no ring for "not
 * yet", no half state, no total, no "/", no % and no width proportional to
 * anything (lib/milestones/shelfMap.ts keeps no denominator, no per-band
 * fraction and no not-yet count, so none exists to draw).
 *
 * - One colour: the domain's ink (DOMAIN_VARS) on the wrapper; the number and
 *   every dot paint it (currentColor). The colour names the AREA, never the
 *   child's state, and nothing here reads the count to choose it.
 * - Zero renders nothing: an empty row of dots would read as a verdict.
 * - At most PIP_CAP dots, wrapping after six (index.css .arbor-pips-dots), so a
 *   long record never grows into a bar; the number always states the full count.
 * - Logical layout only (gap, inline-size): in Hebrew the number sits at the
 *   inline start, the right edge, and nothing needs mirroring.
 * - Read-only, never a control: it sits inside a 44 px row, it is not a target.
 * - A screen reader hears one sentence ("Seen so far: 3"); the digit and dots
 *   are hidden from it.
 */
export const PIP_CAP = 12;
export type PipSize = 7 | 8 | 10;

export interface CountPipsProps {
  /** Things marked "Seen it" in this domain. Non-finite or below 1 renders nothing. */
  seen: number;
  domain: DomainId;
  size?: PipSize;
  className?: string;
}

export function CountPips({ seen, domain, size = 8, className }: CountPipsProps) {
  const { t } = useLanguage();
  const n = Number.isFinite(seen) ? Math.max(0, Math.floor(seen)) : 0;
  const tone = DOMAIN_VARS[domain];
  if (n === 0 || !tone) return null;
  return (
    <span
      data-testid="count-pips"
      data-domain={domain}
      data-size={size}
      role="img"
      aria-label={t("elev.pips.aria", { n })}
      className={className ? `arbor-pips arbor-num ${className}` : "arbor-pips arbor-num"}
      style={{ color: tone.ink }}
    >
      <span className="arbor-pips-n" aria-hidden="true">
        {n}
      </span>
      <span className="arbor-pips-dots" aria-hidden="true">
        {Array.from({ length: Math.min(n, PIP_CAP) }, (_, i) => (
          <span key={i} className="arbor-pip" />
        ))}
      </span>
    </span>
  );
}

export default CountPips;
