/**
 * B-SHELL-37 — shared string normalization for global and local search.
 * Import-free: eager Journal/Learn filters must not pull in static catalogues
 * or child data. This helper only transforms the string supplied by a caller.
 */

const HE_FINALS: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

/**
 * Case-insensitive, diacritic-insensitive (Latin combining marks + Hebrew
 * niqqud/cantillation), Hebrew final-letter–insensitive (ך=כ ם=מ ן=נ ף=פ ץ=צ).
 * Applied identically to index text and query, so matching is symmetric.
 * Preserve punctuation, symbols and marks outside these HE/Latin ranges.
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Latin combining diacritics
    // These are marks only; the wider 0591–05C7 block includes punctuation.
    .replace(/[\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]/g, "")
    .replace(/[ךםןףץ]/g, (c) => HE_FINALS[c])
    .trim();
}
