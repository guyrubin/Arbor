/**
 * AI-17 — the shape of a POST /api/explain answer, and the two pure helpers
 * its consumers need.
 *
 * Three surfaces (the milestone explainer, the milestone gap analysis and the
 * per-log co-regulation script) used to glue the route's TWO structured fields
 * into a markdown string with a manufactured "### Try today" heading, then hand
 * that string to a markdown parser to be turned back into a heading. The
 * structure was thrown away and re-derived, and the step the parent is meant to
 * DO arrived as one more paragraph in a wall of prose.
 *
 * The fields now travel as fields. This module is deliberately free of React so
 * the context layer can hold the shape without importing a component.
 */

/** The two fields POST /api/explain returns. */
export type ExplainAnswer = { explanation: string; tryToday: string };

/** True when the route returned nothing usable — never render this as guidance. */
export const isEmptyExplainAnswer = (answer: ExplainAnswer | null | undefined): boolean =>
  !answer || (!answer.explanation.trim() && !answer.tryToday.trim());

/**
 * The shareable TEXT form of an answer, for the consumers that need a string:
 * one-tap keep into the child's record, and seeding a coach thread.
 *
 * Byte-identical to the markdown these surfaces used to store, so what a parent
 * keeps today is exactly what they kept before the render was restructured.
 */
export const explainAnswerText = (answer: ExplainAnswer, tryTodayLabel: string): string =>
  [answer.explanation, answer.tryToday ? `### ${tryTodayLabel}\n${answer.tryToday}` : ""]
    .filter(Boolean)
    .join("\n\n");
