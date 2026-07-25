/**
 * AI-2 (WAF backlog): output-side safety screening.
 *
 * The input side is covered by `escalation.ts` (regex escalation screen). This
 * module screens what the MODEL produced before it reaches a parent:
 *
 *  1. A fast lexical layer (always on, zero latency) catches the contract
 *     violations that matter most for a non-diagnostic children's product:
 *     definitive diagnoses, medication dosing, and instructions to start/stop
 *     treatment.
 *  2. An optional semantic layer (ENABLE_OUTPUT_SAFETY_CLASSIFIER=true) runs a
 *     cheap structured classifier call on coach responses and replaces unsafe
 *     output with a safe fallback.
 */
import { Type } from "@google/genai";
import type { ModelProvider } from "../ai/modelRouter.js";

// VC-1 (2026-07-25): the lexical floor lives in `./outputScreenLexical.ts` — a
// ZERO-import pure module the browser Live turn-guard shares — and is
// re-exported here so every existing server import path stays byte-identical.
export { screenModelOutputLexical, type OutputScreenVerdict } from "./outputScreenLexical.js";
import { screenModelOutputLexical, type OutputScreenVerdict } from "./outputScreenLexical.js";

const classifierEnabled = () =>
  ["1", "true", "yes", "on"].includes((process.env.ENABLE_OUTPUT_SAFETY_CLASSIFIER || "").toLowerCase());

/** AI-V1/AIR-2 (voice-cadence): whether the semantic output classifier is on.
 *  /voice keys its behavior on this — classifier ON keeps the full-buffer
 *  screen-once-then-emit path (the classifier needs the whole reply);
 *  classifier OFF enables sentence-boundary streaming over the lexical floor. */
export const outputClassifierEnabled = (): boolean => classifierEnabled();

/**
 * Semantic layer: one cheap structured call judging the response against the
 * non-diagnostic contract. Fails OPEN (never blocks delivery on classifier
 * errors) — the lexical layer above remains the hard floor.
 */
export const screenModelOutputSemantic = async (
  modelProvider: ModelProvider,
  text: string,
): Promise<OutputScreenVerdict> => {
  if (!classifierEnabled()) return { flagged: false, category: null, reason: null };
  try {
    const result = (await modelProvider.generateJson({
      route: "analysis_structured",
      temperature: 0,
      prompt: `You are a safety reviewer for a NON-DIAGNOSTIC parenting-support product for young children.
Review the assistant response below. Mark it unsafe ONLY if it: states or implies a clinical diagnosis for the child; gives medication or dosing instructions; tells the parent to start/stop/change a treatment; gives guidance that could physically endanger a child; or shames/blames the parent in a harmful way. General developmental guidance, observations, and "talk to a professional" suggestions are SAFE.

ASSISTANT RESPONSE TO REVIEW:
"""
${(text || "").slice(0, 8000)}
"""

Return only JSON matching the schema.`,
      schema: {
        type: Type.OBJECT,
        required: ["safe", "reason"],
        properties: {
          safe: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
        },
      },
    })) as { safe: boolean; reason: string };
    if (!result.safe) {
      return { flagged: true, category: "semantic_unsafe", reason: result.reason || "Semantic safety classifier flagged the response." };
    }
  } catch {
    /* fail open — lexical layer already ran */
  }
  return { flagged: false, category: null, reason: null };
};

/** Combined check used by the coach endpoints. */
export const screenModelOutput = async (
  modelProvider: ModelProvider,
  text: string,
): Promise<OutputScreenVerdict> => {
  const lexical = screenModelOutputLexical(text);
  if (lexical.flagged) return lexical;
  return screenModelOutputSemantic(modelProvider, text);
};

/** Parent-facing replacement when output is blocked. */
export const renderBlockedOutputMarkdown = () => `### Let's pause here
Part of the answer Arbor drafted stepped outside what an AI parenting coach should say — for example, it sounded diagnostic or medical.

Arbor only offers **observations and developmental guidance**, never a diagnosis or medical instruction.

**What to do instead:** if you're worried about a possible condition, medication, or treatment, bring your notes to your pediatrician, consultatiebureau, or family health centre — they can assess your child in person. You can generate a professional handoff brief from **Reports & Handoffs** to make that conversation easier.`;
