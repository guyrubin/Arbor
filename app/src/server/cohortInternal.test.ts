/**
 * B-MEAS-01 — founder, comped and smoke accounts are excluded from every
 * cohort number by default.
 *
 * The tag is decided on the SERVER (`cohortTagFor` on /entitlement: env comp
 * list, admin list, or an `@example.com` smoke identity) and copied into the
 * family's rollup as `cohort: "internal"` — never an email. Both readers (the
 * /admin/cohorts route via buildCohortReport, and the lead's
 * cohort-report.mjs) drop internal rollups AND their events, print the
 * excluded count, and take an explicit override.
 *
 * Acceptance fixture: Guy + 1 smoke + 2 families → D1 eligible = 2,
 * "internal excluded: 2".
 */
import { afterAll, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter } from "../routes/api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore, cohortTagFor } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createConsultStore } from "./consultRequests.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { createWaitlistStore } from "./waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import {
  buildCohortReport,
  excludeInternal,
  scanForbiddenKeys,
  type CohortEventDoc,
  type CohortMetricsStore,
  type StoredRollup,
} from "./cohortMetrics.js";
import * as reportScript from "../../scripts/cohort-report.mjs";

const DAY = 86_400_000;
const NOW = new Date("2026-09-15T09:00:00.000Z");
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);

const rollup = (uid: string, cohort: "internal" | "family" | undefined): StoredRollup => ({
  uid,
  ...(cohort ? { cohort } : {}),
  firstSeen: day(10),
  activeDays: [day(10), day(9)],
  source: "organic",
  market: "il",
});

/** Guy (comped founder) + one release-smoke account + two real families
 *  (one written before the tag existed, so it has no cohort field at all). */
const ROLLUPS: StoredRollup[] = [
  rollup("guy-uid", "internal"),
  rollup("smoke-uid", "internal"),
  rollup("family-a", "family"),
  rollup("family-b", undefined),
];
const ev = (uid: string, event: string): CohortEventDoc => ({ uid, event, at: iso(1), props: { source: "organic", market: "il" } });
const EVENTS: CohortEventDoc[] = [
  ev("guy-uid", "paywall_view"),
  ev("smoke-uid", "paywall_view"),
  ev("family-a", "paywall_view"),
  ev("family-b", "paywall_view"),
];

class FakeStore implements CohortMetricsStore {
  readonly mode = "firestore" as const;
  async listRetentionRollups() { return ROLLUPS; }
  async listEvents() { return EVENTS; }
}

describe("B-MEAS-01 · the server decides the tag (never an email in the rollup)", () => {
  it("env comp grant, admin, or @example.com → internal; a referral comp or a store plan → family", () => {
    expect(cohortTagFor({ source: "env" }, { email: "bguy.rubin@gmail.com" }, false)).toBe("internal");
    expect(cohortTagFor({ source: "default" }, { email: "x@gmail.com" }, true)).toBe("internal");
    expect(cohortTagFor({ source: "default" }, { email: "arbor-release-smoke-123@example.com" }, false)).toBe("internal");
    expect(cohortTagFor({ source: "store" }, { email: "parent@gmail.com" }, false)).toBe("family");
    expect(cohortTagFor({ source: "default" }, { email: null }, false)).toBe("family");
    expect(cohortTagFor({ source: "default" }, { email: "someone@notexample.com" }, false)).toBe("family");
  });
});

describe("B-MEAS-01 · buildCohortReport (the /admin/cohorts reader)", () => {
  it("Guy + 1 smoke + 2 families → D1 eligible = 2, internal excluded: 2, their events dropped", async () => {
    const report = await buildCohortReport(new FakeStore(), { since: iso(7), now: NOW, funnels: ["billing"] });
    expect(report.retention.d1.eligible).toBe(2);
    expect(report.internal).toEqual({ excluded: 2, included: false });
    expect(report.scanned.rollups).toBe(2);
    expect(report.eventCensus).toEqual([{ stage: "paywall_view", count: 2 }]);
    expect(scanForbiddenKeys(report)).toEqual([]);
    expect(JSON.stringify(report)).not.toMatch(/guy-uid|smoke-uid|@/);
  });

  it("includeInternal puts them back and says so", async () => {
    const report = await buildCohortReport(new FakeStore(), { since: iso(7), now: NOW, includeInternal: true });
    expect(report.retention.d1.eligible).toBe(4);
    expect(report.internal).toEqual({ excluded: 0, included: true });
  });

  it("excludeInternal: a rollup without a tag is a family", () => {
    const out = excludeInternal(ROLLUPS, EVENTS);
    expect(out.excluded).toBe(2);
    expect(out.rollups.map((r) => r.uid)).toEqual(["family-a", "family-b"]);
    expect(out.events.map((e) => e.uid)).toEqual(["family-a", "family-b"]);
  });
});

