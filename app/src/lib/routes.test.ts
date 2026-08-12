import { describe, it, expect } from "vitest";
import { ROUTE_IDS, HASH_ALIASES, resolveRouteId } from "./routes";
import { SECTIONS, TAB_SECTION_FALLBACK, primaryTabOf } from "./navigation";
import { ALL_TABS } from "../context/ArborContext";

/**
 * Guards the route-manifest single-source-of-truth (lib/routes.ts). Historically
 * the tab set drifted across three hand-maintained lists (ActiveTab union,
 * VALID_TABS, Shell tabRegistry); these assertions fail loudly if a route is
 * added to the manifest but never wired into the runtime guard or the IA.
 * (Shell's tabRegistry is enforced at compile time by Record<ActiveTab, …>.)
 */
describe("route manifest (single source of truth)", () => {
  it("has no duplicate route ids", () => {
    expect(new Set(ROUTE_IDS).size).toBe(ROUTE_IDS.length);
  });

  it("VALID_TABS/ALL_TABS derive exactly from ROUTE_IDS", () => {
    expect([...ALL_TABS].sort()).toEqual([...ROUTE_IDS].sort());
  });

  it("every route has an explicit home in the IA (no silent fallback to Today)", () => {
    const homed = new Set<string>([
      ...SECTIONS.flatMap((s) => s.items.map((i) => i.tab)),
      ...SECTIONS.flatMap((s) => s.tools.map((i) => i.tab)),
      ...Object.keys(TAB_SECTION_FALLBACK),
    ]);
    const orphaned = ROUTE_IDS.filter((r) => !homed.has(r));
    expect(orphaned).toEqual([]);
  });
});

/**
 * Hash ALIASES (AR-UI 2026-08-12). `#/today` was a dead deep link: the Today
 * hub's route id is `overview`, so tabFromHash() returned null and the app
 * silently restored the stored `arbor.activeTab` — a user following the nav
 * label or a plan doc landed on an arbitrary tab. Aliases resolve inside the
 * hash router; no route id changes and no fake route is added.
 */
describe("hash aliases", () => {
  it("every alias resolves to a REAL route id", () => {
    for (const [alias, target] of Object.entries(HASH_ALIASES)) {
      expect(ROUTE_IDS, `alias "${alias}" points at non-route "${target}"`).toContain(target);
    }
  });

  it("no alias shadows an existing route id (real routes always win)", () => {
    for (const alias of Object.keys(HASH_ALIASES)) {
      expect(ROUTE_IDS, `alias "${alias}" shadows a real route`).not.toContain(alias);
    }
  });

  it("alias keys are lowercase kebab-case", () => {
    for (const alias of Object.keys(HASH_ALIASES)) expect(alias).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("every nav SECTION id resolves — hub labels are the links people type", () => {
    for (const s of SECTIONS) {
      const resolved = resolveRouteId(s.id);
      expect(resolved, `section hub "${s.id}" is not reachable by hash`).toBeTruthy();
      // and it lands on that hub's own primary surface
      expect(resolved).toBe(primaryTabOf(s));
    }
  });

  it("the defect case: #/today lands on the Today hub, not a stored tab", () => {
    expect(resolveRouteId("#/today")).toBe("overview");
    expect(resolveRouteId("today")).toBe("overview");
    expect(resolveRouteId("today/")).toBe("overview");
    expect(resolveRouteId("Today")).toBe("overview"); // aliases are case-insensitive
  });

  it("real route ids still resolve to themselves, unchanged", () => {
    for (const id of ROUTE_IDS) expect(resolveRouteId(`#/${id}`)).toBe(id);
  });

  it("unknown hashes still fall back exactly as before (null)", () => {
    for (const raw of ["", "#/", "#/nope", "nonsense", "#/OVERVIEW", "#/overview/extra", "#/care-team-x"]) {
      expect(resolveRouteId(raw), `"${raw}" should not resolve`).toBeNull();
    }
  });
});
