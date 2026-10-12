/**
 * F-CHILD-2 — the Moments read model (#/timeline): the record folded into
 * months, places and areas. Pure and descriptive: it only COUNTS what the
 * parent kept. No rates, no shares, no denominators, no colour scale — a
 * blank cell means "no record in this period", never a missing ability.
 */
import { EXTRACT_CONTEXTS } from "../../content/behaviorTaxonomy";
import { DOMAIN_IDS, type DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import type { BehaviorContext } from "../../types";

export type MomentsView = "time" | "places" | "areas";
export const MOMENTS_VIEWS: readonly MomentsView[] = ["time", "places", "areas"];

/** `?view=` → a known view; anything else is the default (Over time). */
export function parseView(raw: string | null | undefined): MomentsView {
  return raw === "places" || raw === "areas" ? raw : "time";
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

/** The local calendar month of a timestamp, `YYYY-MM` (null when unparseable). */
export function monthIdOf(at: string | Date): string | null {
  const d = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const time = (o: Observation) => Date.parse(o.at);

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
