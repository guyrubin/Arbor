/**
 * B-DATA-13 — a goal chosen on one device cannot drop a goal chosen on another.
 *
 * Two actual ProfileProviders (two devices of one parent) share ONE synthetic
 * stored child document. Device A loads, device B loads, B chooses a goal and
 * it is stored; A — still showing the list it loaded — chooses another. The
 * stored list must keep B's goal: the choice is merged onto the goals as
 * stored at write time (a transaction), never a whole array from A's stale
 * read. Synthetic SDK/auth/storage boundaries; no network, no real data.
 */
import { describe, expect, it } from "vitest";
import { harness } from "./ProfileContext.testSupport";
import { goalTileById, type ActiveGoal } from "../practice/goalBuilder";

const goal = (id: string, addedAt = "2026-09-01T00:00:00Z"): ActiveGoal => {
  const tile = goalTileById(id)!;
  return { goalId: id, label: tile.label, domainId: tile.domainId, addedAt };
};
const choice = (id: string) => { const { addedAt: _addedAt, ...rest } = goal(id); return rest; };
const child = (activeGoals: ActiveGoal[]) => ({ id: "A-child", name: "Synthetic", age: 4, languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: true, activeGoals });
const PATH = "users/A/children/A-child";

async function twoDevices(seed: ActiveGoal[]) {
  const server = new Map<string, Record<string, unknown>>();
  const a = harness({ rows: [child(seed)], server }); a.effects(); await a.flush();
  const b = harness({ rows: [child(seed)], server }); b.effects(); await b.flush();
  return { a, b, server };
}
const ids = (goals: unknown) => (goals as ActiveGoal[]).map(g => g.goalId);

describe("B-DATA-13 — goal choices from two devices both survive", () => {
  it("B chooses, then stale A chooses another: the stored list keeps B's goal, and A's choice is current", async () => {
    const { a, b, server } = await twoDevices([goal("transitions")]);
    const basis = (p: typeof a) => JSON.stringify(p.value.getGoalSelection("A-child")!.goals);
    expect(await b.value.saveChildGoal("A-child", choice("big-feelings"), basis(b))).toBe("saved");
    await b.flush();
    expect(ids(server.get(PATH)!.activeGoals)).toEqual(["transitions", "big-feelings"]);

    // A never re-read: it still shows only "transitions".
    expect(ids(a.value.activeChild.activeGoals)).toEqual(["transitions"]);
    expect(await a.value.saveChildGoal("A-child", choice("taking-turns"), basis(a))).toBe("saved");
    await a.flush();

    const stored = server.get(PATH)!.activeGoals as ActiveGoal[];
    expect(ids(stored)).toEqual(["transitions", "big-feelings", "taking-turns"]);
    // A's device installs what is stored, not its stale merge.
    expect(a.value.activeChild.activeGoals).toEqual(stored);
    // A's choice is the newest (the focus); B's goal stays as an earlier one.
    const newest = [...stored].sort((x, y) => Date.parse(y.addedAt) - Date.parse(x.addedAt))[0];
    expect(newest.goalId).toBe("taking-turns");
  });

  it("the same goal chosen on both devices is stored once, refreshed — never duplicated", async () => {
    const { a, b, server } = await twoDevices([goal("transitions")]);
    const basis = (p: typeof a) => JSON.stringify(p.value.getGoalSelection("A-child")!.goals);
    await b.value.saveChildGoal("A-child", choice("big-feelings"), basis(b)); await b.flush();
    await a.value.saveChildGoal("A-child", choice("big-feelings"), basis(a)); await a.flush();
    expect(ids(server.get(PATH)!.activeGoals)).toEqual(["transitions", "big-feelings"]);
  });
});
