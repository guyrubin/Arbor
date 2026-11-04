/**
 * B-GROWTH-43 — the cohort reader's household line: families that started in
 * the window → the offer each redeemed → activated → paying, per source.
 *
 *  · three families from three sources reproduce the line, end to end through
 *    the real referral store (the redemption) and the billing reduction;
 *  · the denominator is every start, including a family that never activated
 *    and never paid;
 *  · a second redemption is refused, so a family counts under one offer;
 *  · server and script compute the same line on one fixture, and the script
 *    prints counts with their denominator, never a rate;
 *  · records that were not read print as unknown, never as zero;
 *  · no forbidden key and no uid leaves the report.
 */
import { describe, expect, it } from "vitest";
import {
  OFFER_REDEMPTIONS_COLLECTION,
  billingStateOf,
  buildCohortReport,
  foldCoParents,
  scanForbiddenKeys,
  summariseHouseholds,
  type CohortEventDoc,
  type CohortMetricsStore,
  type HouseholdBilling,
  type HouseholdOffer,
  type StoredRollup,
  withLegacyRedemptions,
} from "./cohortMetrics.js";
import { applyBillingMoney, recordFromRevenueCat, type RevenueCatEvent } from "./billing.js";
import { LocalReferralStore, OFFER_REDEMPTIONS_COLLECTION as REFERRAL_COLLECTION, legacyRedemptionsFromLedgers } from "./referral.js";
import { isStaleBillingEvent, type EntitlementRecord, type EntitlementStore } from "./entitlements.js";
import { OFFER_IDS } from "../lib/offers.js";
import * as reportScript from "../../scripts/cohort-report.mjs";

const DAY = 86_400_000;
const NOW = new Date("2026-10-28T09:00:00.000Z");
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);

class FakeEntitlements implements EntitlementStore {
  records = new Map<string, EntitlementRecord>();
  async getPlan(uid: string) { return this.records.get(uid)?.plan ?? null; }
  async getRecord(uid: string) { return this.records.get(uid) ?? null; }
  async setEntitlement(uid: string, record: EntitlementRecord) { this.records.set(uid, record); }
}

const rollup = (uid: string, source: string, startedDaysAgo: number, over: Partial<StoredRollup> = {}): StoredRollup => ({
  uid, source, market: "il", firstSeen: day(startedDaysAgo), activeDays: [day(startedDaysAgo)], cohort: "family", ...over,
});
const ev = (uid: string, event: string, daysAgo: number, source: string): CohortEventDoc => ({ uid, event, at: iso(daysAgo), props: { source, market: "il" } });

/** Three families, three sources, plus a fourth start that never activated or paid. */
async function fixture() {
  const ent = new FakeEntitlements();
  const referrals = new LocalReferralStore("salt", 5, ent);
  const parentCode = await referrals.codeForUid("fam-referrer");
  const practitionerCode = await referrals.codeForUid("fam-practitioner-account");
  // fam-p came by a practitioner's link and typed nothing; fam-r by a parent's invite, typed.
  expect(await referrals.activateReferral({ code: practitionerCode, redeemerUid: "fam-p" })).toMatchObject({ status: "granted" });
  expect(await referrals.activateReferral({ code: parentCode.toLowerCase(), redeemerUid: "fam-r", via: "typed" })).toMatchObject({ status: "granted" });
  // fam-r tries a second code on another device: refused, still one offer.
  expect(await referrals.activateReferral({ code: practitionerCode, redeemerUid: "fam-r" })).toEqual({ ok: true, status: "already_activated" });

  // Billing: fam-p pays on the web; fam-i paid in the App Store and was refunded; fam-r holds only its comp month.
  ent.records.set("fam-p", { plan: "plus", status: "active", provider: "stripe", productId: "plus_monthly", willRenew: true, currentPeriodEnd: iso(-20) });
  ent.records.set("fam-i", { plan: "free", status: "expired", provider: "app_store", productId: "plus_monthly", willRenew: false, currentPeriodEnd: iso(3) });

  const uids = ["fam-p", "fam-r", "fam-i", "fam-q"];
  const offers: HouseholdOffer[] = [];
  for (const uid of uids) {
    const r = await referrals.familyRedemption(uid);
    if (r) offers.push({ uid, offerId: r.offerId });
  }
  const billing: HouseholdBilling[] = uids.map((uid) => ({ uid, ...billingStateOf(ent.records.get(uid) ?? null, NOW.getTime()) }));
  const rollups = [
    rollup("fam-p", "practitioner", 12),
    rollup("fam-r", "referral", 10),
    rollup("fam-i", "instagram", 9),
    rollup("fam-q", "instagram", 4),
    rollup("fam-old", "instagram", 40), // started before the window: not in the line
    rollup("fam-staff", "direct", 5, { cohort: "internal" }),
  ];
  const events = [
    ev("fam-p", "onboarding_completed", 12, "practitioner"),
    ev("fam-p", "activated", 11, "practitioner"),
    ev("fam-r", "activated", 9, "referral"),
    ev("fam-i", "activated", 8, "instagram"),
    ev("fam-q", "onboarding_completed", 4, "instagram"),
    ev("fam-staff", "activated", 4, "direct"),
  ];
  return { rollups, events, offers, billing };
}

