/**
 * B-GROWTH-43 — the family offers a referral link or a typed code can lead to,
 * in one place. Pure: no Firebase, no React, no clock; the server
 * (server/referral.ts grants, server/cohortMetrics.ts reads) and any later
 * surface import the same record.
 *
 * Why a new file: nothing held an offer. The referral month lived as a
 * literal (GRANT_DAYS = 30) inside server/referral.ts, the trial lives in
 * server/entitlements.ts (TRIAL_DAYS, the ruled trial every account gets),
 * and lib/pricing.ts is the list price. An offer is what a family is GIVEN on
 * top of the trial for arriving by a link or a code, so it needs a record of
 * its own with a version and an approval state.
 *
 * Rules:
 *  - A family redeems ONE offer, ever (server/referral.ts claims it per uid
 *    before any grant; a second code, a retry or a second device is refused).
 *  - Only an `approved` offer is ever granted. The founding-family offer
 *    (BD-05) is listed so the cohort reader can name it, but its copy,
 *    version, grant and price are Guy's decision: until he approves it, no
 *    code resolves to it and nothing grants it.
 *  - No child data: an offer is about the account that redeems it.
 */

export type OfferId = "referral_month" | "founding_family";

export interface OfferDef {
  id: OfferId;
  /** Bumped whenever the grant or the approved copy changes; recorded on each redemption. */
  version: number;
  /** Days of Plus granted to the redeeming family; null while unapproved. */
  grantDays: number | null;
  /** Whether the family whose code was used is granted the same. */
  grantsReferrer: boolean;
  /** Only an approved offer is ever granted or shown. */
  approved: boolean;
  /** Where the offer comes from, for the reader of the record. */
  basis: string;
}

export const OFFERS: Readonly<Record<OfferId, OfferDef>> = {
  referral_month: {
    id: "referral_month",
    version: 1,
    grantDays: 30,
    grantsReferrer: true,
    approved: true,
    basis: "legacy grant (mk-p0-2): one Plus month for the referred family on its activation, and one for the family whose code it used (up to the referrer cap)",
  },
  founding_family: {
    id: "founding_family",
    version: 0,
    grantDays: null,
    grantsReferrer: false,
    approved: false,
    basis: "BD-05 founding-family offer: copy, version, grant and billing are Guy's to approve; not redeemable until then",
  },
};

/** Every offer id, in record order (the cohort reader prints them in this order). */
export const OFFER_IDS = Object.keys(OFFERS) as OfferId[];

/** The non-ambiguous code alphabet server/referral.ts mints from (no 0/O/1/I). */
const CODE_BODY = /^[2-9A-HJ-NP-Z]{8}$/;
export const REFERRAL_CODE_PREFIX = "ARBOR-";

/**
 * A code as a parent might type it ("arbor-abcd efgh", "ABCDEFGH", with
 * spaces or dashes) in the form the server minted ("ARBOR-ABCDEFGH"). Anything
 * that is not a well-formed code comes back trimmed and upper-cased, so an
 * unknown code still fails as unknown rather than being reshaped into a real
 * one.
 */
export function normalizeOfferCode(raw: string): string {
  const upper = String(raw ?? "").trim().toUpperCase();
  const compact = upper.replace(/[\s-]+/g, "");
  const body = compact.startsWith("ARBOR") ? compact.slice("ARBOR".length) : compact;
  return CODE_BODY.test(body) ? `${REFERRAL_CODE_PREFIX}${body}` : upper;
}

/** The approved offer a normalised code leads to, or null when none does. */
export function offerForCode(code: string): OfferDef | null {
  if (!code.startsWith(REFERRAL_CODE_PREFIX) || !CODE_BODY.test(code.slice(REFERRAL_CODE_PREFIX.length))) return null;
  const offer = OFFERS.referral_month;
  return offer.approved ? offer : null;
}

/** How a family entered the code: the captured `?ref=` link or a typed code. */
export type RedemptionVia = "link" | "typed";
export const redemptionViaOf = (raw: unknown): RedemptionVia => (raw === "typed" ? "typed" : "link");
