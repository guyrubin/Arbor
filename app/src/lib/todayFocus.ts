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
 *  - TODAY-5/PLAT-4: the artifact-strip patterns are bilingual (EN + HE
 *    equivalents in the same regexes) so Hebrew model output gets the SAME
 *    scrub and clamp — never a canned override (CODEX-2 class stays banned).
 *
 * TJB-02: the server returns a STRUCTURED focus — `focus` (1–2 observation
 * sentences) + `tryToday` (ONE doable step) — and the hub's one move must
 * persist the STEP, not the observation. `focusHeadlineFor` prefers
 * `tryToday` (whole step, scrubbed + clamped, no first-sentence cut) and falls
 * back to the legacy first-sentence-of-`text` rule for cached records that
 * pre-date the split, so nothing already stored stops rendering.
 */
const scrub = (raw: string): string =>
  raw
    .replace(/^\s*\d+\.\s*(?:What May Be Happening|מה (?:אולי |ייתכן ש|כנראה )?קורה)\s*[-:–—]\s*/i, "")
    .replace(/\s*\((?:high|medium|low|גבוהה?|בינונית?|נמוכה|נמוך)\)\s*:?/gi, "")
    .replace(/\s*(?:Profile mentions|Based on|Evidence:|הפרופיל מציין|בהתבסס על|מבוסס על|ראיות:|עדויות:)\s+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const clamp = (s: string): string => (s.length > 150 ? `${s.slice(0, 147).trimEnd()}…` : s);

export function focusHeadlineFrom(text: string | null | undefined): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const cleaned = scrub(raw);
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  if (!sentence) return null;
  return clamp(sentence);
}

/** The shape the hero reads — the hook's Focus record or any subset of it. */
export type FocusLike = { text?: string | null; focus?: string | null; tryToday?: string | null } | null | undefined;

/**
 * TJB-02: the headline the hero renders AND the string acceptTodayAction
 * persists — the model's doable step when the record carries one, else the
 * legacy first-sentence rule over `text`. Same scrub + clamp on both paths.
 */
export function focusHeadlineFor(focus: FocusLike): string | null {
  const step = focus?.tryToday?.trim();
  if (step) {
    const cleaned = scrub(step);
    if (cleaned) return clamp(cleaned);
  }
  return focusHeadlineFrom(focus?.text);
}

/**
 * TJB-02: the observation sentence(s) rendered as the hero BODY under the
 * step. Only when the record is structured — a legacy `text`-only record is
 * already the headline, so there is no second line to show.
 */
export function focusBodyFor(focus: FocusLike): string | undefined {
  if (!focus?.tryToday?.trim()) return undefined;
  const obs = scrub(focus.focus?.trim() ?? "");
  return obs || undefined;
}

/** What /api/todays-focus reports it actually used (AI-19), when present. */
export type FocusInputsUsed = { momentCount?: number; topTrigger?: string; lastActionOutcome?: string };

export type WhyLineInputs = {
  name: string;
  /** Logged moments in the trailing 7 days. */
  recentCount: number;
  /** rhythm/predict confidence — "none" means no rhythm read exists yet. */
  confidence: "none" | "low" | "medium" | "high" | string;
  /** Parent-expressed active goals (count). */
  goals: number;
  /** Profile interests (count). */
  interests: number;
  /** Server-reported inputs, preferred over the client estimate when present. */
  inputsUsed?: FocusInputsUsed | null;
};

/**
 * ENG-07 / AI-19: the Today why-line is built ONLY from inputs that actually
 * exist for this child. Day-0 (no moments at all) gets the honest cold-start
 * line; otherwise the list names each input that is really present — never
 * "rhythm" without a rhythm read, never "goals" without a goal. Returns i18n
 * KEYS + vars so the render site resolves them in the active language.
 */
export function whyLineParts(inp: WhyLineInputs): { key: string; vars: Record<string, string | number> } {
  const momentCount = inp.inputsUsed?.momentCount ?? inp.recentCount;
  if (momentCount <= 0) return { key: "today.intent.why.day0", vars: { name: inp.name } };
  const parts: string[] = [];
  parts.push("today.intent.why.recent");
  if (inp.confidence !== "none") parts.push("today.intent.why.rhythm");
  parts.push("today.intent.why.age");
  if (inp.goals > 0) parts.push("today.intent.why.goals");
  if (inp.interests > 0) parts.push("today.intent.why.interests");
  return { key: "today.intent.why.list", vars: { list: parts.join("|") } };
}

/** Render the why-line through the caller's translator. */
export function whyLineFor(
  inp: WhyLineInputs,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const { key, vars } = whyLineParts(inp);
  if (key === "today.intent.why.day0") return t(key, vars);
  const list = String(vars.list)
    .split("|")
    .map((k) => t(k))
    .join(t("today.intent.why.sep"));
  return t(key, { list });
}
