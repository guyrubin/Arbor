/**
 * BD-37 — the acquisition source is carried through trial and payment.
 *
 *  · every household that starts (and so starts its trial, BD-53) is grouped
 *    by the channel of its first touch; the paying and lapsed columns come from
 *    the server's billing record joined by uid, so payment carries the same
 *    channel without the client having to report it;
 *  · practitioner, centre, presenter, sponsor, studio, founding, a parent's
 *    invite, content, search, the stores and direct stay apart;
 *  · a child's views in Kid Mode are play, never parent demand: a Studio
 *    household whose only events are kid play is not activated, has no W4
 *    value action and is not paying;
 *  · the script restates the channel map; the guard runs both on one table.
 */
import { describe, expect, it } from "vitest";
import {
  buildCohortReport,
  summariseMetricContract,
  type CohortEventDoc,
  type CohortMetricsStore,
  type HouseholdBilling,
  type StoredRollup,
} from "./cohortMetrics.js";
import { ACQUISITION_CHANNELS, channelOfSource } from "../lib/acquisitionChannel.js";
import * as reportScript from "../../scripts/cohort-report.mjs";

const NOW = new Date("2026-10-28T09:00:00.000Z");
const iso = (daysAgo: number) => new Date(Date.UTC(2026, 9, 28 - daysAgo, 9)).toISOString();
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);
const rollup = (uid: string, source: string, startedDaysAgo = 35): StoredRollup =>
  ({ uid, source, market: "il", firstSeen: day(startedDaysAgo), activeDays: [day(startedDaysAgo)], cohort: "family" });
const ev = (uid: string, event: string, daysAgo: number, props: Record<string, unknown> = {}): CohortEventDoc => ({ uid, event, at: iso(daysAgo), props });

const SOURCES = ["practitioner", "centre", "presenter", "sponsor", "studio", "founding", "referral", "instagram", "google.com", "appstore", "direct", "somewhere.example"];

describe("BD-37 — channels carried through trial and payment", () => {
  const rollups = SOURCES.map((s, i) => rollup(`h${i}`, s));
  const billing: HouseholdBilling[] = [
    { uid: "h0", billed: true, paying: true, lapsed: false }, // practitioner pays
    { uid: "h3", billed: true, paying: true, lapsed: false }, // sponsor pays
    { uid: "h4", billed: true, paying: false, lapsed: true }, // studio paid, then lapsed
  ];
  const events = [
    ev("h0", "activated", 33),
    // the Studio household: only a child's play
    ev("h4", "book_opened", 10, { kid_mode: true, book_id: "b1" }),
    ev("h4", "game_sitting", 9, { kid_mode: true, game: "mimic" }),
    ev("h4", "book_finished", 12, { kid_mode: true, book_id: "b1" }),
  ];
  const store: CohortMetricsStore = {
    mode: "firestore",
    listRetentionRollups: async () => rollups,
    listEvents: async () => events,
    listOfferRedemptions: async () => [],
    listBillingStates: async () => billing,
  };

  it("every start is one household line per channel, and paying follows the household's first touch", async () => {
    const report = await buildCohortReport(store, { since: iso(60), now: NOW });
    const keys = report.households.lines.map((l) => l.key).sort();
    expect(keys).toEqual([...ACQUISITION_CHANNELS].sort());
    const line = (k: string) => report.households.lines.find((l) => l.key === k)!;
    expect(line("practitioner")).toMatchObject({ households: 1, activated: 1, paying: 1 });
    expect(line("sponsor")).toMatchObject({ households: 1, paying: 1 });
    expect(line("centre")).toMatchObject({ households: 1, paying: 0 });
    expect(report.contract.byChannel.map((r) => r.key)).toEqual([...ACQUISITION_CHANNELS]);
    expect(report.contract.byChannel.find((r) => r.key === "sponsor")!.d30Paying).toEqual({ n: 1, of: 1 });
  });

  it("a child's views are not parent demand: the Studio household stays unactivated, without W4, not paying", async () => {
    const report = await buildCohortReport(store, { since: iso(60), now: NOW });
    expect(report.households.lines.find((l) => l.key === "studio")).toMatchObject({ households: 1, activated: 0, paying: 0, lapsed: 1 });
    const studio = report.contract.byChannel.find((r) => r.key === "studio")!;
    expect(studio).toMatchObject({ starts: 1, d7: { n: 0, of: 1 }, w4: { n: 0, of: 1 }, d30Paying: { n: 0, of: 1 } });
    // Studio is its own channel, never folded into content.
    expect(channelOfSource("studio")).toBe("studio");
  });

  it("the script's channel map and grouping equal the server's", () => {
    expect(reportScript.ACQUISITION_CHANNELS).toEqual([...ACQUISITION_CHANNELS]);
    for (const s of [...SOURCES, "", "LANDING", " l.instagram.com ", "google.co.il", "playstore", "t.co", "notgoogle.com", "Studio"]) {
      expect(reportScript.channelOfSource(s), s).toBe(channelOfSource(s));
    }
    const input = { rollups, events, offers: [], billing, groupBy: "source" as const, asOfDay: "2026-10-28" };
    expect(reportScript.summariseMetricContract(input)).toEqual(summariseMetricContract(input));
    expect(reportScript.summariseHouseholds(rollups, events, [], billing, "channel")).toBeTruthy();
  });

  it("prints the household line and the contract by channel", async () => {
    const report = await buildCohortReport(store, { since: iso(60), now: NOW });
    const printed = reportScript.print({ ...report, scanned: { rollups: 12, events: 4, mode: "m" } }, { sections: new Set(["households", "contract"]) });
    expect(printed).toContain("Households by acquisition channel");
    expect(printed).toContain("by acquisition channel:");
    expect(printed).toMatch(/\n  practitioner +started 1 /);
  });
});
