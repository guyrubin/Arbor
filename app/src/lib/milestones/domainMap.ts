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
 *
 * ONE ATTRIBUTION: a noticed skill is counted on one area (its shelf's), so it
 * is quoted on that area only, never on a second tile that does not count it.
 */
import type { Milestone } from "../../types";
import { DOMAIN_IDS, type DomainId } from "../domains/registry";
import type { Observation, ObservationSource, ObservationValue } from "../observations";
import { SHELF_IDS, shelfDef, shelfOfOrUndefined, type ShelfId } from "../shelves/registry";
import { shelfOfMilestone } from "./selectByShelf";
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

/**
 * The areas a tile may quote an entry under.
 *
 * A noticed skill (a milestone entry, or the keepsake kept for it) files on
 * the ONE area its Seen-it count uses: the shelf noticedByDomain folds it onto
 * (shelfOfMilestone on the same milestone document; the entry's own derived
 * shelf when that document is not loaded). The legacy record can file the same
 * skill under two areas (a motor row is Moving and Hands); the map quotes it
 * on the area that counts it and on no other.
 *
 * That area must also be one of the entry's own areas, the ones the portrait's
 * area lens files it under, so the tile's "Open the moments" always lists what
 * the tile quotes. Where the two disagree (a feeding row the record files under
 * Hands and the count under Body) the entry is quoted on no tile, rather than
 * on one whose moments would not show it. Every other entry keeps its areas.
 */
function quotedDomains(o: Observation, shelfById: ReadonlyMap<string, ShelfId>): readonly DomainId[] {
  const v = o.value;
  if (v.type !== "milestone" && v.type !== "keepsake") return o.domains;
  const shelf = shelfById.get(v.milestoneId) ?? o.shelf ?? shelfOfOrUndefined(o);
  if (!shelf) return o.domains;
  const counted = shelfDef(shelf).domain;
  return o.domains.includes(counted) ? [counted] : [];
}

/** The newest parent-written entry per domain, from the record already loaded
 *  (useObservationRecord), filed by quotedDomains. `milestones` are the same
 *  documents noticedByDomain counts. An entry dated after `now` is not on the
 *  portrait's record yet (portraitModel) and is skipped. A domain with none is
 *  absent, never guessed. */
export function lastMomentByDomain(
  observations: readonly Observation[],
  milestones: readonly Milestone[] = [],
  now: Date = new Date(),
): Partial<Record<DomainId, Observation>> {
  const shelfById = new Map<string, ShelfId>();
  for (const m of milestones) {
    const shelf = shelfOfMilestone(m);
    if (shelf) shelfById.set(m.id, shelf);
  }
  const until = now.getTime();
  const out: Partial<Record<DomainId, Observation>> = {};
  const newest: Partial<Record<DomainId, number>> = {};
  for (const o of observations) {
    if (!PARENT_SOURCES.has(o.source) || !WORDED.has(o.value.type)) continue;
    const at = Date.parse(o.at);
    if (!Number.isFinite(at) || at > until) continue;
    for (const domain of quotedDomains(o, shelfById)) {
      const kept = newest[domain];
      if (kept === undefined || at > kept) {
        newest[domain] = at;
        out[domain] = o;
      }
    }
  }
  return out;
}
