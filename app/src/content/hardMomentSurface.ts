import type { BehaviorLog } from "../types";
import type { ContentLocale, LocalizedText } from "./governance";
import {
  hardMomentCatalogue,
  renderSayThis,
  type HardMomentCard,
  type HardMomentCategory,
} from "./hardMomentCards";
import { matchToRecentBehaviors } from "./selectCards";
import { hardMomentPublication, type HardMomentContext, type PilotRelease } from "./pilotRelease";

/** Pure presentation helpers; selectors and action seeds share the release policy. */

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
 * the released record contains (asserted in hardMomentSurfaces.test.ts).
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
 * moments, or no currently available guide for this age and locale. The offer's doNow is handed to the
 * EXISTING acceptTodayAction seam — no new capture path.
 */
export function todayHardMomentOffer(
  logs: Pick<BehaviorLog, "behaviorType" | "timestamp">[],
  cards: HardMomentCard[] = hardMomentCatalogue,
  now: Date = new Date(),
  ageMonths?: number | null,
  locale: ContentLocale = "en",
  release?: PilotRelease,
): HardMomentTodayOffer | null {
  const types = recentBehaviorTypes(logs, now);
  if (types.length === 0) return null;
  const matched = matchToRecentBehaviors(types, cards, now, ageMonths, locale, release);
  return matched.length > 0 ? { card: matched[0] } : null;
}

/**
 * B-AI-14 (reopened 6 Oct): the seed's last line. The app shows the guide's
 * escalation boundary itself (server-added `governedEscalation`), so the model
 * is told not to restate it — a model paraphrase beside the governed sentence
 * was the 5 Oct judge failure. Pointing to it in one plain sentence is allowed.
 */
export const HARD_MOMENT_SEED_ESCALATION_NOTE =
  "The app shows this guide's own escalation boundary (when to reach out for more support) with your answer, word for word. Do not restate, summarize or reword that boundary, in your reply or in escalateIf. If the conversation reaches the point where more support may be needed, say so in one plain sentence and point me to that guidance.";

/**
 * Ask Arbor "Talk this through" seed — built for the EXISTING seedCoach seam.
 * Contract (evals/coach-hardmoment-seed-v1, pinned judge gemini-2.5-pro, interim — B-PROV-02):
 *   1. The card's five sections bound the scope of the conversation.
 *   2. The coach must never diagnose, label, score, or issue a verdict.
 *   3. B-AI-14 (reopened 6 Oct): the governed escalation boundary is NOT in
 *      the seed and the model is NOT asked to repeat it. The app shows it
 *      itself: /chat resolves the card from the seed's FIRST line (the title,
 *      safety/seededEscalation cardFromSeedText — inside the 800-char window
 *      a follow-up turn keeps) and sets `contract.governedEscalation` to the
 *      card's sentence byte-identical, dropping the model's escalateIf. The
 *      seed tells the model the app shows the boundary, so it must not
 *      restate, summarize or reword it (in its reply or in escalateIf).
 * The frame stays English (the model localizes replies via getAiLanguage());
 * the card copy rides in the parent's AI language.
 */
export function buildHardMomentSeedPrompt(
  card: HardMomentCard,
  locale: ContentLocale,
  childName?: string,
  context?: Omit<HardMomentContext, "locale">,
): string {
  const publication = hardMomentPublication(card, { ...context, ageMonths: context?.ageMonths, locale });
  if (!publication) return "";
  const sayThis = locText(renderSayThis(card, childName), locale);
  return [
    `I want to talk through a hard moment: "${locText(card.title, locale)}".`,
    publication === "editorial-pilot"
      ? "Here is an Arbor editorial pilot guide. It has not had individual clinical review; do not describe it as clinician-approved."
      : "Here is the reviewed Arbor guide I am following:",
    `- Do now: ${locText(card.doNow, locale)}`,
    `- Say this: ${sayThis}`,
    `- Avoid: ${locText(card.avoid, locale)}`,
    `- What to notice: ${locText(card.observe, locale)}`,
    "Offer educational parenting support, not treatment. Do not suggest restraint, forced affection, punishment, or ignoring danger. Stop an activity that increases distress.",
    "Please coach me within the scope of this guide for this exact moment only. Do not diagnose, label, score, or give any verdict about my child.",
    HARD_MOMENT_SEED_ESCALATION_NOTE,
  ].join("\n");
}
