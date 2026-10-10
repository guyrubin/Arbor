import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { MemoryReviewItem } from "../../types";
import { fromRecordEntry, fromRecordRowId } from "../../lib/today/fromRecord";

const h = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], effects: [] as (() => void)[], child: "a", loop: [] as ActionLoopEntry[], logs: [] as any[], memory: [] as MemoryReviewItem[], write: vi.fn(), disposed: false, confirmed: true, shared: {} as Record<string, any> }));
vi.mock("react", () => ({
  useState: (initial: any) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial; return [h.slots[i], (next: any) => { if (h.disposed) throw Error("state after unmount"); h.slots[i] = typeof next === "function" ? next(h.slots[i]) : next; }]; },
  useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, prev = h.slots[i]; if (prev && deps.every((d, n) => Object.is(d, prev.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; h.slots[i] = slot; h.effects.push(() => { prev?.cleanup?.(); slot.cleanup = effect(); }); },
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.child }, actionPlans: [], approvedMemoryItems: h.memory, behaviorLogs: h.logs, actionLoop: h.loop, recordAnswersConfirmed: h.confirmed, recordAnswerWrites: h.shared, recordFromRecordAnswer: async (opener: any, answer: any, at: Date) => { const child = h.child; const saved = await h.write(opener, answer, at); return saved ?? fromRecordEntry(opener, answer, child, at); } }) }));
import { useNowRecord } from "./useNowRecord";
let now = new Date(2026, 9, 12, 8);
const render = () => { h.cursor = 0; const result = useNowRecord(now); h.effects.splice(0).forEach(fn => fn()); return result; };
const deferred = () => { let resolve!: () => void, reject!: (e: unknown) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const NOTE = "Calmed and put shoes on within eight minutes.";
const memory = (overrides: Partial<MemoryReviewItem> = {}): MemoryReviewItem => ({ memoryId: "memory-school", childId: "a", status: "approved", fact: "Started a new school in September.", source: "parent", retention: "until_deleted", createdAt: "2026-10-01T08:00:00Z", latestEventId: "memory-event-school", ...overrides });
beforeEach(() => { h.cursor = 0; h.slots = []; h.effects = []; h.child = "a"; h.loop = []; h.logs = [{ id: "note", timestamp: "2026-07-09T08:00:00", behaviorType: "Moment", trigger: NOTE }]; h.memory = []; h.disposed = false; h.confirmed = true; h.shared = {}; h.write = vi.fn(); now = new Date(2026, 9, 12, 8); });

describe("record answer lifecycle", () => {
  it("selects approved memory fields and keeps the real memoryId for receipts and the quiet window", async () => {
    h.logs = [];
    const newest = memory(), older = memory({ memoryId: "memory-home", fact: "Moved to a new home in August.", createdAt: "2026-09-01T08:00:00Z", latestEventId: "memory-event-home" });
    h.memory = [older, newest];
    const first = render();
    expect(first.opener).toEqual({ key: `fact:${newest.memoryId}`, kind: "fact", topic: null, quote: newest.fact, quoteSource: "fact", quoteAt: newest.createdAt });
    await first.answer("easier");
    expect(h.write).toHaveBeenCalledWith(first.opener, "easier", now);
    const receipt = render().receipt!;
    expect(receipt).toMatchObject({ recordKey: `fact:${newest.memoryId}`, recommendation: newest.fact, reflection: "easier" });
    h.loop = [receipt]; now = new Date(2026, 9, 13, 8);
    expect(render().opener).toMatchObject({ key: `fact:${older.memoryId}`, quote: older.fact, quoteAt: older.createdAt });
    now = new Date(2026, 9, 20, 8);
    expect(render().opener?.key).toBe(`fact:${newest.memoryId}`);
  });
  it.each(["pending", "rejected", "deleted"] as const)("preserves %s memory status so unapproved facts stay out of selection", status => {
    h.logs = []; h.memory = [memory({ status })];
    expect(render().opener).toBeNull();
  });
  it("waits for persistence, rejects double taps, then renders one receipt", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise);
    const first = render(); const save = first.answer("easier"); void first.answer("hard_again");
    expect(h.write).toHaveBeenCalledTimes(1);
    expect(render()).toMatchObject({ saving: true, receipt: null });
    pending.resolve(); await save;
    expect(render()).toMatchObject({ saving: false, receipt: { recommendation: NOTE } });
    await first.answer("other"); expect(h.write).toHaveBeenCalledTimes(1);
  });
  it("keeps the original opener and retry on write failure, even when a new note arrives", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise);
    const first = render(); const save = first.answer("easier"); pending.reject(Error("quota")); await save;
    h.logs = [{ id: "new-note", timestamp: "2026-08-09T08:00:00", behaviorType: "Moment", trigger: "A completely different moment that arrived." }];
    const failed = render(); expect(failed).toMatchObject({ error: true, receipt: null, opener: { quote: NOTE } });
    h.write.mockResolvedValue(undefined); await failed.answer("hard_again");
    expect(render().receipt?.recommendation).toBe(NOTE);
    expect(h.write).toHaveBeenCalledTimes(2);
  });
  it("does not let an optimistic ledger echo become a false receipt before the write resolves", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise);
    const first = render(); const save = first.answer("easier"); h.loop = [fromRecordEntry(first.opener!, "easier", "a", now)];
    expect(render()).toMatchObject({ saving: true, receipt: null });
    pending.reject(Error("rules")); await save;
    expect(render()).toMatchObject({ error: true, receipt: null });
  });
  it("does not let a late answer or captured callback leak across a child switch", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise);
    const first = render(); const save = first.answer("easier");
    h.child = "b"; h.logs = []; expect(render()).toMatchObject({ opener: null, receipt: null, saving: false });
    pending.resolve(); await save; await first.answer("other");
    expect(render()).toMatchObject({ opener: null, receipt: null, saving: false });
    expect(h.write).toHaveBeenCalledTimes(1);
  });
  it("waits for a confirmed initial ledger before offering a new daily answer", async () => {
    h.confirmed = false; const initial = render();
    expect(initial).toMatchObject({ saving: true, confirming: true, receipt: null });
    await initial.answer("easier"); expect(h.write).not.toHaveBeenCalled();
    h.confirmed = true; const ready = render(); expect(ready.saving).toBe(false);
    await ready.answer("easier"); expect(h.write).toHaveBeenCalledOnce();
  });
  it("keeps pending and failed say-back writes in their disclosure, never the record lead", () => {
    for (const status of ["saving", "failed", "saved"]) {
      h.shared[fromRecordRowId("a", now)] = { opener: { kind: "said" }, status };
      expect(render()).toMatchObject({ opener: null, receipt: null, saving: false, error: false });
    }
  });
  it("does not revive a stale local receipt on child A→B→A", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise); const first = render(); const save = first.answer("easier");
    h.child = "b"; render(); h.child = "a"; render(); pending.resolve(); await save;
    expect(render().receipt).toBeNull(); await first.answer("other"); expect(h.write).toHaveBeenCalledOnce();
  });
  it("a hard-refresh cached or pending answer cannot claim a saved receipt before source confirmation", () => {
    const first = render(); h.loop = [fromRecordEntry(first.opener!, "easier", "a", now)]; h.confirmed = false;
    expect(render()).toMatchObject({ receipt: null, saving: true, confirming: true });
    h.confirmed = true; expect(render().receipt?.recommendation).toBe(NOTE);
  });
  it("re-entry or a language remount keeps an in-flight or failed shared answer honest", () => {
    const first = render(); const row = fromRecordEntry(first.opener!, "easier", "a", now);
    h.loop = [row]; h.shared[row.id] = { opener: first.opener, status: "saving" };
    h.slots = []; h.effects = [];
    expect(render()).toMatchObject({ saving: true, receipt: null, opener: { quote: NOTE } });
    h.shared[row.id] = { opener: first.opener, status: "failed" }; h.confirmed = false;
    expect(render()).toMatchObject({ saving: false, error: true, receipt: null, opener: { quote: NOTE } });
    h.shared[row.id] = { opener: first.opener, status: "saved", entry: row };
    expect(render()).toMatchObject({ saving: false, error: false, receipt: row });
  });
  it("settling after unmount does not update disposed state", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise);
    const save = render().answer("easier"); h.slots.forEach(slot => slot?.cleanup?.()); h.disposed = true;
    pending.resolve(); await expect(save).resolves.toBeUndefined();
  });
  it("read-only re-entry shows an existing answer, while a different child and tomorrow stay empty", () => {
    const first = render(); h.loop = [fromRecordEntry(first.opener!, "easier", "a", now)];
    expect(render().receipt?.recommendation).toBe(NOTE);
    h.child = "b"; h.logs = []; expect(render().receipt).toBeNull();
    h.child = "a"; now = new Date(2026, 9, 13, 8); expect(render().receipt).toBeNull();
  });
});
