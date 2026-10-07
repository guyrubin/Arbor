/**
 * B-ASKJB-35 (b) — a plan starts with something to DO, with words to say.
 *
 * Deterministic client guard over whatever the model returned (zero model
 * calls): a step whose text starts with an observation verb ("Observe…",
 * "Log…", "Track…", "Notice…", "תעדו…", "שימו לב…") is never the first thing
 * a parent is asked to do. Every observation step that sits BEFORE the first
 * act is demoted to just after it; the rest of the order is untouched (stable).
 * A plan made only of observation steps is left as it is (nothing to promote).
 *
 * The guard reorders for DISPLAY and for "today's step" only: it returns the
 * step objects themselves, so a step's stored address (phaseIdx / stepIdx on
 * the action-loop ledger) never changes.
 *
 * The cue lists are data (OBSERVE_CUES) so the reviewer and the prompt's own
 * rule can read the same words.
 */

/** Leading observation verbs, EN + HE (matched at the start of the step, case-insensitive). */
export const OBSERVE_CUES: { readonly en: readonly string[]; readonly he: readonly string[] } = {
  en: ["observe", "observing", "log", "logging", "track", "tracking", "notice", "noticing", "record", "monitor", "keep a log", "keep track", "write down"],
  he: ["צפו", "צפה", "צפי", "לצפות", "תצפית", "התבוננו", "להתבונן", "תעדו", "תעד", "תעדי", "לתעד", "רשמו", "רשום", "רשמי", "לרשום", "עקבו", "עקוב", "עקבי", "לעקוב", "מעקב", "שימו לב", "שים לב", "שימי לב", "לשים לב"],
};

/** Bullets, numbering and a "Day 1:" / "Step 2 -" / "יום 1:" lead-in are not the verb. */
const LEAD_IN = /^[\s\-–—•*·>]*(?:(?:day|step|week|יום|שלב|שבוע)\s*\d+\s*[:.\-–—)]\s*|\d+\s*[.)\-–—:]\s*)?/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EN_RE = new RegExp(`^(?:${OBSERVE_CUES.en.map(escapeRe).join("|")})\\b`, "i");
// Hebrew: no \b for Hebrew letters — the cue must end the string or be followed by a non-letter.
const HE_RE = new RegExp(`^(?:${OBSERVE_CUES.he.map(escapeRe).join("|")})(?=$|[^\\u05D0-\\u05EA])`);

/** True when the step asks the parent to watch / log rather than to do something. */
export function isObservationStep(text: string | null | undefined): boolean {
  const s = (text ?? "").replace(LEAD_IN, "").trim();
  if (!s) return false;
  return EN_RE.test(s) || HE_RE.test(s);
}

/**
 * The steps in act-first order: observation steps that come before the first
 * act move to just after it (keeping their own order). Stable; pure; returns
 * a new array of the same objects.
 */
export function demoteObservationSteps<T extends { text: string }>(steps: readonly T[]): T[] {
  const firstAct = steps.findIndex((s) => !isObservationStep(s.text));
  if (firstAct <= 0) return [...steps];
  const leading = steps.slice(0, firstAct);
  return [steps[firstAct], ...leading, ...steps.slice(firstAct + 1)];
}

/** The first step a parent should be offered: the first act, else the first step. */
export function firstActStep<T extends { text: string }>(steps: readonly T[]): T | null {
  return steps.find((s) => !isObservationStep(s.text)) ?? steps[0] ?? null;
}
