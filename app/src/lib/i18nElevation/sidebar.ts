/* i18nElevation/sidebar — E1 "living sidebar" strings.
 *
 * The pulse lines themselves live in foundation.ts (shared E1/E2/E4 substrate);
 * this module only holds the sidebar-specific a11y strings E1 adds.
 * Hebrew = calm Israeli-parent transcreation, outcome language, no AI/tech
 * framing; flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // Accessible name for the desktop hub navigation landmark.
  "elev.sidebar.nav.aria": "Arbor hubs",
  // B-SHELL-03: the Ask tab/row's accessible name names what its badge counts
  // (notes the coach surfaced that await the parent's review).
  "elev.sidebar.badge.review": "{label} — {count} to review",
};

export const he: Record<string, string> = {
  "elev.sidebar.nav.aria": "האזורים של ארבור",
  "elev.sidebar.badge.review": "{label} — {count} ממתינים לעיון שלכם",
};
