/* ════════════════════════════════════════════════════════════════════════════
   arborTree — GP-30: one leaf per milestone the PARENT noticed.

   WHAT THIS IS. A drawing of the parent's own record of noticing. It is NOT a
   drawing of the child. A tree is a growth metaphor, and a growth metaphor
   pointed at a child is precisely what the clinical firewall exists to stop,
   so every decision in this file is made against that one risk:

     · the tree expresses a COUNT and nothing else — never a score, share,
       percentage, ratio, "x of y", ring, delta, trend, band, level, domain
       ranking, weakest-area pointer, or any red/amber/green verdict;
     · there is no denominator anywhere, and deliberately no drawn "empty
       slot" for a leaf that does not exist — a placeholder leaf IS a
       completion ratio, drawn;
     · every leaf is identical: same size, same colour, same weight. A leaf
       carries no domain, no recency and no importance, because any of those
       would let the picture rank the child's areas by inspection;
     · a sparse tree is a record of how much a parent has written down so far,
       and the copy at the call site says exactly that.

   THE COUNT CAN NEVER FALL. Milestone counts elsewhere in the app are
   AGE-WINDOWED (lib/milestoneData.ageWindowMilestones — the child's current
   corrected CDC band plus the one before it), which is right for "worth
   watching next" and right for an honest denominator, and catastrophic here:
   a windowed count DROPS the day a child ages into a new band, so a parent who
   opened this card on a Tuesday and again on a Wednesday would see leaves
   disappear from their child's tree. That reads as regression, about a child,
   caused by a birthday.

   The defence is structural, not a convention: `countNoticedMilestones` takes
   no age, no date, no band, no window and no clock. There is no parameter a
   band change could arrive through, so no band change can reach the result.
   arborTree.test.ts pins that, with the windowed derivation as the negative
   control — it proves the windowed count really does fall on the same data.

   Pure and dependency-free (no React, no storage, no i18n) so the whole
   derivation is unit-testable in the node environment the suite runs in.
   ════════════════════════════════════════════════════════════════════════════ */

/** The only two fields a "did the parent notice this?" decision may read.
 *  Nothing about age, band, domain or date is in scope. */
export interface NoticedMilestoneInput {
  checked?: boolean;
  observationStatus?: string;
}

/**
 * True when the PARENT marked this milestone as something they saw.
 *
 * `checked` is the long-standing flag and `observationStatus === "yes"` is the
 * richer form written beside it; either alone is enough, because records
 * written before the status field existed carry only the flag. "not_sure" and
 * "not_yet" are NOT noticing and never grow the tree — an uncertain mark must
 * not be converted into a leaf just to make the picture fuller.
 */
export function isNoticed(m: NoticedMilestoneInput | null | undefined): boolean {
  if (!m) return false;
  return m.checked === true || m.observationStatus === "yes";
}

/**
 * How many milestones this parent has marked as noticed — over the WHOLE
 * record, at every age, for all time.
 *
 * Deliberately unwindowed and deliberately age-blind. See the file header: the
 * absence of an age parameter is the proof that the number cannot fall when the
 * child crosses a CDC band. Callers must pass the full milestone list from
 * ArborContext (`milestones`), never `ageWindowMilestones(...)` of it and never
 * the context's own windowed `checkedMilestones`.
 */
export function countNoticedMilestones(
  milestones: readonly NoticedMilestoneInput[] | null | undefined,
): number {
  if (!Array.isArray(milestones)) return 0;
  let n = 0;
  for (const m of milestones) if (isNoticed(m)) n += 1;
  return n;
}

/* ───────────────────────────── The drawing ───────────────────────────── */

/** The SVG coordinate space every consumer shares. */
export const ARBOR_TREE_VIEWBOX = { width: 200, height: 150 } as const;

/** Canopy geometry — leaves are placed inside this disc, from the middle out. */
export const ARBOR_TREE_CANOPY = { cx: 100, cy: 62, radius: 46 } as const;

/**
 * The most leaves the DRAWING holds. The number the parent reads is always the
 * true count; past this many, the picture simply stops adding marks and the
 * card says so in words. A cap is needed because the layout below spaces leaves
 * against a fixed disc — without one, leaf 400 would land outside the frame.
 *
 * The cap can only ever hold the drawing STILL. `arborTreeLeaves` is monotone
 * non-decreasing in `count`, so no leaf is ever removed by growth.
 */
export const ARBOR_TREE_LEAF_CAP = 72;

/** The golden angle — the spacing that fills a disc evenly without any leaf
 *  landing on top of another, and without needing randomness (which would move
 *  leaves between renders). */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface ArborTreeLeaf {
  /** 0-based index — stable for the life of the leaf. */
  i: number;
  x: number;
  y: number;
  /** Degrees, for the leaf's long axis; purely a drawing detail. */
  rotation: number;
}

const round = (n: number, places: number): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/**
 * The leaves to draw for a count.
 *
 * TWO PROPERTIES THIS FUNCTION OWES THE PARENT, both pinned by tests:
 *  1. STABILITY — leaf `i` is at the same place whatever the total is, so a
 *     new leaf is added to a familiar tree rather than rearranging it.
 *  2. MONOTONICITY — a larger count never yields fewer leaves.
 *
 * Placement runs from the canopy centre outwards, so a small record is a young
 * tree with a small crown rather than a wide crown with holes in it. Holes
 * would read as absences, and an absence about a child is a verdict.
 */
export function arborTreeLeaves(count: number): ArborTreeLeaf[] {
  const safe = Number.isFinite(count) ? Math.floor(count) : 0;
  const n = Math.max(0, Math.min(safe, ARBOR_TREE_LEAF_CAP));
  const out: ArborTreeLeaf[] = [];
  for (let i = 0; i < n; i++) {
    const theta = i * GOLDEN_ANGLE;
    const r = ARBOR_TREE_CANOPY.radius * Math.sqrt((i + 0.5) / ARBOR_TREE_LEAF_CAP);
    out.push({
      i,
      x: round(ARBOR_TREE_CANOPY.cx + r * Math.cos(theta), 2),
      y: round(ARBOR_TREE_CANOPY.cy + r * Math.sin(theta), 2),
      rotation: round(((theta * 180) / Math.PI) % 360, 1),
    });
  }
  return out;
}

export interface ArborTreeView {
  /** The true, unwindowed count of what the parent has noticed. */
  noticedCount: number;
  /** The leaves actually drawn (≤ ARBOR_TREE_LEAF_CAP). */
  leaves: ArborTreeLeaf[];
  /** True when the drawing has stopped adding marks but the count has not. */
  capped: boolean;
}

/**
 * The one derivation a rendering surface consumes. Counts, then draws — there
 * is no third field, and there is no denominator to derive one from.
 */
export function arborTreeView(
  milestones: readonly NoticedMilestoneInput[] | null | undefined,
): ArborTreeView {
  const noticedCount = countNoticedMilestones(milestones);
  return {
    noticedCount,
    leaves: arborTreeLeaves(noticedCount),
    capped: noticedCount > ARBOR_TREE_LEAF_CAP,
  };
}
