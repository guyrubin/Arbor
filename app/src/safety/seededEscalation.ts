import { hardMomentCards, type HardMomentCard } from "../content/hardMomentCards.js";
import type { ContentLocale } from "../content/governance.js";
import { HARD_MOMENT_SEED_ESCALATION_NOTE } from "../content/hardMomentSurface.js";

/**
 * B-AI-14 — the hard-moment seed's escalation line is a VERBATIM,
 * model-independent field.
 *
 * The "Talk this through" seed (content/hardMomentSurface.ts
 * buildHardMomentSeedPrompt) used to embed the card's governed escalation
 * sentence and ask the model to repeat it word for word. On coach_chat 1.4.x
 * the model paraphrased or dropped it (3 of 6 judged scenarios on 1 Oct; 2 of
 * 6 on gemini-2.5-flash on 5 Oct even after 0ef2b21 put the sentence at the
 * head of escalateIf, because the model's own paraphrase stayed beside it) —
 * and on a follow-up turn it cannot even see it: recentTurns are capped at
 * 800 chars per turn (ai/chatContext.ts).
 *
 * So the model is no longer asked to repeat it at all (reopened 6 Oct). The
 * server recognises the seed by its FIRST line (`I want to talk through a
 * hard moment: "<title>".`, always inside the 800-char window), resolves the
 * title against the governed card catalog (never against client-supplied
 * escalation text — a forged seed cannot make the server echo arbitrary
 * words), and the /chat route sets `contract.governedEscalation` to the card's
 * escalation sentence, byte-identical, on every answer in a seeded
 * conversation — and DROPS the model's own `escalateIf` lines (never merged).
 * The card UI renders the field verbatim in the escalation slot.
 */

export const HARD_MOMENT_SEED_OPENING = "I want to talk through a hard moment: ";

const SEED_TITLE = /^I want to talk through a hard moment: "(.+)"\.\s*$/;

/** The governed card + locale a seed text names, or null. Matches the first line only. */
export function cardFromSeedText(text: unknown): { card: HardMomentCard; locale: ContentLocale } | null {
  if (typeof text !== "string") return null;
  const firstLine = text.trimStart().split("\n", 1)[0] ?? "";
  const match = SEED_TITLE.exec(firstLine);
  if (!match) return null;
  const title = match[1];
  for (const card of hardMomentCards) {
    if (card.title.en === title) return { card, locale: "en" };
    if (card.title.he === title) return { card, locale: "he" };
  }
  return null;
}

/**
 * The governed escalation sentence for a seeded conversation, or null when
 * neither the current message nor any parent turn is a hard-moment seed. The
 * newest seed wins (the current message first, then turns newest-first).
 * `recentTurns` is read RAW (before sanitizeRecentTurns) only as a lookup key.
 */
export function seededEscalationLine(message: unknown, recentTurns: unknown): string | null {
  const hit = seededCard(message, recentTurns);
  if (!hit) return null;
  return hit.locale === "he" ? hit.card.escalation.he : hit.card.escalation.en;
}

/** The governed card (and its seed locale) of a seeded conversation, newest seed first; null otherwise. */
export function seededCard(message: unknown, recentTurns: unknown): { card: HardMomentCard; locale: ContentLocale } | null {
  const candidates: unknown[] = [message];
  if (Array.isArray(recentTurns)) {
    for (let i = recentTurns.length - 1; i >= 0; i -= 1) {
      const turn = recentTurns[i] as { role?: unknown; text?: unknown } | null;
      if (turn && typeof turn === "object" && turn.role === "parent") candidates.push(turn.text);
    }
  }
  for (const candidate of candidates) {
    const hit = cardFromSeedText(candidate);
    if (hit) return hit;
  }
  return null;
}

/**
 * B-AI-14 (coach_chat 1.5.3) — the parent's FOLLOW-UP line in a seeded
 * conversation, or null on the turn that only shares the guide (and on every
 * unseeded turn). Two shapes: the product's (the seed sits in recentTurns,
 * the message is the follow-up) and the judge's (one message: the seed, then
 * a later parent line after the seed's closing note, "Parent follow-up: …").
 */
