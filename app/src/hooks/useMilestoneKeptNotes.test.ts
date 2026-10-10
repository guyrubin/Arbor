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
import { useMilestoneKeptNotes } from "./useMilestoneKeptNotes";
import { getSyncSnapshot, __resetSyncStoreForTests } from "../lib/syncStore";
import type { KeepsakeDoc } from "../lib/firstsKeepsake";
import type { Milestone } from "../types";
import { ALL_MILESTONES } from "../lib/milestoneData";

type Row = { id: string };
const milestone = (id = "first", patch: Record<string, unknown> = {}) => ({ id, checked: true, observationStatus: "yes", observationUpdatedAt: "2026-10-04", title: "Three steps to me", domain: "sensory_motor_patterns", custom: true, ...patch }) as Milestone;
const note = (id = "first", patch: Record<string, unknown> = {}) => ({ id, milestoneId: id, note: "Three steps to me", noticedOn: "2026-10-04", createdAt: "2026-10-04", updatedAt: "2026-10-04", ...patch }) as KeepsakeDoc;
let child = "child-a";
let milestones: Milestone[];
let editor: { items: KeepsakeDoc[]; loaded: boolean; error: boolean; remote: boolean };
let disk: Record<string, string>;
const render = (flush = true) => {
  h.cursor = 0;
  const value = useMilestoneKeptNotes(child, milestones, editor);
  if (flush) h.pending.splice(0).forEach(effect => effect());
  return value;
};
const settle = () => { render(); render(); return render(); };
const deliver = (name: string, values: Row[], metadata = { fromCache: false, hasPendingWrites: false }) => {
  const listener = h.listeners.filter(row => row.path === `users/${h.uid}/children/${child}/${name}`).at(-1)!;
  listener.next({ docs: values.map(value => ({ id: value.id, data: () => value })), metadata });
};
const remoteReady = () => {
  render(); deliver("milestones", milestones); deliver("keepsakes", editor.items); return render();
};
const storeLocal = () => { disk[`arbor.milestones.${child}`] = JSON.stringify(milestones); disk[`arbor.keepsakes.${child}`] = JSON.stringify(editor.items); };

beforeEach(() => {
  h.slots = []; h.pending = []; h.listeners = []; h.cursor = 0; h.uid = "account-a"; h.enabled = true;
  __resetSyncStoreForTests();
  child = "child-a"; milestones = [milestone()]; editor = { items: [note()], loaded: true, error: false, remote: true }; disk = {};
  vi.stubGlobal("localStorage", { getItem: vi.fn((key: string) => disk[key] ?? null), setItem: vi.fn() });
});

