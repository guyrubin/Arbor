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

export const PROGRAM_SHELF_CUES: Readonly<Record<string, { en: readonly string[]; he: readonly string[] }>> = {
  words: {
    en: ["talk", "talks", "talking", "talked", "word", "words", "speak", "speaks", "speaking", "speech", "language", "babble", "babbles", "babbling", "sentence", "sentences"],
    he: ["מדבר", "מדברת", "מדברים", "לדבר", "דיבור", "מילה", "מילים", "שפה", "משפט", "משפטים", "ממלמל", "ממלמלת"],
  },
  sleep: {
    en: ["sleep", "sleeps", "sleeping", "asleep", "bedtime", "bedtimes", "nap", "naps", "napping", "night", "nights", "nighttime", "wake", "wakes", "waking", "woke"],
    he: ["שינה", "לישון", "ישן", "ישנה", "נרדם", "נרדמת", "להירדם", "השכבה", "לילה", "לילות", "תנומה", "מתעורר", "מתעוררת", "התעורר", "התעוררה"],
  },
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Does the parent's message name the program's shelf? */
export function onProgramShelf(message: unknown, shelf: string | undefined | null): boolean {
  const cues = shelf ? PROGRAM_SHELF_CUES[shelf] : undefined;
  if (!cues || typeof message !== "string" || !message.trim()) return false;
  const en = new RegExp(`\\b(?:${cues.en.map(escape).join("|")})\\b`, "i");
  const he = new RegExp(`(?<!\\p{L})(?:ו|ה|ב|ל|ש|כש)?(?:${cues.he.map(escape).join("|")})(?!\\p{L})`, "u");
  return en.test(message) || he.test(message);
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