export function seededFollowUpLine(message: unknown, recentTurns: unknown): string | null {
  if (typeof message !== "string" || !message.trim()) return null;
  if (!cardFromSeedText(message)) return seededCard(message, recentTurns) ? message.trim() : null;
  const at = message.lastIndexOf(HARD_MOMENT_SEED_ESCALATION_NOTE);
  if (at < 0) return null;
  const rest = message.slice(at + HARD_MOMENT_SEED_ESCALATION_NOTE.length).trim().replace(/^Parent follow-up:\s*/i, "").trim();
  return rest || null;
}

/**
 * The seeded answer's escalation slot carries the governed sentence and
 * nothing else: `governedEscalation` = the line, byte-identical (no trim, no
 * rewrite), and the model's `escalateIf` lines are dropped — a paraphrase
 * beside the governed sentence is exactly the 5 Oct judge failure. Mutates
 * and returns the contract (server-side, after parse, before the output screen).
 */
export function applyGovernedEscalation<T extends { escalateIf?: string[]; governedEscalation?: string }>(
  contract: T,
  line: string,
): T {
  contract.governedEscalation = line;
  contract.escalateIf = [];
  return contract;
}

/**
 * B-AI-14 (live fix, 6 Oct) — belt and braces on a SEEDED turn only: the live
 * judge saw the model restate the boundary outside escalateIf (the shepherd
 * frame named "a pediatrician … a child psychologist"; a requested prose
 * summary). coach_chat 1.5.0 tells the model not to; this lexical screen
 * removes what slips through. Language-scoped (a term list is valid only for
 * the language it was written for): the session language's list runs.
 *
 * HE deviations from the orchestrator's list, on purpose: "מטפל" alone also
 * matches "מטפלת" (the daycare caregiver, a normal word in a separation
 * answer), so only "מטפל/ת" and the emotional-therapist forms are listed;
 * "לפנות ל" alone matches "לפנות לילד/ה" (to address the child), so it is
 * listed only before a professional or help noun.
 */
export const PROFESSIONAL_HELP_TERMS: Readonly<Record<"en" | "he", readonly RegExp[]>> = {
  en: [
    /\bp(?:a)?ediatrician/i,
    /\bdoctor/i,
    /\bpsychologist/i,
    /\btherapist/i,
    /\bspecialist/i,
    /\bprofessional (?:help|support)/i,
    /\bseek(?:ing)? help/i,
    /\breach(?:ing)? out for (?:more )?support/i,
    /\bwhen to get help/i,
  ],
  he: [
    /רופא/,
    /פסיכולוג/,
    /מטפל\/ת/,
    /מטפל(?:ת)? רגשי/,
    /עזרה מקצועית/,
    /ייעוץ מקצועי/,
    /אי(?:ש|שת) מקצוע/,
    /אנשי מקצוע/,
    /גורם מקצועי/,
    /לפנות ל(?:רופא|איש|אשת|אנשי|גורם|ייעוץ|עזרה|פסיכולוג|מטפל)/,
  ],
};

/**
 * B-AI-14 (stream) — the SSE twin of the done-time scrub. On a seeded turn
 * the /chat relay asks this for every COMPLETE prose sentence it is about to
 * release as a `delta` (the relay's sentence boundary, lib/sentenceStream
 * SENTENCE_BOUNDARY_SCAN, as /voice uses): a sentence that names professional
 * help or whom to contact is never written to the wire. Same language-scoped
 * term list as `scrubSeededProfessionalHelp`, so the streamed bubble and the
 * scrubbed `done` text agree. Non-seeded turns never call it.
 */
export function seededDeltaAllowed(sentence: string, language: "en" | "he"): boolean {
  return !PROFESSIONAL_HELP_TERMS[language].some((re) => re.test(sentence));
}

/**
 * B-AI-14 (render fix, 6 Oct) — the seeded FOLLOW-UP's prose when the screen
 * emptied it. Live 1.5.3: paraphrase-bait-public-meltdown ("summarize in your
 * own words when I would need to get professional help?") — the follow-up
 * detector fired (short shape, card sections empty), but the model's one
 * pointer sentence named professional help, the scrub above removed it, and
 * the answer reached the parent with NO prose (cardScope 0: "produced no
 * conversational prose at all"). The route now fills the emptied answer with
 * this one fixed sentence: it declines to reword and points at the guide's
 * line shown just below. Names no professional and no help term (it must
 * survive its own screen).
 */
