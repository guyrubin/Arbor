/* recapStrings — t()-first resolver for the elev.recap.* module (W2 2.1).
 *
 * Same contract as SinceLastVisit's svString: lib/i18nElevation/recap.ts is
 * not yet registered in i18nElevation/index.ts (integration-lane file), so
 * consumers resolve through t() FIRST and fall back to the module records —
 * identical behavior before and after registration. Same `{var}`
 * interpolation contract as lib/i18n.translate. */
import { en as rcEn, he as rcHe } from "../../lib/i18nElevation/recap";

export function rcString(
  t: (key: string, vars?: Record<string, string | number>) => string,
  uiLang: string,
  key: string,
  vars?: Record<string, string | number>
): string {
  const viaT = t(key, vars);
  if (viaT !== key) return viaT;
  const dict = uiLang === "he" ? rcHe : rcEn;
  let s = dict[key] ?? rcEn[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
  return s;
}
