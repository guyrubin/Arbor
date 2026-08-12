import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  TODAY_MODULE_BUDGET,
  resolveTodayModules,
  todayModulePriority,
  type TodayModuleId,
} from "./todayModules";

/**
 * W1 Rule A — Today renders MAX 5 modules and EXACTLY ONE primary action above
 * the fold (masterplan ARBOR-UI-MASTERPLAN-2026-08-11 §1).
 *
 * P1-B (2026-08-12 visual audit): the first implementation computed the budget
 * from `hardMomentWould`, a proxy that resolves through the GD-10-gated
 * `publishedHardMomentCards`. That array is empty by governance, so the proxy
 * was permanently false, the fold never engaged, and Today shipped SIX sibling
 * modules. The behavioural tests below pin the budget arithmetic; the
 * source-scan block at the bottom pins the RULE that produced the defect —
 * the budget may never consult a content-publish gate.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ALL: Record<TodayModuleId, boolean> = {
  anchor: true,
  since: true,
  noticed: true,
  narrative: true,
  rail: true,
  play: true,
};

describe("Rule A module budget — resolveTodayModules", () => {
  it("never exceeds the budget, in ANY combination of wants", () => {
    const optional: TodayModuleId[] = ["since", "noticed", "narrative", "rail", "play"];
    for (let mask = 0; mask < 1 << optional.length; mask++) {
      for (const noticedCanFold of [false, true]) {
        const wants: Partial<Record<TodayModuleId, boolean>> = {};
        optional.forEach((id, i) => { wants[id] = Boolean(mask & (1 << i)); });
        const plan = resolveTodayModules(wants, { noticedCanFold });
        expect(plan.visible.size, `mask ${mask} fold=${noticedCanFold}`).toBeLessThanOrEqual(TODAY_MODULE_BUDGET);
        // Nothing is invented, nothing is lost.
        for (const id of plan.visible) if (id !== "anchor") expect(wants[id]).toBe(true);
        for (const id of plan.demoted) expect(wants[id]).toBe(true);
      }
    }
  });

  it("the primary-action anchor always holds a slot (it IS the screen)", () => {
    expect(resolveTodayModules({}).visible.has("anchor")).toBe(true);
    expect(resolveTodayModules(ALL, { noticedCanFold: true }).visible.has("anchor")).toBe(true);
    expect(resolveTodayModules(ALL, { budget: 1, noticedCanFold: true }).visible.has("anchor")).toBe(true);
  });

  it("the audited state (returning + rail + noticed + narrative + play) fits in five", () => {
    const plan = resolveTodayModules(ALL, { noticedCanFold: true });
    expect(plan.visible.size).toBe(5);
    // The watch signal degrades by FOLDING into the since-strip row — the only
    // demotion here that keeps the parent informed.
    expect(plan.demoted).toEqual(["noticed"]);
    expect(plan.visible.has("since")).toBe(true);
    expect(plan.visible.has("play")).toBe(true);
  });

  it("with no strip to fold into, the watch signal keeps its slot and play is cut instead", () => {
    const plan = resolveTodayModules({ ...ALL, since: false }, { noticedCanFold: false });
    expect(plan.visible.has("noticed")).toBe(true);
    expect(plan.visible.size).toBeLessThanOrEqual(TODAY_MODULE_BUDGET);
    // Five wants incl. the anchor — everything fits, nothing is demoted.
    expect(plan.demoted).toEqual([]);
  });

  it("at the real budget, a demoted watch signal ALWAYS has a strip to fold into", () => {
    const optional: TodayModuleId[] = ["since", "noticed", "narrative", "rail", "play"];
    for (let mask = 0; mask < 1 << optional.length; mask++) {
      const wants: Partial<Record<TodayModuleId, boolean>> = {};
      optional.forEach((id, i) => { wants[id] = Boolean(mask & (1 << i)); });
      const plan = resolveTodayModules(wants, { noticedCanFold: wants.since === true });
      if (plan.demoted.includes("noticed")) {
        expect(plan.visible.has("since"), `mask ${mask}: watch signal demoted with nowhere to fold`).toBe(true);
      }
    }
  });

  it("without a fold target the watch signal is cut only after rail and play", () => {
    // Forced demotion, no strip: the cheap modules must go first.
    const plan = resolveTodayModules({ ...ALL, since: false }, { budget: 2, noticedCanFold: false });
    if (plan.demoted.includes("noticed")) {
      expect(plan.demoted).toContain("rail");
      expect(plan.demoted).toContain("play");
    }
    expect(todayModulePriority({ noticedCanFold: false }).indexOf("noticed"))
      .toBeLessThan(todayModulePriority({ noticedCanFold: false }).indexOf("rail"));
    expect(todayModulePriority({ noticedCanFold: false }).indexOf("noticed"))
      .toBeLessThan(todayModulePriority({ noticedCanFold: false }).indexOf("play"));
  });

  it("day-0 (anchor + rail only) sits far under the budget", () => {
    const plan = resolveTodayModules({ rail: true });
    expect([...plan.visible].sort()).toEqual(["anchor", "rail"]);
    expect(plan.demoted).toEqual([]);
  });

  it("both priority orders list every module exactly once, anchor first", () => {
    for (const noticedCanFold of [false, true]) {
      const order = todayModulePriority({ noticedCanFold });
      expect(order[0]).toBe("anchor");
      expect(new Set(order).size).toBe(order.length);
      expect([...order].sort()).toEqual([...Object.keys(ALL)].sort());
    }
  });
});

describe("P1-B firewall — the budget counts modules, never a governance gate", () => {
  const budget = stripComments(read("components/overview/todayModules.ts"));
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));

  it("the budget module imports nothing (pure arithmetic, no content gates)", () => {
    expect(budget).not.toMatch(/^\s*import\s/m);
  });

  it("no governance/publish-gated symbol can reach the budget math", () => {
    // These all resolve through isPublishableContent → an array a reviewer can
    // empty. A governed array going empty may change what a module SAYS; it may
    // never change how many modules Today is allowed to show.
    const gated = [
      /publishedHardMomentCards/,
      /isPublishableContent/,
      /todayHardMomentOffer/,
      /reviewStatus/,
      /isRenderableMilestoneMedia/,
    ];
    for (const re of gated) {
      expect(budget, `todayModules.ts must not reference ${re}`).not.toMatch(re);
      expect(overview, `OverviewTab must not reference ${re}`).not.toMatch(re);
    }
  });

  it("OverviewTab feeds the budget its modules' REAL render conditions", () => {
    // The rail's own visibility hook, not a guess about it.
    expect(overview).toMatch(/useFirstStepsRail\(\)\.visible/);
    // Every render gate reads back out of the resolved plan.
    expect(overview).toMatch(/resolveTodayModules\(/);
    expect(overview).toMatch(/modulePlan\.visible\.has\("rail"\)/);
    expect(overview).toMatch(/modulePlan\.visible\.has\("noticed"\)/);
    expect(overview).toMatch(/modulePlan\.visible\.has\("narrative"\)/);
    expect(overview).toMatch(/showPlayInline\s*=\s*modulePlan\.visible\.has\("play"\)/);
    expect(overview).toMatch(/foldNoticed\s*=\s*modulePlan\.demoted\.includes\("noticed"\)/);
    expect(overview).toMatch(/showSinceStrip\s*=\s*modulePlan\.visible\.has\("since"\)/);
  });

  it("the hard-moment offer is not a sibling module (it lives inside the anchor)", () => {
    // Regression pin for the mis-modelling behind P1-B: HardMomentTodayOffer
    // renders in the anchor row's left column, so it never competed for a slot.
    const anchorStart = overview.indexOf('lg:grid-cols-[1.85fr_0.85fr]');
    const offer = overview.indexOf("<HardMomentTodayOffer");
    expect(anchorStart).toBeGreaterThan(-1);
    expect(offer).toBeGreaterThan(anchorStart);
  });
});

describe("P1-A firewall — nothing outranks the day's action", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
  const shell = stripComments(read("components/layout/Shell.tsx"));

  it("Shell no longer mounts the first-steps rail above the tab content", () => {
    expect(shell).not.toMatch(/<FirstStepsRail/);
    expect(shell).not.toMatch(/from ["'].*FirstStepsRail["']/);
  });

  it("the anchor row precedes the since-strip, the rail and every other module", () => {
    const anchor = overview.indexOf('lg:grid-cols-[1.85fr_0.85fr]');
    const after = [
      ["SinceLastVisit", overview.indexOf("<SinceLastVisit")],
      ["FirstStepsRail", overview.indexOf("<FirstStepsRail")],
      ["ArborNoticedCard", overview.indexOf("<ArborNoticedCard")],
      ["ProgressNarrative", overview.indexOf("<ProgressNarrative")],
    ] as const;
    expect(anchor).toBeGreaterThan(-1);
    for (const [name, idx] of after) {
      expect(idx, `${name} must render after the anchor row`).toBeGreaterThan(anchor);
    }
  });

  it("Today mounts the rail itself, so it counts against the budget", () => {
    expect(overview).toMatch(/import FirstStepsRail, \{ useFirstStepsRail \}/);
  });
});
