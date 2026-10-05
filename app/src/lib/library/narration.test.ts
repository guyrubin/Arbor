/**
 * B-BOOK-09 — the narration path convention the reader asks for (and that
 * scripts/book-narration-list.mts writes into NARRATION-FILES.md).
 */
import { describe, expect, it } from "vitest";
import { fiveSmoothStones as book } from "./books/fiveSmoothStones";
import { DEV_NARRATION_ROOT, narrationKey, pageNarrationSrc } from "./narration";

const base = { bookId: book.id, voiceKey: "dylan-v2" };
const page = (id: string) => [book.cover, ...book.pages, ...book.decision.choices.flatMap((c) => c.branch)].find((p) => p.id === id)!;
const probe = { probe: true, root: DEV_NARRATION_ROOT };

describe("narration paths", () => {
  it("a plain page: /_dev/narration/<book>/<voiceKey>/<lang[-gender]>/<page>.mp3", () => {
    expect(pageNarrationSrc(page("p1"), { ...base, lang: "en", gender: "m", choiceId: "a" }, probe)).toBe("/_dev/narration/five-smooth-stones/dylan-v2/en/p1.mp3");
    expect(pageNarrationSrc(page("p1"), { ...base, lang: "he", gender: "f", choiceId: null }, probe)).toBe("/_dev/narration/five-smooth-stones/dylan-v2/he-f/p1.mp3");
    expect(pageNarrationSrc(page("cover"), { ...base, lang: "he", gender: "m", choiceId: null }, probe)).toBe("/_dev/narration/five-smooth-stones/dylan-v2/he-m/cover.mp3");
  });

  it("an echo page carries the path: p8.<choice>.mp3, p10.<choice>.mp3", () => {
    expect(pageNarrationSrc(page("p8"), { ...base, lang: "en", gender: "m", choiceId: "b" }, probe)).toBe("/_dev/narration/five-smooth-stones/dylan-v2/en/p8.b.mp3");
    expect(pageNarrationSrc(page("p10"), { ...base, lang: "he", gender: "f", choiceId: "c" }, probe)).toBe("/_dev/narration/five-smooth-stones/dylan-v2/he-f/p10.c.mp3");
    // a page without an echo ignores the path
    expect(pageNarrationSrc(page("p9"), { ...base, lang: "en", gender: "m", choiceId: "b" }, probe)).toBe("/_dev/narration/five-smooth-stones/dylan-v2/en/p9.mp3");
  });

  it("repair parts and choice labels", () => {
    const k = (pageId: string, choiceId?: string) => narrationKey({ ...base, lang: "en", gender: "m", pageId, choiceId }, DEV_NARRATION_ROOT);
    expect(k("p7b-helmet")).toBe("/_dev/narration/five-smooth-stones/dylan-v2/en/p7b-helmet.mp3");
    expect(k("p7b-after")).toBe("/_dev/narration/five-smooth-stones/dylan-v2/en/p7b-after.mp3");
    expect(k("p5-choice", "a")).toBe("/_dev/narration/five-smooth-stones/dylan-v2/en/p5-choice.a.mp3");
    expect(k("../x")).toBeNull();
  });

  it("declared mode never probes; off = nothing", () => {
    expect(pageNarrationSrc(page("p1"), { ...base, lang: "en", gender: "m", choiceId: null }, { probe: false, root: DEV_NARRATION_ROOT })).toBeNull();
  });
});
