import { describe, it, expect, vi, afterEach, afterAll } from "vitest";
import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter } from "../routes/api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createConsultStore } from "./consultRequests.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { createWaitlistStore } from "./waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { cohortRetention as libCohortRetention, type RetentionRollup } from "../lib/retention.js";
import { FUNNEL_EVENTS } from "../lib/attributionFunnel.js";
import {
  EVENT_PROP_ALLOWLIST,
  FORBIDDEN_RESPONSE_KEY,
  FUNNEL_CHAINS,
  NullCohortMetricsStore,
  ACTIVATION_DEFINITION_READER,
  ACTIVATION_WINDOW_DAYS,
  RETENTION_ROLLUP_COLLECTION,
  buildCohortReport,
  countFunnelChain,
  scanForbiddenKeys,
  summariseActivation,
  type CohortEventDoc,
  type CohortMetricsStore,
  type StoredRollup,
} from "./cohortMetrics.js";
// The lead's command. Imported so its printing laws are pinned by the same
// suite that pins the route's — a report whose script and server disagree is
// two dashboards, which is the failure mode this item exists to close.
// @ts-expect-error — a plain .mjs script with no type declarations.
import * as reportScript from "../../scripts/cohort-report.mjs";

/**
 * N1-05 (OBJ-INF-04) — the cross-user reader. Its risk is not that it is
 * wrong; it is that it runs on ADC, which bypasses Firestore rules by design.
 * One careless collectionGroup over a child sub-collection turns the founder's
 * report into a cross-family child-record reader and no existing guard notices
 * (critic C3). Hence: a recursive key scan with a childName negative control,
 * a 403 path that proves ZERO reads were attempted, and a null-rate path that
 * must never print 0%.
 */

const DAY = 86_400_000;
const NOW = new Date("2026-09-15T09:00:00.000Z");
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);

/** Source with every comment removed — a guard that reads a prohibition in a
 *  header as if it were a call site fails for the wrong reason, and the next
 *  person deletes the comment instead of the defect. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const rollup = (firstSeenDaysAgo: number, activeOffsets: number[], over: Partial<StoredRollup> = {}): StoredRollup => ({
  firstSeen: day(firstSeenDaysAgo),
  activeDays: activeOffsets.map((o) => day(firstSeenDaysAgo - o)),
  source: "organic",
  market: "il",
  ...over,
});

const ev = (uid: string, event: string, daysAgo = 0, props: Record<string, unknown> = { source: "organic", market: "il" }): CohortEventDoc =>
  ({ uid, event, at: iso(daysAgo), props });

class FakeStore implements CohortMetricsStore {
  readonly mode = "firestore" as const;
  reads = 0;
  constructor(private readonly rollups: StoredRollup[] = [], private readonly events: CohortEventDoc[] = []) {}
  async listRetentionRollups() { this.reads += 1; return this.rollups; }
  async listEvents() { this.reads += 1; return this.events; }
}

/* ── (b) the recursive key scan, with its negative control ────────────────── */

