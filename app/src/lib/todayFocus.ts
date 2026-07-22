/**
 * Today-hero focus headline derivation — PURE so the clinical-firewall scrub
 * is unit-testable (next-level CODEX-2 firewall condition).
 *
 * Contract (TODAY-1 + CODEX-2):
 *  - Returns null when there is no real AI focus (day-0 users, failed
 *    /api/chat). Callers MUST render an empty state and MUST NOT persist any
 *    fallback/marketing copy through acceptTodayAction — actionLoops entries
 *    may only ever contain AI-generated focus text.
 *  - The headline is ALWAYS derived from the model's own text: format scrub
 *    (numbered-heading prefix, "(high/medium/low)" markers, evidence tails)
 *    + first sentence + 150-char clamp. There is deliberately NO keyword
 *    override branch — canned copy never replaces live guidance.
 */
export function focusHeadlineFrom(text: string | null | undefined): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^\s*\d+\.\s*What May Be Happening\s*[-:–—]\s*/i, "")
    .replace(/\s*\((?:high|medium|low)\)\s*:?/gi, "")
    .replace(/\s*(?:Profile mentions|Based on|Evidence:)\s+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  if (!sentence) return null;
  return sentence.length > 150 ? `${sentence.slice(0, 147).trimEnd()}…` : sentence;
}
