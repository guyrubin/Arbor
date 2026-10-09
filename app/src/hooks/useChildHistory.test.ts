import { beforeEach, describe, expect, it, vi } from "vitest";

// Execute the actual hook with a small deterministic hook host. Network
// callbacks and effect cleanup remain separate, so late responses are real.
const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as unknown[], pending: [] as (() => void)[],
  uid: "account-a", enabled: true,
  listeners: [] as { path: string; max: number; next: (snapshot: unknown) => void; fail: () => void; stop: ReturnType<typeof vi.fn> }[],
}));
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === "function" ? initial() : initial;
    return [h.slots[index], (next: unknown) => { h.slots[index] = typeof next === "function" ? next(h.slots[index]) : next; }];
  },
  useRef: (initial: unknown) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = h.cursor++;
    const previous = h.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
    const slot = { deps, cleanup: previous?.cleanup };
    h.slots[index] = slot;
    h.pending.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
  },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../lib/firebase", () => ({ db: {}, get firebaseEnabled() { return h.enabled; } }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  documentId: () => "__name__", orderBy: (field: string, direction?: string) => ({ field, direction }),
  limit: (max: number) => ({ max }),
  query: (ref: { path: string }, ...parts: { max?: number }[]) => ({ ...ref, max: parts.find(part => part.max)?.max }),
  onSnapshot: (q: { path: string; max: number }, _options: unknown, next: (value: unknown) => void, fail: () => void) => {
    const listener = { ...q, next, fail, stop: vi.fn() }; h.listeners.push(listener); return listener.stop;
  },
}));
import { useChildHistory } from "./useChildHistory";

type Row = { id: string; timestamp: string };
let child = "child-a";
let name = "behaviorLogs";
const render = (flush = true) => {
  h.cursor = 0;
  const value = useChildHistory<Row>(child, name, "timestamp");
  if (flush) { const pending = h.pending.splice(0); pending.forEach(effect => effect()); }
  return value;
};
const settle = () => { render(); return render(); };
const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `r-${i}`, timestamp: new Date(Date.UTC(2026, 9, 1) - i * 86400000).toISOString() }));
const deliver = (index: number, values: Row[], fromCache = false) => h.listeners[index].next({ docs: values.map(value => ({ id: value.id, data: () => value })), metadata: { fromCache } });

beforeEach(() => {
  h.slots = []; h.pending = []; h.listeners = []; h.cursor = 0; h.uid = "account-a"; h.enabled = true;
  child = "child-a"; name = "behaviorLogs";
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => "[]"), setItem: vi.fn() });
});

describe("bounded child history reads", () => {
  it.each(["behaviorLogs", "langObs"])("%s loads an older-than-limit source through a real larger query", collection => {
    name = collection;
    expect(render().loading).toBe(true);
    expect(h.listeners[0]).toMatchObject({ path: `users/account-a/children/child-a/${collection}`, max: 201 });
    deliver(0, rows(201));
    const initial = render(); expect(initial.items).toHaveLength(200); expect(initial.more).toBe(true);
    initial.loadMore();
    expect(render().loading).toBe(true);
    expect(h.listeners[0].stop).toHaveBeenCalled();
    expect(h.listeners[1].max).toBe(401);
    deliver(1, rows(221));
    const older = render(); expect(older.items[220].id).toBe("r-220"); expect(older.more).toBe(false); expect(older.confirmed).toBe(true);
  });
  it("does not confuse an exactly full final page with more history", () => {
    render(); deliver(0, rows(200)); expect(render().more).toBe(false);
  });
  it("hides prior child/account rows before effects and rejects pending snapshots across ABA switches", () => {
    render(); deliver(0, rows(201)); render().loadMore(); render();
    child = "child-b"; expect(render(false).items).toEqual([]);
    deliver(1, rows(400)); expect(render(false).items).toEqual([]);
    settle(); child = "child-a"; settle();
    deliver(1, rows(400)); expect(render().items).toEqual([]);
    expect(h.listeners.at(-1)?.max).toBe(201);
    const current = h.listeners.length - 1; deliver(current, rows(3)); expect(render().items).toHaveLength(3);
    h.uid = "account-b"; expect(render(false).items).toEqual([]); settle();
    deliver(current, rows(5)); expect(render().items).toEqual([]);
    expect(h.listeners.at(-1)?.path).toContain("users/account-b/children/child-a");
  });
  it("keeps cached/error records explicitly unconfirmed and can retry", () => {
    render(); deliver(0, rows(3), true); expect(render()).toMatchObject({ confirmed: false, error: false });
    h.listeners[0].fail(); expect(render()).toMatchObject({ error: true, confirmed: false }); expect(render().items).toHaveLength(3);
    render().reload(); render(); deliver(1, rows(3)); expect(render()).toMatchObject({ confirmed: true, error: false });
  });
  it("reads local history in bounded windows without overwriting the collection", () => {
    h.enabled = false; vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(rows(450)));
    settle(); expect(render().items).toHaveLength(200); render().loadMore(); settle();
    expect(render().items).toHaveLength(400); expect(localStorage.setItem).not.toHaveBeenCalled();
    render().loadMore(); settle(); expect(render().items).toHaveLength(450); expect(render().more).toBe(false);
  });
});
