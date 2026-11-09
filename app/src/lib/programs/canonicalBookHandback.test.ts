import { describe, expect, it } from "vitest";
import { fiveSmoothStones } from "../library/books/fiveSmoothStones";
import type { Book } from "../library/types";
import { bookHandback, catalogueSharedObjects } from "./sharedObject";
import { canonicalBookHandback, canonicalBooksPractising, canonicalParentSnapshot, type ReviewedCanonicalBinding } from "./canonicalBookHandback";

// Technical fixture only. No real book guidance, shelf mapping or approval added.
const fixture = (): Book => ({ ...fiveSmoothStones, id: "synthetic-canonical", title: { en: "Synthetic", he: "סיפור לבדיקה" }, parent: { ...fiveSmoothStones.parent, tomorrow: { en: "Synthetic tomorrow line", he: "שורת בדיקה למחר" }, practises: [{ id: "synthetic-act", act: { en: "Synthetic repeatable act", he: "פעולה לבדיקה" } }] } });
const reviewed = (book: Book): ReviewedCanonicalBinding => ({ bookId: book.id, shelf: "play", snapshot: canonicalParentSnapshot(book), clinicalEvidence: "synthetic-only", nativeHebrewEvidence: "synthetic-only" });

describe("canonical parent handback stays dark without exact reviewed metadata", () => {
  it("does not turn the current David book into a default match", () => {
    expect(canonicalBookHandback(fiveSmoothStones)).toBeNull();
    expect(catalogueSharedObjects().some(b => b.id === fiveSmoothStones.id)).toBe(false);
    expect(fiveSmoothStones.parent.practises).toBeUndefined();
  });
  it("requires both review receipts, exact book and explicit shelf", () => {
    const book = fixture(), binding = reviewed(book);
    for (const change of [{ clinicalEvidence: "" }, { nativeHebrewEvidence: "" }, { bookId: "other" }, { shelf: "invalid" }]) {
      expect(canonicalBookHandback(book, { ...binding, ...change } as ReviewedCanonicalBinding)).toBeNull();
    }
  });
  it("invalidates edited text or facets and rejects missing translations", () => {
    const book = fixture(), binding = reviewed(book);
    book.parent.tomorrow = { en: "Changed", he: "שונה" };
    expect(canonicalBookHandback(book, binding)).toBeNull();
    book.parent.practises = [{ id: "act", act: { en: "An act", he: "" } }];
    expect(canonicalBookHandback(book, reviewed(book))).toBeNull();
    book.parent.practises = [];
    expect(canonicalBookHandback(book, reviewed(book))).toBeNull();
  });
  it("accepts one or two unique reviewed acts, rejects duplicate ids and overflow", () => {
    const book = fixture();
    expect(canonicalBookHandback(book, reviewed(book))).not.toBeNull();
    book.parent.practises = [...book.parent.practises!, ...book.parent.practises!];
    expect(canonicalBookHandback(book, reviewed(book))).toBeNull();
    book.parent.practises = [1, 2, 3].map(i => ({ id: `act-${i}`, act: { en: "Synthetic", he: "בדיקה" } }));
    expect(canonicalBookHandback(book, reviewed(book))).toBeNull();
  });
  it("passes authored EN/HE copy to the existing next-day host without choices", () => {
    const book = fixture(), object = canonicalBookHandback(book, reviewed(book))!;
    const now = new Date(2026, 10, 9, 10), finishedAt = new Date(2026, 10, 8, 19).toISOString();
    for (const lang of ["en", "he"] as const) {
      const card = bookHandback({ weekShelf: "play", objects: [object], reads: [{ bookId: object.id, finishedAt, choice: "private-path", score: 99 } as { bookId: string; finishedAt: string }], now, lang, childName: "Synthetic", weekSkill: "Fallback" });
      expect(card).toHaveProperty("tomorrow", book.parent.tomorrow![lang]);
      expect(JSON.stringify(card)).not.toMatch(/private-path|score|practises|choice/);
    }
  });
  it("filters only explicit parent facets and returns fresh copies", () => {
    const book = fixture(), object = canonicalBookHandback(book, reviewed(book))!;
    expect(canonicalBooksPractising([object], "synthetic-act")).toEqual([object]);
    expect(canonicalBooksPractising([object], "unknown")).toEqual([]);
    expect(canonicalBooksPractising([object], " ")).toEqual([]);
    book.parent.practises![0].act.en = "Later edit";
    expect(object.practises[0].act.en).toBe("Synthetic repeatable act");
  });
});
