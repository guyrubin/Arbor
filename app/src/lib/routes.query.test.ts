import { describe, expect, it } from "vitest";
import { hashQuery, resolveHash, resolveRouteId, routeHash, splitHash } from "./routes";

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
