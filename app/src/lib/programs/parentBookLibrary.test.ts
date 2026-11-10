import { describe, expect, it } from "vitest";
import { fiveSmoothStones } from "../library/books/fiveSmoothStones";
import { getPlanFixtureBook } from "../library/plans/planBooks";
import type { LibraryBookEntry } from "../bookAssets";
import type { Book } from "../library/types";
import { canonicalParentSnapshot, type ReviewedCanonicalBinding } from "./canonicalBookHandback";
import { ownedHandbackBook, reviewedParentBooks, REVIEWED_CANONICAL_BINDINGS } from "./parentBookLibrary";
import { catalogueBookId } from "../bookReads";
import { bookHandback, catalogueSharedObjects } from "./sharedObject";

const book: Book = { ...fiveSmoothStones, id: "synthetic", parent: { ...fiveSmoothStones.parent, tomorrow: { en: "Synthetic tomorrow", he: "בדיקה למחר" }, practises: [{ id: "act", act: { en: "Synthetic act", he: "פעולת בדיקה" } }] } };
const entry = { book, doc: { bookId: book.id } } as LibraryBookEntry;
const review: ReviewedCanonicalBinding = { bookId: book.id, shelf: "play", snapshot: canonicalParentSnapshot(book), clinicalEvidence: "synthetic", nativeHebrewEvidence: "synthetic" };
const plan = { book: { ...getPlanFixtureBook("plan-new-food--demo")!, id: "plan-new-food.synthetic-child" }, doc: { bookId: "plan-poses" } } as LibraryBookEntry;

describe("parent owned-book projection", () => {
  it("stays dark by default; exact reviewed owned copy only", () => {
    expect(REVIEWED_CANONICAL_BINDINGS).toEqual([]);
    expect(reviewedParentBooks([entry])).toEqual([]);
    expect(reviewedParentBooks([], [review])).toEqual([]);
    expect(reviewedParentBooks([entry], [review])).toHaveLength(1);
    expect(reviewedParentBooks([entry, entry], [review])).toEqual([]);
    expect(reviewedParentBooks([entry], [review, review])).toEqual([]);
    expect(reviewedParentBooks([entry], [{ ...review, snapshot: "stale" }])).toEqual([]);
    expect(reviewedParentBooks([plan], [review])).toEqual([]);
  });
  it("resolves the real reader catalogue ID without exposing private activity fields", () => {
    const now = new Date(2026, 10, 10, 12), finishedAt = new Date(2026, 10, 9, 19).toISOString();
    const reads = [{ bookId: catalogueBookId(plan.book), finishedAt, choice: "private", score: 99 } as {bookId: string; finishedAt: string}];
    const object = catalogueSharedObjects().find(o => o.id === "plan-new-food")!;
    const card = bookHandback({ weekShelf: object.shelf!, objects: [object], reads, now, lang: "en", childName: "Synthetic", weekSkill: "Fallback" });
    expect(card).toHaveProperty("objectId", "plan-new-food");
    expect(ownedHandbackBook([plan], "plan-new-food")).toBe(plan);
    expect(JSON.stringify(card)).not.toMatch(/choice|score|private/);
  });
  it("rejects absent, foreign and ambiguous editions without guessing", () => {
    expect(ownedHandbackBook([entry], "other")).toBeNull();
    expect(ownedHandbackBook([plan], plan.book.id)).toBeNull();
    expect(ownedHandbackBook([plan, plan], "plan-new-food")).toBeNull();
  });
});
