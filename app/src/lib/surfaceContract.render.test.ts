/**
 * Item 11 (IA-02, re-evidenced) — the surface contract becomes measurable.
 *
 * The declaration was never the gap. `SURFACE_CONTRACTS` has carried a job, a
 * primaryMove and a moduleBudget for 43 routes since Heartwood; `moduleBudget`
 * was enforced on ONE of them, `data-primary-move` occurred zero times in the
 * DOM, and `surfaceContract.ts` was imported by three components. A purpose
 * nobody can measure is not enforced.
 *
 * The framework half is three pieces, and this file guards all three:
 *   1. `contractFor(route)` — the lookup a render tree can reach.
 *   2. Shell's <SurfaceFrame> — stamps `data-route` + `data-module-budget` on
 *      the active tab, in `display: contents` so no box is added.
 *   3. scripts/framework-check.mjs — walks every ROUTE_IDS leaf and requires
 *      ≥1 `data-module` and exactly one `data-primary-move`, with a
 *      KNOWN_UNSTAMPED ratchet seeded with every leaf unstamped on 2026-09-07.
 *
 * THE RATCHET IS THE POINT. The seed below is frozen. The check's list may only
 * ever be a subset of it: removing a route (because its leaf got stamped) is
 * the only legal edit. Adding one — the way a stale hex allow-list or a raised
 * budget quietly re-opens a closed gate — fails here.
 *
 * There is no jsdom in this repo, so the stamps are asserted as source facts;
 * the rendered sweep (module count ≤ budget at 390, one primary move above the
 * fold) stays the orchestrator's, against the same attributes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_IDS, type ActiveTab } from "./routes";
import { SURFACE_CONTRACTS, contractFor } from "./surfaceContract";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(APP, rel), "utf8").replace(/\r\n/g, "\n");

const CHECK = read("scripts/framework-check.mjs");
const SHELL = read("src/components/layout/Shell.tsx");

/* ── 1 · the lookup ───────────────────────────────────────────────────────── */

describe("contractFor — the reachable half of the manifest", () => {
  it("returns the contract whose route matches, for every declared surface", () => {
    for (const contract of SURFACE_CONTRACTS) {
      expect(contractFor(contract.route), contract.route).toBe(contract);
    }
  });

  it("resolves for every ROUTE_IDS entry (SC-1 completeness, read through the lookup)", () => {
    const missing = ROUTE_IDS.filter((route) => !contractFor(route));
    expect(missing).toEqual([]);
  });

  it("negative control: an id that is not a route returns undefined, not a guess", () => {
    expect(contractFor("not-a-route" as ActiveTab)).toBeUndefined();
  });
});

/* ── 2 · the frame ────────────────────────────────────────────────────────── */

describe("SurfaceFrame — the contract reaches the DOM without changing layout", () => {
  it("Shell wraps the active tab in a frame stamped with route and budget", () => {
    expect(SHELL).toContain('import { contractFor } from "../../lib/surfaceContract";');
    expect(SHELL).toMatch(/<SurfaceFrame route=\{activeTab\}>\s*\n\s*<ActiveTabComponent \/>\s*\n\s*<\/SurfaceFrame>/);
    const frame = SHELL.slice(SHELL.indexOf("function SurfaceFrame"), SHELL.indexOf("export default function Shell"));
    expect(frame).toContain("const contract = contractFor(route);");
    expect(frame).toContain("data-route={route}");
    expect(frame).toMatch(/data-module-budget=\{contract \? String\(contract\.moduleBudget\) : undefined\}/);
  });

  it("the frame adds no box — display:contents, no className, no padding", () => {
    const frame = SHELL.slice(SHELL.indexOf("function SurfaceFrame"), SHELL.indexOf("export default function Shell"));
    expect(frame).toContain('style={{ display: "contents" }}');
    expect(frame).not.toContain("className=");
  });

  it("an unbudgeted route is omitted, not zeroed (undefined ≠ a budget of nothing)", () => {
    const frame = SHELL.slice(SHELL.indexOf("function SurfaceFrame"), SHELL.indexOf("export default function Shell"));
    expect(frame).not.toMatch(/data-module-budget=\{[^}]*\?\?\s*0/);
    expect(frame).not.toMatch(/data-module-budget="0"/);
  });
});

/* ── 3 · the ratchet ──────────────────────────────────────────────────────── */

/**
 * FROZEN 2026-09-07. Measured, not assumed: `data-module` and
 * `data-primary-move` each occurred ZERO times in src/components before item
 * 11, so the seed is every route Shell's tabRegistry resolves. Entries may be
 * DELETED as leaves get stamped. Nothing may ever be added.
 */
