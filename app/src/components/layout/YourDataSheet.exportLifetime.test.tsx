/** Executes the real sheet callbacks, owner session, child export, private-byte
 * reader and final download seam with deterministic hook slots and synthetic
 * SDK/fetch/DOM boundaries. No browser download or external request occurs. */
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile } from "../../types";
import { translate, type UiLang } from "../../lib/i18n";

const h = vi.hoisted(() => ({
  child: { id: "child-a", name: "Synthetic" } as ChildProfile,
  lang: "en" as UiLang, partial: false, filenames: [] as string[],
  currentUser: { uid: "owner" } as { uid: string } | null,
  renderedUser: { uid: "owner" } as { uid: string } | null,
  authListeners: new Set<(user: { uid: string } | null) => void>(),
  kidListeners: new Set<(active: boolean) => void>(), locked: false,
  cursor: 0, slots: [] as { value?: any; deps?: unknown[]; cleanup?: () => void }[], effects: [] as (() => void)[],
  wait: async (_stage: string) => {}, paths: [] as string[], requests: [] as string[],
  click: vi.fn(), createUrl: vi.fn(), revokeUrl: vi.fn(), toast: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState(initial: unknown) {
    const i = h.cursor++, slot = h.slots[i] ??= { value: typeof initial === "function" ? initial() : initial };
    return [slot.value, (next: any) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
  },
  useRef(initial: unknown) { const i = h.cursor++; return (h.slots[i] ??= { value: { current: initial } }).value; },
  useEffect(effect: () => void | (() => void), deps: unknown[]) {
    const i = h.cursor++, old = h.slots[i];
    if (old?.deps && deps.length === old.deps.length && deps.every((v, n) => Object.is(v, old.deps![n]))) return;
    const slot = h.slots[i] = { deps, cleanup: old?.cleanup };
    h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
  },
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: h.child, setActiveTab: vi.fn() }) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ deleteChild: vi.fn() }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: h.renderedUser }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars), uiLang: h.lang }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("../ui/Icon", () => ({ default: () => null }));
vi.mock("../ui/Modal", () => ({ default: () => null }));
vi.mock("../../lib/firebase", () => ({ auth: h, db: {}, firebaseEnabled: true }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: (_: unknown, listener: (user: { uid: string } | null) => void) => {
  h.authListeners.add(listener); return () => h.authListeners.delete(listener);
} }));
vi.mock("firebase/firestore", () => ({
  collection: (_: unknown, path: string) => path, doc: vi.fn(), deleteDoc: vi.fn(),
  getDocs: async (path: string) => {
    h.paths.push(path); await h.wait("collection");
    return { docs: path.endsWith("/bookAssets") ? [{ id: "book", data: () => ({ bookId: "book", files: ["manifest.json"] }) }] : [] };
  },
}));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => h.locked, subscribeKidMode: (listener: (active: boolean) => void) => {
  h.kidListeners.add(listener); return () => h.kidListeners.delete(listener);
} }));

import YourDataSheet from "./YourDataSheet";
import { setAuthTokenProvider } from "../../lib/api";

