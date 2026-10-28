/**
 * B-BOOK-75 — the stored plan book (`books/{bookId}`) recomposes on read, a
 * foreign or stale row is dropped, and the child's shelf offers a plan book
 * only with a complete shared plan sheet (no silhouette, ever). Also the
 * bookmark: a plan book resumes on its linear path, never with a branch.
 */
import { describe, expect, it } from "vitest";
import { libraryBookEntries } from "../../bookAssets";
import type { BookAssetsDoc } from "../bookAssetPaths";
import { bookEdition, bookmarkFor, resumeBook } from "../bookBookmarks";
import { END } from "../bookFlow";
import { planBookFromDoc, planBookId, PLAN_BOOKS_COLLECTION, readPlanBookDoc, type PlanBookDoc } from "./planBookDoc";
import { PLAN_POSES, PLAN_SHEET_BOOK_ID } from "./planPoses";

const doc: PlanBookDoc = {
  id: "plan-poo-sit.c1",
  bookId: "plan-poo-sit.c1",
  kind: "plan",
  pattern: "plan-poo-sit",
  lang: "he",
  stepMenuIds: ["sit-same-time", "blow-bubbles", "just-try"],
  minutes: 4,
  time: "bedtime",
  boxItemIds: ["song"],
  durationDays: 14,
  approvedAt: "2026-10-26T20:00:00.000Z",
  approvedBy: "parent-1",
  createdAt: "2026-10-26T20:00:00.000Z",
  updatedAt: "2026-10-26T20:00:00.000Z",
  status: "active",
};

const sheet = (poses: readonly string[]): BookAssetsDoc => ({
  id: PLAN_SHEET_BOOK_ID,
  bookId: PLAN_SHEET_BOOK_ID,
  sheetId: "h-0123456789abcdef",
  setId: "none",
  sheetManifest: { poses: Object.fromEntries(poses.map((p) => [p, { file: `${p}.webp`, aspect: 0.6, footX: 0.5, footW: 0.3 }])) },
  files: poses.map((p) => `hero-sheets/h-0123456789abcdef/${p}.webp`),
  bytes: 1,
  createdAt: "t",
});

describe("PlanBookDoc", () => {
  it("names the collection and the one id per child and pattern", () => {
    expect(PLAN_BOOKS_COLLECTION).toBe("books");
    expect(planBookId("plan-poo-sit", "c1")).toBe("plan-poo-sit.c1");
  });

  it("reads its own rows and drops anything else (untrusted data)", () => {
    expect(readPlanBookDoc(doc)).toEqual(doc);
    expect(readPlanBookDoc({ ...doc, status: "weird" })?.status).toBe("active");
    expect(readPlanBookDoc(null)).toBeNull();
    expect(readPlanBookDoc({ ...doc, kind: "canonical" })).toBeNull();
    expect(readPlanBookDoc({ ...doc, pattern: "plan-anything" })).toBeNull();
    expect(readPlanBookDoc({ ...doc, id: "other" })).toBeNull();
    expect(readPlanBookDoc({ ...doc, stepMenuIds: ["a", "b"] })).toBeNull();
    expect(readPlanBookDoc({ ...doc, lang: "fr" })).toBeNull();
  });

  it("recomposes the parent's choices into the book: swapped steps, the parent's minutes and time, the chosen box", () => {
    const book = planBookFromDoc(doc)!;
    expect(book.kind).toBe("plan");
    expect(book.id).toBe("plan-poo-sit.c1");
    expect(book.steps.map((s) => s.menuId)).toEqual(["sit-same-time", "blow-bubbles", "just-try"]);
    expect(book.steps[0].id).toBe("s1-sit-same-time-4m");
    expect(book.steps[0].text.en).toContain("every night before bed, at the same time");
    expect(book.steps[0].text.en).toContain("4 minutes");
    expect(book.steps[0].text.he.m).toContain("4 דקות");
    expect(book.steps[0]).toMatchObject({ minutes: 4, time: "bedtime" });
    expect(book.box?.map((b) => b.id)).toEqual(["song"]);
    expect(book.durationDays).toBe(14);
    expect(book.approvedBy).toBe("parent-1");
    expect(book.parent.planSteps[0].en).toContain("4 minutes");
    expect(book.parent.planSteps[0].en).toContain("every night before bed");
  });

  it("drops a row whose choices no longer fit the menu (a struck step, a bound moved)", () => {
    expect(planBookFromDoc({ ...doc, stepMenuIds: ["the-box", "the-box", "just-try"] })).toBeNull();
    expect(planBookFromDoc({ ...doc, minutes: 30 })).toBeNull();
  });

  it("the shelf offers a plan book only with the child's shared plan sheet complete for its poses; a closed plan is not offered", () => {
    expect(libraryBookEntries([], [doc])).toEqual([]);
    expect(libraryBookEntries([sheet(["sit-calm", "stand-tall"])], [doc])).toEqual([]);
    const full = sheet(PLAN_POSES);
    const entries = libraryBookEntries([full], [doc, { ...doc, id: "plan-poo-sit.c9", bookId: "plan-poo-sit.c9", status: "closed" }, { junk: true }]);
    expect(entries.map((e) => e.book.id)).toEqual(["plan-poo-sit.c1"]);
    expect(entries[0].doc).toBe(full);
    // the plan sheet itself is never offered as a book
    expect(libraryBookEntries([full], [])).toEqual([]);
  });

  it("bookmarks a plan book on its linear path: resume at a page, END, never a branch; the edition changes with the composition", () => {
    const book = planBookFromDoc(doc)!;
    const full = sheet(PLAN_POSES);
    const edition = bookEdition(book, full);
    expect(resumeBook(book, edition, bookmarkFor(book, edition, { at: "s2-blow-bubbles", choiceId: null })).at).toBe("s2-blow-bubbles");
    expect(resumeBook(book, edition, { id: book.id, v: 1, edition, pageId: END, branchId: null }).at).toBe(END);
    expect(resumeBook(book, edition, { id: book.id, v: 1, edition, pageId: "s2-blow-bubbles", branchId: "a" }).at).toBe("cover");
    expect(resumeBook(book, edition, { id: book.id, v: 1, edition, pageId: "p9", branchId: null }).at).toBe("cover");
    const changed = planBookFromDoc({ ...doc, minutes: 5 })!;
    expect(bookEdition(changed, full)).not.toBe(edition);
    expect(resumeBook(changed, bookEdition(changed, full), { id: book.id, v: 1, edition, pageId: "p3", branchId: null }).at).toBe("cover");
  });
});
