/* ════════════════════════════════════════════════════════════════════════════
   theme.ts — AP-052 accent theme switching (Green / Teal / Blue)

   Design rules:
   - "green" is the DEFAULT and is byte-for-byte identical to the existing
     :root values. We never set data-theme="green" — the absence of the
     attribute (or the explicit value "green") resolves to :root unchanged.
   - "teal" and "blue" are expressed purely as [data-theme] CSS overrides on
     the green-family tokens appended to index.css. No hex is stored here.
   - localStorage key: "arbor-accent-theme"
   - The attribute lives on document.documentElement (the <html> element) so
     every CSS rule that descends from :root sees it immediately.
   ════════════════════════════════════════════════════════════════════════════ */

export type AccentTheme = "green" | "teal" | "blue";

export const ACCENT_THEMES: readonly AccentTheme[] = ["green", "teal", "blue"];

const LS_KEY = "arbor-accent-theme";
const ATTR = "data-theme";

/** Read the saved preference from localStorage. Returns "green" as default. */
export function getSavedTheme(): AccentTheme {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === "teal" || raw === "blue") return raw;
  } catch {
    // localStorage unavailable (SSR / private mode) — fall through to default
  }
  return "green";
}

/**
 * Apply a theme: sets (or removes) the data-theme attribute on <html>.
 * Green is the default :root — we remove the attribute rather than setting
 * "green" so that the attribute is absent, which means zero CSS specificity
 * overhead and no risk of stale overrides.
 */
export function applyTheme(theme: AccentTheme): void {
  const root = document.documentElement;
  if (theme === "green") {
    root.removeAttribute(ATTR);
  } else {
    root.setAttribute(ATTR, theme);
  }
}

/** Persist + apply a theme. Call from the settings picker. */
export function setTheme(theme: AccentTheme): void {
  try {
    localStorage.setItem(LS_KEY, theme);
  } catch {
    // localStorage unavailable — still apply visually this session
  }
  applyTheme(theme);
}

/**
 * Boot-time restore: call once before first render (or at app mount) to
 * re-apply the user's saved preference. Safe to call multiple times.
 */
export function restoreTheme(): void {
  applyTheme(getSavedTheme());
}
