// B-INF-11: the rendered sweep finishes inside a bound, measures overlays settled, and says why.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_CELL_BUDGET_MS, STATE_CELL_BUDGET_MS, WARMUP_BOUND_MS, raceBound, settleOverlayGeometry, sweepDeadlineMs } from "./capture/sweep-bound.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const sweep = readFileSync(path.join(scripts, "rendered-sweep.mjs"), "utf8");

describe("sweep bounds", () => {
  it("derives the run deadline from its cells, and --deadline overrides it", () => {
    expect(sweepDeadlineMs({ baseCells: 172, stateCells: 194 })).toBe(WARMUP_BOUND_MS + 172 * BASE_CELL_BUDGET_MS + 194 * STATE_CELL_BUDGET_MS);
    expect(sweepDeadlineMs({ baseCells: 20, minutes: 15 })).toBe(15 * 60_000);
    expect(() => sweepDeadlineMs({ baseCells: 20, minutes: 0 })).toThrow("SWEEP_DEADLINE_INVALID");
    expect(() => sweepDeadlineMs({ baseCells: -1 })).toThrow("SWEEP_DEADLINE_INVALID");
  });

  it("bounds one cell: a page that never answers resolves timedOut instead of holding the run", async () => {
    vi.useFakeTimers();
    try {
      const never = new Promise(() => {});
      const pending = raceBound(never, 1_000);
      await vi.advanceTimersByTimeAsync(1_001);
      await expect(pending).resolves.toEqual({ timedOut: true });
      await expect(raceBound(Promise.resolve(7), 1_000)).resolves.toEqual({ timedOut: false, value: 7 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("overlay settle (runs in the page)", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A Modal opening as motion/react draws it: scale 0.95 on its first frames, then identity. */
  function stubDialog(frames: Array<{ transform: string; opacity: string }>) {
    let frame = 0;
    const current = () => frames[Math.min(frame, frames.length - 1)];
    const scale = () => { const m = /matrix\(([\d.]+)/.exec(current().transform); return m ? Number(m[1]) : 1; };
    const dialog = {
      nodeType: 1,
      parentElement: null,
      getBoundingClientRect: () => ({ left: 16, top: 100, width: 343 * scale(), height: 300 * scale() }),
      checkVisibility: () => true,
    };
    vi.stubGlobal("document", { querySelectorAll: () => [dialog] });
    vi.stubGlobal("getComputedStyle", () => ({ transform: current().transform, opacity: current().opacity }));
    vi.stubGlobal("performance", { now: () => frame * 16 });
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { frame++; cb(); return frame; });
    return { frameAt: () => frame };
  }

  it("does not measure a dialog on its 0.95-scale first frame; it waits until the layer is unscaled and still", async () => {
    const opening = [
      { transform: "matrix(0.95, 0, 0, 0.95, 0, 12)", opacity: "0.6" },
      { transform: "matrix(0.95, 0, 0, 0.95, 0, 12)", opacity: "0.7" },
      { transform: "none", opacity: "0.8" },
      { transform: "none", opacity: "0.9" },
      { transform: "none", opacity: "1" },
    ];
    const page = stubDialog(opening);
    const result = await settleOverlayGeometry(1_500);
    expect(result.settled).toBe(true);
    // Settled only after the scale is gone AND two frames read the same box and opacity.
    expect(page.frameAt()).toBeGreaterThanOrEqual(5);
  });

  it("gives up at its budget on a layer that never settles, and says so", async () => {
    stubDialog([{ transform: "matrix(0.95, 0, 0, 0.95, 0, 12)", opacity: "1" }]);
    const result = await settleOverlayGeometry(200);
    expect(result).toMatchObject({ settled: false });
  });

  it("is wired before the record, beside the readiness, origin and stamp fixes", () => {
    const settleAt = sweep.indexOf("await page.evaluate(settleOverlayGeometry, SETTLE_BUDGET_MS)");
    expect(settleAt).toBeGreaterThan(0);
    expect(settleAt).toBeLessThan(sweep.indexOf("rec = await page.evaluate(collect,"));
    // ready includes the text faces
    expect(sweep).toContain("document.fonts.ready.then(() => document.fonts.status === \"loaded\")");
    // the server is asked as the page asks: with its own Origin (CORS_ORIGINS omission = blank sandbox)
    expect(sweep).toContain("headers: { Origin: base }");
    expect(sweep).toContain("Start the sandbox with CORS_ORIGINS=");
    // a warm-up that never reaches ready ends the run with its cause (exit 2), not 172 blank cells
    expect(sweep).toMatch(/warm-up did not reach ready[\s\S]{0,400}\n\s+2,\n/);
    // the first rendered stamp, never a hidden 0×0 one
    expect(sweep).not.toContain('const pmEl = document.querySelector("[data-primary-move]")');
    expect(sweep).toContain('[...document.querySelectorAll("[data-primary-move]")].find(');
    // a clipped sr-only control (the skip link) is not counted as a sub-44 tap target
    expect(sweep).toContain("if (/^inset\\(50%\\)$/.test(clipCs.clipPath)");
    // a failed state names its thrown message, not only its category
    expect(sweep).toContain("...(message ? { message } : {}), retryable:");
    // --report-only still exits 0 and --diff still prints the same lines
    expect(sweep).toContain("if (!opts.reportOnly) process.exitCode = SWEEP_LAW_EXIT;");
    expect(sweep).toContain("console.log(`DIFF changed=${d.changed} cells`);");
    // --viewport takes a comma list of matrix-of-record ids (cut a run to wide-en,mobile-he)
    expect(sweep).toContain('out.viewport = next().split(",")');
  });
});
