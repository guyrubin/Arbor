/**
 * BD-25 — the metric contract, wired through the cohort reader.
 *
 *  · D7, W4 (a value action on day 22–28) and D30 paying, each a numerator
 *    over a MATURED all-start denominator that keeps non-activated and unpaid
 *    households in;
 *  · per source and per offer, so direct, partner and legacy-offer families
 *    never mix;
 *  · Gate A's two halves (50 activated with matured W4, 10 full-price payers);
 *    40 families cannot meet it; an offer holder is not a full-price payer;
 *  · missing data printed every time, unknown never printed as zero;
 *  · the script and the server agree, constant for constant and row for row.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCohortReport,
  scanForbiddenKeys,
  summariseMetricContract,
  type CohortEventDoc,
  type CohortMetricsStore,
  type HouseholdBilling,
  type HouseholdOffer,
  type StoredRollup,
} from "./cohortMetrics.js";
import * as contract from "../lib/metricContract.js";
import * as reportScript from "../../scripts/cohort-report.mjs";

const DAY = 86_400_000;
const NOW = new Date("2026-10-28T09:00:00.000Z");
const AS_OF = "2026-10-28";
const iso = (daysAgo: number, hour = 9) => new Date(Date.UTC(2026, 9, 28 - daysAgo, hour)).toISOString();
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);

const rollup = (uid: string, startedDaysAgo: number, source = "instagram"): StoredRollup =>
  ({ uid, source, market: "il", firstSeen: day(startedDaysAgo), activeDays: [day(startedDaysAgo)], cohort: "family" });
/** An event `dayAfterStart` days after a household that started `startedDaysAgo` days ago. */
const at = (uid: string, event: string, startedDaysAgo: number, dayAfterStart: number): CohortEventDoc =>
  ({ uid, event, at: iso(startedDaysAgo - dayAfterStart), props: { source: "instagram", market: "il" } });

/**
 *  h5   5 days old: in no denominator yet.
 *  h10  10 days old, activated: D7 1 of 2 with h12.
 *  h12  12 days old, never activated, never paid (still in the D7 denominator).
 *  h29  29 days old, activated, value action on day 23: W4 yes; D30 not matured.
 *  h31  31 days old (practitioner), value on day 15 and a session on day 25 only: W4 no; pays full price.
 *  h40  40 days old (referral), activated, value on day 28, redeemed the referral month and pays: not full price.
 */
const ROLLUPS = [rollup("h5", 5), rollup("h10", 10), rollup("h12", 12), rollup("h29", 29), rollup("h31", 31, "practitioner"), rollup("h40", 40, "referral")];
const EVENTS = [
  at("h10", "activated", 10, 2),
  at("h29", "activated", 29, 3),
  at("h29", "today_action_outcome", 29, 23),
  at("h31", "capture_saved", 31, 15),
  at("h31", "session_open", 31, 25),
  at("h40", "activated", 40, 4),
  at("h40", "keep_this", 40, 28),
];
const OFFERS: HouseholdOffer[] = [{ uid: "h40", offerId: "referral_month" }];
const BILLING: HouseholdBilling[] = [
  { uid: "h31", billed: true, paying: true, lapsed: false },
  { uid: "h40", billed: true, paying: true, lapsed: false },
];
const input = (over: Partial<Parameters<typeof summariseMetricContract>[0]> = {}) =>
  ({ rollups: ROLLUPS, events: EVENTS, offers: OFFERS, billing: BILLING, groupBy: "source" as const, asOfDay: AS_OF, ...over });

