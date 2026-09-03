/**
 * kidText — bidi plumbing for the kid register (RUN-03, lane K).
 *
 * The parent shell is fully Hebrew for an IL family, but every kid-register
 * string is still an EN placeholder behind the GD-6 transcreation gate. Under
 * `dir="rtl"` a Latin run such as "Hi Dylan!" is laid out by the RTL
 * paragraph direction, so its trailing "!" is pulled to the LEFT edge and the
 * child reads "!Hi Dylan". `lib/bidi.isolate()` (the established seam) wraps
 * only RTL-bearing values; this helper composes it with the mirror case — a
 * Latin-bearing string with NO strong-RTL character is wrapped in a
 * first-strong isolate (FSI … PDI) so the run resolves its own direction from
 * its first letter and punctuation stays where the writer put it.
 *
 * Once GD-6 lands Hebrew copy, FSI resolves RTL from the first Hebrew letter
 * and the wrap is a no-op — nothing needs to change here. DISPLAY-TIME ONLY,
 * same rule as isolate(): never persist an isolated string.
 */
import { isolate } from "../../lib/i18n";

const LATIN = /[A-Za-z]/;
const STRONG_RTL = /[֐-׿؀-ۿ܀-ݏ]/;
const FSI = "⁨";
const PDI = "⁩";

/** Isolate a kid-register string for rendering in either paragraph direction. */
export function kidIsolate(value: string): string {
  const inner = isolate(value);
  if (!LATIN.test(inner) || STRONG_RTL.test(inner)) return inner;
  return `${FSI}${inner}${PDI}`;
}
