import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], effects: [] as (() => void)[], owner: "parent", listeners: new Set<() => void>(),
  store: { loaded: true, remote: true, error: false, items: [] as any[], isCurrent: (): boolean => true, upsert: vi.fn() },
}));
vi.mock("react", () => ({
  useState: (initial: unknown) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? (initial as () => unknown)() : initial; return [h.slots[i], (next: any) => { h.slots[i] = typeof next === "function" ? next(h.slots[i]) : next; }]; },
  useRef: (value: unknown) => h.slots[h.cursor++] ??= { current: value },
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void | (() => void), deps: unknown[]) => {
    const i = h.cursor++, previous = h.slots[i];
    if (previous && deps.every((v, n) => Object.is(v, previous.deps[n]))) return;
    const slot = h.slots[i] = { deps, cleanup: undefined as any };
    h.effects.push(() => { previous?.cleanup?.(); slot.cleanup = fn(); });
  },
}));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => h.store }));
vi.mock("../../lib/heroSheetStore", () => ({ heroSheetOwnerKey: () => h.owner, subscribeHeroSheetOwner: (fn: () => void) => { h.listeners.add(fn); return () => h.listeners.delete(fn); } }));
import { useBookBookmark } from "./useBookBookmark";
import { fiveSmoothStones as book } from "../../lib/library/books/fiveSmoothStones";
import { bookmarkFor } from "../../lib/library/bookBookmarks";
import { initialBookFlow } from "../../lib/library/bookFlow";
const position = { at: book.pages[0].id, choiceId: null };
const render = (child = "kid", edition = "edition") => { h.cursor = 0; const value = useBookBookmark(child, book, edition, h.owner); h.effects.splice(0).forEach(fn => fn()); return value; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const unmount = () => h.slots.forEach(slot => slot?.cleanup?.());
function deferred() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.owner = "parent"; h.listeners.clear();
  h.store = { loaded: true, remote: true, error: false, items: [], isCurrent: () => true, upsert: vi.fn().mockResolvedValue(undefined) };
});
afterEach(unmount);
describe("bookmarks never become a reading or privacy barrier", () => {
  it("reopens a safe owner-scoped offline cache without requiring server confirmation", () => {
    h.store.items = [bookmarkFor(book, "edition", position)]; h.store.isCurrent = () => false;
    render(); expect(render().initialState?.at).toBe(position.at);
  });
  it("malformed local array entries never block the reader", () => {
    h.store.remote = false; h.store.items = [null, 3, "bad", {}, { id: book.id, v: 999 }];
    render(); expect(render().initialState).toEqual(initialBookFlow());
  });
  it.each(["listener", "sandbox"])("%s failure ignores unsafe rows and opens the cover", mode => {
    h.store.items = [bookmarkFor(book, "edition", position)]; h.store.isCurrent = () => false;
    h.store.remote = mode === "listener"; h.store.error = mode === "listener";
    render(); const ready = render(); expect(ready.initialState).toEqual(initialBookFlow()); expect(ready.status).toBe("error");
    ready.save(position); render(); expect(h.store.upsert).not.toHaveBeenCalled();
  });
  it("waits for initial load then keeps the chosen initial state stable while reading", () => {
    h.store.loaded = false; expect(render().initialState).toBeNull();
    h.store.loaded = true; render(); const state = render().initialState;
    h.store.items = [bookmarkFor(book, "edition", position)]; render(); expect(render().initialState).toBe(state);
  });
  it("coalesces navigation during a write and persists the newest position next", async () => {
    render(); const pending = deferred(); h.store.upsert.mockReturnValueOnce(pending.promise);
    render().save(position); render(); expect(h.store.upsert).toHaveBeenCalledTimes(1);
    const newer = { ...position, at: book.pages[1].id }; render().save(newer); render(); expect(h.store.upsert).toHaveBeenCalledTimes(1);
    pending.resolve(); await flush(); render(); await flush(); render();
    expect(h.store.upsert).toHaveBeenLastCalledWith(bookmarkFor(book, "edition", newer), { requireAcknowledgement: true });
    expect(render().status).toBe("saved");
  });
  it("failed writes retain the position for an explicit retry", async () => {
    render(); h.store.upsert.mockRejectedValueOnce(Error("quota")); render().save(position); render(); await flush();
    expect(render().status).toBe("error"); render(); expect(h.store.upsert).toHaveBeenCalledTimes(1);
    render().retry(); render(); await flush(); expect(render().status).toBe("saved");
    expect(h.store.upsert).toHaveBeenCalledTimes(2);
  });
  it.each(["child", "edition"])("held callbacks cannot save after a %s switch", kind => {
    render(); const old = render(); render(kind === "child" ? "next" : "kid", kind === "edition" ? "next" : "edition");
    old.save(position); render(); expect(old.current()).toBe(false); expect(h.store.upsert).not.toHaveBeenCalled();
  });
  it.each(["child", "edition"])("an offline pending bookmark cannot migrate after a %s switch", kind => {
    render(); h.store.isCurrent = () => false; render().save(position); render();
    h.store.isCurrent = () => true; render(kind === "child" ? "next" : "kid", kind === "edition" ? "next" : "edition");
    expect(h.store.upsert).not.toHaveBeenCalled();
  });
  it("an owner round trip and unmount retire asynchronous writes before completion feedback", async () => {
    render(); const old = render(), pending = deferred(); h.store.upsert.mockReturnValue(pending.promise);
    old.save(position); render(); h.owner = "other"; h.listeners.forEach(fn => fn()); h.owner = "parent"; h.listeners.forEach(fn => fn());
    expect(old.current()).toBe(false); unmount(); pending.resolve(); await flush(); expect(h.store.upsert).toHaveBeenCalledTimes(1);
  });
});
