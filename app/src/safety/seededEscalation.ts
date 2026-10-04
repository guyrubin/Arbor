import { hardMomentCards, type HardMomentCard } from "../content/hardMomentCards.js";
import type { ContentLocale } from "../content/governance.js";

/**
 * B-AI-14 — the hard-moment seed's escalation line is a VERBATIM,
 * model-independent block.
 *
 * The "Talk this through" seed (content/hardMomentSurface.ts
 * buildHardMomentSeedPrompt) embeds the card's governed escalation sentence
 * and asks the model to repeat it word for word. On coach_chat 1.4.x the model
 * paraphrased or dropped it in 3 of 6 judged scenarios — and on a follow-up
 * turn it cannot even see it: recentTurns are capped at 800 chars per turn
 * (ai/chatContext.ts), which cuts the seed before its last line.
 *
 * So the server stops trusting the model with it. It recognises the seed by
 * its FIRST line (`I want to talk through a hard moment: "<title>".`, always
 * inside the 800-char window), resolves the title against the governed card
 * catalog (never against client-supplied escalation text — a forged seed
 * cannot make the server echo arbitrary words), and the /chat route puts the
 * card's escalation sentence, byte-identical, at the head of `escalateIf` on
 * every answer in a seeded conversation.
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
 * Put the governed line at the head of `escalateIf`, byte-identical, unless
 * an item already carries it verbatim. Any model item that merely paraphrases
 * it stays (it is the model's own threshold), the governed line leads.
 */
export function withVerbatimEscalation(escalateIf: readonly string[] | undefined, line: string): string[] {
  const items = Array.isArray(escalateIf) ? [...escalateIf] : [];
  if (items.some((item) => typeof item === "string" && item.includes(line))) return items;
  return [line, ...items];
}
