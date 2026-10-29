/**
 * B-BOOK-47 — the parent's exit recap names the book finished in this session
 * and its AUTHORED ask-after question; parent register, EN + HE (the child's
 * grammatical form); never the path or the choice the child took.
 */
import { describe, expect, it } from "vitest";
import { bookAskAfter, SHELF_ASK_AFTER_HE, withoutNiqqud } from "./bookAskAfter";
import { kidExitRecapWithBook } from "./kidExitRecap";
import { getLibraryBook } from "./library/books";
import { authoredPatterns } from "./library/plans/planBooks";
import { KID_SHELF_STORIES } from "./heroJourneys";
import { en, he } from "./i18nElevation/learnCare";

const fill = (dict: Record<string, string>) => (key: string, vars: Record<string, string | number> = {}) =>
  (dict[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
const book = getLibraryBook("five-smooth-stones")!;

describe("bookAskAfter", () => {
  it("a library book: its title and authored ask-after, EN and HE (the child's form)", () => {
    expect(bookAskAfter(book.id, "en", "girl", "Noa")).toEqual({ title: book.title.en, question: book.parent.askAfter.en });
    expect(bookAskAfter(book.id, "he", "girl", "Noa")).toEqual({ title: withoutNiqqud(book.title.he), question: withoutNiqqud(book.parent.askAfter.he.f) });
    expect(bookAskAfter(book.id, "he", "boy", "Ari")!.question).toBe(withoutNiqqud(book.parent.askAfter.he.m));
  });
  it("every plan pattern and every kid-shelf story has a title and a question", () => {
    for (const p of authoredPatterns()) {
      const r = bookAskAfter(p.id, "he", "boy", "Ari")!;
      expect(r.title, p.id).toBe(withoutNiqqud(p.title.he));
      expect(r.question, p.id).toBe(withoutNiqqud(p.parent.askAfter.he.m));
    }
    for (const s of KID_SHELF_STORIES) {
      expect(bookAskAfter(s.id, "en", undefined, "Ari")?.question, s.id).toBeTruthy();
      const heLine = bookAskAfter(s.id, "he", undefined, "Ari")!;
      expect(heLine.title, s.id).toBeTruthy();
      // Hebrew: an authored Hebrew question for every shelf story, never the English one.
      expect(heLine.question, s.id).toMatch(/[\u05D0-\u05EA]/);
      expect(heLine.question, s.id).not.toMatch(/[A-Za-z]/);
    }
  });
  it("HE parent copy: no niqqud in the title or the question; the six shelf questions are singular, one per story, and short", () => {
    const niqqud = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/;
    expect(niqqud.test(book.title.he)).toBe(true); // the kid book's title carries niqqud…
    const he = bookAskAfter(book.id, "he", "girl", "Noa")!;
    expect(niqqud.test(he.title)).toBe(false); // …the parent line does not
    expect(niqqud.test(he.question)).toBe(false);
    expect(Object.keys(SHELF_ASK_AFTER_HE).sort()).toEqual(KID_SHELF_STORIES.map((x) => x.id).sort());
    for (const [id, q] of Object.entries(SHELF_ASK_AFTER_HE)) {
      for (const line of [q.m, q.f]) {
        expect(niqqud.test(line), id).toBe(false);
        expect(line.endsWith("?"), id).toBe(true);
        expect(line.length, id).toBeLessThanOrEqual(60);
        // wave-3 carry-over: ONE child, singular second person — never the plural address
        expect(line, id).not.toMatch(/(תם|תן|כם|כן)(\s|\?|,|$)/);
        expect(line, id).toMatch(/(ת|לך)(\s|\?|,|$)/);
        // one question per story (Moses's two became one)
        expect(line.match(/\?/g), id).toHaveLength(1);
      }
      // one spelling for a boy and a girl, except David's קטן / קטנה
      if (id === "david-and-goliath") {
        expect(q.m).toContain("קטן ");
        expect(q.f).toContain("קטנה ");
        expect(q.m.replace("קטן ", "קטנה ")).toBe(q.f);
      } else expect(q.f, id).toBe(q.m);
    }
    expect(withoutNiqqud("חָמֵשׁ אֲבָנִים חֲלָקוֹת")).toBe("חמש אבנים חלקות");
  });
  it("the shelf question follows the child's gender only where Hebrew spells it differently (David)", () => {
    expect(bookAskAfter("david-and-goliath", "he", "boy", "Ari")!.question).toBe("מתי הרגשת קטן היום, כמו דוד?");
    expect(bookAskAfter("david-and-goliath", "he", "girl", "Noa")!.question).toBe("מתי הרגשת קטנה היום, כמו דוד?");
    expect(bookAskAfter("david-and-goliath", "he", undefined, "Ari")!.question).toBe("מתי הרגשת קטן היום, כמו דוד?");
    expect(bookAskAfter("moses-and-pharaoh", "he", "girl", "Noa")!.question).toBe(bookAskAfter("moses-and-pharaoh", "he", "boy", "Ari")!.question);
  });
  it("an unknown id names nothing", () => {
    expect(bookAskAfter("not-a-book", "en", undefined, "Ari")).toBeNull();
  });
  it("the question is the book's, not the path's: it names none of the book's choices", () => {
    for (const lang of ["en", "he"] as const) {
      const q = bookAskAfter(book.id, lang, "boy", "Ari")!.question;
      for (const c of book.decision.choices) expect(q, c.id).not.toContain(lang === "en" ? c.label.en : withoutNiqqud(c.label.he));
    }
  });
});

describe("kidExitRecapWithBook — the parent strip on exit", () => {
  const ask = bookAskAfter(book.id, "en", "girl", "Noa")!;
  it("EN: the book among the parts, then its question", () => {
    expect(kidExitRecapWithBook({}, fill(en), "Noa", ask)).toBe(`While you were away, Noa: read ${book.title.en}. Ask about it: ${book.parent.askAfter.en}`);
  });
  it("HE: the same, in Hebrew", () => {
    const heAsk = bookAskAfter(book.id, "he", "girl", "Noa")!;
    const line = kidExitRecapWithBook({}, fill(he), "נועה", heAsk)!;
    expect(line).toContain(`הספר ${withoutNiqqud(book.title.he)}`);
    expect(line).toContain(`אפשר לשאול: ${withoutNiqqud(book.parent.askAfter.he.f)}`);
  });
  it("a book without an authored question in this language: the title alone", () => {
    expect(kidExitRecapWithBook({}, fill(en), "Noa", { title: "A story", question: "" })).toBe("While you were away, Noa: read A story");
  });
  it("no book: the strip is unchanged; nothing at all: no strip", () => {
    const strip = kidExitRecapWithBook({ hero: 1 }, fill(en), "Noa", null)!;
    expect(strip.startsWith("While you were away, Noa: ")).toBe(true);
    expect(strip).not.toContain("Ask about it");
    expect(kidExitRecapWithBook({}, fill(en), "Noa", null)).toBeNull();
  });
  it("EN + HE strings exist", () => {
    for (const k of ["elev.learnCare.kidExit.book", "elev.learnCare.kidExit.askAfter"]) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toBeTruthy();
    }
  });
});

describe("the exit recap is wired to the one read ledger", () => {
  it("KidExitRecap reads bookReads and composes through kidExitRecapWithBook; it never reads a choice", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../components/kidmode/KidExitRecap.tsx", import.meta.url), "utf8");
    expect(src).toContain("useChildCollection<BookRead>(childProfile.id, BOOK_READS)");
    expect(src).toContain("kidExitRecapWithBook(counts, withChildSignals(t, uiLang === \"he\"), firstName, book)");
    expect(src).not.toMatch(/choiceId|\.choice\b/);
  });
});
