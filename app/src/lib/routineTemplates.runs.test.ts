import { describe, expect, it } from "vitest";
import type { ActionPlan } from "../types";
import { routineById } from "./routines";
import {
  foldRoutineOfflineTicks,
  heldRoutineTicks,
  isRoutineRunComplete,
  markRoutineCelebrated,
  resetRoutineToday,
  ROUTINE_RUN_KEEP_DAYS,
  routineCelebrated,
  routineDayKey,
  routineDaysComplete,
  routineRunToday,
  routineStepCount,
  routineToPlan,
  toggleRoutineStep,
} from "./routineTemplates";
import { selectFromRecord } from "./today/fromRecord";

/* v3 FEAT-07 — a routine plan runs again every day.
   Each day's ticks live in plan.routineRuns[YYYY-MM-DD]; step.completed is
   never written, the run starts at 0 on the next local day, only days on which
   EVERY step ran count, and runs older than 14 days are pruned. A plan not
   started from a routine is never treated as a run (negative control). */

const NOW = new Date(2026, 9, 12, 9, 30).getTime(); // 12 Oct 2026, local morning
const TODAY = "2026-10-12";
const morning = routineById("morning"); // five steps
const fresh = (): ActionPlan => routineToPlan(morning, "en", "Noa", NOW);
const tickAll = (plan: ActionPlan, day: string): ActionPlan =>
  Array.from({ length: routineStepCount(plan) }, (_, i) => i).reduce((p, i) => toggleRoutineStep(p, day, i), plan);

