import { describe, expect, it, vi } from "vitest";
import { acceptTodayAction } from "./accept";
import { ACTION_SOURCES, planAcceptedAction, todayActionId, type ActionLoopEntry } from "./model";
const NOW = new Date("2026-10-09T12:00:00Z");
const id = todayActionId("child-a", NOW);
const row = (over: Partial<ActionLoopEntry> = {}): ActionLoopEntry => ({ id, recommendation: "Original chosen words", status: "accepted", source: "coach", capacity: "tiny", acceptedAt: "2026-10-09T08:00:00Z", ...over });

describe("shared acceptTodayAction preserves the existing ledger contract", () => {
  it.each(ACTION_SOURCES)("%s produces exactly the original plan and sequential writes", async source => {
    const rows = [row(), row({ id: "today.child-a.2026-10-08", recommendation: "Yesterday remains open" }), row({ id: `${id}.2`, status: "completed", outcome: "helped" })];
    const input = { recommendation: "  The parent chose this  ", capacity: "standard" as const, source, planStep: { planId: "p-1", phaseIdx: 1, stepIdx: 2 } };
    const expected = planAcceptedAction(rows, input, id, NOW); const upsert = vi.fn(async (_item: ActionLoopEntry) => {});
    const actual = await acceptTodayAction({ ...input, childId: "child-a", items: rows, upsert, now: NOW });
    expect(actual).toEqual(expected.entry); expect(upsert.mock.calls.map(([item]) => item)).toEqual([...expected.superseded, expected.entry]);
    expect(rows[0].status).toBe("accepted"); expect(rows[2].outcome).toBe("helped");
  });
  it("topic provenance stays only on the new row; superseded rows keep their own provenance", async () => {
    const upsert = vi.fn(async (_item: ActionLoopEntry) => {});
    const result = await acceptTodayAction({ childId: "child-a", items: [row({ topicId: "old-topic" })], upsert, recommendation: "New", source: "coach", capacity: "tiny", topicId: "new-topic", now: NOW });
    expect(upsert.mock.calls[0][0]).toMatchObject({ status: "superseded", topicId: "old-topic" }); expect(result.topicId).toBe("new-topic");
  });
  it("another child's step and all previous-day steps are never superseded", async () => {
    const upsert = vi.fn(async (_item: ActionLoopEntry) => {});
    await acceptTodayAction({ childId: "child-a", items: [row({ id: todayActionId("child-b", NOW) }), row({ id: "today.child-a.2026-10-08" })], upsert, recommendation: "A", source: "onboarding", capacity: "tiny", now: NOW });
    expect(upsert).toHaveBeenCalledOnce(); expect(upsert.mock.calls[0][0].id).toBe(id);
  });
  it("request-key replay returns the persisted row without extra writes, even on a later date", async () => {
    const upsert = vi.fn(async (_item: ActionLoopEntry) => {}); const prior = row({ acceptanceKey: "onboarding-v1.child-a.abc" });
    expect(await acceptTodayAction({ childId: "child-a", items: [prior], upsert, recommendation: "Original chosen words", source: "onboarding", capacity: "tiny", acceptanceKey: prior.acceptanceKey, now: new Date("2026-10-10T12:00:00Z") })).toBe(prior);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("no request key means the original fresh-accept semantics, not text-based deduplication", async () => {
    const upsert = vi.fn(async (_item: ActionLoopEntry) => {});
    const result = await acceptTodayAction({ childId: "child-a", items: [row()], upsert, recommendation: "Original chosen words", source: "coach", capacity: "tiny", now: NOW });
    expect(result.id).toBe(`${id}.2`); expect(upsert).toHaveBeenCalledTimes(2);
  });
  it.each(["superseded", "completed"] as const)("a %s request-key match is preserved as history, never mistaken for the current choice", async status => {
    const prior = row({ status, acceptanceKey: "onboarding-a", ...(status === "completed" ? { outcome: "helped" as const } : {}) });
    const current = row({ id: `${id}.2`, recommendation: "Different choice", acceptanceKey: "onboarding-b" });
    const upsert = vi.fn(async (_item: ActionLoopEntry) => {});
    const result = await acceptTodayAction({ childId: "child-a", items: [prior, current], upsert, recommendation: prior.recommendation,
      source: "onboarding", capacity: "tiny", acceptanceKey: prior.acceptanceKey, confirmExisting: true, now: NOW });
    expect(result).toMatchObject({ id: `${id}.3`, status: "accepted", acceptanceKey: "onboarding-a" });
    expect(upsert.mock.calls.map(([item]) => item.id)).toEqual([current.id, result.id]); expect(prior.status).toBe(status);
  });
  it("confirmed replay re-writes the same row without replacing its ID or accepting before acknowledgement", async () => {
    const prior = row({ acceptanceKey: "onboarding-a" }); let resolve!: () => void;
    const upsert = vi.fn(() => new Promise<void>(yes => { resolve = yes; })); let done = false;
    const replay = acceptTodayAction({ childId: "child-a", items: [prior], upsert, recommendation: prior.recommendation,
      source: "onboarding", capacity: "tiny", acceptanceKey: prior.acceptanceKey, confirmExisting: true, now: NOW }).then(item => { done = true; return item; });
    await Promise.resolve(); expect(done).toBe(false); expect(upsert).toHaveBeenCalledExactlyOnceWith(prior);
    resolve(); expect(await replay).toBe(prior);
  });
  it("failed writes reject and do not emit invented successful records", async () => {
    const upsert = vi.fn(async (_item: ActionLoopEntry) => { throw new Error("offline"); });
    await expect(acceptTodayAction({ childId: "child-a", items: [row()], upsert, recommendation: "A", source: "coach", capacity: "tiny", now: NOW })).rejects.toThrow("offline");
    expect(upsert).toHaveBeenCalledOnce();
  });
  it("never copies child/profile inputs to the action payload or calls a model", async () => {
    const fetch = vi.spyOn(globalThis, "fetch"); const upsert = vi.fn(async (_item: ActionLoopEntry) => {});
    const accepted = await acceptTodayAction({ childId: "child-a", items: [], upsert, recommendation: "A", source: "onboarding", capacity: "tiny", now: NOW });
    expect(Object.keys(accepted).sort()).toEqual(["acceptedAt", "capacity", "id", "recommendation", "source", "status"]);
    expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
  });
});
