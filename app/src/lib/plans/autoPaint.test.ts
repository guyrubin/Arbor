/**
 * S1 (surfacing) 4(b) — the owner's auto-paint: a pattern with unpainted
 * plates starts ONE background run of the existing owner route and reports
 * "{done} of 8" until the first new plate lands; a fully painted pattern, a
 * storage-less server or a failed status read starts nothing; a remount in
 * the same session never starts a second run. The routes are mocked; the
 * controller never decides who is an owner (the composer passes the server's
 * flag; a family never reaches it).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAutoPaint, startAutoPaint, type AutoPaintState } from "./autoPaint";
import type { PlanPlateRun, PlanPlateStatus } from "./planApi";

const status = (painted: number, storage = true): PlanPlateStatus => ({
  storage,
  patterns: { "plan-poo-sit": Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`PP${i + 1}`, i < painted ? "painted" : "unpainted"])) } as PlanPlateStatus["patterns"],
  costPerImageUsd: 0.039, maxImagesPerRun: 80, maxUsdPerRun: 10,
});
const run: PlanPlateRun = { run: { planned: 8, painted: 8, failed: 0, skipped: 0, left: 0, stopped: null, estimatedUsd: 0.3, spentUsd: 0.3 }, results: [] };
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };

describe("startAutoPaint", () => {
  beforeEach(() => resetAutoPaint());

  it("unpainted plates: one paint call for the pattern, progress from the status, gone once the first new plate lands", async () => {
    const reads = [status(0), status(0), status(2), status(8)];
    const fetchStatus = vi.fn(async () => reads.shift() ?? status(8));
    let finish!: () => void;
    const paint = vi.fn(() => new Promise<PlanPlateRun>((r) => { finish = () => r(run); }));
    const seen: AutoPaintState[] = [];
    startAutoPaint("plan-poo-sit", (s) => seen.push(s), { fetchStatus, paint, sleep: tick, pollMs: 0 });
    await settle();
    expect(paint).toHaveBeenCalledTimes(1);
    expect(paint).toHaveBeenCalledWith({ pattern: "plan-poo-sit" });
    expect(seen[0]).toEqual({ painting: true, done: 0, total: 8 });
    expect(seen.at(-1)).toEqual({ painting: false, done: 2, total: 8 }); // the first plate landed: the line goes while the run continues
    finish();
    await settle();
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it("a fully painted pattern, no storage, or a failed read: nothing starts and nothing is reported", async () => {
    const paint = vi.fn(async () => run);
    const seen: AutoPaintState[] = [];
    startAutoPaint("plan-poo-sit", (s) => seen.push(s), { fetchStatus: async () => status(8), paint, sleep: tick, pollMs: 0 });
    startAutoPaint("plan-sleep-alone", (s) => seen.push(s), { fetchStatus: async () => status(0, false), paint, sleep: tick, pollMs: 0 });
    startAutoPaint("plan-dropoff", (s) => seen.push(s), { fetchStatus: async () => { throw new Error("403"); }, paint, sleep: tick, pollMs: 0 });
    await settle();
    expect(paint).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  });

  it("one run per pattern per session: a remount reports nothing and paints nothing again; stopping ends the reports", async () => {
    const paint = vi.fn(() => new Promise<PlanPlateRun>(() => { /* still painting */ }));
    const first: AutoPaintState[] = [];
    const stop = startAutoPaint("plan-poo-sit", (s) => first.push(s), { fetchStatus: async () => status(3), paint, sleep: tick, pollMs: 0 });
    await tick(); await tick();
    stop();
    await settle();
    expect(paint).toHaveBeenCalledTimes(1);
    expect(first[0]).toEqual({ painting: true, done: 3, total: 8 });
    expect(first.every((s) => s.painting)).toBe(true); // stopped before any "done" report
    const second: AutoPaintState[] = [];
    startAutoPaint("plan-poo-sit", (s) => second.push(s), { fetchStatus: async () => status(3), paint, sleep: tick, pollMs: 0 });
    await settle();
    expect(paint).toHaveBeenCalledTimes(1);
    expect(second).toEqual([]);
  });

  it("the run ends without a new plate (a failed paint): the line goes with the last count", async () => {
    const paint = vi.fn(async () => { throw new Error("plan_plates_cap"); });
    const seen: AutoPaintState[] = [];
    startAutoPaint("plan-poo-sit", (s) => seen.push(s), { fetchStatus: async () => status(1), paint, sleep: tick, pollMs: 0 });
    await settle();
    expect(seen[0]).toEqual({ painting: true, done: 1, total: 8 });
    expect(seen.at(-1)).toEqual({ painting: false, done: 1, total: 8 });
  });
});
