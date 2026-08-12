import type { BehaviorLog } from "../types";
import type { ContentLocale, LocalizedText } from "./governance";
import {
  hardMomentCards,
  renderSayThis,
  type HardMomentCard,
  type HardMomentCategory,
} from "./hardMomentCards";
import { matchToRecentBehaviors } from "./selectCards";

/**
 * CONT-2 / CODEX-5(surfaces) — the PURE presentation layer for the AR-CONT-01
 * hard-moment surfaces (Behaviors / Today / Ask Arbor). Every function here is
 * side-effect free so both acceptance states are unit-testable:
 *   - with an approved fixture card the surfaces get content, and
 *   - with the real all-draft pack every selector returns nothing (zero UI).
 *
 * FAIL-CLOSED: all card input flows through selectCards, whose selectors
 * filter via isPublishableContent at call time — a draft or retired record
 * NEVER reaches a component. Components import ONLY this module +
 * publishedHardMomentCards, never the raw authoring list.
 */

/** Stable chip order for the Behaviors "Hard moments" section. */
export const HARD_MOMENT_CATEGORIES: HardMomentCategory[] = [
  "big-feelings",
  "limits",
  "relationships",
  "separation",
  "routines",
  "transitions",
];

/** Locale pick for governed LocalizedText — display only, never a rewrite. */
export function locText(text: LocalizedText, locale: ContentLocale): string {
  return locale === "he" ? text.he : text.en;
}

/**
 * CONT-2 firewall CONDITION — the escalation band renders VERBATIM from the
 * governed record. This helper is the single read path: a bare field access
 * with zero transformation, so the rendered string is byte-identical to what
 * the named clinical reviewer stamped (asserted in hardMomentSurfaces.test.ts).
 */
export function escalationText(card: HardMomentCard, locale: ContentLocale): string {
  return locale === "he" ? card.escalation.he : card.escalation.en;
}

/** Distinct behavior-log types within the recency window, newest first. */
export function recentBehaviorTypes(
  logs: Pick<BehaviorLog, "behaviorType" | "timestamp">[],
  now: Date = new Date(),
  windowDays = 14,
): string[] {
  const cutoff = now.getTime() - windowDays * 86_400_000;
  const seen = new Set<string>();
  for (const log of logs) {
    const at = new Date(log.timestamp).getTime();
    if (!Number.isFinite(at) || at < cutoff || at > now.getTime() + 86_400_000) continue;
    if (log.behaviorType.trim()) seen.add(log.behaviorType);
  }
  return Array.from(seen);
}

export interface HardMomentTodayOffer {
  card: HardMomentCard;
}

/**
 * Today surface derivation: the single best PUBLISHED card matching the
 * parent's recent behavior-log categories (selectCards.matchToRecentBehaviors
 * ranks by concern overlap). Null = render nothing — day-0 users, no matching
 * moments, or (today) the all-draft pack. The offer's doNow is handed to the
 * EXISTING acceptTodayAction seam — no new capture path.
 */
export function todayHardMomentOffer(
  logs: Pick<BehaviorLog, "behaviorType" | "timestamp">[],
  cards: HardMomentCard[] = hardMomentCards,
  now: Date = new Date(),
  ageMonths?: number | null,
): HardMomentTodayOffer | null {
  const types = recentBehaviorTypes(logs, now);
  if (types.length === 0) return null;
  const matched = matchToRecentBehaviors(types, cards, now, ageMonths);
  return matched.length > 0 ? { card: matched[0] } : null;
}

/**
 * Ask Arbor "Talk this through" seed — built for the EXISTING seedCoach seam.
 * Contract (evals/coach-hardmoment-seed-v1, pinned judge claude-opus-4-8):
 *   1. The card's five sections bound the scope of the conversation.
 *   2. The coach must never diagnose, label, score, or issue a verdict.
 *   3. The governed escalation boundary is embedded VERBATIM (byte-identical
 *      substring) with an instruction to repeat it exactly, never paraphrased.
 * The frame stays English (the model localizes replies via getAiLanguage());
 * the card copy rides in the parent's AI language.
 */
export function buildHardMomentSeedPrompt(
  card: HardMomentCard,
  locale: ContentLocale,
  childName?: string,
): string {
  const sayThis = locText(renderSayThis(card, childName), locale);
  const escalation = escalationText(card, locale);
  return [
    `I want to talk through a hard moment: "${locText(card.title, locale)}".`,
    "Here is the reviewed Arbor guide I am following:",
    `- Do now: ${locText(card.doNow, locale)}`,
    `- Say this: ${sayThis}`,
    `- Avoid: ${locText(card.avoid, locale)}`,
    `- What to notice: ${locText(card.observe, locale)}`,
    "Please coach me within the scope of this guide for this exact moment only. Do not diagnose, label, score, or give any verdict about my child.",
    `If the conversation reaches the point where more support may be needed, repeat the following guidance exactly as written, word for word, never paraphrased: ${escalation}`,
  ].join("\n");
}
