/**
 * B-BOOK-47 — the parent's exit recap names the book finished in this session
 * and its AUTHORED ask-after question; parent register, EN + HE (the child's
 * grammatical form); never the path or the choice the child took.
 */
import { describe, expect, it } from "vitest";
import { bookAskAfter } from "./bookAskAfter";
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
    expect(bookAskAfter(book.id, "he", "girl", "Noa")).toEqual({ title: book.title.he, question: book.parent.askAfter.he.f });
    expect(bookAskAfter(book.id, "he", "boy", "Ari")!.question).toBe(book.parent.askAfter.he.m);
  });
  it("every plan pattern and every kid-shelf story has a title and a question", () => {
    for (const p of authoredPatterns()) {
      const r = bookAskAfter(p.id, "he", "boy", "Ari")!;
      expect(r.title, p.id).toBe(p.title.he);
      expect(r.question, p.id).toBe(p.parent.askAfter.he.m);
    }
    for (const s of KID_SHELF_STORIES) {
      expect(bookAskAfter(s.id, "en", undefined, "Ari")?.question, s.id).toBeTruthy();
      const heLine = bookAskAfter(s.id, "he", undefined, "Ari")!;
      expect(heLine.title, s.id).toBeTruthy();
      // Hebrew: the authored Hebrew question, or none — never the English one.
      expect(heLine.question, s.id).toBe(s.parentReflection.questionsHe?.[0] ?? "");
    }
  });
  it("an unknown id names nothing", () => {
    expect(bookAskAfter("not-a-book", "en", undefined, "Ari")).toBeNull();
  });
  it("the question is the book's, not the path's: it names none of the book's choices", () => {
    for (const lang of ["en", "he"] as const) {
      const q = bookAskAfter(book.id, lang, "boy", "Ari")!.question;
      for (const c of book.decision.choices) expect(q, c.id).not.toContain(lang === "en" ? c.label.en : c.label.he);
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
    expect(line).toContain(`הספר ${book.title.he}`);
    expect(line).toContain(`אפשר לשאול: ${book.parent.askAfter.he.f}`);
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
