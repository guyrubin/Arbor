import { describe, it, expect } from "vitest";
import { ROUTE_IDS } from "./routes";
import { SECTIONS, TAB_SECTION_FALLBACK, primaryTabOf } from "./navigation";
import { TIMELINE_SOURCE_IDS } from "./signalTimeline";
import { SURFACE_CONTRACTS, HUB_IDS } from "./surfaceContract";

/**
 * Heartwood Law 1 — One Job, One Move (ARBOR-HEARTWOOD-MASTERPLAN-2026-08-16 §1).
 * Every surface declares one job in one sentence of parent language, offers
 * exactly one primary move, and holds a hard module budget. Everything else
 * earns a slot or is demoted somewhere it still lives — enforced in code, not
 * in review.
 *
 * Guards here: SC-1 (completeness), SC-3 (no orphan demotion), SC-4 (thread
 * integrity). SC-2 — the render-count budget test (≤ moduleBudget rendered
 * siblings and exactly one `data-primary-move` element per surface, from real
 * render conditions) — is the DECLARED FOLLOW-UP; its proven prototype is
 * components/overview/todayModules.ts + todayConsolidation.test.ts. That
 * prototype's hard-won lesson binds SC-2's implementation: budgets count the
 * modules that actually render, never a proxy (P1-B shipped six siblings
 * because the fold keyed off a content-governance gate that could never fire).
 */

describe("SC-1 — completeness: one contract per route, hubs real, hub leaves at depth 0", () => {
  it("declares exactly one contract per ROUTE_IDS entry — no extras, no duplicates", () => {
    const contractRoutes = SURFACE_CONTRACTS.map((c) => c.route);
    // No duplicates.
    expect(new Set(contractRoutes).size).toBe(contractRoutes.length);
    // Exactly the route set: same size + every route covered = no extras either.
    expect(contractRoutes.length).toBe(ROUTE_IDS.length);
    for (const route of ROUTE_IDS) {
      expect(contractRoutes, `route "${route}" has no surface contract`).toContain(route);
    }
  });

  it("HUB_IDS mirrors navigation SECTIONS exactly (id-for-id, in order)", () => {
    expect([...HUB_IDS]).toEqual(SECTIONS.map((s) => s.id));
  });

  it("every contract's hub is a real SECTIONS id", () => {
    const sectionIds = new Set(SECTIONS.map((s) => s.id));
    for (const c of SURFACE_CONTRACTS) {
      expect(sectionIds.has(c.hub), `contract "${c.route}" names unknown hub "${c.hub}"`).toBe(true);
    }
  });

  it("every depth-0 contract's route is its section's hub leaf — and every hub has exactly one", () => {
    const depthZero = SURFACE_CONTRACTS.filter((c) => c.depth === 0);
    // One depth-0 contract per hub, none missing, none doubled.
    expect(depthZero.map((c) => c.hub).sort()).toEqual([...HUB_IDS].sort());
    for (const c of depthZero) {
      const section = SECTIONS.find((s) => s.id === c.hub)!;
      expect(c.route, `depth-0 contract for hub "${c.hub}" must be its hub leaf`).toBe(primaryTabOf(section));
    }
  });

  it("every contract declares a non-empty job, primary move, and a positive budget", () => {
    for (const c of SURFACE_CONTRACTS) {
      expect(c.job.trim().length, `"${c.route}" has an empty job`).toBeGreaterThan(0);
      expect(c.primaryMove.trim().length, `"${c.route}" has an empty primaryMove`).toBeGreaterThan(0);
      expect(c.moduleBudget, `"${c.route}" budget must be a positive integer`).toBeGreaterThan(0);
      expect(Number.isInteger(c.moduleBudget)).toBe(true);
    }
  });
});

describe("SC-3 — no orphan demotion: every demotion target is disclosure or a live, reachable route", () => {
  // The full reachable set navigation exposes: hub items + curated sub-tabs +
  // per-hub tools + the deep-link fallback map (same union the 43-route nav
  // guard floor pins).
  const reachable = new Set<string>();
  for (const s of SECTIONS) {
    for (const i of s.items) reachable.add(i.tab);
    for (const i of s.primaryTabs) reachable.add(i.tab);
    for (const i of s.tools) reachable.add(i.tab);
  }
  for (const tab of Object.keys(TAB_SECTION_FALLBACK)) reachable.add(tab);

  it("every demotionTarget resolves", () => {
    const routeIds = new Set<string>(ROUTE_IDS);
    for (const c of SURFACE_CONTRACTS) {
      if (c.demotionTarget === "disclosure") continue;
      expect(routeIds.has(c.demotionTarget), `"${c.route}" demotes to unknown route "${c.demotionTarget}"`).toBe(true);
      expect(reachable.has(c.demotionTarget), `"${c.route}" demotes to unreachable route "${c.demotionTarget}"`).toBe(true);
    }
  });

  it("no surface demotes to itself", () => {
    for (const c of SURFACE_CONTRACTS) {
      expect(c.demotionTarget, `"${c.route}" demotes to itself`).not.toBe(c.route);
    }
  });
});

describe("SC-4 — thread integrity: every threadWrite is consented, none, or a real buildTimeline source", () => {
  it("the runtime source registry is the real one (imported symbol, not a strings copy)", () => {
    // Sanity-pin a couple of known ingest keys so an accidental empty/renamed
    // registry cannot silently green-light every contract.
    expect(TIMELINE_SOURCE_IDS.length).toBeGreaterThan(0);
    expect(TIMELINE_SOURCE_IDS).toContain("behaviorLogs");
    expect(TIMELINE_SOURCE_IDS).toContain("heroRuns");
  });

  it("every contract's threadWrite resolves", () => {
    const sources = new Set<string>(TIMELINE_SOURCE_IDS);
    for (const c of SURFACE_CONTRACTS) {
      if (c.threadWrite === "consented" || c.threadWrite === "none") continue;
      expect(
        sources.has(c.threadWrite),
        `"${c.route}" declares threadWrite "${c.threadWrite}", which is not a buildTimeline source`,
      ).toBe(true);
    }
  });
});
