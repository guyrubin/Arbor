import type { MilestoneExampleMedia } from "../types";

export type ContentLocale = "en" | "he";
export type ContentReviewStatus = "draft" | "approved" | "retired";
export type ContentSafetyClass = "general-parenting" | "heightened-care";

export interface LocalizedText {
  en: string;
  he: string;
}

export interface GovernedContentRecord {
  id: string;
  version: string;
  ageBands: string[];
  domains: string[];
  locales: ContentLocale[];
  safetyClass: ContentSafetyClass;
  reviewStatus: ContentReviewStatus;
  reviewerRole: string;
  reviewedAt: string;
  reviewDueAt: string;
  evidenceRefs: string[];
}

export function isPublishableContent(record: GovernedContentRecord, now = new Date()): boolean {
  return record.reviewStatus === "approved"
    && record.locales.includes("en")
    && record.locales.includes("he")
    && Boolean(record.reviewerRole.trim())
    && Boolean(record.reviewedAt)
    && new Date(record.reviewDueAt).getTime() >= now.getTime()
    && record.evidenceRefs.length > 0;
}

/**
 * UND-7 (AR-CAP-08 / AR-CONT-07) — fail-closed gate for the governed
 * milestone example-media slot, mirroring the AR-CONT-01 publication gate
 * above: a record missing its named reviewer or its rights reference NEVER
 * renders. Defensive against untyped persisted data — every field is
 * re-checked at runtime, and any absent/blank/unknown value fails closed.
 * The slot ships with zero media entries; licensing stays Guy-gated (GD-8).
 */
export function isRenderableMilestoneMedia(
  media: MilestoneExampleMedia | null | undefined,
): media is MilestoneExampleMedia {
  if (!media || typeof media !== "object") return false;
  const filled = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;
  return (media.kind === "illustration" || media.kind === "video")
    && filled(media.src)
    && filled(media.alt)
    && filled(media.credit)
    && filled(media.rightsRef)
    && filled(media.reviewer)
    && filled(media.reviewedAt)
    && (media.locale === "en" || media.locale === "he");
}
