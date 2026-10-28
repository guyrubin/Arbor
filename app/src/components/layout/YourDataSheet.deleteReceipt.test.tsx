/**
 * B-BOOK-20 (critic r1) — the delete receipt the parent reads reconciles with
 * what the erase reached. Drives the real sheet callbacks (typed name →
 * deleteChild → receipt) with deterministic hook slots; the erase itself is a
 * synthetic boundary returning the receipt shapes eraseEverything produces.
 *  - a clean erase keeps today's complete state;
 *  - a forced server failure (500) and a partial result read "Deletion not
 *    finished", name the rows not reached, offer Try again and Save receipt;
 *  - the sheet says how many places each row stands for in plain words and
 *    shows no internal place id; the saved receipt file keeps every id;
 *  - Try again erases the same child again and folds into one receipt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile, DeletionReceipt } from "../../types";
import { translate, type UiLang } from "../../lib/i18n";

const h = vi.hoisted(() => ({
  child: { id: "child-a", name: "Synthetic Child" } as ChildProfile,
  lang: "en" as UiLang,
  cursor: 0, slots: [] as { value?: any; deps?: unknown[]; cleanup?: () => void }[], effects: [] as (() => void)[],
  deleteChild: (async () => null) as (id: string) => Promise<unknown>,
  downloads: [] as [string, unknown][],
  uid: "owner",
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
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ deleteChild: (id: string) => h.deleteChild(id) }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars), uiLang: h.lang }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../ui/Icon", () => ({ default: () => null }));
vi.mock("../ui/Modal", () => ({ default: () => null }));
vi.mock("../../lib/childData", () => ({
  exportChildData: vi.fn(), downloadJson: vi.fn(),
  downloadDeletionReceipt: (r: { erasedAt: string }) => { h.downloads.push([`arbor-deletion-receipt-${r.erasedAt.slice(0, 10)}.json`, r]); },
}));
vi.mock("../../lib/childExportRun", () => ({ createChildExportRun: () => ({ cancel() {}, begin() { return {}; }, current() { return false; }, finish() {} }) }));
vi.mock("../../lib/childExportSession", () => ({ withChildExportSession: vi.fn() }));
vi.mock("../../lib/childExportFilename", () => ({ childExportFilename: () => "x.json" }));

import YourDataSheet from "./YourDataSheet";
import { childSinkIds } from "../../lib/childDataSinks";

const SUBS = ["behaviorLogs", "milestones"];
const IDS = childSinkIds(SUBS);
const ledger = (over: Record<string, number | "cleared" | "not-reached"> = {}) =>
  Object.fromEntries(IDS.map((id) => [id, over[id] ?? (id.startsWith("device:") && id !== "device:webStorage" ? "cleared" : 1)])) as DeletionReceipt["sinks"];
const receipt = (sinks: DeletionReceipt["sinks"], counts: Partial<DeletionReceipt["counts"]> = {}): DeletionReceipt => ({
  childId: h.child.id, erasedAt: "2026-10-28T10:00:00.000Z",
  counts: { memoryEvents: 3, shares: 1, consents: 2, consultRequests: 1, storageFiles: 7, clientDocs: 4, ...counts }, sinks,
});

function elements(value: any): any[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  return value && typeof value === "object" ? [value, ...elements(value.props?.children)] : [];
}
function text(value: any): string {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value == null || typeof value === "boolean") return "";
  return typeof value === "object" ? text(value.props?.children) : String(value);
}
const render = (open = true) => { h.cursor = 0; const tree = YourDataSheet({ open, onClose: vi.fn() }); for (const e of h.effects.splice(0)) e(); return tree; };
const byTestId = (tree: any, id: string) => elements(tree).find((e) => e.props?.["data-testid"] === id);
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

async function eraseWith(result: DeletionReceipt) {
  h.slots = []; h.effects = []; h.downloads = [];
  h.deleteChild = vi.fn(async () => result);
  let tree = render();
  byTestId(tree, "delete-child-btn").props.onClick();
  tree = render();
  byTestId(tree, "delete-confirm-input").props.onChange({ target: { value: "Synthetic" } });
  tree = render();
  await byTestId(tree, "delete-confirm-btn").props.onClick();
  await tick();
  return render();
}
const titleOf = (tree: any) => tree.props.title;
/** Each row's plain-language places line, by label. */
const notes = (tree: any) => Object.fromEntries(elements(byTestId(tree, "delete-receipt")).filter((e) => "label" in (e.props ?? {}) && "value" in e.props && e.props.note).map((e) => [e.props.label, e.props.note]));
/** The receipt rows as rendered: label → value (ReceiptRow elements). */
const rows = (tree: any) => Object.fromEntries(elements(byTestId(tree, "delete-receipt")).filter((e) => "label" in (e.props ?? {}) && "value" in e.props).map((e) => [e.props.label, e.props.value]));
const rowValues = (tree: any) => text(byTestId(tree, "delete-receipt"));

