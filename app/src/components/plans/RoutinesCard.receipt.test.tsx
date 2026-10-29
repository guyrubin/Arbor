import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Actual reachable component + actual collection hook, under deterministic
// React hook/effect slots. This proves source/callback behavior, not browser QA.
const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], effects: [] as (() => void)[], dirty: false,
  child: "a", account: "parent-a", remote: false, lang: "en" as "en" | "he",
  listeners: [] as any[], writes: [] as any[], storage: new Map<string, string>(), failLocal: false,
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  const memo = (calculate: () => unknown, deps: unknown[]) => {
    const i = h.cursor++, slots = h.slots, prev = slots[i];
    if (!prev || deps.some((d, n) => !Object.is(d, prev.deps[n]))) slots[i] = { deps, value: calculate() };
    return slots[i].value;
  };
  return { ...actual,
    useState: (initial: any) => { const i = h.cursor++, slots = h.slots; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (next: any) => { const value = typeof next === "function" ? next(slots[i]) : next; if (!Object.is(slots[i], value)) { slots[i] = value; h.dirty = true; } }]; },
    useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
    useMemo: memo, useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    // B-DATA-14: useOnline's store reads navigator (a boolean); every other store reads 0.
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => { const value = get(); return typeof value === "boolean" ? value : 0; },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, slots = h.slots, prev = slots[i]; if (prev && deps.every((d, n) => Object.is(d, prev.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; slots[i] = slot; h.effects.push(() => { prev?.cleanup?.(); slot.cleanup = effect(); }); },
  };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.child } }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.account } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../lib/firebase", () => ({ db: {}, get firebaseEnabled() { return h.remote; } }));
vi.mock("../../lib/syncStore", () => ({ clearSyncError: vi.fn(), reportSyncError: vi.fn(), getSyncSnapshot: () => 0, subscribeSyncStatus: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }), doc: (_db: unknown, path: string, id: string) => ({ path, id }), orderBy: vi.fn(), limit: vi.fn(), query: (q: unknown) => q,
  setDoc: (ref: unknown, row: unknown, options?: unknown) => new Promise<void>((resolve, reject) => { h.writes.push({ ref, row, options, resolve, reject }); }), deleteDoc: vi.fn(), writeBatch: vi.fn(),
  onSnapshot: (q: any, ...args: any[]) => { const options = typeof args[0] === "function" ? null : args.shift(); const listener = { path: q.path, options, next: args[0], fail: args[1], stopped: false }; h.listeners.push(listener); return () => { listener.stopped = true; }; },
}));
import RoutinesCard from "./RoutinesCard";
import { PendingLine, Receipt, startPendingClock } from "../ui/Receipt";
import { translate } from "../../lib/i18n";

type Routine = { id: string; name: string; steps: { text: string; done: boolean }[] };
type El = React.ReactElement<Record<string, any>>;
const morning = (done = false): Routine => ({ id: "morning", name: "Invented morning", steps: [{ text: "Find a cup", done: true }, { text: "Open the curtains", done }] });
const goodbye = (): Routine => ({ id: "goodbye", name: "Invented goodbye", steps: [{ text: "Wave once", done: false }] });
const key = (child = h.child) => `arbor.routines.${child}`;
function seed(rows = [morning(), goodbye()], child = h.child) { h.storage.set(key(child), JSON.stringify(rows)); }
function stored(child = h.child): Routine[] { return JSON.parse(h.storage.get(key(child)) || "[]"); }
function elements(node: React.ReactNode): El[] {
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
function render() {
  for (let n = 0; n < 12; n++) {
    h.cursor = 0; h.dirty = false;
    const tree = RoutinesCard();
    h.effects.splice(0).forEach(effect => effect());
    if (!h.dirty) return tree;
  }
  throw Error("render did not settle");
}
function findId(id: string, tree = render()) { return elements(tree).find(el => el.props["data-testid"] === id || el.props.testId === id); }
function byId(id: string, tree = render()) { const el = findId(id, tree); expect(el, id).toBeDefined(); return el!; }
const click = (id: string) => byId(id).props.onClick();
const receipt = (id = "morning") => findId(`routine-receipt-${id}`);
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function dispose() { h.slots.forEach(slot => slot?.cleanup?.()); h.slots = []; h.effects = []; }
function source(rows = [morning(), goodbye()], metadata: { fromCache?: boolean; hasPendingWrites?: boolean } = {}) {
  const listener = h.listeners.find(l => !l.stopped && l.path === `users/${h.account}/children/${h.child}/routines`)!;
  listener.next({ empty: rows.length === 0, docs: rows.map(({ id, ...data }) => ({ id, data: () => data })), metadata: { fromCache: !!metadata.fromCache, hasPendingWrites: !!metadata.hasPendingWrites } });
}
function remoteStart() { h.remote = true; render(); source(); render(); }
beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.dirty = false;
  h.child = "a"; h.account = "parent-a"; h.remote = false; h.lang = "en"; h.listeners = []; h.writes = []; h.storage.clear(); h.failLocal = false;
  vi.stubGlobal("localStorage", { getItem: (k: string) => h.storage.get(k) ?? null, setItem: (k: string, value: string) => { if (h.failLocal) throw Error("Quota exceeded"); h.storage.set(k, value); } });
  seed();
});
afterEach(() => { dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); });

