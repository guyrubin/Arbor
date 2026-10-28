import { describe, it, expect, vi, afterAll, onTestFinished } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createTestConfig } from "../testConfig.js";
import { createProgramPilotRouter } from "./programPilotRoute.js";
import { scanForbiddenKeys, type CohortMetricsStore, type StoredRollup } from "./cohortMetrics.js";
import {
  PROGRAM_PILOT_METRIC_VERSION, projectEnrolment, projectPracticeRow, summariseProgramPilot,
  type PilotEnrolmentRecord, type ProgramPilotStore,
} from "./programPilot.js";
import type { ActionLoopEntry } from "../actionLoop/model.js";
import type { SleepLogEntry } from "../types.js";

/* B-PROG-12 — the program pilot's cohort reader: the five thesis §10 rows
   (dose 4+ by week, parent proxy moved, child proxy moved, bridge, D30) plus
   the D7 full loop, reproduced on a ten-family fixture; demo and internal
   families excluded; immature windows reported as not yet eligible and closed
   windows without data as missing — never a guessed share; paid renewal is
   billing's and stays "not measured"; counts and shares only, nothing per
   child; admin gate first (a non-admin request reads NOTHING). */

const AS_OF = "2026-12-20";
const DAY = 86_400_000;
const plus = (start: string, n: number) => new Date(Date.parse(`${start}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

type Spec = {
  uid: string; child?: string; programId: "talk-together" | "steady-nights"; start: string;
  doses?: { day: number; selfCount?: number; outcome?: "helped" | "somewhat" | "not_today" }[];
  words?: number[]; shares?: number[]; baseline?: number;
  nights?: { day: number; routine?: "done_in_order" | "not_tonight"; bedtime?: string; wakings?: string[]; wake?: string }[];
};
const fam = (s: Spec): PilotEnrolmentRecord => {
  const child = s.child ?? `${s.uid}-c`;
  return {
    uid: s.uid,
    childKey: child,
    enrolment: projectEnrolment({ programId: s.programId, startedAt: s.start, enrolledAt: `${s.start}T19:00:00Z`, status: "active", currentWeek: 1, baseline: { childProxy: s.baseline ?? null } }, `${s.programId}.${s.start}`),
    practiceRows: (s.doses ?? []).map((d) => projectPracticeRow({ source: "practice", status: "completed", ...(d.outcome ? { outcome: d.outcome } : {}), ...(d.selfCount !== undefined ? { selfCount: d.selfCount } : {}), recommendation: "never projected" }, `practice.${child}.${plus(s.start, d.day)}`)),
    sleepLogs: (s.nights ?? []).map((n) => ({ date: plus(s.start, n.day), ...(n.routine ? { routine: n.routine } : {}), ...(n.bedtime ? { bedtime: n.bedtime } : {}), ...(n.wakings ? { wakings: n.wakings } : {}), ...(n.wake ? { wake: n.wake } : {}), updatedAt: "" }) as SleepLogEntry),
    wordEntryAts: (s.words ?? []).map((d) => `${plus(s.start, d)}T12:00:00.000Z`),
    professionalSharesAt: (s.shares ?? []).map((d) => `${plus(s.start, d)}T10:00:00.000Z`),
  };
};
const days = (from: number, n: number, extra: Record<string, unknown> = {}) => Array.from({ length: n }, (_, i) => ({ day: from + i, ...extra }));
const rollup = (uid: string, firstSeen: string, activeOffsets: number[], cohort?: "internal" | "demo"): StoredRollup => ({
  uid, firstSeen, activeDays: activeOffsets.map((o) => plus(firstSeen, o)), source: null, market: null, ...(cohort ? { cohort } : {}),
});
const SN_WEEK1 = { bedtime: "21:00", wakings: ["01:00"], wake: "06:00" }; // longest stretch 5 h
const SN_WEEK6 = { bedtime: "20:00", wake: "06:30" };                     // 10.5 h

/* ── the ten families (expected values worked by hand in the comments) ── */
const RECORDS: PilotEnrolmentRecord[] = [
  // u1 TT, 80 days in: week1 4 days (turns 4, a night answer on day 0), week4 4 days, week6 3 days × 3 = 9; words w1 1 → w8 3; a professional share on day 10.
  fam({ uid: "u1", programId: "talk-together", start: "2026-10-01",
    doses: [...days(0, 1, { selfCount: 1, outcome: "helped" }), ...days(1, 3, { selfCount: 1 }), ...days(21, 4), ...days(35, 3, { selfCount: 3 })],
    words: [2, 50, 51, 52], shares: [10] }),
  // u1's second child, a later enrolment — the family is counted once (its first enrolment).
  fam({ uid: "u1", child: "u1-c2", programId: "steady-nights", start: "2026-10-15", doses: days(0, 7) }),
  // u2 TT: week1 2 days (turns 4), week4 2 days, week6 1 day × 4 = 4 (not above 4); baseline 2 → w8 2 words; the only professional share is BEFORE enrolment.
  fam({ uid: "u2", programId: "talk-together", start: "2026-10-01", baseline: 2,
    doses: [...days(0, 2, { selfCount: 2 }), ...days(21, 2), ...days(35, 1, { selfCount: 4 })], words: [50, 51], shares: [-3] }),
  // u3 TT, 40 days in (week 6 not ended): week1 5 days, a night answer on day 3, week4 4 days, share day 2.
  fam({ uid: "u3", programId: "talk-together", start: "2026-11-10",
    doses: [...days(0, 3, { selfCount: 0 }), { day: 3, selfCount: 0, outcome: "somewhat" }, { day: 4, selfCount: 0 }, ...days(21, 4)], shares: [2] }),
  // u4 TT, 5 days in: nothing has matured.
  fam({ uid: "u4", programId: "talk-together", start: "2026-12-15", doses: days(0, 3, { outcome: "helped" }) }),
  // u5 SN, 61 days in: week1 4 days (night answer day 1), week4 3 days; routine w1 2 → w6 5; stretch w1 5 h → w6 10.5 h.
  fam({ uid: "u5", programId: "steady-nights", start: "2026-10-20",
    doses: [{ day: 0 }, { day: 1, outcome: "helped" }, ...days(2, 2), ...days(21, 3)],
    nights: [{ day: 0, routine: "done_in_order", ...SN_WEEK1 }, { day: 1, routine: "done_in_order", ...SN_WEEK1 }, { day: 2, routine: "not_tonight", ...SN_WEEK1 },
      ...days(35, 5).map((d) => ({ ...d, routine: "done_in_order" as const, ...SN_WEEK6 }))] }),
  // u6 SN: week1 1 day, week4 5 days; routine w1 3 → w6 3; no diary times at all (child proxy missing).
  fam({ uid: "u6", programId: "steady-nights", start: "2026-10-20",
    doses: [...days(0, 1), ...days(21, 5)], nights: [...days(0, 3).map((d) => ({ ...d, routine: "done_in_order" as const })), ...days(35, 3).map((d) => ({ ...d, routine: "done_in_order" as const }))] }),
  // u7 TT, 49 days in: week1 4 × 1 (night answer day 6? no — day 3), week4 4 days, week6 4 × 2 = 8; share day 20.
  fam({ uid: "u7", programId: "talk-together", start: "2026-11-01",
    doses: [...days(0, 3, { selfCount: 1 }), { day: 6, selfCount: 1, outcome: "helped" }, ...days(21, 4), ...days(35, 4, { selfCount: 2 })], shares: [20] }),
  // u8 TT, 49 days in: no practice at all (week6 0 vs week1 0: not moved).
  fam({ uid: "u8", programId: "talk-together", start: "2026-11-01" }),
  // u9 SN, 19 days in: week1 4 days (night answer day 2), share day 1.
  fam({ uid: "u9", programId: "steady-nights", start: "2026-12-01", doses: [...days(0, 2), { day: 2, outcome: "somewhat" }, { day: 3 }], shares: [1] }),
  // u10 TT, 10 days in: week1 3 days; its night answer came on day 8 (outside days 0–6); no rollup.
  fam({ uid: "u10", programId: "talk-together", start: "2026-12-10", doses: [...days(0, 3), { day: 8, outcome: "helped" }] }),
  // excluded: the demo family (always) and an internal account (by default)
  fam({ uid: "d1", programId: "talk-together", start: "2026-10-01", doses: days(0, 7, { selfCount: 5, outcome: "helped" }), shares: [1] }),
  fam({ uid: "i1", programId: "talk-together", start: "2026-10-01", doses: days(0, 7, { selfCount: 5, outcome: "helped" }), shares: [1] }),
];
const ROLLUPS: StoredRollup[] = [
  rollup("u1", "2026-09-26", [0, 30]),
  rollup("u2", "2026-10-01", [0, 1, 29]),
  rollup("u3", "2026-11-10", [0, 30]),
  rollup("u4", "2026-12-15", [0, 1]),
  rollup("u5", "2026-10-20", [0, 30]),
  rollup("u6", "2026-10-20", [0, 31]),
  rollup("u7", "2026-11-01", [0, 30]),
  rollup("u8", "2026-10-01", [0, 30]),
  rollup("u9", "2026-12-01", [0, 1]),
  rollup("d1", "2026-09-01", [0, 30], "demo"),
  rollup("i1", "2026-09-01", [0, 30], "internal"),
];

describe("B-PROG-12 — the ten-family fixture reproduces the five rows (and the D7 loop)", () => {
  const out = summariseProgramPilot(RECORDS, ROLLUPS, { asOfDay: AS_OF, mode: "firestore" });

  it("one row per family; demo always and internal by default excluded; the metric version is stamped", () => {
    expect(out.families).toBe(10);
    expect(out.byProgram).toEqual({ "talk-together": 7, "steady-nights": 3 });
    expect(out.excluded).toEqual({ internal: 1, demo: 1 });
    expect(out.scanned).toEqual({ enrolments: 13, mode: "firestore" });
    expect(out.metricVersion).toBe(PROGRAM_PILOT_METRIC_VERSION);
    expect(out.asOfDay).toBe(AS_OF);
  });
  it("dose 4+ by program week — week 1: 5 of 9 (1 not yet); week 4 (days 22–28): 4 of 7 (3 not yet)", () => {
    expect(out.programDose4plus.byWeek.find((w) => w.week === 1)).toEqual({ week: 1, count: 5, eligible: 9, share: 0.556, notYetEligible: 1, missing: 0 });
    expect(out.programDose4plus.week4).toEqual({ count: 4, eligible: 7, share: 0.571, notYetEligible: 3, missing: 0 });
  });
  it("parent proxy moved by week 6 against the family's own week 1: 3 of 6 (4 not yet)", () => {
    expect(out.parentProxyMoved).toEqual({ count: 3, eligible: 6, share: 0.5, notYetEligible: 4, missing: 0 });
  });
  it("child proxy moved by week 8 (Steady Nights: its last week) against the own baseline: 2 of 3, 6 not yet, 1 missing", () => {
    expect(out.kidProxyMoved).toEqual({ count: 2, eligible: 3, share: 0.667, notYetEligible: 6, missing: 1 });
  });
  it("bridge: a professional share on or after the enrolment day — 4 of 10", () => {
    expect(out.bridgePacketSent).toEqual({ count: 4, eligible: 10, share: 0.4, notYetEligible: 0, missing: 0 });
  });
  it("D30 from first access: 5 of 7 (2 not yet, 1 without a rollup)", () => {
    expect(out.d30Active).toEqual({ count: 5, eligible: 7, share: 0.714, notYetEligible: 2, missing: 1 });
  });
  it("D7 full Parent loop (a practice in days 0–6 answered at night): 5 of 9 (1 not yet) — distinct from D30 and dose", () => {
    expect(out.d7FullLoop).toEqual({ count: 5, eligible: 9, share: 0.556, notYetEligible: 1, missing: 0 });
  });
  it("paid renewal is billing's record — never inferred from use", () => {
    expect(out.paidRenewal).toEqual({ count: null, eligible: null, share: null, status: "not_measured", source: "billing" });
  });
  it("?includeInternal keeps the internal family (the demo family never)", () => {
    const all = summariseProgramPilot(RECORDS, ROLLUPS, { asOfDay: AS_OF, includeInternal: true });
    expect(all.families).toBe(11);
    expect(all.excluded).toEqual({ internal: 0, demo: 1 });
  });
  it("an immature cohort answers 'not yet', never 0 %", () => {
    const young = summariseProgramPilot([RECORDS[4]], ROLLUPS, { asOfDay: AS_OF });
    for (const row of [young.d7FullLoop, young.programDose4plus.week4, young.parentProxyMoved, young.kidProxyMoved, young.d30Active]) {
      expect(row.eligible).toBe(0);
      expect(row.share).toBeNull();
      expect(row.notYetEligible).toBe(1);
    }
  });
});

describe("B-PROG-12 — privacy: counts and shares only, nothing per child", () => {
  const out = summariseProgramPilot(RECORDS, ROLLUPS, { asOfDay: AS_OF, mode: "firestore" });
  it("no response key trips the cohort reader's guard, and no uid, child id, practice text or date of a family leaves", () => {
    expect(scanForbiddenKeys(out)).toEqual([]);
    const json = JSON.stringify(out);
    for (const leak of ["u1", "u10", "u1-c", "u1-c2", "d1", "i1", "never projected", "practice.", "2026-10-01", "2026-11-10"]) expect(json).not.toContain(leak);
  });
  it("the store projects at the egress: a practice row keeps id/source/status/outcome/selfCount only; the enrolment never carries notes", () => {
    const row = projectPracticeRow({ source: "practice", status: "completed", outcome: "helped", selfCount: 3, recommendation: "Say: ball!", whatHappened: "words", practiceSay: "x" }, "practice.c.2026-10-01");
    expect(Object.keys(row).sort()).toEqual(["id", "outcome", "selfCount", "source", "status"]);
    const e = projectEnrolment({ programId: "talk-together", startedAt: "2026-10-01", status: "active", notes: { "one-thing-that-repeats": "parent words" } }, "x");
    expect(JSON.stringify(e)).not.toContain("parent words");
    const src = readFileSync(path.join(__dirname, "programPilot.ts"), "utf8");
    expect(src).toContain('childRef.collection("langObs").select("timestamp").get()');
    // read-only: no Firestore write shape anywhere in the reader (Map.set is not one)
    expect(src).not.toMatch(/\b(?:doc|ref|collection)\([^)]*\)\s*\.\s*(?:set|update|delete|add)\(|\.ref\.(?:set|update|delete)\(/);
    for (const banned of ["batch(", "runTransaction", "recursiveDelete", "bulkWriter"]) expect(src, `the reader must not call ${banned}`).not.toContain(banned);
  });
  it("app/src/components/** never imports the pilot reader (nothing on a parent surface)", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const hits = execSync(`grep -rl "programPilot\\b\\|server/programPilot" ${path.join(__dirname, "..", "components")} || true`, { encoding: "utf8" }).trim();
    expect(hits).toBe("");
  });
});

/* ── the route: the admin gate first ───────────────────────────────────── */

class FakePilotStore implements ProgramPilotStore {
  readonly mode = "firestore" as const;
  reads = 0;
  async listEnrolmentRecords() { this.reads += 1; return RECORDS; }
}
class FakeCohortStore implements CohortMetricsStore {
  readonly mode = "firestore" as const;
  reads = 0;
  async listRetentionRollups() { this.reads += 1; return ROLLUPS; }
  async listEvents() { this.reads += 1; return []; }
}

describe("GET /api/admin/program-pilot — the gate", () => {
  const servers: Server[] = [];
  afterAll(async () => {
    delete process.env.ARBOR_ADMIN_UIDS;
    await Promise.all(servers.map((s) => new Promise<void>((res, rej) => s.close((e) => (e ? rej(e) : res())))));
  });
  const harness = async (uid: string, pilot: ProgramPilotStore, cohort: CohortMetricsStore) => {
    const config = createTestConfig();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as any).user = { uid, email: null }; next(); });
    app.use("/api", createProgramPilotRouter({ config, programPilotStore: pilot, cohortMetricsStore: cohort }));
    const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  it("createApp mounts the read-out under /api after auth; the shared routes/api.ts carries no pilot code", () => {
    const app = readFileSync(path.join(__dirname, "createApp.ts"), "utf8");
    const mount = app.indexOf('app.use("/api", createProgramPilotRouter({ config }));');
    expect(mount).toBeGreaterThan(app.indexOf('app.use("/api", createAuthMiddleware(config));'));
    expect(readFileSync(path.join(__dirname, "..", "routes", "api.ts"), "utf8")).not.toMatch(/programPilot|program-pilot/);
  });

  it("a non-admin gets 403 and NOTHING is read", async () => {
    process.env.ARBOR_ADMIN_UIDS = "founder-uid";
    const pilot = new FakePilotStore(), cohort = new FakeCohortStore();
    const spy = vi.spyOn(pilot, "listEnrolmentRecords");
    const base = await harness("some-parent", pilot, cohort);
    expect((await fetch(`${base}/api/admin/program-pilot`)).status).toBe(403);
    expect(spy).toHaveBeenCalledTimes(0);
    expect(pilot.reads + cohort.reads).toBe(0);
  });

  it("an admin gets the summary (counts only), demo and internal excluded by default", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${AS_OF}T09:00:00Z`) });
    onTestFinished(() => { vi.useRealTimers(); });
    process.env.ARBOR_ADMIN_UIDS = "founder-uid";
    const base = await harness("founder-uid", new FakePilotStore(), new FakeCohortStore());
    const res = await fetch(`${base}/api/admin/program-pilot`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.families).toBe(10);
    expect(body.asOfDay).toBe(AS_OF);
    expect(body.parentProxyMoved).toMatchObject({ count: 3, eligible: 6 });
    expect(scanForbiddenKeys(body)).toEqual([]);
    const all = await (await fetch(`${base}/api/admin/program-pilot?includeInternal=1`)).json();
    expect(all.families).toBe(11);
  });
});