class MemStore {
  map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
let device: MemStore;
beforeEach(() => { device = new MemStore(); vi.stubGlobal("localStorage", device as unknown as Storage); });
afterEach(() => { h.lang = "en"; h.uid = "owner"; vi.unstubAllGlobals(); });

describe.each(["en", "he"] as const)("delete receipt (%s)", (lang) => {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);

  it("a clean erase keeps today's complete state", async () => {
    h.lang = lang;
    const tree = await eraseWith(receipt(ledger()));
    expect(titleOf(tree)).toBe(t("sec.sharing.receipt.title"));
    expect(byTestId(tree, "delete-receipt").props["data-receipt-state"]).toBe("complete");
    expect(byTestId(tree, "delete-receipt-retry")).toBeUndefined();
    expect(Object.values(rows(tree))).not.toContain(t("elev.learnCare.receipt.notReached"));
    expect(rows(tree)[t("elev.learnCare.receipt.storageFiles")]).toBe(7);
    expect(Object.keys(rows(tree))).toHaveLength(7);
    expect(rowValues(tree)).toContain(t("sec.sharing.receipt.body", { name: "Synthetic", date: "" }).split("{")[0].slice(0, 12));
    // The places, in plain words: the saved records stand for 3 places here
    // (2 collections + the profile), the device for 5.
    expect(notes(tree)[t("elev.learnCare.receipt.records")]).toBe(t("elev.learnCare.receipt.placesAll", { n: 3 }));
    expect(notes(tree)[t("elev.learnCare.receipt.clientDocs")]).toBe(t("elev.learnCare.receipt.placesAll", { n: 5 }));
    expect(byTestId(tree, "delete-receipt-ledger")).toBeUndefined();
  });

  it("a forced server failure (500): not finished, the server rows say not reached, Try again and Save are offered", async () => {
    h.lang = lang;
    const failed = ledger(Object.fromEntries(["server:memoryEvents", "server:familyChildRef", "server:shares", "server:consents", "server:consultRequests", "storage:photos", "storage:books"].map((id) => [id, "not-reached" as const])));
    const tree = await eraseWith(receipt(failed, { memoryEvents: 0, shares: 0, consents: 0, storageFiles: 0 }));
    expect(titleOf(tree)).toBe(t("elev.learnCare.receipt.unfinishedTitle"));
    expect(byTestId(tree, "delete-receipt").props["data-receipt-state"]).toBe("unfinished");
    expect(rowValues(tree)).toContain(t("elev.learnCare.receipt.unfinishedBody", { name: "Synthetic" }));
    const shown = rows(tree);
    for (const key of ["sec.sharing.receipt.memoryEvents", "sec.sharing.receipt.shares", "sec.sharing.receipt.consents", "elev.learnCare.receipt.consultRequests", "elev.learnCare.receipt.storageFiles"]) {
      expect(shown[t(key)], key).toBe(t("elev.learnCare.receipt.notReached"));
    }
    // Each row's state comes from its own places: the saved records the
    // device erased are counted, the server failure does not mark them.
    expect(shown[t("elev.learnCare.receipt.records")]).toBe(3);
    expect(shown[t("elev.learnCare.receipt.clientDocs")]).toBe(4); // the device half did run
    expect(Object.keys(shown)).toHaveLength(7);
    expect(notes(tree)[t("sec.sharing.receipt.memoryEvents")]).toBe(t("elev.learnCare.receipt.placesSome", { n: 2, m: 2 }));
    expect(notes(tree)[t("sec.sharing.receipt.shares")]).toBeUndefined(); // one place: the value says it
    expect(byTestId(tree, "delete-receipt-retry")).toBeDefined();
    byTestId(tree, "delete-receipt-save").props.onClick();
    expect(h.downloads).toHaveLength(1);
    expect(h.downloads[0][0]).toBe("arbor-deletion-receipt-2026-10-28.json");
    expect((h.downloads[0][1] as DeletionReceipt).sinks).toEqual(failed);
  });

  it("a partial result: not finished, only the records row is not reached", async () => {
    h.lang = lang;
    const tree = await eraseWith(receipt(ledger({ "firestore:milestones": "not-reached" })));
    expect(titleOf(tree)).toBe(t("elev.learnCare.receipt.unfinishedTitle"));
    const shown = rows(tree);
    expect(Object.entries(shown).filter(([, v]) => v === t("elev.learnCare.receipt.notReached")).map(([k]) => k)).toEqual([t("elev.learnCare.receipt.records")]);
    expect(notes(tree)[t("elev.learnCare.receipt.records")]).toBe(t("elev.learnCare.receipt.placesOne", { n: 3 }));
  });

  it("Try again erases the same child again and folds into one finished receipt", async () => {
    h.lang = lang;
    let tree = await eraseWith(receipt(ledger({ "server:shares": "not-reached" }), { shares: 0 }));
    expect(titleOf(tree)).toBe(t("elev.learnCare.receipt.unfinishedTitle"));
    h.deleteChild = vi.fn(async () => receipt(ledger({ "firestore:behaviorLogs": 0, "firestore:milestones": 0, profile: 0 }), { memoryEvents: 0, consents: 0, storageFiles: 0, clientDocs: 0 }));
    await byTestId(tree, "delete-receipt-retry").props.onClick();
    await tick();
    tree = render();
    expect(h.deleteChild).toHaveBeenCalledWith("child-a");
    expect(titleOf(tree)).toBe(t("sec.sharing.receipt.title"));
    expect(byTestId(tree, "delete-receipt-retry")).toBeUndefined();
  });
});

