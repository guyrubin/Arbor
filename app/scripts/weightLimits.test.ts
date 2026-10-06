/**
 * B-INF-06 — the weight limit. The rendered sweep (scripts/rendered-sweep.mjs) writes a
 * `weight` block per cell; this ratchet reads the NEWEST sweeps/<run>/sweep.json whose cells
 * carry it and fails when:
 *   1. any route × viewport × lang in scripts/weight-baseline.json is heavier on any metric
 *      (the baseline is written once from a real sweep by scripts/weight-baseline.mjs and only
 *      ever lowered by hand), or
 *   2. a redesigned route breaks a hard cap: ≤ 7 tappable above the fold at 375, ≤ 4 text
 *      sizes, 0 text under 12 px, 0 upper-case, 0 gradients, ≤ 2 screens. A cap the measured
 *      baseline already violates is a `todo` naming the number — never a loosened cap.
 * With no sweep carrying weight blocks, or no baseline, the sweep-reading suites SKIP (CI
 * without a sweep stays green); the unit suite below always runs.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Metric = "tappableAboveFold" | "tappable" | "textSizes" | "under12" | "uppercase" | "gradients" | "screens";
type Weight = Record<Metric, number>;
type Cell = { route: string; viewport: string; lang: string; state?: string; mounted?: boolean; weight?: Weight };
type Baseline = { generatedFrom?: string; cells: Record<string, Weight> };

const METRICS: Metric[] = ["tappableAboveFold", "tappable", "textSizes", "under12", "uppercase", "gradients", "screens"];
export const REDESIGNED = ["overview", "behaviors", "journal", "profile", "milestones", "consult"] as const;
/** Hard caps; `at375` = the cap applies to the 375-wide cells only. */
export const HARD_CAPS: { metric: Metric; max: number; at375?: boolean }[] = [
  { metric: "tappableAboveFold", max: 7, at375: true },
  { metric: "textSizes", max: 4 },
  { metric: "under12", max: 0 },
  { metric: "uppercase", max: 0 },
  { metric: "gradients", max: 0 },
  { metric: "screens", max: 2 },
];

const keyOf = (c: Pick<Cell, "route" | "viewport" | "lang">) => `${c.route}|${c.viewport}|${c.lang}`;
const isBase = (c: Cell) => (c.state ?? "base") === "base" && !!c.weight && c.mounted !== false;

/** Ratchet: every baseline cell present in the sweep must be no heavier on any metric. */
export function weightViolations(cells: readonly Cell[], baseline: Baseline): string[] {
  const now = new Map(cells.filter(isBase).map((c) => [keyOf(c), c.weight as Weight]));
  const out: string[] = [];
  for (const [key, base] of Object.entries(baseline.cells)) {
    const w = now.get(key);
    if (!w) continue; // route not in this run
    for (const m of METRICS) {
      if (typeof base[m] === "number" && typeof w[m] === "number" && w[m] > base[m]) out.push(`${key} ${m}: ${w[m]} > baseline ${base[m]}`);
    }
  }
  return out;
}

/** Hard caps on one cell: the broken caps, as "metric value > max". */
export function capViolations(cell: Cell): string[] {
  if (!cell.weight) return [];
  return HARD_CAPS.filter((cap) => !cap.at375 || cell.viewport.startsWith("375x"))
    .filter((cap) => cell.weight![cap.metric] > cap.max)
    .map((cap) => `${cap.metric} ${cell.weight![cap.metric]} > ${cap.max}`);
}

/* ── the sweep on disk ─────────────────────────────────────────────────────── */
const SWEEPS = path.resolve(__dirname, "..", "..", "sweeps");
const BASELINE_FILE = path.resolve(__dirname, "weight-baseline.json");