const store = (f: Awaited<ReturnType<typeof fixture>>, withReads = true): CohortMetricsStore => ({
  mode: "firestore",
  listRetentionRollups: async () => f.rollups,
  listEvents: async () => f.events,
  ...(withReads ? { listOfferRedemptions: async () => f.offers, listBillingStates: async () => f.billing } : {}),
});

describe("B-GROWTH-43 — the household line", () => {
  it("three families from three sources reproduce source → offer → activated → paying, over every start", async () => {
    const f = await fixture();
    const report = await buildCohortReport(store(f), { since: iso(14), now: NOW });
    const line = (key: string) => report.households.lines.find((l) => l.key === key);
    expect(report.households.offersRead && report.households.billingRead).toBe(true);
    expect(line("practitioner")).toEqual({
      key: "practitioner", households: 1, activated: 1, paying: 1, lapsed: 0, refunded: 0,
      netPaid: { gap: "unpriced", households: 1 },
      offers: [
        { offer: "referral_month", households: 1, refunded: 0, netPaid: { gap: "unpriced", households: 1 } },
        { offer: "founding_family", households: 0, refunded: 0, netPaid: { gap: null, figures: [] } },
        { offer: "none", households: 0, refunded: 0, netPaid: { gap: null, figures: [] } },
      ],
    });
    expect(line("referral")).toMatchObject({ households: 1, activated: 1, paying: 0, lapsed: 0 });
    expect(line("referral")!.offers[0]).toEqual({ offer: "referral_month", households: 1, refunded: 0, netPaid: { gap: null, figures: [] } });
    // content (instagram, BD-37 channel): one refunded payer and one family that never activated or paid — both in the denominator.
    expect(line("content")).toMatchObject({ households: 2, activated: 1, paying: 0, lapsed: 1 });
    expect(line("content")!.offers.find((o) => o.offer === "none")).toEqual({ offer: "none", households: 2, refunded: 0, netPaid: { gap: "unpriced", households: 1 } });
    // The internal account and the family that started before the window are not in any line.
    expect(line("direct")).toBeUndefined();
    expect(report.households.lines.reduce((n, l) => n + l.households, 0)).toBe(4);
  });

  it("a family counts under exactly one offer, however many codes it tried", async () => {
    const f = await fixture();
    const h = summariseHouseholds(f.rollups, f.events, f.offers, f.billing, "source");
    const redeemed = h.lines.flatMap((l) => l.offers).filter((o) => o.offer !== "none").reduce((n, o) => n + o.households, 0);
    expect(redeemed).toBe(2);
  });

  it("billing is reduced to booleans: a comp month is not billed, a store trial is not paying", () => {
    const now = NOW.getTime();
    const bare = { refunded: false, money: null as null, unpriced: false };
    expect(billingStateOf({ plan: "plus", provider: "comp", productId: "referral_month", willRenew: false, currentPeriodEnd: iso(-30) }, now)).toEqual({ billed: false, paying: false, lapsed: false, ...bare });
    expect(billingStateOf({ plan: "plus", provider: "app_store", status: "in_trial", willRenew: true, currentPeriodEnd: iso(-3) }, now)).toEqual({ billed: true, paying: false, lapsed: false, ...bare, unpriced: true });
    expect(billingStateOf({ plan: "plus", provider: "stripe", status: "canceled", willRenew: false, currentPeriodEnd: iso(2) }, now)).toEqual({ billed: true, paying: false, lapsed: true, ...bare, unpriced: true });
    expect(billingStateOf(null, now)).toEqual({ billed: false, paying: false, lapsed: false, ...bare });
  });

  it("a store without the offer and billing reads says so: unknown, never zero", async () => {
    const f = await fixture();
    const report = await buildCohortReport(store(f, false), { since: iso(14), now: NOW });
    expect(report.households.offersRead).toBe(false);
    expect(report.households.billingRead).toBe(false);
    const printed = reportScript.print({ ...report, scanned: { rollups: 0, events: 0, mode: "m" } }, { sections: new Set(["households"]) });
    expect(printed).toContain("offer columns are unknown, not zero");
    expect(printed).toContain("paying, lapsed, refunded and net paid are unknown, not zero");
  });

  it("no forbidden key and no uid leaves the report", async () => {
    const f = await fixture();
    const report = await buildCohortReport(store(f), { since: iso(14), now: NOW });
    expect(scanForbiddenKeys(report.households)).toEqual([]);
    expect(JSON.stringify(report.households)).not.toMatch(/fam-/);
  });
});

