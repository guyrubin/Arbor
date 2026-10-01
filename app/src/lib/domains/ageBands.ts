/**
 * B-GROWTH-27 — ONE age-band scheme (spine §2 last paragraph, phase 0).
 *
 * Canonical bands = the CDC "Learn the Signs. Act Early." checkpoints (2, 4, 6,
 * 9, 12, 15, 18, 24, 30, 36, 48, 60 months) extended by two school-age bands
 * (6–8 y, 9–12 y). A band runs from its checkpoint up to (not including) the
 * next one; months below 2 belong to the first band, months past 12 y clamp to
 * the last.
 *
 * The six existing schemes keep their own ids and content keys (no re-keying,
 * no rendered change). Each gains a LOOKUP into this scheme through
 * `toAgeBand(scheme, id)`: the canonical bands its range overlaps. The month
 * ranges below mirror each scheme's own selector; `ageBands.test.ts` walks every
 * month 0–144 and fails the moment a scheme's own function and this table
 * disagree.
 *
 * Pure data + pure functions. No imports — every scheme module may import this.
 */

export type CanonicalBandId =
  | "2m" | "4m" | "6m" | "9m" | "12m" | "15m" | "18m"
  | "24m" | "30m" | "36m" | "48m" | "60m"
  | "6-8y" | "9-12y";

export interface CanonicalBand {
  id: CanonicalBandId;
  /** Inclusive lower bound in months (the checkpoint). */
  minMonths: number;
  /** Exclusive upper bound in months (the next checkpoint). */
  maxMonths: number;
  /** "checkpoint" = a CDC milestone checkpoint; "school" = school-age band. */
  kind: "checkpoint" | "school";
}

const CHECKPOINTS = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60] as const;

/** The canonical bands, ascending. */
export const CANONICAL_BANDS: readonly CanonicalBand[] = [
  ...CHECKPOINTS.map((m, i) => ({
    id: `${m}m` as CanonicalBandId,
    minMonths: m,
    maxMonths: i + 1 < CHECKPOINTS.length ? CHECKPOINTS[i + 1] : 72,
    kind: "checkpoint" as const,
  })),
  { id: "6-8y", minMonths: 72, maxMonths: 108, kind: "school" },
  { id: "9-12y", minMonths: 108, maxMonths: 156, kind: "school" },
];

/** Months → the canonical band (below 2 m → "2m"; past 12 y → "9-12y"). */
export function fromMonths(months: number): CanonicalBand {
  const m = Number.isFinite(months) ? Math.max(0, months) : 0;
  let hit = CANONICAL_BANDS[0];
  for (const b of CANONICAL_BANDS) {
    if (m >= b.minMonths) hit = b;
    else break;
  }
  return hit;
}

/* ── The six existing schemes as month ranges [min, max) ─────────────────── */

export type AgeScheme =
  | "milestone"   // lib/milestoneData MILESTONE_AGE_BANDS (key = threshold months)
  | "screening"   // lib/screening AGE_BANDS (Development Check)
  | "play"        // playbank PLAY_BANDS (Daily Play, Journal prompt bank)
  | "stage"       // playbank/stages STAGES (Daily Play micro-stages)
  | "knowledge"   // knowledge/retrievalKeys KNOWLEDGE_AGE_BANDS (Learn / retrieval)
  | "language";   // practice/wordWorld LangAgeBand (Word World)

type Range = readonly [number, number];

const TOP = 156;

/** Each scheme's bands as [minMonths, maxMonths) — mirrored from its selector. */
export const SCHEME_RANGES: Record<AgeScheme, Readonly<Record<string, Range>>> = {
  milestone: {
    "2": [0, 4], "4": [4, 6], "6": [6, 9], "9": [9, 12], "12": [12, 15], "15": [15, 18],
    "18": [18, 24], "24": [24, 30], "30": [30, 36], "36": [36, 48], "48": [48, 60],
    "60": [60, 72], "72": [72, TOP],
  },
  screening: {
    "0-1": [0, 12], "1-2": [12, 24], "2-3": [24, 36], "3-5": [36, 72], "5-8": [72, 108], "8-12": [108, TOP],
  },
  play: {
    infant: [0, 12], toddler: [12, 36], preschool: [36, 60], "early-school": [60, TOP],
  },
  stage: {
    "0-3m": [0, 3], "3-6m": [3, 6], "6-9m": [6, 9], "9-12m": [9, 12], "12-18m": [12, 18],
    "18-24m": [18, 24], "2-3y": [24, 36], "3-4y": [36, 48], "4-5y": [48, 60],
    "5-7y": [60, 84], "7-9y": [84, 108], "9-12y": [108, TOP],
  },
  knowledge: {
    "0-12m": [0, 12], "12-36m": [12, 36], "3-5y": [36, 72], "6-8y": [72, 108], "9-12y": [108, TOP],
  },
  language: {
    "0-12m": [0, 12], "12-36m": [12, 36], "3-5y": [36, TOP],
  },
};

/**
 * A scheme band → the canonical bands its month range overlaps (ascending).
 * Unknown ids return []. Read-side lookup only.
 */
export function toAgeBand(scheme: AgeScheme, id: string): CanonicalBandId[] {
  const r = Object.prototype.hasOwnProperty.call(SCHEME_RANGES[scheme], id) ? SCHEME_RANGES[scheme][id] : undefined;
  if (!r) return [];
  const [min, max] = r;
  // a band below the first checkpoint still lands in "2m" (fromMonths clamps)
  return CANONICAL_BANDS.filter((b) => b.maxMonths > min && b.minMonths < max || (min < 2 && b.id === "2m")).map((b) => b.id);
}

/** Months → the scheme's band id per the table (the selector it mirrors). */
export function schemeBandForMonths(scheme: AgeScheme, months: number): string {
  const m = Number.isFinite(months) ? Math.max(0, months) : 0;
  const entries = Object.entries(SCHEME_RANGES[scheme]);
  const hit = entries.find(([, [min, max]]) => m >= min && m < max);
  return (hit ?? entries[entries.length - 1])[0];
}
