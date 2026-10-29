/**
 * B-PROG-04 — the in-the-moment coach knows the week's skill: when a program
 * is active and the parent's message is about the program's shelf, the answer
 * OPENS with the week's coach script, verbatim (authored, screened program
 * content — never model prose). Off-shelf, nothing changes.
 *
 * The on-shelf test is deterministic: the message names the shelf in plain
 * words (EN as whole words, HE as whole words with a glued prefix). It errs
 * toward NOT matching — a script missing from an on-shelf turn costs nothing;
 * a script on an unrelated hard moment is noise. Only the two shelves a
 * program runs on today (Talk Together: words, Steady Nights: sleep) carry
 * cues; any other shelf never matches.
 *
 * Dark: the routes read this only behind `config.programScriptInCoach`
 * (ARBOR_PROGRAM_SCRIPT_IN_COACH, default off). Escalation and condition
 * questions answer before any of this runs, byte-identical.
 */
import type { LocalizedText } from "../../content/governance";

/**
 * Round 2 (critic P1): the cues are the program's own TOPIC — what the child
 * says or how the child sleeps — never a bare verb a parent uses about
 * anything ("can we talk about…", "last night he…", "when he wakes up…").
 * EN entries are regex sources matched as whole words, case-insensitive; HE
 * entries are whole words that may carry one glued prefix letter.
 */
export const PROGRAM_SHELF_CUES: Readonly<Record<string, { en: readonly string[]; he: readonly string[] }>> = {
  words: {
    en: [
      "words?", "speech", "vocabulary", "language", "babbl(?:e|es|ed|ing)", "sentences?", "pronounc\\w*", "late talker",
      "(?:barely|hardly|doesn['’]?t|does not|isn['’]?t|is not|not|won['’]?t|never|still not|only just|started|starting|began|begun) (?:talk|talks|talking|speak|speaks|speaking)",
      "(?:talks?|speaks?|talking|speaking) (?:yet|much|a lot|clearly|well|in sentences)",
    ],
    he: ["מילה", "מילים", "דיבור", "שפה", "משפט", "משפטים", "מלמול", "ממלמל", "ממלמלת", "הגייה"],
  },
  sleep: {
    en: [
      "sleep(?:s|ing)?", "asleep", "bedtimes?", "naps?", "napping", "nap time", "night waking", "night wakings",
      "wakes? up (?:at night|in the night|during the night|every night|early)", "waking (?:at night|in the night|early)",
      "nightmares?", "night terrors?", "(?:go|goes|going|stay|stays|staying) (?:to|in) bed", "lights out",
    ],
    he: ["שינה", "לישון", "נרדם", "נרדמת", "להירדם", "נרדמים", "השכבה", "תנומה", "תנומות", "סיוט", "סיוטים", "התעוררויות"],
  },
};

/** Hebrew phrases (whole, in order) that are on the words shelf: the child talking or not yet. */
const HE_TALK_PHRASES: Record<string, readonly string[]> = {
  words: ["לא מדבר", "לא מדברת", "כמעט לא מדבר", "כמעט לא מדברת", "עוד לא מדבר", "עוד לא מדברת", "התחיל לדבר", "התחילה לדבר", "מתחיל לדבר", "מתחילה לדבר"],
  sleep: ["מתעורר בלילה", "מתעוררת בלילה", "קם בלילה", "קמה בלילה"],
};

/**
 * A hard moment about something else — hurting, danger — is never answered
 * with the program's script, whatever else the text names ("last night he
 * bit another kid", "can we talk about his hitting", "בלילה הוא הרביץ לאחותו").
 * The ordinary answer (and, upstream, escalation) owns those turns.
 */
export const OFF_SHELF_HARD_MOMENT = {
  en: [
    "hit(?:s|ting)?", "bit (?:him|her|me|them|us|another|his|my|a|the)", "bites?", "biting", "kick(?:s|ed|ing)?", "push(?:es|ed|ing)?", "shov\\w*",
    "punch\\w*", "slap\\w*", "scratch(?:es|ed|ing)?", "hurt(?:s|ing)?", "threw", "throw(?:s|ing)?", "danger\\w*", "unsafe", "weapon\\w*",
  ],
  he: ["הרביץ", "הרביצה", "מרביץ", "מרביצה", "מכה", "היכה", "נשך", "נשכה", "נושך", "נושכת", "בעט", "בעטה", "בועט", "בועטת", "דחף", "דחפה", "דוחף", "דוחפת", "זרק", "זרקה", "זורק", "זורקת", "פגע", "פגעה", "פוגע", "פוגעת", "מסוכן", "מסוכנת", "סכנה"],
} as const;

/**
 * Round 3 (critic P2): rude or mean words are a behaviour, not the words
 * shelf ("says mean words to his sister", "uses bad language when she's
 * angry", "משתמש במילים גסות"). Its own off-shelf class, EN + HE.
 */
export const OFF_SHELF_RUDE_LANGUAGE = {
  en: [
    "(?:mean|bad|rude|nasty|naughty|potty|swear|curse|dirty|ugly|hurtful) (?:words?|language|talk|names?)", "foul language", "potty mouth",
    "swear(?:s|ing|ed)?", "swore", "curs(?:e|es|ed|ing)", "insult(?:s|ed|ing)?", "name[- ]calling", "calls? (?:him|her|them|me|us|people|his \\w+|her \\w+) names",
    "talks? back", "back[- ]?talk", "says? (?:mean|rude|nasty|hurtful) (?:things|stuff)",
  ],
  he: ["מילים גסות", "מילה גסה", "מילים מכוערות", "מילים רעות", "שפה גסה", "קללה", "קללות", "מקלל", "מקללת", "מקללים", "קילל", "קיללה", "מעליב", "מעליבה", "העליב", "העליבה", "עלבונות", "חוצפה", "חצוף", "חצופה"],
} as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const enRe = (sources: readonly string[]) => new RegExp(`\\b(?:${sources.join("|")})\\b`, "i");
const heRe = (words: readonly string[]) => new RegExp(`(?<!\\p{L})(?:ו|ה|ב|ל|ש|כש|מ)?(?:${words.map(escape).join("|")})(?!\\p{L})`, "u");
const OFF_EN = enRe([...OFF_SHELF_HARD_MOMENT.en, ...OFF_SHELF_RUDE_LANGUAGE.en]);
const OFF_HE = heRe([...OFF_SHELF_HARD_MOMENT.he, ...OFF_SHELF_RUDE_LANGUAGE.he]);

/** Does the parent's message name the program's own topic (and no hard moment about something else)? */
export function onProgramShelf(message: unknown, shelf: string | undefined | null): boolean {
  const cues = shelf ? PROGRAM_SHELF_CUES[shelf] : undefined;
  if (!cues || typeof message !== "string" || !message.trim()) return false;
  if (OFF_EN.test(message) || OFF_HE.test(message)) return false;
  const phrases = HE_TALK_PHRASES[shelf!] ?? [];
  return enRe(cues.en).test(message) || heRe(cues.he).test(message) || (phrases.length > 0 && heRe(phrases).test(message));
}

/** The week's opening line for an on-shelf turn, in the answer's language; null otherwise. */
export function programWeekScript(
  program: { shelf: string; scripts: readonly LocalizedText[] } | null | undefined,
  message: unknown,
  lang: "en" | "he",
): string | null {
  if (!program || !onProgramShelf(message, program.shelf)) return null;
  const line = program.scripts[0]?.[lang]?.trim();
  return line ? line : null;
}
