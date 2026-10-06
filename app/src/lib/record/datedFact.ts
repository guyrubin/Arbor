/* B-GROWTH-35 — a kept fact that carries a time RELATIVE to when it was
 * written ("Entering kindergarten in 3 months", "בעוד חודש") is read months
 * later as if it were said today. Such a fact is rendered with the date it
 * was written ("written 10 Jun: …"); the fact itself is never rewritten.
 * Detection is a small EN + HE pattern list — a miss renders the fact as
 * before, never a guess. */

const NUM_EN = "(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a few|a couple of|few|several)";
const UNIT_EN = "(?:days?|weeks?|months?|years?)";

export const RELATIVE_TIME_PATTERNS: readonly RegExp[] = [
  // "in 3 months", "in a few weeks", "within two weeks"
  new RegExp(`\\b(?:in|within)\\s+${NUM_EN}\\s+${UNIT_EN}\\b`, "i"),
  // "next week / month / year / term / summer"
  /\bnext\s+(?:week|month|year|term|semester|summer|winter|spring|autumn|fall|school\s+year)\b/i,
  // "this coming week", "tomorrow"
  /\b(?:this\s+coming\s+(?:week|month|year)|tomorrow)\b/i,
  // "3 months from now", "two weeks from now"
  new RegExp(`\\b${NUM_EN}\\s+${UNIT_EN}\\s+from\\s+now\\b`, "i"),
  // Hebrew: "בעוד" (in … time), "בשבוע הבא", "בחודש הבא", "בשנה הבאה", "מחר"
  /בעוד/,
  /בשבוע\s+הבא/,
  /בחודש\s+הבא/,
  /בשנה\s+הבאה/,
  /(?:^|[\s(])מחר(?:$|[\s.,)!?])/,
];

/** True when the fact's words carry a time relative to when they were written. */
export function hasRelativeTime(fact: string | null | undefined): boolean {
  if (!fact) return false;
  return RELATIVE_TIME_PATTERNS.some((re) => re.test(fact));
}

/** The date to print before a fact, or null (no relative time, or no date). */
export function writtenDateFor(fact: string | null | undefined, writtenAt: string | null | undefined): string | null {
  if (!writtenAt || !Number.isFinite(Date.parse(writtenAt))) return null;
  return hasRelativeTime(fact) ? writtenAt : null;
}
