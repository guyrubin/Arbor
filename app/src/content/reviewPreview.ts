import type { BehaviorLog } from "../types";
import type { ContentReviewStatus } from "./governance";
import { isPublishableContent } from "./governance";
import {
  hardMomentCards,
  previewHardMomentCards,
  publishedHardMomentCards,
  type HardMomentCard,
} from "./hardMomentCards";
import { todayHardMomentOffer } from "./hardMomentSurface";
import { VOICE_SAFETY_FALLBACKS } from "../safety/voiceSafetyFallbacks";
import { escalationCategories, HELPLINES_REVIEWED_ON, renderEscalationMarkdown } from "../safety/escalation";

/**
 * GD-1 reviewer-preview — the SINGLE seam through which the AR-CONT-01
 * built-dark surfaces (Behaviors / Today / Ask Arbor) may show DRAFT content,
 * and only to the server-verified appointed clinical reviewer.
 *
 * Contract (pinned in reviewPreview.test.ts):
 *  - Non-reviewers get exactly the published view: with the real all-draft
 *    pack that is [] — the surfaces stay EMPTY. Nothing here can widen it.
 *  - The reviewer gets the full authored pack with draftPreview: true, which
 *    obligates the consuming surface to render the persistent DRAFT banner
 *    (i18n `review.draftBanner`) on the surface AND on every card.
 *  - The publication predicate (isPublishableContent) is never touched: this
 *    module only ADDS a render path that is itself allow-list gated.
 */
export function surfaceHardMomentCards(isReviewer: boolean): { cards: HardMomentCard[]; draftPreview: boolean } {
  if (isReviewer === true) {
    const preview = previewHardMomentCards(true);
    if (preview.length > 0) return { cards: preview, draftPreview: true };
  }
  // Everyone else: the fail-closed published list, unchanged.
  return { cards: publishedHardMomentCards, draftPreview: false };
}

/**
 * Today-surface variant: the real published offer always wins (draftPreview
 * false — no banner, it IS published content). Only when nothing publishes and
 * the caller is the reviewer does a draft card surface, flagged draftPreview
 * so the offer renders under the DRAFT banner. Non-reviewers: identical to
 * todayHardMomentOffer — null with the all-draft pack.
 */
export function previewTodayOffer(
  logs: Pick<BehaviorLog, "behaviorType" | "timestamp">[],
  isReviewer: boolean,
  now: Date = new Date(),
): { card: HardMomentCard; draftPreview: boolean } | null {
  const real = todayHardMomentOffer(logs, hardMomentCards, now);
  if (real) return { card: real.card, draftPreview: false };
  if (isReviewer !== true) return null;
  const preview = previewHardMomentCards(true);
  if (preview.length === 0) return null;
  const draft = preview.find((card) => !isPublishableContent(card, now)) ?? preview[0];
  return { card: draft, draftPreview: true };
}

/** One reviewable item in the clinical review queue. */
export type ReviewQueueEntry = {
  id: string;
  kind: "hard-moment-card" | "voice-safety-fallback" | "escalation-resource";
  /** Cards carry their governance reviewStatus; the voice fallbacks are queued
   *  for sign-off (GG-4); escalation resources are live + registry-reviewed. */
  status: ContentReviewStatus | "queued-signoff" | "shipped-reviewed";
  reviewedBy: string;
  reviewedAt: string;
  titleEn: string;
  titleHe: string;
  /** Labeled bilingual body blocks. labelKey is an i18n key when it starts
   *  with "hm."/"review."; otherwise it is a literal label. */
  fields: { labelKey: string; en: string; he: string }[];
};

/**
 * The full reviewable slate for the appointed clinical reviewer:
 *  1. all authored hard-moment cards (both locales) with governance metadata,
 *  2. the two VC-6 voice-safety fallback strings (HE queued for GG-4 sign-off),
 *  3. the escalation-resource copy per category (registry-reviewed, read-only).
 * Read-only — reviewing happens here; STAMPING (reviewedBy/contentHash) stays
 * an authoring/PR action so the fail-closed publication gate never moves.
 */
export function reviewQueueEntries(): ReviewQueueEntry[] {
  const cards: ReviewQueueEntry[] = previewHardMomentCards(true).map((card) => ({
    id: `card:${card.id}`,
    kind: "hard-moment-card",
    status: card.reviewStatus,
    reviewedBy: card.reviewedBy,
    reviewedAt: card.reviewedAt,
    titleEn: card.title.en,
    titleHe: card.title.he,
    fields: [
      { labelKey: "hm.section.doNow", en: card.doNow.en, he: card.doNow.he },
      { labelKey: "hm.section.sayThis", en: card.sayThis.en, he: card.sayThis.he },
      { labelKey: "hm.section.avoid", en: card.avoid.en, he: card.avoid.he },
      { labelKey: "hm.section.observe", en: card.observe.en, he: card.observe.he },
      { labelKey: "hm.section.escalation", en: card.escalation.en, he: card.escalation.he },
    ],
  }));

  const voice: ReviewQueueEntry[] = (["escalation", "blocked"] as const).map((key) => ({
    id: `voice-fallback:${key}`,
    kind: "voice-safety-fallback",
    status: "queued-signoff", // GG-4: HE crisis copy queued for clinical sign-off
    reviewedBy: "",
    reviewedAt: "",
    titleEn: `Voice safety fallback — ${key}`,
    titleHe: key === "escalation" ? "משפט בטיחות קולי — הסלמה" : "משפט בטיחות קולי — חסימה",
    fields: [
      { labelKey: "review.spokenCopy", en: VOICE_SAFETY_FALLBACKS.en[key], he: VOICE_SAFETY_FALLBACKS.he[key] },
    ],
  }));

  const escalations: ReviewQueueEntry[] = escalationCategories.map((entry) => ({
    id: `escalation-resource:${entry.category}`,
    kind: "escalation-resource",
    status: "shipped-reviewed", // helpline registry review (CI-05)
    reviewedBy: "arbor-safety registry review",
    reviewedAt: HELPLINES_REVIEWED_ON,
    titleEn: `Escalation resources — ${entry.label}`,
    titleHe: `משאבי הסלמה — ${entry.label}`,
    fields: [
      {
        labelKey: "review.resourceCopy",
        en: renderEscalationMarkdown({ category: entry.category, label: entry.label, resources: entry.resources }),
        he: "", // the resource sheet is a single multilingual markdown block
      },
    ],
  }));

  return [...cards, ...voice, ...escalations];
}