const SEEDED_UNSTAMPED: readonly string[] = [
  "overview", "coach", "behaviors", "milestones", "plans",
  "stories", "weekly", "scholar", "language", "handoff",
  "safety", "profile", "memory", "strengths", "screening",
  "timeline", "journal", "find-pro", "care-team", "appointments",
  "sharing", "reports", "masterclasses", "learn", "family",
  "comics", "speech", "mimic", "feelings", "journey",
  "adventures", "copilot", "development", "daily-play", "practice",
  "consult", "attribution", "day-windows", "smart-reminders", "science",
  "school-brief", "bedtime-stories", "routines",
];

/** The routes the shipped check currently exempts. */
function knownUnstamped(source: string): string[] {
  const block = source.match(/const KNOWN_UNSTAMPED = new Set\(\[([\s\S]*?)\]\);/);
  expect(block, "KNOWN_UNSTAMPED not found in framework-check.mjs").toBeTruthy();
  return [...block![1].matchAll(/"([a-zA-Z-]+)"/g)].map((m) => m[1]);
}

describe("KNOWN_UNSTAMPED is a shrink-only ratchet", () => {
  const current = knownUnstamped(CHECK);

  /**
   * The ratchet reached ZERO on 2026-09-07 — all 43 leaves are stamped and the
   * shipped list is empty. An empty read is therefore the CORRECT answer, which
   * is exactly the answer a broken parser also gives, so honesty can no longer
   * be shown by a non-empty result. It is shown instead against a seeded copy of
   * the same source: the parser must find an entry that is really there, and
   * find nothing in the file that really has none.
   */
  it("the parser really reads the list (guard stays honest at zero)", () => {
    expect(new Set(current).size).toBe(current.length);
    expect(current).toEqual([]);
    const seeded = knownUnstamped(
      CHECK.replace("const KNOWN_UNSTAMPED = new Set([", 'const KNOWN_UNSTAMPED = new Set([\n  "overview",'),
    );
    expect(seeded).toEqual(["overview"]);
  });

  it("every route is enforced — the exempt set is empty, not merely small", () => {
    expect(current.length).toBe(0);
    expect(SEEDED_UNSTAMPED.length).toBe(43);
  });

  it("every exemption is a real route", () => {
    const routes = new Set<string>(ROUTE_IDS);
    expect(current.filter((r) => !routes.has(r))).toEqual([]);
  });

  it("the list only ever shrinks — nothing outside the frozen seed may appear", () => {
    const seed = new Set(SEEDED_UNSTAMPED);
    const added = current.filter((r) => !seed.has(r));
    expect(
      added,
      `these routes were added to KNOWN_UNSTAMPED after the freeze — stamp the leaf instead: ${added.join(", ")}`,
    ).toEqual([]);
    expect(current.length).toBeLessThanOrEqual(SEEDED_UNSTAMPED.length);
  });

  it("negative control: a list that grew is rejected by the same subset test", () => {
    const grown = knownUnstamped(
      CHECK.replace('const KNOWN_UNSTAMPED = new Set([', 'const KNOWN_UNSTAMPED = new Set([\n  "a-new-hub",'),
    );
    const seed = new Set(SEEDED_UNSTAMPED);
    expect(grown.filter((r) => !seed.has(r))).toEqual(["a-new-hub"]);
  });
});

describe("the check itself enforces what it claims", () => {
  it("it requires ≥1 data-module and exactly one data-primary-move per unexempt leaf", () => {
    expect(CHECK).toContain("const modules = (source.match(/\\bdata-module\\b(?!-)/g) || []).length;");
    expect(CHECK).toContain("const moves = (source.match(/\\bdata-primary-move\\b(?!-)/g) || []).length;");
    expect(CHECK).toContain("has no data-module stamp");
    expect(CHECK).toContain("data-primary-move stamps, expected exactly 1");
  });

  it("it strips comments first — prose about a stamp is not a stamp", () => {
    expect(CHECK).toContain("const stripComments =");
    expect(CHECK).toMatch(/const source = stripComments\(fs\.readFileSync\(file, "utf8"\)\);/);
  });

  it("it resolves leaves from Shell's own registry and fails if the parse drifts", () => {
    expect(CHECK).toContain("const tabRegistry");
    expect(CHECK).toContain("the parser has drifted from the source");
    expect(CHECK).toContain('leaf file missing for route');
  });

  it("an exemption for a route Shell does not host is a failure, not a shrug", () => {
    expect(CHECK).toContain("which is not a route in Shell's tabRegistry");
  });
});
