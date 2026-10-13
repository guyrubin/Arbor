/**
 * v3 F-CHILD-1 — the pure reads behind the Milestones pill (#/development).
 *
 * Every function here reads what the parent already wrote and returns words,
 * dates, area names or one Seen-it integer; nothing ranks, grades or divides.
 * CLINICAL FIREWALL: no denominator, no share, no ordering by count. Areas
 * are walked in registry order (DOMAIN_IDS) whatever the record says.
 */
import type { BehaviorLog, ChildProfile, DevelopmentalDomainId, Milestone } from "../../types";
import { MOMENT_BEHAVIOR_TYPE } from "../../content/behaviorTaxonomy";
import { keptItemsFromProfile } from "../../lib/describeChild";
import type { KeptThing } from "../../lib/kept/keptThings";
import { parentWritten } from "../../lib/kept/parentWritten";
import { DOMAIN_IDS, isDomainId, type DomainId } from "../../lib/domains/registry";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";
import { milestonesNoticedSince } from "../../lib/record/counts";
import { SHELF_IDS, shelfDef, shelvesOfDomain, type ShelfId } from "../../lib/shelves/registry";

const DAY_MS = 86_400_000;

/** The parent's words for one card, and the day they are dated (null = undated). */
export interface CardWords {
  id: string;
  text: string;
  at: string | null;
}

const validAt = (at: unknown): at is string => typeof at === "string" && Number.isFinite(Date.parse(at));

/**
 * The strength the parent told Arbor most recently. A strength kept through
 * "Tell Arbor" carries its ledger record (confirmedAt, else since); a line
 * written elsewhere has no date and is used only when no dated one exists.
 */
export function latestStrength(profile: Partial<Pick<ChildProfile, "strengths" | "interests" | "challenges" | "focusAreas" | "parentPreferences" | "describedItems">> | null | undefined): CardWords | null {
  const items = keptItemsFromProfile(profile).filter((item) => item.kind === "strength");
  if (items.length === 0) return null;
  const ledger = profile && Array.isArray(profile.describedItems) ? profile.describedItems : [];
  let best: CardWords | null = null;
  let bestMs = -Infinity;
  for (const item of items) {
    const record = ledger.find((d) => d && d.id === item.id);
    const at = record ? (validAt(record.confirmedAt) ? record.confirmedAt : validAt(record.since) ? record.since : null) : null;
    if (!at) continue;
    const ms = Date.parse(at);
    if (ms > bestMs) {
      bestMs = ms;
      best = { id: item.id, text: item.words, at };
    }
  }
  if (best) return best;
  const last = items[items.length - 1];
  return { id: last.id, text: last.words, at: null };
}

/**
 * The newest moment the parent kept: a word, a first with its note, or a
 * plain moment written in their own words. A Seen-it answer with no note of
 * its own is an answer, not a kept moment, so it is left out. Nothing dated
 * after `nowMs` is shown.
 */
export function latestKeptMoment(things: readonly KeptThing[], logs: readonly BehaviorLog[] | undefined, nowMs: number): CardWords | null {
  let best: CardWords | null = null;
  let bestMs = -Infinity;
  const offer = (id: string, text: string | undefined, at: unknown) => {
    if (typeof text !== "string" || !text.trim() || !validAt(at)) return;
    const ms = Date.parse(at);
    if (ms > nowMs || ms <= bestMs) return;
    bestMs = ms;
    best = { id, text: text.trim(), at };
  };
  for (const thing of things) {
    if (thing.id.startsWith("milestones:") && !thing.keepsakeId) continue;
    offer(thing.id, thing.text, thing.at);
  }
  for (const log of logs ?? []) {
    if (log.behaviorType !== MOMENT_BEHAVIOR_TYPE || !parentWritten(log)) continue;
    offer(`behaviorLogs:${log.id}`, log.trigger, log.timestamp);
  }
  return best;
}

/** The areas with at least one new Seen it in the last 30 days, registry order. Names only. */
export function growingDomains(milestones: readonly Milestone[], nowMs: number): DomainId[] {
  const byShelf = groupMilestonesByShelf(milestones);
  const sinceIso = new Date(nowMs - 30 * DAY_MS).toISOString();
  return DOMAIN_IDS.filter((domain) => shelvesOfDomain(domain).some((shelf) => milestonesNoticedSince({ milestones: byShelf[shelf] }, sinceIso, nowMs) > 0));
}

/** "Add your own" writes a custom row on the stored domain that files it back on this area. */
export const CUSTOM_MILESTONE_DOMAIN: Readonly<Record<DomainId, DevelopmentalDomainId>> = {
  talking: "language_communication",
  moving: "sensory_motor_patterns",
  hands: "independence_adaptive_skills",
  thinking: "cognition_executive_function",
  playing: "social_development",
  feelings: "attachment_regulation",
  body: "health_sleep_feeding",
  family: "ecosystem_stressors",
};

const isShelfId = (value: unknown): value is ShelfId => typeof value === "string" && (SHELF_IDS as readonly string[]).includes(value);

/** The area a deep link opens: ?area=<domain>, else the old ?shelf=<shelf> carried from #/milestones. */
export function areaFromQuery(query: URLSearchParams): DomainId | null {
  const area = query.get("area");
  if (isDomainId(area)) return area;
  const shelf = query.get("shelf");
  return isShelfId(shelf) ? shelfDef(shelf).domain : null;
}

/** The area a skill files on (the same shelf the Seen-it count uses), or null. */
export function watchDomain(milestones: readonly Milestone[], milestoneId: string): DomainId | null {
  const byShelf = groupMilestonesByShelf(milestones);
  const shelf = SHELF_IDS.find((s) => byShelf[s].some((m) => m.id === milestoneId));
  return shelf ? shelfDef(shelf).domain : null;
}