describe("B-GROWTH-43 — families that redeemed before the claim existed", () => {
  it("a family a referrer ledger credits counts under the referral month, never as full price", () => {
    const offers = withLegacyRedemptions([{ uid: "fam-new", offerId: "referral_month" }], legacyRedemptionsFromLedgers([{ activatedBy: ["fam-old", "fam-new"] }]));
    expect(offers).toEqual([{ uid: "fam-new", offerId: "referral_month" }, { uid: "fam-old", offerId: "referral_month" }]);
    expect(reportScript.withLegacyRedemptions([{ uid: "fam-new", offerId: "referral_month" }], [{ activatedBy: ["fam-old", "fam-new"] }])).toEqual(offers);
    const rollups = [rollup("fam-old", "referral", 40)];
    const billing = [{ uid: "fam-old", billed: true, paying: true, lapsed: false }];
    const h = summariseHouseholds(rollups, [], offers, billing, "source");
    expect(h.lines[0].offers.find((o) => o.offer === "referral_month")!.households).toBe(1);
  });
});

describe("B-GROWTH-43 — the script and the server agree", () => {
  it("on the household line, the billing reduction, the offer ids and the collection", async () => {
    const f = await fixture();
    for (const groupBy of ["source", "market", "channel"] as const) {
      expect(reportScript.summariseHouseholds(f.rollups, f.events, f.offers, f.billing, groupBy, day(14)))
        .toEqual(summariseHouseholds(f.rollups, f.events, f.offers, f.billing, groupBy, day(14)));
    }
    const rec: EntitlementRecord = { plan: "plus", provider: "play_store", status: "active", willRenew: false, currentPeriodEnd: iso(1) };
    expect(reportScript.billingStateOf(rec, NOW.getTime())).toEqual(billingStateOf(rec, NOW.getTime()));
    expect(reportScript.OFFER_IDS).toEqual(OFFER_IDS);
    expect(reportScript.OFFER_REDEMPTIONS_COLLECTION).toBe(OFFER_REDEMPTIONS_COLLECTION);
    expect(REFERRAL_COLLECTION).toBe(OFFER_REDEMPTIONS_COLLECTION);
  });

  it("prints each count with its denominator and no rate; an empty window is not answerable", async () => {
    const f = await fixture();
    const households = summariseHouseholds(f.rollups, f.events, f.offers, f.billing, "source", day(14));
    const printed = reportScript.print(
      { generatedAt: "x", since: "s", asOfDay: "d", groupBy: "source", scanned: { rollups: 6, events: 6, mode: "m" }, households },
      { sections: new Set(["households"]) },
    );
    expect(printed).toContain(`${"instagram".padEnd(14)} started 2  ·  offer [referral_month 0 net 0, founding_family 0 net 0, none 2 net gap]  →  activated 1 of 2  →  paying 0 of 2  ·  lapsed 1  ·  refunded 0  ·  net paid gap (1 unpriced)`);
    expect(printed).not.toMatch(/%/);
    const empty = reportScript.print(
      { generatedAt: "x", since: "s", asOfDay: "d", groupBy: "source", scanned: { rollups: 0, events: 0, mode: "m" }, households: summariseHouseholds([], [], [], [], "source") },
      { sections: new Set(["households"]) },
    );
    expect(empty).toContain("no family started in the window — not answerable yet");
  });
});

