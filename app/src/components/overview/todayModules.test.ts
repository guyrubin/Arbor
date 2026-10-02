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
  lifecycle: true,
  changed: true,
  noticed: true,
  rail: true,
};

/** Every module the caller may actually request (the anchor is implicit). */
const OPTIONAL: TodayModuleId[] = ["lifecycle", "changed", "noticed", "rail"];

describe("Rule A module budget — resolveTodayModules", () => {
  it("never exceeds the budget, in ANY combination of wants", () => {
    for (let mask = 0; mask < 1 << OPTIONAL.length; mask++) {
      for (const noticedCanFold of [false, true]) {
        const wants: Partial<Record<TodayModuleId, boolean>> = {};
        OPTIONAL.forEach((id, i) => { wants[id] = Boolean(mask & (1 << i)); });
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

  it("B-TODAY-17: the budget is four, and the contract says so", () => {
    expect(TODAY_MODULE_BUDGET).toBe(4);
    // play is not a Today module any more (Daily Play renders only AS the step).
    expect(todayModulePriority({ noticedCanFold: true })).not.toContain("play" as TodayModuleId);
  });

  it("the audited state (returning + rail + noticed) fits in four, nothing cut", () => {
    // The audited shape, with NO lifecycle moment to say — the ordinary open.
    const plan = resolveTodayModules({ ...ALL, lifecycle: false }, { noticedCanFold: true });
    expect(plan.visible.size).toBe(4);
    expect(plan.visible.has("noticed")).toBe(true);
    expect(plan.demoted).toEqual([]);
  });

  it("ENG-09: a lifecycle moment holds a slot and costs the TAIL, never the What-changed card", () => {
    const plan = resolveTodayModules(ALL, { noticedCanFold: true });
    expect(plan.visible.size).toBe(TODAY_MODULE_BUDGET);
    expect(plan.visible.has("lifecycle")).toBe(true);
    // Everything it displaces still lands somewhere: the watch signal folds
    // into the What-changed card as a line (law 6).
    expect(plan.visible.has("changed")).toBe(true);
    expect(plan.visible.has("rail")).toBe(true);
    expect(plan.demoted).toEqual(["noticed"]);
  });

  it("ENG-09: the lifecycle module is optional — no moment, no slot", () => {
    const plan = resolveTodayModules({ ...ALL, lifecycle: false }, { noticedCanFold: true });
    expect(plan.visible.has("lifecycle")).toBe(false);
    expect(plan.demoted).not.toContain("lifecycle");
  });

  it("with no What-changed card to fold into, the watch signal keeps its slot", () => {
    const plan = resolveTodayModules({ ...ALL, changed: false }, { noticedCanFold: false });
    expect(plan.visible.has("noticed")).toBe(true);
    expect(plan.visible.size).toBeLessThanOrEqual(TODAY_MODULE_BUDGET);
    // Four wants incl. the anchor and a lifecycle moment: nothing is cut.
    expect(plan.demoted).toEqual([]);
    // Under a tighter budget the rail is cut before the watch signal.
    const tight = resolveTodayModules({ ...ALL, changed: false }, { budget: 3, noticedCanFold: false });
    expect(tight.visible.has("noticed")).toBe(true);
    expect(tight.demoted).toEqual(["rail"]);
  });

  it("at the real budget, a demoted watch signal ALWAYS has the What-changed card to fold into", () => {
    for (let mask = 0; mask < 1 << OPTIONAL.length; mask++) {
      const wants: Partial<Record<TodayModuleId, boolean>> = {};
      OPTIONAL.forEach((id, i) => { wants[id] = Boolean(mask & (1 << i)); });
      const plan = resolveTodayModules(wants, { noticedCanFold: wants.changed === true });
      if (plan.demoted.includes("noticed")) {
        expect(plan.visible.has("changed"), `mask ${mask}: watch signal demoted with nowhere to fold`).toBe(true);
      }
    }
  });

  it("without a fold target the watch signal is cut only after the rail", () => {
    // Forced demotion, no card to fold into: the cheap module must go first.
    const plan = resolveTodayModules({ ...ALL, changed: false }, { budget: 2, noticedCanFold: false });
    if (plan.demoted.includes("noticed")) {
      expect(plan.demoted).toContain("rail");
    }
    expect(todayModulePriority({ noticedCanFold: false }).indexOf("noticed"))
      .toBeLessThan(todayModulePriority({ noticedCanFold: false }).indexOf("rail"));
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
    // B-TODAY-17: no play module, no drawer — playSection renders only as the step.
    expect(overview).not.toMatch(/modulePlan\.visible\.has\("play"\)|showPlayInline|data-module="today-play"/);
    expect(overview.match(/\{playSection\}|^\s*playSection\s*$/gm) ?? []).toHaveLength(1);
    expect(overview).toMatch(/todayChoice\.kind === "play" \? \(\s*playSection/);
    expect(overview).toMatch(/foldNoticed\s*=\s*modulePlan\.demoted\.includes\("noticed"\)/);
    expect(overview).toMatch(/showChanged\s*=\s*modulePlan\.visible\.has\("changed"\)/);
    // ENG-09: the lifecycle module's real render condition is "the pure
    // resolver produced a moment for this open" — never a proxy for it.
    expect(overview).toMatch(/showLifecycle\s*=\s*modulePlan\.visible\.has\("lifecycle"\)/);
    expect(overview).toMatch(/lifecycle:\s*lifecycleMoment\s*!==\s*null/);
  });

  it("the hard-moment offer is not a sibling module (it lives inside the anchor)", () => {
    // Regression pin for the mis-modelling behind P1-B: HardMomentTodayOffer
    // renders in the anchor row's left column, so it never competed for a slot.
    const anchorStart = overview.indexOf('data-module="today-anchor"');
    // B-AI-06: it renders through the single-offer slot in that column
    // (B-TODAY-18: one slot instance, placed inside the anchor's left column).
    // B-TODAY-26: inside TodayContinuation the slot shares the place with the
    // day-close line (`… ? <DayCloseLine …/> : offerSlot}`).
    const placedAbove = overview.indexOf(": offerSlot}", anchorStart);
    const placedUnder = overview.indexOf("{!offerIsContinuation && offerSlot}", anchorStart);
    expect(anchorStart).toBeGreaterThan(-1);
    expect(placedAbove).toBeGreaterThan(anchorStart);
    expect(placedUnder).toBeGreaterThan(anchorStart);
  });
});

describe("P1-A firewall — nothing outranks the day's action", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
  const shell = stripComments(read("components/layout/Shell.tsx"));

  it("Shell no longer mounts the first-steps rail above the tab content", () => {
    expect(shell).not.toMatch(/<FirstStepsRail/);
    expect(shell).not.toMatch(/from ["'].*FirstStepsRail["']/);
  });

  it("the anchor precedes the What-changed card, the rail and every other module", () => {
    const anchor = overview.indexOf('data-module="today-anchor"');
    const after = [
      ["WhatChanged", overview.indexOf("<WhatChanged")],
      ["FirstStepsRail", overview.indexOf("<FirstStepsRail")],
      ["ArborNoticedCard", overview.indexOf("<ArborNoticedCard")],
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

describe("B-TODAY-26 — Tonight is the anchor, not a module", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
  it("Tonight renders inside the anchor's step slot and adds no TodayModuleId (no play module at 20:00)", () => {
    const anchor = overview.indexOf('data-module="today-anchor"');
    const tonight = overview.indexOf("<TonightCard");
    const changed = overview.indexOf('data-module="today-changed"');
    expect(tonight).toBeGreaterThan(anchor);
    expect(tonight).toBeLessThan(changed);
    expect(todayModulePriority({ noticedCanFold: true })).not.toContain("tonight" as TodayModuleId);
    expect(todayModulePriority({ noticedCanFold: true })).not.toContain("play" as TodayModuleId);
  });
});
