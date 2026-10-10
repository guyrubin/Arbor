import { en, he } from "../lib/i18nElevation/journal";
import { fnv1a } from "../lib/promptBank";

/** B-SHELL-36 requires review of each area's first notice. Existing Journal
 * publication is not evidence of approval for this new first-run use. Entries
 * stay empty until a named reviewer signs the exact bilingual copy. No env
 * flag, date, user preference or client record can manufacture that approval. */
export interface OnboardingNoticeReview {
  key: string;
  digest: string;
  reviewedBy: string;
  reviewedAt: string;
  reviewDueAt: string;
}
export const ONBOARDING_NOTICE_REVIEWS: readonly OnboardingNoticeReview[] = Object.freeze([]);
export function onboardingNoticeDigest(key: string): string {
  return `fnv1a32:${fnv1a(JSON.stringify(["onboarding-notice-v1", key, en[key], he[key]])).toString(16)}`;
}
export function hasOnboardingNoticeReview(key: string, now = new Date()): boolean {
  const review = ONBOARDING_NOTICE_REVIEWS.find(entry => entry.key === key);
  return !!review && !!en[key]?.trim() && !!he[key]?.trim() && !!review.reviewedBy.trim()
    && Number.isFinite(now.getTime()) && Date.parse(review.reviewedAt) <= now.getTime()
    && Date.parse(review.reviewDueAt) > now.getTime() && review.digest === onboardingNoticeDigest(key);
}
