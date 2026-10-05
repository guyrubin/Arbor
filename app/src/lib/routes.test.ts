import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROUTE_IDS, HASH_ALIASES, RETIRED_ROUTES, resolveRouteId } from "./routes";
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
      if ((ROUTE_IDS as readonly string[]).includes(s.id)) {
        // Route ids are canon and always win over aliases, so a section whose
        // id IS a route (journal, behaviors, profile, practice, stories, learn)
        // resolves to that route — which must be one of the section's OWN
        // surfaces (Heartwood D2: #/learn is the Learn hub's Library leaf even
        // though the hub button opens Masterclasses).
        expect(resolved).toBe(s.id);
        const owned = new Set([...s.items, ...s.tools].map((i) => i.tab));
        expect(owned.has(resolved!), `route "${resolved}" is not owned by section "${s.id}"`).toBe(true);
      } else {
        // and an aliased section id lands on that hub's own primary surface
        expect(resolved).toBe(primaryTabOf(s));
      }
    }
  });

  it("the defect case: #/today lands on the Today hub, not a stored tab", () => {
    expect(resolveRouteId("#/today")).toBe("overview");
    expect(resolveRouteId("today")).toBe("overview");
    expect(resolveRouteId("today/")).toBe("overview");
    expect(resolveRouteId("Today")).toBe("overview"); // aliases are case-insensitive
  });

  it("real route ids still resolve to themselves, unchanged", () => {
    // GP-26: a RETIRED route keeps its seat in ROUTE_IDS (the id is persisted
    // and typed) but its hash deliberately no longer resolves to itself. The
    // exception is the data in RETIRED_ROUTES, never a hole in the loop.
    for (const id of ROUTE_IDS) {
      expect(resolveRouteId(`#/${id}`)).toBe(RETIRED_ROUTES[id] ?? id);
    }
  });

  it("a retired route's hash lands on the hub that absorbed it", () => {
    expect(Object.keys(RETIRED_ROUTES).length).toBeGreaterThan(0);
    for (const [retired, target] of Object.entries(RETIRED_ROUTES)) {
      // The id is STILL in the table — floors, the Shell registry and the nav
      // guard all keep working; only the hash moved. No exceptions (Law 6).
      expect(ROUTE_IDS as readonly string[]).toContain(retired);
      expect(ROUTE_IDS as readonly string[]).toContain(target);
      expect(resolveRouteId(`#/${retired}`)).toBe(target);
      expect(resolveRouteId(retired.toUpperCase())).toBe(target);
      // A retired key never shadows a DIFFERENT live route.
      expect(HASH_ALIASES[retired]).toBeUndefined();
    }
    expect(resolveRouteId("#/strengths")).toBe("profile");
  });

  it("B-GROWTH-23: the retired Strengths leaf is deleted; its registry seat renders Profile", () => {
    const src = path.resolve(__dirname, "..");
    expect(existsSync(path.join(src, "components/sections/Strengths.tsx"))).toBe(false);
    const shell = readFileSync(path.join(src, "components/layout/Shell.tsx"), "utf8");
    expect(shell).toMatch(/^\s*strengths: ChildProfile,$/m);
    expect(shell).not.toContain('import("../sections/Strengths")');
    // the id keeps its ROUTE_IDS seat (Law 6) and still lands on Profile
    expect(ROUTE_IDS as readonly string[]).toContain("strengths");
    expect(RETIRED_ROUTES.strengths).toBe("profile");
    // NEGATIVE CONTROL: the pre-fix registry line fails the pin
    expect(/^\s*strengths: ChildProfile,$/m.test("  strengths: Strengths,")).toBe(false);
  });

  it("B-CAREPRO-19: #/find-pro lands on Consult; the id keeps its seat (ROUTE_IDS still 43)", () => {
    expect(RETIRED_ROUTES["find-pro"]).toBe("consult");
    expect(resolveRouteId("#/find-pro")).toBe("consult");
    expect(ROUTE_IDS as readonly string[]).toContain("find-pro");
    expect(ROUTE_IDS.length).toBe(43);
  });

  it("B-ASKJB-12: #/scholar resolves to #/coach; the id keeps its seat like find-pro (ROUTE_IDS still 43)", () => {
    expect(RETIRED_ROUTES.scholar).toBe("coach");
    expect(resolveRouteId("#/scholar")).toBe("coach");
    expect(resolveRouteId("scholar")).toBe("coach");
    expect(ROUTE_IDS as readonly string[]).toContain("scholar");
    expect(ROUTE_IDS.length).toBe(43);
  });

  it("B-PLAY-10: #/journey and #/growth-journey land on Practice; the id keeps its seat (ROUTE_IDS still 43)", () => {
    expect(RETIRED_ROUTES.journey).toBe("practice");
    expect(resolveRouteId("#/journey")).toBe("practice");
    expect(resolveRouteId("journey")).toBe("practice");
    expect(resolveRouteId("#/growth-journey")).toBe("practice");
    expect(HASH_ALIASES["growth-journey"]).toBe("practice");
    expect(ROUTE_IDS as readonly string[]).toContain("journey");
    expect(ROUTE_IDS.length).toBe(43);
  });

  it("unknown hashes still fall back exactly as before (null)", () => {
    for (const raw of ["", "#/", "#/nope", "nonsense", "#/OVERVIEW", "#/overview/extra", "#/care-team-x"]) {
      expect(resolveRouteId(raw), `"${raw}" should not resolve`).toBeNull();
    }
  });
});

describe("B-SHELL-20 (b) · an alias follows a retirement", () => {
  it("resolveRouteId('#/growth-journey') lands where #/journey lands (journey is retired)", () => {
    expect(RETIRED_ROUTES.journey).toBe("practice");
    expect(resolveRouteId("#/growth-journey")).toBe(resolveRouteId("#/journey"));
    expect(resolveRouteId("#/growth-journey")).toBe("practice");
  });

  it("no alias ever resolves to a retired id — every alias = RETIRED_ROUTES[target] ?? target", () => {
    for (const [alias, target] of Object.entries(HASH_ALIASES)) {
      if ((ROUTE_IDS as readonly string[]).includes(alias) || alias in RETIRED_ROUTES) continue;
      const resolved = resolveRouteId("#/" + alias);
      expect(resolved, alias).toBe(RETIRED_ROUTES[target] ?? target);
      expect(resolved && resolved in RETIRED_ROUTES, alias).toBeFalsy();
    }
  });

  it("the alias branch routes through RETIRED_ROUTES (source pin — the rule, not one alias)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    expect(src).toMatch(/const aliased = HASH_ALIASES\[key\.toLowerCase\(\)\];\s*if \(!aliased\) return null;\s*return RETIRED_ROUTES\[aliased\] \?\? aliased;/);
  });
});

describe("B-SHELL-20 (c) · TAB_SECTION_FALLBACK is typed by the manifest", () => {
  it("every fallback value is a hub id and every key a route", async () => {
    const { HUB_IDS } = await import("./surfaceContract");
    for (const [tab, hub] of Object.entries(TAB_SECTION_FALLBACK)) {
      expect(ROUTE_IDS as readonly string[], tab).toContain(tab);
      expect(HUB_IDS as readonly string[], tab).toContain(hub);
    }
    const { readFileSync } = await import("node:fs");
    const nav = readFileSync(new URL("./navigation.ts", import.meta.url), "utf8");
    expect(nav).toContain("export const TAB_SECTION_FALLBACK: Partial<Record<ActiveTab, HubId>> = {");
  });
});
