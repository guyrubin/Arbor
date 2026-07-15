import { describe, it, expect } from "vitest";
import { ROUTE_IDS } from "./routes";
import { SECTIONS, TAB_SECTION_FALLBACK } from "./navigation";
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
