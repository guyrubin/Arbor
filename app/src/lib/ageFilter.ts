/**
 * W0.7 — shared age-fit helper for content-library surfaces.
 *
 * Six library screens listed content with no regard for the active child's
 * age (a 6-month-old's parent was offered "at 4, 6 and 8" material). This
 * module gives every listing surface ONE shared, months-precise answer to
 * "does this item fit this child right now?" plus the show-all persistence
 * that keeps every item reachable (UC-1 zero-regression rule).
 *
 * Pure, framework-free (no React / Firebase / analytics imports) — mirrors
 * lib/childAge.ts so it unit-tests in isolation under the node environment.
 *
 * BANDING IS NOT INVENTED HERE: nearness reuses the existing micro-stage
 * taxonomy in playbank/stages.ts (the same windows Daily Play already selects
 * against). "Near-band" = the content window overlaps the span of the child's
 * own stage plus its adjacent stages — so tolerance is age-proportional
 * (~3 months for an infant, ~2 years for a 10-year-old), exactly like the
 * playbank's adjacentStages fallback.
 *
 * CLINICAL FIREWALL: an age window is a plain catalog fact about CONTENT,
 * never a verdict about the child. Out-of-band means "written for another
 * age", not "your child can't".
 */

import { ageToStage, adjacentStages, stageDef } from "../playbank/stages";

// ── Types ────────────────────────────────────────────────────────────────────

/** How a content item's age window relates to the active child's age. */
export type AgeFit = "in" | "near" | "out" | "unknown";

/** Normalized content age window in months — inclusive min, EXCLUSIVE max
 *  (half-open, matching playbank/stages semantics). */
export interface AgeWindowMonths {
  minMonths: number;
  maxMonths: number;
}

// ── Normalizers (one per metadata shape actually found in the repo) ──────────

/**
 * From inclusive whole-year bounds (the LearnCard `ageMin`/`ageMax` shape and
 * the new optional Masterclass `ageMinYears`/`ageMaxYears`). "Ages 4–8" means
 * the whole 8th year is in-band, so maxMonths = (max + 1) * 12 (exclusive).
 * Either bound may be absent (open-ended); both absent → null (no metadata).
 */
export function windowFromYears(
  minYears?: number | null,
  maxYears?: number | null,
): AgeWindowMonths | null {
  const hasMin = typeof minYears === "number" && Number.isFinite(minYears);
  const hasMax = typeof maxYears === "number" && Number.isFinite(maxYears);
  if (!hasMin && !hasMax) return null;
  const minMonths = hasMin ? Math.max(0, Math.round((minYears as number) * 12)) : 0;
  const maxMonths = hasMax
    ? Math.max(minMonths + 1, Math.round(((maxYears as number) + 1) * 12))
    : Number.POSITIVE_INFINITY;
  return { minMonths, maxMonths };
}

/** From the HeroStorySpec `ageRange: [minYears, maxYears]` tuple (inclusive). */
export function windowFromRange(
  range?: readonly number[] | null,
): AgeWindowMonths | null {
  if (!range || range.length < 2) return null;
  return windowFromYears(range[0], range[1]);
}

/**
 * From an ageBand string like "2-5" / "6-9" / "10-12" (the hardMomentCards
 * shape; inclusive years, hyphen or en-dash). Unparseable → null (unknown),
 * never a guess.
 */
export function windowFromBandString(band?: string | null): AgeWindowMonths | null {
  if (!band) return null;
  const m = band.trim().match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
  if (!m) return null;
  return windowFromYears(Number(m[1]), Number(m[2]));
}

// ── Classification ───────────────────────────────────────────────────────────

/**
 * Classify one content window against the child's age in months.
 *  - no window (null/undefined)  → "unknown" (no metadata — never hidden)
 *  - no child age                → "unknown" (cannot judge — never hidden)
 *  - child inside [min, max)     → "in"
 *  - window overlaps the child's stage ± one adjacent micro-stage → "near"
 *  - otherwise                   → "out"
 */
export function classifyAgeFit(
  window: AgeWindowMonths | null | undefined,
  childMonths: number | null | undefined,
): AgeFit {
  if (!window) return "unknown";
  if (childMonths == null || !Number.isFinite(childMonths)) return "unknown";
  const months = Math.max(0, childMonths);
  if (months >= window.minMonths && months < window.maxMonths) return "in";

  // Nearness from the EXISTING playbank micro-stage grid (no new banding).
  const stage = ageToStage(months / 12);
  const around = [stage, ...adjacentStages(stage)].map(stageDef);
  const nearMin = Math.min(...around.map((s) => s.minMonths));
  const nearMax = Math.max(...around.map((s) => s.maxMonths));
  const overlaps = window.minMonths < nearMax && window.maxMonths > nearMin;
  return overlaps ? "near" : "out";
}

/** Items shown when the parent has NOT asked for all ages. ("unknown" is shown:
 *  no metadata is a content-model gap, never a reason to hide content.) */
export const isShownByDefault = (fit: AgeFit): boolean => fit !== "out";

// ── List filtering ───────────────────────────────────────────────────────────

/** Below this many in-band items, near-band items backfill the default view. */
export const NEAR_BAND_BACKFILL_THRESHOLD = 3;

export interface AgeFilterResult<T> {
  /** Default view: in-band + unknown items, plus near-band backfill when the
   *  in-band list would otherwise be nearly empty. Original order kept. */
  visible: T[];
  /** Everything not in `visible` — reachable via the "Show all ages" toggle. */
  hidden: T[];
  /** Per-item fit, for chips/why-lines. Keyed by item reference. */
  fits: Map<T, AgeFit>;
}

/**
 * Split a content list for an age-filtered surface. Stable: both partitions
 * preserve the input order (never re-rank — ranking stays the surface's job).
 */
export function filterByAge<T>(
  items: readonly T[],
  getWindow: (item: T) => AgeWindowMonths | null,
  childMonths: number | null | undefined,
  threshold: number = NEAR_BAND_BACKFILL_THRESHOLD,
): AgeFilterResult<T> {
  const fits = new Map<T, AgeFit>();
  for (const item of items) fits.set(item, classifyAgeFit(getWindow(item), childMonths));

  const inBandCount = items.reduce(
    (n, item) => (fits.get(item) === "in" || fits.get(item) === "unknown" ? n + 1 : n),
    0,
  );
  const includeNear = inBandCount < threshold;

  const visible: T[] = [];
  const hidden: T[] = [];
  for (const item of items) {
    const fit = fits.get(item) as AgeFit;
    const shown = fit === "in" || fit === "unknown" || (includeNear && fit === "near");
    (shown ? visible : hidden).push(item);
  }
  return { visible, hidden, fits };
}

// ── Per-surface "Show all ages" persistence (arbor.* key convention) ─────────

export const ageFilterStorageKey = (surface: string): string =>
  `arbor.agefilter.showAll.${surface}`;

export function loadShowAllAges(surface: string): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(ageFilterStorageKey(surface)) === "1";
  } catch {
    return false;
  }
}

export function saveShowAllAges(surface: string, showAll: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(ageFilterStorageKey(surface), showAll ? "1" : "0");
  } catch {
    /* ignore quota/privacy-mode errors */
  }
}
