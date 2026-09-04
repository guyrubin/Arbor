/**
 * LC-21 — Learn read state: per-child, device-local, sweepable, silent.
 *
 * Every rule here carries a NEGATIVE CONTROL, because each of these properties
 * has been quietly lost in this repo before:
 *  · the key must be sweepable by the REAL `isChildScopedKey` (four keys have
 *    escaped that sweep by gluing a suffix onto the child id);
 *  · a blocked or corrupt store must render an unmarked library, not throw —
 *    and the "it degrades" tests must be shown non-vacuous by proving the same
 *    fake store DOES round-trip when it is working;
 *  · the count is a count, intersected with the catalogue.
 */
import { describe, expect, it } from "vitest";
import { isChildScopedKey, clearChildLocalState } from "../lib/childLocalState";
import {
  MAX_TRACKED_READS,
  isLearnCardRead,
  learnReadCount,
  learnReadKey,
  markLearnCardRead,
  readLearnReadIds,
  type ReadStateStore,
} from "./learnReadState";

/** In-memory store (node env — no DOM), matching the exportHistory pattern. */
function fakeStore(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

/** A store that throws on every operation — private window / storage blocked. */
const hostileStore: ReadStateStore = {
  getItem() { throw new Error("storage is blocked"); },
  setItem() { throw new Error("storage is blocked"); },
};

const KID = "kid-lc21";

describe("the key follows the sweepable per-child convention", () => {
  it("is arbor-namespaced with the child id as the last dot-delimited segment", () => {
    expect(learnReadKey(KID)).toBe(`arbor.learn.read.${KID}`);
  });

  it("the REAL isChildScopedKey would sweep it on child deletion", () => {
    expect(isChildScopedKey(learnReadKey(KID), KID)).toBe(true);
  });

  it("clearChildLocalState actually removes it, and leaves the sibling alone", () => {
    const local = fakeStore({
      [learnReadKey(KID)]: JSON.stringify(["a"]),
      [learnReadKey("kid-other")]: JSON.stringify(["b"]),
      "arbor.familyCharter": JSON.stringify(["Courage"]),
      "arbor.uiLang": "he",
    });
    const removed = clearChildLocalState(KID, { local, session: null });
    expect(removed).toBe(1);
    expect(local.getItem(learnReadKey(KID))).toBeNull();
    // Sibling's shelf and the per-family / per-device rows survive.
    expect(local.getItem(learnReadKey("kid-other"))).not.toBeNull();
    expect(local.getItem("arbor.familyCharter")).not.toBeNull();
    expect(local.getItem("arbor.uiLang")).toBe("he");
  });

  it("NEGATIVE CONTROL — the unsweepable shapes this convention exists to prevent", () => {
    // Suffix glued onto the id (how growth.month.seen and todaysFocus leaked).
    expect(isChildScopedKey(`arbor.learn.read.${KID}en`, KID)).toBe(false);
    // Id folded into the namespace with no delimiter.
    expect(isChildScopedKey(`arbor.learnRead${KID}`, KID)).toBe(false);
    // Wrong namespace: outside the arbor prefix the sweep never looks.
    expect(isChildScopedKey(`learn.read.${KID}`, KID)).toBe(false);
    // …and the key we actually mint is none of those.
    expect([`arbor.learn.read.${KID}en`, `arbor.learnRead${KID}`]).not.toContain(learnReadKey(KID));
  });

  it("siblings never share a shelf", () => {
    expect(learnReadKey("kid-a")).not.toBe(learnReadKey("kid-b"));
    const store = fakeStore();
    markLearnCardRead("kid-a", "sleep-regressions", store);
    expect(readLearnReadIds("kid-a", store)).toEqual(["sleep-regressions"]);
    expect(readLearnReadIds("kid-b", store)).toEqual([]);
  });
});

describe("marking and reading back", () => {
  it("remembers an opened read across a reload", () => {
    const store = fakeStore();
    markLearnCardRead(KID, "boundary-testing", store);
    // A fresh read from the same bytes — this is what the next mount does.
    expect(readLearnReadIds(KID, store)).toEqual(["boundary-testing"]);
    expect(isLearnCardRead(readLearnReadIds(KID, store), "boundary-testing")).toBe(true);
    expect(isLearnCardRead(readLearnReadIds(KID, store), "nature-play")).toBe(false);
  });

  it("re-opening a read moves it to the front without duplicating it", () => {
    const store = fakeStore();
    markLearnCardRead(KID, "a", store);
    markLearnCardRead(KID, "b", store);
    markLearnCardRead(KID, "a", store);
    expect(readLearnReadIds(KID, store)).toEqual(["a", "b"]);
  });

  it("caps the remembered list, keeping the most recent", () => {
    const store = fakeStore();
    for (let i = 0; i < MAX_TRACKED_READS + 5; i += 1) markLearnCardRead(KID, `card-${i}`, store);
    const ids = readLearnReadIds(KID, store);
    expect(ids).toHaveLength(MAX_TRACKED_READS);
    expect(ids[0]).toBe(`card-${MAX_TRACKED_READS + 4}`);
    // NEGATIVE CONTROL: the OLDEST is what fell off, not the newest.
    expect(ids).not.toContain("card-0");
  });

  it("ignores an empty child id or an empty card id", () => {
    const store = fakeStore();
    expect(markLearnCardRead("", "a", store)).toEqual([]);
    expect(markLearnCardRead(KID, "   ", store)).toEqual([]);
    expect(store.length).toBe(0);
  });
});

describe("it degrades silently — a correct, unmarked library", () => {
  it("no store at all (SSR, node, storage absent) → no reads, no throw", () => {
    expect(readLearnReadIds(KID, null)).toEqual([]);
    expect(() => markLearnCardRead(KID, "a", null)).not.toThrow();
    // The tap still holds for this session; it is simply not remembered.
    expect(markLearnCardRead(KID, "a", null)).toEqual(["a"]);
  });

  it("a store that throws (private window / blocked) → no reads, no throw", () => {
    expect(readLearnReadIds(KID, hostileStore)).toEqual([]);
    expect(() => markLearnCardRead(KID, "a", hostileStore)).not.toThrow();
    expect(markLearnCardRead(KID, "a", hostileStore)).toEqual(["a"]);
  });

  it("NEGATIVE CONTROL — the same fake-store harness DOES round-trip when it works", () => {
    // Without this, the two tests above would pass against a store that never
    // stored anything, and would prove nothing.
    const working = fakeStore();
    markLearnCardRead(KID, "a", working);
    expect(readLearnReadIds(KID, working)).toEqual(["a"]);
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["an object instead of an array", JSON.stringify({ a: 1 })],
    ["a bare string", JSON.stringify("boundary-testing")],
    ["null", JSON.stringify(null)],
    ["a number", JSON.stringify(7)],
  ])("%s → no reads, no throw", (_label, raw) => {
    const store = fakeStore({ [learnReadKey(KID)]: raw });
    expect(() => readLearnReadIds(KID, store)).not.toThrow();
    expect(readLearnReadIds(KID, store)).toEqual([]);
  });

  it("drops junk entries but keeps the real ids beside them", () => {
    const store = fakeStore({
      [learnReadKey(KID)]: JSON.stringify(["a", 3, null, { id: "b" }, "  ", "a", " c "]),
    });
    expect(readLearnReadIds(KID, store)).toEqual(["a", "c"]);
  });

  it("a cleared device reads as untouched, not as broken", () => {
    const store = fakeStore();
    markLearnCardRead(KID, "a", store);
    store.clear();
    expect(readLearnReadIds(KID, store)).toEqual([]);
  });
});

describe("the count is a count of what the PARENT read", () => {
  const catalogue = ["a", "b", "c", "d"];

  it("counts only catalogue cards the parent opened", () => {
    expect(learnReadCount(["a", "c"], catalogue)).toBe(2);
    expect(learnReadCount([], catalogue)).toBe(0);
  });

  it("NEGATIVE CONTROL — a read id for a card that has gone dark cannot inflate it", () => {
    // "withdrawn" is a real read the parent opened, but it is no longer in the
    // catalogue; counting it would report more reads than the shelf can show.
    expect(learnReadCount(["a", "withdrawn"], catalogue)).toBe(1);
    expect(learnReadCount(["a", "withdrawn"], catalogue)).toBeLessThanOrEqual(catalogue.length);
  });

  it("returns a whole number, never a fraction of the catalogue", () => {
    const n = learnReadCount(["a", "b", "c"], catalogue);
    expect(Number.isInteger(n)).toBe(true);
    // NEGATIVE CONTROL for the clinical firewall: if someone ever "improves"
    // this into a completion ratio, 3 of 4 would arrive here as 0.75.
    expect(n).toBe(3);
    expect(n).not.toBe(0.75);
  });
});
