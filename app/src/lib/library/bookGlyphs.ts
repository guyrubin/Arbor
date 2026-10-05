/**
 * lib/library/bookGlyphs — B-BOOK-04: the page-turn glyphs of the reader.
 * They are passed to KidToy UNSWAPPED in both languages: KidToy mirrors its
 * directional glyphs itself in RTL (its DIRECTIONAL set gets
 * `rtl:-scale-x-100`), so swapping the ligature per language here would
 * mirror them twice.
 */
export const TURN_GLYPHS = { next: "arrow_forward", back: "arrow_back" } as const;
