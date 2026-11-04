/**
 * BD-25 — the pilot's metric contract, written once. The cohort reader
 * (server/cohortMetrics.ts summariseMetricContract, GET /api/admin/cohorts)
 * and the lead's command (scripts/cohort-report.mjs --contract) compute and
 * print exactly these measures; the guard pins the script's restatement to
 * this record and to lib/activation.ts by source.
 *
 * Pure: no Firebase, no React, no clock. Nothing here renders on a parent
 * surface (a rate about a family is the firewall's business); the report is a
 * founder command.
 *
 * The rules the contract carries (ROS BD-25, 18 Oct):
 *  - A household is one account (uid): its devices and children collapse into
 *    it, and a co-parent who accepted the family's share folds into the owner's
 *    household (when the share links could not be read, that is listed).
 *  - Denominators are MATURED ALL-START cohorts: every family whose access
 *    began long enough ago for the question to be answerable, including
 *    families that never activated and never paid.
 *  - Direct sources, sponsorship and legacy offers stay separate: every
 *    measure is reported per first-touch source and split by offer.
 *  - D7 first value and W4 are separate measures; neither is the full Parent
 *    support-loop completion (FUNNEL_CHAINS.loop).
 *  - Every measure prints numerator and denominator. What the data cannot
 *    answer prints as missing, never as zero.
 *  - Enrollment, contribution, CAC, capacity and keep/change/stop are Guy's
 *    decisions on top of this readout; nothing here makes them.
 */

export const METRIC_CONTRACT_VERSION = "bd25-2026-10-28";

/** The client event that marks a family's first payment (lib/billingTransition.ts → loopEvents trackPaid). */
export const PAID_EVENT = "paid";

/** The default contract window: households that started in the last 90 days, so
 *  D7, W4 and D30 all have matured cohorts to answer from. */
export const CONTRACT_WINDOW_DAYS = 90;

/** Days from access a household must have lived for each measure to be asked. */
export const MATURITY_DAYS = { d7: 7, w4: 28, d30: 30 } as const;

/** W4 = a value action on any day 22 to 28 after access (week four). */
export const W4_DAYS = { from: 22, to: 28 } as const;

/**
 * The value actions that count for W4: a parent doing something with the
 * record (lib/activation.ts ACTIVATION_LOOP_EVENTS, pinned by source in the
 * guard). Opening the app is not value; screen time is never counted.
 */
export const VALUE_EVENTS = [
  "capture_saved",
  "today_action_accepted",
  "today_action_outcome",
  "keep_this",
  "plan_approved",
] as const;

/** Gate A (One Plan): both halves, on matured families; 40 families alone cannot meet it. */
export const GATE_A = {
  /** Activated families whose W4 has matured. */
  activatedMaturedW4: 50,
  /** Households paying from a store record with no offer redemption. */
  fullPricePayers: 10,
} as const;

/** One sentence per measure, printed beside its number. */
export const MEASURE_DEFINITIONS = {
  d7: "D7 first value: households activated (lib/activation.ts definition) among households whose access began at least 7 days ago",
  w4: "W4: households with a value action (" + VALUE_EVENTS.join(", ") + ") on day 22 to 28 after access, among households whose access began at least 28 days ago",
  d30: "D30 paid: households with a paid event by day 30 after access, confirmed by a store billing record (not a comp), among households whose access began at least 30 days ago",
  offer: "offer: the one offer a household redeemed (lib/offers.ts); a referral past the referrer's cap still counts, the family got its month",
  renewal: "renewal: an actual second charge, including charges outside the D30 window; not restricted to the D30-paid count",
} as const;

/** What the readout cannot answer from the records it reads; printed every time. */
export const STANDING_MISSING_DATA = [
  "renewal (second charge): the entitlement record keeps no charge history; needs the billing export",
  "full price: price, discount and refund are not in the entitlement record; full-price payers here are store payers with no offer, to reconcile against receipts",
] as const;
