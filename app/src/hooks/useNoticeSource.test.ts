import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], effects: [] as (() => void)[], dirty: false, remote: false, uid: "local-sandbox", child: "c1", lease: {},
  auth: { currentUser: { uid: "owner-a" } as { uid: string } | null }, milestones: [] as any[], listeners: new Map<string, { next: (snapshot: any) => void; error: () => void; active: boolean }>() }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  const memo = (fn: () => unknown, deps: unknown[]) => { const i = h.cursor++, old = h.slots[i]; if (!old || deps.some((value, n) => !Object.is(value, old.deps[n]))) h.slots[i] = { deps, value: fn() }; return h.slots[i].value; };
  return { ...actual,
    useState: (initial: any) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial; return [h.slots[i], (next: any) => { const value = typeof next === "function" ? next(h.slots[i]) : next; if (!Object.is(value, h.slots[i])) { h.slots[i] = value; h.dirty = true; } }]; },
    useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; }, useMemo: memo, useCallback: (fn: any, deps: unknown[]) => memo(() => fn, deps),
    useEffect: (fn: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, old = h.slots[i]; if (old && deps.every((value, n) => Object.is(value, old.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; h.slots[i] = slot; h.effects.push(() => { old?.cleanup?.(); slot.cleanup = fn(); }); },
  };
});
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.child }, milestones: h.milestones }) }));
const capture = () => { const lease = h.lease; return () => lease === h.lease; };
vi.mock("../context/ProfileContext", () => ({ useProfile: () => ({ captureOnboardingLifetime: capture }) }));
vi.mock("../lib/firebase", () => ({ get firebaseEnabled() { return h.remote; }, db: {}, auth: h.auth }));
vi.mock("firebase/firestore", () => ({ doc: (_: unknown, path: string) => path, onSnapshot: (path: string, options: any, next: (snapshot: any) => void, error: () => void) => {
  expect(options).toEqual({ includeMetadataChanges: true }); const entry = { next, error, active: true }; h.listeners.set(path, entry); return () => { entry.active = false; };
} }));
import { useNoticeSource } from "./useNoticeSource";
import { ALL_MILESTONES, milestoneText } from "../lib/milestoneData";
import { translate } from "../lib/i18n";

const m = { id: "m1", title: "Points to ask", checked: false, observationStatus: "not_sure", observationSource: "parent_typed", observationUpdatedAt: "2026-10-16" };
let store = new Map<string, string>();
const put = (collection: string, rows: unknown[]) => store.set(`arbor.${collection}.c1`, JSON.stringify(rows));
const render = (target = { childId: "c1", milestoneId: "m1" }, he = false) => { for (let i = 0; i < 10; i++) { h.cursor = 0; h.dirty = false; const value = useNoticeSource(target, he); h.effects.splice(0).forEach(effect => effect()); if (!h.dirty) return value; } throw Error("render did not settle"); };
const snapshot = (collection: string, record: any, metadata = { fromCache: false, hasPendingWrites: false }) => {
  const listener = h.listeners.get(`users/owner-a/children/c1/${collection}/m1`)!;
  listener.next({ id: "m1", exists: () => record !== null, data: () => record, metadata });
};
beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.dirty = false; h.remote = false; h.uid = "local-sandbox"; h.child = "c1"; h.lease = {}; h.milestones = [m]; h.listeners.clear(); h.auth.currentUser = { uid: "owner-a" };
  store = new Map(); put("milestones", [m]); put("keepsakes", [{ id: "m1", milestoneId: "m1", note: "Pointed towards a cup", noticedOn: "2026-10-15" }]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null }); vi.stubGlobal("window", new EventTarget());
});
afterEach(() => { h.slots.forEach(slot => slot?.cleanup?.()); vi.unstubAllGlobals(); });