describe("B-MEAS-01 · GET /api/admin/cohorts excludes by default, ?includeInternal=1 overrides", () => {
  const servers: Server[] = [];
  afterAll(async () => {
    delete process.env.ARBOR_ADMIN_UIDS;
    await Promise.all(servers.map((s) => new Promise<void>((res, rej) => s.close((e) => (e ? rej(e) : res())))));
  });

  it("route", async () => {
    process.env.ARBOR_ADMIN_UIDS = "founder-uid";
    const config = createTestConfig();
    const entitlementStore = createEntitlementStore(config);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as any).user = { uid: "founder-uid", email: null }; next(); });
    app.use("/api", createApiRouter({
      config,
      modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
      memoryStore: new LocalMemoryStore(),
      shareStore: new LocalShareStore(),
      consentStore: new LocalConsentStore(),
      framework: loadFramework(),
      entitlementStore,
      referralStore: createReferralStore(config, entitlementStore),
      counters: createCounterStore(config),
      consultStore: createConsultStore(config),
      adminMetrics: createAdminMetricsStore(config),
      waitlistStore: createWaitlistStore(config),
      cohortMetricsStore: new FakeStore(),
    }));
    const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const def = await (await fetch(`${base}/api/admin/cohorts`)).json();
    expect(def.internal).toEqual({ excluded: 2, included: false });
    const all = await (await fetch(`${base}/api/admin/cohorts?includeInternal=1`)).json();
    expect(all.internal).toEqual({ excluded: 0, included: true });
    // The /entitlement answer carries the tag, never the email.
    const ent = await (await fetch(`${base}/api/entitlement`)).json();
    expect(["internal", "family"]).toContain(ent.cohort);
    expect(JSON.stringify(ent)).not.toMatch(/@/);
  });
});

describe("B-MEAS-01 · cohort-report.mjs prints the excluded count and takes --include-internal", () => {
  const db = {
    collection: () => ({
      limit: () => ({
        get: async () => ({
          docs: ROLLUPS.map((r) => ({ id: r.uid, data: () => ({ firstSeen: r.firstSeen, activeDays: r.activeDays, source: r.source, market: r.market, ...(r.cohort ? { cohort: r.cohort } : {}) }) })),
        }),
      }),
    }),
    collectionGroup: () => {
      const docs = EVENTS.map((e) => ({ data: () => ({ event: e.event, at: e.at, props: e.props }), ref: { parent: { parent: { id: e.uid } } } }));
      return {
        orderBy: () => ({ limit: () => ({ get: async () => ({ docs }) }) }),
        limit: () => ({ get: async () => ({ docs }) }),
      };
    },
  };

  it("default: D1 eligible = 2 and 'internal excluded: 2' printed; no email or name anywhere", async () => {
    const args = reportScript.parseArgs(["--since", iso(7), "--retention"]);
    expect(args.includeInternal).toBe(false);
    const report = await reportScript.buildReport(db, args, NOW);
    expect(report.retention.d1.eligible).toBe(2);
    expect(report.internal).toEqual({ excluded: 2, included: false });
    const out = reportScript.print(report, args);
    expect(out).toContain("internal excluded: 2");
    expect(reportScript.scanForbiddenKeys(report)).toEqual([]);
    expect(JSON.stringify(report)).not.toMatch(/guy-uid|smoke-uid|@/);
  });

  it("--include-internal: all four families, and the printout says internal accounts are in", async () => {
    const args = reportScript.parseArgs(["--since", iso(7), "--retention", "--include-internal"]);
    expect(args.includeInternal).toBe(true);
    const report = await reportScript.buildReport(db, args, NOW);
    expect(report.retention.d1.eligible).toBe(4);
    expect(reportScript.print(report, args)).toContain("internal included (--include-internal)");
  });
});
