import { routineDayKey, routineIdOfPlan, routineStepCount } from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";

/**
 * "Done together this week": the routine steps the family ticked on the last
 * seven local days (today included), read from each routine plan's own runs.
 * A count of what a parent ticked and the days it happened, never a share.
 */
export function routineStepsThisWeek(plans: readonly ActionPlan[], now: Date): { steps: number; days: Date[] } {
  const keys: { key: string; date: Date }[] = [];
  for (let back = 6; back >= 0; back -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    keys.push({ key: routineDayKey(d), date: d });
  }
  let steps = 0;
  const days = new Set<string>();
  for (const plan of plans) {
    if (routineIdOfPlan(plan) === null) continue;
    const total = routineStepCount(plan);
    for (const { key } of keys) {
      const run = plan.routineRuns?.[key];
      if (!Array.isArray(run)) continue;
      const ticked = new Set(run.filter((i) => Number.isInteger(i) && i >= 0 && i < total)).size;
      if (ticked > 0) { steps += ticked; days.add(key); }
    }
  }
  return { steps, days: keys.filter(({ key }) => days.has(key)).map(({ date }) => date) };
}
