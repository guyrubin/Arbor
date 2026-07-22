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