const stages = ["privacy token", "privacy response", "privacy body", "collection", "inventory token", "inventory response", "inventory body", "file token", "file response", "file body", "digest"];
function elements(value: any): any[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  return value && typeof value === "object" ? [value, ...elements(value.props?.children)] : [];
}
const render = (open = true) => { h.cursor = 0; return YourDataSheet({ open, onClose: vi.fn() }); };
const commit = () => { for (const effect of h.effects.splice(0)) effect(); };
const unmount = () => { for (const slot of h.slots) slot.cleanup?.(); };
const clickExport = (tree: any) => elements(tree).find(e => e.props?.["data-testid"] === "your-data-export").props.onClick() as Promise<void>;
// Model the browser boundary that drops focus to body when React disables the
// active button. No focusin or childList mutation is emitted for that change.
// The sheet callback and its actual ref run unchanged; browser acceptance is
// still the exact capture's focusInsideDialog assertion.
function bindExportFocus(tree: any, focused = true) {
  const doc = document as unknown as { activeElement: unknown };
  const body = {}, close = {};
  const dialog = { focus: vi.fn(() => { doc.activeElement = dialog; }) };
  const button = { closest: vi.fn(() => dialog) };
  const control = elements(tree).find(e => e.props?.["data-testid"] === "your-data-export");
  if (control.props.ref) control.props.ref.current = button;
  doc.activeElement = focused ? button : close;
  return { doc, dialog, button, close, commitDisabled() {
    const pending = elements(render()).find(e => e.props?.["data-testid"] === "your-data-export");
    expect(pending.props.disabled).toBe(true);
    if (doc.activeElement === button) doc.activeElement = body;
  } };
}
const owner = (user: { uid: string } | null) => { h.currentUser = user; for (const listener of h.authListeners) listener(user); };
const kid = (active: boolean) => { h.locked = active; for (const listener of h.kidListeners) listener(active); };
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function body(stage: string, text: string) {
  let cancelled = false;
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      await h.wait(stage);
      if (!cancelled) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); }
    },
    cancel() { cancelled = true; },
  }));
}
function pause(stage: string) {
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(r => { enter = r; });
  const held = new Promise<void>(r => { release = r; });
  h.wait = async next => { if (next === stage) { enter(); await held; } };
  return { entered, release };
}
beforeEach(() => {
  vi.clearAllMocks(); h.child = { id: "child-a", name: "Synthetic" } as ChildProfile;
  h.lang = "en"; h.partial = false; h.filenames = [];
  h.currentUser = { uid: "owner" }; h.renderedUser = h.currentUser; h.locked = false;
  h.cursor = 0; h.slots = []; h.effects = []; h.paths = []; h.requests = []; h.wait = async () => {};
  let tokens = 0;
  setAuthTokenProvider(async () => { await h.wait(["privacy token", "inventory token", "file token"][tokens++] ?? "later token"); return "synthetic-token"; });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    h.requests.push(url);
    if (url.includes("privacy/export")) {
      await h.wait("privacy response");
      return { ok: true, json: async () => { await h.wait("privacy body"); return { serverData: { memoryEvents: [], shares: [] } }; } };
    }
    if (url.endsWith("export-manifest")) {
      await h.wait("inventory response");
      if (h.partial) return new Response("Unavailable", { status: 503 });
      return body("inventory body", JSON.stringify({ version: 1, childId: "child-a", status: "complete", issues: [], files: [{ bookId: "book", path: "manifest.json", bytes: 4 }] }));
    }
    await h.wait("file response"); return body("file body", "DATA");
  }));
  vi.stubGlobal("crypto", { subtle: { digest: async (...args: Parameters<typeof webcrypto.subtle.digest>) => {
    await h.wait("digest"); return webcrypto.subtle.digest(...args);
  } } });
  h.createUrl.mockReturnValue("blob:synthetic");
  vi.spyOn(URL, "createObjectURL").mockImplementation(h.createUrl);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(h.revokeUrl);
  vi.stubGlobal("document", { createElement: () => ({ href: "", download: "", click() { h.filenames.push(this.download); h.click(); } }) });
});
afterEach(async () => {
  unmount(); await flush();
  expect(h.authListeners.size).toBe(0); expect(h.kidListeners.size).toBe(0);
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

const interruptions = ["sibling", "sibling round trip", "close", "closed prop", "unmount", "account switch", "account round trip", "kid round trip"] as const;
function interrupt(kind: typeof interruptions[number], tree: any) {
  if (kind === "sibling" || kind === "sibling round trip") { h.child = { ...h.child, id: "child-b" }; render(); }
  if (kind === "sibling round trip") { h.child = { ...h.child, id: "child-a" }; render(); }
  if (kind === "close") tree.props.onClose();
  if (kind === "closed prop") render(false);
  if (kind === "unmount") unmount();
  if (kind === "account switch") owner({ uid: "other" });
  if (kind === "account round trip") { const original = h.currentUser; owner(null); owner({ uid: "other" }); owner(original); }
  if (kind === "kid round trip") { kid(true); kid(false); }
}
describe.each(stages)("real parent export interrupted at %s", stage => {
  it.each(interruptions)("retires bytes and final download after %s", async kind => {
    const gate = pause(stage); const tree = render(); commit(); const pending = clickExport(tree);
    await gate.entered;
    const requests = h.requests.length, reads = h.paths.length;
    interrupt(kind, tree);
    gate.release(); await pending; await flush();
    expect(h.click).not.toHaveBeenCalled(); expect(h.createUrl).not.toHaveBeenCalled();
    expect(h.requests).toHaveLength(requests); expect(h.paths).toHaveLength(reads);
  });
});

describe("final browser boundary and fresh parent action", () => {
  it.each(["en", "he"] as const)("keeps focus inside the pending sheet before disabling, including a repeated interrupted run (%s)", async lang => {
    h.lang = lang;
    for (const interrupted of [false, true]) {
      const gate = pause("privacy response"), tree = render(); commit();
      const focus = bindExportFocus(tree);
      const pending = clickExport(tree); focus.commitDisabled();
      expect(focus.doc.activeElement).toBe(focus.dialog);
      expect(focus.button.closest).toHaveBeenCalledExactlyOnceWith('[role="dialog"]');
      expect(focus.dialog.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
      await gate.entered;
      // The parent can reach Close while pending. Completion/cancellation must
      // not reclaim focus or restart the old action.
      focus.doc.activeElement = focus.close;
      if (interrupted) tree.props.onClose();
      gate.release(); await pending;
      expect(focus.doc.activeElement).toBe(focus.close);
      expect(focus.dialog.focus).toHaveBeenCalledTimes(1);
      expect(h.click).toHaveBeenCalledTimes(1);
      if (!interrupted) { tree.props.onClose(); render(false); commit(); }
    }
  });
  it("does not steal focus from another sheet control when Export was not focused", async () => {
    const gate = pause("privacy response"), tree = render(); commit();
    const focus = bindExportFocus(tree, false), pending = clickExport(tree);
    focus.commitDisabled();
    expect(focus.doc.activeElement).toBe(focus.close);
    expect(focus.dialog.focus).not.toHaveBeenCalled();
    await gate.entered; tree.props.onClose(); gate.release(); await pending;
    expect(h.click).not.toHaveBeenCalled();
  });
  it("a stale export callback cannot reclaim focus after the sheet closes", async () => {
    const tree = render(); commit(); const focus = bindExportFocus(tree);
    tree.props.onClose(); await clickExport(tree);
    expect(focus.dialog.focus).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled(); expect(h.click).not.toHaveBeenCalled();
  });
  it.each([
    { lang: "en", name: "Noa Levi נועה", token: "noa", partial: false },
    { lang: "en", name: "Noa Levi נועה", token: "noa", partial: true },
    { lang: "he", name: "נועה לוי Noa", token: "child", partial: false },
    { lang: "he", name: "נועה לוי Noa", token: "child", partial: true },
  ] as const)("keeps original profile and localized receipt with a portable filename: $lang, partial=$partial", async ({ lang, name, token, partial }) => {
    h.lang = lang; h.child = { ...h.child, name }; h.partial = partial;
    const tree = render(); commit(); await clickExport(tree);
    expect(h.filenames).toEqual([`arbor-${token}-data${partial ? ".partial" : ""}.json`]);
    const data = JSON.parse(await (h.createUrl.mock.calls[0][0] as Blob).text());
    expect(data.profile.name).toBe(name); expect(h.child.name).toBe(name);
    expect(data.exportReceipt.status).toBe(partial ? "incomplete" : "complete");
    expect(data.exportNote).toBe(translate(lang, "sec.sharing.data.exportNote"));
    expect(Object.keys(data.collections)).toHaveLength(43);
    const after = elements(render());
    expect(after.find(e => e.props?.["data-testid"] === "your-data-export-receipt").props.children)
      .toBe(translate(lang, partial ? "elev.yourData.exportPartial" : "elev.yourData.exportComplete"));
    expect(after.find(e => e.props?.["data-testid"] === "your-data-export").props.children)
      .toContain(translate(lang, "elev.yourData.export", { name: name.split(" ")[0] }));
  });
  it("downloads once only after the parent's action, with bounded complete bytes", async () => {
    const tree = render(); commit(); expect(fetch).not.toHaveBeenCalled(); expect(h.click).not.toHaveBeenCalled();
    const first = clickExport(tree); await clickExport(tree); await first;
    expect(h.click).toHaveBeenCalledTimes(1); expect(h.revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:synthetic");
    const data = JSON.parse(await (h.createUrl.mock.calls[0][0] as Blob).text());
    expect(data.profile.id).toBe("child-a"); expect(data.exportReceipt.status).toBe("complete");
    expect(data.privateBookAssets.files[0].data).toBe("REFUQQ==");
  });
  it.each(interruptions)("rechecks after URL preparation and revokes the URL on %s", async kind => {
    const tree = render(); commit(); h.createUrl.mockImplementation(() => { interrupt(kind, tree); return "blob:synthetic"; });
    await clickExport(tree);
    expect(h.click).not.toHaveBeenCalled(); expect(h.revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:synthetic");
  });
  it.each(["close", "unmount", "sibling round trip"] as const)("a captured click cannot start a read after %s", async kind => {
    const tree = render(); commit(); interrupt(kind, tree); await clickExport(tree);
    expect(fetch).not.toHaveBeenCalled(); expect(h.paths).toEqual([]); expect(h.click).not.toHaveBeenCalled();
  });
  it("rejects a parent click while Kid Mode is active", async () => {
    const tree = render(); commit(); kid(true); await clickExport(tree);
    expect(fetch).not.toHaveBeenCalled(); expect(h.click).not.toHaveBeenCalled();
  });
  it("cancels a stalled digest without waiting for crypto to settle", async () => {
    const gate = pause("digest"); const tree = render(); commit(); const pending = clickExport(tree);
    await gate.entered; tree.props.onClose(); await pending; await flush();
    expect(h.authListeners.size).toBe(0); expect(h.kidListeners.size).toBe(0); expect(h.click).not.toHaveBeenCalled();
    gate.release(); await flush();
  });
});
