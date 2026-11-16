import type React from "react";
import { DOMAIN_IDS, type DomainId } from "../../lib/domains/registry";
import { noticedByDomain } from "../../lib/milestones/domainMap";
import { DOMAIN_VARS } from "../../lib/tokens";
import type { Milestone } from "../../types";

/**
 * v10.1 — an area's wash, ink and line, from production's domain palette
 * (lib/domains/visuals via the --arbor-domain-* tokens). The ported board CSS
 * reads them as --tw / --ti / --tm. The colour names the AREA, never a state.
 */
export function domainToneStyle(domain: DomainId): React.CSSProperties {
  const tone = DOMAIN_VARS[domain];
  return { "--tw": tone.soft, "--ti": tone.ink, "--tm": tone.ink } as React.CSSProperties;
}

/** The Seen-it total and how many areas hold one (the map's only figures). */
export function seenTotals(milestones: readonly Milestone[]): { seen: number; areas: number } {
  const byDomain = noticedByDomain(milestones);
  let seen = 0;
  let areas = 0;
  for (const domain of DOMAIN_IDS) {
    seen += byDomain[domain];
    if (byDomain[domain] > 0) areas += 1;
  }
  return { seen, areas };
}
