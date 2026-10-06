/**
 * B-LOOP-03 — PARENT SHELVES: nine parent-word categories over the eight
 * developmental domains of the one registry (lib/domains/registry.ts).
 *
 * RULE: a shelf is a parent-facing NAME over a domain. It never carries a
 * profession, a score, a count threshold or a verdict; professions stay
 * output-only metadata of the domain (spine D2) and the professional view
 * (B-LOOP-12) shows the domain name next to the shelf name. Labels resolve
 * ONLY through `shelfLabel` (keys `elev.shelves.<id>`,
 * lib/i18nElevation/shelves.ts) — no component names a shelf literal
 * (lib/domains/noPrivateVocab.guard.test.ts).
 *
 * Sleep and Food are two shelves over ONE domain (`body`); every other shelf
 * is one domain. The resolvers are pure and EXPLICIT: an observation or a
 * milestone the binding table below does not cover THROWS — never a silent
 * default shelf (P5-LOOP B-LOOP-03, the binding table):
 *   sleep    ← body/sleep sub-area · a "Sleep Meltdown" moment · milestone tag `sleep`
 *   food     ← body/feeding sub-area · growth measurements · a "Food Refusal"
 *              moment · milestone tag `feeding`
 *   words    ← talking      feelings ← feelings     play   ← playing
 *   moving   ← moving       hands    ← hands        school ← thinking
 *   family   ← family
 * A multi-domain observation takes the FIRST non-body domain in registry
 * order after the sleep/food signals above. A record whose only domain is
 * `body` with no sleep/feeding signal (a body-only memory fact, a
 * parent-added `health_sleep_feeding` milestone) files under the second body
 * shelf, id `food`, named "Body, food & growth" / "גוף, אוכל וגדילה" —
 * framer ruling option (d), 6 Oct (execution/2026-10-01--one-backlog/
 * REJECTIONS.md, "W3A-B builder blocks (6 Oct)"): Sleep stays separate,
 * nothing is ever off the shelves, no tenth shelf. Only a record with NO
 * domain at all throws (the read model never produces one).
 * The pack's `sleepLogs` origin and "routines wind-down" do not exist in the
 * read model yet (lib/observations ObservationOrigin); they bind here when a
 * builder adds them.
 */
import type { Milestone } from "../../types";
import type { Observation } from "../observations";
import { ALL_MILESTONES } from "../milestoneData";
import { toDomains, type DomainId } from "../domains/registry";

export type ShelfId = "sleep" | "food" | "words" | "feelings" | "play" | "moving" | "hands" | "school" | "family";

export interface ShelfDef {
  id: ShelfId;
  /** The ONE registry domain this shelf names. */
  domain: DomainId;
  /** Body sub-areas that put a record on this shelf (only the two body shelves carry them). */
  subAreas?: readonly string[];
  /** `elev.shelves.<id>` — EN + HE in lib/i18nElevation/shelves.ts. */
  labelKey: string;
  /** Display order, 1-based. */
  order: number;
  /** B-LOOP-15 illustration key (typed WebP set; no runtime image generation). */
  illustrationKey: string;
}

const s = (id: ShelfId, domain: DomainId, order: number, subAreas?: readonly string[]): ShelfDef => ({
  id,
  domain,
  ...(subAreas ? { subAreas } : {}),
  labelKey: `elev.shelves.${id}`,
  order,
  illustrationKey: `shelf.${id}`,
});

/** The nine shelves, in parent display order. */
export const SHELVES: readonly ShelfDef[] = [
  s("sleep", "body", 1, ["sleep"]),
  s("food", "body", 2, ["feeding_nutrition", "eating", "feeding", "growth_measurements"]),
  s("words", "talking", 3),
  s("feelings", "feelings", 4),
  s("play", "playing", 5),
  s("moving", "moving", 6),
  s("hands", "hands", 7),
  s("school", "thinking", 8),
  s("family", "family", 9),
];

export const SHELF_IDS: readonly ShelfId[] = SHELVES.map((x) => x.id);

const BY_ID = new Map<ShelfId, ShelfDef>(SHELVES.map((x) => [x.id, x]));