for (const lang of ["en", "he"] as const) describe(`Live Plans Routines feedback · ${lang}`, () => {
  beforeEach(() => { h.lang = lang; });
  it("completes the registered checklist and shows a truthful local shared receipt only on that row", async () => {
    render(); expect(receipt()).toBeUndefined();
    await click("routine-step-morning-1");
    const line = receipt()!; expect(line.type).toBe(Receipt); expect(line.props.children).toBe(translate(lang, "elev.closeloop.routines.savedLocal"));
    expect(line.props.announce).not.toBe(false);
    expect(renderToStaticMarkup(line)).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(stored()).toEqual([morning(true), goodbye()]); expect(receipt("goodbye")).toBeUndefined();
    expect(byId("routine-step-morning-1").props["aria-pressed"]).toBe(true);
    expect([...h.storage.keys()]).toEqual([key()]);
  });
  it("does not replay a receipt on reload, and permits undo, repeat, reset and another completion", async () => {
    render(); await click("routine-step-morning-1"); expect(receipt()).toBeDefined();
    dispose(); render(); expect(receipt()).toBeUndefined(); expect(byId("routine-step-morning-1").props["aria-pressed"]).toBe(true);
    await click("routine-step-morning-1"); expect(receipt()).toBeUndefined();
    await click("routine-step-morning-1"); expect(receipt()).toBeDefined();
    const oldStep = byId("routine-step-morning-1").props.onClick;
    await click("routine-reset-morning"); await oldStep(); expect(receipt()).toBeUndefined();
    expect(stored()[0].steps.every(s => !s.done)).toBe(true);
    await click("routine-step-morning-0"); await click("routine-step-morning-1"); expect(receipt()).toBeDefined();
  });
  it("leaves a failed local final step undone, retries exactly that save and retires the old retry", async () => {
    render(); h.failLocal = true; await click("routine-step-morning-1");
    expect(receipt()).toBeUndefined(); expect(byId("routine-step-morning-1").props["aria-pressed"]).toBe(false);
    expect(renderToStaticMarkup(byId("routine-failed-morning"))).toContain(translate(lang, "elev.closeloop.routines.failedLocal"));
    const retry = byId("routine-retry-morning").props.onClick;
    h.failLocal = false; retry(); await flush(); expect(receipt()).toBeDefined();
    await click("routine-reset-morning"); retry(); await flush(); expect(receipt()).toBeUndefined();
    expect(stored()[0].steps.every(s => !s.done)).toBe(true);
  });
  it("preserves the ordinary add-step, add-routine and remove controls and retires feedback on an edit", async () => {
    render(); await click("routine-step-morning-1");
    byId("routine-step-input-morning").props.onChange({ target: { value: "Put the cup away" } });
    click("routine-add-step-morning"); await flush(); expect(receipt()).toBeUndefined(); expect(stored()[0].steps).toHaveLength(3);
    byId("routine-name-input").props.onChange({ target: { value: "Invented evening" } });
    elements(render()).find(el => el.type === "form")!.props.onSubmit({ preventDefault: () => {} }); await flush();
    expect(stored().some(r => r.name === "Invented evening")).toBe(true);
    click("routine-delete-morning"); await flush(); expect(stored().some(r => r.id === "morning")).toBe(false); expect(receipt()).toBeUndefined();
  });
});

