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
 *
 * B-INF-08 (29 Oct): My child (`development`) and Together (`practice`) are capped at 375 and
 * 1280 EN+HE; the capture sheet is measured open (`journal … capture-open`, weighed in its
 * dialog); `verdictTokens` (scripts/capture/verdict-tokens.mjs) must be 0 on every cell of a
 * capped route. B-INF-09: the chrome's own block (`chromeWeight`, over [data-chrome]) is capped
 * on every base cell. ARBOR_SWEEP_JSON=<sweep.json> points the suites at one run (a release
 * sweep written outside sweeps/).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Metric = "tappableAboveFold" | "tappable" | "textSizes" | "under12" | "uppercase" | "gradients" | "screens" | "verdictTokens";
type Weight = Partial<Record<Metric, number>> & Record<Exclude<Metric, "verdictTokens">, number>;
type ChromeMetric = "tappable" | "uppercase" | "gradients" | "under12" | "sub44";
type ChromeWeight = Record<ChromeMetric | "textSizes", number> & { regions?: string[] };
type Cell = { route: string; viewport: string; lang: string; state?: string; mounted?: boolean; weight?: Weight; chromeWeight?: ChromeWeight };
type Baseline = { generatedFrom?: string; cells: Record<string, Weight> };

const METRICS: Metric[] = ["tappableAboveFold", "tappable", "textSizes", "under12", "uppercase", "gradients", "screens", "verdictTokens"];
export const REDESIGNED = ["overview", "behaviors", "journal", "profile", "milestones", "consult", "development", "practice"] as const;
/** B-INF-08: named states weighed like a route (keyed route|viewport|lang|state). */
export const MEASURED_STATES = ["capture-open"] as const;
/** Hard caps; `at375` = the cap applies to the 375-wide cells only. */
export const HARD_CAPS: { metric: Metric; max: number; at375?: boolean }[] = [
  { metric: "tappableAboveFold", max: 7, at375: true },
  { metric: "textSizes", max: 4 },
  { metric: "under12", max: 0 },
  { metric: "uppercase", max: 0 },
  { metric: "gradients", max: 0 },
  { metric: "screens", max: 2 },
  { metric: "verdictTokens", max: 0 },
];
/**
 * B-INF-09 — the chrome's caps (P4 B-INF-09 What): ≤ 8 tappable, 0 upper case, 0 gradients,
 * 0 text under 12 px, 0 controls under 44 px. A cap the measured chrome breaks is a `todo`
 * naming the number and the decision that owns it — never a loosened cap.
 */
export const CHROME_CAPS: { metric: ChromeMetric; max: number }[] = [
  { metric: "tappable", max: 8 },
  { metric: "uppercase", max: 0 },
  { metric: "gradients", max: 0 },
  { metric: "under12", max: 0 },
  { metric: "sub44", max: 0 },
];
/** Measured 29 Oct (sweep at 1d763e2): the v3 chrome keeps doors P4 would remove. B-SHELL-35's
 *  open decision (Kid Mode in the strip/top bar; the sidebar's child row + profile edit) owns them. */
export const CHROME_KNOWN_OVER: Readonly<Record<string, Partial<Record<ChromeMetric, number>>>> = {
  "375x812": { tappable: 9 },
  "1280x800": { tappable: 12 },
};

/** Chrome caps on one base cell: the broken caps, as "chrome metric value > max". */
export function chromeCapViolations(cell: Cell): string[] {
  if (!cell.chromeWeight) return [];
  return CHROME_CAPS.filter((cap) => cell.chromeWeight![cap.metric] > cap.max).map((cap) => `chrome ${cap.metric} ${cell.chromeWeight![cap.metric]} > ${cap.max}`);
}