function newestWeightedSweep(): { file: string; cells: Cell[] } | null {
  if (!fs.existsSync(SWEEPS)) return null;
  const runs = fs.readdirSync(SWEEPS)
    .map((d) => path.join(SWEEPS, d, "sweep.json"))
    .filter((f) => fs.existsSync(f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const file of runs) {
    try {
      const cells = (JSON.parse(fs.readFileSync(file, "utf8")).cells ?? []) as Cell[];
      if (cells.some((c) => c.weight)) return { file, cells };
    } catch { /* an unreadable run is not evidence */ }
  }
  return null;
}

const sweep = newestWeightedSweep();
const baseline: Baseline | null = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) : null;
const ready = !!sweep && !!baseline;
const why = !sweep ? "no sweeps/*/sweep.json carries weight blocks yet (run the B-INF-06 sweep)" : "scripts/weight-baseline.json is absent (generate it with scripts/weight-baseline.mjs)";

describe.skipIf(!ready)(`B-INF-06 — the ratchet: no parent route gets heavier than the baseline${ready ? "" : ` [skipped: ${why}]`}`, () => {
  it(`the newest weighted sweep is no heavier than the baseline on any metric`, () => {
    expect(weightViolations(sweep!.cells, baseline!)).toEqual([]);
  });
});

describe.skipIf(!ready)(`B-INF-06 — hard caps on the redesigned routes${ready ? "" : ` [skipped: ${why}]`}`, () => {
  if (!ready) {
    it.skip(why, () => {});
    return;
  }
  for (const route of REDESIGNED) {
    for (const [key, base] of Object.entries(baseline!.cells).filter(([k]) => k.startsWith(`${route}|`))) {
      const [, viewport, lang] = key.split("|");
      for (const cap of HARD_CAPS.filter((c) => !c.at375 || viewport.startsWith("375x"))) {
        const label = `${key} ${cap.metric} ≤ ${cap.max}`;
        if (base[cap.metric] > cap.max) {
          // The measured baseline already breaks the cap: the cap is NOT loosened; the screen's
          // own item owes the fix. Recorded with the number.
          it.todo(`${label} — baseline measured ${base[cap.metric]} (screen owes the fix)`);
          continue;
        }
        it(label, () => {
          const cell = sweep!.cells.find((c) => isBase(c) && c.route === route && c.viewport === viewport && c.lang === lang);
          if (!cell) return; // not in this run
          expect(cell.weight![cap.metric]).toBeLessThanOrEqual(cap.max);
        });
      }
    }
  }
});

/* ── always runs: the ratchet itself ───────────────────────────────────────── */
describe("B-INF-06 — the ratchet mechanism (fixture)", () => {
  const w: Weight = { tappableAboveFold: 6, tappable: 20, textSizes: 4, under12: 0, uppercase: 0, gradients: 0, screens: 1.8 };
  const cell: Cell = { route: "journal", viewport: "375x812", lang: "en", state: "base", mounted: true, weight: w };
  const base: Baseline = { cells: { "journal|375x812|en": { ...w } } };

  it("passes on the baseline itself", () => {
    expect(weightViolations([cell], base)).toEqual([]);
    expect(capViolations(cell)).toEqual([]);
  });

  it("fails when the screen gains one upper-case label", () => {
    const heavier = { ...cell, weight: { ...w, uppercase: 1 } };
    expect(weightViolations([heavier], base)).toEqual(["journal|375x812|en uppercase: 1 > baseline 0"]);
    expect(capViolations(heavier)).toEqual(["uppercase 1 > 0"]);
  });

  it("a lighter screen passes; state cells and other routes are not compared", () => {
    expect(weightViolations([{ ...cell, weight: { ...w, tappable: 12, screens: 1.2 } }], base)).toEqual([]);
    expect(weightViolations([{ ...cell, state: "thread", weight: { ...w, uppercase: 9 } }], base)).toEqual([]);
    expect(weightViolations([{ ...cell, route: "learn", weight: { ...w, uppercase: 9 } }], base)).toEqual([]);
  });

  it("the tappable-above-the-fold cap applies at 375 only", () => {
    const busy = { ...w, tappableAboveFold: 9 };
    expect(capViolations({ ...cell, weight: busy })).toEqual(["tappableAboveFold 9 > 7"]);
    expect(capViolations({ ...cell, viewport: "1280x800", weight: busy })).toEqual([]);
  });

  it("every metric of the sweep's weight block is ratcheted", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "rendered-sweep.mjs"), "utf8");
    for (const m of METRICS) expect(src).toContain(m);
    expect(src).toMatch(/^\s+weight,$/m);
  });
});
