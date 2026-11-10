/**
 * B-BOOK-27 / B-KID-165: offline shared-art priority uses actual, confirmed
 * event times rather than malformed/future history. Synthetic IDs only.
 */
import { describe, expect, it } from "vitest";
import { offlineLibraryBooks, recentlyOpenedStoryIds } from "./kidOfflineArt";

const NOW = Date.parse("2026-11-10T07:00:00Z");
const entry = (id: string, pattern?: string) => ({
  book: (pattern ? { id, kind: "plan", pattern } : { id }) as never,
});

describe("offline shared-art history integrity", () => {
  it("ranks distinct story openings by actual time across offsets and excludes invalid/future rows", () => {
    const runs = [
      { storyId: "stale", startedAt: "2026-10-01T10:00:00Z" },
      { storyId: "wrong-clock", startedAt: "2026-11-11T08:00:00Z" },
      { storyId: "garbage", startedAt: "never" },
      { storyId: "earlier", startedAt: "2026-11-09T13:00:00Z" },
      { storyId: "latest", startedAt: "2026-11-09T16:00:00+02:00" },
      { storyId: "latest", startedAt: "2026-11-09T11:00:00Z" },
      { storyId: "fallback", startedAt: "invalid", completedAt: "2026-11-09T12:00:00Z" },
      { storyId: " ", startedAt: "2026-11-09T18:00:00Z" },
    ];
    expect(recentlyOpenedStoryIds(runs, 3, NOW)).toEqual(["latest", "earlier", "fallback"]);
    expect(recentlyOpenedStoryIds(runs, 2, NOW)).toEqual(["latest", "earlier"]);
    expect(recentlyOpenedStoryIds(runs, 0, NOW)).toEqual([]);
    expect(recentlyOpenedStoryIds(runs, 3, Number.NaN)).toEqual([]);
  });

  it("keeps Tonight first, then only genuinely finished recent books; never a future or corrupt finish", () => {
    const shelf = [
      entry("tonight"), entry("a"), entry("b"), entry("c"),
      entry("clock-error"), entry("unparsed"), entry("plan-edition", "plan-book"),
    ];
    const reads = [
      { bookId: "a", finishedAt: "2026-11-09T16:00:00+02:00" },
      { bookId: "b", finishedAt: "2026-11-09T13:00:00Z" },
      { bookId: "c", finishedAt: "2026-11-09T12:00:00Z" },
      { bookId: "clock-error", finishedAt: "2027-01-01T00:00:00Z" },
      { bookId: "unparsed", finishedAt: "not-a-date" },
      { bookId: "plan-book", finishedAt: "2026-11-09T10:00:00Z" },
      { bookId: "a", finishedAt: "2026-10-01T00:00:00Z" },
    ];
    const ids = (rows: typeof shelf) => rows.map((r) => r.book.id);
    expect(ids(offlineLibraryBooks(shelf, reads, 3, NOW))).toEqual(["tonight", "a", "b", "c"]);
    expect(ids(offlineLibraryBooks(shelf, reads, 4, NOW))).toEqual(["tonight", "a", "b", "c", "plan-edition"]);
    expect(ids(offlineLibraryBooks(shelf, reads, 0, NOW))).toEqual(["tonight"]);
    expect(ids(offlineLibraryBooks(shelf, reads, 3, Number.NaN))).toEqual(["tonight"]);
    expect(offlineLibraryBooks([], reads, 3, NOW)).toEqual([]);
  });
});
