/**
 * IA-20 — every route is reachable from search, or is deliberately not.
 *
 * Search's "Go to" section is built by walking the nav SECTIONS and taking each
 * section's `items`. Anything the app can navigate to that is NOT a section
 * item was therefore invisible to search — a parent could open a tool from a
 * hub but never find it by name. That was patched with EXTRA_ROUTE_TABS, a
 * hand-maintained list of three.
 *
 * A hand-maintained list is the same shape that has failed this codebase over
 * and over: every leak we have found lived just off a list of named things
 * somebody had to remember to update. So this checks the property instead —
 * every id in ROUTE_IDS is either indexed or explicitly, reasonedly excluded.
 * A new route is then unsearchable only if someone SAYS so, in writing, here.
 */
import { describe, expect, it } from "vitest";
import { ROUTE_IDS, type ActiveTab } from "./routes";
import { getSearchIndex } from "./searchIndex";

/**
 * Routes that must NOT appear in "Go to", each with the reason it would be
 * wrong to surface. This is an allow-list of ABSENCE: adding to it is a
 * deliberate product statement, not bookkeeping.
 */
const DELIBERATELY_UNSEARCHABLE: Partial<Record<ActiveTab, string>> = {
  attribution: "Legal/credits surface reached from Settings; not a place a parent navigates to by name.",
  science: "Evidence/credits surface reached from a trust link in context, not a destination.",
};

const indexedRoutes = new Set(
  getSearchIndex()
    .filter((entry) => entry.kind === "route")
    .map((entry) => entry.tab)
    .filter((tab): tab is ActiveTab => Boolean(tab)),
);

describe("IA-20 · search can reach every route the app has", () => {
  it("the index is real and actually contains routes (a vacuous scan is not a pass)", () => {
    expect(ROUTE_IDS.length).toBeGreaterThan(30);
    expect(indexedRoutes.size).toBeGreaterThan(20);
    // Named anchors: if the index shape changes, fail loudly rather than
    // silently comparing two empty sets.
    expect(indexedRoutes.has("coach" as ActiveTab)).toBe(true);
    expect(indexedRoutes.has("milestones" as ActiveTab)).toBe(true);
  });

  it("every route is indexed, or is listed as deliberately unsearchable", () => {
    const unreachable = ROUTE_IDS.filter(
      (id) => !indexedRoutes.has(id) && !(id in DELIBERATELY_UNSEARCHABLE),
    );
    expect(
      unreachable,
      "these routes cannot be found by name in search — add them to the index, " +
        "or record in DELIBERATELY_UNSEARCHABLE why a parent should not be able to search for them",
    ).toEqual([]);
  });

  it("the exclusion list stays small, honest, and about real routes", () => {
    for (const [id, reason] of Object.entries(DELIBERATELY_UNSEARCHABLE)) {
      expect(ROUTE_IDS as readonly string[]).toContain(id);
      // A reason, not a shrug.
      expect(reason.length).toBeGreaterThan(30);
      // An excluded route must not ALSO be indexed — that would mean the
      // stated reason is fiction.
      expect(indexedRoutes.has(id as ActiveTab)).toBe(false);
    }
    expect(Object.keys(DELIBERATELY_UNSEARCHABLE).length).toBeLessThanOrEqual(6);
  });

  it("NEGATIVE CONTROL: the check fails for a route that is neither indexed nor excused", () => {
    const pretendIndexed = new Set<string>(["coach"]);
    const pretendExcluded: Record<string, string> = {};
    const missed = ["coach", "milestones"].filter(
      (id) => !pretendIndexed.has(id) && !(id in pretendExcluded),
    );
    expect(missed).toEqual(["milestones"]);
  });
});