describe("privacy — no child data can be filed under any key, at any depth", () => {
  it("a fully-populated report carries zero forbidden keys", async () => {
    const report = await buildCohortReport(
      new FakeStore(
        [rollup(40, [0, 1, 7, 28, 30]), rollup(9, [0, 1, 7]), rollup(0, [0])],
        [
          ev("u1", "session_open", 1), ev("u1", "keep_this", 1), ev("u1", "activated", 2),
          ev("u2", "onboarding_completed", 30), ev("u2", "paywall_view", 3),
          ev("u2", "checkout_start", 3), ev("u2", "entitlement_active", 2),
          ev("u3", "kid_session_end", 1), ev("u3", "session_close", 1),
        ],
      ),
      { since: iso(7), now: NOW, funnels: ["acquisition", "billing"] },
    );
    expect(scanForbiddenKeys(report)).toEqual([]);
    // …and it is not empty: an empty object passes every scan.
    expect(report.eventCensus.length).toBeGreaterThan(5);
    expect(Object.keys(report.funnels)).toEqual(["acquisition", "billing"]);
  });

  it("NEGATIVE CONTROL — a fixture carrying childName fails the scan, and names the path", () => {
    const hostile = { retention: { d1: { eligible: 1 } }, families: [{ childName: "Maya" }] };
    expect(scanForbiddenKeys(hostile)).toEqual(["$.families[0].childName"]);
    for (const key of ["childId", "name", "note", "noteText", "transcript", "displayName"]) {
      expect(FORBIDDEN_RESPONSE_KEY.test(key)).toBe(true);
    }
  });

  it("the event props that leave the store are an allow-list of three grouping keys", () => {
    expect([...EVENT_PROP_ALLOWLIST]).toEqual(["source", "market", "utm_campaign"]);
    for (const key of EVENT_PROP_ALLOWLIST) expect(FORBIDDEN_RESPONSE_KEY.test(key)).toBe(false);
  });

  it("the census is an ARRAY, so an event NAME can never become a response key", async () => {
    const report = await buildCohortReport(new FakeStore([], [ev("u1", "child_note_saved", 1)]), { since: iso(7), now: NOW });
    expect(Array.isArray(report.eventCensus)).toBe(true);
    expect(report.eventCensus[0]).toEqual({ stage: "child_note_saved", count: 1 });
    // The hostile name is a VALUE, and values are not keys — the scan is clean.
    expect(scanForbiddenKeys(report)).toEqual([]);
    // NEGATIVE CONTROL: keyed by name, the same data would trip the scan.
    expect(scanForbiddenKeys({ census: { child_note_saved: 1 } })).toEqual(["$.census.child_note_saved"]);
  });

  it("the module never reads a child collection", () => {
    // CODE only: the header explains what it must never read, and a scan that
    // cannot tell a prohibition from a call site is not a guard.
    const src = stripComments(fs.readFileSync(path.resolve(__dirname, "cohortMetrics.ts"), "utf8"));
    expect(src).not.toMatch(/children/);
    expect(src).not.toMatch(/behaviorLogs|milestones|actionPlans|memoryEvents/);
    expect(src).toContain(`collection(RETENTION_ROLLUP_COLLECTION)`);
    expect(src).toContain(`collectionGroup("events")`);
  });
});

/* ── (c) the null-rate path ──────────────────────────────────────────────── */

describe("rates — null, never zero, and never a percentage on an empty denominator", () => {
  it("day-0: an empty rollup collection is not answerable, in every bucket", async () => {
    const report = await buildCohortReport(new FakeStore([], []), { since: iso(7), now: NOW });
    expect(Object.keys(report.retention).sort()).toEqual(["d1", "d28", "d30", "d7"]);
    for (const bucket of Object.values(report.retention)) {
      expect(bucket.eligible).toBe(0);
      expect(bucket.rate).toBeNull();
      expect(bucket.rate).not.toBe(0);
      expect(reportScript.formatRate(bucket.rate, bucket.eligible)).toBe("not answerable yet");
    }
  });

  it("the printer says 'not answerable yet' and never 0%", () => {
    expect(reportScript.formatRate(null, 0)).toBe("not answerable yet");
    expect(reportScript.formatRate(null, 5)).toBe("not answerable yet");
    expect(reportScript.pct(0, 0)).toBe("not answerable yet");
    expect(reportScript.pct(0, 4)).toBe("0%");
    expect(reportScript.formatRate(0.5, 4)).toBe("50%");
  });

  it("NEGATIVE CONTROL — a rate of 0 on an empty denominator must fail", () => {
    const bad = { d7: { eligible: 0, returned: 0, rate: 0 } };
    expect(bad.d7.rate).not.toBeNull();
    expect(() => expect(bad.d7.rate).toBeNull()).toThrow();
  });

  it("a real cohort answers d1 and leaves d28 unanswerable at seven days", async () => {
    const report = await buildCohortReport(
      new FakeStore([rollup(3, [0, 1]), rollup(3, [0]), rollup(0, [0])], []),
      { since: iso(7), now: NOW },
    );
    expect(report.retention.d1).toEqual({ eligible: 2, returned: 1, rate: 0.5 });
    expect(report.retention.d28.eligible).toBe(0);
    expect(report.retention.d28.rate).toBeNull();
  });
});

