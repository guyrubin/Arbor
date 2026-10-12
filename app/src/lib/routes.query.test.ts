import { describe, expect, it } from "vitest";
import { ROUTE_IDS, SUB_ROUTES, hashQuery, resolveHash, resolveRouteId, routeHash, splitHash } from "./routes";

/* B-LOOP-11 — the journal's shelf page and professional view are the SAME
   route with a query (`#/journal?shelf=sleep`, `#/journal?view=pro`). Before
   splitHash a hash with a `?query` resolved to nothing and the parent landed
   on Today with "this link moved". */

describe("splitHash / hashQuery — the one place a hash is cut", () => {
  it("cuts the route key from its query", () => {
    const { key, query } = splitHash("#/journal?shelf=sleep");
    expect(key).toBe("journal");
    expect(query.get("shelf")).toBe("sleep");
    expect(hashQuery("#/journal?view=pro").get("view")).toBe("pro");
  });

  it("a hash without a query has an empty query; a trailing slash before the query is dropped", () => {
    expect(splitHash("#/journal").key).toBe("journal");
    expect([...splitHash("#/journal").query.keys()]).toEqual([]);
    expect(splitHash("#/journal/?shelf=words").key).toBe("journal");
    expect(splitHash("").key).toBe("");
  });

  it("routeHash writes the route and only the present parameters", () => {
    expect(routeHash("journal", { shelf: "sleep" })).toBe("/journal?shelf=sleep");
    expect(routeHash("journal", { shelf: null, view: undefined })).toBe("/journal");
    expect(routeHash("consult", { intake: "slp" })).toBe("/consult?intake=slp");
  });
});

describe("resolveRouteId / resolveHash — a query never makes a route unknown", () => {
  it("#/journal?shelf=sleep and #/journal?view=pro resolve to the journal", () => {
    expect(resolveRouteId("#/journal?shelf=sleep")).toBe("journal");
    expect(resolveHash("#/journal?shelf=sleep")).toEqual({ tab: "journal", unknown: false });
    expect(resolveHash("#/journal?view=pro")).toEqual({ tab: "journal", unknown: false });
  });

  it("aliases and retirements still resolve with a query", () => {
    expect(resolveRouteId("#/today?x=1")).toBe("overview");
    expect(resolveRouteId("#/strengths?x=1")).toBe("profile");
  });

  it("negative control: an unknown key with a query is still unknown (lands on Today)", () => {
    expect(resolveRouteId("#/nope?shelf=sleep")).toBeNull();
    expect(resolveHash("#/nope?shelf=sleep")).toEqual({ tab: "overview", unknown: true });
  });
});

/* B-GROWTH-37 — `#/language/said` is a MODE of #/language (`?view=said`, the
   month page LanguageLabTab reads through useHashQuery). The sub-route
   resolves in splitHash, the one place a hash is cut; no ROUTE_IDS seat. */
describe("SUB_ROUTES — #/language/said", () => {
  it("cuts to the language route with view=said; other parameters ride along; the path's mode wins", () => {
    const { key, query } = splitHash("#/language/said");
    expect(key).toBe("language");
    expect(query.get("view")).toBe("said");
    expect(hashQuery("#/language/said?month=2026-09").get("month")).toBe("2026-09");
    expect(hashQuery("#/language/said?month=2026-09").get("view")).toBe("said");
    expect(hashQuery("#/language/said?view=pro").get("view")).toBe("said");
    expect(splitHash("#/language/said/").key).toBe("language");
    expect(splitHash("#/Language/Said").key).toBe("language");
  });

  it("resolves as the language route (never unknown, never Today)", () => {
    expect(resolveRouteId("#/language/said")).toBe("language");
    expect(resolveHash("#/language/said")).toEqual({ tab: "language", unknown: false });
    expect(resolveHash("#/language/said?month=2026-09")).toEqual({ tab: "language", unknown: false });
    // the existing query form is unchanged
    expect(hashQuery("#/language?view=said").get("view")).toBe("said");
  });

  it("the map: lowercase route/mode keys, every target a ROUTE_ID, no key a ROUTE_ID", () => {
    for (const [k, v] of Object.entries(SUB_ROUTES)) {
      expect(k).toMatch(/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/);
      expect(ROUTE_IDS as readonly string[]).toContain(v.route);
      expect(ROUTE_IDS as readonly string[]).not.toContain(k);
      expect(k.startsWith(`${v.route}/`)).toBe(true);
    }
    expect(ROUTE_IDS as readonly string[]).not.toContain("language/said");
  });

  it("negative control: an unlisted path under a route stays unknown (lands on Today)", () => {
    expect(resolveRouteId("#/language/heard")).toBeNull();
    expect(resolveHash("#/overview/extra")).toEqual({ tab: "overview", unknown: true });
    expect(splitHash("#/language/heard").key).toBe("language/heard");
  });
});
