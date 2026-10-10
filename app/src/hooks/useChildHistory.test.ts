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
  useCallback: (callback: unknown, deps: unknown[]) => {
    const index = h.cursor++;
    const previous = h.slots[index] as { deps: unknown[]; callback: unknown } | undefined;
    if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return previous.callback;
    h.slots[index] = { deps, callback };
    return callback;
  },
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
let sandboxItems: Row[] | undefined;
const render = (flush = true) => {
  h.cursor = 0;
  const value = useChildHistory<Row>(child, name, "timestamp", sandboxItems);
  if (flush) { const pending = h.pending.splice(0); pending.forEach(effect => effect()); }
  return value;
};
const settle = () => { render(); return render(); };
const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `r-${i}`, timestamp: new Date(Date.UTC(2026, 9, 1) - i * 86400000).toISOString() }));
const deliver = (index: number, values: Row[], fromCache = false) => h.listeners[index].next({ docs: values.map(value => ({ id: value.id, data: () => value })), metadata: { fromCache } });

beforeEach(() => {
  h.slots = []; h.pending = []; h.listeners = []; h.cursor = 0; h.uid = "account-a"; h.enabled = true;
  child = "child-a"; name = "behaviorLogs"; sandboxItems = undefined;
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => "[]"), setItem: vi.fn() });
});

describe("bounded child history reads", () => {
  it.each(["child", "account"])("retires a captured guard across immediate %s ABA without effects", kind => {
    render(); deliver(0, rows(2)); const before = render();
    if (kind === "child") child = "child-b"; else h.uid = "account-b";
    render(false);
    if (kind === "child") child = "child-a"; else h.uid = "account-a";
    render(false);
    expect(before.isCurrent()).toBe(false);
  });
  it("retains an unchanged sandbox callback but rejects changed current context before commit", () => {
    h.enabled = false; sandboxItems = rows(3);
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(sandboxItems));
    settle(); const before = render();
    sandboxItems = rows(3); render(false);
    expect(before.isCurrent()).toBe(true);
    sandboxItems = rows(2); render(false);
    expect(before.isCurrent()).toBe(false);
  });

  it("does not confirm a server-connected snapshot whose writes are still pending", () => {
    render();
    h.listeners[0].next({ docs: rows(2).map(value => ({ id: value.id, data: () => value })), metadata: { fromCache: false, hasPendingWrites: true } });
    const pending = render();
    expect(pending.confirmed).toBe(false);
    expect(pending.isCurrent()).toBe(false);
    deliver(0, rows(2));
    expect(render().isCurrent()).toBe(true);
  });
  it.each(["changed", "pending", "error"])("invalidates a captured confirmed guard synchronously on a %s callback before React commits", change => {
    render(); deliver(0, rows(2));
    const confirmed = render();
    expect(confirmed.isCurrent()).toBe(true);
    if (change === "error") h.listeners[0].fail();
    else h.listeners[0].next({ docs: rows(change === "changed" ? 1 : 2).map(value => ({ id: value.id, data: () => value })), metadata: { fromCache: false, hasPendingWrites: change === "pending" } });
    // Deliberately no render: the native Send callback can run before commit.
    expect(confirmed.isCurrent()).toBe(false);
    const updated = render();
    expect(updated.isCurrent()).toBe(change === "changed");
    deliver(0, rows(2));
    expect(render().isCurrent()).toBe(true);
  });
  it("an obsolete listener cannot invalidate the new child snapshot", () => {
    render(); deliver(0, rows(2)); render();
    child = "child-b"; settle();
    deliver(1, rows(3)); const current = render();
    expect(current.isCurrent()).toBe(true);
    deliver(0, rows(1)); h.listeners[0].fail();
    expect(current.isCurrent()).toBe(true);
  });
  it("requesting a reload invalidates the old export guard before its read effect runs", () => {
    render(); deliver(0, rows(2)); const confirmed = render();
    confirmed.reload();
    expect(confirmed.isCurrent()).toBe(false);
    render(); deliver(1, rows(2));
    expect(render().isCurrent()).toBe(true);
  });
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
  it("revalidates same-document local edits and deletions before egress without writing", () => {
    h.enabled = false;
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(rows(3)));
    settle();
    const initial = render();
    expect(initial.isCurrent()).toBe(true);
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(rows(2)));
    expect(initial.isCurrent()).toBe(false);
    initial.reload(); settle();
    const fresh = render();
    expect(fresh.items).toHaveLength(2); expect(fresh.isCurrent()).toBe(true);
    vi.mocked(localStorage.getItem).mockReturnValue("[]");
    expect(fresh.isCurrent()).toBe(false);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
  it("rejects a captured egress callback after account/child ABA or a cache/error update", () => {
    render(); deliver(0, rows(2));
    const original = render(); expect(original.isCurrent()).toBe(true);
    child = "child-b"; settle(); child = "child-a"; settle();
    deliver(h.listeners.length - 1, rows(2));
    const current = render(); expect(current.isCurrent()).toBe(true); expect(original.isCurrent()).toBe(false);
    h.listeners.at(-1)!.fail();
    expect(render().isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(false);
  });
  it("keeps the current egress guard valid across an unchanged React rerender", () => {
    render(); deliver(0, rows(2));
    const before = render(); expect(before.isCurrent()).toBe(true);
    const after = render();
    expect(after.isCurrent()).toBe(true);
    // React may bail out an unchanged parent render and keep the child's
    // previous callback. Unchanged source identity must remain usable.
    expect(before.isCurrent()).toBe(true);
  });
  it("does not validate old rows when a reload effect has read new storage before commit", () => {
    h.enabled = false;
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(rows(3)));
    settle(); const initial = render();
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(rows(2)));
    initial.reload();
    // This returns the old rows, then flushes the read effect. React has not
    // rerendered the new snapshot yet, so this callback must remain invalid.
    const beforeCommit = render();
    expect(beforeCommit.items).toHaveLength(3);
    expect(beforeCommit.isCurrent()).toBe(false);
    const committed = render();
    expect(committed.items).toHaveLength(2); expect(committed.isCurrent()).toBe(true);
  });
  it("cannot pair stale sandbox context rows with a freshly reloaded cross-tab storage snapshot", () => {
    h.enabled = false; sandboxItems = rows(3);
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(sandboxItems));
    settle(); expect(render().isCurrent()).toBe(true);
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(rows(2)));
    render().reload(); settle();
    expect(render().items).toHaveLength(3);
    expect(render().isCurrent()).toBe(false);
    sandboxItems = rows(2);
    expect(render().isCurrent()).toBe(true);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
