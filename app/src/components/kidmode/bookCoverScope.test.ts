import { describe, expect, it } from "vitest";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
import { bookCoverScopeKey, visibleBookCoverPrint } from "./bookCoverScope";

const book = (changes: Partial<BookAssetsDoc> = {}): BookAssetsDoc => ({
  id: "storybook-a",
  bookId: "storybook-a",
  sheetId: "sheet-a",
  setId: "narration-a",
  sheetManifest: {
    poses: {},
    prints: { cover: { file: "cover-a.webp" } },
  },
  files: ["hero-sheets/sheet-a/prints/cover-a.webp"],
  bytes: 10,
  createdAt: "2026-10-01T00:00:00Z",
  ...changes,
});

describe("B-BOOK-31 private book covers: render-time owner/child/edition isolation", () => {
  const original = book();
  const firstScope = bookCoverScopeKey("owner-a", "child-a", original);
  const priorPrint = { scope: firstScope, url: "blob:private-cover-a" };

  it("shows a confirmed private print for exactly its original scope", () => {
    expect(visibleBookCoverPrint(priorPrint, firstScope)).toBe(priorPrint.url);
    expect(visibleBookCoverPrint(null, firstScope)).toBeNull();
  });

  it("does not display a sibling's previous cover during a child switch", () => {
    const newScope = bookCoverScopeKey("owner-a", "child-b", original);
    expect(newScope).not.toBe(firstScope);
    expect(visibleBookCoverPrint(priorPrint, newScope)).toBeNull();
  });

  it("does not reuse an identically named child's cover after an account switch", () => {
    const newScope = bookCoverScopeKey("owner-b", "child-a", original);
    expect(newScope).not.toBe(firstScope);
    expect(visibleBookCoverPrint(priorPrint, newScope)).toBeNull();
  });

  it("shows only the public, hero-free plate until a revised private edition loads", () => {
    for (const changed of [
      { sheetId: "sheet-b" },
      { setId: "narration-b" },
      { createdAt: "2026-10-02T00:00:00Z" },
      { sheetManifest: { poses: {}, prints: { cover: { file: "cover-b.webp" } } } },
    ]) {
      const nextScope = bookCoverScopeKey("owner-a", "child-a", book(changed));
      expect(visibleBookCoverPrint(priorPrint, nextScope)).toBeNull();
    }
  });

  it("does not mistake an old owner's returned blob URL for new ownership", () => {
    // The async completion retains the scope captured at fetch time; the
    // caller must compare it with the current scope during every render.
    const late = { scope: firstScope, url: "blob:late-old-owner-cover" };
    expect(visibleBookCoverPrint(late, bookCoverScopeKey("owner-b", "child-a", original))).toBeNull();
  });
});
