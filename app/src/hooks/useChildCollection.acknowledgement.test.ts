import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], effects: [] as (() => void)[], remote: true, disposed: false, listeners: [] as any[], write: vi.fn(), store: new Map<string, string>(), storageFail: false }));
vi.mock("react", () => ({
  useState: (initial: any) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial; return [h.slots[i], (next: any) => { if (h.disposed) throw Error("setState after unmount"); h.slots[i] = typeof next === "function" ? next(h.slots[i]) : next; }]; },
  useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: () => 0,
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, prev = h.slots[i]; if (prev && deps.every((d, n) => Object.is(d, prev.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; h.slots[i] = slot; h.effects.push(() => { prev?.cleanup?.(); slot.cleanup = effect(); }); },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "parent" } }) }));
vi.mock("../lib/firebase", () => ({ db: {}, get firebaseEnabled() { return h.remote; } }));
vi.mock("../lib/syncStore", () => ({ clearSyncError: vi.fn(), reportSyncError: vi.fn(), getSyncSnapshot: () => 0, subscribeSyncStatus: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }), doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  orderBy: vi.fn(), limit: vi.fn(), query: (q: unknown) => q, setDoc: (...args: unknown[]) => h.write(...args),
  deleteDoc: vi.fn(), writeBatch: vi.fn(),
  onSnapshot: (q: unknown, ...args: any[]) => { const options = typeof args[0] === "function" ? null : args.shift(); const item = { q, options, next: args[0], fail: args[1], stop: vi.fn() }; h.listeners.push(item); return item.stop; },
}));
import { useChildCollection } from "./useChildCollection";
let child = "a";
const render = (trackConfirmation = true) => { h.cursor = 0; const result = useChildCollection<{ id: string }>(child, "actionLoops", { trackConfirmation }); h.effects.splice(0).forEach(fn => fn()); return result; };
const snapshot = (id: string, fromCache: boolean, hasPendingWrites: boolean) => ({ empty: false, docs: [{ id, data: () => ({}) }], metadata: { fromCache, hasPendingWrites } });
function deferred() { let resolve!: () => void, reject!: (error: unknown) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
beforeEach(() => { h.cursor = 0; h.slots = []; h.effects = []; h.remote = true; h.listeners = []; h.disposed = false; h.store.clear(); h.storageFail = false; child = "a"; h.write = vi.fn(); vi.stubGlobal("navigator", { onLine: true }); vi.stubGlobal("localStorage", { getItem: (key: string) => h.store.get(key) ?? null, setItem: (key: string, value: string) => { if (h.storageFail) throw Error("quota"); h.store.set(key, value); } }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("opt-in truthful record acknowledgement", () => {
  it("stays pending after the legacy four-second queue timeout and while offline, then resolves only on acknowledgement", async () => {
    vi.useFakeTimers(); vi.stubGlobal("navigator", { onLine: false }); const write = deferred(); h.write.mockReturnValue(write.promise);
    let settled = false; const saved = render().upsert({ id: "record" }, { awaitServer: true }).then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(6000); expect(settled).toBe(false);
    write.resolve(); await saved; expect(settled).toBe(true);
  });
  it("leaves queued-write semantics unchanged for callers that do not opt in", async () => {
    vi.useFakeTimers(); const write = deferred(); h.write.mockReturnValue(write.promise);
    let settled = false; const saved = render(false).upsert({ id: "ordinary" }).then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(4000); await saved; expect(settled).toBe(true);
    expect(h.listeners[0].options).toBeNull(); write.resolve();
  });
  it("propagates server rejection; a late acknowledgement after unmount does not update hook state", async () => {
    const one = deferred(); h.write.mockReturnValueOnce(one.promise); const collection = render();
    const saving = collection.upsert({ id: "record" }, { awaitServer: true }); const rejected = expect(saving).rejects.toThrow("rules"); one.reject(Error("rules")); await rejected;
    const two = deferred(); h.write.mockReturnValueOnce(two.promise); const pending = collection.upsert({ id: "record" }, { awaitServer: true });
    h.slots.forEach(slot => slot?.cleanup?.()); h.disposed = true; two.resolve(); await expect(pending).resolves.toBeUndefined();
  });
  it("confirms only server/current/non-pending snapshots, including metadata-only transitions and stale listener rejection", () => {
    render(); expect(h.listeners[0].options).toEqual({ includeMetadataChanges: true });
    h.listeners[0].next(snapshot("record", true, false)); expect(render().confirmed).toBe(false);
    h.listeners[0].next(snapshot("record", false, true)); expect(render().confirmed).toBe(false);
    h.listeners[0].next(snapshot("record", false, false)); expect(render().confirmed).toBe(true);
    child = "b"; expect(render().confirmed).toBe(false); h.listeners[0].next(snapshot("old", false, false)); expect(render().items).toEqual([]);
    h.listeners[1].next(snapshot("new", false, false)); expect(render().confirmed).toBe(true);
    h.listeners[1].fail(); expect(render().confirmed).toBe(false);
  });
  it("sandbox acknowledgement still requires successful local persistence", async () => {
    h.remote = false; render(); const collection = render(); await collection.upsert({ id: "record" }, { awaitServer: true });
    expect(h.store.get("arbor.actionLoops.a")).toContain('"record"');
    h.storageFail = true; await expect(collection.upsert({ id: "other" }, { awaitServer: true })).rejects.toThrow("quota");
  });
});
