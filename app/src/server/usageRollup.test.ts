/**
 * B-AIOPS-02/03 — the family voice allowance's daily totals in usageRollup,
 * the fields the B-GA-26 and BD-06/52 cost reads take: reserved Live slices,
 * settled fallback turns and resting refusals, per plan. Counts and
 * milliseconds only; an unexpected plan string never becomes a field name.
 */
import { describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { liveBudgetRollupFields } from "./usageRollup.js";

const inc = (n: number) => FieldValue.increment(n);
const same = (a: unknown, b: unknown) => (a as { isEqual(o: unknown): boolean }).isEqual(b);

describe("live budget rollup fields", () => {
  it("a delivered Live slice adds its reserved ms and one reservation, per plan", () => {
    const f = liveBudgetRollupFields({ kind: "live", plan: "plus", reservedMs: 60_000 }) as any;
    expect(same(f.reservedMs, inc(60_000))).toBe(true);
    expect(same(f.reservations, inc(1))).toBe(true);
    expect(same(f.byPlan.plus.reservedMs, inc(60_000))).toBe(true);
  });

  it("a settled fallback turn adds its spoken ms and one turn; a refusal adds one resting refusal", () => {
    const turn = liveBudgetRollupFields({ kind: "turn", plan: "free", settledMs: 4_200.4 }) as any;
    expect(same(turn.fallbackTurnMs, inc(4_200))).toBe(true);
    expect(same(turn.fallbackTurns, inc(1))).toBe(true);
    expect(same(turn.byPlan.free.fallbackTurnMs, inc(4_200))).toBe(true);
    const resting = liveBudgetRollupFields({ kind: "resting", plan: "free" }) as any;
    expect(same(resting.restingRefusals, inc(1))).toBe(true);
  });

  it("only a plan-shaped string becomes a field name", () => {
    const f = liveBudgetRollupFields({ kind: "resting", plan: "Synthetic Child" }) as any;
    expect(Object.keys(f.byPlan)).toEqual(["unknown"]);
  });
});
