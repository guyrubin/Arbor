/** Synthetic B-BOOK-47/B-BOOK-51 parent hand-back ledger regressions. */
import { describe, expect, it } from "vitest";
import { lastReadSince, type BookRead } from "./bookReads";

const start = Date.parse("2026-11-08T08:00:00.000Z");
const end = Date.parse("2026-11-08T08:20:00.000Z");
const row = (bookId: string, finishedAt: string): BookRead => ({
  id: "synthetic",
  bookId,
  lang: "en",
  finishedAt,
});

describe("B-BOOK-47/51 · last finished book offered to the parent", () => {
  it("uses the latest valid in-session completion, regardless of ledger order", () => {
    const old = row("earlier-session", new Date(start - 1).toISOString());
    const first = row("book-a", new Date(start).toISOString());
    const latest = row("book-b", new Date(end).toISOString());
    expect(lastReadSince([latest, old, first], start, end)).toBe(latest);
    expect(lastReadSince([old, first], start, end)).toBe(first);
  });

  it("ignores a future completion even when it would otherwise beat a valid finish", () => {
    const real = row("finished-in-session", new Date(end - 10).toISOString());
    const future = row("future-book", new Date(end + 1).toISOString());
    expect(lastReadSince([future, real], start, end)).toBe(real);
    expect(lastReadSince([future], start, end)).toBeNull();
  });

  it("does not offer blank IDs, invalid dates, or an incomplete session", () => {
    expect(lastReadSince([
      row("  ", new Date(end).toISOString()),
      row("", new Date(end).toISOString()),
      row("broken-date", "not a date"),
      row("old", new Date(start - 1).toISOString()),
    ], start, end)).toBeNull();
    expect(lastReadSince([row("book", new Date(end).toISOString())], NaN, end)).toBeNull();
    expect(lastReadSince([row("book", new Date(end).toISOString())], start, Infinity)).toBeNull();
    expect(lastReadSince([row("book", new Date(end).toISOString())], end + 1, end)).toBeNull();
  });

  it("ignores corrupt child/edition IDs instead of treating them as a completed catalogue book", () => {
    const valid = row("plan-reading", new Date(end - 1).toISOString());
    const bad = [
      row("child-family-one", new Date(end).toISOString()),
      row("book.owned-child", new Date(end).toISOString()),
      row("book-2026", new Date(end).toISOString()),
      row("Book-With-Caps", new Date(end).toISOString()),
      row("book id", new Date(end).toISOString()),
    ];
    expect(lastReadSince([...bad, valid], start, end)).toBe(valid);
    expect(lastReadSince(bad, start, end)).toBeNull();
  });

  it("uses the actual clock by default, not an unbounded future timestamp", () => {
    const farFuture = row("future-book", "2099-01-01T00:00:00.000Z");
    expect(lastReadSince([farFuture], 0)).toBeNull();
  });
});