const stateOf = (c: Pick<Cell, "state">) => c.state ?? "base";
const keyOf = (c: Pick<Cell, "route" | "viewport" | "lang" | "state">) => `${c.route}|${c.viewport}|${c.lang}${stateOf(c) === "base" ? "" : `|${stateOf(c)}`}`;
/** A weighed cell: a mounted base cell, or a reached MEASURED_STATES cell. */
const isBase = (c: Cell) =>
  !!c.weight && c.mounted !== false && (stateOf(c) === "base" || (MEASURED_STATES as readonly string[]).includes(stateOf(c)));

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
  const pinned = process.env.ARBOR_SWEEP_JSON;
  if (pinned) {
    const cells = (JSON.parse(fs.readFileSync(pinned, "utf8")).cells ?? []) as Cell[];
    return cells.some((c) => c.weight) ? { file: pinned, cells } : null;
  }
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
        if ((base[cap.metric] ?? 0) > cap.max) {
          // The measured baseline already breaks the cap: the cap is NOT loosened; the screen's
          // own item owes the fix. Recorded with the number.
          it.todo(`${label} — baseline measured ${base[cap.metric]} (screen owes the fix)`);
          continue;
        }
        it(label, () => {
          const cell = sweep!.cells.find((c) => isBase(c) && keyOf(c) === key);
          if (!cell || typeof cell.weight![cap.metric] !== "number") return; // not in this run (or an older sweep)
          expect(cell.weight![cap.metric]).toBeLessThanOrEqual(cap.max);
        });
      }
    }
  }
});

describe.skipIf(!sweep)(`B-INF-09 — the chrome's caps on every base cell${sweep ? "" : " [skipped: no weighted sweep]"}`, () => {
  const viewports = [...new Set((sweep?.cells ?? []).filter((c) => stateOf(c) === "base" && c.chromeWeight).map((c) => c.viewport))];
  for (const viewport of viewports) {
    for (const cap of CHROME_CAPS) {
      const known = CHROME_KNOWN_OVER[viewport]?.[cap.metric];
      const label = `chrome ${viewport} ${cap.metric} ≤ ${cap.max}`;
      if (known !== undefined) {
        it.todo(`${label} — measured ${known} (B-SHELL-35 decision owns the doors)`);
        continue;
      }
      it(label, () => {
        const over = sweep!.cells.filter((c) => stateOf(c) === "base" && c.viewport === viewport && c.chromeWeight && c.chromeWeight[cap.metric] > cap.max);
        expect(over.map((c) => `${keyOf(c)} ${cap.metric} ${c.chromeWeight![cap.metric]}`)).toEqual([]);
      });
    }
    it(`chrome ${viewport}: a known overage never grows`, () => {
      for (const [metric, n] of Object.entries(CHROME_KNOWN_OVER[viewport] ?? {})) {
        const worst = Math.max(0, ...sweep!.cells.filter((c) => stateOf(c) === "base" && c.viewport === viewport && c.chromeWeight).map((c) => c.chromeWeight![metric as ChromeMetric]));
        expect(worst, `${viewport} chrome ${metric}`).toBeLessThanOrEqual(n as number);
      }
    });
  }
});

describe.skipIf(!sweep)(`B-INF-08 — no verdict on a capped route, in any cell${sweep ? "" : " [skipped: no weighted sweep]"}`, () => {
  it("verdictTokens is 0 on every My child and Together cell (base and states)", () => {
    const graded = (sweep?.cells ?? []).filter((c) => ["development", "practice"].includes(c.route) && (c.weight?.verdictTokens ?? 0) > 0);
    expect(graded.map(keyOf)).toEqual([]);
  });
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
    expect(src).toMatch(/^\s+chromeWeight,$/m);
  });
});