describe("FEAT-07 · routine runs are per local day", () => {
  it("the day key is the LOCAL calendar day", () => {
    expect(routineDayKey(NOW)).toBe(TODAY);
    expect(routineDayKey(new Date(2026, 9, 12, 23, 59))).toBe(TODAY);
    expect(routineDayKey(new Date(2026, 9, 13, 0, 1))).toBe("2026-10-13");
    expect(routineDayKey(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });

  it("toggles a step on and off for today, without mutating the plan passed in", () => {
    const plan = fresh();
    expect(routineStepCount(plan)).toBe(5);
    const one = toggleRoutineStep(plan, TODAY, 2);
    expect(plan.routineRuns).toBeUndefined();
    expect(routineRunToday(one, TODAY)).toEqual([2]);
    const two = toggleRoutineStep(one, TODAY, 0);
    expect(routineRunToday(two, TODAY)).toEqual([0, 2]);
    expect(routineRunToday(one, TODAY)).toEqual([2]);
    const back = toggleRoutineStep(two, TODAY, 2);
    expect(routineRunToday(back, TODAY)).toEqual([0]);
    const none = toggleRoutineStep(back, TODAY, 0);
    expect(routineRunToday(none, TODAY)).toEqual([]);
    // An empty day is not kept.
    expect(none.routineRuns).toEqual({});
  });

  it("an index outside the board changes nothing (the same plan comes back)", () => {
    const plan = fresh();
    for (const idx of [-1, 5, 99, 1.5, Number.NaN]) expect(toggleRoutineStep(plan, TODAY, idx)).toBe(plan);
  });

  it("never writes step.completed: the board's steps stay as the template made them", () => {
    const plan = fresh();
    const done = tickAll(plan, TODAY);
    expect(isRoutineRunComplete(done, TODAY)).toBe(true);
    expect(done.phases).toEqual(plan.phases);
    expect(done.phases.flatMap((ph) => ph.steps).every((s) => s.completed === false && s.status === undefined)).toBe(true);
  });

  it("rolls over: tomorrow starts at zero and yesterday's full run still counts", () => {
    const done = tickAll(fresh(), TODAY);
    expect(routineRunToday(done, TODAY)).toEqual([0, 1, 2, 3, 4]);
    expect(routineRunToday(done, "2026-10-13")).toEqual([]);
    expect(isRoutineRunComplete(done, "2026-10-13")).toBe(false);
    expect(routineDaysComplete(done, TODAY)).toBe(1);
    expect(routineDaysComplete(done, "2026-10-13")).toBe(1);
    const next = toggleRoutineStep(done, "2026-10-13", 1);
    expect(routineRunToday(next, "2026-10-13")).toEqual([1]);
    expect(routineRunToday(next, TODAY)).toEqual([0, 1, 2, 3, 4]);
    expect(routineDaysComplete(next, "2026-10-13")).toBe(1);
  });

  it(`keeps ${ROUTINE_RUN_KEEP_DAYS} days (today and the 13 before): older, malformed and far-future keys are pruned on the next write`, () => {
    const plan: ActionPlan = {
      ...fresh(),
      routineRuns: {
        "2026-09-20": [0, 1, 2, 3, 4], // 22 days back
        "2026-09-28": [0, 1, 2, 3, 4], // 14 days back: outside the two weeks
        "2026-09-29": [0, 1], // 13 days back: kept
        "2026-10-11": [3], // yesterday
        "2026-10-13": [2], // another device one day ahead: kept
        "2026-10-15": [1], // three days ahead: dropped
        yesterday: [0],
      },
    };
    const next = toggleRoutineStep(plan, TODAY, 4);
    expect(Object.keys(next.routineRuns ?? {}).sort()).toEqual(["2026-09-29", "2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(next.routineRuns?.[TODAY]).toEqual([4]);
    // Resetting today keeps the earlier days and prunes the same way.
    const reset = resetRoutineToday(plan, TODAY);
    expect(Object.keys(reset.routineRuns ?? {}).sort()).toEqual(["2026-09-29", "2026-10-11", "2026-10-13"]);
  });

  it("'the last two weeks' is counted at display time, before any write prunes", () => {
    const full = [0, 1, 2, 3, 4];
    // A family ran it every day of September, then did not open it until 12 Oct:
    // the stored runs are 20–30 days old and nothing has pruned them yet.
    const stale: ActionPlan = {
      ...fresh(),
      routineRuns: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`2026-09-${String(12 + i).padStart(2, "0")}`, full])),
    };
    expect(Object.keys(stale.routineRuns ?? {})).toHaveLength(11);
    expect(routineDaysComplete(stale, TODAY)).toBe(0);
    // The window edges: today and 13 days back count; 14 back and a day ahead do not.
    const edges: ActionPlan = {
      ...fresh(),
      routineRuns: { "2026-09-28": full, "2026-09-29": full, [TODAY]: full, "2026-10-13": full },
    };
    expect(routineDaysComplete(edges, TODAY)).toBe(2);
    expect(routineDaysComplete(edges, TODAY, 1)).toBe(1);
  });

  it("counts only days on which EVERY step ran; duplicates and stray indices never fill a day", () => {
    const plan: ActionPlan = {
      ...fresh(),
      routineRuns: {
        "2026-10-08": [0, 1, 2, 3, 4],
        "2026-10-09": [0, 1],
        "2026-10-10": [4, 3, 2, 1, 0, 0],
        "2026-10-11": [0, 1, 2, 3, 99],
        "not-a-day": [0, 1, 2, 3, 4],
      },
    };
    expect(routineDaysComplete(plan, TODAY)).toBe(2);
    expect(isRoutineRunComplete(plan, "2026-10-10")).toBe(true);
    expect(isRoutineRunComplete(plan, "2026-10-11")).toBe(false);
    expect(routineRunToday(plan, "2026-10-11")).toEqual([0, 1, 2, 3]);
  });

  it("resetting today clears only today", () => {
    const plan = toggleRoutineStep(tickAll(fresh(), "2026-10-11"), TODAY, 2);
    const reset = resetRoutineToday(plan, TODAY);
    expect(routineRunToday(reset, TODAY)).toEqual([]);
    expect(routineRunToday(reset, "2026-10-11")).toEqual([0, 1, 2, 3, 4]);
  });

  it("the celebrated day is stored on the plan and survives later ticks and resets that day", () => {
    const done = tickAll(fresh(), TODAY);
    expect(routineCelebrated(done, TODAY)).toBe(false);
    const marked = markRoutineCelebrated(done, TODAY);
    expect(marked.routineCelebratedOn).toBe(TODAY);
    expect(done.routineCelebratedOn).toBeUndefined();
    expect(routineCelebrated(marked, TODAY)).toBe(true);
    // Unticking, ticking again or starting the day over never clears the mark…
    expect(routineCelebrated(toggleRoutineStep(toggleRoutineStep(marked, TODAY, 4), TODAY, 4), TODAY)).toBe(true);
    expect(routineCelebrated(resetRoutineToday(marked, TODAY), TODAY)).toBe(true);
    // …and tomorrow is a new day.
    expect(routineCelebrated(marked, "2026-10-13")).toBe(false);
  });

  it("negative control: a plan not started from a routine is never treated as a run", () => {
    const plan: ActionPlan = {
      id: "plan-1759660800000",
      title: "Calmer mornings",
      issue: "Morning rush",
      phases: [{ name: "Week 1", description: "", steps: [{ text: "Lay out clothes", completed: false }, { text: "Two-minute warning", completed: false }] }],
      scripts: [],
      successIndicators: [],
      routineRuns: { [TODAY]: [0, 1] },
      routineCelebratedOn: TODAY,
    };
    expect(routineRunToday(plan, TODAY)).toEqual([]);
    expect(toggleRoutineStep(plan, TODAY, 0)).toBe(plan);
    expect(resetRoutineToday(plan, TODAY)).toBe(plan);
    expect(routineDaysComplete(plan, TODAY)).toBe(0);
    expect(isRoutineRunComplete(plan, TODAY)).toBe(false);
    expect(routineCelebrated(plan, TODAY)).toBe(false);
    expect(markRoutineCelebrated(plan, TODAY)).toBe(plan);
  });
});

describe("FEAT-07 · Now: a routine finished for today frees the plan opener", () => {
  const ordinary: ActionPlan = {
    id: "plan-1759000000000",
    title: "Calmer bedtimes",
    issue: "Bedtime",
    phases: [{ name: "Week 1", description: "", steps: [{ text: "Dim the lights at seven", completed: false }] }],
    scripts: [],
    successIndicators: [],
  };
  const pick = (plans: ActionPlan[]) => selectFromRecord({ now: new Date(NOW), plans, loop: [], logs: [], facts: [] });

  it("an unfinished routine run is the active plan (newest first)", () => {
    const routine = toggleRoutineStep(fresh(), TODAY, 0);
    expect(pick([routine, ordinary])?.key).toBe(`plan:${routine.id}`);
  });

  it("a routine run finished today steps aside for the next active plan", () => {
    const routine = tickAll(fresh(), TODAY);
    expect(pick([routine, ordinary])?.key).toBe(`plan:${ordinary.id}`);
    expect(pick([routine])).toBeNull();
  });

  it("tomorrow the same routine is active again", () => {
    const routine = tickAll(fresh(), "2026-10-11");
    expect(pick([routine, ordinary])?.key).toBe(`plan:${routine.id}`);
  });

  it("negative control: an ordinary plan with every step done is still never the opener", () => {
    const finished: ActionPlan = { ...ordinary, phases: [{ ...ordinary.phases[0], steps: [{ text: "Dim the lights at seven", completed: true }] }] };
    expect(pick([finished])).toBeNull();
  });
});

/* B-DATA-14 (wave 4) — ticks held offline fold into the run by the step's words. */
describe("foldRoutineOfflineTicks", () => {
  const words = (plan: ActionPlan) => plan.phases.flatMap((ph) => ph.steps.map((s) => s.text));
  const at = new Date(NOW).toISOString();
  it("lays each tick over its day's run and drops the field; the server's other ticks stay", () => {
    const plan = toggleRoutineStep(fresh(), TODAY, 0); // ticked on the other phone
    const held = { ...plan, routineOfflineTicks: { [TODAY]: { "2": { text: words(plan)[2], done: true, at }, "0": null } } };
    expect(heldRoutineTicks(held)).toBe(1);
    const { plan: folded, lost } = foldRoutineOfflineTicks(held);
    expect(routineRunToday(folded, TODAY)).toEqual([0, 2]);
    expect(folded.routineOfflineTicks).toBeUndefined();
    expect(lost).toEqual([]);
  });
  it("an untick held offline takes the step out; a moved step is found by its words", () => {
    const plan = tickAll(fresh(), TODAY);
    const steps = words(plan);
    const held = { ...plan, routineOfflineTicks: { [TODAY]: { "4": { text: steps[1], done: false, at } } } };
    expect(routineRunToday(foldRoutineOfflineTicks(held).plan, TODAY)).toEqual([0, 2, 3, 4]);
  });
  it("a tick whose step is gone is lost by name, never forced onto another step", () => {
    const plan = fresh();
    const { plan: folded, lost } = foldRoutineOfflineTicks({ ...plan, routineOfflineTicks: { [TODAY]: { "1": { text: "A step changed on the other phone", done: true, at } } } });
    expect(routineRunToday(folded, TODAY)).toEqual([]);
    expect(lost).toEqual(["A step changed on the other phone"]);
  });
  it("negative control: a plan with no held ticks folds to itself", () => {
    const plan = toggleRoutineStep(fresh(), TODAY, 3);
    expect(foldRoutineOfflineTicks(plan)).toEqual({ plan, lost: [] });
    expect(heldRoutineTicks(plan)).toBe(0);
  });
});
