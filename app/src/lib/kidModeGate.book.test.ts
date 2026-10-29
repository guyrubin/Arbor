/**
 * B-BOOK-46 — a grown-up's door can open Kid Mode straight into a library
 * book, read Together. The persisted state carries a catalogue book id and the
 * Together flag only when they are well formed; anything else degrades to the
 * ordinary open (never a broken or foreign book id).
 */
import { describe, expect, it } from "vitest";
import { parseKidModeState, serializeKidModeState } from "./kidModeGate";

describe("B-BOOK-46: the door's book and Together flag", () => {
  it("round-trips a catalogue book id with Together", () => {
    const raw = serializeKidModeState({ open: true, view: "home", worldId: null, book: "five-smooth-stones", together: true });
    expect(parseKidModeState(raw)).toEqual({ open: true, view: "home", worldId: null, book: "five-smooth-stones", together: true });
  });
  it("a book without Together reads alone; no book = the ordinary open (unchanged shape)", () => {
    expect(parseKidModeState(JSON.stringify({ open: true, view: "home", book: "five-smooth-stones" }))).toEqual({ open: true, view: "home", worldId: null, book: "five-smooth-stones", together: false });
    expect(parseKidModeState(JSON.stringify({ open: true, view: "home", together: true }))).toEqual({ open: true, view: "home", worldId: null });
  });
  it("a malformed or foreign id is dropped, never opened", () => {
    for (const bad of ["../x", "Five Smooth", "a".repeat(81), "", 7, { id: "x" }]) {
      const parsed = parseKidModeState(JSON.stringify({ open: true, view: "home", book: bad, together: true }));
      expect(parsed.book, String(bad)).toBeUndefined();
      expect(JSON.parse(serializeKidModeState({ open: true, book: bad as never, together: true })).book).toBeUndefined();
    }
  });
});
