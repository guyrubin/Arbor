/**
 * v3 FEAT-07 — a routine plan in the step list (PlanSteps).
 *
 * On #/plans the active routine plan shows its RoutineRunBoard beside this
 * list; the board already says today's counts and the days every step ran
 * (from the live run), so the list beside it (`beside="board"`) carries
 * neither line: one count per screen, never two that can disagree mid-write.
 * In "other plans" (no board) a routine plan keeps its compact lines. The days
 * line counts only the last two weeks, at display time, even before a write
 * prunes older runs.
 *
 * Rendered with the REAL dictionaries (only the two contexts and the portal
 * Modal are mocked), in both languages. Invented plans only.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { routineById } from "../../lib/routines";
import { routineToPlan } from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";

const here = path.dirname(fileURLToPath(import.meta.url));
let uiLang: "en" | "he" = "en";

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ setPlanStepStatus: () => undefined, updatePlanStepText: () => undefined, deletePlan: () => undefined }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(uiLang, k, v) }),
}));
vi.mock("../ui/Modal", () => ({
  Modal: ({ title, children }: { title?: string; children: React.ReactNode }) =>
    React.createElement("div", { "data-modal": title }, children),
}));

const { default: PlanSteps } = await import("./PlanSteps");

const NOW = new Date(2026, 9, 12, 9, 30).getTime(); // 12 Oct 2026, local morning
const TODAY = "2026-10-12";
const FULL = [0, 1, 2, 3, 4]; // the morning routine has five steps
const morning = (runs: Record<string, number[]>): ActionPlan => ({
  ...routineToPlan(routineById("morning"), "en", "Noa", NOW - 5 * 86_400_000),
  routineRuns: runs,
});
const render = (plan: ActionPlan, lang: "en" | "he", beside?: "board") => {
  uiLang = lang;
  return renderToStaticMarkup(React.createElement(PlanSteps, { plan, now: NOW, beside }));
};

for (const lang of ["en", "he"] as const) describe(`FEAT-07 · a routine plan in the step list · ${lang}`, () => {
  const plan = morning({ [TODAY]: [0, 1], "2026-10-11": FULL });

  it("beside the board, the header carries no run counts (the board says them)", () => {
    const html = render(plan, lang, "board");
    expect(html).not.toContain('data-testid="plan-routine-today"');
    expect(html).not.toContain('data-testid="plan-routine-days"');
    expect(html).not.toContain(translate(lang, "elev.plans.routineRun.today", { done: 2, left: 3 }));
    // Title, delete and the folded edit list stay; no step cycles here.
    expect(html).toContain('data-testid="plan-routine-steps"');
    expect(html).not.toContain("data-step-status");
  });

  it("in the other plans (no board), it keeps the compact today and days lines", () => {
    const html = render(plan, lang);
    expect(html).toContain('data-testid="plan-routine-today"');
    expect(html).toContain(translate(lang, "elev.plans.routineRun.today", { done: 2, left: 3 }));
    expect(html).toContain('data-testid="plan-routine-days"');
    expect(html).toContain(translate(lang, "elev.plans.routineRun.days.one"));
    expect(html).not.toContain("data-step-status");
  });

  it("full runs 20–30 days old never print 'in the last two weeks', even before a write prunes them", () => {
    const stale = morning({ "2026-09-12": FULL, "2026-09-17": FULL, "2026-09-22": FULL });
    const html = render(stale, lang);
    expect(html).not.toContain('data-testid="plan-routine-days"');
    expect(html).toContain(translate(lang, "elev.plans.routineRun.today", { done: 0, left: 5 }));
  });
});

describe("FEAT-07 · #/plans shows the run counts once", () => {
  it("only the active routine plan's list sits beside the board", () => {
    const tab = readFileSync(path.join(here, "..", "tabs", "PlansTab.tsx"), "utf8");
    expect(tab.match(/beside="board"/g)).toHaveLength(1);
    expect(tab).toContain('<PlanSteps plan={plan} now={now} beside="board" />');
  });
});
