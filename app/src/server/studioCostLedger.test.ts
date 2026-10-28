/**
 * B-KID-150 — "a ledger row per asset with actual billed cost; B-GA-26's
 * family meter excludes it by construction (test)". A model or TTS call made
 * as the production of a shared asset lands in that asset's studio ledger row
 * and never in usageRollup/{day} (the only source of costPerActiveFamily);
 * the same call outside a studio scope is family usage, as before. The
 * actual billed cost arrives only from the bill import and is never inferred.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rollup = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("./usageRollup.js", async (original) => ({
  ...(await original<typeof import("./usageRollup.js")>()),
  recordUsageRollup: (...args: unknown[]) => { rollup.calls.push(args); },
}));

import { recordUsage } from "../ai/usage.js";
import { recordTtsUsage } from "../ai/ttsUsage.js";
import {
  _setStudioLedgerDb, billRowFields, billRowProblems, currentStudioScope, runAsStudioProduction, studioAsset, studioAssetKey, studioCostReport, studioUsageFields, STUDIO_COST_LEDGER_COLLECTION,
} from "./studioCostLedger.js";
import { asStudioPlanPlateGenerate, planPlateStudioAsset } from "./studioPlanPlates.js";
import { planPlatePrompt } from "./planPlates.js";
import { PLAN_PLATE_BRIEFS } from "../lib/library/plans/planPlates.js";
import { OTHER_FIRESTORE_COLLECTIONS } from "../lib/childDataSinks.js";
import type { PatternId } from "../lib/library/types.js";

const writes: { collection: string; id: string; fields: Record<string, unknown> }[] = [];
const fakeDb = { collection: (collection: string) => ({ doc: (id: string) => ({ set: async (fields: Record<string, unknown>) => { writes.push({ collection, id, fields }); } }) }) };
const imageMeta = { route: "creative_low_risk" as const, provider: "vertex_gemini" as const, model: "image-model-under-test" };
const textUsage = { promptTokenCount: 1200, candidatesTokenCount: 1290, totalTokenCount: 2490 };
const plate = studioAsset("plan-plate", "plan-poo-sit/PP1")!;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { writes.length = 0; rollup.calls.length = 0; _setStudioLedgerDb(fakeDb as never); });
afterEach(() => { _setStudioLedgerDb(null); });

describe("B-KID-150: studio production never reaches the family meter (by construction)", () => {
  it("a family call goes to the daily rollup; the same call as studio production goes to its asset's row only", async () => {
    recordUsage(imageMeta, textUsage, { totalMs: 900 });
    expect(rollup.calls).toHaveLength(1);
    expect(writes).toHaveLength(0);

    await runAsStudioProduction(plate, "image", async () => {
      await flush(); // the scope survives the provider's awaits
      recordUsage(imageMeta, textUsage, { totalMs: 900 });
    });
    await flush();
    expect(rollup.calls).toHaveLength(1); // unchanged: the family meter never saw it
    expect(writes).toHaveLength(1);
    expect(writes[0].collection).toBe(STUDIO_COST_LEDGER_COLLECTION);
    expect(writes[0].id).toBe("plan-plate:plan-poo-sit~PP1");
    expect(writes[0].fields).toMatchObject({ asset: "plan-plate:plan-poo-sit~PP1", kind: "plan-plate", ref: "plan-poo-sit/PP1" });
  });

  it("the TTS slice too: a shared narration render is studio spend", async () => {
    recordTtsUsage("voice-under-test", "en", 1000, 400);
    expect(rollup.calls).toHaveLength(1);
    runAsStudioProduction(studioAsset("narration-set", "five-smooth-stones/shared-v3")!, "tts", () => recordTtsUsage("voice-under-test", "en", 1000, 400));
    await flush();
    expect(rollup.calls).toHaveLength(1);
    expect(writes.map((w) => w.id)).toEqual(["narration-set:five-smooth-stones~shared-v3"]);
  });

  it("a family call running at the same time as a studio paint stays family usage (no scope leak)", async () => {
    const studio = runAsStudioProduction(plate, "image", async () => { await flush(); recordUsage(imageMeta, textUsage, { totalMs: 1 }); });
    recordUsage(imageMeta, textUsage, { totalMs: 1 });
    await studio;
    expect(currentStudioScope()).toBeUndefined();
    expect(rollup.calls).toHaveLength(1);
    expect(writes).toHaveLength(1);
  });

  it("the family meter reads usageRollup only, never the studio ledger", () => {
    const metrics = readFileSync(new URL("./adminMetrics.ts", import.meta.url), "utf8");
    expect(metrics).toMatch(/collection\("usageRollup"\)/);
    expect(metrics).not.toMatch(/studioCostLedger|STUDIO_COST/);
  });

  it("the ledger is a registered aggregate: no uid, family, child or content key in a row", () => {
    expect(OTHER_FIRESTORE_COLLECTIONS[STUDIO_COST_LEDGER_COLLECTION]).toMatch(/^aggregate: /);
    const keys = JSON.stringify(Object.keys(studioUsageFields(plate, { modality: "image", estimatedCostUsd: 0.04, failed: true })));
    expect(keys).not.toMatch(/uid|child|family|name|email|prompt|text/i);
  });
});

describe("B-KID-150: the in-product plan-plate painter is studio production", () => {
  it("every plate's paint prompt maps back to its own plate; an unknown prompt still lands in the ledger", () => {
    let n = 0;
    for (const [pattern, specs] of Object.entries(PLAN_PLATE_BRIEFS)) for (const id of Object.keys(specs ?? {})) {
      expect(planPlateStudioAsset(planPlatePrompt(pattern as PatternId, id)!)).toEqual({ kind: "plan-plate", ref: `${pattern}/${id}` });
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(64);
    expect(planPlateStudioAsset("something else").ref).toMatch(/^unmatched\/[0-9a-f]{16}$/);
  });

  it("the wrapped generate runs inside its plate's image scope; the route wires it", async () => {
    const prompt = planPlatePrompt("plan-poo-sit", "PP3")!;
    const seen = await asStudioPlanPlateGenerate(async (o: { prompt: string }) => currentStudioScope())({ prompt });
    expect(seen).toEqual({ asset: { kind: "plan-plate", ref: "plan-poo-sit/PP3" }, modality: "image" });
    const api = readFileSync(new URL("../routes/api.ts", import.meta.url), "utf8");
    expect(api).toContain("generate: asStudioPlanPlateGenerate((o) => modelProvider.generateImage(o))");
    expect(readFileSync(new URL("./createApp.ts", import.meta.url), "utf8")).toContain("initStudioCostLedger(config);");
  });
});

describe("B-KID-150: a row per asset, the actual billed cost, per accepted second", () => {
  it("asset ids are a known kind and a path-safe ref", () => {
    expect(studioAssetKey(studioAsset("book-plate", "five-smooth-stones/PL1")!)).toBe("book-plate:five-smooth-stones~PL1");
    for (const [k, r] of [["child-sprite", "x"], ["book-plate", "../x"], ["book-plate", "a/b/c/d"], ["video", ""]]) expect(studioAsset(k, r), `${k}:${r}`).toBeNull();
  });

  it("billed cost is null until the bill is reconciled; per accepted second only when both are known; unpriced calls are counted, never 0", () => {
    const report = studioCostReport([
      { asset: "book-plate:five-smooth-stones~PL1", kind: "book-plate", ref: "five-smooth-stones/PL1", calls: { image: 4 }, estimatedCostUsd: 0.16, pricedCalls: 4 },
      { asset: "narration-set:five-smooth-stones~shared-v3", kind: "narration-set", ref: "five-smooth-stones/shared-v3", offlineCalls: { tts: 51 }, billedCostUsd: 1.53, billedSource: "billing-export", billedPeriod: "2026-10", acceptedSeconds: 612 },
      { asset: "video:ten-videos~v1", kind: "video", ref: "ten-videos/v1", calls: { video: 2 }, unpricedCalls: 2 },
    ]);
    expect(report.assets.map((a) => [a.asset, a.calls, a.billedCostUsd, a.estimatedCostUsd, a.billedPerAcceptedSecondUsd, a.unpricedCalls])).toEqual([
      ["book-plate:five-smooth-stones~PL1", 4, null, 0.16, null, 0],
      ["narration-set:five-smooth-stones~shared-v3", 51, 1.53, null, 0.0025, 0],
      ["video:ten-videos~v1", 2, null, null, null, 2],
    ]);
    expect(report.billedTotalUsd).toBe(1.53);
    expect(report.unreconciledAssets).toBe(2);
  });

  it("a bill row is validated and SETS the billed cost (never adds); a bad row is refused", () => {
    const row = { kind: "book-plate", ref: "five-smooth-stones/PL1", billedCostUsd: 0.42, billedSource: "billing-export" as const, billedPeriod: "2026-10", calls: { image: 6 } };
    expect(billRowProblems(row)).toEqual([]);
    expect(billRowFields(row)).toEqual({ key: "book-plate:five-smooth-stones~PL1", fields: { asset: "book-plate:five-smooth-stones~PL1", kind: "book-plate", ref: "five-smooth-stones/PL1", billedCostUsd: 0.42, billedSource: "billing-export", billedPeriod: "2026-10", offlineCalls: { image: 6 } } });
    expect(billRowProblems({ ...row, kind: "child-sprite", billedCostUsd: -1, billedSource: "guess" as never, billedPeriod: "Oct", calls: { image: 1.5 } })).toHaveLength(5);
  });
});