describe("B-GROWTH-43 — refunds and net paid", () => {
  const T0 = Date.parse("2026-10-01T10:00:00.000Z");
  const DAY_MS = 86_400_000;
  const asOf = T0 + 40 * DAY_MS;
  // The same pipeline the webhook runs: map, skip a stale delivery, then fold money.
  const replay = (events: RevenueCatEvent[]) => {
    let doc: EntitlementRecord | null = null;
    for (const event of events) {
      const mapped = recordFromRevenueCat(event);
      if (!mapped || isStaleBillingEvent(doc, mapped.record)) continue;
      const withMoney = applyBillingMoney(doc, event, mapped.record);
      const clean = Object.fromEntries(Object.entries(withMoney).filter(([, v]) => v !== undefined));
      doc = { ...(doc ?? {}), ...clean } as EntitlementRecord;
    }
    return doc;
  };
  const evt = (uid: string, type: string, ts: number, over: Record<string, unknown> = {}): RevenueCatEvent => ({
    id: `evt-${type}-${uid}-${ts}`,
    type,
    app_user_id: uid,
    original_app_user_id: uid,
    product_id: "arbor_plus_monthly",
    entitlement_ids: ["plus"],
    period_type: "NORMAL",
    store: "APP_STORE",
    environment: "PRODUCTION",
    event_timestamp_ms: ts,
    expiration_at_ms: T0 + 30 * DAY_MS,
    currency: "EUR",
    price_in_purchased_currency: 12.99,
    ...over,
  });
  const state = (doc: EntitlementRecord | null) => billingStateOf(doc, asOf);
  const eur = (grossMinor: number, refundedMinor: number) => ({
    currency: "EUR", exponent: 2, grossMinor, refundedMinor, netMinor: grossMinor - refundedMinor,
  });

  it("a refund is its own signal, and net paid is gross minus that refund in the purchased currency", () => {
    const paid = replay([evt("fam-paid", "INITIAL_PURCHASE", T0)]);
    const refunded = replay([
      evt("fam-refund", "INITIAL_PURCHASE", T0),
      evt("fam-refund", "CANCELLATION", T0 + 5 * DAY_MS, { cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + 5 * DAY_MS, price_in_purchased_currency: -12.99 }),
    ]);
    expect(state(paid)).toMatchObject({ billed: true, paying: true, lapsed: false, refunded: false, unpriced: false, money: eur(1299, 0) });
    expect(state(refunded)).toMatchObject({ billed: true, paying: false, lapsed: true, refunded: true, unpriced: false, money: eur(1299, 1299) });
    // Type REFUND revokes the same way: the amount is the refund, not a second charge.
    const byType = replay([
      evt("fam-type", "INITIAL_PURCHASE", T0),
      evt("fam-type", "REFUND", T0 + 5 * DAY_MS, { expiration_at_ms: T0 + 5 * DAY_MS, price_in_purchased_currency: -12.99 }),
    ]);
    expect(state(byType).refunded).toBe(true);
    expect(state(byType).money).toEqual(eur(1299, 1299));

    const billing: HouseholdBilling[] = [
      { uid: "fam-paid", ...state(paid) },
      { uid: "fam-refund", ...state(refunded) },
    ];
    const offers = [{ uid: "fam-refund", offerId: "referral_month" }];
    const rollups = [rollup("fam-paid", "instagram", 20), rollup("fam-refund", "instagram", 20)];
    const line = summariseHouseholds(rollups, [], offers, billing, "source").lines[0];
    expect(line).toMatchObject({ households: 2, paying: 1, lapsed: 1, refunded: 1, netPaid: { gap: null, figures: [eur(2598, 1299)] } });
    expect(line.offers.find((o) => o.offer === "none")).toMatchObject({ households: 1, refunded: 0, netPaid: { gap: null, figures: [eur(1299, 0)] } });
    expect(line.offers.find((o) => o.offer === "referral_month")).toMatchObject({ households: 1, refunded: 1, netPaid: { gap: null, figures: [eur(1299, 1299)] } });
    const printed = reportScript.print(
      { generatedAt: "x", since: "s", asOfDay: "d", groupBy: "source", scanned: { rollups: 2, events: 0, mode: "m" }, households: summariseHouseholds(rollups, [], offers, billing, "source") },
      { sections: new Set(["households"]) },
    );
    expect(printed).toContain("refunded 1");
    expect(printed).toContain("net paid EUR 12.99 (gross 25.98, refunded 12.99)");
    expect(printed).toContain("referral_month 1 net EUR 0.00 refunded 1");
    expect(printed).not.toMatch(/%/);
    expect(reportScript.summariseHouseholds(rollups, [], offers, billing, "source")).toEqual(summariseHouseholds(rollups, [], offers, billing, "source"));
    expect(scanForbiddenKeys(line)).toEqual([]);
    expect(JSON.stringify(line)).not.toMatch(/fam-/);
  });

  it("two purchased currencies on one row stay apart", () => {
    const eurPaid = replay([evt("fam-eur", "INITIAL_PURCHASE", T0)]);
    const ilsPaid = replay([evt("fam-ils", "INITIAL_PURCHASE", T0, { currency: "ILS", price_in_purchased_currency: 47.9 })]);
    const billing: HouseholdBilling[] = [
      { uid: "fam-eur", ...state(eurPaid) },
      { uid: "fam-ils", ...state(ilsPaid) },
    ];
    const rollups = [rollup("fam-eur", "direct", 12), rollup("fam-ils", "direct", 12)];
    const line = summariseHouseholds(rollups, [], null, billing, "source").lines[0];
    expect(line.netPaid).toEqual({
      gap: null,
      figures: [eur(1299, 0), { currency: "ILS", exponent: 2, grossMinor: 4790, refundedMinor: 0, netMinor: 4790 }],
    });
    expect(line.offers.find((o) => o.offer === "none")!.netPaid).toEqual(line.netPaid);
    expect(reportScript.summariseHouseholds(rollups, [], null, billing, "source")).toEqual(summariseHouseholds(rollups, [], null, billing, "source"));
  });

  it("a refund reversal puts the amount back and clears the refunded flag", () => {
    const doc = replay([
      evt("fam-r", "INITIAL_PURCHASE", T0),
      evt("fam-r", "CANCELLATION", T0 + 5 * DAY_MS, { cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + 5 * DAY_MS, price_in_purchased_currency: -12.99 }),
      evt("fam-r", "REFUND_REVERSED", T0 + 6 * DAY_MS, { expiration_at_ms: T0 + 30 * DAY_MS, price_in_purchased_currency: 12.99 }),
    ]);
    expect(state(doc)).toMatchObject({ paying: true, lapsed: false, refunded: false, money: eur(1299, 0) });
    expect(reportScript.billingStateOf(doc, asOf)).toEqual(state(doc));
  });

  it("a refund during a store trial is refunded at the trial's price, which is zero — not a list-price guess", () => {
    const doc = replay([
      evt("fam-t", "INITIAL_PURCHASE", T0, { period_type: "TRIAL", price_in_purchased_currency: 0, expiration_at_ms: T0 + 7 * DAY_MS }),
      evt("fam-t", "CANCELLATION", T0 + 2 * DAY_MS, { period_type: "TRIAL", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + 2 * DAY_MS, price_in_purchased_currency: 0 }),
    ]);
    expect(state(doc)).toMatchObject({ billed: true, paying: false, lapsed: true, refunded: true, unpriced: false, money: eur(0, 0) });
    // The same cancellation with no amount is a gap. It is not filled from the Plus price.
    const unpriced = replay([
      evt("fam-u", "INITIAL_PURCHASE", T0, { period_type: "TRIAL", price_in_purchased_currency: null, currency: null, expiration_at_ms: T0 + 7 * DAY_MS }),
      evt("fam-u", "CANCELLATION", T0 + 2 * DAY_MS, { period_type: "TRIAL", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + 2 * DAY_MS, price_in_purchased_currency: null, currency: null }),
    ]);
    expect(state(unpriced)).toMatchObject({ refunded: true, paying: false, money: null, unpriced: true });
    const legacy = applyBillingMoney(
      { plan: "plus", status: "active", provider: "app_store", willRenew: true },
      evt("fam-old", "RENEWAL", T0, { price_in_purchased_currency: 12.99 }),
      recordFromRevenueCat(evt("fam-old", "RENEWAL", T0, { price_in_purchased_currency: 12.99 }))!.record,
    );
    expect(legacy.billingUnpriced).toBe(true);
    expect(legacy.grossMinor).toBeUndefined();
    expect(state(legacy).money).toBeNull();
    const legacyRefund = applyBillingMoney(
      { plan: "plus", status: "active", provider: "stripe", willRenew: true },
      evt("fam-old", "CANCELLATION", T0 + DAY_MS, { cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + DAY_MS, price_in_purchased_currency: -12.99 }),
      recordFromRevenueCat(evt("fam-old", "CANCELLATION", T0 + DAY_MS, { cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + DAY_MS, price_in_purchased_currency: -12.99 }))!.record,
    );
    expect(state(legacyRefund)).toMatchObject({ refunded: true, money: null, unpriced: true });
    // A store-outage grant is not a charge. The purchase that follows it is the price.
    const granted = applyBillingMoney(null, evt("fam-g", "TEMPORARY_ENTITLEMENT_GRANT", T0, { price_in_purchased_currency: null, currency: null }), recordFromRevenueCat(evt("fam-g", "TEMPORARY_ENTITLEMENT_GRANT", T0, { price_in_purchased_currency: null, currency: null }))!.record);
    const purchased = applyBillingMoney(granted, evt("fam-g", "INITIAL_PURCHASE", T0 + DAY_MS), recordFromRevenueCat(evt("fam-g", "INITIAL_PURCHASE", T0 + DAY_MS))!.record);
    expect(state(purchased).money).toEqual(eur(1299, 0));
    expect(state(purchased).unpriced).toBe(false);
  });

  it("a duplicate webhook does not apply twice, and an older refund delivered late does not change the total", () => {
    const purchase = evt("fam-d", "INITIAL_PURCHASE", T0);
    const renewal = evt("fam-d", "RENEWAL", T0 + 3 * DAY_MS, { expiration_at_ms: T0 + 60 * DAY_MS });
    const lateRefund = evt("fam-d", "CANCELLATION", T0 + 2 * DAY_MS, { cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + 2 * DAY_MS, price_in_purchased_currency: -12.99 });
    const refund = evt("fam-d", "CANCELLATION", T0 + 5 * DAY_MS, { cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + 5 * DAY_MS, price_in_purchased_currency: -12.99 });
    const once = replay([purchase, purchase, renewal, lateRefund]);
    expect(state(once)).toMatchObject({ paying: true, refunded: false, money: eur(2598, 0) });
    const twice = replay([purchase, purchase, renewal, lateRefund, refund, refund]);
    expect(state(twice)).toMatchObject({ paying: false, refunded: true, money: eur(2598, 1299) });
  });

  it("co-parents are one household: paying if either pays, and the refund still reduces net paid", () => {
    const owner = replay([
      evt("owner", "INITIAL_PURCHASE", T0),
      evt("owner", "CANCELLATION", T0 + 5 * DAY_MS, { cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + 5 * DAY_MS, price_in_purchased_currency: -12.99 }),
    ]);
    const coparent = replay([evt("coparent", "INITIAL_PURCHASE", T0, { store: "STRIPE" })]);
    const billing: HouseholdBilling[] = [
      { uid: "owner", ...state(owner) },
      { uid: "coparent", ...state(coparent) },
    ];
    const links = [{ ownerUid: "owner", recipientUid: "coparent" }];
    const rollups = [rollup("owner", "direct", 20), rollup("coparent", "direct", 12)];
    const fold = foldCoParents({ rollups, events: [], offers: [], billing, coParents: links });
    expect(fold.folded).toBe(1);
    expect(fold.billing).toEqual([{
      uid: "owner", billed: true, paying: true, lapsed: false, refunded: true, unpriced: false,
      money: eur(2598, 1299),
    }]);
    expect(reportScript.foldCoParents({ rollups, events: [], offers: [], billing, coParents: links })).toEqual(fold);
    const line = summariseHouseholds(fold.rollups, [], [], fold.billing, "source").lines[0];
    expect(line).toMatchObject({ households: 1, paying: 1, refunded: 1, netPaid: { gap: null, figures: [eur(2598, 1299)] } });

    const ils = replay([evt("coparent-ils", "INITIAL_PURCHASE", T0, { currency: "ILS", price_in_purchased_currency: 47.9 })]);
    const mixed = foldCoParents({
      rollups, events: [], offers: [], coParents: links,
      billing: [{ uid: "owner", ...state(owner) }, { uid: "coparent", ...state(ils) }],
    });
    expect(mixed.billing?.[0]).toMatchObject({ paying: true, refunded: true, money: null, unpriced: true });
    const mixedLine = summariseHouseholds(mixed.rollups, [], [], mixed.billing, "source").lines[0];
    expect(mixedLine.netPaid).toEqual({ gap: "unpriced", households: 1 });
  });
});
