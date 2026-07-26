/**
 * GD-1 reviewer-preview: the server-side allow-list guard for in-prod draft
 * review. The appointed clinical reviewer must be able to review the gated
 * draft hard-moment content in production on her own account while it stays
 * invisible to every other user.
 *
 * FAIL-CLOSED by construction:
 *  - CLINICAL_REVIEWER_EMAILS unset/empty → the list is [] → nobody matches.
 *  - Unauthenticated / sandbox actors carry no email → never match.
 *  - Matching is exact (trimmed, lowercased) — never substring or domain-wide.
 *
 * This guard gates the reviewer-preview RENDER seam + any server egress of
 * draft-review signals only. It NEVER publishes content: the AR-CONT-01
 * publication predicate (content/governance.ts isPublishableContent) is
 * untouched and remains the only path to parent-visible hard-moment content.
 */
export const isClinicalReviewer = (
  config: { clinicalReviewerEmails: string[] },
  actor: { uid: string; email: string | null },
): boolean => {
  if (!Array.isArray(config.clinicalReviewerEmails) || config.clinicalReviewerEmails.length === 0) return false;
  const email = (actor.email || "").trim().toLowerCase();
  if (!email) return false;
  return config.clinicalReviewerEmails.includes(email);
};