/* ── the arithmetic is the library's, and the script agrees with it ───────── */

describe("no second implementation of retention", () => {
  it("the server delegates to lib/retention.ts cohortRetention", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "cohortMetrics.ts"), "utf8");
    expect(src).toContain('from "../lib/retention.js"');
    expect(src).toContain("cohortRetention(rollups, asOfDay)");
    // Nothing in this module divides — a rate it did not receive is a rate it
    // cannot invent.
    expect(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")).not.toMatch(/returned\s*\/\s*eligible/);
  });

  it("the SCRIPT's retention output equals the library's, fixture for fixture", () => {
    const fixtures: RetentionRollup[][] = [
      [],
      [{ firstSeen: day(40), activeDays: [day(40), day(39), day(33), day(12), day(10)] }],
      [{ firstSeen: day(3), activeDays: [day(3), day(2)] }, { firstSeen: day(0), activeDays: [day(0)] }],
      [{ firstSeen: day(31), activeDays: [day(31), day(30), day(24), day(3), day(1)] }],
    ];
    for (const rollups of fixtures) {
      expect(reportScript.cohortRetention(rollups, day(0))).toEqual(libCohortRetention(rollups, day(0)));
    }
  });

  it("the script's funnel chain agrees with the server's on the same events", () => {
    const events = [
      ev("u1", "paywall_view", 1), ev("u1", "checkout_start", 1),
      ev("u2", "paywall_view", 2), ev("u3", "paywall_view", 2, { source: "referral" }),
      ev("u1", "entitlement_active", 0),
    ];
    const chain = FUNNEL_CHAINS.billing;
    expect(reportScript.countFunnelChain(events, chain, "source")).toEqual(countFunnelChain(events, chain, "source"));
  });

  it("the script's activation counts agree with the server's", () => {
    const events = [
      ev("u1", "onboarding_completed", 30), ev("u1", "activated", 25),
      ev("u2", "onboarding_completed", 30), ev("u3", "onboarding_completed", 1),
    ];
    expect(reportScript.summariseActivation(events, NOW.getTime(), 7))
      .toEqual(summariseActivation(events, { asOf: NOW.getTime(), windowDays: 7 }));
  });
});

/* ── the funnel slice reuses aggregateFunnel ─────────────────────────────── */

describe("funnels — aggregateFunnel, remapped, never reimplemented", () => {
  it("the billing chain is N1-02's three names, monotonic on honest data", () => {
    expect([...FUNNEL_CHAINS.billing]).toEqual(["paywall_view", "checkout_start", "entitlement_active"]);
    const rows = countFunnelChain(
      [
        ev("u1", "paywall_view", 1), ev("u2", "paywall_view", 1), ev("u3", "paywall_view", 1),
        ev("u1", "checkout_start", 1), ev("u2", "checkout_start", 1),
        ev("u1", "entitlement_active", 0),
      ],
      FUNNEL_CHAINS.billing,
      "source",
    );
    expect(rows).toEqual([{ key: "organic", stages: [
      { stage: "paywall_view", count: 3 },
      { stage: "checkout_start", count: 2 },
      { stage: "entitlement_active", count: 1 },
    ] }]);
  });

  it("groups by market as well as source, and buckets an unknown slice honestly", () => {
    const rows = countFunnelChain(
      [ev("u1", "paywall_view", 1, { market: "il" }), ev("u2", "paywall_view", 1, {})],
      FUNNEL_CHAINS.billing,
      "market",
    );
    expect(rows.map((r) => r.key).sort()).toEqual(["il", "unknown"]);
  });

  it("the server module calls aggregateFunnel rather than counting the chain itself", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "cohortMetrics.ts"), "utf8");
    expect(src).toContain('from "../lib/attributionFunnel.js"');
    expect(src).toContain("aggregateFunnel(remapped, groupBy");
  });

  it("refuses rather than silently truncates a chain longer than the library's", () => {
    expect(() => countFunnelChain([], ["a", "b", "c", "d", "e", "f"], "source")).toThrow(/cannot be mapped/);
  });
});

