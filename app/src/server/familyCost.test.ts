/**
 * B-AIOPS-01: the per-family daily cost. Households are foldCoParents
 * (a co-parent is one family; internal and demo stay out of both sides).
 * A route with calls and no price is a named gap. The receipt never
 * carries a name, a transcript, or child text.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRedaction } from "./redaction.js";
import { scanForbiddenKeys, type CohortMetricsStore, type StoredRollup } from "./cohortMetrics.js";
import { recordUsage } from "../ai/usage.js";
import { createTestConfig } from "../testConfig.js";
import {
  activeHouseholdsOn, familyDailyCostReport, loadFamilyDailyCostReport, type FamilyCostDay,
} from "./familyCostReport.js";
import { _setFamilyCostDb, familyCostFields, type FamilyCostInput } from "./familyCostWriter.js";
import { MemoryLiveUsageStore, recordLiveCost } from "./liveUsage.js";
import { runAsStudioProduction, studioAsset } from "./studioCostLedger.js";
import { logger } from "./logger.js";

const DATE = "2026-11-04";
const rollup = (uid: string, cohort: StoredRollup["cohort"], days: string[] = [DATE]): StoredRollup => ({
  uid, firstSeen: days[0] ?? DATE, activeDays: days, source: null, market: null, ...(cohort ? { cohort } : {}),
});
const day = (familyId: string | null, routes: FamilyCostDay["routes"], memberUids: string[] = []): FamilyCostDay =>
  ({ familyId, memberUids, routes });
const route = (over: Partial<FamilyCostDay["routes"][string]> = {}) => ({ calls: 1, pricedCalls: 0, unpricedCalls: 0, estimatedCostUsd: 0, ...over });

const input = (over: Partial<FamilyCostInput> = {}): FamilyCostInput => ({
  familyId: "fam_1", uid: "parent", route: "coach_high_stakes",
  retries: 0, fallback: false, chargedFailure: false,
  promptTokens: 3, outputTokens: 2, cacheReadTokens: 0, audioSeconds: 0, imageCount: 0,
  characters: 0, observedMs: 0, priceTableAsOf: "2026-10-15", estimatedCostUsd: 0.01,
  ...over,
});

afterEach(() => { _setFamilyCostDb(null); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("B-AIOPS-01 family daily cost", () => {
  it("counts a co-parent as one household, and two when the shares were not read", () => {
    const rollups = [rollup("owner", "family"), rollup("coparent", "family")];
    expect(activeHouseholdsOn(rollups, [{ ownerUid: "owner", recipientUid: "coparent" }], DATE)).toEqual({ households: 1, folded: 1 });
    expect(activeHouseholdsOn(rollups, null, DATE)).toEqual({ households: 2, folded: null });
  });

  it("keeps internal and demo spend, and unattributed spend, out of the per-family average", () => {
    const report = familyDailyCostReport({
      date: DATE,
      coParents: [],
      rollups: [
        rollup("owner", "family"),
        rollup("quiet", "family"),
        rollup("staff", "internal"),
        rollup("booth", "demo"),
      ],
      costs: [
        day("fam-owner", { coach_high_stakes: route({ pricedCalls: 1, estimatedCostUsd: 0.5, calls: 1 }) }, ["owner"]),
        day("fam-staff", { coach_high_stakes: route({ pricedCalls: 1, estimatedCostUsd: 2, calls: 1 }) }, ["staff"]),
        day("fam-booth", { creative_low_risk: route({ pricedCalls: 1, estimatedCostUsd: 0.25, calls: 1 }) }, ["booth"]),
        day(null, { coach_high_stakes: route({ pricedCalls: 1, estimatedCostUsd: 0.1, calls: 1 }) }),
      ],
    });
    expect(report.activeHouseholds).toBe(2);
    expect(report.householdsFolded).toBe(0);
    expect(report.estimatedCostUsd).toBe(0.5);
    expect(report.perActiveFamilyUsd).toBe(0.25);
    expect(report.excludedCostUsd).toBe(2.25);
    expect(report.unattributedUsd).toBe(0.1);
    expect(report.rows.map((r) => r.familyId)).toEqual(["fam-booth", "fam-owner", "fam-staff"]);
    expect(report.billMatch).toBe("partial");
    expect(scanForbiddenKeys(report)).toEqual([]);
  });

  it("names routes with no price, including spend outside the family cohort", () => {
    const report = familyDailyCostReport({
      date: DATE,
      coParents: [],
      rollups: [rollup("owner", "family"), rollup("staff", "internal")],
      costs: [
        day("fam-owner", {
          book_narration: route({ unpricedCalls: 1, calls: 1 }),
          speech_synthesis: route({ unpricedCalls: 2, calls: 4, pricedCalls: 2, estimatedCostUsd: 0.06 }),
        }, ["owner"]),
        day("fam-staff", { realtime_audio: route({ unpricedCalls: 3, calls: 3, observedMs: 9000 }) }, ["staff"]),
      ],
    });
    expect(report.gaps).toEqual([
      { route: "book_narration", calls: 1, reason: "no price" },
      { route: "realtime_audio", calls: 3, reason: "no billed audio price" },
      { route: "speech_synthesis", calls: 2, reason: "no price" },
    ]);
    expect(report.estimatedCostUsd).toBe(0.06);
    expect(scanForbiddenKeys(report)).toEqual([]);
  });

  it("drops a Hebrew name from the cost row and still redacts it on the way to a model", () => {
    const row = familyCostFields(input({ familyId: "מאיה", uid: "מאיה" }), DATE);
    expect(JSON.stringify(row)).not.toContain("מאיה");
    expect(row).toMatchObject({ id: `unattributed_${DATE}`, fields: { familyId: null } });
    const redacted = createRedaction("מאיה").redact("שלום מאיה");
    expect(redacted).not.toContain("מאיה");
  });

  it("a studio paint does not write the family day; a family call does", async () => {
    const writes: { id: string }[] = [];
    _setFamilyCostDb({ collection: () => ({ doc: (id: string) => ({ set: async () => { writes.push({ id }); } }) }) } as never);
    const meta = { route: "creative_low_risk" as const, provider: "vertex_gemini" as const, model: "image-model-under-test" };
    const usage = { promptTokenCount: 10, candidatesTokenCount: 4, totalTokenCount: 14 };
    await runAsStudioProduction(studioAsset("plan-plate", "plan-poo-sit/PP1")!, "image", async () => {
      recordUsage(meta, usage, { totalMs: 10 });
    });
    expect(writes).toEqual([]);
    recordUsage(meta, usage, { totalMs: 10 });
    expect(writes).toHaveLength(1);
  });

  it("Live observed time is an unpriced gap: no audio seconds, no price, no transcript", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(`${DATE}T12:00:00Z`));
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const writes: { id: string; fields: Record<string, unknown> }[] = [];
    _setFamilyCostDb({ collection: () => ({ doc: (id: string) => ({ set: async (fields: Record<string, unknown>) => { writes.push({ id, fields }); } }) }) } as never);
    const store = new MemoryLiveUsageStore();
    const id = await store.create({ uid: "parent", familyId: "fam_1", plan: "free", model: "gemini-live-test", expiresAt: Date.now() + 180_000 });
    await store.report("parent", id, "opened");
    expect(writes).toEqual([]);
    vi.setSystemTime(Date.now() + 10_000);
    await store.report("parent", id, "closed");
    const line = spy.mock.calls.filter((c) => c[0] === "ai.usage").map((c) => c[1] as Record<string, unknown>);
    expect(line).toHaveLength(1);
    expect(line[0]).toMatchObject({ route: "realtime_audio", observedMs: 10_000, billingVerified: false, familyId: "fam_1", retries: 0, fallback: false, chargedFailure: false });
    expect(line[0]).not.toHaveProperty("estimatedCostUsd");
    expect(line[0]).not.toHaveProperty("audioSeconds");
    expect(JSON.stringify(line[0])).not.toMatch(/transcript|מאיה/);
    expect(writes.map((w) => w.id)).toEqual([`fam_1_${DATE}`]);
    recordLiveCost({ uid: "parent", familyId: "מאיה", model: "gemini-live-test", plan: "free", deltaMs: 1000, incomplete: false, sessionId: id });
    const hebrew = spy.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(hebrew.familyId).toBeNull();
    expect(JSON.stringify(hebrew)).not.toContain("מאיה");
  });

  it("a local server still returns the partial report without reading Firestore", async () => {
    const store = { mode: "null", listRetentionRollups: async () => [], listEvents: async () => [] } as CohortMetricsStore;
    const report = await loadFamilyDailyCostReport(createTestConfig(), store, DATE);
    expect(report).toMatchObject({ date: DATE, billMatch: "partial", householdsFolded: null, gaps: [], rows: [] });
  });
});
