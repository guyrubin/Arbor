/**
 * TJB-16 — the plan board's primary move works on a phone, in both locales.
 *
 * `advance-plan-step` was drag-only (PointerSensor, activationConstraint
 * distance 4). The only other affordance was a 12x12 pencil at opacity 0 that
 * appeared on hover — there is no hover on a phone — and it opened
 * `window.prompt`. Delete opened `window.confirm`. Both are unstyled, untranslated,
 * unmirrored browser dialogs. The header carried a 43 % completion ring, the
 * focus card a 43 % bar, and the three column labels plus the one instruction
 * sentence were bare English literals a Hebrew-speaking parent still read in
 * English.
 *
 * The board is rendered here with the REAL dictionaries (only the two contexts
 * and the portal-based Modal are mocked), so the Hebrew assertions are against
 * the shipped strings rather than against a fixture. `renderToStaticMarkup` is
 * this repo's render harness — there is no jsdom in the suite, which is also why
 * the tap CYCLE itself is asserted against the exported NEXT_STATUS map and its
 * call site rather than by dispatching a click.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import type { ActionPlan, StepStatus } from "../../types";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawSrc = readFileSync(path.join(here, "PlanKanban.tsx"), "utf8");
/** Comments name the shapes that were removed; only live code is scanned. */
const src = rawSrc
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

let uiLang: "en" | "he" = "en";
const setPlanStepStatus = vi.fn();
const updatePlanStepText = vi.fn();
const deletePlan = vi.fn();

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ setPlanStepStatus, updatePlanStepText, deletePlan }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(uiLang, k, v) }),
}));
// Modal portals into document.body; the suite runs in node, and the dialog copy
// still has to be assertable, so it renders inline here.
vi.mock("../ui/Modal", () => ({
  Modal: ({ title, children }: { title?: string; children: React.ReactNode }) =>
    React.createElement("div", { "data-modal": title }, children),
}));

const { default: PlanKanban, NEXT_STATUS } = await import("./PlanKanban");

const step = (text: string, status: StepStatus) => ({ text, completed: status === "done", status });
const plan: ActionPlan = {
  id: "plan-1757000000000",
  title: "Calmer bedtimes",
  issue: "Bedtime resistance",
  phases: [
    { name: "Week 1", steps: [step("Dim the lights at 19:00", "done"), step("Same three books", "doing")] },
    { name: "Week 2", steps: [step("Move the bath earlier", "todo")] },
  ],
} as unknown as ActionPlan;

const render = (lang: "en" | "he") => {
  uiLang = lang;
  return renderToStaticMarkup(React.createElement(PlanKanban, { plan }));
};

beforeEach(() => {
  setPlanStepStatus.mockClear();
  updatePlanStepText.mockClear();
  deletePlan.mockClear();
});

describe("TJB-16 — the step control", () => {
  it("cycles not started → in progress → done → not started", () => {
    expect(NEXT_STATUS).toEqual({ todo: "doing", doing: "done", done: "todo" });
  });

  it("renders one always-visible 44 px control per step, labelled with step and status", () => {
    const html = render("en");
    const controls = html.match(/data-step-status="/g) ?? [];
    expect(controls.length, "one tap control per step").toBe(3);
    expect(html).toContain("min-width:var(--touch-min)");
    expect(html).toContain("Dim the lights at 19:00 — Done. Tap to move it on.");
    expect(html).toContain("Move the bath earlier — Not started. Tap to move it on.");
    // The pre-fix pencil was `opacity-0 group-hover:opacity-100`: invisible on a phone.
    expect(html).not.toContain("opacity-0");
  });

  it("the control's tap handler advances the step through the context writer", () => {
    expect(src).toContain("setPlanStepStatus(planId, item.phaseIdx, item.stepIdx, NEXT_STATUS[item.status])");
  });
});

describe("TJB-16 — counts, not a completion share", () => {
  it("the header reports steps done and the board prints no percentage", () => {
    const html = render("en");
    expect(html).toContain("1/3 steps done");
    expect(html, "no % anywhere on the board").not.toMatch(/\d\s*%/);
    expect(html).not.toContain("progressbar");
    expect(src, "the ProgressRing import is gone with the ring").not.toContain("ProgressRing");
  });

  it("negative control: the pre-fix ring and bar would have failed both rules", () => {
    const ring = '<ProgressRing value={pct} size={56}><span>{pct}%</span></ProgressRing>';
    expect(/\d\s*%/.test("43 %") && ring.includes("ProgressRing")).toBe(true);
  });
});

describe("TJB-16 — no browser dialogs", () => {
  it("edit and delete are Modals, not window.prompt / window.confirm", () => {
    expect(src).not.toMatch(/window\.(prompt|confirm)/);
    expect((src.match(/<Modal\b/g) ?? []).length, "one edit Modal and one delete Modal").toBe(2);
    const html = render("en");
    expect(html).toContain('data-modal="Edit step"');
    expect(html).toContain('data-modal="Delete plan"');
    // The edit Modal carries a LABELLED input, which window.prompt never did.
    expect(html).toContain('for="plan-step-text"');
    expect(html).toContain('id="plan-step-text"');
  });

  it("negative control: the pre-fix handlers are the exact shape this bans", () => {
    const pre = 'const t = window.prompt("Edit step", item.text);';
    const preDel = 'if (window.confirm(t("confirm.deletePlan", { title: plan.title }))) deletePlan(plan.id);';
    expect(/window\.(prompt|confirm)/.test(pre)).toBe(true);
    expect(/window\.(prompt|confirm)/.test(preDel)).toBe(true);
  });
});

describe("TJB-16 — both locales", () => {
  it("column labels, the hint and the dialogs are Hebrew in HE", () => {
    const html = render("he");
    for (const hebrew of ["טרם התחיל", "בתהליך", "הושלם", "הקישו על צעד כדי לקדם אותו", "עריכת צעד", "מחיקת תוכנית"]) {
      expect(html, `${hebrew} missing from the HE board`).toContain(hebrew);
    }
    for (const english of ["Not started", "In progress", "Drag steps between columns", "Focus Issue:"]) {
      expect(html, `${english} still bare English in HE`).not.toContain(english);
    }
  });

  it("negative control: the pre-fix column labels were untranslatable literals", () => {
    const pre = '{ status: "todo", label: "Not Started", tint: "text-[#69747f]" },';
    expect(pre).toContain('label: "Not Started"');
    expect(src, "labels now come from a key, not a literal").toContain("labelKey");
  });
});

describe("TJB-16 — tokens only (law 4)", () => {
  it("the board carries no raw hex or rgb literal", () => {
    const raw = src.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [];
    expect(raw, `raw colour literal(s) in PlanKanban.tsx: ${raw.join(", ")}`).toEqual([]);
  });

  it("negative control: the three literals that shipped are caught", () => {
    const pre = 'background: "#fff"; tint: "text-[#69747f]"; border: "1px solid rgba(52,178,119,0.50)"';
    expect((pre.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).length).toBe(3);
  });
});