/* ── the activation definition is read from the module that owns it ───────── */

describe("activation — the definition travels with the number", () => {
  const tmp = path.join(__dirname, "__activation_fixture__");
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const writeFixture = (body: string) => {
    fs.mkdirSync(path.join(tmp, "lib"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "lib", "activation.ts"), body, "utf8");
    return tmp;
  };

  it("prints an explicit ACTIVATION_DEFINITION verbatim", () => {
    const dir = writeFixture('export const ACTIVATION_DEFINITION = "activated = onboarding_completed then a loop on a LATER local day within 7 days";');
    expect(reportScript.readActivationDefinition(dir).definition)
      .toBe("activated = onboarding_completed then a loop on a LATER local day within 7 days");
  });

  it("composes one from the two constants N1-03 names when the sentence is absent", () => {
    const dir = writeFixture('export const ACTIVATION_WINDOW_DAYS = 7;\nexport const ACTIVATION_LOOP_EVENTS = ["capture_saved", "keep_this"] as const;');
    const { definition } = reportScript.readActivationDefinition(dir);
    expect(definition).toContain("capture_saved");
    expect(definition).toContain("LATER local day");
    expect(definition).toContain("within 7 days");
  });

  it("says so LOUDLY when N1-03 has not landed — it never invents a definition", () => {
    const { definition, definitionStatus } = reportScript.readActivationDefinition(path.join(tmp, "nowhere"));
    expect(definition).toBeNull();
    expect(definitionStatus).toMatch(/activation\.ts not found/);
    // …and the status key itself must survive the report's own key scan: a
    // field called `note` would make the script refuse to print itself.
    expect(reportScript.scanForbiddenKeys({ activation: { definitionStatus } })).toEqual([]);
  });

  it("counts activated families and eligible denominators, and computes NO rate", async () => {
    const report = await buildCohortReport(
      new FakeStore([], [
        ev("u1", "onboarding_completed", 30), ev("u1", "activated", 25),
        ev("u2", "onboarding_completed", 20),
        ev("u3", "onboarding_completed", 2),
      ]),
      { since: iso(60), now: NOW },
    );
    expect(report.activation.count).toBe(1);
    expect(report.activation.denominator).toBe(2); // u3 onboarded 2 days ago — not answerable
    expect(Object.keys(report.activation).sort()).toEqual(["count", "definition", "denominator"]);
  });

  it("the server's denominator window mirrors lib/activation.ts, by SOURCE not import", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "..", "lib", "activation.ts"), "utf8");
    const declared = src.match(/ACTIVATION_WINDOW_DAYS\s*(?::[^=]+)?=\s*(\d+)/);
    expect(Number(declared?.[1])).toBe(ACTIVATION_WINDOW_DAYS);
  });

  it("the server never imports lib/activation — it would drag the CLIENT SDK into dist/server.cjs", () => {
    const src = stripComments(fs.readFileSync(path.resolve(__dirname, "cohortMetrics.ts"), "utf8"));
    expect(src).not.toMatch(/lib\/activation/);
    expect(src).not.toMatch(/import\(/);
    // NEGATIVE CONTROL: the import this guard exists to prevent.
    expect(/lib\/activation/.test('await import("../lib/activation.js")')).toBe(true);
  });

  it("the route reports definition: null and names the reader that prints it", async () => {
    const report = await buildCohortReport(new FakeStore([], []), { since: iso(7), now: NOW });
    expect(report.activation.definition).toBeNull();
    expect(ACTIVATION_DEFINITION_READER).toContain("cohort-report.mjs");
  });
});

/* ── the shape the writer actually writes ────────────────────────────────── */