export function shelfDef(id: ShelfId): ShelfDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown shelf ${id}`);
  return def;
}

/** The ONE place a shelf name is resolved (structural t, page language). */
export function shelfLabel(id: ShelfId, t: (key: string) => string): string {
  return t(shelfDef(id).labelKey);
}

/** Every shelf over a domain (body has two; every other domain one). */
export function shelvesOfDomain(domain: DomainId): ShelfId[] {
  return SHELVES.filter((x) => x.domain === domain).map((x) => x.id);
}

/** The single shelf of a non-body domain; body needs a sleep/feeding signal. */
const DOMAIN_SHELF: Readonly<Record<Exclude<DomainId, "body">, ShelfId>> = {
  talking: "words",
  moving: "moving",
  hands: "hands",
  thinking: "school",
  playing: "play",
  feelings: "feelings",
  family: "family",
};

const SLEEP_SUBAREAS: ReadonlySet<string> = new Set(shelfDef("sleep").subAreas);
const FOOD_SUBAREAS: ReadonlySet<string> = new Set(shelfDef("food").subAreas);

/** Behaviour types that name a sleep or food moment in parent words. */
const BEHAVIOR_SHELF: Readonly<Record<string, ShelfId>> = {
  "Sleep Meltdown": "sleep",
  "Food Refusal": "food",
};

const CATALOGUE_BY_ID: ReadonlyMap<string, Milestone> = new Map(ALL_MILESTONES.map((m) => [m.id, m]));

/** The shelf a body-only record files under (framer ruling (d), 6 Oct): the
 *  second body shelf, "Body, food & growth". */
export const BODY_ONLY_SHELF: ShelfId = "food";

const firstNonBody = (domains: readonly DomainId[]): ShelfId | null => {
  for (const d of domains) if (d !== "body") return DOMAIN_SHELF[d];
  if (domains.includes("body")) return BODY_ONLY_SHELF;
  return null;
};

/** A milestone's tag signal, or null. */
const tagShelf = (tags: Milestone["tags"]): ShelfId | null => {
  if (tags?.includes("sleep")) return "sleep";
  if (tags?.includes("feeding")) return "food";
  return null;
};

/**
 * The shelf of a milestone (catalogue rows by stable id — the stored doc may
 * predate the tags; a parent-added row by its own tags/domain). Throws when
 * the binding table does not cover it.
 */
export function milestoneShelf(m: Pick<Milestone, "id" | "domain"> & { custom?: boolean; tags?: Milestone["tags"] }): ShelfId {
  const row = m.custom ? undefined : CATALOGUE_BY_ID.get(m.id);
  const tags = row ? row.tags : m.tags;
  const domain = row ? row.domain : m.domain;
  const tagged = tagShelf(tags);
  if (tagged) return tagged;
  const shelf = firstNonBody(toDomains("developmental", domain));
  if (!shelf) throw new Error(`B-LOOP-03: no shelf for milestone ${m.id} (domain ${domain}, no sleep/feeding tag)`);
  return shelf;
}

/**
 * The shelf of an observation. Pure; THROWS on a combination the binding
 * table does not cover (never a silent default).
 */
export function shelfOf(o: Pick<Observation, "id" | "origin" | "domains" | "subArea" | "value">): ShelfId {
  // 1 · body sub-area signals (growth measurements are the food shelf's growth chart)
  if (o.subArea && SLEEP_SUBAREAS.has(o.subArea)) return "sleep";
  if (o.subArea && FOOD_SUBAREAS.has(o.subArea)) return "food";
  if (o.origin === "growthEntries") return "food";
  // 2 · a sleep / food moment in the parent's own words
  if (o.origin === "behaviorLogs" && o.value.type === "moment") {
    const byType = BEHAVIOR_SHELF[o.value.behaviorType];
    if (byType) return byType;
  }
  // 3 · a noticed milestone (or its keepsake) carries its catalogue tag
  if ((o.origin === "milestones" || o.origin === "keepsakes") && (o.value.type === "milestone" || o.value.type === "keepsake")) {
    const row = CATALOGUE_BY_ID.get(o.value.milestoneId);
    const tagged = row ? tagShelf(row.tags) : null;
    if (tagged) return tagged;
  }
  // 4 · the first non-body domain, registry order
  const shelf = firstNonBody(o.domains);
  if (!shelf) throw new Error(`B-LOOP-03: no shelf for observation ${o.id} (${o.origin} × ${o.domains.join("+") || "no domain"}, no sleep/feeding signal)`);
  return shelf;
}

/** Read-model helper: the shelf, or undefined where the binding table has no rule (never a guessed shelf). */
export function shelfOfOrUndefined(o: Pick<Observation, "id" | "origin" | "domains" | "subArea" | "value">): ShelfId | undefined {
  try {
    return shelfOf(o);
  } catch {
    return undefined;
  }
}