describe("Acknowledgement and lifetime boundaries", () => {
  it("blocks duplicate retained callbacks before a local rerender and isolates the second card", async () => {
    render(); const final = byId("routine-step-morning-1").props.onClick;
    await Promise.all([final(), final()]); expect(receipt()).toBeDefined();
    await click("routine-step-goodbye-0"); expect(receipt()).toBeDefined(); expect(receipt("goodbye")).toBeDefined();
    await click("routine-reset-goodbye"); expect(receipt()).toBeDefined(); expect(receipt("goodbye")).toBeUndefined();
    expect(stored().find(r => r.id === "morning")).toEqual(morning(true));
  });
  it("requires real remote acknowledgement and a confirmed current source, even beyond the queue timeout", async () => {
    vi.useFakeTimers(); remoteStart(); expect(h.listeners[0].options).toEqual({ includeMetadataChanges: true });
    click("routine-step-morning-1"); expect(h.writes).toHaveLength(1);
    source([morning(true), goodbye()], { hasPendingWrites: true }); render();
    expect(receipt()).toBeUndefined(); expect(byId("routine-pending-morning").type).toBe(PendingLine);
    await vi.advanceTimersByTimeAsync(4100); expect(receipt()).toBeUndefined();
    source([morning(true), goodbye()]); render(); expect(receipt()).toBeUndefined();
    h.writes[0].resolve(); await flush(); expect(receipt()!.props.children).toBe(translate("en", "elev.closeloop.routines.saved"));
  });
  it("waits for the confirmed row when the write ack arrives before the server snapshot", async () => {
    remoteStart(); click("routine-step-morning-1"); h.writes[0].resolve(); await flush(); expect(receipt()).toBeUndefined();
    source([morning(true), goodbye()], { fromCache: true }); render(); expect(receipt()).toBeUndefined();
    source([morning(true), goodbye()]); render(); expect(receipt()).toBeDefined();
  });
  it("uses the 400 ms shared pending clock, with no flash and cancellable old work", () => {
    vi.useFakeTimers(); const shown = vi.fn(); const cancel = startPendingClock(shown);
    vi.advanceTimersByTime(399); expect(shown).not.toHaveBeenCalled(); cancel(); vi.advanceTimersByTime(1); expect(shown).not.toHaveBeenCalled();
    startPendingClock(shown); vi.advanceTimersByTime(400); expect(shown).toHaveBeenCalledTimes(1);
  });
  it("allows retry only from the current confirmed failed source, not the rejected optimistic echo", async () => {
    remoteStart(); click("routine-step-morning-1"); source([morning(true), goodbye()], { hasPendingWrites: true }); render();
    h.writes[0].reject(Error("Denied")); await flush(); expect(receipt()).toBeUndefined();
    const held = byId("routine-retry-morning").props.onClick; held(); expect(h.writes).toHaveLength(1);
    source(); render(); click("routine-retry-morning"); expect(h.writes).toHaveLength(2);
    source([morning(true), goodbye()]); h.writes[1].resolve(); await flush(); expect(receipt()).toBeDefined();
    held(); expect(h.writes).toHaveLength(2);
  });
  it.each(["child", "account"])("retires pending writes and held callbacks through %s A → B → A", async boundary => {
    remoteStart(); const oldStep = byId("routine-step-morning-1").props.onClick; const oldReset = byId("routine-reset-morning").props.onClick;
    oldStep(); expect(h.writes).toHaveLength(1);
    if (boundary === "child") h.child = "b"; else h.account = "parent-b";
    render(); source(); render(); await oldReset(); expect(h.writes).toHaveLength(1);
    if (boundary === "child") h.child = "a"; else h.account = "parent-a";
    render(); source(); render(); h.writes[0].resolve(); await flush(); await oldStep(); expect(receipt()).toBeUndefined(); expect(h.writes).toHaveLength(1);
  });
  it("does not let a held local-child retry write into the later child's storage", async () => {
    render(); h.failLocal = true; await click("routine-step-morning-1"); const retry = byId("routine-retry-morning").props.onClick;
    h.failLocal = false; seed([goodbye()], "b"); h.child = "b"; render(); retry(); await flush();
    expect(stored("a")).toEqual([morning(), goodbye()]); expect(stored("b")).toEqual([goodbye()]); expect(receipt()).toBeUndefined();
  });
  it("rejects a held retry after a same-tab source change even before React renders", async () => {
    render(); h.failLocal = true; await click("routine-step-morning-1"); const retry = byId("routine-retry-morning").props.onClick;
    h.failLocal = false; seed([{ ...morning(), name: "Newer source" }, goodbye()]); retry(); await flush();
    expect(stored()[0].name).toBe("Newer source"); expect(stored()[0].steps[1].done).toBe(false); expect(receipt()).toBeUndefined();
  });
  it("retires old success/failure after source replacement, deletion/recreation or unmount", async () => {
    remoteStart(); click("routine-step-morning-1"); source([{ ...morning(), name: "Newer source" }, goodbye()]); render();
    h.writes[0].resolve(); await flush(); expect(receipt()).toBeUndefined();
    click("routine-step-morning-1"); source([goodbye()]); render(); source(); render();
    h.writes[1].reject(Error("Late failure")); await flush(); expect(findId("routine-failed-morning")).toBeUndefined();
    click("routine-step-morning-1"); dispose(); h.writes[2].resolve(); await flush(); render(); source([morning(true), goodbye()]); expect(receipt()).toBeUndefined();
  });
  it("does not let older results replace a later successful action", async () => {
    remoteStart(); click("routine-step-morning-1");
    source([{ ...morning(), name: "Newer source" }, goodbye()]); render(); click("routine-step-morning-1");
    source([{ ...morning(true), name: "Newer source" }, goodbye()]); h.writes[1].resolve(); await flush(); expect(receipt()).toBeDefined();
    h.writes[0].reject(Error("Late rejection")); await flush(); expect(receipt()).toBeDefined(); expect(findId("routine-failed-morning")).toBeUndefined();
  });
  it("retired callbacks cannot restart a deleted or edited row", async () => {
    render(); const heldStep = byId("routine-step-morning-1").props.onClick;
    click("routine-delete-morning"); await flush(); await heldStep(); expect(stored()).toEqual([goodbye()]);
  });
});

