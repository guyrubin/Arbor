import { describe, expect, it } from "vitest";
import { fiveSmoothStones as book } from "./books/fiveSmoothStones";
import { bookmarkFor, bookEdition, resumeBook } from "./bookBookmarks";
import { END, initialBookFlow, readPath } from "./bookFlow";
import type { BookAssetsDoc } from "./bookAssetPaths";

const assets: BookAssetsDoc = { id: book.id, bookId: book.id, sheetId: "saved-hero", setId: "saved-voice", sheetManifest: { poses: {} }, files: [], bytes: 0, createdAt: "original-edition" };
const edition = bookEdition(book, assets);
describe("private book position", () => {
  it("reopens every valid branch page and ending without persisting repairs or uncommitted selection", () => {
    for (const branch of book.decision.choices) for (const page of [...readPath(book, branch.id).map(p => p.id), END]) {
      const row = bookmarkFor(book, edition, { at: page, choiceId: branch.id });
      expect(Object.keys(row).sort()).toEqual(["branchId", "edition", "id", "pageId", "v"]);
      expect(resumeBook(book, edition, row)).toMatchObject({ at: page, choiceId: branch.id, repaired: [], dir: 0 });
    }
  });
  it("unknown pages, impossible branches, missing metadata and changed editions start at the cover", () => {
    const base = bookmarkFor(book, edition, { at: END, choiceId: book.decision.choices[0].id });
    for (const row of [null, {}, { ...base, v: 2 }, { ...base, id: "other-book" }, { ...base, edition: "old" }, { ...base, pageId: "made-up" }, { ...base, branchId: "absent" }, { ...base, branchId: null }, { ...base, branchId: undefined }]) expect(resumeBook(book, edition, row)).toEqual(initialBookFlow());
    const branch = book.decision.choices[0];
    expect(resumeBook(book, edition, { ...base, pageId: branch.branch[0].id, branchId: null })).toEqual(initialBookFlow());
  });
  it("binds to authored text/path and frozen assets, with stable object-key ordering", () => {
    expect(bookEdition(book, { ...assets })).toBe(edition);
    expect(bookEdition(book, { ...assets, sheetId: "replacement" })).not.toBe(edition);
    expect(bookEdition(book, { ...assets, createdAt: "re-upload" })).not.toBe(edition);
    expect(bookEdition({ ...book, rejoinPageId: "changed" }, assets)).not.toBe(edition);
    expect(bookEdition(book, Object.fromEntries(Object.entries(assets).reverse()) as unknown as BookAssetsDoc)).toBe(edition);
  });
});
