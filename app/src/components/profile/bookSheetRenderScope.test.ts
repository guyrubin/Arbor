import { describe, expect, it } from "vitest";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
import { bookSheetAssetScope, bookSheetOwnerScope, visibleScopedBookValue } from "./bookSheetRenderScope";

const source = bookSheetOwnerScope("owner-a", "child-a", "storybook", "hero-a");
const doc = (changes: Record<string, unknown> = {}): BookAssetsDoc => ({
  id: "storybook", bookId: "storybook", sheetId: "sheet-a", setId: "set-a",
  createdAt: "2026-10-20", files: ["hero-sheets/sheet-a/idle.webp"],
  sheetManifest: { poses: { idle: { file: "idle.webp" } } },
  ...changes,
} as unknown as BookAssetsDoc);

describe("B-BOOK-31 / B-KID-143: Parent book-sheet render-time private pose isolation", () => {
  const firstSheet = doc();
  const firstKey = bookSheetAssetScope(source, firstSheet);
  const oldUrls = { scope: firstKey, value: { idle: "blob:private-child-a-pose" } };
  const oldRedraw = { scope: source, value: firstSheet };
  it("renders a URL and redraw result only in their exact original scope", () => {
    expect(visibleScopedBookValue(oldUrls, firstKey)).toEqual(oldUrls.value);
    expect(visibleScopedBookValue(oldRedraw, source)).toBe(firstSheet);
  });
  it("suppresses both stateful outputs before effects run when switching siblings", () => {
    const next = bookSheetOwnerScope("owner-a", "child-b", "storybook", "hero-a");
    expect(visibleScopedBookValue(oldRedraw, next)).toBeNull();
    expect(visibleScopedBookValue(oldUrls, bookSheetAssetScope(next, firstSheet))).toBeNull();
  });
  it("does not reuse the same child ID and hero hash across two accounts", () => {
    const next = bookSheetOwnerScope("owner-b", "child-a", "storybook", "hero-a");
    expect(visibleScopedBookValue(oldRedraw, next)).toBeNull();
    expect(visibleScopedBookValue(oldUrls, bookSheetAssetScope(next, firstSheet))).toBeNull();
  });
  it("keeps legacy story and Everyday Plan sheet scopes apart", () => {
    const next = bookSheetOwnerScope("owner-a", "child-a", "plan-shared", "hero-a");
    expect(visibleScopedBookValue(oldRedraw, next)).toBeNull();
  });
  it("rejects stale image URLs when the approved avatar changes", () => {
    const next = bookSheetOwnerScope("owner-a", "child-a", "storybook", "hero-b");
    expect(visibleScopedBookValue(oldUrls, bookSheetAssetScope(next, firstSheet))).toBeNull();
  });
  it("rejects a revised image/pose manifest under the same book ID", () => {
    for (const change of [
      { sheetId: "sheet-b" },
      { setId: "set-b" },
      { createdAt: "2026-10-29" },
      { files: ["hero-sheets/sheet-a/revised.webp"] },
      { sheetManifest: { poses: { idle: { file: "revised.webp" } } } },
    ]) {
      const revised = bookSheetAssetScope(source, doc(change));
      expect(revised).not.toBe(firstKey);
      expect(visibleScopedBookValue(oldUrls, revised)).toBeNull();
    }
  });
  it("ignores an async result that completes under a previous account", () => {
    const late = { scope: source, value: doc({ sheetId: "late-result" }) };
    const next = bookSheetOwnerScope("owner-b", "child-a", "storybook", "hero-a");
    expect(visibleScopedBookValue(late, next)).toBeNull();
  });
});
