import { describe, expect, it } from "vitest";
import { focusGoal, selectFocusGoal, goalTileById, MAX_ACTIVE_GOALS, type ActiveGoal } from "./goalBuilder";
const goal = (goalId: string, addedAt: string): ActiveGoal => {
  const tile = goalTileById(goalId)!;
  return { goalId, label: tile.label, domainId: tile.domainId, addedAt };
};
const older = goal("transitions", "2026-09-01T00:00:00Z");
const middle = goal("early-talking", "2026-09-02T00:00:00Z");
const newest = goal("taking-turns", "2026-09-03T00:00:00Z");
describe("B-GROWTH-40 newest goal read projection", () => {
  it("returns only the newest of three without sorting or modifying stored records", () => {
    const input = Object.freeze([Object.freeze(newest), Object.freeze(older), Object.freeze(middle)]);
    expect(focusGoal(input)).toBe(newest);
    expect(input).toEqual([newest, older, middle]);
    expect(MAX_ACTIVE_GOALS).toBe(1);
  });
  it("uses absolute dates, stable last-entry ties, and a deterministic invalid-date fallback", () => {
    expect(focusGoal([older, { ...middle, addedAt: "2026-09-01T01:00:00+02:00" }])).toBe(older);
    const tie = { ...middle, addedAt: older.addedAt };
    expect(focusGoal([older, tie])).toBe(tie);
    expect(focusGoal([{ ...newest, addedAt: "broken" }, older])).toBe(older);
    const invalid = { ...older, addedAt: "" };
    expect(focusGoal([{ ...newest, addedAt: "broken" }, invalid])).toBe(invalid);
    expect(focusGoal([])).toBeNull(); expect(focusGoal()).toBeNull();
  });
  it("appends a new confirmed choice while retaining all three earlier records byte-for-byte", () => {
    const input = [older, newest, middle];
    const next = selectFocusGoal(input, goal("big-feelings", "ignored"), "2026-10-10T01:00:00Z");
    expect(next.slice(0, 3)).toEqual(input);
    input.forEach((entry, i) => expect(next[i]).toBe(entry));
    expect(next).toHaveLength(4); expect(focusGoal(next)?.goalId).toBe("big-feelings");
  });
  it("reselects Earlier without deleting a goal, replacing its stored label, or backfilling others", () => {
    const retired = { ...older, label: "My existing label", provenance: "retained" };
    const next = selectFocusGoal([retired, newest, middle], older, "2026-10-10T01:00:00Z");
    expect(next).toHaveLength(3); expect(next.slice(0, 2)).toEqual([newest, middle]);
    expect(next[2]).toEqual({ ...retired, addedAt: "2026-10-10T01:00:00.000Z" });
    expect(retired.addedAt).toBe(older.addedAt); expect(focusGoal(next)).toBe(next[2]);
  });
  it("an explicit choice wins equal/skewed clocks without rewriting earlier timestamps", () => {
    const future = { ...newest, addedAt: "2030-01-01T00:00:00Z" };
    const next = selectFocusGoal([future], older, "2026-10-10T01:00:00Z");
    expect(next[0]).toBe(future); expect(focusGoal(next)).toBe(next[1]);
    expect(() => selectFocusGoal([future], older, "bad date")).toThrow();
  });
});
