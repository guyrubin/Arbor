/* GP-11 — in-progress Development Check answers survive a refresh.
 *
 * NEGATIVE CONTROL for the pre-change shape: Screening.tsx held `answers` in
 * component state and nothing else, so a remount started from `{}`. The first
 * test below is exactly that remount, and it only passes because a draft is
 * now written and read back.
 */

import { describe, expect, it } from "vitest";
import {
  clearScreeningDraft,
  readScreeningDraft,
  screeningDraftKey,
  writeScreeningDraft,
} from "./screeningDraft";
import type { ScreenAnswer } from "./screening";

/** Minimal in-memory Storage — the tests run in the node env. */
function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() { return map.size; },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage & { map: Map<string, string> };
}

const ITEMS = ["m9_babble", "m9_sit", "m9_look"];
const ANSWERS: Record<string, ScreenAnswer> = { m9_babble: "sometimes", m9_sit: "yes" };

describe("GP-11 — the screening draft", () => {
  it("survives a remount (the pre-change path returned nothing at all)", () => {
    const s = fakeStorage();
    expect(readScreeningDraft("c1", "9m", ITEMS, s)).toBeNull(); // the old behaviour
    writeScreeningDraft("c1", "9m", ANSWERS, s);
    expect(readScreeningDraft("c1", "9m", ITEMS, s)).toEqual(ANSWERS);
  });

  it("never restores another child's or another band's answers", () => {
    const s = fakeStorage();
    writeScreeningDraft("c1", "9m", ANSWERS, s);
    expect(readScreeningDraft("c2", "9m", ITEMS, s)).toBeNull();
    expect(readScreeningDraft("c1", "18m", ITEMS, s)).toBeNull();
    expect(screeningDraftKey("c1", "9m")).not.toBe(screeningDraftKey("c2", "9m"));
  });

  it("drops item ids the current band does not have, and invalid answer values", () => {
    const s = fakeStorage();
    s.setItem(
      screeningDraftKey("c1", "9m"),
      JSON.stringify({ answers: { m9_sit: "yes", gone_item: "yes", m9_babble: "maybe" }, savedAt: "x" }),
    );
    // A stale item bank must never inject an answer the band cannot score.
    expect(readScreeningDraft("c1", "9m", ITEMS, s)).toEqual({ m9_sit: "yes" });
  });

  it("survives corrupt JSON and a storage that throws", () => {
    const s = fakeStorage();
    s.setItem(screeningDraftKey("c1", "9m"), "{not json");
    expect(readScreeningDraft("c1", "9m", ITEMS, s)).toBeNull();

    const blocked = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    } as unknown as Storage;
    expect(() => writeScreeningDraft("c1", "9m", ANSWERS, blocked)).not.toThrow();
    expect(readScreeningDraft("c1", "9m", ITEMS, blocked)).toBeNull();
    expect(() => clearScreeningDraft("c1", "9m", blocked)).not.toThrow();
  });

  it("an emptied set clears the key rather than persisting {}", () => {
    const s = fakeStorage();
    writeScreeningDraft("c1", "9m", ANSWERS, s);
    writeScreeningDraft("c1", "9m", {}, s);
    expect(s.map.has(screeningDraftKey("c1", "9m"))).toBe(false);
  });

  it("submitting clears it — a saved record is not an unfinished draft", () => {
    const s = fakeStorage();
    writeScreeningDraft("c1", "9m", ANSWERS, s);
    clearScreeningDraft("c1", "9m", s);
    expect(readScreeningDraft("c1", "9m", ITEMS, s)).toBeNull();
  });
});
