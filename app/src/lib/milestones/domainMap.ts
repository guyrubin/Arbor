/**
 * v3 FEAT-03 — the development map on My child (#/development): one tile per
 * registry domain, read from the SAME milestones the shelf map (#/milestones)
 * reads and the SAME observations the portrait reads. No new listener.
 *
 * FIREWALL (law 1; lib/record/counts.ts and lib/milestones/shelfMap.ts): the
 * only number per domain is how many milestones the parent marked "Seen it",
 * read through the one count reader (noticedByShelf → milestonesNoticedSince).
 * Integers only. No denominator, no share of a band, no "not yet" or
 * "not sure" count, no ordering of domains by count and no comparison between
 * them: the map walks DOMAIN_IDS in registry order whatever the numbers say.
 */
import type { Milestone } from "../../types";
import { DOMAIN_IDS, type DomainId } from "../domains/registry";
import type { Observation, ObservationSource, ObservationValue } from "../observations";
import { SHELF_IDS, shelfDef } from "../shelves/registry";
import { noticedByShelf } from "./shelfMap";

/** "Seen it" per domain: the shelf counts folded onto their domain, so Sleep
 *  and Food both land on `body`. Every domain is present, zero included. */
export function noticedByDomain(milestones: readonly Milestone[]): Record<DomainId, number> {
  const out = Object.fromEntries(DOMAIN_IDS.map((id) => [id, 0])) as Record<DomainId, number>;
  const byShelf = noticedByShelf(milestones);
  for (const shelf of SHELF_IDS) out[shelfDef(shelf).domain] += byShelf[shelf];
  return out;
}

/** Who wrote it: the parent, or an AI proposal the parent confirmed. Kid
 *  practice, professional and document entries are not "a moment you kept". */
const PARENT_SOURCES: ReadonlySet<ObservationSource> = new Set<ObservationSource>(["parent_typed", "parent_voice", "ai_proposed_parent_confirmed"]);

/** Entries that carry the parent's own words (a measurement, a check or a
 *  practice run has none to quote). */
const WORDED: ReadonlySet<ObservationValue["type"]> = new Set<ObservationValue["type"]>(["moment", "milestone", "keepsake", "word", "goal_note", "fact", "play"]);

/** The newest parent-written entry per domain, from the record already loaded
 *  (useObservationRecord). A domain with none is absent, never guessed. */
export function lastMomentByDomain(observations: readonly Observation[]): Partial<Record<DomainId, Observation>> {
  const out: Partial<Record<DomainId, Observation>> = {};
  const newest: Partial<Record<DomainId, number>> = {};
  for (const o of observations) {
    if (!PARENT_SOURCES.has(o.source) || !WORDED.has(o.value.type)) continue;
    const at = Date.parse(o.at);
    if (!Number.isFinite(at)) continue;
    for (const domain of o.domains) {
      const kept = newest[domain];
      if (kept === undefined || at > kept) {
        newest[domain] = at;
        out[domain] = o;
      }
    }
  }
  return out;
}