describe("B-GROWTH-44 · current source receipt", () => {
  it("reads exact originals without seeding or changing local storage", () => {
    const before = [...store]; const source = render(); expect(source.state).toBe("ready"); expect(source.sources).toHaveLength(2); expect(source.isCurrent()).toBe(true); expect([...store]).toEqual(before);
  });
  it("localizes the catalogue title while preserving the parent's own words and retiring the old-language review", () => {
    const row = { ...ALL_MILESTONES[0], observationStatus: "not_sure", observationSource: "parent_typed" };
    h.milestones = [row]; put("milestones", [row]); put("keepsakes", [{ id: row.id, milestoneId: row.id, note: "My original English words", noticedOn: "2026-10-15" }]);
    const target = { childId: "c1", milestoneId: row.id };
    const en = render(target); const he = render(target, true);
    expect(he.title).toBe(milestoneText(row, "title", key => translate("he", key), { gender: null }));
    expect(he.title).not.toBe(en.title); expect(he.sources.find(source => source.kind === "kept")?.text).toBe("My original English words");
    expect(en.isCurrent()).toBe(false);
  });
  it("reads a parent-added title from its current original document before the context projection catches up", () => {
    h.milestones = [{ ...m, custom: true, title: "Old parent words" }]; put("milestones", [{ ...m, custom: true, title: "The parent's edited words" }]);
    const source = render(undefined, true); expect(source.title).toBe("The parent's edited words"); expect(source.sources[0].text).toContain("The parent's edited words");
  });
  it.each(["edit", "delete", "authorship", "malformed"])("rejects a held Send/export before React paints a same-tab %s", change => {
    const before = render(); const receipt = before.version;
    if (change === "malformed") store.set("arbor.keepsakes.c1", "{}");
    else put("keepsakes", change === "delete" ? [] : [{ id: "m1", milestoneId: "m1", note: "Changed words", noticedOn: "2026-10-15", ...(change === "authorship" ? { contentSource: "ai_draft" } : {}) }]);
    expect(before.isCurrent()).toBe(false);
    const after = render(); expect(after.version).not.toBe(receipt); expect(before.isCurrent()).toBe(false);
    expect(after.sources.find(source => source.id === "keepsakes:m1")?.text).not.toBe("Pointed towards a cup");
  });
  it("a profile lease change retires the guard even before a render; A→B→A cannot revive it", () => {
    const source = render(); h.lease = {}; expect(source.isCurrent()).toBe(false); h.child = "c2"; render(); h.child = "c1"; const next = render(); expect(source.isCurrent()).toBe(false); expect(next.version).not.toBe(source.version);
  });
  it("requires server-confirmed documents and rejects pending/cache/permission loss before render", () => {
    h.remote = true; h.uid = "owner-a";
    expect(render().state).toBe("loading"); expect(h.listeners.size).toBe(2);
    snapshot("milestones", m); snapshot("keepsakes", null); const confirmed = render(); expect(confirmed.isCurrent()).toBe(true);
    snapshot("milestones", m, { fromCache: true, hasPendingWrites: false }); expect(confirmed.isCurrent()).toBe(false); expect(render().state).toBe("unavailable");
    snapshot("milestones", m); const recovered = render(); expect(recovered.isCurrent()).toBe(true);
    snapshot("keepsakes", null, { fromCache: false, hasPendingWrites: true }); expect(recovered.isCurrent()).toBe(false);
    h.listeners.get("users/owner-a/children/c1/keepsakes/m1")!.error(); expect(render().state).toBe("unavailable");
  });
  it("blocks an auth switch before the context catches up, including same child/record IDs", () => {
    h.remote = true; h.uid = "owner-a"; render(); snapshot("milestones", m); snapshot("keepsakes", null);
    const source = render(); expect(source.isCurrent()).toBe(true); h.auth.currentUser = { uid: "owner-b" }; expect(source.isCurrent()).toBe(false);
  });
  it("does not subscribe to another child's or a path-like target", () => {
    h.remote = true; h.uid = "owner-a";
    expect(render({ childId: "other", milestoneId: "m1" }).state).toBe("unavailable"); expect(h.listeners.size).toBe(0);
    expect(render({ childId: "c1", milestoneId: "m1/other" }).state).toBe("unavailable"); expect(h.listeners.size).toBe(0);
  });
});
