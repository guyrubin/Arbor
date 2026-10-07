import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { TODAY_MODULE_BUDGET, planToday, type TodayModuleId, type TodayPlanInput } from "./todayModules";
import { contractFor } from "../../lib/surfaceContract";

/**
 * B-LOOP-07 — Today = three blocks (practice · notice · tonight); the door is
 * chrome. Re-pinned from the Rule-A v2 budget (anchor/lifecycle/changed/
 * noticed/rail, budget 4): the budget is now THREE in every state, the door
 * is never counted, `lifecycle` (and changed/noticed/rail) can never be a
 * sibling module — they live behind the door. P1-B's rule stands: the plan is
 * fed each block's REAL render condition, never a content-publish gate.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const STATES: Record<string, TodayPlanInput> = {
  morning: { evening: false, practice: true, notice: true, tonight: true },
  evening: { evening: true, practice: true, notice: true, tonight: true, practiceAnswered: true },
  eveningUnanswered: { evening: true, practice: true, notice: true, tonight: true, practiceAnswered: false },
  noPractice: { evening: false, practice: false, notice: true, tonight: true },
  firstOpen: { evening: false, practice: true, notice: true, tonight: false },
  returningAfter10Days: { evening: false, practice: true, notice: true, tonight: true },
};

describe("todayModules v3 — planToday", () => {
  it("at most three modules render in every state, in ANY combination of inputs; the door is never counted", () => {
    for (let mask = 0; mask < 32; mask++) {
      const input: TodayPlanInput = {
        evening: !!(mask & 1), practice: !!(mask & 2), notice: !!(mask & 4), tonight: !!(mask & 8), practiceAnswered: !!(mask & 16),
      };
      const plan = planToday(input);
      expect(plan.order.length).toBeLessThanOrEqual(TODAY_MODULE_BUDGET);
      expect(plan.order).not.toContain("door" as TodayModuleId);
      expect(new Set(plan.order).size).toBe(plan.order.length);
    }
    for (const [name, s] of Object.entries(STATES)) expect(planToday(s).order.length, name).toBeLessThanOrEqual(3);
  });

  it("morning: practice → notice, Tonight as ONE pointer line (not a module)", () => {
    expect(planToday(STATES.morning)).toEqual({ order: ["practice", "notice"], tonightPointer: true, practiceMode: "card" });
  });

  it("evening: tonight → notice; the morning receipt never sits under the open flow (critic c2 r1)", () => {
    expect(planToday(STATES.evening)).toEqual({ order: ["tonight", "notice"], tonightPointer: false, practiceMode: null });
    expect(planToday(STATES.eveningUnanswered).order).toEqual(["tonight", "notice"]);
    const tab = stripComments(read("components/tabs/OverviewTab.tsx"));
    expect(tab).not.toMatch(/PracticeOutcomeStrip|practiceMode === "outcome"/);
    // the story is ONE door line at night, never a line under the Tonight card
    expect(tab).toContain('{evening && storyFits && doorLine("today-door-story"');
    expect(tab.slice(tab.indexOf("<TonightFlow"), tab.indexOf("/>", tab.indexOf("<TonightFlow")))).not.toMatch(/onStory=/);
  });

  it("c2 r2 P1-2: an evening that never SHOWED the practice offers it (tonight mode) with Tonight as the pointer — never 'Did you try it?' first", () => {
    expect(planToday({ ...STATES.eveningUnanswered, practiceShown: false })).toEqual({ order: ["practice", "notice"], tonightPointer: true, practiceMode: "tonight" });
    // shown (dose row / pin / day impression / pointer opened) → the flow asks
    expect(planToday({ ...STATES.eveningUnanswered, practiceShown: true }).order).toEqual(["tonight", "notice"]);
    // the morning is unchanged by the flag
    expect(planToday({ ...STATES.morning, practiceShown: false })).toEqual(planToday(STATES.morning));
    // the container feeds the flag from the dose, the pin, the day impression and the pointer — and records the impression in day mode only
    const tab = stripComments(read("components/tabs/OverviewTab.tsx"));
    expect(tab).toMatch(/practiceShown\s*=\s*!!dose \|\| tonightEarly \|\| !!readTodayPin\(/);
    expect(tab).toMatch(/plan\.practiceMode === "card"[\s\S]{0,200}markPracticeShown\(/);
  });

  it("nothing invented: a block renders only when its input says it would", () => {
    expect(planToday({ evening: false, practice: false, notice: false, tonight: false }).order).toEqual([]);
    expect(planToday(STATES.noPractice).order).toEqual(["notice"]);
  });

  it("lifecycle / changed / noticed / rail are not module ids (they live behind the door)", () => {
    const src = stripComments(read("components/overview/todayModules.ts"));
    expect(src).toMatch(/export type TodayModuleId = "practice" \| "notice" \| "tonight" \| "door";/);
    for (const old of ["lifecycle", "changed", "noticed", "rail", "anchor"]) expect(src).not.toContain(`"${old}"`);
  });

  it("the budget is three and the contract says so (Law 7: contract and stamp move together)", () => {
    expect(TODAY_MODULE_BUDGET).toBe(3);
    const c = contractFor("overview");
    expect(c?.moduleBudget).toBe(TODAY_MODULE_BUDGET);
    expect(c?.primaryMove).toBe("do-practice");
    const ov = stripComments(read("components/tabs/OverviewTab.tsx"));
    expect(ov.match(/data-primary-move/g)?.length).toBe(1);
    // P5 design r1 P0-1: the prop form — one literal, placed on the answers.
    expect(ov).toContain('"data-primary-move": "do-practice"');
  });

  it("P1-B: the plan never consults a content-publish gate", () => {
    const src = stripComments(read("components/overview/todayModules.ts"));
    expect(src).not.toMatch(/isPublishable|publishedHardMomentCards|hardMomentPublication|reviewStatus/);
  });
});
