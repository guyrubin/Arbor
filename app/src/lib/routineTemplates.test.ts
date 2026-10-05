import { describe, it, expect } from "vitest";
import { ROUTINES, routineById, routinesForAge } from "./routines";
import { routineIdOfPlan, routineTemplatesForAge, routineToPlan, ROUTINE_PLAN_PREFIX } from "./routineTemplates";

/* B-GROWTH-25 (template half) — every ready-made routine maps to ONE startable
   ActionPlan (12 → 12): the board's title, one phase carrying time + why, one
   step per board step, none done, no issue/scripts/indicators invented. The
   age window keeps a nap board off a 5-year-old and potty outside 18–48 m. */

const NOW = 1_759_660_800_000; // 2025-10-05T12:00:00Z

describe("B-GROWTH-25 — routines become Plans templates", () => {
  it("template mapping: 12 boards → 12 plans, step for step, EN + HE", () => {
    expect(ROUTINES).toHaveLength(12);
    const ids = new Set<string>();
    for (const r of ROUTINES) {
      for (const lang of ["en", "he"] as const) {
        const plan = routineToPlan(r, lang, "Dylan", NOW);
        expect(plan.title).toBe(lang === "he" ? r.title.he : r.title.en);
        expect(plan.issue).toBe("");
        expect(plan.scripts).toEqual([]);
        expect(plan.successIndicators).toEqual([]);
        expect(plan.phases).toHaveLength(1);
        expect(plan.phases[0].steps.map((s) => s.text)).toEqual(r.steps.map((s) => (lang === "he" ? s.label.he : s.label.en)));
        expect(plan.phases[0].steps.every((s) => s.completed === false)).toBe(true);
        expect(plan.phases[0].description).toContain(lang === "he" ? r.time.he : r.time.en);
        expect(plan.phases[0].description).not.toContain("{name}");
        expect(routineIdOfPlan(plan)).toBe(r.id);
        if (lang === "en") ids.add(plan.id);
      }
    }
    expect(ids.size).toBe(12);
  });

  it("starting 'Bedtime' creates one plan with the board's steps (4 on the shipped board)", () => {
    const bedtime = routineById("bedtime");
    const plan = routineToPlan(bedtime, "en", "Dylan", NOW);
    expect(plan.id).toBe(`${ROUTINE_PLAN_PREFIX}bedtime-${NOW}`);
    expect(plan.phases[0].steps.map((s) => s.text)).toEqual(["Bath", "Pajamas + teeth", "Story in bed", "Cuddle + lights out"]);
    expect(routineToPlan(bedtime, "he", "דילן", NOW).phases[0].steps[0].text).toBe("אמבטיה");
  });

  it("age window: a 5-year-old is not offered nap or potty; a 2-year-old is; unknown age loses nothing", () => {
    const at = (m: number | null) => routineTemplatesForAge(m).map((r) => r.id);
    expect(at(60)).not.toContain("nap");
    expect(at(60)).not.toContain("potty");
    expect(at(60)).toHaveLength(10);
    expect(at(24)).toContain("nap");
    expect(at(24)).toContain("potty");
    expect(at(12)).toContain("nap");
    expect(at(12)).not.toContain("potty");
    expect(at(48)).toEqual(expect.arrayContaining(["nap", "potty"]));
    expect(at(49)).not.toContain("nap");
    expect(at(null)).toHaveLength(12);
    expect(routinesForAge(undefined)).toBe(ROUTINES);
  });

  it("a non-routine plan is never mistaken for one", () => {
    expect(routineIdOfPlan({ id: "plan-1759660800000" })).toBeNull();
    expect(routineIdOfPlan({ id: "plan-routine-" })).toBeNull();
  });

  it("NEGATIVE CONTROL — without the window a 5-year-old would be offered nap and potty", () => {
    expect(ROUTINES.map((r) => r.id)).toEqual(expect.arrayContaining(["nap", "potty"]));
  });
});

describe("B-GROWTH-25 — the templates are startable on Plans in one tap", () => {
  it("PlansTab mounts RoutineTemplates in the create card; a tap writes one plan through startPlanFromTemplate", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = path.resolve(__dirname, "..");
    const read = (rel: string) => readFileSync(path.join(src, rel), "utf8");
    const plans = read("components/tabs/PlansTab.tsx");
    const create = plans.slice(plans.indexOf("const createCard = ("), plans.indexOf('data-module="plans-active"'));
    expect(create).toContain("<RoutineTemplates />");
    const comp = read("components/plans/RoutineTemplates.tsx");
    expect(comp).toContain("routineTemplatesForAge(months)");
    expect(comp).toContain("await startPlanFromTemplate(routineToPlan(routine, lang, first, Date.now()));");
    expect(comp).not.toMatch(/#[0-9a-fA-F]{3,8}\b/); // tokens only
    const ctx = read("context/ArborContext.tsx");
    expect(ctx).toContain("const startPlanFromTemplate = (plan: ActionPlan) => plansCol.upsert(plan);");
    // EN + HE chrome
    const { translate } = await import("./i18n");
    for (const k of ["elev.plans.routineTemplates.title", "elev.plans.routineTemplates.sub", "elev.plans.routineTemplates.start"]) {
      expect(translate("en", k), k).not.toBe(k);
      expect(translate("he", k), k).toMatch(/[\u0590-\u05FF]/);
    }
  });
});
