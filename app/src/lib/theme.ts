/* ════════════════════════════════════════════════════════════════════════════
   theme.ts — CR-19: the accent-theme picker is GONE.

   AP-052 shipped three "themes" (green / teal / blue) whose [data-theme]
   overrides all resolved to the same sapphire token set — a setting that
   visibly did nothing. DESIGN.md: "Light only. No dark mode." The picker,
   the ACCENT_THEMES list and every setAttribute("data-theme") are removed;
   what remains is a boot-time migration that clears the stale preference so
   no device ever boots with a leftover attribute (theme.test.ts pins that no
   code path sets data-theme any more).
   ════════════════════════════════════════════════════════════════════════════ */

const LEGACY_LS_KEY = "arbor-accent-theme";
const LEGACY_ATTR = "data-theme";

/**
 * Boot-time migration (main.tsx): forget the legacy accent preference and make
 * sure the root carries no data-theme attribute. Never sets anything.
 */
export function restoreTheme(): void {
  try {
    localStorage.removeItem(LEGACY_LS_KEY);
  } catch {
    /* localStorage unavailable — nothing to clear */
  }
  try {
    document.documentElement.removeAttribute(LEGACY_ATTR);
  } catch {
    /* no document (SSR / tests) */
  }
}