describe("the sheet speaks in places, never in internal ids (critic r2)", () => {
  it.each(["en", "he"] as const)("no firestore:/device:/storage:/server: id is rendered; the saved receipt keeps them (%s)", async (lang) => {
    h.lang = lang;
    const failed = ledger({ "server:shares": "not-reached", "firestore:milestones": "not-reached" });
    const tree = await eraseWith(receipt(failed, { shares: 0 }));
    const rendered = JSON.stringify(elements(byTestId(tree, "delete-receipt")).map((e) => [e.props?.label, e.props?.note, e.props?.value, typeof e.props?.children === "string" ? e.props.children : ""]));
    expect(rendered).not.toMatch(/firestore:|device:|storage:|server:/);
    byTestId(tree, "delete-receipt-save").props.onClick();
    const saved = h.downloads.at(-1)![1] as DeletionReceipt;
    expect(Object.keys(saved.sinks!)).toEqual(IDS);
    expect(saved.sinks!["firestore:milestones"]).toBe("not-reached");
  });
});

/* Round 4 (critic r3 P1): Done or × on an unfinished receipt used to throw it
   away, and the child had already left the switcher, so nothing could finish
   the server erase. The unfinished receipt is kept on the device and Your data
   offers to finish it until a retry completes.
   Round 5 (critic r4): kept per account and without the child's name; the
   offer is the sheet's FIRST item, one line, its own icon and the primary
   style (not the pink trash of "Delete child data"); an unfinished receipt
   closes with "Close", never "Done". */
