import type { ConsentGrant, ConsentPurpose } from "../types";

/** A new grant is required: avatar consent never authorizes document analysis. */
export const COMPANION_CONSENT_PURPOSE: ConsentPurpose = "companion_attachments";
export const COMPANION_CONSENT_EVENT = "arbor:review-companion-file-permission";

export function latestCompanionConsent(grants: readonly ConsentGrant[], childId: string): ConsentGrant | undefined {
  return grants.filter(grant => grant.childId === childId && grant.purpose === COMPANION_CONSENT_PURPOSE)
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))[0];
}

export function companionConsentActive(grant: ConsentGrant | undefined, now = Date.now()): boolean {
  if (!grant?.granted || grant.revokedAt) return false;
  if (!grant.expiresAt) return true;
  const expires = Date.parse(grant.expiresAt);
  return Number.isFinite(expires) && expires > now;
}

/** The failure card returns to the pending draft instead of sending parents away. */
export function requestCompanionConsentReview(childId: string): void {
  window.dispatchEvent(new CustomEvent(COMPANION_CONSENT_EVENT, { detail: { childId } }));
}
