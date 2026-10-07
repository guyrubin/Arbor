/**
 * B-ASKJB-35 (b) + (c) — a plan starts with something to DO tomorrow.
 *  · today's step (lib/plans todaysPlanStep) is the first ACT, never an
 *    observation step (Guy's live plan: "Observe and log specific triggers…");
 *  · the step list shows the act first (PlanSteps, display only);
 *  · the Plans page: ONE active plan with today's step as the single primary
 *    move, the others in one disclosure, the "What to say" block collapsed,
 *    no "signs it's working" list (one line "Arbor will ask how it went"),
 *    no upper-case labels, nothing under 12 px in the create card.
 * Weight at 375 (≤ 7 tappable above the fold, ≤ 4 text sizes) is rendered —
 * the validator's (B-INF-06 caps).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { todaysPlanStep } from "../../lib/plans";
import { translate } from "../../lib/i18n";
import type { ActionPlan } from "../../types";

const LIVE = "Observe and log specific triggers and behaviors during morning departures for 3 days";
const plan = (steps: string[][]): ActionPlan => ({
  id: "plan-1",
  title: "Morning Departure Support Plan",
  issue: "mornings",
  phases: steps.map((s, i) => ({ name: `Phase ${i + 1}`, description: "", steps: s.map((text) => ({ text, completed: false })) })),
  scripts: [],
  successIndicators: ["Leaves without crying"],
} as unknown as ActionPlan);

describe("B-ASKJB-35 (b) · today's step is an act", () => {
  it("the live plan: the observe step does not lead; the act does, with its address unchanged", () => {
    const step = todaysPlanStep(plan([[LIVE, "Say 'First shoes, then car' at the door and hand him one shoe"]]), [], "2026-10-07")!;
    expect(step.text).toMatch(/^Say 'First shoes/);
    expect([step.phaseIdx, step.stepIdx]).toEqual([0, 1]);
    expect(step.next?.text).toBe(LIVE);
  });
  it("a phase of observation only → the first act of the next phase leads", () => {
    const step = todaysPlanStep(plan([[LIVE, "Track bedtime"], ["Lay out clothes the night before"]]), [], "2026-10-07")!;
    expect(step.text).toBe("Lay out clothes the night before");
    expect([step.phaseIdx, step.stepIdx]).toEqual([1, 0]);
  });
  it("an act first → unchanged; observation only → unchanged (nothing to promote)", () => {
    expect(todaysPlanStep(plan([["Sing the shoe song", LIVE]]), [], "2026-10-07")!.text).toBe("Sing the shoe song");
    expect(todaysPlanStep(plan([[LIVE]]), [], "2026-10-07")!.text).toBe(LIVE);
  });
});

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("B-ASKJB-35 (c) · the Plans page", () => {
  const tab = read("tabs/PlansTab.tsx");
  const card = read("plans/PlanTrackCard.tsx");
  const steps = read("plans/PlanSteps.tsx");
  it("one active plan; the others in ONE disclosure; the scripts collapsed", () => {
    expect(tab).toContain("if (planIdx > 0) return null;");
    expect(tab).toContain('data-testid="plans-others"');
    expect(tab).toContain('data-testid="plan-scripts"');
    expect(tab.match(/"data-primary-move": "advance-plan-step"/g)).toHaveLength(1);
  });
  it("no signs-it's-working list on the parent surface; one 'Arbor will ask' line", () => {
    expect(card).not.toMatch(/successIndicators\.map/);
    expect(card).toContain('t("elev.words.plans.willAsk")');
    expect(translate("en", "elev.words.plans.willAsk")).toBe("Arbor will ask how it went.");
    expect(translate("he", "elev.words.plans.willAsk")).toBe("ארבור תשאל איך זה הלך.");
  });
  it("the step list renders act-first; no upper-case labels and nothing under 12 px on the page", () => {
    expect(steps).toContain("demoteObservationSteps(items.filter((i) => i.phaseIdx === phaseIdx))");
    expect(tab).not.toMatch(/\buppercase\b/);
    expect(tab).not.toMatch(/text-\[(?:10|11)px\]/);
  });
});
