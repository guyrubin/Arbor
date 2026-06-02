/**
 * K-04 — Make the memory "retention" field mean something.
 *
 * Previously `retention` was a free-text string the model wrote and nothing
 * ever acted on. These helpers parse it into a real duration so approved
 * child memory can actually expire. "Memory is the moat" only holds if memory
 * is governed — otherwise it is a liability.
 */

/** Parse a retention phrase into a number of days, or null for "keep until removed". */
export const retentionDays = (retention: string): number | null => {
  const lower = (retention || "").toLowerCase();
  // An explicit duration always wins, even alongside words like "keep".
  const match = /(\d+)\s*(day|week|month|year)/.exec(lower);
  if (match) {
    const n = Number(match[1]);
    const unit = match[2];
    if (unit.startsWith("week")) return n * 7;
    if (unit.startsWith("month")) return n * 30;
    if (unit.startsWith("year")) return n * 365;
    return n;
  }
  if (/until|indefinite|permanent|ongoing|keep|long[-\s]?term/.test(lower)) return null;
  if (/session|temporary|temp|today|this conversation/.test(lower)) return 1;
  return 90; // conservative default when unclear
};

/** Has an approved memory item outlived its retention window? */
export const isRetentionExpired = (
  retention: string,
  createdAt: string,
  now: Date = new Date()
): boolean => {
  const days = retentionDays(retention);
  if (days === null) return false;
  const age = now.getTime() - new Date(createdAt).getTime();
  return age > days * 24 * 60 * 60 * 1000;
};
