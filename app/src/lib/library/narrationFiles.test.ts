/**
 * K2 block 1 — the narration file list (one rule for the render brief, the
 * shared set and the resolver) and which files say the child's name.
 */
import { describe, expect, it } from "vitest";
import { abramsLongRoad } from "./books/abramsLongRoad";
import { fiveSmoothStones as book } from "./books/fiveSmoothStones";
import { narrationKey, NARRATION_ROOT } from "./narration";
import { bookNarrationFiles, isNameBearing, nameBearingFiles, sharedNarrationShipped, sharedNarrationUrls, VOICE_FOLDERS } from "./narrationFiles";

const NAME_BEARING = ["cover.mp3", "p1.mp3", "p10.a.mp3", "p10.b.mp3", "p10.c.mp3"];

describe("the narration file list", () => {
  it("five-smooth-stones: 32 files per voice; only cover, p1 and p10.<path> say the child's name (CAST mode)", () => {
    for (const folder of VOICE_FOLDERS) {
      const all = bookNarrationFiles(book, folder);
      expect(all, folder).toHaveLength(32);
      expect(new Set(all.map((f) => f.file)).size, folder).toBe(32);
      expect(nameBearingFiles(book, folder), folder).toEqual(NAME_BEARING);
    }
  });

  it("file names follow the reader's path convention (narrationKey)", () => {
    const names = bookNarrationFiles(book, "he-f").map((f) => f.file);
    expect(names).toContain(narrationKey({ bookId: book.id, voiceKey: "x", lang: "he", gender: "f", pageId: "p8", choiceId: "b" })!.split("/").pop());
    expect(names).toContain("p5-choice.c.mp3");
    expect(names).toContain("p7b-helmet.mp3");
    expect(names).toContain("p7c-after.mp3");
  });

  it("only p9 carries a cue sidecar (its art states listen for the narration)", () => {
    expect(bookNarrationFiles(book, "en").filter((f) => f.cues).map((f) => f.file)).toEqual(["p9.mp3"]);
  });

  it("he-f differs from he-m only on name-bearing files, so the shared set ships no he-f folder", () => {
    const heM = new Map(bookNarrationFiles(book, "he-m").map((f) => [f.file, f.text]));
    const differ = bookNarrationFiles(book, "he-f").filter((f) => heM.get(f.file) !== f.text).map((f) => f.file);
    expect(differ).toEqual(["p1.mp3", "p10.a.mp3", "p10.b.mp3", "p10.c.mp3"]);
    expect(differ.every((file) => NAME_BEARING.includes(file))).toBe(true);
    const shipped = sharedNarrationShipped(book);
    expect(shipped["he-f"]).toEqual([]);
    expect(shipped.en).toHaveLength(28);
    expect(shipped.en).toContain("p9.cues.json");
    expect(shipped["he-m"]).toEqual(shipped.en);
    for (const folder of VOICE_FOLDERS) for (const n of NAME_BEARING) expect(shipped[folder], `${folder}/${n}`).not.toContain(n);
  });

  it("the shared URLs: the folder's own set, he-f from he-m, never a name-bearing file", () => {
    const base = `${NARRATION_ROOT}/five-smooth-stones/shared-v3`;
    const en = sharedNarrationUrls(book, "en");
    expect(Object.keys(en)).toHaveLength(28);
    expect(en["p2.mp3"]).toBe(`${base}/en/p2.mp3`);
    expect(en["p9.cues.json"]).toBe(`${base}/en/p9.cues.json`);
    const heF = sharedNarrationUrls(book, "he-f");
    expect(heF["p2.mp3"]).toBe(`${base}/he-m/p2.mp3`);
    expect(Object.values(heF).every((u) => u.startsWith(`${base}/he-m/`))).toBe(true);
    for (const folder of VOICE_FOLDERS) for (const n of NAME_BEARING) expect(sharedNarrationUrls(book, folder)[n], `${folder}/${n}`).toBeUndefined();
  });

  it("a book without a shared set has no shared URLs; a {hero} token counts as the name", () => {
    expect(sharedNarrationUrls(abramsLongRoad, "en")).toEqual({});
    expect(isNameBearing({ text: "Then {hero} walked." })).toBe(true);
    expect(isNameBearing({ text: "Then David walked." })).toBe(false);
  });
});
