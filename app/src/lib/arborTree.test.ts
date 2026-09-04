/**
 * GP-30 — the tree of what the parent noticed: derivation + firewall guards.
 *
 * The defect this file exists to prevent has been found in this codebase twice
 * already: a parent-facing milestone COUNT derived from the age WINDOW (the
 * child's current corrected CDC band plus the one before it). Windowing is
 * correct for "worth watching next" and for an honest denominator, and wrong
 * for a keepsake count, because the count drops the day the child ages into a
 * new band — leaves would disappear from the tree because the child had a
 * birthday, which reads as regression.
 *
 * The property is pinned here WITH ITS NEGATIVE CONTROL: the same fixture is
 * run through the windowed derivation, and that count is asserted to fall. If
 * the guard below ever stopped being able to detect the defect, the negative
 * control fails first and the suite cannot rot into a vacuous pass.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARBOR_TREE_CANOPY,
  ARBOR_TREE_LEAF_CAP,
  arborTreeLeaves,
  arborTreeView,
  countNoticedMilestones,
  isNoticed,
} from "./arborTree";
import { ageWindowMilestones, comparisonAgeMonths } from "./milestoneData";

/* ── Counting: what a "noticed" mark is, and what it is not ───────────────── */

describe("countNoticedMilestones — a leaf is a mark the PARENT made", () => {
  it("counts the legacy checked flag and the richer 'yes' status alike", () => {
    expect(countNoticedMilestones([{ checked: true }])).toBe(1);
    expect(countNoticedMilestones([{ observationStatus: "yes" }])).toBe(1);
    expect(countNoticedMilestones([{ checked: true, observationStatus: "yes" }])).toBe(1);
  });

  it("NEGATIVE CONTROL: uncertainty and silence are not noticing", () => {
    // If any of these counted, an untouched catalogue would draw a full tree.
    expect(countNoticedMilestones([{}])).toBe(0);
    expect(countNoticedMilestones([{ checked: false }])).toBe(0);
    expect(countNoticedMilestones([{ observationStatus: "not_sure" }])).toBe(0);
    expect(countNoticedMilestones([{ observationStatus: "not_yet" }])).toBe(0);
    expect(countNoticedMilestones([{ checked: false, observationStatus: "not_sure" }])).toBe(0);
  });

  it("counts marks, never list length", () => {
    const list = [{ checked: true }, {}, { observationStatus: "yes" }, { observationStatus: "not_yet" }, {}];
    expect(countNoticedMilestones(list)).toBe(2);
    expect(countNoticedMilestones(list)).not.toBe(list.length);
  });

  it("survives absent or malformed input rather than throwing at a parent", () => {
    expect(countNoticedMilestones(null)).toBe(0);
    expect(countNoticedMilestones(undefined)).toBe(0);
    expect(countNoticedMilestones([] as never[])).toBe(0);
    expect(isNoticed(null)).toBe(false);
    expect(isNoticed(undefined)).toBe(false);
  });
});

/* ── The property: the leaf count can never fall ──────────────────────────── */

/** A record spanning two far-apart CDC bands, all of it noticed. */
const NOTICED_ACROSS_BANDS: {
  id: string;
  ageMonths: number;
  checked?: boolean;
  observationStatus?: string;
}[] = [
  { id: "a1", ageMonths: 2, checked: true },
  { id: "a2", ageMonths: 2, checked: true },
  { id: "a3", ageMonths: 2, observationStatus: "yes" },
  { id: "b1", ageMonths: 24, checked: true },
  { id: "b2", ageMonths: 24, checked: true },
  // Unmarked items at both ends — they must never become leaves.
  { id: "c1", ageMonths: 2, checked: false },
  { id: "c2", ageMonths: 48, checked: false },
];

/** Every month of childhood the app supports, plus the edges. */
const AGES_IN_MONTHS = Array.from({ length: 85 }, (_, i) => i);