describe("collection name — the reader and N1-04's writer cannot drift", () => {
  it("matches lib/retentionRollup.ts's own exported constant", () => {
    const writer = fs.readFileSync(path.resolve(__dirname, "..", "lib", "retentionRollup.ts"), "utf8");
    const declared = writer.match(/RETENTION_ROLLUP_COLLECTION\s*=\s*["']([^"']+)["']/);
    expect(declared?.[1]).toBe(RETENTION_ROLLUP_COLLECTION);
    expect(RETENTION_ROLLUP_COLLECTION).toBe("retentionRollups");
  });

  it("the report script reads the same collection", () => {
    const script = fs.readFileSync(path.resolve(__dirname, "..", "..", "scripts", "cohort-report.mjs"), "utf8");
    expect(script).toContain(`const RETENTION_ROLLUP_COLLECTION = "retentionRollups"`);
  });
});

/* ── critic C11: neither module may be imported by a component ───────────── */

describe("law 1 by the back door — no component imports the rate modules", () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
    });

  it("app/src/components/** imports neither lib/retention nor server/cohortMetrics", () => {
    const offenders = walk(path.resolve(__dirname, "..", "components")).filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return /from\s+["'][^"']*\b(retention|cohortMetrics)\b/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("NEGATIVE CONTROL — a component importing lib/retention would be caught", () => {
    expect(/from\s+["'][^"']*\b(retention|cohortMetrics)\b/.test('import { cohortRetention } from "../../lib/retention";')).toBe(true);
  });

  it("AdminDashboard.tsx is untouched by this item — the reader is a command", () => {
    const dash = path.resolve(__dirname, "..", "components", "layout", "AdminDashboard.tsx");
    if (!fs.existsSync(dash)) return;
    expect(fs.readFileSync(dash, "utf8")).not.toMatch(/cohort/i);
  });
});

/* ── the sandbox store ───────────────────────────────────────────────────── */

describe("NullCohortMetricsStore — local/sandbox never 500s", () => {
  it("returns empty inputs, which read as 'not answerable yet' everywhere", async () => {
    const report = await buildCohortReport(new NullCohortMetricsStore(), { since: iso(7), now: NOW });
    expect(report.scanned).toEqual({ rollups: 0, events: 0, mode: "null" });
    expect(report.retention.d1.rate).toBeNull();
    expect(report.eventCensus).toEqual([]);
  });
});

/* ── (a) the 403 path, proving ZERO reads ────────────────────────────────── */

const stubModelProvider = {
  async *streamText() { yield ""; },
  generateJson: async () => ({}),
  async *generateJsonStream() { yield "{}"; },
} as unknown as ModelProvider;

describe("GET /api/admin/cohorts — the gate", () => {
  const servers: Server[] = [];
  afterAll(async () => {
    delete process.env.ARBOR_ADMIN_UIDS;
    delete process.env.ARBOR_ADMIN_EMAILS;
    await Promise.all(servers.map((s) => new Promise<void>((res, rej) => s.close((e) => (e ? rej(e) : res())))));
  });

  const harness = async (uid: string, store: CohortMetricsStore) => {
    const config = createTestConfig();
    const entitlementStore = createEntitlementStore(config);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as any).user = { uid, email: null }; next(); });
    app.use("/api", createApiRouter({
      config,
      modelProvider: stubModelProvider,
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
      cohortMetricsStore: store,
    }));
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  it("a non-admin gets 403 and NOTHING is read from Firestore", async () => {
    process.env.ARBOR_ADMIN_UIDS = "founder-uid";
    const store = new FakeStore([rollup(10, [0, 1])], [ev("u1", "session_open", 1)]);
    const rollupSpy = vi.spyOn(store, "listRetentionRollups");
    const eventSpy = vi.spyOn(store, "listEvents");
    const base = await harness("some-parent", store);
    const res = await fetch(`${base}/api/admin/cohorts?since=${iso(7)}`);
    expect(res.status).toBe(403);
    expect(rollupSpy).toHaveBeenCalledTimes(0);
    expect(eventSpy).toHaveBeenCalledTimes(0);
    expect(store.reads).toBe(0);
  });

  it("NEGATIVE CONTROL — an empty admin list grants nobody (envList stays closed)", async () => {
    process.env.ARBOR_ADMIN_UIDS = "";
    process.env.ARBOR_ADMIN_EMAILS = "";
    const store = new FakeStore();
    const base = await harness("founder-uid", store);
    expect((await fetch(`${base}/api/admin/cohorts`)).status).toBe(403);
    expect(store.reads).toBe(0);
  });

  it("an admin gets a report whose every key survives the scan", async () => {
    process.env.ARBOR_ADMIN_UIDS = "founder-uid";
    const base = await harness("founder-uid", new FakeStore(
      [rollup(10, [0, 1, 7])],
      [ev("u1", "paywall_view", 1), ev("u1", "keep_this", 1)],
    ));
    const res = await fetch(`${base}/api/admin/cohorts?since=${iso(7)}&groupBy=market`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(scanForbiddenKeys(body)).toEqual([]);
    expect(body.groupBy).toBe("market");
    expect(body.retention.d1.rate).toBe(1);
    expect(body.retention.d28.rate).toBeNull();
    expect(Object.keys(body.funnels).sort()).toEqual(Object.keys(FUNNEL_CHAINS).sort());
  });

  it("local/sandbox with no ADC returns the Null store's emptiness, never a 500", async () => {
    process.env.ARBOR_ADMIN_UIDS = "founder-uid";
    const base = await harness("founder-uid", new NullCohortMetricsStore());
    const res = await fetch(`${base}/api/admin/cohorts`);
    expect(res.status).toBe(200);
    expect((await res.json()).scanned.mode).toBe("null");
  });
});

