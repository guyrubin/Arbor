/**
 * B-DATA-14 — offline answers from the actual ProfileProvider (synthetic SDK,
 * auth, storage and network boundaries; no real data).
 *  - A goal choice needs the stored list (B-DATA-13's transaction): offline it
 *    fails at once with reason "offline" and writes nothing; online it fails
 *    after GOAL_CONFIRM_MS instead of an endless "Saving…".
 *  - A profile list answered from this phone's cache loads but is marked
 *    provisional (the global banner's entry); the banner's Retry re-reads it
 *    quietly and a server answer clears the mark.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness } from "./ProfileContext.testSupport";
import { goalTileById, type ActiveGoal } from "../practice/goalBuilder";
import { __resetSyncStoreForTests, getSyncSnapshot, retrySync } from "../lib/syncStore";
import type { ChildProfile } from "../types";

const goal = (id: string): ActiveGoal => { const tile = goalTileById(id)!; return { goalId: id, label: tile.label, domainId: tile.domainId, addedAt: "2026-09-01T00:00:00Z" }; };
const choice = (id: string) => { const { addedAt: _a, ...rest } = goal(id); return rest; };
const child = (id: string, activeGoals: ActiveGoal[] = []): ChildProfile => ({ id, name: "Synthetic", age: 4, languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: true, activeGoals });

beforeEach(() => { __resetSyncStoreForTests(); vi.stubGlobal("navigator", { onLine: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("B-DATA-14 — a goal choice has an answer offline", () => {
  it("offline: fails at once with reason 'offline'; nothing is written; the choice stays for Retry", async () => {
    const p = harness({ rows: [child("A-child", [goal("transitions")])] }); p.effects(); await p.flush();
    vi.stubGlobal("navigator", { onLine: false });
    const basis = JSON.stringify(p.value.getGoalSelection("A-child")!.goals);
    expect(await p.value.saveChildGoal("A-child", choice("big-feelings"), basis)).toBe("failed");
    expect(p.calls.updates).toEqual([]);
    expect(p.value.getGoalSelection("A-child")!.attempt).toMatchObject({ status: "failed", reason: "offline", goal: { goalId: "big-feelings" } });
    // Back online, Retry saves the same choice.
    vi.stubGlobal("navigator", { onLine: true });
    p.value.cancelGoalAttempt("A-child"); await p.flush();
    expect(await p.value.saveChildGoal("A-child", choice("big-feelings"), basis)).toBe("saved");
  });

  it("online with no answer: fails after GOAL_CONFIRM_MS, never an endless Saving…", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { GOAL_CONFIRM_MS } = await import("./ProfileContext");
    const p = harness({ rows: [child("A-child", [goal("transitions")])] }); p.effects(); await p.flush();
    p.transport.update = () => new Promise(() => {});
    const result = { value: "" };
    void p.value.saveChildGoal("A-child", choice("big-feelings"), JSON.stringify(p.value.getGoalSelection("A-child")!.goals)).then(v => { result.value = v; });
    await vi.advanceTimersByTimeAsync(GOAL_CONFIRM_MS - 1); expect(result.value).toBe("");
    expect(p.value.getGoalSelection("A-child")!.attempt?.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(1); await p.flush();
    expect(result.value).toBe("failed");
    expect(p.value.getGoalSelection("A-child")!.attempt).toMatchObject({ status: "failed" });
    expect(p.value.getGoalSelection("A-child")!.attempt?.reason).toBeUndefined();
  });
});

describe("B-DATA-14 — a profile list from this phone's cache is provisional", () => {
  it("loads, is marked provisional on the one banner, and Retry confirms it from the server", async () => {
    let rows = [child("A-child")];
    const p = harness({ rows }); p.transport.read = async () => rows; p.transport.fromCache = true;
    p.effects(); await p.flush();
    expect(p.value.profiles.map(c => c.id)).toEqual(["A-child"]);
    expect(p.value.loadError).toBe(false);
    expect(p.value.profilesProvisional).toBe(true);
    expect(getSyncSnapshot().errors).toContainEqual({ name: "profiles", childId: "*" });

    // Still cached on Retry: stays provisional.
    retrySync(); await p.flush();
    expect(p.value.profilesProvisional).toBe(true);

    // The server answers (with a second child the cache lacked).
    rows = [child("A-child"), child("A-second")]; p.transport.fromCache = false;
    retrySync(); await p.flush();
    expect(p.value.profilesProvisional).toBe(false);
    expect(p.value.profiles.map(c => c.id)).toEqual(["A-child", "A-second"]);
    expect(getSyncSnapshot().errors).toEqual([]);
  });

  it("a server answer is never provisional", async () => {
    const p = harness({ rows: [child("A-child")] }); p.effects(); await p.flush();
    expect(p.value.profilesProvisional).toBe(false);
    expect(getSyncSnapshot().errors).toEqual([]);
  });
});
