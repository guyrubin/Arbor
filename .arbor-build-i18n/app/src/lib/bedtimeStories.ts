/**
 * AP-057 — Bedtime Stories: shared prompt + schema helpers.
 *
 * Distinct from Hero Journeys (story route) — Bedtime Stories are:
 *   - day-rooted (seeded by today's logged events, not a fixed spine)
 *   - parent-mediated (parent reads to child at night)
 *   - generate-and-discard by design (no persistent story library)
 *
 * Safety seams used (all mandatory, none skippable):
 *   1. screenForImmediateEscalation on the day-derived input BEFORE generation.
 *   2. createRedaction(childName) wraps every model call (redact → model → restoreDeep).
 *   3. NON_DIAGNOSTIC_CONTRACT is included verbatim in the prompt system preamble.
 *   4. ai_training default-OFF: no day-data or generated stories are written to any
 *      training pipeline unless an active ai_training ConsentGrant exists.
 */

/** A single logged day event passed as seed data for the story. */
export interface DayEvent {
  /** Human-readable description of the event, e.g. "Refused to put on shoes at 8 am". */
  description: string;
  /** Optional emotional tone: "positive" | "neutral" | "challenging" */
  tone?: string;
}

/**
 * Build the safety-screening input object from a set of day events.
 * The escalation screen receives a flat key→string record and scans
 * every string value, so we spread all event descriptions in.
 */
export function buildEscalationInput(dayEvents: DayEvent[]): Record<string, string> {
  const input: Record<string, string> = {};
  dayEvents.forEach((e, i) => {
    input[`event_${i}`] = e.description;
  });
  return input;
}

/**
 * NON-PATHOLOGIZING BEDTIME STORY PROMPT.
 *
 * Safety contract (AP-057 binding):
 *  - Frame day events as the child's lived experience, not deficits or problems.
 *  - The child is the warm, capable protagonist — struggles are part of today's
 *    adventure, resolved with care and connection, never punished or shamed.
 *  - No diagnostic language, no "delay", "behavior problem", "meltdown" framing.
 *  - Stay within NON_DIAGNOSTIC_CONTRACT (the same preamble used by all Arbor AI routes).
 *  - The hero avatar appears as the child's magical alter-ego — reuse the avatar,
 *    do NOT introduce new characters that require new face captures.
 *  - HE/EN read-aloud: the language directive is appended by the caller.
 */
export function buildBedtimeStoryPrompt(params: {
  childName: string;
  age: number;
  dayEvents: DayEvent[];
  avatarDescription?: string;
  language?: "en" | "he";
}): string {
  const { childName, age, dayEvents, avatarDescription, language } = params;

  // Summarise today's moments in warm, strengths-based terms.
  const momentsSummary = dayEvents.length > 0
    ? dayEvents.map((e) => `- ${e.description}`).join("\n")
    : "- A full and eventful day";

  const languageDirective =
    language === "he"
      ? "\nIMPORTANT: Write every human-readable field in warm, natural Hebrew (עברית). Keep JSON keys in English."
      : "";

  const heroDesc = avatarDescription
    ? `The child's hero avatar is described as: ${avatarDescription}. Use this as the story's magical protagonist appearance.`
    : "";

  return `
BEDTIME STORY FRAMING CONTRACT:
- You are writing a warm, soothing bedtime story for a young child.
- Frame every event from today as a moment of learning, connection, or courage. Hard moments are simply today's adventure.
- The child is the capable, lovable protagonist who grew and connected today.
- Use cosy, dreamlike language appropriate for bedtime. Slow pace, gentle rhythm, reassuring ending.
- Warm and observational tone throughout: purely descriptive, never clinical or labelling.
- The story MUST end with the child feeling loved, safe, and ready for sleep.
- Parent-mediated: this is read aloud by a caring parent — keep it sweet, unhurried, and connective.
${heroDesc}

Today in ${childName}'s world (age ${age}):
${momentsSummary}

Create a gentle 4-page bedtime story starring ${childName} as the hero.

Return JSON with:
- title: warm story title (e.g. "[Child]'s Big Day")
- pages: array of 4 strings — each a short paragraph (3-4 sentences), bedtime read-aloud pace
- illustrationPrompt: a single warm, soft, dreamlike illustration description (no text in image)
- discussionQuestions: 2 gentle goodnight questions a parent can whisper (e.g. "What was your favourite moment today?")
- summary: one sentence that captures today's warmth for the parent (not child-facing)
${languageDirective}
`.trim();
}
