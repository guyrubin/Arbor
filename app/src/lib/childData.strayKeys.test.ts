/**
 * LC-18 — the client wipe swept only the keys it could NAME.
 *
 * `wipeClientChildData` looped CHILD_SUBCOLLECTIONS and removed
 * `arbor.<name>.<childId>` for each. Every other per-child device key survived
 * a delete: the Safety warning-sign checklist (`arbor.safetyChecklist.<id>`,
 * SafetyTab.tsx:57) and the consult export history
 * (`arbor.consultExports.<id>`, consult/exportHistory.ts:17) both did, and so
 * would anything a future surface writes — the same named-list blind spot that
 * `clearChildLocalState` already exists to close. And the deletion receipt, the
 * parent's PROOF, counted only what the server erased: the device in their hand
 * was absent from it.
 */
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isChildScopedKey } from "./childLocalState";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");

const CHILD = "child-42";
const OTHER = "child-99";

/** The two stray keys the item names, plus one the item did not. */
const STRAY = [
  `arbor.safetyChecklist.${CHILD}`,
  `arbor.consultExports.${CHILD}`,
  `arbor.someFutureSurface.${CHILD}`,
];
/** Keys the sweep must NOT touch. */
const KEEP = [`arbor.safetyChecklist.${OTHER}`, "arbor.uiLang", "unrelated.key"];

class MemStore {
  map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

let store: MemStore;

beforeEach(() => {
  store = new MemStore();
  for (const k of [...STRAY, ...KEEP]) store.setItem(k, "1");
  vi.stubGlobal("localStorage", store as unknown as Storage);
  vi.stubGlobal("sessionStorage", new MemStore() as unknown as Storage);
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => ({ erased: { memoryEvents: 0, shares: 0 } }),
    text: async () => "{}",
  })) as unknown as typeof fetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("LC-18 · negative control", () => {
  it("the named-list sweep would NOT have reached these keys", () => {
    const named = ["behaviorLogs", "milestones", "savedLearn", "appointments"];
    const preFixReach = (key: string) => named.some((n) => key === `arbor.${n}.${CHILD}`);
    for (const k of STRAY) expect(preFixReach(k), `${k} was already reachable`).toBe(false);
    // …while the sweep the fix uses does recognise every one of them.
    for (const k of STRAY) expect(isChildScopedKey(k, CHILD), k).toBe(true);
    for (const k of KEEP) expect(isChildScopedKey(k, CHILD), k).toBe(false);
  });
});

describe("LC-18 · every arbor.*.<childId> key goes", () => {
  it("eraseEverything removes the stray keys and leaves the others", async () => {
    const { eraseEverything } = await import("./childData");
    await eraseEverything(undefined, CHILD);
    for (const k of STRAY) expect(store.getItem(k), `${k} survived the delete`).toBeNull();
    for (const k of KEEP) expect(store.getItem(k), `${k} was swept but is not this child's`).toBe("1");
  });

  it("the receipt counts what the device sweep removed", async () => {
    const { eraseEverything } = await import("./childData");
    const receipt = await eraseEverything(undefined, CHILD);
    expect(receipt.counts.clientDocs).toBe(STRAY.length);
    expect(receipt.childId).toBe(CHILD);
  });

  it("deleteChildData sweeps the same way (one wipe, two callers)", async () => {
    const { deleteChildData } = await import("./childData");
    await deleteChildData(undefined, CHILD);
    for (const k of STRAY) expect(store.getItem(k)).toBeNull();
  });
});

describe("LC-18 · the wiring is the shared sweep, not a second copy", () => {
  it("childData delegates to clearChildLocalState rather than re-implementing it", () => {
    const src = read("lib/childData.ts");
    expect(src).toContain('import { clearChildLocalState } from "./childLocalState";');
    expect(src).toContain("return clearChildLocalState(childId);");
    // The receipt carries the number that sweep returned.
    expect(src).toContain("const clientDocs = await wipeClientChildData(uid, childId);");
    expect(src).toContain("counts: { ...counts, clientDocs }");
  });

  it("the receipt surface shows the count to the parent", () => {
    const sharing = read("components/sections/TrustedSharing.tsx");
    expect(sharing).toContain('t("elev.learnCare.receipt.clientDocs")');
    expect(sharing).toContain("receipt.counts.clientDocs ?? 0");
  });
});
