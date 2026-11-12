import { describe, expect, it } from "vitest";
import { childScopedKey, clearChildLocalState } from "../../lib/childLocalState";
import { answerTonight, readTonightProgress, tonightQueue, writeTonightProgress } from "./rightNowTonight";

const memory = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    clear: () => map.clear(),
  };
};

const ALL = { practice: true, notice: true, words: true };

describe("v4.1 Right now · tonight's questions answered in place", () => {
  it("asks practice, then notice, then words, counting 1 of 3 to 3 of 3, and then says the day is done", () => {
    let progress = readTonightProgress("c1", "2026-11-12", null);
    expect(tonightQueue(ALL, progress)).toEqual({ next: "practice", index: 1, total: 3, finished: false });
    progress = answerTonight(progress, "practice", true);
    expect(tonightQueue(ALL, progress)).toMatchObject({ next: "notice", index: 2, total: 3 });
    progress = answerTonight(progress, "notice", true);
    progress = answerTonight(progress, "words", false);
    expect(tonightQueue(ALL, progress)).toEqual({ next: null, index: 4, total: 3, finished: true });
    expect(progress.kept).toBe(2);
    // Answering twice changes nothing.
    expect(answerTonight(progress, "notice", true)).toBe(progress);
  });

  it("never shrinks the count mid-evening when an answer retires its own question", () => {
    let progress = answerTonight(readTonightProgress("c1", "2026-11-12", null), "practice", true);
    // The dose row now exists, so NowView stops offering the practice question.
    expect(tonightQueue({ practice: false, notice: true, words: true }, progress)).toMatchObject({ next: "notice", index: 2, total: 3 });
    progress = answerTonight(progress, "notice", true);
    expect(tonightQueue({ practice: false, notice: false, words: true }, progress)).toMatchObject({ next: "words", index: 3, total: 3 });
  });

  it("asks only what the evening has (no practice seen: 1 of 2), and nothing at all draws no line", () => {
    const fresh = readTonightProgress("c1", "2026-11-12", null);
    expect(tonightQueue({ practice: false, notice: true, words: true }, fresh)).toMatchObject({ next: "notice", index: 1, total: 2 });
    expect(tonightQueue({ practice: false, notice: false, words: false }, fresh)).toEqual({ next: null, index: 1, total: 0, finished: false });
  });

  it("survives a reload on the same day, starts empty the next day, and is per child", () => {
    const storage = memory();
    const progress = answerTonight(readTonightProgress("c1", "2026-11-12", storage), "practice", true);
    writeTonightProgress("c1", progress, storage);
    expect(readTonightProgress("c1", "2026-11-12", storage)).toEqual({ day: "2026-11-12", done: ["practice"], kept: 1 });
    expect(readTonightProgress("c1", "2026-11-13", storage)).toEqual({ day: "2026-11-13", done: [], kept: 0 });
    expect(readTonightProgress("c2", "2026-11-12", storage)).toEqual({ day: "2026-11-12", done: [], kept: 0 });
    // Only ids and a count are stored, never an answer's words.
    expect(JSON.parse(storage.map.get(childScopedKey("rightNowTonight", "c1"))!)).toEqual({ day: "2026-11-12", done: ["practice"], kept: 1 });
  });

  it("tolerates a broken store, drops unknown ids, clamps the count, and is swept with the child", () => {
    const storage = memory();
    storage.map.set(childScopedKey("rightNowTonight", "c1"), "not json");
    expect(readTonightProgress("c1", "2026-11-12", storage).done).toEqual([]);
    storage.map.set(childScopedKey("rightNowTonight", "c1"), JSON.stringify({ day: "2026-11-12", done: ["words", "bogus", "practice"], kept: 9 }));
    expect(readTonightProgress("c1", "2026-11-12", storage)).toEqual({ day: "2026-11-12", done: ["practice", "words"], kept: 2 });
    expect(clearChildLocalState("c1", { local: storage as unknown as Storage, session: null })).toBe(1);
    expect(storage.map.size).toBe(0);
    expect(() => writeTonightProgress("", { day: "d", done: [], kept: 0 }, storage)).not.toThrow();
  });
});
