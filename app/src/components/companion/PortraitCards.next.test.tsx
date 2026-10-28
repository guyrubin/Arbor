import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ActionPlan } from "../../types";

/* B-GROWTH-40 — My child's focus line ("What we're working on", the goal card
   in PortraitCards) shows "Next: {step}" from the plan started for that goal:
   ONE line inside the existing card, EN + HE; nothing without a linked plan. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  plans: [] as ActionPlan[],
  goals: [] as { goalId: string; label: string; domainId: string; addedAt: string }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Noa", gender: "girl", activeGoals: state.goals },
  openCaptureSheet: vi.fn(), actionPlans: state.plans,
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../describe/TellArborMore", () => ({ default: () => null }));

import PortraitCards from "./PortraitCards";
import { readFileSync } from "node:fs";
import path from "node:path";

const GOAL = { goalId: "taking-turns", label: "Taking turns", domainId: "social", addedAt: "2026-10-05T00:00:00Z" };
const plan = (id: string, focusGoalId: string | undefined, steps: { text: string; completed: boolean }[]): ActionPlan => ({
  id, title: id, issue: "", scripts: [], successIndicators: [], phases: [{ name: "One", description: "", steps }], ...(focusGoalId ? { focusGoalId } : {}),
});
const render = () => renderToStaticMarkup(<PortraitCards sources={{ behaviorLogs: [] } as never} onEditGoal={() => undefined} />);
const goalCard = (html: string) => html.slice(html.indexOf('data-testid="portrait-goals-edit"'));

describe("B-GROWTH-40 · My child's focus line says what to do next", () => {
  it.each([
    ["en", "Next: ", "Roll the ball back and forth"],
    ["he", "הצעד הבא: ", "מגלגלים כדור הלוך ושוב"],
  ] as const)("%s: one Next line inside the goal card, from the plan linked to the goal", (lang, prefix, text) => {
    state.lang = lang;
    state.goals = [GOAL];
    state.plans = [plan("plan-2", "taking-turns", [{ text: "Say whose turn it is", completed: true }, { text, completed: false }])];
    const html = render();
    const card = goalCard(html);
    expect(card.match(/data-testid="portrait-goal-next"/g)).toHaveLength(1);
    expect(card.replace(/[⁦-⁩]/g, "")).toContain(`${prefix}${text}`);
    expect(card).not.toContain("Say whose turn it is");
    // The line lives inside the one card: the count of portrait cards is unchanged.
    expect(html.match(/class="portrait-card[ "]/g)).toHaveLength(3);
  });

  it("no plan linked to the goal (older plans, no backfill) → no Next line", () => {
    state.lang = "en";
    state.goals = [GOAL];
    state.plans = [plan("plan-1", undefined, [{ text: "An older plan's step", completed: false }])];
    expect(render()).not.toContain("portrait-goal-next");
    state.plans = [plan("plan-3", "early-talking", [{ text: "Another goal's step", completed: false }])];
    expect(render()).not.toContain("portrait-goal-next");
  });

  it("no goal → no Next line, even with a linked plan", () => {
    state.lang = "en";
    state.goals = [];
    state.plans = [plan("plan-2", "taking-turns", [{ text: "x", completed: false }])];
    expect(render()).not.toContain("portrait-goal-next");
  });
});

describe("B-GROWTH-40 · the Next line reads whole (critic r1)", () => {
  it("clamps at two lines, never a one-line mid-word ellipsis", () => {
    const css = readFileSync(path.resolve(__dirname, "developmentMap.css"), "utf8");
    const rule = css.match(/\.portrait-card-next \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/-webkit-line-clamp: 2/);
    expect(rule).toMatch(/-webkit-box-orient: vertical/);
    expect(rule).not.toMatch(/white-space: nowrap/);
    // NEGATIVE CONTROL: the r1 rule is what this rejects.
    expect("overflow: hidden; text-overflow: ellipsis; white-space: nowrap;").toMatch(/white-space: nowrap/);
  });
});
