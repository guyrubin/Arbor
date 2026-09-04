import { en, he } from "./i18nElevation/growthCare";

/**
 * Module-local resolution for the Wave G string module — the same recipe
 * Screening.tsx × screeningcalm and DevelopmentTab.tsx × fullpicture already
 * use (i18nElevation/index.ts registration is that file's own, separately
 * owned recipe). Mirrors lib/i18n.ts `{var}` interpolation exactly.
 *
 * Falls back EN → key, never to an empty string: a missing translation must be
 * visible in review, not silently render blank on a parent surface.
 */
export function tGCare(uiLang: string, key: string, vars?: Record<string, string | number>): string {
  let s = (uiLang === "he" ? he[key] : undefined) ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
