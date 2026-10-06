import { hardMomentCards, type HardMomentCard } from "../content/hardMomentCards.js";
import type { ContentLocale } from "../content/governance.js";

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
  const candidates: unknown[] = [message];
  if (Array.isArray(recentTurns)) {
    for (let i = recentTurns.length - 1; i >= 0; i -= 1) {
      const turn = recentTurns[i] as { role?: unknown; text?: unknown } | null;
      if (turn && typeof turn === "object" && turn.role === "parent") candidates.push(turn.text);
    }
  }
  for (const candidate of candidates) {
    const hit = cardFromSeedText(candidate);
    if (hit) return hit.locale === "he" ? hit.card.escalation.he : hit.card.escalation.en;
  }
  return null;
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
