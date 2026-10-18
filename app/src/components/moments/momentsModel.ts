/**
 * F-CHILD-2 — the Moments read model (#/timeline): the record folded into
 * months, places and areas. Pure and descriptive: it only COUNTS what the
 * parent kept. No rates, no shares, no denominators, no colour scale — a
 * blank cell means "no record in this period", never a missing ability.
 */
import { EXTRACT_CONTEXTS, isIncidentType } from "../../content/behaviorTaxonomy";
import { DOMAIN_IDS, type DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import type { BehaviorContext } from "../../types";

export type MomentsView = "time" | "places" | "areas";
/** v4: Across areas leads (the record at a glance), then Over time, then By place. */
export const MOMENTS_VIEWS: readonly MomentsView[] = ["areas", "time", "places"];

/**
 * `?view=` → a known view. v4: with no view, Moments opens Across areas — but a
 * link that names an area, a month or one observation is asking for those
 * moments themselves, so it opens Over time (the reading that lists them).
 */
export function parseView(raw: string | null | undefined, focused = false): MomentsView {
  if (raw === "places" || raw === "areas" || raw === "time") return raw;
  return focused ? "time" : "areas";
}

/**
 * v4 — which moments are in view (the consolidation blueprint folds the hard
 * moments, the kept things and the words into Moments as filters):
 *  - kept: the firsts the parent kept (keepsakes);
 *  - hard: the incident-shaped entries — a behaviour log whose type is one of
 *    the incident types (isIncidentType), never the neutral "Moment";
 *  - said: the words and phrases the parent wrote down.
 * A filter only narrows; the counts beside it are plain counts of kept items.
 */
export type MomentsKind = "all" | "kept" | "hard" | "said";
export const MOMENTS_KINDS: readonly MomentsKind[] = ["all", "kept", "hard", "said"];

/** `?kind=` → a known kind; anything else is everything. */
export function parseKind(raw: string | null | undefined): MomentsKind {
  return raw === "kept" || raw === "hard" || raw === "said" ? raw : "all";
}

export function isKind(o: Observation, kind: MomentsKind): boolean {
  switch (kind) {
    case "all": return true;
    case "kept": return o.value.type === "keepsake";
    case "hard": return o.value.type === "moment" && isIncidentType(o.value.behaviorType);
    case "said": return o.value.type === "word";
  }
}

/** How many of `observations` each kind holds (All included). */
export function kindCounts(observations: readonly Observation[]): Record<MomentsKind, number> {
  const counts: Record<MomentsKind, number> = { all: 0, kept: 0, hard: 0, said: 0 };
  for (const o of observations) for (const kind of MOMENTS_KINDS) if (isKind(o, kind)) counts[kind] += 1;
  return counts;
}

/**
 * v4 — a month bar's height on Across areas: a FIXED scale (every saved
 * moment adds the same few pixels, capped), so one count is one height on
 * every card. Nothing is normalised against another area or month: no share,
 * no maximum, and the number itself is always printed under the bar.
 */
export const BAR_UNIT_PX = 3;
export const BAR_BASE_PX = 4;
export const BAR_MAX_PX = 28;
export function barHeightPx(n: number): number {
  return n > 0 ? Math.min(BAR_MAX_PX, BAR_BASE_PX + BAR_UNIT_PX * n) : 0;
}

/**
 * What Moments shows and counts: the things the parent kept — moments,
 * milestones, keepsakes, words, notes, play, activity and professional
 * entries. A child's own practice in Kid Mode, a screening's answers and a
 * growth measurement are not moments; they keep their own pages and never
 * enter a Moments card or an Across-areas count.
 */
export function isMomentRecord(o: Observation): boolean {
  return o.source !== "kid_practice" && o.value.type !== "check" && o.value.type !== "measurement";
}

/** Months in view: the last 3, the last 12, or the whole loaded record (0). */
export type MomentsRange = 3 | 12 | 0;
export const MOMENTS_RANGES: readonly MomentsRange[] = [3, 12, 0];

export interface MonthBucket {
  /** Local calendar month, `YYYY-MM`. */
  id: string;
  from: Date;
  /** Exclusive end; the current month ends just after `now`. */
  until: Date;
  /** Newest first. */
  observations: Observation[];
}

const pad = (n: number) => String(n).padStart(2, "0");

// A date chosen by the parent is a local calendar day, not midnight UTC.
// Use the same interpretation for month labels, range bounds and ordering.
const recordDate = (at: string | Date): Date => at instanceof Date ? at
  : new Date(/^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T00:00:00` : at);

/** The local calendar month of a timestamp or chosen day (null when unparseable). */
export function monthIdOf(at: string | Date): string | null {
  const d = recordDate(at);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const time = (o: Observation) => recordDate(o.at).getTime();

/**
 * The child's record in month columns, newest month first. Every month of the
 * range is present (an empty month stays an honest empty column), except for
 * the whole record (range 0), which spans from the oldest record to now.
 */
export function monthBuckets(observations: readonly Observation[], childId: string, now: Date, range: MomentsRange): MonthBucket[] {
  const nowMs = now.getTime();
  const mine = observations
    .filter(o => o.childId === childId && Number.isFinite(time(o)) && time(o) <= nowMs)
    .sort((a, b) => time(b) - time(a));
  let count: number = range;
  if (range === 0) {
    const oldest = mine.reduce<number>((min, o) => Math.min(min, time(o)), nowMs);
    const first = new Date(oldest);
    count = (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth()) + 1;
  }
  const buckets: MonthBucket[] = [];
  const byId = new Map<string, MonthBucket>();
  for (let i = 0; i < Math.max(1, count); i += 1) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const until = i === 0 ? new Date(nowMs + 1) : new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const bucket: MonthBucket = { id: `${from.getFullYear()}-${pad(from.getMonth() + 1)}`, from, until, observations: [] };
    buckets.push(bucket);
    byId.set(bucket.id, bucket);
  }
  for (const o of mine) {
    const id = monthIdOf(o.at);
    if (id) byId.get(id)?.observations.push(o);
  }
  return buckets;
}

/** One row per area (registry order): how many kept moments fall in each month. */
export interface AreaRow {
  domain: DomainId;
  /** Aligned with the buckets passed in; plain integer counts. */
  counts: number[];
}

export function areaMonthCounts(buckets: readonly MonthBucket[]): AreaRow[] {
  return DOMAIN_IDS.map(domain => ({
    domain,
    counts: buckets.map(bucket => bucket.observations.reduce((n, o) => (o.domains.includes(domain) ? n + 1 : n), 0)),
  }));
}

export interface PlaceCard {
  context: BehaviorContext;
  /** Newest first. */
  observations: Observation[];
}

/** The place a moment was recorded in, when the parent recorded one. */
export function placeOf(o: Observation): BehaviorContext | null {
  if (o.value.type !== "moment") return null;
  const context = o.value.context;
  return (EXTRACT_CONTEXTS as readonly string[]).includes(context ?? "") ? (context as BehaviorContext) : null;
}

/**
 * Places the parent recorded, in a fixed order (home, preschool, on the way,
 * out and about). A place with no moment is absent; an unspecified place is
 * never inferred from the note.
 */
export function placeCards(observations: readonly Observation[]): PlaceCard[] {
  const sorted = [...observations].sort((a, b) => time(b) - time(a));
  return EXTRACT_CONTEXTS
    .map(context => ({ context: context as BehaviorContext, observations: sorted.filter(o => placeOf(o) === context) }))
    .filter(card => card.observations.length > 0);
}

/** Narrow to one area and/or one month (`YYYY-MM`); either may be absent. */
export function filterByAreaMonth(observations: readonly Observation[], area?: DomainId | null, monthId?: string | null): Observation[] {
  return observations.filter(o => (!area || o.domains.includes(area)) && (!monthId || monthIdOf(o.at) === monthId));
}

/** `?month=` → a `YYYY-MM` id, or null. */
export function parseMonth(raw: string | null | undefined): string | null {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null;
}