describe.each(["en", "he"] as const)("an unfinished erase survives close and reopen (%s)", (lang) => {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const unfinished = () => receipt(ledger({ "server:memoryEvents": "not-reached", "server:familyChildRef": "not-reached" }), { memoryEvents: 0 });
  const buttonWith = (tree: any, label: string) => elements(byTestId(tree, "delete-receipt")).find((e) => e.type === "button" && text(e.props.children).includes(label));
  const menuItems = (tree: any) => elements(byTestId(tree, "your-data-sheet").props.children).filter((e) => e.type === "button" || e.type === "p");

  it("close → reopen: the offer comes first, one nameless line, its own icon; the retry completes and the offer is gone", async () => {
    h.lang = lang;
    let tree = await eraseWith(unfinished());
    expect(byTestId(tree, "delete-receipt").props["data-receipt-state"]).toBe("unfinished");
    const kept = JSON.parse(device.getItem("arbor.pendingErase")!);
    expect(kept).toMatchObject([{ uid: "owner", childId: "child-a" }]);
    expect(JSON.stringify(kept)).not.toContain("Synthetic"); // no name on the device

    // An unfinished receipt closes with "Close" (HE סגירה), never "Done" next to "Try again".
    expect(buttonWith(tree, t("sec.sharing.receipt.done"))).toBeUndefined();
    const close = byTestId(tree, "delete-receipt-close");
    expect(text(close.props.children)).toBe(t("elev.learnCare.receipt.close"));
    if (lang === "he") expect(t("elev.learnCare.receipt.close")).toBe("סגירה");
    close.props.onClick();
    render(false);
    tree = render(true);
    expect(byTestId(tree, "delete-receipt")).toBeUndefined();

    const finish = byTestId(tree, "finish-erase-btn");
    expect(menuItems(tree)[0]).toBe(finish); // first, above the sheet's own line and Export
    expect(text(finish.props.children).trim()).toBe(t("elev.learnCare.receipt.finish")); // one line, nothing else
    expect(text(finish.props.children)).not.toContain("Synthetic");
    const icon = (e: any) => elements(e.props.children).find((c) => "name" in (c.props ?? {}))?.props.name;
    expect(icon(finish)).toBe("pending");
    expect(icon(byTestId(tree, "delete-child-btn"))).toBe("delete");
    expect(finish.props.style.background).toBe("var(--arbor-green-ink)");
    expect(byTestId(tree, "delete-child-btn").props.style.background).toBe("var(--arbor-pink-soft)");

    // The retry runs through the real handler with the kept receipt.
    h.deleteChild = vi.fn(async () => receipt(ledger({ "firestore:behaviorLogs": 0, "firestore:milestones": 0, profile: 0 }), { shares: 0, consents: 0, consultRequests: 0, storageFiles: 0, clientDocs: 0 }));
    await finish.props.onClick();
    await tick();
    tree = render();
    expect(h.deleteChild).toHaveBeenCalledWith("child-a");
    expect(titleOf(tree)).toBe(t("sec.sharing.receipt.title"));
    expect(rowValues(tree)).toContain(t("elev.learnCare.receipt.bodyNoName", { date: "" }).split("{")[0].slice(0, 12));
    expect(rowValues(tree)).not.toContain("Synthetic");
    expect(device.getItem("arbor.pendingErase")).toBeNull();

    buttonWith(tree, t("sec.sharing.receipt.done")).props.onClick();
    render(false);
    expect(byTestId(render(true), "finish-erase-btn")).toBeUndefined();
  });

  it("a fresh session (the app reloaded) still offers to finish, and a retry that fails again keeps the offer, nameless", async () => {
    h.lang = lang;
    await eraseWith(unfinished());
    h.slots = []; h.effects = [];           // a new mount reads the device
    let tree = render(true);
    expect(byTestId(tree, "finish-erase-btn")).toBeDefined();
    h.deleteChild = vi.fn(async () => unfinished());
    await byTestId(tree, "finish-erase-btn").props.onClick();
    await tick();
    tree = render();
    expect(titleOf(tree)).toBe(t("elev.learnCare.receipt.unfinishedTitle"));
    expect(rowValues(tree)).toContain(t("elev.learnCare.receipt.unfinishedBodyNoName"));
    expect(text(byTestId(tree, "delete-receipt-close").props.children)).toBe(t("elev.learnCare.receipt.close"));
    expect(JSON.parse(device.getItem("arbor.pendingErase")!)).toHaveLength(1);
  });

  it("another account on the same device is never offered it", async () => {
    h.lang = lang;
    await eraseWith(unfinished());
    h.uid = "synthetic-next-account";
    h.slots = []; h.effects = [];
    expect(byTestId(render(true), "finish-erase-btn")).toBeUndefined();
  });
});