describe("Milestones saved-note eligibility and export use actual read-only histories", () => {
  it("shows the shared note only when both source records match the editor and are parent-seen", () => {
    const ready = remoteReady();
    expect(ready.rows.get("first")).toMatchObject({ id: "milestones:first", keepsakeId: "first", text: "Three steps to me", attribution: "parent" });
    expect(ready.beforeExport()).toBe(true);
    expect(h.listeners.map(row => row.path)).toEqual(["users/account-a/children/child-a/milestones", "users/account-a/children/child-a/keepsakes"]);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("keeps catalogue citation metadata distinct from parent observation provenance", () => {
    const catalogue = ALL_MILESTONES.find(row => row.source?.org === "CDC")!;
    expect(catalogue.source).toBeTruthy();
    milestones = [{ ...catalogue, checked: true, observationStatus: "yes", observedAt: "2026-10-04" }]; editor.items = [note(catalogue.id)];
    const ready = remoteReady();
    expect(ready.rows.get(catalogue.id)).toMatchObject({ text: "Three steps to me", keepsakeId: catalogue.id });
    expect(ready.beforeExport()).toBe(true);
    milestones = [{ ...milestones[0], observationSource: "ai_proposed_parent_confirmed" }];
    deliver("milestones", milestones); expect(render().rows.size).toBe(0);
  });

  for (const patch of [{ checked: false }, { observationStatus: "not_sure" }, { observationSource: "ai_proposed_parent_confirmed" }, { source: "kid_practice" }, { captureSource: "co_parent" }]) {
    it(`retains an editable source but never promotes milestone ${JSON.stringify(patch)}`, () => {
      milestones = [milestone("first", patch)];
      expect(remoteReady().rows.size).toBe(0);
      expect(editor.items).toHaveLength(1);
    });
  }

  for (const patch of [{ source: "ai_proposed_parent_confirmed" }, { observationSource: "document_extracted" }, { kind: "quote" }, { noticedOn: "2026-02-30" }]) {
    it(`does not attribute an excluded note even when it duplicates the milestone title: ${JSON.stringify(patch)}`, () => {
      editor.items = [note("first", patch)];
      expect(remoteReady().rows.size).toBe(0);
    });
  }

  it.each([{ source: "ai_proposed_parent_confirmed" }, { kind: "quote" }])("matches the exact editor-selected duplicate note, including an excluded later document %j", patch => {
    editor.items = [note("first", { id: "earlier" }), note("first", { id: "later", photoUrl: "later-photo", ...patch })];
    expect(remoteReady().rows.size).toBe(0);
  });

  it("keeps the last valid parent note for a milestone and does not let a later malformed note hide it", () => {
    editor.items = [note("first", { id: "earlier", note: "Earlier parent words" }), note("first", { id: "later", note: "Latest parent words" }), note("first", { id: "invalid", note: "" })];
    const ready = remoteReady();
    expect(ready.rows.get("first")).toMatchObject({ keepsakeId: "later", text: "Latest parent words" });
    expect(ready.beforeExport()).toBe(true);
  });

  it("does not mix an old history row with a newer editor note, date, photo or milestone answer", () => {
    remoteReady();
    editor.items = [note("first", { note: "A changed parent note", photoUrl: "local-test-photo" })];
    expect(render().rows.size).toBe(0);
    deliver("keepsakes", editor.items);
    expect(render().rows.get("first")?.text).toBe("A changed parent note");
    milestones = [milestone("first", { checked: false })];
    expect(render().rows.size).toBe(0);
  });

  it("keeps loading, cache, pending, error and writer fallback states unsendable and recoverable", () => {
    expect(render()).toMatchObject({ loading: true, disabled: true });
    deliver("milestones", milestones); deliver("keepsakes", editor.items, { fromCache: true, hasPendingWrites: false });
    expect(render()).toMatchObject({ confirmed: false, disabled: true });
    deliver("keepsakes", editor.items, { fromCache: false, hasPendingWrites: true });
    expect(render().beforeExport()).toBe(false);
    render(); deliver("milestones", milestones); deliver("keepsakes", editor.items);
    expect(render().beforeExport()).toBe(true);
    h.listeners.at(-1)!.fail();
    expect(render()).toMatchObject({ error: true, disabled: true });
    render().reload(); render(); deliver("milestones", milestones); deliver("keepsakes", editor.items);
    editor.error = true;
    expect(render()).toMatchObject({ error: true, disabled: true });
    editor.error = false; editor.loaded = false;
    expect(render()).toMatchObject({ loading: true, disabled: true });
  });

  it("Retry restarts a failed writer listener as well as both read histories", () => {
    editor.error = true; const failed = remoteReady();
    const version = getSyncSnapshot().version;
    failed.reload();
    expect(getSyncSnapshot().version).toBe(version + 1);
    render(); expect(h.listeners).toHaveLength(4);
    editor.error = false; deliver("milestones", milestones); deliver("keepsakes", editor.items);
    expect(render().beforeExport()).toBe(true);
  });

  it("explicitly loads every eligible note beyond the first window without changing storage", () => {
    milestones = Array.from({ length: 225 }, (_, i) => milestone(`m-${String(i).padStart(3, "0")}`));
    editor.items = milestones.map(row => note(row.id));
    const page = remoteReady();
    expect(page.rows.size).toBe(200); expect(page.more).toBe(true); expect(page.beforeExport()).toBe(true);
    page.loadMore(); expect(render().loading).toBe(true);
    expect(h.listeners.slice(-2).map(row => row.max)).toEqual([401, 401]);
    deliver("milestones", milestones); deliver("keepsakes", editor.items);
    const all = render(); expect(all.rows.size).toBe(225); expect(all.more).toBe(false); expect(all.beforeExport()).toBe(true);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it.each(["note", "milestone", "writer-error", "writer-loading"])("retires an old export guard when the %s editor context changes ahead of history", change => {
    const ready = remoteReady(); expect(ready.beforeExport()).toBe(true);
    if (change === "note") editor.items = [note("first", { note: "New writer text" })];
    if (change === "milestone") milestones = [milestone("first", { checked: false })];
    if (change === "writer-error") editor.error = true;
    if (change === "writer-loading") editor.loaded = false;
    render(); // The independent read-history listeners have not changed yet.
    expect(ready.beforeExport()).toBe(false);
  });

  it("keeps a captured guard usable across an unchanged adapter rerender", () => {
    const ready = remoteReady(); expect(ready.beforeExport()).toBe(true);
    render(); expect(ready.beforeExport()).toBe(true);
  });

  it("rejects an open Send guard before a changed, pending or error snapshot commits", () => {
    const ready = remoteReady(); expect(ready.beforeExport()).toBe(true);
    deliver("keepsakes", [note("first", { note: "New text" })]);
    expect(ready.beforeExport()).toBe(false);
    expect(render().changed).toBe(true);
  });

  it("isolates child/account switches including A to B to A and old captured Send callbacks", () => {
    const first = remoteReady(); expect(first.beforeExport()).toBe(true);
    child = "child-b"; milestones = []; editor.items = [];
    expect(render(false).rows.size).toBe(0); expect(first.beforeExport()).toBe(false);
    settle(); deliver("milestones", []); deliver("keepsakes", []);
    expect(render().scope).toBe("account-a:child-b");
    child = "child-a"; milestones = [milestone()]; editor.items = [note()];
    settle(); deliver("milestones", milestones); deliver("keepsakes", editor.items);
    const again = render(); expect(again.beforeExport()).toBe(true); expect(first.beforeExport()).toBe(false);
    h.uid = "account-b";
    expect(render(false).rows.size).toBe(0); expect(again.beforeExport()).toBe(false);
  });

  it("rejects a local deletion before final Send and never resurrects it through the stale editor", () => {
    h.enabled = false; editor.remote = false; storeLocal();
    const ready = settle(); expect(ready.beforeExport()).toBe(true);
    disk[`arbor.keepsakes.${child}`] = "[]";
    expect(ready.beforeExport()).toBe(false);
    expect(settle().rows.size).toBe(0);
    expect(editor.items).toHaveLength(1); // remains available to the existing editor, never to Send
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("reads same-tab local edits again and requires the new snapshot before exporting", () => {
    h.enabled = false; editor.remote = false; storeLocal();
    const before = settle(); expect(before.beforeExport()).toBe(true);
    editor.items = [note("first", { note: "New parent words" })]; storeLocal();
    expect(render().rows.size).toBe(0); expect(before.beforeExport()).toBe(false);
    const after = settle(); expect(after.rows.get("first")?.text).toBe("New parent words"); expect(after.beforeExport()).toBe(true);
  });

  it("reports corrupt or inaccessible local history as an error, never a confirmed fallback", () => {
    h.enabled = false; editor.remote = false; storeLocal(); disk[`arbor.keepsakes.${child}`] = "{bad";
    const broken = settle(); expect(broken).toMatchObject({ error: true, confirmed: false, disabled: true });
    expect(broken.rows.size).toBe(0); expect(broken.beforeExport()).toBe(false);
  });
});
