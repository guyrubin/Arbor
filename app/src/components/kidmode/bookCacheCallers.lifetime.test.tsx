/** Runs the three existing private-book callers with deterministic React hook
 * slots and the real store/resolver. Synthetic bytes only; no browser/SDK IO. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile } from "../../types";
import type { LibraryBookEntry } from "../../lib/bookAssets";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
const h = vi.hoisted(() => ({
  owner: { uid: "owner-a" } as { uid: string } | null, childId: "kid-a", doc: null as BookAssetsDoc | null,
  cursor: 0, slots: [] as { value?: any; deps?: unknown[]; cleanup?: () => void }[], effects: [] as (() => void)[],
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState(initial: unknown) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === "function" ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === "function" ? next(slot.value) : next; }]; },
  useRef(initial: unknown) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
  useMemo(make: () => unknown, deps: unknown[]) { const i = h.cursor++; const old = h.slots[i]; if (old?.deps && deps.every((v, n) => Object.is(v, old.deps![n]))) return old.value; return (h.slots[i] = { value: make(), deps }).value; },
  useEffect(effect: () => void | (() => void), deps: unknown[]) {
    const i = h.cursor++, old = h.slots[i];
    if (old?.deps && deps.every((v, n) => Object.is(v, old.deps![n]))) return;
    const slot = h.slots[i] = { deps, cleanup: old?.cleanup };
    h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
  },
}));
vi.mock("../../lib/firebase", () => ({ firebaseEnabled: true, auth: { get currentUser() { return h.owner; } } }));
vi.mock("../../lib/api", () => ({ authHeaders: async () => ({ Authorization: "Bearer synthetic-token" }) }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.childId, name: "Synthetic", gender: "boy" } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (s: string) => s, uiLang: "en", aiLang: "en" }) }));
vi.mock("./useChildLibraryBooks", () => ({ useChildLibraryBooks: () => [{ book: { id: "synthetic-book", cover: { plateId: "synthetic" } }, doc: h.doc }] }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: h.doc ? [h.doc] : [] }) }));
vi.mock("../../lib/library/books", () => ({ BOOK_PLATES: {}, getLibraryBook: () => ({ id: "synthetic-book" }) }));
vi.mock("../../lib/library/bookSheet", () => ({ bookSheetDrawPoses: () => ["sit", "stand"], bookSheetId: () => "synthetic" }));
vi.mock("./hero/buildBookSheet", () => ({ DEFAULT_SHEET_BOOK: "synthetic-book", bookSheetRunning: () => false, browserBookBuilderDeps: vi.fn(), redrawBookPose: vi.fn() }));
vi.mock("../library/BookReader", () => ({ BookReader: () => null }));
vi.mock("./KidStageFallback", () => ({ KidStageFallback: () => null }));
vi.mock("../../lib/heroJourneys", () => ({ storyLanguage: () => "en" }));
vi.mock("../ui/Icon", () => ({ Icon: () => null }));
import { setBookAssetBackend, retireBookAssetScopes, type CachedFile } from "../../lib/bookAssetStore";
import { LibraryBookCover } from "./LibraryBookCover";
import KidBookReaderView from "./KidBookReaderView";
import BookSheetStrip from "../profile/BookSheetStrip";
import { BookReader } from "../library/BookReader";
const doc = (): BookAssetsDoc => ({ id: "synthetic-book", bookId: "synthetic-book", sheetId: "synthetic", setId: "synthetic", sheetManifest: { poses: { sit: { file: "sit.webp" } }, prints: { cover: { file: "prints/cover.webp" } } }, files: ["hero-sheets/synthetic/sit.webp", "hero-sheets/synthetic/prints/cover.webp"], bytes: 5, createdAt: "synthetic-version" });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const commit = () => { h.effects.splice(0).forEach(effect => effect()); };
const unmount = () => { h.slots.forEach(slot => slot.cleanup?.()); };
const entry = () => ({ book: { id: "synthetic-book", cover: { plateId: "synthetic" } }, doc: h.doc } as LibraryBookEntry);
const cover = () => { h.cursor = 0; return LibraryBookCover({ childId: h.childId, entry: entry() }); };
const reader = () => { h.cursor = 0; return KidBookReaderView({ bookId: "synthetic-book", onClose: vi.fn() }); };
const strip = () => { h.cursor = 0; return BookSheetStrip({ child: { id: h.childId, name: "Synthetic", gender: "boy" } as ChildProfile, avatarHash: "synthetic" }); };
const elements = (value: any): any[] => Array.isArray(value) ? value.flatMap(elements) : value && typeof value === "object" ? [value, ...elements(value.props?.children)] : [];
let fetcher: ReturnType<typeof vi.fn>;
let created: ReturnType<typeof vi.fn<typeof URL.createObjectURL>>;
let revoked: ReturnType<typeof vi.fn<typeof URL.revokeObjectURL>>;
beforeEach(() => {
  h.owner = { uid: "owner-a" }; h.childId = "kid-a"; h.doc = doc(); h.cursor = 0; h.slots = []; h.effects = [];
  const records = new Map<string, CachedFile>();
  setBookAssetBackend({ get: async id => records.get(id), put: async rec => { records.set(rec.id, rec); }, deleteWhere: async pred => { for (const [id, rec] of records) if (pred(rec)) records.delete(id); } });
  fetcher = vi.fn(async () => new Response("synthetic bytes")); vi.stubGlobal("fetch", fetcher);
  let id = 0; created = vi.fn<typeof URL.createObjectURL>(() => `blob:synthetic-${++id}`); revoked = vi.fn<typeof URL.revokeObjectURL>();
  vi.spyOn(URL, "createObjectURL").mockImplementation(created); vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoked);
});
afterEach(() => { unmount(); setBookAssetBackend(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("existing private-book call sites", () => {
  it("the cover hides previous-child bytes on render, before old effect cleanup", async () => {
    cover(); commit(); await tick(); expect(cover()?.props.src).toBe("blob:synthetic-1");
    h.childId = "kid-b"; expect(cover()).toBeNull();
    h.childId = "kid-a"; expect(cover()).toBeNull();
  });
  it("the cover clears and revokes a returned URL on passive owner retirement", async () => {
    cover(); commit(); await tick(); expect(cover()).not.toBeNull();
    h.owner = null; retireBookAssetScopes(); expect(cover()).toBeNull(); expect(revoked).toHaveBeenCalledWith("blob:synthetic-1");
  });
  it("unmount during pending cover download aborts and never allocates a late URL", async () => {
    const gate = deferred<Response>(); fetcher.mockReturnValue(gate.promise); cover(); commit(); await tick(); unmount(); gate.resolve(new Response("late")); await tick(); expect(created).not.toHaveBeenCalled();
  });
  it("the reader never renders a prior child's sheet after child replacement", async () => {
    reader(); commit(); await tick(); expect(elements(reader()).some(e => e.type === BookReader)).toBe(true);
    h.childId = "kid-b"; expect(elements(reader()).some(e => e.type === BookReader)).toBe(false);
    h.childId = "kid-a"; expect(elements(reader()).some(e => e.type === BookReader)).toBe(false);
  });
  it.each(["cover", "reader"])("%s hides a superseded metadata version before effect cleanup", async (kind) => {
    const render = kind === "cover" ? cover : reader;
    render(); commit(); await tick();
    h.doc = { ...h.doc!, createdAt: "replacement-version" };
    const result = render();
    if (kind === "cover") expect(result).toBeNull();
    else expect(elements(result).some(e => e.type === BookReader)).toBe(false);
  });
  it("the reader removes an already-open private view and revokes its URLs on passive retirement", async () => {
    reader(); commit(); await tick(); expect(elements(reader()).some(e => e.type === BookReader)).toBe(true);
    h.owner = { uid: "owner-b" }; retireBookAssetScopes(); expect(elements(reader()).some(e => e.type === BookReader)).toBe(false); expect(revoked).toHaveBeenCalledTimes(2);
  });
  it("unmount during initial reader loading prevents all late blobs", async () => {
    const gate = deferred<Response>(); fetcher.mockReturnValue(gate.promise); reader(); commit(); await tick(); unmount(); gate.resolve(new Response("late")); await tick(); expect(created).not.toHaveBeenCalled();
  });
  it("the parent strip shares a single cancellable loop rather than continuing reads after unmount", async () => {
    h.doc!.sheetManifest.poses.stand = { file: "stand.webp" }; h.doc!.files.push("hero-sheets/synthetic/stand.webp");
    const gate = deferred<Response>(); fetcher.mockReturnValue(gate.promise);
    strip(); commit(); await tick(); expect(fetcher).toHaveBeenCalledTimes(1);
    unmount(); gate.resolve(new Response("late")); await tick();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(created).not.toHaveBeenCalled();
  });
  it("the parent strip clears returned URLs on auth change and hides a previous child's rows before cleanup", async () => {
    strip(); commit(); await tick(); expect(elements(strip()).some(e => e.type === "img")).toBe(true);
    h.childId = "kid-b"; expect(elements(strip()).some(e => e.type === "img")).toBe(false);
    h.childId = "kid-a"; expect(elements(strip()).some(e => e.type === "img")).toBe(false);
    h.owner = null; retireBookAssetScopes(); expect(revoked).toHaveBeenCalledWith("blob:synthetic-1");
  });
});
