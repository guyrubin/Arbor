/**
 * ONE rule for printing a stored language name (W2-GROWTH critic round 1).
 *
 * Profile and observation languages are stored as the English words the
 * onboarding list wrote ("Hebrew", "English" — OnboardingFlow), so a Hebrew
 * screen that prints the stored value shows Latin chrome (Law 8). A KNOWN
 * language renders through its `ob.lang.*` key ("Hebrew" → "עברית"); anything
 * else (a free-text language the parent typed) prints as written. The stored
 * value is never rewritten — this is display only.
 *
 * Callers: lib/reportExport (report language), lib/signalTimeline (the words
 * row), the #/language words list + form, the Growth words ledger and the
 * Profile identity line. consult/packet keeps its proficiency-aware variant
 * over the same KNOWN_LANGUAGE_NAMES list.
 */
export const KNOWN_LANGUAGE_NAMES = ["hebrew", "english", "arabic", "russian", "french"] as const;

export type KnownLanguage = (typeof KNOWN_LANGUAGE_NAMES)[number];

/** The known language a stored name refers to, or null for free text. */
export function knownLanguage(name: string): KnownLanguage | null {
  const n = (name ?? "").trim().toLowerCase();
  return (KNOWN_LANGUAGE_NAMES as readonly string[]).includes(n) ? (n as KnownLanguage) : null;
}

/** The proficiency labels a stored value may carry ("Hebrew (Native)"). */
export const KNOWN_LANGUAGE_LEVELS = ["native", "transition", "fluent", "learning", "basic"] as const;

/**
 * The stored language name in the reader's language (`t` resolves `ob.lang.*`
 * and `elev.packet.langLevel.*`). "Hebrew (Native)" → name + proficiency,
 * each through its own key; unknown parts print as written.
 */
export function languageName(name: string, t: (key: string) => string): string {
  const raw = (name ?? "").trim();
  const m = /^(.+?)\s*\(([^)]+)\)$/.exec(raw);
  const namePart = (m ? m[1] : raw).trim();
  const known = knownLanguage(namePart);
  const shown = known ? t(`ob.lang.${known}`) : namePart;
  if (!m) return shown;
  const lvl = m[2].trim().toLowerCase();
  const level = (KNOWN_LANGUAGE_LEVELS as readonly string[]).includes(lvl) ? t(`elev.packet.langLevel.${lvl}`) : m[2].trim();
  return `${shown} (${level})`;
}
