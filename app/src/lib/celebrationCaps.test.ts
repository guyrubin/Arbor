/**
 * celebrationCaps.test.ts — Heartwood Law 2 / Law 7 "celebration caps" guard
 * (Wave T: CR-05, LC-03, KID-15, GP-24).
 *
 * Four contracts, enforced on every run:
 *  1. `lib/celebrate.ts` is the ONLY module in src/** that imports (or calls)
 *     `canvas-confetti`. Every burst in the app routes through `celebrate()`,
 *     so the caps live in one place.
 *  2. No `particleCount:` literal anywhere in src/** exceeds 12, and every
 *     `particleCount:` value is either a literal ≤ 12 or the shared constant
 *     (the old `Math.floor(150 * ratio)` bypass is forbidden too).
 *  3. `celebrate()` never calls confetti under prefers-reduced-motion; when
 *     motion is allowed it fires ONE burst of ≤12 particles with ≤48 ticks
 *     (≈800 ms at 60 fps), brand colours, `disableForReducedMotion: true`, and
 *     hard-stops the canvas at ≤800 ms.
 *  4. Negative controls keep the scanners honest: the pre-fix patterns
 *     (`particleCount: 90`, a direct import, a ratio expression) must FAIL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Hoisted: the ONLY consumer (lib/celebrate.ts) sees this double.
vi.mock("canvas-confetti", () => {
  const fire = vi.fn();
  return { default: Object.assign(fire, { reset: vi.fn() }) };
});

import confetti from "canvas-confetti";
import { BRAND_CONFETTI } from "./tokens";
import {
  CELEBRATION_MAX_DURATION_MS,
  CELEBRATION_MAX_PARTICLES,
  celebrate,
} from "./celebrate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..");
const ALLOWED_IMPORTER = path.join(SRC, "lib", "celebrate.ts");

/* ── Source scan ────────────────────────────────────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__snapshots__" || name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

const SCAN_FILES = walk(SRC);
const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, "/");

/** Any static/dynamic import or require of the confetti library. */
const CONFETTI_IMPORT = /from\s+["']canvas-confetti["']|(?:require|import)\(\s*["']canvas-confetti["']\s*\)/;
/** A direct `confetti(...)` call (not `celebrate(...)`, not `.reset()`). */
const CONFETTI_CALL = /(^|[^\w.$])confetti\s*\(/m;
/** GP-24's forbidden literal: 13–99 or any 3+ digit particle count. */
const FORBIDDEN_LITERAL = /particleCount\s*:\s*(1[3-9]|[2-9]\d|\d{3,})\b/;
/** Every `particleCount:` value, for the whitelist check. */
const PARTICLE_VALUE = /particleCount\s*:\s*([^,}\n]+)/g;

function particleValues(src: string): string[] {
  return [...src.matchAll(PARTICLE_VALUE)].map((m) => m[1].trim());
}
const valueAllowed = (v: string) =>
  v === "CELEBRATION_MAX_PARTICLES" || (/^\d+$/.test(v) && Number(v) <= CELEBRATION_MAX_PARTICLES);

describe("celebration caps — lib/celebrate.ts is the ONLY confetti importer", () => {
  it("scans a real, non-trivial tree that includes the allowed importer", () => {
    expect(SCAN_FILES.length).toBeGreaterThan(50);
    expect(SCAN_FILES).toContain(ALLOWED_IMPORTER);
  });

  it("no file other than lib/celebrate.ts imports canvas-confetti", () => {
    const offenders = SCAN_FILES.filter(
      (f) => f !== ALLOWED_IMPORTER && CONFETTI_IMPORT.test(stripComments(readFileSync(f, "utf8"))),
    ).map(rel);
    expect(offenders).toEqual([]);
    // Positive control: the allowed importer really does import it.
    expect(CONFETTI_IMPORT.test(readFileSync(ALLOWED_IMPORTER, "utf8"))).toBe(true);
  });

  it("no file other than lib/celebrate.ts calls confetti( directly", () => {
    const offenders = SCAN_FILES.filter(
      (f) => f !== ALLOWED_IMPORTER && CONFETTI_CALL.test(stripComments(readFileSync(f, "utf8"))),
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("celebration caps — particleCount stays ≤ 12 everywhere in src/**", () => {
  it("the shared caps are at or under Law 7", () => {
    expect(CELEBRATION_MAX_PARTICLES).toBeLessThanOrEqual(12);
    expect(CELEBRATION_MAX_DURATION_MS).toBeLessThanOrEqual(800);
  });

  it("no particleCount literal > 12 anywhere", () => {
    const offenders = SCAN_FILES.filter((f) => FORBIDDEN_LITERAL.test(stripComments(readFileSync(f, "utf8")))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("every particleCount value is a literal ≤ 12 or the shared constant (no ratio expressions)", () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const f of SCAN_FILES) {
      for (const v of particleValues(stripComments(readFileSync(f, "utf8")))) {
        seen += 1;
        if (!valueAllowed(v)) offenders.push(`${rel(f)}: particleCount: ${v}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(seen).toBeGreaterThanOrEqual(1); // the scanner actually found the one in lib/celebrate.ts
  });
});

describe("celebration caps — negative controls (pre-fix patterns must fail)", () => {
  it("particleCount: 90 (MilestonesTab/Masterclasses pre-fix) is caught", () => {
    expect(FORBIDDEN_LITERAL.test("confetti({\n    particleCount: 90,\n    spread: 70,")).toBe(true);
    expect(FORBIDDEN_LITERAL.test("confetti({ particleCount: 120, spread: 90 })")).toBe(true);
    expect(FORBIDDEN_LITERAL.test("confetti({ particleCount: 70, spread: 70 })")).toBe(true);
    expect(FORBIDDEN_LITERAL.test("particleCount: 13")).toBe(true);
  });

  it("particleCount: 12 and the shared constant pass", () => {
    expect(FORBIDDEN_LITERAL.test("particleCount: 12")).toBe(false);
    expect(valueAllowed("12")).toBe(true);
    expect(valueAllowed("CELEBRATION_MAX_PARTICLES")).toBe(true);
  });

  it("the playkit pre-fix ratio expression is caught by the whitelist check", () => {
    const fixture = "confetti({ particleCount: Math.floor(150 * particleRatio), ...opts })";
    expect(particleValues(fixture)).toEqual(["Math.floor(150 * particleRatio)"]);
    expect(valueAllowed("Math.floor(150 * particleRatio)")).toBe(false);
  });

  it("a direct import / call in a tab is caught", () => {
    expect(CONFETTI_IMPORT.test('import confetti from "canvas-confetti";')).toBe(true);
    expect(CONFETTI_IMPORT.test('const confetti = require("canvas-confetti");')).toBe(true);
    expect(CONFETTI_CALL.test("    confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });")).toBe(true);
    // ...and the routed call is not.
    expect(CONFETTI_CALL.test('    celebrate({ kind: "choice" });')).toBe(false);
    expect(CONFETTI_CALL.test("    confetti.reset();")).toBe(false);
  });
});

/* ── Runtime: reduced motion + caps on the actual call ──────────────────── */

type WindowDouble = {
  matchMedia: (q: string) => { matches: boolean };
  setTimeout: (fn: () => void, ms?: number) => number;
  clearTimeout: (id: number) => void;
};

function stubWindow(reduced: boolean): void {
  const w: WindowDouble = {
    matchMedia: vi.fn((q: string) => ({ matches: reduced && q.includes("prefers-reduced-motion") })),
    // Delegate at call time so vi.useFakeTimers() intercepts.
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id) => globalThis.clearTimeout(id),
  };
  vi.stubGlobal("window", w);
}

const fire = confetti as unknown as ReturnType<typeof vi.fn> & { reset: ReturnType<typeof vi.fn> };

describe("celebrate() — runtime caps + reduced-motion gate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fire.mockClear();
    fire.reset.mockClear();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does NOT call confetti when prefers-reduced-motion matches (all kinds)", () => {
    stubWindow(true);
    for (const kind of ["milestone", "choice", "complete", "lesson", "play"] as const) celebrate({ kind });
    expect(fire).not.toHaveBeenCalled();
    expect(fire.reset).not.toHaveBeenCalled();
  });

  it("is a no-op outside a browser (no window)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => celebrate({ kind: "play" })).not.toThrow();
    expect(fire).not.toHaveBeenCalled();
  });

  it("fires ONE capped, brand-coloured burst and hard-stops within 800 ms", () => {
    stubWindow(false);
    celebrate({ kind: "complete" });
    expect(fire).toHaveBeenCalledTimes(1);
    const opts = fire.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.particleCount).toBe(CELEBRATION_MAX_PARTICLES);
    expect(opts.particleCount as number).toBeLessThanOrEqual(12);
    expect(opts.ticks as number).toBeLessThanOrEqual(48); // ≈800 ms at 60 fps
    expect(opts.disableForReducedMotion).toBe(true);
    expect(opts.colors).toEqual([...BRAND_CONFETTI]);
    // Token colours only — no ad-hoc hex sneaks in at the call site.
    for (const c of opts.colors as string[]) expect(BRAND_CONFETTI).toContain(c);
    // Hard stop: reset() runs by the duration cap.
    expect(fire.reset).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CELEBRATION_MAX_DURATION_MS);
    expect(fire.reset).toHaveBeenCalledTimes(1);
  });

  it("overlapping bursts never extend the on-screen time past one cap", () => {
    stubWindow(false);
    celebrate({ kind: "choice" });
    vi.advanceTimersByTime(400);
    celebrate({ kind: "choice" }); // restarts the single hard-stop timer
    vi.advanceTimersByTime(CELEBRATION_MAX_DURATION_MS);
    expect(fire).toHaveBeenCalledTimes(2);
    expect(fire.reset).toHaveBeenCalledTimes(1); // one stop, ≤800 ms after the last burst
    expect(vi.getTimerCount()).toBe(0);
  });
});