/* B-DATA-14 — offline a step ticks from this phone's copy and says so. Only
   the tick is written (a merge write of the routine's offlineTicks field);
   back online it is folded into the server's copy, so a change made on the
   parent's other device meanwhile survives. Online writes are bounded. */
describe("B-DATA-14 · routines tick offline, merged on reconnect", () => {
  const queuedLine = (id = "morning") => findId(`routine-queued-${id}`);
  type Tick = { text: string; done: boolean; at: string };
  const withTicks = (r: Routine, ticks: Record<string, Tick>) => ({ ...r, offlineTicks: ticks });
  function offlineStart() {
    vi.stubGlobal("navigator", { onLine: false });
    h.remote = true; render(); source([morning(), goodbye()], { fromCache: true }); render();
  }
  /** The tick as this phone wrote it, then the persistent cache's own echo. */
  async function tickOffline(): Promise<Record<string, Tick>> {
    click("routine-step-morning-1"); await flush();
    const ticks = h.writes[0].row.offlineTicks as Record<string, Tick>;
    source([withTicks(morning(), ticks) as Routine, goodbye()], { fromCache: true, hasPendingWrites: true }); render();
    return ticks;
  }

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: offline a step ticks at once and says 'Saved on this phone…'; only the tick is written`, async () => {
      h.lang = lang; offlineStart();
      expect(byId("routine-step-morning-1").props.disabled).toBe(false);
      const ticks = await tickOffline();
      expect(h.writes).toHaveLength(1);
      expect(h.writes[0].options).toEqual({ merge: true });
      // Negative control for the old write: never the whole cached routine.
      expect(Object.keys(h.writes[0].row).sort()).toEqual(["id", "offlineTicks"]);
      expect(ticks["1"]).toMatchObject({ text: "Open the curtains", done: true });
      expect(byId("routine-step-morning-1").props["aria-pressed"]).toBe(true);
      expect(queuedLine()!.props.children).toBe(translate(lang, "elev.sync.savedOnPhone"));
      expect(byId("routine-pending-morning").props.active).toBe(false);
      expect(receipt()).toBeUndefined();
      // Offline, reset / delete / new steps still wait for a confirmed read.
      expect(byId("routine-reset-morning").props.disabled).toBe(true);
      expect(byId("routine-delete-morning").props.disabled).toBe(true);
    });
  }

  it("two devices: back online, the tick is folded into the server's copy and the other device's change survives", async () => {
    offlineStart(); const ticks = await tickOffline();
    vi.stubGlobal("navigator", { onLine: true });
    expect(queuedLine()!.props.children).toBe(translate("en", "elev.sync.savedOnPhoneSending"));
    // Meanwhile the parent's other device renamed the routine and unticked step 0;
    // the tick's own field arrived beside it (a merge write).
    const elsewhere: Routine = { id: "morning", name: "Renamed on the other phone", steps: [{ text: "Find a cup", done: false }, { text: "Open the curtains", done: false }] };
    source([withTicks(elsewhere, ticks) as Routine, goodbye()]); render();
    expect(h.writes).toHaveLength(2);
    expect(h.writes[1].options).toBeUndefined();
    expect(h.writes[1].row).toEqual({ id: "morning", name: "Renamed on the other phone", steps: [{ text: "Find a cup", done: false }, { text: "Open the curtains", done: true }] });
    h.writes[1].resolve(); await flush();
    source([h.writes[1].row, goodbye()]); render();
    expect(queuedLine()).toBeUndefined();
    expect(findId("routine-conflict-morning")).toBeUndefined();
    expect(byId("routine-step-morning-0").props["aria-pressed"]).toBe(false);
    expect(byId("routine-step-morning-1").props["aria-pressed"]).toBe(true);
  });

  it("two devices: a tick whose step was changed elsewhere is not forced onto another step; the row says it was not saved", async () => {
    offlineStart(); const ticks = await tickOffline();
    vi.stubGlobal("navigator", { onLine: true });
    const changed: Routine = { id: "morning", name: "Invented morning", steps: [{ text: "Find a cup", done: true }, { text: "Open the blinds", done: false }] };
    source([withTicks(changed, ticks) as Routine, goodbye()]); render();
    expect(h.writes[1].row.steps).toEqual(changed.steps);
    h.writes[1].resolve(); await flush();
    source([h.writes[1].row, goodbye()]); render();
    const conflict = byId("routine-conflict-morning");
    expect(conflict.props.role).toBe("alert");
    expect(conflict.props.children).toBe(translate("en", "elev.closeloop.routines.failed"));
  });

  it("a routine deleted on the other device while this phone held a tick is never listed and is cleared on reconnect", async () => {
    const { deleteDoc } = await import("firebase/firestore");
    offlineStart(); const ticks = await tickOffline();
    vi.stubGlobal("navigator", { onLine: true });
    source([{ id: "morning", offlineTicks: ticks } as unknown as Routine, goodbye()]); render();
    expect(findId("routine-row-morning")).toBeUndefined();
    expect(deleteDoc).toHaveBeenCalled();
  });

  it("online but unreachable: after the queue window the row says 'Still sending…', never an endless Saving…", async () => {
    vi.useFakeTimers(); remoteStart();
    click("routine-step-morning-1"); expect(h.writes).toHaveLength(1);
    expect(byId("routine-pending-morning").props.active).toBe(true);
    await vi.advanceTimersByTimeAsync(4100);
    expect(queuedLine()!.props.children).toBe(translate("en", "elev.sync.savedOnPhoneSending"));
    expect(byId("routine-pending-morning").props.active).toBe(false);
    expect(receipt()).toBeUndefined();
    source([morning(true), goodbye()]); h.writes[0].resolve(); await flush(); render();
    expect(queuedLine()).toBeUndefined();
    expect(receipt()!.props.children).toBe(translate("en", "elev.closeloop.routines.saved"));
  });

  it("negative control: online, an unconfirmed (cached) read still locks the checklist", () => {
    h.remote = true; render(); source([morning(), goodbye()], { fromCache: true }); render();
    expect(byId("routine-step-morning-1").props.disabled).toBe(true);
    click("routine-step-morning-1"); expect(h.writes).toHaveLength(0);
  });
});
