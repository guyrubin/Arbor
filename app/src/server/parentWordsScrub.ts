/**
 * OBJ-JOURNAL-05 / OBJ-STORIES-01 — plain parent words at the AI egress seam.
 *
 * Two parent surfaces were rendering model text in an assessment register:
 *   - the memory queue proposed "Dylan experiences severe transition anxiety,
 *     which manifest as refusal" — severity adjective + clinical noun, printed
 *     to a parent as a fact to approve;
 *   - the bedtime "For the family" line read "demonstrated impressive fine
 *     motor skills and sustained focus… social connection" — a report card on
 *     a bedtime surface.
 *
 * A prompt clause asks for plain words; this module ENFORCES them, which is
 * why it sits at the egress and not only in the prompt. It reuses the shared
 * fail-closed vocabulary in lib/clinicalScan.ts (`findClinicalDiagnosisTerm`)
 * as the last line: anything the rewrite could not put into parent words is
 * DROPPED rather than softened, exactly as the consult-packet ceiling drops
 * rather than paraphrases. Pure and deterministic — no network, no storage —
 * so it is unit-testable the way lib/todayFocus.ts `scrub` is.
 *
 * It never touches the escalation path: escalation copy is authored, not
 * model-generated, and does not pass through here.
 */
import { findClinicalDiagnosisTerm } from "../lib/clinicalScan.js";

/**
 * Evaluative intensity words. A parent surface reports what was observed; how
 * bad or how good it was is a professional's call, so the adjective is removed
 * rather than replaced with a milder one (which would still be a verdict).
 */
export const SEVERITY_WORDS = [
  "severe", "severely", "significant", "significantly", "extreme", "extremely",
  "profound", "profoundly", "marked", "markedly", "acute", "chronic",
  "mild", "mildly", "moderate", "moderately", "intense", "intensely",
  "impressive", "impressively", "remarkable", "remarkably", "exceptional",
  "exceptionally", "excellent", "poor", "advanced", "atypical", "abnormal",
  "concerning", "worrying", "alarming", "persistent", "persistently",
] as const;

/**
 * Domain nouns and assessment verbs → what a parent would actually say.
 * Ordered longest-phrase-first at match time so "fine motor skills" is
 * rewritten before "fine motor".
 */
export const PLAIN_WORDS: ReadonlyArray<readonly [string, string]> = [
  ["fine motor skills", "care with their hands"],
  ["gross motor skills", "moving their whole body"],
  ["fine motor", "hand"],
  ["gross motor", "whole-body"],
  ["sustained attention", "sticking with something"],
  ["sustained focus", "sticking with something"],
  ["attention span", "how long they stay with something"],
  ["executive function", "planning and switching between things"],
  ["emotional regulation", "settling themselves"],
  ["self-regulation", "settling themselves"],
  ["self regulation", "settling themselves"],
  ["sensory processing", "how sounds and textures feel to them"],
  ["social connection", "closeness with other people"],
  ["social skills", "getting on with other people"],
  ["social-emotional", "feelings and friendships"],
  ["cognitive development", "thinking and learning"],
  ["language development", "talking and understanding"],
  ["expressive language", "putting things into words"],
  ["receptive language", "understanding what is said"],
  ["transition anxiety", "a hard time with changes"],
  ["separation anxiety", "a hard time being apart"],
  ["anxiety", "worry"],
  ["dysregulation", "being overwhelmed"],
  ["dysregulated", "overwhelmed"],
  ["distress", "upset"],
  ["manifests as", "shows up as"],
  ["manifesting as", "showing up as"],
  ["manifest as", "shows up as"],
  ["presents with", "shows"],
  ["demonstrating", "showing"],
  ["demonstrates", "shows"],
  ["demonstrated", "showed"],
  ["exhibiting", "showing"],
  ["exhibits", "shows"],
  ["exhibited", "showed"],
  ["experiences", "has"],
  ["experiencing", "having"],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Rewrite one fragment; does NOT drop anything. */
function rewrite(text: string): string {
  let out = text;
  for (const [from, to] of [...PLAIN_WORDS].sort((a, b) => b[0].length - a[0].length)) {
    out = out.replace(new RegExp(`\\b${escape(from)}\\b`, "gi"), to);
  }
  for (const word of SEVERITY_WORDS) {
    out = out.replace(new RegExp(`\\b${escape(word)}\\b`, "gi"), "");
  }
  return out
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\b(a|an)\s+(?=[,.;:])/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Split on sentence ends, keeping the terminator with its sentence. */
const sentences = (text: string): string[] =>
  text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);

/**
 * Rewrite model text into plain parent words, then DROP any sentence that
 * still carries a clinical-diagnosis term. Returns "" when nothing survives —
 * callers must treat "" as "there is nothing to show", never as a reason to
 * fall back to the raw string.
 */
export function toParentWords(raw: string | null | undefined): string {
  const text = raw?.trim();
  if (!text) return "";
  const kept = sentences(rewrite(text)).filter((s) => findClinicalDiagnosisTerm(s) === null);
  if (kept.length === 0) return "";
  const joined = kept.join(" ").replace(/\s{2,}/g, " ").trim();
  return joined ? joined.charAt(0).toUpperCase() + joined.slice(1) : "";
}

/** True when the text is already in parent words (nothing would be changed). */
export const isPlainParentWords = (raw: string): boolean => toParentWords(raw) === raw.trim();

/**
 * Memory proposals, scrubbed at the seam. A proposal whose fact does not
 * survive is DROPPED — a parent is never asked to approve a fact Arbor cannot
 * state in their own words.
 */
export function scrubMemoryProposals<T extends { fact: string }>(proposals: T[] | undefined | null): T[] {
  if (!Array.isArray(proposals)) return [];
  const out: T[] = [];
  for (const p of proposals) {
    const fact = toParentWords(p.fact);
    if (fact) out.push({ ...p, fact });
  }
  return out;
}

/**
 * The prompt-side half: one clause, stated once, appended to generative
 * prompts whose output reaches a parent surface in a warm register.
 */
export const PLAIN_PARENT_WORDS_CLAUSE = `
PLAIN PARENT WORDS:
- Write every parent-facing line in plain parent words — what a parent would say to another parent at the school gate.
- No developmental domain nouns (fine motor, gross motor, executive function, sensory processing, expressive/receptive language, social-emotional, self-regulation).
- No severity or grading adjectives (severe, significant, marked, mild, moderate, impressive, remarkable, excellent, poor).
- Say what happened and what it looked like. Never grade it.
`.trim();
