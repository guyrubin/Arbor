/**
 * MOB-05 — the ONE support identity, on the product domain.
 *
 * Three different mailboxes used to be printed across the app and the public
 * pages (hello@arbor.app, support@arbor.family, privacy@arbor.family) — none
 * on the domain the stores point at (arborparentingapp.com, fastlane
 * support_url.txt). Reviewers write to the support address (Apple 1.5) and a
 * parent exercising a data right must reach a live mailbox, so every surface
 * reads these two constants (supportContacts.test.ts scans src/ + public/).
 */

export const SUPPORT_DOMAIN = "arborparentingapp.com";

export const SUPPORT_EMAIL = `support@${SUPPORT_DOMAIN}`;
export const PRIVACY_EMAIL = `privacy@${SUPPORT_DOMAIN}`;

/** A `mailto:` href with an optional pre-filled subject (RFC 6068). */
export function mailtoHref(address: string, subject?: string): string {
  const base = `mailto:${address}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}
