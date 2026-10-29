/**
 * B-ASKJB-26 — the nine plan templates are FOLDED into the authored routine
 * boards (the Gate's no-new-copy path): each only ever started one board (two
 * the same one), so the ready-made routines row is the one way to start a
 * board — instantly, from the board's own EN + HE steps, with ZERO
 * generate-plan calls. After a start the new plan leads the page with one
 * receipt line (critic r1). The REAL PlansTab renders with the app contexts
 * mocked; the routine chip's own onClick runs.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { ROUTINES, localized } from "../../lib/routines";
import { JUST_STARTED_MS, justStartedPlanId, nextStartedPlan, routineIdOfPlan, routineTemplatesForAge, routineToPlan } from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";
import { ageMonthsFromProfile } from "../../lib/childAge";

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  buttons: [] as { onClick?: () => unknown; "data-plan-template"?: string; "data-routine-template"?: string }[],
  startPlanFromTemplate: vi.fn(async (_plan: unknown) => undefined),
  handleGenerateActionPlan: vi.fn(),
  setPlanChallengeTopic: vi.fn(),
  generatePlan: vi.fn(),
}));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Noa Example", age: 4, birthDate: "2022-01-01", strengths: [], interests: [], languages: [], challenges: [], activeGoals: [] },
  behaviorLogs: [], actionPlans: [], plansLoaded: true, planChallengeTopic: "", isPlanGenerating: false, actionLoop: [], activeTodayAction: null,
  setPlanChallengeTopic: h.setPlanChallengeTopic, handleGenerateActionPlan: h.handleGenerateActionPlan, seedCoach: vi.fn(),
  acceptTodayAction: vi.fn(), removeTodayAction: vi.fn(), recordPlanWeeklyCheck: vi.fn(), startPlanFromTemplate: h.startPlanFromTemplate,
}), useArborOptional: () => null }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "parent-a", displayName: "Parent" } }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: true, error: false, remote: false, upsert: vi.fn(), remove: vi.fn() }) }));
vi.mock("../../lib/api", () => ({ api: { generatePlan: h.generatePlan } }));
vi.mock("../../lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => null, useHeroAvatar: () => ({ hasHero: false, name: "Noa" }) }));
vi.mock("motion/react", () => ({ AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: (_, tag: string) => ({ children, initial, animate, exit, transition, ...props }: any) => React.createElement(tag, props, children) }) }));
const capture = vi.hoisted(() => (type: unknown, props: any) => { if (type === "button") h.buttons.push(props); });
vi.mock("react/jsx-runtime", async original => { const r = await original<typeof import("react/jsx-runtime")>(); return { ...r, jsx: (...args: Parameters<typeof r.jsx>) => { capture(args[0], args[1]); return r.jsx(...args); }, jsxs: (...args: Parameters<typeof r.jsxs>) => { capture(args[0], args[1]); return r.jsxs(...args); } }; });
vi.mock("react/jsx-dev-runtime", async original => { const r = await original<typeof import("react/jsx-dev-runtime")>(); return { ...r, jsxDEV: (...args: Parameters<typeof r.jsxDEV>) => { capture(args[0], args[1]); return r.jsxDEV(...args); } }; });

import PlansTab from "./PlansTab";

beforeEach(() => { h.buttons = []; vi.clearAllMocks(); vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() }); });

describe("B-ASKJB-26 · the nine templates fold into the authored routine boards", () => {
  for (const lang of ["en", "he"] as const) it(`${lang}: one row starts boards — no challenge-named duplicate chips`, async () => {
    h.lang = lang;
    const html = renderToStaticMarkup(<PlansTab />);
    expect(h.buttons.filter((b) => b["data-plan-template"])).toHaveLength(0);
    // Critic r2 (shrink-only): the folded chips' strings are gone, EN and HE.
    expect(translate(lang, "plan.templates")).toBe("plan.templates");
    for (const key of ["morningDeparture", "screenShutdown", "siblingConflict", "bedtimeResistance", "foodRefusal", "separationAnxiety", "responsibilityLadder", "schoolAdaptation", "behaviorReset"]) {
      expect(translate(lang, `plan.template.${key}`)).toBe(`plan.template.${key}`);
    }
    expect(html).not.toMatch(lang === "en" ? /Templates:|Sibling sharing|Behavior reset plan/ : /תבניות:|סכסוכי שיתוף/);
    const chips = h.buttons.filter((b) => b["data-routine-template"]);
    const offered = routineTemplatesForAge(ageMonthsFromProfile({ birthDate: "2022-01-01", age: 4 } as never));
    expect(chips.map((b) => b["data-routine-template"])).toEqual(offered.map((r) => r.id));
    // Each chip names its own board, so two chips never start the same board.
    expect(new Set(chips.map((b) => b["data-routine-template"])).size).toBe(chips.length);
    for (const chip of chips) await chip.onClick!();
    expect(h.startPlanFromTemplate).toHaveBeenCalledTimes(chips.length);
    const plans = h.startPlanFromTemplate.mock.calls.map((c) => c[0] as ActionPlan);
    plans.forEach((plan, i) => {
      const routine = ROUTINES.find((r) => r.id === chips[i]["data-routine-template"])!;
      expect(routineIdOfPlan(plan)).toBe(routine.id);
      expect(plan.phases[0].steps.map((s) => s.text)).toEqual(routine.steps.map((s) => localized(s.label, lang)));
    });
    expect(h.handleGenerateActionPlan).not.toHaveBeenCalled();
    expect(h.generatePlan).not.toHaveBeenCalled();
    expect(h.setPlanChallengeTopic).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: the r1 page offered the challenge-named chips beside the boards they started", () => {
    const tab = readFileSync(path.resolve(__dirname, "PlansTab.tsx"), "utf8");
    expect(tab).not.toContain("data-plan-template");
    expect(tab).not.toContain("PLAN_TEMPLATE_ROUTINE");
    const r1 = '{Object.keys(PLAN_TEMPLATE_ROUTINE).map((key) => {';
    expect(r1).toContain("PLAN_TEMPLATE_ROUTINE");
  });
});

describe("B-ASKJB-26 · after a start, the page answers where the parent is looking (critic r1)", () => {
  const now = Date.UTC(2026, 9, 28, 10, 0, 0);
  const routine = ROUTINES.find((r) => r.id === "calm")!;
  const started = routineToPlan(routine, "en", "Noa", now - 1_000);

  it("names the lead plan that has just appeared (routine and created plan id shapes)", () => {
    expect(justStartedPlanId([started], new Set(), now)).toBe(started.id);
    expect(justStartedPlanId([{ id: `plan-${now - 5_000}` }], new Set(), now)).toBe(`plan-${now - 5_000}`);
  });

  it("never for a plan already on the page, an older plan (child switch, sync), or a non-lead plan", () => {
    expect(justStartedPlanId([started], new Set([started.id]), now)).toBeNull();
    expect(justStartedPlanId([{ id: `plan-${now - JUST_STARTED_MS - 1}` }], new Set(), now)).toBeNull();
    expect(justStartedPlanId([{ id: "legacy-plan" }], new Set(), now)).toBeNull();
    expect(justStartedPlanId([], new Set(), now)).toBeNull();
  });

  it("critic r2: the first load primes what the page has seen — a reload within two minutes shows no receipt", () => {
    const first = nextStartedPlan(null, [started], now);
    expect(first.leadId).toBeNull();
    expect(first.seen.has(started.id)).toBe(true);
    const later = routineToPlan(ROUTINES.find((r) => r.id === "bedtime")!, "en", "Noa", now + 500);
    const next = nextStartedPlan(first.seen, [later, started], now + 1_000);
    expect(next.leadId).toBe(later.id);
    expect(nextStartedPlan(next.seen, [later, started], now + 2_000).leadId).toBeNull();
    // An empty first load still primes: the first plan started after it gets the receipt.
    expect(nextStartedPlan(nextStartedPlan(null, [], now).seen, [started], now).leadId).toBe(started.id);
  });

  it("PlansTab starts its memory empty-handed (null) and lets the first load prime it", () => {
    const tab = readFileSync(path.resolve(__dirname, "PlansTab.tsx"), "utf8");
    expect(tab).toContain("const seenPlanIds = useRef<Set<string> | null>(null);");
    expect(tab).toContain("nextStartedPlan(seenPlanIds.current, actionPlans, Date.now())");
  });

  it("the receipt sits on the active plans (where the new plan leads) and says Started today in both languages", () => {
    const tab = readFileSync(path.resolve(__dirname, "PlansTab.tsx"), "utf8");
    const active = tab.indexOf('<div data-module="plans-active"');
    expect(active).toBeGreaterThan(-1);
    expect(tab.indexOf('testId="plans-started-receipt"')).toBeGreaterThan(active);
    expect(tab).toContain('startedReceipt.show({ text: `${lead.title} · ${t("elev.plans.startedToday")}` })');
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.plans.startedToday")).not.toBe("elev.plans.startedToday");
  });
});
