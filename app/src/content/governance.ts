import type { MilestoneExampleMedia } from "../types";

export type ContentLocale = "en" | "he";
export type ContentReviewStatus = "draft" | "approved" | "retired";
export type ContentSafetyClass = "general-parenting" | "heightened-care";

export interface LocalizedText {
  en: string;
  he: string;
}

/**
 * CONT-6 (AR-CAP-07) — controlled parent-concern vocabulary. Internal routing
 * metadata ONLY: labels are observational, never diagnostic-shaped (firewall
 * ruling: "separation", never "separation-anxiety"). If a concern ever renders
 * on a parent surface its i18n label must pass the wave-3 banned-token scan.
 */
export const CONTENT_CONCERNS = [
  "aggression",
  "sleep",
  "separation",
  "food",
  "screens",
  "attention",
  "peer-conflict",
  "transitions",
  "regulation",
  "routines",
  "fears",
] as const;
export type ContentConcern = (typeof CONTENT_CONCERNS)[number];

export interface GovernedContentRecord {
  id: string;
  version: string;
  ageBands: string[];
  domains: string[];
  /** AR-CAP-07 — parent-concern taxonomy tags (controlled vocabulary). */
  concerns: ContentConcern[];
  /** AR-CAP-07 — the concrete moment this record serves, on the governed base. */
  moment?: string;
  locales: ContentLocale[];
  safetyClass: ContentSafetyClass;
  reviewStatus: ContentReviewStatus;
  reviewerRole: string;
  /**
   * CONT-1 — the NAMED person who performed the clinical review. Distinct from
   * reviewerRole; a record whose reviewedBy is blank (or merely parrots the
   * role string) NEVER publishes. Drafts ship with this empty.
   */
  reviewedBy: string;
  reviewedAt: string;
  reviewDueAt: string;
  evidenceRefs: string[];
  /**
   * CONT-1 — stable hash over the reviewed copy (title/doNow/sayThis/avoid/
   * observe/escalation, both locales) stamped at approval via
   * computeContentHash. isPublishableContent recomputes and compares, so any
   * post-approval edit demotes the record. Absent on drafts.
   */
  contentHash?: string;
}

/** The reviewed-copy fields the CONT-1 content hash binds the stamp to. */
export interface ReviewableCopy {
  title: LocalizedText;
  doNow: LocalizedText;
  sayThis: LocalizedText;
  avoid: LocalizedText;
  observe: LocalizedText;
  escalation: LocalizedText;
}

const COPY_FIELDS: (keyof ReviewableCopy)[] = ["title", "doNow", "sayThis", "avoid", "observe", "escalation"];

/**
 * CONT-1 — deterministic FNV-1a hash over the six reviewed-copy fields in both
 * locales. The future review tool stamps record.contentHash with this value at
 * approval; publication recomputes and compares so the stamp is bound to the
 * exact text the named reviewer saw.
 */
export function computeContentHash(copy: ReviewableCopy): string {
  const parts: string[] = [];
  for (const field of COPY_FIELDS) {
    const text = copy[field];
    parts.push(text.en, text.he);
  }
  // U+241F (symbol for unit separator) never occurs in authored copy, so the
  // serialization is unambiguous.
  const canonical = parts.join("␟");
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** reviewedAt must parse to a real date, not in the future, not after the review window. */
function isValidReviewedAt(record: GovernedContentRecord, now: Date): boolean {
  const reviewed = new Date(record.reviewedAt).getTime();
  if (!Number.isFinite(reviewed)) return false; // "", "TBD", garbage → fail closed
  const due = new Date(record.reviewDueAt).getTime();
  return reviewed <= now.getTime() && (Number.isFinite(due) ? reviewed <= due : false);
}

/**
 * AR-CONT-01 / CONT-1 — the fail-closed publication gate. A record publishes
 * only when it is approved, bilingual, carries honest metadata (>=1 ageBand,
 * >=1 concern), is stamped by a NAMED reviewer with a real review date inside
 * the review window, has provenance, and — when it carries reviewable copy —
 * its contentHash still matches the copy the reviewer stamped.
 */
export function isPublishableContent(
  record: GovernedContentRecord & Partial<ReviewableCopy>,
  now = new Date(),
): boolean {
  if (record.reviewStatus !== "approved") return false; // draft AND retired fail
  if (!record.locales.includes("en") || !record.locales.includes("he")) return false;
  if (record.ageBands.length === 0) return false;
  if (record.concerns.length === 0) return false;
  if (!record.reviewerRole.trim()) return false;
  const reviewedBy = record.reviewedBy.trim();
  if (!reviewedBy) return false;
  // A role string pasted into the person field is not a named reviewer.
  if (reviewedBy === record.reviewerRole.trim()) return false;
  if (!isValidReviewedAt(record, now)) return false;
  if (new Date(record.reviewDueAt).getTime() < now.getTime()) return false;
  if (record.evidenceRefs.length === 0) return false;

  // CONT-1 content binding: if the record carries any reviewable copy, ALL six
  // fields must be present and the stamped hash must match — a post-approval
  // edit (or a missing stamp) demotes the record. Fails closed on partials.
  const presentCopy = COPY_FIELDS.filter((field) => record[field] != null);
  if (presentCopy.length > 0) {
    if (presentCopy.length < COPY_FIELDS.length) return false;
    if (record.contentHash !== computeContentHash(record as GovernedContentRecord & ReviewableCopy)) return false;
  }
  return true;
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
