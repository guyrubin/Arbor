/**
 * W2-GROWTH r2 (Law 8) — Hebrew takes the verb's gender from the child's
 * profile, never a slash.
 *
 * The milestone catalogue's Hebrew (lib/i18nElevation/milestoneCatalogue.ts,
 * an AI first pass pending native review, GD-6) writes the child in the
 * intake-form slash forms ("נרגע/ת", "שם/ה", "אותו/ה"). On #/development that
 * put an intake form in the Hebrew parent's H2 while the English parent read
 * "Calms after you leave". This resolves every slash pair in a string to ONE
 * form: the feminine for a girl, the masculine otherwise (the grammatical
 * generic of spoken Hebrew when the profile carries no gender).
 *
 * Rules (each one pinned in hebrewSlashGender.test.ts against the catalogue):
 *   · "X/ת", "X/ה", "X/י" → m "X", f "X" + suffix, with a final letter
 *     (ך ם ן ף ץ) turned medial first ("קופץ/ת" → "קופצת", "שם/ה" → "שמה");
 *   · a pronoun suffix "…ו/ה" → f "…ה" ("אותו/ה" → "אותה", "עצמו/ה" → "עצמה");
 *   · "Xה/י" (a future / imperative of a ל"ה verb) → f drops the ה:
 *     "תראה/י" → "תראי", "תרצה/י" → "תרצי" (pre-review R01: was "תראהי");
 *   · a whole-word alternative ("איש/אשת") → m the first word, f the second;
 *     when the first word carries a clitic particle the second lacks
 *     ("שהוא/היא", "כשהוא/היא", "שיוכל/תוכל"), the particle stays in front:
 *     f "שהיא", "כשהיא", "שתוכל" (pre-review: was "היא", "תוכל");
 *   · a few irregular pairs are listed by hand (IRREGULAR) — the pronoun
 *     "את/ה" is the one form whose BASE is the feminine (pre-review R01: a boy
 *     read "את מדבר", a girl "אתה מדברת").
 * Every slash form the catalogue, the practice library and the loop strings
 * actually use is pinned, both genders, in hebrewSlashGender.test.ts (a new
 * form fails that test until its two resolutions are written there).
 * Only Hebrew-letter pairs are touched: "CDC/AAP" or a URL never matches.
 */

export type ChildGenderish = string | null | undefined;

const FINAL_TO_MEDIAL: Readonly<Record<string, string>> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

/** Pairs a suffix rule would get wrong: [masculine, feminine]. */
const IRREGULAR: Readonly<Record<string, readonly [string, string]>> = {
  "תסגור/י": ["תסגור", "תסגרי"],
  "ותסגור/י": ["ותסגור", "ותסגרי"],
  // the second-person pronoun: written feminine-first, so the suffix rule inverts it
  "את/ה": ["אתה", "את"],
  "ואת/ה": ["ואתה", "ואת"],
  "שאת/ה": ["שאתה", "שאת"],
  "כשאת/ה": ["כשאתה", "כשאת"],
  // the feminine of "one" is not base + ת
  "אחד/ת": ["אחד", "אחת"],
};

/** Clitic particles that stay in front of a whole-word alternative ("כשהוא/היא" → "כשהיא"). */
const CLITICS = "ושכ";
const clitic = (word: string): string => {
  let i = 0;
  while (i < word.length - 1 && CLITICS.includes(word[i])) i += 1;
  return word.slice(0, i);
};

const PAIR = /([א-ת]+)\/([א-ת]+)/g;

const medial = (word: string): string => {
  const last = word.slice(-1);
  return FINAL_TO_MEDIAL[last] ? word.slice(0, -1) + FINAL_TO_MEDIAL[last] : word;
};

function feminine(base: string, suffix: string): string {
  if (suffix === "ה" && base.endsWith("ו") && base.length > 1) return base.slice(0, -1) + "ה";
  if (suffix === "י" && base.endsWith("ה") && base.length > 1) return base.slice(0, -1) + "י";
  return medial(base) + suffix;
}

/** A whole-word alternative keeps the first word's clitic particle when the second lacks it. */
function wholeWordFeminine(base: string, alt: string): string {
  const prefix = clitic(base);
  return prefix && !alt.startsWith(prefix) ? prefix + alt : alt;
}

/** True when the profile says the child is a girl. */
export const isGirl = (gender: ChildGenderish): boolean => gender === "girl";

/** One Hebrew form per slash pair, by the child's profile gender. */
export function resolveHebrewSlash(text: string, gender: ChildGenderish): string {
  if (!text || !text.includes("/")) return text;
  const girl = isGirl(gender);
  return text.replace(PAIR, (whole, base: string, alt: string) => {
    const irregular = IRREGULAR[whole];
    if (irregular) return girl ? irregular[1] : irregular[0];
    if (alt.length === 1 && (alt === "ת" || alt === "ה" || alt === "י")) return girl ? feminine(base, alt) : base;
    // a whole-word alternative ("איש/אשת"; "שהוא/היא" keeps its particle)
    return girl ? wholeWordFeminine(base, alt) : base;
  });
}
