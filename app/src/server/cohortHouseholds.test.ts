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
  scanForbiddenKeys,
  summariseHouseholds,
  type CohortEventDoc,
  type CohortMetricsStore,
  type HouseholdBilling,
  type HouseholdOffer,
  type StoredRollup,
} from "./cohortMetrics.js";
import { LocalReferralStore, OFFER_REDEMPTIONS_COLLECTION as REFERRAL_COLLECTION } from "./referral.js";
import type { EntitlementRecord, EntitlementStore } from "./entitlements.js";
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
      key: "practitioner", households: 1, activated: 1, paying: 1, lapsed: 0,
      offers: [{ offer: "referral_month", households: 1 }, { offer: "founding_family", households: 0 }, { offer: "none", households: 0 }],
    });
    expect(line("referral")).toMatchObject({ households: 1, activated: 1, paying: 0, lapsed: 0 });
    expect(line("referral")!.offers[0]).toEqual({ offer: "referral_month", households: 1 });
    // content (instagram, BD-37 channel): one refunded payer and one family that never activated or paid — both in the denominator.
    expect(line("content")).toMatchObject({ households: 2, activated: 1, paying: 0, lapsed: 1 });
    expect(line("content")!.offers.find((o) => o.offer === "none")).toEqual({ offer: "none", households: 2 });
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
    expect(billingStateOf({ plan: "plus", provider: "comp", productId: "referral_month", willRenew: false, currentPeriodEnd: iso(-30) }, now)).toEqual({ billed: false, paying: false, lapsed: false });
    expect(billingStateOf({ plan: "plus", provider: "app_store", status: "in_trial", willRenew: true, currentPeriodEnd: iso(-3) }, now)).toEqual({ billed: true, paying: false, lapsed: false });
    expect(billingStateOf({ plan: "plus", provider: "stripe", status: "canceled", willRenew: false, currentPeriodEnd: iso(2) }, now)).toEqual({ billed: true, paying: false, lapsed: true });
    expect(billingStateOf(null, now)).toEqual({ billed: false, paying: false, lapsed: false });
  });

  it("a store without the offer and billing reads says so: unknown, never zero", async () => {
    const f = await fixture();
    const report = await buildCohortReport(store(f, false), { since: iso(14), now: NOW });
    expect(report.households.offersRead).toBe(false);
    expect(report.households.billingRead).toBe(false);
    const printed = reportScript.print({ ...report, scanned: { rollups: 0, events: 0, mode: "m" } }, { sections: new Set(["households"]) });
    expect(printed).toContain("offer columns are unknown, not zero");
    expect(printed).toContain("paying and lapsed are unknown, not zero");
  });

  it("no forbidden key and no uid leaves the report", async () => {
    const f = await fixture();
    const report = await buildCohortReport(store(f), { since: iso(14), now: NOW });
    expect(scanForbiddenKeys(report.households)).toEqual([]);
    expect(JSON.stringify(report.households)).not.toMatch(/fam-/);
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
    expect(printed).toContain("instagram      started 2  ·  offer [referral_month 0, founding_family 0, none 2]  →  activated 1 of 2  →  paying 0 of 2  ·  lapsed 1");
    expect(printed).not.toMatch(/%/);
    const empty = reportScript.print(
      { generatedAt: "x", since: "s", asOfDay: "d", groupBy: "source", scanned: { rollups: 0, events: 0, mode: "m" }, households: summariseHouseholds([], [], [], [], "source") },
      { sections: new Set(["households"]) },
    );
    expect(empty).toContain("no family started in the window — not answerable yet");
  });
});