describe("BD-25 — matured all-start denominators", () => {
  it("D7, W4 and D30 paying count households over every start old enough to be asked", () => {
    const c = summariseMetricContract(input());
    expect(c.overall).toEqual({
      key: "all",
      starts: 6,
      d7: { n: 3, of: 5 }, // h10, h29, h40 of h10, h12, h29, h31, h40
      w4: { n: 2, of: 3 }, // h29 (day 23), h40 (day 28) of h29, h31, h40; h31's day 15 and its session do not count
      d30Paying: { n: 2, of: 2 }, // h31 and h40 of h31, h40
    });
  });

  it("sources and offers stay apart: a referral-month payer is not a full-price payer", () => {
    const c = summariseMetricContract(input());
    expect(c.byGroup.map((r) => r.key)).toEqual(["instagram", "practitioner", "referral"]);
    expect(c.byGroup.find((r) => r.key === "practitioner")).toMatchObject({ starts: 1, w4: { n: 0, of: 1 }, d30Paying: { n: 1, of: 1 } });
    expect(c.byOffer.map((r) => [r.key, r.starts])).toEqual([["referral_month", 1], ["founding_family", 0], ["none", 5]]);
    expect(c.gateA.fullPricePayers).toEqual({ n: 1, required: 10 });
  });

  it("Gate A needs both halves on matured families; 40 families cannot meet it", () => {
    const families = (count: number) => Array.from({ length: count }, (_, i) => rollup(`g${i}`, 35));
    const activatedAll = (count: number) => Array.from({ length: count }, (_, i) => at(`g${i}`, "activated", 35, 2));
    const payers = (count: number) => Array.from({ length: count }, (_, i) => ({ uid: `g${i}`, billed: true, paying: true, lapsed: false }));
    const forty = summariseMetricContract(input({ rollups: families(40), events: activatedAll(40), offers: [], billing: payers(40) }));
    expect(forty.gateA).toMatchObject({ activatedMaturedW4: { n: 40, required: 50 }, met: false });
    const fifty = summariseMetricContract(input({ rollups: families(50), events: activatedAll(50), offers: [], billing: payers(10) }));
    expect(fifty.gateA).toEqual({ activatedMaturedW4: { n: 50, required: 50 }, fullPricePayers: { n: 10, required: 10 }, met: true });
    // Young families are not yet W4 observations, however activated.
    const young = summariseMetricContract(input({ rollups: Array.from({ length: 60 }, (_, i) => rollup(`g${i}`, 20)), events: activatedAll(60), offers: [], billing: payers(60) }));
    expect(young.gateA.activatedMaturedW4.n).toBe(0);
    expect(young.gateA.met).toBe(false);
  });

  it("what was not read is unknown, never zero, and the standing gaps are always listed", () => {
    const c = summariseMetricContract(input({ billing: null, offers: null, eventsTruncated: true }));
    expect(c.overall.d30Paying).toBeNull();
    expect(c.gateA.fullPricePayers.n).toBeNull();
    expect(c.gateA.met).toBeNull();
    expect(c.missing.slice(0, 3)).toEqual([...contract.STANDING_MISSING_DATA]);
    expect(c.missing.join("\n")).toMatch(/offers: .*not read[\s\S]*billing: .*not read[\s\S]*events: the scan hit its ceiling/);
    expect(summariseMetricContract(input()).missing).toEqual([...contract.STANDING_MISSING_DATA]);
  });

  it("the cohort route carries the contract, and no key in it is forbidden", async () => {
    const store: CohortMetricsStore = {
      mode: "firestore",
      listRetentionRollups: async () => ROLLUPS,
      listEvents: async () => EVENTS,
      listOfferRedemptions: async () => OFFERS,
      listBillingStates: async () => BILLING,
    };
    const report = await buildCohortReport(store, { since: iso(60), now: NOW });
    expect(report.contract.overall.d7).toEqual({ n: 3, of: 5 });
    expect(report.contract.version).toBe(contract.METRIC_CONTRACT_VERSION);
    expect(scanForbiddenKeys(report.contract)).toEqual([]);
    expect(JSON.stringify(report.contract)).not.toMatch(/"h\d+"/);
  });
});

describe("BD-25 — one contract, two readers", () => {
  it("the script restates every constant of lib/metricContract.ts", () => {
    expect(reportScript.METRIC_CONTRACT_VERSION).toBe(contract.METRIC_CONTRACT_VERSION);
    expect(reportScript.MATURITY_DAYS).toEqual(contract.MATURITY_DAYS);
    expect(reportScript.W4_DAYS).toEqual(contract.W4_DAYS);
    expect(reportScript.VALUE_EVENTS).toEqual([...contract.VALUE_EVENTS]);
    expect(reportScript.GATE_A).toEqual(contract.GATE_A);
    expect(reportScript.MEASURE_DEFINITIONS).toEqual(contract.MEASURE_DEFINITIONS);
    expect(reportScript.STANDING_MISSING_DATA).toEqual([...contract.STANDING_MISSING_DATA]);
  });

  it("W4's value actions are lib/activation.ts's loop events, read from its SOURCE", () => {
    const src = readFileSync(path.resolve(__dirname, "..", "lib", "activation.ts"), "utf8");
    const declared = src.match(/ACTIVATION_LOOP_EVENTS\s*=\s*\[([\s\S]*?)\]/)![1];
    const names = [...declared.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect([...contract.VALUE_EVENTS]).toEqual(names);
  });

  it("server and script compute the same contract on one fixture, by source and by market", () => {
    for (const groupBy of ["source", "market"] as const) {
      for (const over of [{}, { billing: null }, { offers: null, eventsTruncated: true }, { startedSince: day(30) }]) {
        expect(reportScript.summariseMetricContract(input({ groupBy, ...over }))).toEqual(summariseMetricContract(input({ groupBy, ...over })));
      }
    }
  });

  it("prints numerator of denominator, 'not answerable yet' on an empty one, and every missing line", () => {
    const c = summariseMetricContract(input());
    const printed = reportScript.print({ generatedAt: "x", since: "s", asOfDay: AS_OF, groupBy: "source", scanned: { rollups: 6, events: 7, mode: "m" }, contract: c }, { sections: new Set(["contract"]) });
    expect(printed).toContain("all              starts    6  ·  D7 3 of 5  ·  60%  ·  W4 2 of 3  ·  66.7%  ·  D30 paying 2 of 2  ·  100%");
    expect(printed).toContain("founding_family  starts    0  ·  D7 0 of 0  ·  not answerable yet");
    expect(printed).toContain("Gate A: activated with matured W4 2 of 50 needed  ·  full-price payers 1 of 10 needed  ·  not met");
    for (const m of contract.STANDING_MISSING_DATA) expect(printed).toContain(m);
    expect(printed).not.toMatch(/ of 0  ·  \d/); // no percentage on an empty denominator
    expect(printed).toContain("practitioner     starts    1  ·  D7 0 of 1  ·  0%"); // a real zero is a real zero
    const unread = reportScript.print({ generatedAt: "x", since: "s", asOfDay: AS_OF, groupBy: "source", scanned: { rollups: 6, events: 7, mode: "m" }, contract: summariseMetricContract(input({ billing: null })) }, { sections: new Set(["contract"]) });
    expect(unread).toContain("D30 paying unknown (not read)");
    expect(unread).toContain("full-price payers unknown of 10 needed  ·  not answerable yet");
  });
});
