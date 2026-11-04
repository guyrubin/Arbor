/**
 * v3 IA-05 — how both search surfaces lay out the one result model
 * (useSearchResults): rows under their home, and which glyphs turn round in
 * Hebrew. SearchModal and TopbarSearch import these; neither keeps a copy.
 *
 * Pure on purpose (no React, no Icon): the render-harness suites load it as
 * the real module beside their mocked boundaries.
 */
import type { SearchRow } from "./useSearchResults";

/** Glyphs that point a way. Only these mirror in Hebrew, and exactly once. A
 *  place or door glyph (home, eco, interests, forum, school, diversity_1) and
 *  every content glyph stay as drawn, whatever the row's kind. */
export const DIRECTIONAL_GLYPHS: readonly string[] = ["arrow_forward", "arrow_back", "chevron_right", "chevron_left", "forward", "send", "start"];

/** The class that turns a directional glyph round in RTL; nothing otherwise. */
export const glyphMirror = (glyph: string): string | undefined => (DIRECTIONAL_GLYPHS.includes(glyph) ? "rtl:-scale-x-100" : undefined);

/** Spoken between crumb parts. The chevron drawn there is aria-hidden, so
 *  without this a screen reader runs the parts together. */
export const CRUMB_SPOKEN_SEPARATOR = ", ";

export interface SearchSection {
  key: string;
  group?: SearchRow["group"];
  rows: SearchRow[];
}

/** Rows by home (place or door), each home where its first row falls, so the
 *  top hit stays first and Enter still runs it. A row with no home (the ask
 *  row) stands alone where the hook put it. */
export function searchSections(rows: readonly SearchRow[]): SearchSection[] {
  const sections: SearchSection[] = [];
  for (const row of rows) {
    const key = row.group ? "home:" + row.group.id : "row:" + row.kind + ":" + row.id;
    const at = sections.find((s) => s.key === key);
    if (at) at.rows.push(row);
    else sections.push({ key, group: row.group, rows: [row] });
  }
  return sections;
}

/** B-SHELL-37: at lg and above the top-bar field IS the search surface, so Ctrl/Cmd-K
 *  focuses it (TopbarSearch listens) instead of opening a second, different surface. */
export const SEARCH_FIELD_FOCUS_EVENT = "arbor:search:focus-field";
/** The width from which the Topbar (and its search field) is shown: Tailwind `lg`. */
export const SEARCH_FIELD_MIN_WIDTH = "(min-width: 1024px)";
