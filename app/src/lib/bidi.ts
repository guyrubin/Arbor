/* Bidi isolation (F7 / AR-UX-IDN-01) — the single home of isolate().
 *
 * Extracted from lib/i18n.ts (N5) so leaf modules — the i18nElevation/*
 * dictionaries' local statesText()/agefilterText()-style accessors — can
 * isolate interpolated values WITHOUT importing i18n.ts (i18n.ts imports
 * i18nElevation/index.ts, so that direction would be a cycle). i18n.ts
 * re-exports isolate, so every existing `import { isolate } from "./i18n"`
 * call site is unchanged.
 *
 * WHAT IS ISOLATED IS DECIDED BY THE READER'S LANGUAGE, NOT BY THE VALUE.
 * The hazard is a value whose script runs OPPOSITE to the paragraph it lands
 * in: the surrounding text's direction lays out the substituted run and drags
 * its punctuation, prepositions and digits to the wrong edge. That has two
 * mirror cases and, until R22g, this function only covered one of them:
 *
 *   en template + Hebrew value  → "Ask נועה about it"   (covered since F7)
 *   he template + Latin value   → "אתם בPhase 1"        (UNCOVERED — the bug)
 *
 * `translate()` runs EVERY interpolated value through here, so the second case
 * was unguarded app-wide: any HE string with a `{var}` carrying a plan name, a
 * phase name, a Latin child/professional name, a language or a file name glued
 * onto the Hebrew word before it (measured on #/plans and #/consult, R22g).
 * `lang` is therefore the paragraph direction the value is being dropped into,
 * and a value is wrapped in FSI…PDI when its script is the foreign one there.
 * Same-script and script-less (numeric, emoji, punctuation) values are left
 * byte-identical, so nothing that already reads correctly shifts.
 *
 * The composed form of this rule already shipped for the kid register —
 * `components/kidmode/kidText.ts` kidIsolate() wraps a Latin-bearing string for
 * the RTL kid shell — and this is that helper's rule moved into the seam every
 * translated string already passes through, instead of one call site at a time.
 *
 * `lang` defaults to "en" (LTR paragraph): the ~40 direct `isolate(name)` call
 * sites that compose a name into JSX or a template literal keep their exact
 * prior behaviour, and pass `uiLang` as they are revisited.
 *
 * DISPLAY-TIME ONLY: never persist an isolated name (Firestore, filenames,
 * seeds, equality checks) — isolate at the moment the string is rendered or
 * composed for a human, and keep the raw name everywhere else.
 */
const RTL_CHARS = /[֐-׿؀-ۿ܀-ݏ]/;
/** Strong-LTR letters: Latin (incl. accented), Greek, Cyrillic. */
const LTR_CHARS = /[A-Za-zÀ-ʯͰ-ӿ]/;

/** The paragraph direction the value is being dropped into. */
export type IsolateLang = "en" | "he";

export function isolate(value: string, lang: IsolateLang = "en"): string {
  const foreign = lang === "he" ? LTR_CHARS.test(value) : RTL_CHARS.test(value);
  return foreign ? `⁨${value}⁩` : value;
}
