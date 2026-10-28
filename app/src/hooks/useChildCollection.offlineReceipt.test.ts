/**
 * B-DATA-14 — an awaited save answers in bounded time. The ACTUAL
 * useChildCollection upsert, with only React and Firestore replaced (no SDK,
 * no network). With `awaitServer` + `offline`, an offline (or unconfirmed in
 * time) write resolves as kept on this phone (`onQueued`) and reports the
 * later server acknowledgement (`onSynced`); a rejection in time still
 * rejects. Without `offline`, the existing awaited receipts are unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ChildCollection } from "./useChildCollection";
import type { ActionLoopEntry } from "../actionLoop/model";
import { settleOrQueue, QUEUED_ACK_MS } from "../lib/firestoreWrite";
import { sameLocalHistoryRows } from "../lib/historyWindow";
import * as syncStore from "../lib/syncStore";

function collectionHarness() {
  const write = vi.fn<(path: string, row: ActionLoopEntry) => Promise<void>>().mockResolvedValue();
  const react = {
    useCallback: (fn: unknown) => fn, useEffect: () => {}, useRef: (value: unknown) => ({ current: value }),
    useState: (value: unknown) => [value, () => {}], useSyncExternalStore: () => 0,
  };
  const imports: Record<string, unknown> = {
    react,
    "firebase/firestore": { doc: (_db: unknown, ...parts: string[]) => parts.join("/"), setDoc: (path: string, row: ActionLoopEntry) => write(path, row) },
    "../lib/firebase": { db: {}, firebaseEnabled: true }, "../context/AuthContext": { useAuth: () => ({ user: { uid: "owner" } }) },
    "../lib/syncStore": syncStore, "../lib/firestoreWrite": { settleOrQueue }, "../lib/historyWindow": { sameLocalHistoryRows },
  };
  const code = ts.transpileModule(readFileSync(new URL("./useChildCollection.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as { useChildCollection: (child: string, name: string) => ChildCollection<ActionLoopEntry> } };
  new Function("require", "module", "exports", code)((name: string) => { if (!(name in imports)) throw Error("Unmocked boundary: " + name); return imports[name]; }, module, module.exports);
  return { collection: module.exports.useChildCollection("child-a", "actionLoops"), write };
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const row: ActionLoopEntry = { id: "today.child-a.2026-10-28", recommendation: "Name the feeling", status: "completed", outcome: "helped", source: "coach", capacity: "standard", acceptedAt: "2026-10-28T08:00:00.000Z" };
const settled = (p: Promise<unknown>) => { const state = { done: false, error: null as unknown }; p.then(() => { state.done = true; }, (e) => { state.error = e; }); return state; };

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("navigator", { onLine: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("B-DATA-14 — a receipt write answers in bounded time", () => {
  it("offline: kept on this phone at once (onQueued), then onSynced when the server acknowledges", async () => {
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValue(pending.promise);
    vi.stubGlobal("navigator", { onLine: false });
    const onQueued = vi.fn(), onSynced = vi.fn();
    const state = settled(h.collection.upsert(row, { awaitServer: true, offline: { onQueued, onSynced } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.done).toBe(true); expect(onQueued).toHaveBeenCalledOnce(); expect(onSynced).not.toHaveBeenCalled();
    pending.resolve(); await vi.advanceTimersByTimeAsync(0);
    expect(onSynced).toHaveBeenCalledOnce();
  });

  it("online, no answer within QUEUED_ACK_MS: kept on this phone, never an endless wait", async () => {
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValue(pending.promise);
    const onQueued = vi.fn();
    const state = settled(h.collection.upsert(row, { awaitServer: true, offline: { onQueued } }));
    await vi.advanceTimersByTimeAsync(QUEUED_ACK_MS - 1); expect(state.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(state.done).toBe(true); expect(onQueued).toHaveBeenCalledOnce();
    pending.resolve();
  });

  it("online and acknowledged in time: a plain save, not 'on this phone'", async () => {
    const h = collectionHarness(); const onQueued = vi.fn();
    await h.collection.upsert(row, { awaitServer: true, offline: { onQueued } });
    expect(onQueued).not.toHaveBeenCalled();
  });

  it("a rejection in time still rejects (the caller keeps its retry)", async () => {
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValue(pending.promise);
    const onQueued = vi.fn();
    const saving = expect(h.collection.upsert(row, { awaitServer: true, offline: { onQueued } })).rejects.toThrow("permission-denied");
    pending.reject(new Error("permission-denied")); await saving;
    expect(onQueued).not.toHaveBeenCalled();
  });

  it("a rejection AFTER the receipt is never swallowed: the sync banner reports it and onRejected takes the receipt back", async () => {
    syncStore.__resetSyncStoreForTests();
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValue(pending.promise);
    vi.stubGlobal("navigator", { onLine: false });
    const onQueued = vi.fn(), onSynced = vi.fn(), onRejected = vi.fn();
    await h.collection.upsert(row, { awaitServer: true, offline: { onQueued, onSynced, onRejected } });
    expect(onQueued).toHaveBeenCalledOnce();
    pending.reject(new Error("permission-denied")); await vi.advanceTimersByTimeAsync(0);
    expect(onRejected).toHaveBeenCalledOnce(); expect(onSynced).not.toHaveBeenCalled();
    expect(syncStore.getSyncSnapshot().errors).toContainEqual({ name: "actionLoops:write", childId: "child-a" });
  });

  it("without `offline`, an awaited receipt still waits for the server (unchanged callers)", async () => {
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValue(pending.promise);
    vi.stubGlobal("navigator", { onLine: false });
    const state = settled(h.collection.upsert(row, { awaitServer: true }));
    await vi.advanceTimersByTimeAsync(QUEUED_ACK_MS * 3); expect(state.done).toBe(false);
    pending.resolve(); await vi.advanceTimersByTimeAsync(0); expect(state.done).toBe(true);
  });
});
