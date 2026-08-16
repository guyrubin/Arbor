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
  // Bare numeric countdown sequences ("5...4...3...2...1", "3, 2, 1, go!").
  // Requires a DESCENDING pair start so counting-up play copy ("1, 2, 3!")
  // stays legal; two-step minimum so a lone "2...1" ratio never trips.
  { id: "en-countdown-digits", re: /\b(?:10|[2-9])\s*(?:\.\.\.|…|,)\s*(?:\d)\s*(?:\.\.\.|…|,)\s*\d/, why: "numeric countdown pressure" },
  { id: "en-hurry", re: /\bhurry\b|\bhurry up\b|\bquick(?:ly)?[,!]/i, why: "hurry-up pressure" },
  { id: "en-time-left", re: /\btime (?:left|remaining)\b|\btime(?:'s| is) (?:almost )?(?:up|running out)\b|\bout of time\b|\brunning out of time\b/i, why: "time-left pressure" },
  // Timer/clock-as-adversary nouns: beat the clock, race the timer, before the
  // timer runs out, the clock is ticking.
  { id: "en-timer", re: /\bbeat the clock\b|\brace (?:the|against) (?:a |the )?(?:timer|clock)\b|\btimer (?:runs? out|ends|is (?:running|ticking))\b|\bbefore the (?:timer|clock|time)\b|\bclock is ticking\b/i, why: "timer/clock pressure" },
  { id: "en-streak", re: /\bstreaks?\b/i, why: "streaks are loss-framed retention mechanics" },
  { id: "en-in-a-row", re: /\bin a row\b/i, why: "consecutive-run framing is a streak in disguise" },
  { id: "en-loss", re: /\blos(?:e|es|er|ers|ing|t)\b/i, why: "loss framing" },
  // Possession-loss threats that dodge the word "lose": rewards that "go away",
  // "disappear", "vanish", or you "say goodbye to". Anchored to a reward noun
  // within a short window so animation copy ("watch the bubble disappear")
  // stays legal.
  { id: "en-loss-threat", re: /\b(?:stars?|points?|prizes?|rewards?|badges?)\b[^.!?\n]{0,40}\b(?:go(?:es)? away|disappears?|vanish(?:es)?|are gone|will be gone)\b|\b(?:say goodbye to|wave goodbye to)\b[^.!?\n]{0,30}\b(?:stars?|points?|prizes?|rewards?|badges?)\b/i, why: "possession-loss threat" },
  { id: "en-fail", re: /\bfail(?:s|ed|ure|ures|ing)?\b/i, why: "failure framing" },
  { id: "en-last-chance", re: /\b(?:last|final) chance\b/i, why: "last-chance pressure" },
  { id: "en-scarcity", re: /\bonly (?:\d+|a few|a couple(?: of)?|one|two|three) (?:\w+ ){0,2}?(?:left|remaining|more)\b|\bwhile (?:it|they|supplies) lasts?\b/i, why: "scarcity nudge" },
  // Expiry / today-only pressure: ends tonight, today only, last day.
  { id: "en-expiry", re: /\bends? (?:tonight|today|soon|at midnight)\b|\btoday only\b|\bonly today\b|\blast day\b|\bexpires?\b/i, why: "expiry pressure" },
  // FOMO framing: miss out, don't miss.
  { id: "en-fomo", re: /\bmiss(?:ing)? out\b|\bdon'?t miss\b/i, why: "FOMO pressure" },
  // Social comparison: everyone else, other kids, more/better than you.
  { id: "en-social-compare", re: /\beveryone else\b|\bother (?:kids|players|children)\b|\b(?:more|better|faster) than you\b/i, why: "social comparison" },

  // ── Hebrew — the same mechanics ─────────────────────────────────────────
  { id: "he-countdown", re: /ספירה לאחור/, why: "countdown pressure (HE)" },
  // Singular imperatives included (מהר!/מהרי) — the plural-only list let the
  // singular voice through. Punctuation/space anchor keeps במהרה legal.
  { id: "he-hurry", re: /מהרו|תמהרו|הזדרז|הזדרזי|מהר[!.]|מהרי[!.]| מהר | מהרי /, why: "hurry-up pressure (HE)" },
  { id: "he-time-left", re: /הזמן אוזל|נגמר הזמן|אזל הזמן|נותר(?:ו)? רק .{0,12}שניות/, why: "time-left pressure (HE)" },
  { id: "he-streak", re: /רצף/, why: "streak (HE)" },
  { id: "he-in-a-row", re: /ברציפות/, why: "consecutive-run framing (HE)" },
  { id: "he-loss", re: /הפסדת|להפסיד|מפסיד|הפסד/, why: "loss framing (HE)" },
  // Possession-loss threats (HE): stars that "disappear" / "won't stay".
  { id: "he-loss-threat", re: /הכוכבים (?:שלך )?(?:ייעלמו|יעלמו|נעלמים)|תגיד שלום לכוכבים/, why: "possession-loss threat (HE)" },
  { id: "he-fail", re: /נכשל|כישלון|כשלון/, why: "failure framing (HE)" },
  { id: "he-last-chance", re: /הזדמנות אחרונה/, why: "last-chance pressure (HE)" },
  { id: "he-scarcity", re: /נשאר(?:ו)? רק|נותרו רק/, why: "scarcity nudge (HE)" },
  // Expiry / today-only pressure (HE): רק היום, נגמר היום, היום האחרון.
  { id: "he-expiry", re: /רק היום|היום בלבד|נגמר היום|היום האחרון|יום אחרון/, why: "expiry pressure (HE)" },
  // FOMO (HE): אל תפספס/תפספסו, לא לפספס.
  { id: "he-fomo", re: /אל תפספסו?|לא לפספס|תפספסו? את/, why: "FOMO pressure (HE)" },
  // Social comparison (HE): כולם / ילדים אחרים קיבלו יותר.
  { id: "he-social-compare", re: /כל השאר|ילדים אחרים|יותר ממך|טוב(?:ים)? ממך/, why: "social comparison (HE)" },
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