describe("GP-30 — the leaf count cannot fall when the child crosses a CDC band", () => {
  it("is age-blind by construction: there is no parameter a band change can arrive through", () => {
    // The structural proof. A one-argument function that receives only the
    // milestone list cannot vary with age, date, band or clock. If someone
    // later adds an age parameter, this fails and the reviewer is sent to the
    // file header before the tree can start losing leaves.
    expect(countNoticedMilestones.length).toBe(1);
  });

  it("holds steady at every age from birth to seven years", () => {
    const counts = AGES_IN_MONTHS.map(() => countNoticedMilestones(NOTICED_ACROSS_BANDS));
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe(5);
  });

  it("never decreases as the record grows, one mark at a time", () => {
    const record = NOTICED_ACROSS_BANDS.map((m) => ({ ...m, checked: false, observationStatus: undefined }));
    let previous = countNoticedMilestones(record);
    expect(previous).toBe(0);
    for (const row of record) {
      row.checked = true;
      const next = countNoticedMilestones(record);
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
    expect(previous).toBe(record.length);
  });

  it("NEGATIVE CONTROL: the age-WINDOWED count really does fall on this same record", () => {
    // This is the defect. If the tree were derived the way Growth's record
    // card is derived, these numbers are what a parent would watch happen.
    const windowedNoticed = (ageMonths: number): number =>
      ageWindowMilestones(NOTICED_ACROSS_BANDS, comparisonAgeMonths(ageMonths)).filter(
        (m) => m.checked === true || m.observationStatus === "yes",
      ).length;

    const atFourMonths = windowedNoticed(4);
    const atNineMonths = windowedNoticed(9);
    expect(atFourMonths).toBeGreaterThan(0);
    // The three 2-month marks fall out of the window the moment the child
    // reaches the 9-month band: the count drops, on data that never changed.
    expect(atNineMonths).toBeLessThan(atFourMonths);

    // …and the derivation the tree actually uses does not move at all.
    expect(countNoticedMilestones(NOTICED_ACROSS_BANDS)).toBe(
      countNoticedMilestones(NOTICED_ACROSS_BANDS),
    );
    expect(countNoticedMilestones(NOTICED_ACROSS_BANDS)).toBeGreaterThan(atNineMonths);
  });
});

/* ── The drawing: one leaf per mark, stable, monotone, no placeholders ────── */

describe("arborTreeLeaves — exactly one leaf per noticed milestone", () => {
  it("draws nothing for an empty record (no placeholder, no ghost canopy)", () => {
    // A drawn empty slot is a completion ratio, drawn. There must be none.
    expect(arborTreeLeaves(0)).toEqual([]);
  });

  it("draws exactly `count` leaves below the cap", () => {
    for (const n of [1, 2, 7, 33, ARBOR_TREE_LEAF_CAP]) {
      expect(arborTreeLeaves(n)).toHaveLength(n);
    }
  });

  it("holds the drawing still past the cap, and never removes a leaf", () => {
    expect(arborTreeLeaves(ARBOR_TREE_LEAF_CAP + 1)).toHaveLength(ARBOR_TREE_LEAF_CAP);
    expect(arborTreeLeaves(5000)).toHaveLength(ARBOR_TREE_LEAF_CAP);

    let previous = 0;
    for (let n = 0; n <= ARBOR_TREE_LEAF_CAP + 25; n++) {
      const drawn = arborTreeLeaves(n).length;
      expect(drawn).toBeGreaterThanOrEqual(previous);
      previous = drawn;
    }
  });

  it("never moves a leaf that is already on the tree", () => {
    // Growth must add to a familiar tree, not rearrange it.
    const few = arborTreeLeaves(6);
    const many = arborTreeLeaves(40);
    expect(many.slice(0, few.length)).toEqual(few);
  });

  it("keeps every leaf inside the canopy and free of NaN", () => {
    for (const leaf of arborTreeLeaves(ARBOR_TREE_LEAF_CAP)) {
      const dx = leaf.x - ARBOR_TREE_CANOPY.cx;
      const dy = leaf.y - ARBOR_TREE_CANOPY.cy;
      expect(Number.isFinite(leaf.x) && Number.isFinite(leaf.y)).toBe(true);
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(ARBOR_TREE_CANOPY.radius + 0.01);
      expect(leaf.rotation).toBeGreaterThanOrEqual(0);
    }
  });

  it("refuses nonsense counts instead of drawing nonsense", () => {
    expect(arborTreeLeaves(-4)).toEqual([]);
    expect(arborTreeLeaves(Number.NaN)).toEqual([]);
    expect(arborTreeLeaves(Number.POSITIVE_INFINITY)).toEqual([]);
    expect(arborTreeLeaves(3.7)).toHaveLength(3);
  });
});

describe("arborTreeView — the one derivation a surface consumes", () => {
  it("reports the true count and the drawn leaves separately", () => {
    const marks = Array.from({ length: ARBOR_TREE_LEAF_CAP + 9 }, () => ({ checked: true }));
    const view = arborTreeView(marks);
    expect(view.noticedCount).toBe(ARBOR_TREE_LEAF_CAP + 9);
    expect(view.leaves).toHaveLength(ARBOR_TREE_LEAF_CAP);
    expect(view.capped).toBe(true);
  });

  it("is not capped while every mark still has its own leaf", () => {
    const view = arborTreeView([{ checked: true }, { checked: true }]);
    expect(view.noticedCount).toBe(2);
    expect(view.leaves).toHaveLength(2);
    expect(view.capped).toBe(false);
  });

  it("an untouched record is an empty tree, not a zero", () => {
    const view = arborTreeView([{ checked: false }, { observationStatus: "not_yet" }]);
    expect(view).toEqual({ noticedCount: 0, leaves: [], capped: false });
  });
});

/* ── Source guards: the basis, and the firewall, stay where they were put ─── */

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");
/** Comments carry prose ABOUT the banned things; only code is scanned. */
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The windowed-basis identifiers that must never reach this surface. */
const WINDOWED_BASIS = /\b(?:ageWindowMilestones|milestoneAgeWindow|useDevScore|computeDevScore|checkedMilestones|milestonesPercent)\b/;
/** Verdict machinery: a share, a ratio, or a red/amber/green judgement. */
// `\b` is useless against a leading "-", so the alarm token is matched literally.
const VERDICT_MACHINERY = /\b(?:percent|percentage|ratio)\b|--arbor-danger/i;

describe("GP-30 source guard — the tree card cannot acquire a window or a verdict", () => {
  const card = stripComments(readSrc(path.join("components", "growth", "ArborTreeCard.tsx")));
  const lib = stripComments(readSrc(path.join("lib", "arborTree.ts")));

  it("scans real, non-empty code (sanity — a mis-stripped file must not pass silently)", () => {
    expect(card.length).toBeGreaterThan(500);
    expect(lib.length).toBeGreaterThan(500);
    expect(card).toContain("arborTreeView");
    expect(lib).toContain("export function countNoticedMilestones");
  });

  it("NEGATIVE CONTROL: the matchers catch the exact code that would break this", () => {
    expect(WINDOWED_BASIS.test('import { ageWindowMilestones } from "../../lib/milestoneData";')).toBe(true);
    expect(WINDOWED_BASIS.test("const { checkedMilestones } = useArbor();")).toBe(true);
    expect(VERDICT_MACHINERY.test("const percent = Math.round((noticed / total) * 100);")).toBe(true);
    expect(VERDICT_MACHINERY.test('fill="var(--arbor-danger)"')).toBe(true);
    // …and they do not fire on ordinary code, so a pass means something.
    expect(WINDOWED_BASIS.test("const view = arborTreeView(milestones);")).toBe(false);
    expect(VERDICT_MACHINERY.test('fill="var(--arbor-green-ink)"')).toBe(false);
  });

  it("the card derives from the unwindowed record and renders no share or verdict", () => {
    expect(WINDOWED_BASIS.test(card), "the tree must never be age-windowed").toBe(false);
    expect(VERDICT_MACHINERY.test(card), "the tree must carry no share, ratio or alarm colour").toBe(false);
    expect(lib.match(/\bage(?:Months|Years)?\b/), "the derivation takes no age at all").toBeNull();
  });

  it("every leaf is drawn identically — one fill, one size, so nothing can rank", () => {
    const fills = card.match(/fill="var\(--arbor-[a-z-]+\)"/g) ?? [];
    expect(new Set(fills).size).toBe(1);
    expect(fills[0]).toBe('fill="var(--arbor-green-ink)"');
  });
});
