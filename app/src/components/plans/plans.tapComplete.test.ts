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
// B-ASKJB-26: PlanKanban became PlanSteps (one step list); the TJB-16 guards carry over.
const rawSrc = readFileSync(path.join(here, "PlanSteps.tsx"), "utf8");
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

const { default: PlanSteps, NEXT_STATUS } = await import("./PlanSteps");

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
  return renderToStaticMarkup(React.createElement(PlanSteps, { plan, now: 1757000000000 + 3 * 86_400_000 }));
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
    for (const hebrew of ["טרם התחיל", "בתהליך", "הושלם", "הקישו על העיגול של צעד כדי לקדם אותו", "עריכת צעד", "מחיקת תוכנית"]) {
      expect(html, `${hebrew} missing from the HE board`).toContain(hebrew);
    }
    for (const english of ["Not started", "In progress", "Drag steps between columns", "Focus Issue:"]) {
      expect(html, `${english} still bare English in HE`).not.toContain(english);
    }
  });

  it("negative control: the pre-fix column labels were untranslatable literals", () => {
    const pre = '{ status: "todo", label: "Not Started", tint: "text-[#69747f]" },';
    expect(pre).toContain('label: "Not Started"');
    expect(src, "labels now come from a key, not a literal").toContain('todo: "elev.plans.col.todo"');
  });
});