describe("B-INF-08 — the capped routes and the capture sheet (fixtures)", () => {
  const w: Weight = { tappableAboveFold: 6, tappable: 14, textSizes: 4, under12: 0, uppercase: 0, gradients: 0, screens: 1.5, verdictTokens: 0 };
  const child: Cell = { route: "development", viewport: "375x812", lang: "he", state: "base", mounted: true, weight: w };

  it("My child and Together are capped routes, the capture sheet a weighed state", () => {
    expect(REDESIGNED).toContain("development");
    expect(REDESIGNED).toContain("practice");
    expect(MEASURED_STATES).toContain("capture-open");
    const base = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) as Baseline;
    for (const route of ["development", "practice"]) for (const vp of ["375x812", "1280x800"]) for (const lang of ["en", "he"]) expect(base.cells[`${route}|${vp}|${lang}`], `${route} ${vp} ${lang}`).toBeTruthy();
    for (const vp of ["375x812", "1280x800"]) for (const lang of ["en", "he"]) expect(base.cells[`journal|${vp}|${lang}|capture-open`]).toBeTruthy();
  });

  it("fails when one count line lands on an area row of My child", async () => {
    const { verdictTextTokens } = await import("./capture/verdict-tokens.mjs");
    const row = ["Talking & understanding", "Last moment · 12 Oct"];
    expect(verdictTextTokens(row)).toBe(0);
    const counted = verdictTextTokens([...row, "Seen 3 of 12"]);
    expect(counted).toBe(1);
    expect(capViolations({ ...child, weight: { ...w, verdictTokens: counted } })).toEqual(["verdictTokens 1 > 0"]);
    // a count is not a verdict; a coverage denominator is not a verdict (13 Oct ruling)
    expect(verdictTextTokens(["31 seen", "Reviewed 28 of 44 for this age"])).toBe(0);
  });

  it("fails when the capture sheet's save button takes a gradient", () => {
    const sheet: Cell = { route: "journal", viewport: "375x812", lang: "en", state: "capture-open", mounted: true, weight: { ...w, gradients: 0 } };
    expect(capViolations(sheet)).toEqual([]);
    expect(capViolations({ ...sheet, weight: { ...w, gradients: 1 } })).toEqual(["gradients 1 > 0"]);
    expect(weightViolations([{ ...sheet, weight: { ...w, gradients: 2 } }], { cells: { "journal|375x812|en|capture-open": { ...w, gradients: 1 } } }))
      .toEqual(["journal|375x812|en|capture-open gradients: 2 > baseline 1"]);
  });

  it("an unmeasured state is not weighed; a measured one is", () => {
    const base: Baseline = { cells: { "journal|375x812|en|search": { ...w } } };
    expect(weightViolations([{ ...child, route: "journal", state: "search", weight: { ...w, uppercase: 3 } }], base)).toEqual([]);
  });
});

describe("B-INF-09 — the chrome's caps (fixtures)", () => {
  const chrome: ChromeWeight = { tappable: 8, textSizes: 3, under12: 0, uppercase: 0, gradients: 0, sub44: 0 };
  const cell: Cell = { route: "overview", viewport: "375x812", lang: "en", state: "base", mounted: true, chromeWeight: chrome };
  it("holds at the caps and names each broken one", () => {
    expect(chromeCapViolations(cell)).toEqual([]);
    expect(chromeCapViolations({ ...cell, chromeWeight: { ...chrome, tappable: 9, under12: 1, uppercase: 1 } })).toEqual(["chrome tappable 9 > 8", "chrome uppercase 1 > 0", "chrome under12 1 > 0"]);
  });
  it("the chrome regions are marked in source: dock, strip, sidebar, top bar", () => {
    const read = (f: string) => fs.readFileSync(path.resolve(__dirname, "..", "src", "components", "layout", f), "utf8");
    expect(read("MobileNav.tsx")).toContain('data-chrome="phone-dock"');
    expect(read("ChildContextHeader.tsx")).toContain('data-chrome="strip"');
    expect(read("Sidebar.tsx")).toContain('data-chrome="sidebar"');
    expect(read("Topbar.tsx")).toContain('data-chrome="topbar"');
  });
});
