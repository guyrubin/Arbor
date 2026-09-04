/**
 * GP-25 — the Trust Center's source count is DERIVED, not asserted.
 *
 * The sources tile read "40+" while the page listed six, and nothing anywhere
 * in the app enumerated forty. The Trust Center is the one page a sceptical
 * parent opens specifically to check whether Arbor is telling the truth; an
 * unverifiable number there costs more than it earns.
 *
 * This module collects every public source the shipped app actually cites, by
 * URL, from the places that cite them:
 *   - the milestone map's per-domain references (`DOMAIN_REFERENCES`)
 *   - per-milestone references in the seeded catalogue (`ALL_MILESTONES`)
 *   - the hard-moment guides' evidence refs (`hardMomentCards`)
 *   - the Trust Center's own citation anchors, passed in by the page (kept
 *     there so the AP-060 preservation guard still sees them in that file)
 *
 * Deduplicated by URL, http(s) only. If a source is removed from the app the
 * number moves with it — which is the whole point.
 */

import { DOMAIN_REFERENCES } from "./milestoneReferences";
import { ALL_MILESTONES } from "./milestoneData";
import { hardMomentCards } from "../content/hardMomentCards";

export interface CitedSourceRef {
  readonly url: string;
}

/** Sources cited by the app's own content, independent of any one page. */
export function contentCitedSourceUrls(): string[] {
  const urls: string[] = [];
  for (const ref of Object.values(DOMAIN_REFERENCES)) urls.push(ref.url);
  for (const milestone of ALL_MILESTONES) {
    for (const ref of milestone.references ?? []) urls.push(ref.url);
  }
  for (const card of hardMomentCards) urls.push(...card.evidenceRefs);
  return urls;
}

/** Every distinct public source the app cites, including the page's own anchors. */
export function citedSourceUrls(pageCitations: readonly CitedSourceRef[] = []): string[] {
  const all = [...contentCitedSourceUrls(), ...pageCitations.map((c) => c.url)];
  const seen = new Set<string>();
  for (const url of all) {
    if (typeof url === "string" && /^https?:\/\//.test(url)) seen.add(url.trim());
  }
  return [...seen].sort();
}

/** The number the tile shows. A count of things that exist and can be listed. */
export function citedSourceCount(pageCitations: readonly CitedSourceRef[] = []): number {
  return citedSourceUrls(pageCitations).length;
}
