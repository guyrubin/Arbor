/** Executes the actual modal's confirmation callback with the real private
 * book store. React slots, API/SDK and other device stores are synthetic. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
const h = vi.hoisted(() => ({
  owner: { uid: "synthetic-owner" } as { uid: string } | null,
  renderedOwner: { uid: "synthetic-owner" } as { uid: string } | null,
  listeners: new Set<(owner: { uid: string } | null) => void>(),
  cursor: 0, slots: [] as { value?: any; deps?: unknown[]; cleanup?: () => void }[], effects: [] as (() => void)[],
  accountDelete: vi.fn(), comic: vi.fn(), hero: vi.fn(), signOut: vi.fn(), close: vi.fn(), removeItem: vi.fn(), allowed: true,
}));
const same = vi.hoisted(() => (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && b.every((v, n) => Object.is(v, a[n])));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState(initial: unknown) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === "function" ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === "function" ? next(slot.value) : next; }]; },
  useRef(initial: unknown) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
  useId() { return `synthetic-${h.cursor++}`; },
  useCallback(callback: unknown, deps: unknown[]) { const i = h.cursor++; const old = h.slots[i]; if (same(old?.deps, deps)) return old.value; return (h.slots[i] = { value: callback, deps }).value; },
  useLayoutEffect(effect: () => void | (() => void), deps: unknown[]) {
    const i = h.cursor++, old = h.slots[i]; if (same(old?.deps, deps)) return;
    const slot = h.slots[i] = { deps, cleanup: old?.cleanup };
    h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
  },
  useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
}));
vi.mock("../../lib/firebase", () => ({ firebaseEnabled: true, auth: { get currentUser() { return h.owner; } } }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: h.renderedOwner, firebaseEnabled: true, signOut: h.signOut }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key === "set.acctDel.confirmWord" ? "DELETE" : key }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../lib/api", async importOriginal => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return { ...actual, api: { ...actual.api, accountDelete: h.accountDelete } };
});
vi.mock("firebase/auth", () => ({ onAuthStateChanged: (_auth: unknown, listener: (owner: { uid: string } | null) => void) => {
  h.listeners.add(listener); return () => h.listeners.delete(listener);
} }));
vi.mock("../../lib/comicPageStore", () => ({ purgeAllComicPages: h.comic }));
vi.mock("../../lib/heroRenderStore", () => ({ purgeAllHeroRenders: h.hero }));
vi.mock("../kidmode/parentGate", () => ({ commerceAllowed: () => h.allowed }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
import DeleteAccountModal from "./DeleteAccountModal";
import { createBookAssetScope, fetchBookAssetResult, setBookAssetBackend, type BookAssetBackend, type CachedFile } from "../../lib/bookAssetStore";
import { accountDeletionLeases } from "../../lib/accountDeletionLease";
import { setAuthTokenProvider } from "../../lib/api";
const { api: productionApi } = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
const rel = "hero-sheets/synthetic/sit.webp", lateRel = "hero-sheets/synthetic/stand.webp";
const doc: BookAssetsDoc = { id: "synthetic-book", bookId: "synthetic-book", sheetId: "synthetic", setId: "synthetic", sheetManifest: { poses: { sit: { file: "sit.webp" }, stand: { file: "stand.webp" } } }, files: [rel, lateRel], bytes: 5, createdAt: "synthetic-version" };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const elements = (value: any): any[] => Array.isArray(value) ? value.flatMap(elements) : value && typeof value === "object" ? [value, ...elements(value.props?.children)] : [];
const render = () => { h.cursor = 0; return DeleteAccountModal({ open: true, onClose: h.close }); };
const commit = () => { h.effects.splice(0).forEach(effect => effect()); };
const unmount = () => { h.slots.forEach(slot => slot.cleanup?.()); };
const confirm = () => {
  render(); commit();
  const input = elements(render()).find(node => node.type === "input"); input.props.onChange({ target: { value: "DELETE" } });
  const button = elements(render()).find(node => node.type === "button" && node.props.children === "set.acctDel.confirm");
  expect(button.props.disabled).toBe(false); button.props.onClick();
};
let records: Map<string, CachedFile>;
let fetcher: ReturnType<typeof vi.fn>;
let put: ReturnType<typeof vi.fn<BookAssetBackend["put"]>>;
let deleted: ReturnType<typeof vi.fn<BookAssetBackend["deleteWhere"]>>;
let settlements: (() => void)[];
let counter = 0;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); h.owner = { uid: `synthetic-owner-${++counter}` }; h.allowed = true;
  h.renderedOwner = h.owner; h.listeners.clear(); setAuthTokenProvider(async () => "synthetic-token");
  h.cursor = 0; h.slots = []; h.effects = []; settlements = [];
  h.accountDelete.mockReset().mockResolvedValue({ complete: true, classes: [] }); h.comic.mockReset().mockResolvedValue(undefined); h.hero.mockReset().mockResolvedValue(undefined); h.signOut.mockReset().mockResolvedValue(undefined);
  records = new Map(); put = vi.fn<BookAssetBackend["put"]>(async (rec) => { records.set(rec.id, rec); });
  deleted = vi.fn<BookAssetBackend["deleteWhere"]>(async (pred) => { for (const [id, rec] of records) if (pred(rec)) records.delete(id); });
  setBookAssetBackend({ get: async id => records.get(id), put, deleteWhere: deleted });
  fetcher = vi.fn(async () => new Response("synthetic book bytes")); vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("localStorage", { "arbor.synthetic": "private", removeItem: h.removeItem });
});
afterEach(async () => {
  unmount(); setBookAssetBackend(null); settlements.splice(0).forEach(settle => settle()); await tick();
  expect(h.listeners.size).toBe(0); setAuthTokenProvider(async () => null);
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

describe("complete-account deletion private-cache boundary", () => {
  it("a complete receipt retires pending reads and blocks new scopes while the comic purge is held", async () => {
    await fetchBookAssetResult("kid-a", doc, rel); expect(records.size).toBe(1); put.mockClear();
    const oldScope = createBookAssetScope("kid-a"), response = deferred<Response>(), comic = deferred<void>();
    fetcher.mockReturnValueOnce(response.promise); h.comic.mockReturnValueOnce(comic.promise);
    settlements.push(() => response.resolve(new Response("late")), () => comic.resolve());
    const pending = fetchBookAssetResult("kid-a", doc, lateRel, 1, oldScope); await tick();
    confirm(); await tick(); expect(h.comic).toHaveBeenCalledTimes(1); expect(h.signOut).not.toHaveBeenCalled();
    expect(oldScope.signal.aborted).toBe(true); expect(createBookAssetScope("kid-a").current()).toBe(false);
    const requests = fetcher.mock.calls.length;
    expect(await fetchBookAssetResult("kid-a", doc, rel, 1)).toEqual({ cancelled: true });
    expect(fetcher).toHaveBeenCalledTimes(requests);
    response.resolve(new Response("late private bytes"));
    expect(await pending).toEqual({ cancelled: true }); expect(put).not.toHaveBeenCalled(); expect(records.size).toBe(0);
    expect(h.signOut).not.toHaveBeenCalled();
    comic.resolve(); await tick(); expect(h.signOut).toHaveBeenCalledTimes(1);
  });
  it("waits for the book purge before local-key cleanup and sign-out", async () => {
    const gate = deferred<void>(); deleted.mockImplementationOnce(() => gate.promise); settlements.push(() => gate.resolve());
    const scope = createBookAssetScope("kid-a"); confirm(); await tick();
    expect(scope.signal.aborted).toBe(true); expect(deleted).toHaveBeenCalledTimes(1);
    expect(h.removeItem).not.toHaveBeenCalled(); expect(h.signOut).not.toHaveBeenCalled();
    gate.resolve(); await tick(); expect(h.removeItem).toHaveBeenCalledWith("arbor.synthetic"); expect(h.signOut).toHaveBeenCalledTimes(1);
  });
  it.each(["partial", "unknown", "replaced owner", "unmounted"])("%s result does not start a book purge or block the current owner", async reason => {
    await fetchBookAssetResult("kid-a", doc, rel); const scope = createBookAssetScope("kid-a");
    const receipt = deferred<{ complete: boolean; classes: unknown[] }>();
    if (reason === "unknown") h.accountDelete.mockRejectedValueOnce(Error("unknown result"));
    else h.accountDelete.mockReturnValueOnce(receipt.promise);
    confirm();
    if (reason === "replaced owner") { h.owner = { uid: "replacement-owner" }; h.renderedOwner = h.owner; render(); commit(); }
    if (reason === "unmounted") unmount();
    receipt.resolve({ complete: reason !== "partial", classes: [] }); await tick();
    expect(deleted).not.toHaveBeenCalled(); expect(records.size).toBe(1); expect(h.comic).not.toHaveBeenCalled(); expect(h.signOut).not.toHaveBeenCalled();
    expect(createBookAssetScope("kid-a").current()).toBe(true);
    if (reason !== "replaced owner") expect(scope.signal.aborted).toBe(false);
  });
  it("a later account is not signed out or cleared after the old owner's complete receipt has started purging", async () => {
    const ownerId = h.owner!.uid, gate = deferred<void>(); h.comic.mockReturnValueOnce(gate.promise); settlements.push(() => gate.resolve());
    confirm(); await tick(); expect(deleted).toHaveBeenCalledTimes(1);
    h.owner = { uid: "replacement-owner" }; h.renderedOwner = h.owner; render(); commit();
    gate.resolve(); await tick();
    expect(h.removeItem).not.toHaveBeenCalled(); expect(h.signOut).not.toHaveBeenCalled();
    expect(accountDeletionLeases.isPending(ownerId)).toBe(false); expect(createBookAssetScope("kid-a").current()).toBe(true);
  });
});


describe("authoritative deletion owner and pre-dispatch boundary", () => {
  const sdkChange = (owner: { uid: string } | null) => { h.owner = owner; h.listeners.forEach(listener => listener(owner)); };
  it.each(["SDK B before observer", "fresh same-UID owner", "observed A to B to original A"])("a complete receipt with unchanged React state cannot purge after %s", async change => {
    await fetchBookAssetResult("kid-a", doc, rel); const original = h.owner!;
    const receipt = deferred<{ complete: boolean; classes: unknown[] }>(); h.accountDelete.mockReturnValueOnce(receipt.promise);
    confirm();
    if (change === "SDK B before observer") h.owner = { uid: "sdk-owner-b" };
    if (change === "fresh same-UID owner") h.owner = { uid: original.uid };
    if (change === "observed A to B to original A") { sdkChange({ uid: "sdk-owner-b" }); sdkChange(original); }
    expect(h.renderedOwner).toBe(original); // deliberately NO React render
    receipt.resolve({ complete: true, classes: [] }); await tick();
    expect(deleted).not.toHaveBeenCalled(); expect(records.size).toBe(1);
    expect(h.comic).not.toHaveBeenCalled(); expect(h.removeItem).not.toHaveBeenCalled(); expect(h.signOut).not.toHaveBeenCalled();
    expect(createBookAssetScope("kid-a").current()).toBe(true); expect(accountDeletionLeases.isPending(original.uid)).toBe(false);
  });
  it("a captured confirmation cannot start a deletion when SDK ownership already differs", async () => {
    render(); commit(); const original = h.renderedOwner!; h.owner = { uid: "sdk-owner-b" };
    const input = elements(render()).find(node => node.type === "input"); input.props.onChange({ target: { value: "DELETE" } });
    const button = elements(render()).find(node => node.type === "button" && node.props.children === "set.acctDel.confirm");
    button.props.onClick(); await tick();
    expect(h.accountDelete).not.toHaveBeenCalled(); expect(deleted).not.toHaveBeenCalled(); expect(accountDeletionLeases.isPending(original.uid)).toBe(false);
  });
  it.each(["SDK B", "fresh same-UID owner", "A to B to original A", "unmount", "timeout"])("the actual API wrapper sends no destructive POST after %s while its token waits", async change => {
    const token = deferred<string | null>(), original = h.owner!;
    setAuthTokenProvider(() => token.promise); h.accountDelete.mockImplementation(productionApi.accountDelete);
    settlements.push(() => token.resolve("synthetic-late-token"));
    confirm(); await tick(); expect(fetcher).not.toHaveBeenCalled();
    if (change === "SDK B") h.owner = { uid: "sdk-owner-b" };
    if (change === "fresh same-UID owner") h.owner = { uid: original.uid };
    if (change === "A to B to original A") { sdkChange({ uid: "sdk-owner-b" }); sdkChange(original); }
    if (change === "unmount") unmount();
    if (change === "timeout") { await vi.advanceTimersByTimeAsync(90_000); await tick(); }
    token.resolve("synthetic-late-token"); await tick();
    expect(fetcher).not.toHaveBeenCalled(); expect(deleted).not.toHaveBeenCalled(); expect(h.signOut).not.toHaveBeenCalled();
    expect(accountDeletionLeases.isPending(original.uid)).toBe(false);
  });
  it("the unchanged owner still dispatches exactly the existing confirmation payload and cleans on a complete receipt", async () => {
    const original = h.owner!; h.accountDelete.mockImplementation(productionApi.accountDelete);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ uid: original.uid, complete: true, classes: [] })));
    confirm(); await tick();
    expect(fetcher).toHaveBeenCalledTimes(1); const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/account/delete"); expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ confirm: "DELETE" }); expect(init.headers.Authorization).toBe("Bearer synthetic-token");
    expect(deleted).toHaveBeenCalledTimes(1); expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(accountDeletionLeases.isPending(original.uid)).toBe(false);
  });
  it("an SDK change after POST cannot cancel the server action, but its later receipt cannot clean another owner", async () => {
    const response = deferred<Response>(), original = h.owner!; h.accountDelete.mockImplementation(productionApi.accountDelete); fetcher.mockReturnValueOnce(response.promise);
    settlements.push(() => response.resolve(new Response(JSON.stringify({ uid: original.uid, complete: true, classes: [] }))));
    confirm(); await tick(); expect(fetcher).toHaveBeenCalledTimes(1);
    h.owner = { uid: "sdk-owner-b" }; // unchanged rendered requester
    response.resolve(new Response(JSON.stringify({ uid: original.uid, complete: true, classes: [] }))); await tick();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(deleted).not.toHaveBeenCalled(); expect(h.signOut).not.toHaveBeenCalled();
    expect(createBookAssetScope("kid-a").current()).toBe(true); expect(accountDeletionLeases.isPending(original.uid)).toBe(false);
  });
});