describe("B-ASKJB-26 — one step list, no drag, 'Started {n} days ago'", () => {
  it("the Kanban columns and the drag layer are gone; each row keeps the tap-cycle and a status chip", () => {
    expect(src).not.toContain("@dnd-kit");
    expect(src).not.toContain("useDraggable");
    const html = render("en");
    expect((html.match(/data-plan-step="/g) ?? []).length).toBe(3);
    expect(html).toContain("In progress"); // the status chip on the "doing" row
    expect(html).toContain("Started 3 days ago");
    expect(html).not.toContain("days running");
  });

  it("HE: started line and hint in Hebrew", () => {
    const html = render("he");
    expect(html).toContain("התחלתם לפני");
    expect(html).not.toContain("Started");
  });
});

describe("TJB-16 — tokens only (law 4)", () => {
  it("the board carries no raw hex or rgb literal", () => {
    const raw = src.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [];
    expect(raw, `raw colour literal(s) in PlanSteps.tsx: ${raw.join(", ")}`).toEqual([]);
  });

  it("negative control: the three literals that shipped are caught", () => {
    const pre = 'background: "#fff"; tint: "text-[#69747f]"; border: "1px solid rgba(52,178,119,0.50)"';
    expect((pre.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).length).toBe(3);
  });
});

/**
 * Critic r1 (W2-ASKJB plans). The step list and the track card:
 *  · one icon family (Material Symbols), no lucide;
 *  · type from the --t-* scale only (no text-[Npx], no text-xs/xl in these files);
 *  · content nodes carry dir="auto"; the eyebrow isolates the plan title in <bdi>
 *    and is never upper-cased;
 *  · today's row says "Today" (clay), never "Not started";
 *  · the contract stamp lands on a BUTTON (≤ one control), never a wrapper;
 *  · "Day n" only from Day 2.
 */
describe("critic r1 — plans track card + step list", async () => {
  const { default: PlanTrackCard } = await import("./PlanTrackCard");
  const { planEyebrowKey } = await import("../../lib/plans");
  const trackSrc = readFileSync(path.join(here, "PlanTrackCard.tsx"), "utf8");
  const plansTab = readFileSync(path.join(here, "..", "tabs", "PlansTab.tsx"), "utf8");
  const stamp = { "data-primary-move": "advance-plan-step", style: { background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)" } } as const;
  const today = { planId: plan.id, phaseIdx: 0, stepIdx: 1, text: "Same three books.", day: 1, next: null, offerNext: false };
  const card = (lang: "en" | "he", day = 1) => renderToStaticMarkup(React.createElement(PlanTrackCard, {
    plan, step: { ...today, day }, today: null, lang, now: 1757000000000, primary: stamp,
    onTryIt: () => {}, onUndo: () => {}, onCheck: () => {}, onAdjust: () => {},
  }));

  it("one icon family and the --t-* scale only", () => {
    for (const f of [rawSrc, trackSrc]) {
      expect(f).not.toMatch(/lucide-react/);
      expect(f).not.toMatch(/text-\[\d+(\.\d+)?px\]/);
    }
    expect(src).not.toMatch(/className="[^"]*\btext-(xs|xl)\b[^"]*"[^>]*>\{(plan\.title|t\("elev\.plans)/);
  });

  it("Day n only from Day 2; Day 1 reads Today's step", () => {
    expect(planEyebrowKey(1)).toBe("elev.plans.today.first");
    expect(planEyebrowKey(2)).toBe("elev.plans.today.day");
    expect(card("en", 1)).toContain("Today&#x27;s step");
    expect(card("en", 1)).not.toMatch(/Day 1 of/);
    expect(card("en", 3)).toMatch(/Day .*3.* of/);
  });

  it("the eyebrow isolates the title in <bdi>, never upper-case; step text dir=auto (HE)", () => {
    const he = card("he");
    expect(he).toMatch(/<p data-testid="plan-today-eyebrow"[^>]*>[^<]*<bdi dir="auto">Calmer bedtimes<\/bdi>/);
    expect(he).not.toMatch(/plan-today-eyebrow"[^>]*uppercase/);
    expect(he).toMatch(/<p dir="auto"[^>]*>Same three books\.<\/p>/);
    expect(he).not.toContain("\u0000");
  });

  it("the stamp + primary fill sit on the 'I'll try it' button", () => {
    const html = card("en");
    expect(html).toMatch(/<button type="button" data-primary-move="advance-plan-step"[^>]*gradient-primary/);
    expect((html.match(/data-primary-move=/g) || []).length).toBe(1);
  });

  it("PlansTab: the stamp is one object on a control, not the plans-active wrapper", () => {
    expect(plansTab).not.toMatch(/data-module="plans-active"[^>]*data-primary-move/);
    expect(plansTab).toContain('"data-primary-move": "advance-plan-step"');
    expect(plansTab).toContain("primary={planIdx === 0 ? primaryStamp : undefined}");
    // The gradient is spelled once, inside the stamp object.
    expect((plansTab.match(/--arbor-gradient-primary/g) || []).length).toBe(1);
  });

  it("today's row reads Today (clay chip), not Not started", () => {
    uiLang = "en";
    const html = renderToStaticMarkup(React.createElement(PlanSteps, { plan, todayStep: { phaseIdx: 1, stepIdx: 0 }, now: 1757000000000 }));
    const row = html.slice(html.indexOf('data-today-step="true"'));
    expect(row).toMatch(/data-step-chip="today"[^>]*>Today</);
    // Visible text only (the advance button's aria-label keeps the honest status).
    expect(row.slice(0, row.indexOf("</li>")).replace(/aria-label="[^"]*"/g, "")).not.toContain("Not started");
    expect(html).toMatch(/<h3 dir="auto"/);
  });
});

/** B-ASKJB-NEW-1g/1h — the track card speaks back to the last outcome. */
describe("B-ASKJB-NEW-1g/1h — plan echo", async () => {
  const { planEcho, planEchoKey } = await import("../../lib/plans");
  const { default: PlanTrackCard } = await import("./PlanTrackCard");
  const dict = await import("../../lib/i18nElevation/plans");
  const ref = { planId: plan.id, phaseIdx: 0, stepIdx: 1 };
  const row = (o: "helped" | "somewhat" | "not_today", at: string, step = ref) => ({
    recommendation: "Same three books", source: "plan" as const, ...step, outcome: o, outcomeAt: at, status: "completed" as const,
  });
  it("yesterday's helped → the yesterday line; older → last time; none → first", () => {
    expect(planEcho(plan.id, [row("helped", "2026-10-03T19:00:00Z")], ref, "2026-10-04")).toEqual({ kind: "helped", step: "Same three books", yesterday: true });
    expect(planEcho(plan.id, [row("somewhat", "2026-09-30T19:00:00Z")], ref, "2026-10-04")).toEqual({ kind: "somewhat", step: "Same three books", yesterday: false });
    expect(planEcho(plan.id, [], ref, "2026-10-04")).toEqual({ kind: "first" });
    expect(planEcho(plan.id, [row("not_today", "2026-10-03T19:00:00Z")], ref, "2026-10-04")).toBeNull();
  });
  it("two not-todays on today's step → change this step (Adjust), never a streak or verdict", () => {
    const e = planEcho(plan.id, [row("not_today", "2026-10-03T19:00:00Z"), row("not_today", "2026-10-02T19:00:00Z")], ref, "2026-10-04");
    expect(e).toEqual({ kind: "not-yet-twice" });
    const html = renderToStaticMarkup(React.createElement(PlanTrackCard, {
      plan, step: { ...ref, text: "Same three books", day: 3, next: null, offerNext: false }, today: null, lang: "en", now: 0,
      onTryIt: () => {}, onUndo: () => {}, onCheck: () => {}, onAdjust: () => {}, echo: e, childName: "Noa",
    }));
    expect(html).toMatch(/<button type="button" data-testid="plan-echo" data-echo="not-yet-twice"[^>]*min-h-11/);
  });
  it("every echo key exists EN + HE; no streak/score words; no colour on the line", () => {
    const keys = [planEchoKey({ kind: "first" }), planEchoKey({ kind: "not-yet-twice" }),
      ...(["helped", "somewhat"] as const).flatMap((k) => [true, false].map((y) => planEchoKey({ kind: k, step: "x", yesterday: y })))];
    for (const d of [dict.en, dict.he]) for (const k of keys) {
      expect(d[k], k).toBeTruthy();
      expect(d[k]).not.toMatch(/streak|score|%|רצף|ציון/i);
    }
    const trackSrc = readFileSync(path.join(here, "PlanTrackCard.tsx"), "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const line = trackSrc.slice(trackSrc.indexOf('data-testid="plan-echo" data-echo={echo.kind} dir="auto"'), trackSrc.indexOf("</p>", trackSrc.indexOf('data-testid="plan-echo" data-echo={echo.kind} dir="auto"')));
    expect(line).not.toMatch(/--arbor-green|--arbor-coral|--arbor-peach/);
  });
});
