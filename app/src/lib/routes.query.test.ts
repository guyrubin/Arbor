import { describe, expect, it } from "vitest";
import { RETIRED_ROUTES, ROUTE_IDS, SUB_ROUTES, hashQuery, resolveHash, resolveRouteId, routeHash, splitHash } from "./routes";

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

/* B-GROWTH-37 — `#/language/said` was a MODE of #/language (`?view=said`, the
   month page LanguageLabTab reads through useHashQuery). The sub-route
   resolves in splitHash, the one place a hash is cut; no ROUTE_IDS seat.
   v3 F-SHELL-1 re-pin (critic ruling [28]): #/language retired to About, and
   the words themselves live in Moments as moments tagged talking, so the
   sub-route lands on Moments across areas, on talking
   (#/timeline?view=areas&area=talking). */
describe("SUB_ROUTES — #/language/said", () => {
  it("cuts to Moments with view=areas&area=talking; other parameters ride along; the path's mode wins", () => {
    const { key, query } = splitHash("#/language/said");
    expect(key).toBe("timeline");
    expect(query.get("view")).toBe("areas");
    expect(query.get("area")).toBe("talking");
    expect(hashQuery("#/language/said?month=2026-09").get("month")).toBe("2026-09");
    expect(hashQuery("#/language/said?month=2026-09").get("view")).toBe("areas");
    expect(hashQuery("#/language/said?view=pro").get("view")).toBe("areas");
    expect(hashQuery("#/language/said?area=moving").get("area")).toBe("talking");
    expect(splitHash("#/language/said/").key).toBe("timeline");
    expect(splitHash("#/Language/Said").key).toBe("timeline");
  });

  it("resolves as the Moments route (never unknown, never Today, never the retired language id)", () => {
    expect(resolveRouteId("#/language/said")).toBe("timeline");
    expect(resolveHash("#/language/said")).toEqual({ tab: "timeline", unknown: false });
    expect(resolveHash("#/language/said?month=2026-09")).toEqual({ tab: "timeline", unknown: false });
    // the bare language hash is retired to About, on its language aspect
    expect(resolveRouteId("#/language")).toBe("profile");
    expect(hashQuery("#/language").get("aspect")).toBe("lang");
  });

  it("the map: lowercase route/mode keys, every target a live ROUTE_ID, no key a ROUTE_ID", () => {
    for (const [k, v] of Object.entries(SUB_ROUTES)) {
      expect(k).toMatch(/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/);
      expect(ROUTE_IDS as readonly string[]).toContain(v.route);
      expect(v.route in RETIRED_ROUTES, k).toBe(false);
      expect(ROUTE_IDS as readonly string[]).not.toContain(k);
      // A mode of its own route, or (F-SHELL-1) a mode of a RETIRED route
      // re-homed by the route map with the content it showed.
      const head = k.split("/")[0];
      expect(head === v.route || head in RETIRED_ROUTES, k).toBe(true);
    }
    expect(ROUTE_IDS as readonly string[]).not.toContain("language/said");
  });

  it("negative control: an unlisted path under a route stays unknown (lands on Today)", () => {
    expect(resolveRouteId("#/language/heard")).toBeNull();
    expect(resolveHash("#/overview/extra")).toEqual({ tab: "overview", unknown: true });
    expect(splitHash("#/language/heard").key).toBe("language/heard");
    // …and a mode under a LIVE route must name that route
    const head = "overview/extra".split("/")[0];
    expect(head === "timeline" || head in RETIRED_ROUTES).toBe(false);
  });
});
