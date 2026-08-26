/* Bidi isolation (F7 / AR-UX-IDN-01) — the single home of isolate().
 *
 * Extracted from lib/i18n.ts (N5) so leaf modules — the i18nElevation/*
 * dictionaries' local statesText()/agefilterText()-style accessors — can
 * isolate interpolated values WITHOUT importing i18n.ts (i18n.ts imports
 * i18nElevation/index.ts, so that direction would be a cycle). i18n.ts
 * re-exports isolate, so every existing `import { isolate } from "./i18n"`
 * call site is unchanged.
 *
 * When an interpolated value carries strong-RTL characters (Hebrew/Arabic) —
 * e.g. a child's name "נועה" dropped into an English template, or an English
 * word inside a Hebrew one — wrap it in Unicode isolates FSI…PDI so the
 * substituted run's direction can't reorder the surrounding text. Applied
 * ONLY to RTL-bearing values, so pure-LTR/numeric interpolation is untouched.
 *
 * DISPLAY-TIME ONLY: never persist an isolated name (Firestore, filenames,
 * seeds, equality checks) — isolate at the moment the string is rendered or
 * composed for a human, and keep the raw name everywhere else.
 */
const RTL_CHARS = /[֐-׿؀-ۿ܀-ݏ]/;
export function isolate(value: string): string {
  return RTL_CHARS.test(value) ? `⁨${value}⁩` : value;
}
