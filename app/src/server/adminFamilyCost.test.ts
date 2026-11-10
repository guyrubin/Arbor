import { describe, expect, it, vi } from "vitest";
import { costPerActiveFamily, lastDayKeys } from "./adminMetrics.js";
import { activeHouseholdsOn, familyDailyCostReport, readFamilyCostWindow, type FamilyCostDay } from "./familyCostReport.js";
import type { StoredRollup } from "./cohortMetrics.js";

const now = new Date("2026-11-10T12:00:00Z");
const date = "2026-11-10";
const rollup = (uid: string, cohort: StoredRollup["cohort"] = "family", activeDays = [date]): StoredRollup =>
  ({ uid, cohort, activeDays, firstSeen: "2026-09-01", source: null, market: null });
const cost = (familyId: string | null, memberUids: string[], usd: number, day = date): FamilyCostDay =>
  ({ familyId, memberUids, date: day, routes: { analysis_structured: { calls: 1, pricedCalls: 1, estimatedCostUsd: usd } } });

describe("B-AIOPS-01 consistent family cost denominators", () => {
  it("counts either co-parent's activity once and excludes the same households from both sides", () => {
    const rollups = [rollup("owner", "family", []), rollup("partner"), rollup("other"),
      rollup("staff", "internal", []), rollup("staff-partner"), rollup("demo", "demo"), rollup("inactive", "family", ["2026-09-01"])];
    const coParents = [{ ownerUid: "owner", recipientUid: "partner" }, { ownerUid: "staff", recipientUid: "staff-partner" }];
    const out = costPerActiveFamily({ now, rollups, coParents, familyCosts: [
      cost("fam-1", ["partner"], 0.5), cost("fam-1", ["owner"], 0.25, lastDayKeys(now)[29]),
      cost("fam-2", ["other"], 0.25), cost("fam-staff", ["staff-partner"], 90), cost("fam-demo", ["demo"], 8),
      cost(null, [], 4), cost("no-members", [], 2), cost("unknown", ["unknown"], 1), cost("inactive", ["inactive"], 3),
      cost("fam-1", ["partner"], 99, "2026-09-01"), cost("fam-1", ["partner"], 99, "2026-11-11"),
    ] });
    expect(out).toMatchObject({ activeFamilies: 2, householdsFolded: 2, calls: 3, pricedCalls: 3,
      estimatedCostUsd: 1, perActiveFamilyUsd: 0.5, excludedCostUsd: 98, unattributedUsd: 10,
      dataStatus: "complete", billMatch: "partial" });
    expect(rollups[0].activeDays).toEqual([]); // projection does not alter source records
    expect(activeHouseholdsOn(rollups, coParents, date)).toEqual({ households: 2, folded: 2 });
  });

  it("a partner's internal tag excludes the owner too; absent tags stay compatible with old family rows", () => {
    const owner = rollup("owner"); delete owner.cohort;
    const result = costPerActiveFamily({ now, rollups: [owner, rollup("partner", "internal"), rollup("family")],
      coParents: [{ ownerUid: "owner", recipientUid: "partner" }],
      familyCosts: [cost("owner-family", ["owner"], 20), cost("family", ["family"], 1)] });
    expect(result).toMatchObject({ activeFamilies: 1, estimatedCostUsd: 1, excludedCostUsd: 20, perActiveFamilyUsd: 1 });
  });

  it("does not turn unpriced calls into zero cost, or unknown shares into an average", () => {
    const input = { now, rollups: [rollup("owner")], coParents: [], familyCosts: [{ ...cost("family", ["owner"], 0),
      routes: { realtime_audio: { calls: 1, unpricedCalls: 1, observedMs: 60_000 } } }] };
    expect(costPerActiveFamily(input)).toMatchObject({ calls: 1, pricedCalls: 0, estimatedCostUsd: null, perActiveFamilyUsd: null });
    expect(costPerActiveFamily({ ...input, coParents: null })).toMatchObject({ dataStatus: "unavailable", activeFamilies: null, perActiveFamilyUsd: null });
    expect(familyDailyCostReport({ date, rollups: input.rollups, coParents: null, costs: [cost("family", ["owner"], 1)] }).perActiveFamilyUsd).toBeNull();
    expect(costPerActiveFamily({ now, familyCosts: [], rollups: [], coParents: [] })).toMatchObject({ estimatedCostUsd: null, perActiveFamilyUsd: null });
  });

  it.each(["unavailable", "truncated"] as const)("suppresses the estimate when the %s read is incomplete", (dataStatus) => {
    const result = costPerActiveFamily({ now, familyCosts: [cost("family", ["owner"], 1)], rollups: [rollup("owner")], coParents: [], dataStatus });
    expect(result).toMatchObject({ dataStatus, estimatedCostUsd: null, activeFamilies: null, perActiveFamilyUsd: null });
  });
});

describe("bounded Firestore family cost reads", () => {
  function database(failed?: string, truncated?: string) {
    const queries: unknown[][] = [];
    const collection = (name: string) => {
      const q = {
        where: (...args: unknown[]) => { queries.push([name, "where", ...args]); return q; },
        limit: (n: number) => { queries.push([name, "limit", n]); return q; },
        get: vi.fn(async () => {
          if (name === failed) throw new Error("synthetic read failure");
          const docs = name === "retentionRollups" ? [
            { id: "inactive-owner", data: () => ({ activeDays: [], cohort: "internal" }) },
          ] : name === "shares" ? [
            { id: "share", data: () => ({ role: "co_parent", ownerUid: "inactive-owner", recipientUid: "partner" }) },
          ] : [{ id: "day", data: () => cost("family", ["partner"], 1) }];
          return { docs: name === truncated ? Array.from({ length: 5001 }, () => docs[0]) : docs };
        }),
      }; return q;
    };
    return { db: { collection } as never, queries };
  }

  it("reads attributed days, inactive owners and shares within the cap, never the global cost rollup", async () => {
    const { db, queries } = database();
    const read = await readFamilyCostWindow(db, lastDayKeys(now));
    expect(read).toMatchObject({ status: "complete", rollups: [{ uid: "inactive-owner", activeDays: [], cohort: "internal" }],
      coParents: [{ ownerUid: "inactive-owner", recipientUid: "partner" }] });
    expect(queries).toContainEqual(["familyCostDaily", "where", "date", ">=", "2026-10-12"]);
    expect(queries).toContainEqual(["familyCostDaily", "where", "date", "<=", date]);
    expect(queries.filter((q) => q[1] === "limit")).toHaveLength(3);
    expect(queries.every((q) => q[0] !== "usageRollup")).toBe(true);
  });
  it.each(["familyCostDaily", "retentionRollups", "shares"])("does not report a failed %s read as empty successful data", async (name) => {
    expect(await readFamilyCostWindow(database(name).db, lastDayKeys(now))).toEqual({ status: "unavailable" });
  });
  it.each(["familyCostDaily", "retentionRollups", "shares"])("does not publish a partial %s scan as a complete average", async (name) => {
    expect(await readFamilyCostWindow(database(undefined, name).db, lastDayKeys(now))).toEqual({ status: "truncated" });
  });
});
