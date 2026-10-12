/** v3 IA-05: the word a parent types for routines lands on Plans, where the
 * ready-made routines live since B-GROWTH-25 retired #/routines. One exact
 * intent only: no routines row comes back and every partial query ranks as
 * before. */
import { describe, expect, it } from "vitest";
import { getSearchIndex, normalizeSearchText, searchCatalog } from "./searchIndex";
import { placeForTab } from "./companionPlaces";
import { translate } from "./i18n";
import { RETIRED_ROUTES, resolveRouteId } from "./routes";

/** Pre-alias ranking (the searchVisitIntent fixture): exact intent aliases may
 * promote one route; every other row keeps its old order. */
function priorIds(query: string, limit = 1000): string[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  return getSearchIndex().map((entry, index) => {
    let score = 0;
    for (const title of entry.normTitles) {
      if (title.startsWith(q)) score = Math.max(score, 100);
      else if (title.split(/\s+/).some(word => word.startsWith(q))) score = Math.max(score, 80);
      else if (title.includes(q)) score = Math.max(score, 60);
    }
    for (const word of entry.normKeywords) {
      if (word.startsWith(q)) score = Math.max(score, 40);
      else if (word.includes(q)) score = Math.max(score, 25);
    }
    return { id: entry.id, index, score };
  }).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(row => row.id);
}

const QUERIES = ["routines", "Routine", "  ROUTINES  ", "שגרות", "שגרה", "שְׁגָרוֹת"];

describe("v3 IA-05 · routines lands on Plans", () => {
  it.each(QUERIES)("%j leads to route:plans", (query) => {
    const result = searchCatalog(query, 1000);
    const plans = getSearchIndex().find(row => row.id === "route:plans")!;
    expect(plans).toBeDefined();
    expect(result[0]).toBe(plans);
    // The row is the existing Plans row: its own title, and its sub is still
    // the place label (B-SHELL-37) — the crumb is drawn by the search hook.
    expect(result[0].title).toEqual({ en: translate("en", "nav.tab.plans"), he: translate("he", "nav.tab.plans") });
    const place = placeForTab("plans");
    expect(result[0].sub).toEqual({ en: place.en, he: place.he });
    expect(resolveRouteId(`#/${result[0].tab}`)).toBe("plans");
    // Only Plans moves; the rest keep their prior order.
    expect(result.map(row => row.id)).toEqual([plans.id, ...priorIds(query).filter(id => id !== plans.id)]);
    expect(searchCatalog(query, 1).map(row => row.id)).toEqual([plans.id]);
  });

  it("resolves #/plans and keeps #/routines retired with no row of its own", () => {
    expect(resolveRouteId("#/plans")).toBe("plans");
    expect("routines" in RETIRED_ROUTES).toBe(true);
    expect(getSearchIndex().filter(row => row.id === "route:routines")).toEqual([]);
    for (const query of QUERIES) expect(searchCatalog(query, 1000).some(row => row.id === "route:routines")).toBe(false);
  });

  it("the intent words are the nav labels a parent already saw", () => {
    expect(normalizeSearchText(translate("en", "nav.tab.routines"))).toBe("routines");
    expect(normalizeSearchText(translate("he", "nav.tab.routines"))).toBe(normalizeSearchText("שגרות"));
  });

  it.each(["rout", "routi", "שגר", "routines?", "my routines", "Growth Plans", "tantrums", "calm morning"])(
    "does not change general ranking for %j", (query) => {
      expect(searchCatalog(query, 1000).map(row => row.id)).toEqual(priorIds(query));
    },
  );

  it("NEGATIVE CONTROL: before the intent, routines did not open on Plans", () => {
    expect(priorIds("routines")[0]).not.toBe("route:plans");
    expect(priorIds("שגרות")[0]).not.toBe("route:plans");
  });
});
