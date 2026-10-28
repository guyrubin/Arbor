/**
 * B-ASKJB-26 — each of the nine plan templates starts a plan instantly from
 * an authored routine board (folded: the Gate's no-new-copy path), with ZERO
 * generate-plan calls. The REAL PlansTab renders with the app contexts mocked;
 * the template chip's own onClick runs.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { ROUTINES, localized } from "../../lib/routines";
import { PLAN_TEMPLATE_ROUTINE, routineIdOfPlan } from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  buttons: [] as { onClick?: () => unknown; "data-plan-template"?: string }[],
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

const KEYS = ["morningDeparture", "screenShutdown", "siblingConflict", "bedtimeResistance", "foodRefusal", "separationAnxiety", "responsibilityLadder", "schoolAdaptation", "behaviorReset"];
beforeEach(() => { h.buttons = []; vi.clearAllMocks(); vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() }); });

describe("B-ASKJB-26 · the nine templates fold into the authored routine boards", () => {
  it("every template names a real board (never the unknown-id fallback), offered at every age", () => {
    expect(Object.keys(PLAN_TEMPLATE_ROUTINE)).toEqual(KEYS);
    for (const key of KEYS) {
      const routine = ROUTINES.find((r) => r.id === PLAN_TEMPLATE_ROUTINE[key]);
      expect(routine, key).toBeDefined();
      expect(routine!.ageMinMonths ?? null, key).toBeNull();
      expect(routine!.ageMaxMonths ?? null, key).toBeNull();
      for (const lang of ["en", "he"] as const) expect(translate(lang, `plan.template.${key}`)).not.toBe(`plan.template.${key}`);
    }
  });

  for (const lang of ["en", "he"] as const) it(`${lang}: one tap starts the board as a plan from its own steps, with zero generate-plan calls`, async () => {
    h.lang = lang;
    renderToStaticMarkup(<PlansTab />);
    for (const key of KEYS) {
      const chip = h.buttons.find((b) => b["data-plan-template"] === key);
      expect(chip, key).toBeDefined();
      await chip!.onClick!();
    }
    expect(h.startPlanFromTemplate).toHaveBeenCalledTimes(KEYS.length);
    const plans = h.startPlanFromTemplate.mock.calls.map((c) => c[0] as ActionPlan);
    plans.forEach((plan, i) => {
      const routine = ROUTINES.find((r) => r.id === PLAN_TEMPLATE_ROUTINE[KEYS[i]])!;
      expect(routineIdOfPlan(plan)).toBe(routine.id);
      expect(plan.phases[0].steps.map((s) => s.text)).toEqual(routine.steps.map((s) => localized(s.label, lang)));
      expect(plan.phases[0].steps.every((s) => !s.completed)).toBe(true);
    });
    expect(h.handleGenerateActionPlan).not.toHaveBeenCalled();
    expect(h.generatePlan).not.toHaveBeenCalled();
    expect(h.setPlanChallengeTopic).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: the pre-change chip only prefilled the topic for the model", () => {
    const tab = readFileSync(path.resolve(__dirname, "PlansTab.tsx"), "utf8");
    expect(tab).not.toContain("onClick={() => setPlanChallengeTopic(tpl)}");
    expect('onClick={() => setPlanChallengeTopic(tpl)}').not.toContain("startPlanFromTemplate");
    expect(tab).toContain("await startPlanFromTemplate(routineToPlan(routineById(routineId), lang, first, Date.now()));");
  });
});