export const SEEDED_FOLLOW_UP_POINTER: Readonly<Record<"en" | "he", string>> = {
  en: "I'll keep the guide's own words for this part rather than reword them; they are shown just below, exactly as written.",
  he: "את החלק הזה נשאיר במילים של המדריך עצמו, בלי לנסח מחדש; הן מופיעות כאן למטה, בדיוק כפי שנכתבו.",
};

/** Seeded follow-up only: an answer whose prose is empty (after the scrub) gets the pointer. Mutates; true when filled. */
export function ensureSeededFollowUpText<T extends { text?: string }>(contract: T, language: "en" | "he"): boolean {
  if (typeof contract.text === "string" && contract.text.trim().length > 0) return false;
  contract.text = SEEDED_FOLLOW_UP_POINTER[language];
  return true;
}

/** Neutral fallbacks for a REQUIRED field the screen emptied (grounded in the guide the parent is following). */
const SCRUB_FALLBACK: Readonly<Record<"en" | "he", { parentScript: string; todayStep: string; frame: string }>> = {
  en: { parentScript: "Use the words from the guide's Say this step.", todayStep: "Follow the guide's Do now step.", frame: "—" },
  he: { parentScript: "אפשר להשתמש במילים מהמדריך.", todayStep: "לפעול לפי הצעד הראשון במדריך.", frame: "—" },
};

let scrubbedSentenceCount = 0;
/** How many sentences the seeded-turn screen removed in this process (log counter). */
export const seededScrubCount = (): number => scrubbedSentenceCount;

type ScrubbableContract = {
  text?: string;
  parentScript: string;
  observe: string[];
  todayPlan: string[];
  nonDiagnosticHypotheses: { label: string; confidence: string; rationale: string }[];
  frameRouting: { aim: string; twoAxes: string; story: string; shadow: string; marriage: string; shepherd: string };
};

/** Drop the sentences that carry a term; null when nothing changed (the string stays byte-identical). */
const scrubSentences = (value: string, terms: readonly RegExp[]): { text: string; dropped: number } | null => {
  if (!terms.some((re) => re.test(value))) return null;
  const parts = value.split(/(?<=[.!?…])\s+|\n+/).filter((p) => p.trim().length > 0);
  const kept = parts.filter((p) => !terms.some((re) => re.test(p)));
  return { text: kept.join(" ").trim(), dropped: parts.length - kept.length };
};

/**
 * Seeded turns only: remove every model-authored sentence that names
 * professional help or whom to contact (the app shows the governed line).
 * Never blocks the answer: an emptied optional field is omitted, an emptied
 * required field gets the neutral fallback. Mutates; returns sentences dropped.
 */
export function scrubSeededProfessionalHelp<T extends ScrubbableContract>(contract: T, language: "en" | "he"): number {
  const terms = PROFESSIONAL_HELP_TERMS[language];
  const fallback = SCRUB_FALLBACK[language];
  let dropped = 0;
  const one = (value: string): string | null => {
    const hit = scrubSentences(value, terms);
    if (!hit) return value;
    dropped += hit.dropped;
    return hit.text.length > 0 ? hit.text : null;
  };
  if (typeof contract.text === "string") {
    const text = one(contract.text);
    if (text === null) delete contract.text;
    else contract.text = text;
  }
  contract.parentScript = one(contract.parentScript) ?? fallback.parentScript;
  contract.observe = contract.observe.map(one).filter((s): s is string => s !== null);
  const plan = contract.todayPlan.map(one).filter((s): s is string => s !== null);
  // 1.5.3: the fallback fills a plan the SCREEN emptied; a plan that arrived
  // empty (the seeded follow-up's short shape) stays empty.
  contract.todayPlan = plan.length > 0 || contract.todayPlan.length === 0 ? plan : [fallback.todayStep];
  contract.nonDiagnosticHypotheses = contract.nonDiagnosticHypotheses.flatMap((h) => {
    if (terms.some((re) => re.test(h.label))) {
      dropped += 1;
      return [];
    }
    const rationale = one(h.rationale);
    return rationale === null ? [] : [{ ...h, rationale }];
  });
  const frames = contract.frameRouting;
  for (const key of ["aim", "twoAxes", "story", "shadow", "marriage", "shepherd"] as const) {
    frames[key] = one(frames[key]) ?? fallback.frame;
  }
  scrubbedSentenceCount += dropped;
  return dropped;
}
