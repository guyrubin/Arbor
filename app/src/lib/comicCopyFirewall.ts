/**
 * comicCopyFirewall.ts — the kid-copy banlist + whitelist.
 *
 * The kid register (comic voice) must never carry pressure mechanics:
 * countdowns, hurry-ups, streaks, loss framing, failure framing, last-chance
 * or scarcity nudges — in EITHER language. This module is pure data + one
 * pure matcher; comicCopyFirewall.test.ts statically scans the kid.* i18n
 * namespaces and every kid-register source file against it on every test run.
 *
 * Pattern notes:
 * - EN patterns use \b word boundaries ("close" must not trip the lose ban;
 *   "scroll" must not trip anything).
 * - \b does not work for Hebrew in JS regexes, so HE patterns are plain
 *   substring matches chosen to be unambiguous.
 * - Kid copy that names a banned mechanic in order to PROMISE ITS ABSENCE
 *   (the safety chip "Stars, never streaks") is allowed via ALLOWED_EXACT —
 *   exact-match only, so no new streak copy can ride in on the exemption.
 */

export interface BannedKidPattern {
  id: string;
  re: RegExp;
  why: string;
}

export const BANNED_KID_PATTERNS: BannedKidPattern[] = [
  // ── English — pressure mechanics ────────────────────────────────────────
  { id: "en-countdown", re: /\bcount\s?down\b/i, why: "countdown pressure" },
  { id: "en-hurry", re: /\bhurry\b|\bhurry up\b|\bquick[,!] /i, why: "hurry-up pressure" },
  { id: "en-time-left", re: /\btime (?:left|remaining)\b|\btime(?:'s| is) (?:up|running out)\b|\bout of time\b|\brunning out of time\b/i, why: "time-left pressure" },
  { id: "en-streak", re: /\bstreaks?\b/i, why: "streaks are loss-framed retention mechanics" },
  { id: "en-in-a-row", re: /\bin a row\b/i, why: "consecutive-run framing is a streak in disguise" },
  { id: "en-loss", re: /\blos(?:e|es|er|ers|ing|t)\b/i, why: "loss framing" },
  { id: "en-fail", re: /\bfail(?:s|ed|ure|ures|ing)?\b/i, why: "failure framing" },
  { id: "en-last-chance", re: /\b(?:last|final) chance\b/i, why: "last-chance pressure" },
  { id: "en-scarcity", re: /\bonly \d+ (?:left|remaining|more)\b|\bwhile (?:it|they|supplies) lasts?\b/i, why: "scarcity nudge" },

  // ── Hebrew — the same mechanics ─────────────────────────────────────────
  { id: "he-countdown", re: /ספירה לאחור/, why: "countdown pressure (HE)" },
  { id: "he-hurry", re: /מהרו|תמהרו|הזדרז/, why: "hurry-up pressure (HE)" },
  { id: "he-time-left", re: /הזמן אוזל|נגמר הזמן|אזל הזמן|נותר(?:ו)? רק .{0,12}שניות/, why: "time-left pressure (HE)" },
  { id: "he-streak", re: /רצף/, why: "streak (HE)" },
  { id: "he-in-a-row", re: /ברציפות/, why: "consecutive-run framing (HE)" },
  { id: "he-loss", re: /הפסדת|להפסיד|מפסיד|הפסד/, why: "loss framing (HE)" },
  { id: "he-fail", re: /נכשל|כישלון|כשלון/, why: "failure framing (HE)" },
  { id: "he-last-chance", re: /הזדמנות אחרונה/, why: "last-chance pressure (HE)" },
  { id: "he-scarcity", re: /נשאר(?:ו)? רק|נותרו רק \d+/, why: "scarcity nudge (HE)" },
];

/**
 * Approved celebration voice — gain-framed, no comparison, no pressure.
 * This is guidance for copywriters (and a seed list for future generators),
 * not an exhaustive allow-list: copy that hits no banned pattern passes.
 */
export const CELEBRATION_WHITELIST: string[] = [
  "You did it!",
  "Amazing!",
  "Great job!",
  "Way to go!",
  "Wow!",
  "You're a star!",
  "Look what you made!",
  "That was brave!",
  "New star earned!",
  "So proud of you!",
  "כל הכבוד!",
  "מדהים!",
  "איזה יופי!",
  "הצלחת!",
  "וואו!",
  "כוכב חדש!",
  "איזה אומץ!",
];

/**
 * Kid copy allowed to NAME a banned mechanic because it promises its absence.
 * Exact match only — any rewording must come back through review here.
 */
export const ALLOWED_EXACT: string[] = [
  "Stars, never streaks", // KidDashboard safety chip (kid.safety.stars)
];

/** Returns the ids of every banned pattern the text hits ([] = clean). */
export function findBannedKidCopy(text: string): string[] {
  if (ALLOWED_EXACT.includes(text.trim())) return [];
  return BANNED_KID_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
}