/* ── the lead's command surface ──────────────────────────────────────────── */

describe("cohort-report.mjs — the flags the measure plan names", () => {
  it("parses every documented flag", () => {
    const args = reportScript.parseArgs([
      "--since", "2026-09-15", "--retention", "--activation",
      "--funnel", "billing", "--events", "--group-by", "market", "--json",
    ]);
    expect(args.since).toBe("2026-09-15");
    expect([...args.sections].sort()).toEqual(["activation", "events", "funnel", "retention"]);
    expect(args.funnels).toEqual(["billing"]);
    expect(args.groupBy).toBe("market");
    expect(args.json).toBe(true);
  });

  it("with no section flag it prints everything, over every known funnel", () => {
    const args = reportScript.parseArgs([]);
    expect([...args.sections].sort()).toEqual(["activation", "events", "funnel", "retention"]);
    expect(args.funnels.sort()).toEqual(Object.keys(FUNNEL_CHAINS).sort());
    expect(Date.parse(args.since)).toBeLessThan(Date.now());
  });

  it("prints 'not answerable yet' for a young cohort and never a bare 0%", () => {
    const out = reportScript.print(
      {
        since: iso(7), asOfDay: day(0), groupBy: "source",
        retention: { d1: { eligible: 0, returned: 0, rate: null }, d7: { eligible: 0, returned: 0, rate: null }, d28: { eligible: 0, returned: 0, rate: null }, d30: { eligible: 0, returned: 0, rate: null } },
        activation: { count: 0, denominator: 0, definition: null, definitionStatus: "not landed" },
        funnels: {}, eventCensus: [], scanned: { rollups: 0, events: 0, mode: "ordered" },
        generatedAt: NOW.toISOString(),
      },
      reportScript.parseArgs(["--retention", "--activation"]),
    );
    expect(out).toContain("not answerable yet");
    // No DATA line carries a percentage: every rate and the activation row
    // read as a sentence. (The legend line that explains "not 0%" is copy.)
    const dataLines = out.split(/\r?\n/).filter((l: string) => /^\s{2}(d\d|activated )/.test(l));
    expect(dataLines.length).toBeGreaterThan(1);
    for (const line of dataLines) expect(line).not.toMatch(/\d\s*%/);
    expect(out).toContain("definition: UNAVAILABLE");
  });

  it("flags a non-monotonic funnel rather than printing it as if it were fine", () => {
    const out = reportScript.print(
      {
        since: iso(7), asOfDay: day(0), groupBy: "source",
        retention: {}, activation: { count: 0, denominator: 0, definition: null },
        funnels: { billing: [{ key: "organic", stages: [{ stage: "paywall_view", count: 1 }, { stage: "checkout_start", count: 3 }] }] },
        eventCensus: [], scanned: { rollups: 0, events: 0, mode: "ordered" },
        generatedAt: NOW.toISOString(),
      },
      reportScript.parseArgs(["--funnel", "billing"]),
    );
    expect(out).toContain("NOT MONOTONIC");
  });

  it("buildReport runs end to end against a Firestore-shaped double", async () => {
    // Exercises the script's OWN fetch path — the projection, the uid
    // derivation from the grandparent doc, the since filter — not just its
    // formatters. Without this the command is untested where it matters.
    const rollupDocs = [{ data: () => ({ firstSeen: day(10), activeDays: [day(10), day(9), day(3)], source: "organic", market: "il" }) }];
    const eventDocs = [
      { data: () => ({ event: "paywall_view", at: iso(1), props: { source: "organic", childName: "Maya", note: "secret" } }), ref: { parent: { parent: { id: "u1" } } } },
      { data: () => ({ event: "session_open", at: iso(20), props: {} }), ref: { parent: { parent: { id: "u1" } } } },
    ];
    const db = {
      collection: () => ({ limit: () => ({ get: async () => ({ docs: rollupDocs }) }) }),
      collectionGroup: () => ({
        orderBy: () => ({ limit: () => ({ get: async () => ({ docs: eventDocs }) }) }),
        limit: () => ({ get: async () => ({ docs: eventDocs }) }),
      }),
    };
    const report = await reportScript.buildReport(db, reportScript.parseArgs(["--since", iso(7), "--funnel", "billing"]), NOW);
    expect(report.scanned).toEqual({ rollups: 1, events: 1, mode: "ordered" });
    expect(report.eventCensus).toEqual([{ stage: "paywall_view", count: 1 }]); // the 20-day-old event is outside the window
    expect(report.retention.d1.rate).toBe(1);
    expect(report.retention.d28.rate).toBeNull();
    // The hostile props never survive the projection — scan the whole report.
    expect(reportScript.scanForbiddenKeys(report)).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("Maya");
    expect(JSON.stringify(report)).not.toContain("secret");
  });

  it("the script's acquisition chain equals lib/attributionFunnel.ts FUNNEL_EVENTS", () => {
    // N1-03 added an `activated` stage to the library chain. A script that
    // kept the old three would print a funnel that no longer exists.
    expect(reportScript.FUNNEL_CHAINS.acquisition).toEqual([...FUNNEL_EVENTS]);
    expect(reportScript.FUNNEL_CHAINS.billing).toEqual([...FUNNEL_CHAINS.billing]);
  });

  it("reads the REAL lib/activation.ts definition verbatim, not a truncated prefix", () => {
    // The declaration is a `+`-concatenation across five lines. A reader that
    // matched the first quoted string would print a sentence that stops at
    // "…at least one of " — technically a definition, practically a lie.
    const { definition, definitionStatus } = reportScript.readActivationDefinition();
    expect(definitionStatus).toBeNull();
    expect(definition).toContain("onboarding_completed");
    expect(definition).toContain("keep_this");
    expect(definition).toContain("later local day");
    expect(definition).toMatch(/within 7 days/);
    expect(definition.endsWith(".")).toBe(true);
  });

  it("NEGATIVE CONTROL — an unresolvable expression is refused, never truncated", () => {
    const dir = path.join(__dirname, "__activation_unresolvable__");
    try {
      fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, "lib", "activation.ts"),
        ['export const ACTIVATION_DEFINITION =', '  "activated when " +', "  someRuntimeCall(x);", ""].join("\n"),
        "utf8",
      );
      const { definition, definitionStatus } = reportScript.readActivationDefinition(dir);
      expect(definition).toBeNull();
      expect(definitionStatus).toMatch(/cannot resolve/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the script refuses to print a report carrying a forbidden key", () => {
    expect(reportScript.scanForbiddenKeys({ rows: [{ childName: "Maya" }] })).toEqual(["$.rows[0].childName"]);
    const src = fs.readFileSync(path.resolve(__dirname, "..", "..", "scripts", "cohort-report.mjs"), "utf8");
    expect(src).toContain("REFUSING to print");
    expect(stripComments(src)).not.toMatch(/children/);
  });
});
