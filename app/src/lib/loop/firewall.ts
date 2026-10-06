/**
 * P5-LOOP — the loop surfaces' firewall scan list (NoticeCard, Today's three
 * blocks, Tonight, the journal shelves, the professional view). Every
 * rendered-text guard of the loop scans its EN + HE output against THIS list.
 *
 * It bans, on top of the dictionary-wide verdict class
 * (lib/clinicalFirewall.dictionary.test.ts): the pack's own non-negotiables —
 * pressure mechanics (streaks, "{n} days in a row", "you missed"), counted
 * absences ("{n} not yet"), scores and percentages, and comparisons across
 * shelves or children. English entries are regexes; Hebrew entries are
 * substrings (Hebrew glues particles to the word).
 */
export const LOOP_BANNED_EN: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "on-track", re: /\bon[\s-]?track\b/i },
  { id: "behind", re: /\bbehind\b/i },
  { id: "delayed", re: /\bdelay(?:ed)?\b/i },
  { id: "at-risk", re: /\bat[\s-]risk\b/i },
  { id: "percentile", re: /\bpercentile\b/i },
  { id: "percent-sign", re: /\d\s*%/ },
  { id: "score", re: /\bscore[ds]?\b/i },
  { id: "streak", re: /\bstreaks?\b/i },
  { id: "in-a-row", re: /\bin a row\b/i },
  { id: "missed", re: /\b(?:you )?missed\b/i },
  { id: "come-back", re: /\bcome back tomorrow\b/i },
  { id: "n-not-yet", re: /\d+\s+(?:not yet|not seen|missing)\b/i },
  { id: "late", re: /\b(?:late|slow) (?:talker|walker|starter)\b/i },
  { id: "cross-compare", re: /\b(?:than (?:other|most) (?:children|kids)|compared (?:to|with))\b/i },
  { id: "weakest", re: /\bweak(?:est|er)\b/i },
];

export const LOOP_BANNED_HE: ReadonlyArray<{ id: string; sub: string }> = [
  { id: "he-behind", sub: "בפיגור" },
  { id: "he-behind-2", sub: "מאחר בהתפתחות" },
  { id: "he-delayed", sub: "מעוכב" },
  { id: "he-at-risk", sub: "בסיכון" },
  { id: "he-percentile", sub: "אחוזון" },
  { id: "he-score", sub: "ציון" },
  { id: "he-streak", sub: "רצף" },
  { id: "he-in-a-row", sub: "ברציפות" },
  { id: "he-missed", sub: "פספס" },
  { id: "he-compare", sub: "בהשוואה ל" },
  { id: "he-weakest", sub: "החלש" },
];

/** Every banned id the text trips (EN regexes + HE substrings). Empty = clean. */
export function loopFirewallHits(text: string): string[] {
  const hits: string[] = [];
  for (const r of LOOP_BANNED_EN) if (r.re.test(text)) hits.push(r.id);
  for (const r of LOOP_BANNED_HE) if (text.includes(r.sub)) hits.push(r.id);
  return hits;
}
