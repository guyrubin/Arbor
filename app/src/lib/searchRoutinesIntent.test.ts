/** v3 IA-05: the word a parent types for routines lands on Plans, where the
 * ready-made routines live since B-GROWTH-25 retired #/routines. One exact
 * intent only: no routines row comes back and every partial query ranks as
 * before.
 *
 * IA-05r: the Plans route is now named Routines (nav.tab.plans, EN and HE),
 * the name of Together's Routines (FEAT-07), so it reads Together › Routines.
 * The negative control runs the pre-IA-05 index (the old "Growth Plans" name,
 * no intent) as a mutation of the real one.
 *
 * IA-05r round 2: the intent's target is ROUTINES_INTENT_TAB, "plans" while
 * #/plans is a live route. If F-SHELL-1 retires plans into Together, the words
 * follow the retirement (tested below on a mutated route table), so this suite
 * stays green either way. While plans is live, its old names ("Growth Plans",
 * the "Action Plans" heading PlansTab still shows, "plans") find it exactly.
 * Re-pin: "Growth Plans" left the "general ranking unchanged" list; it is now
 * one of those old names. */
import { describe, expect, it, vi } from "vitest";
import { getSearchIndex, normalizeSearchText, searchCatalog, ROUTINES_INTENT_TAB, type SearchEntry } from "./searchIndex";
import { homeForTab, placeForTab } from "./companionPlaces";
import { translate } from "./i18n";
import { RETIRED_ROUTES, resolveRouteId } from "./routes";

/** Pre-alias ranking (the searchVisitIntent fixture): exact intent aliases may
 * promote one route; every other row keeps its old order. */
function priorIds(query: string, limit = 1000, entries: readonly SearchEntry[] = getSearchIndex()): string[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  return entries.map((entry, index) => {
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
const TARGET_ID = `route:${ROUTINES_INTENT_TAB}`;
const OLD_PLANS_NAMES = ["plans", "Plan", "Growth Plans", "תוכניות", "תוכנית", "תוכניות התפתחות", translate("en", "plan.title"), translate("he", "plan.title")];

describe("v3 IA-05 · routines lands on Plans", () => {
  it("the target is Plans while it is a live route, else where its retirement leads; either way, in Together", () => {
    expect(ROUTINES_INTENT_TAB).toBe(RETIRED_ROUTES.plans ?? "plans");
    const home = homeForTab(ROUTINES_INTENT_TAB);
    expect(home.kind === "place" ? home.place.id : home.door.id).toBe("together");
  });

  it.each(QUERIES)("%j leads to the routines target", (query) => {
    const result = searchCatalog(query, 1000);
    const target = getSearchIndex().find(row => row.id === TARGET_ID)!;
    expect(target).toBeDefined();
    expect(result[0]).toBe(target);
    // The row is the existing route row: its own title, and its sub is still
    // the place label (B-SHELL-37) — the crumb is drawn by the search hook.
    expect(result[0].title).toEqual({ en: translate("en", `nav.tab.${ROUTINES_INTENT_TAB}`), he: translate("he", `nav.tab.${ROUTINES_INTENT_TAB}`) });
    const place = placeForTab(ROUTINES_INTENT_TAB);
    expect(result[0].sub).toEqual({ en: place.en, he: place.he });
    expect(resolveRouteId(`#/${result[0].tab}`)).toBe(ROUTINES_INTENT_TAB);
    // Only the target moves; the rest keep their prior order.
    expect(result.map(row => row.id)).toEqual([target.id, ...priorIds(query).filter(id => id !== target.id)]);
    expect(searchCatalog(query, 1).map(row => row.id)).toEqual([target.id]);
  });

  it("resolves #/plans to the target and keeps #/routines retired with no row of its own", () => {
    expect(resolveRouteId("#/plans")).toBe(ROUTINES_INTENT_TAB);
    expect("routines" in RETIRED_ROUTES).toBe(true);
    expect(getSearchIndex().filter(row => row.id === "route:routines")).toEqual([]);
    for (const query of QUERIES) expect(searchCatalog(query, 1000).some(row => row.id === "route:routines")).toBe(false);
  });

  it("the intent words are the nav labels a parent already saw", () => {
    expect(normalizeSearchText(translate("en", "nav.tab.routines"))).toBe("routines");
    expect(normalizeSearchText(translate("he", "nav.tab.routines"))).toBe(normalizeSearchText("שגרות"));
  });

  it.each(["rout", "routi", "שגר", "routines?", "my routines", "plans?", "pla", "growth", "action", "תוכ", "tantrums", "calm morning"])(
    "does not change general ranking for %j", (query) => {
      expect(searchCatalog(query, 1000).map(row => row.id)).toEqual(priorIds(query));
    },
  );

  it.each(OLD_PLANS_NAMES)("IA-05r: while #/plans is live, its old name %j still finds it first, and nothing else moves", (query) => {
    expect(ROUTINES_INTENT_TAB).toBe("plans");
    const result = searchCatalog(query, 1000).map(row => row.id);
    expect(result[0]).toBe("route:plans");
    expect(result).toEqual(["route:plans", ...priorIds(query).filter(id => id !== "route:plans")]);
    // NEGATIVE CONTROL: on the renamed title alone, the old name did not lead to Plans.
    expect(priorIds(query)[0]).not.toBe("route:plans");
  });

  it("IA-05r: the heading PlansTab still shows is one of those old names", () => {
    expect(translate("en", "plan.title")).toBe("Action Plans");
    expect(translate("he", "plan.title")).toBe("תוכניות פעולה");
  });

  it("IA-05r: the Plans route is named Routines in both languages", () => {
    expect(translate("en", "nav.tab.plans")).toBe("Routines");
    expect(translate("he", "nav.tab.plans")).toBe("שגרות");
    expect(translate("en", "nav.tab.plans")).toBe(translate("en", "nav.tab.routines"));
    expect(translate("he", "nav.tab.plans")).toBe(translate("he", "nav.tab.routines"));
    const plans = getSearchIndex().find(row => row.id === "route:plans")!;
    expect(plans.title).toEqual({ en: "Routines", he: "שגרות" });
  });

  it("NEGATIVE CONTROL: before IA-05 (old name, no intent), routines did not open on Plans", () => {
    // Mutation: the real index with the Plans route given back its old name.
    const before = getSearchIndex().map(entry => entry.id !== "route:plans" ? entry : {
      ...entry, normTitles: ["Growth Plans", "תוכניות התפתחות"].map(normalizeSearchText),
    });
    expect(before.some(entry => entry.id === "route:plans")).toBe(true);
    for (const query of ["routines", "שגרות"]) {
      expect(priorIds(query, 1000, before)[0], query).not.toBe("route:plans");
      expect(searchCatalog(query, 1)[0].id, query).toBe("route:plans");
    }
  });
});

describe("v3 IA-05r · if F-SHELL-1 retires #/plans into Together", () => {
  it("the routines words follow the retirement to Together's route, and the old Plans names stop being exact", async () => {
    vi.resetModules();
    vi.doMock("./routes", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./routes")>();
      return { ...actual, RETIRED_ROUTES: { ...actual.RETIRED_ROUTES, plans: "practice" } };
    });
    try {
      const retired = await import("./searchIndex");
      expect(retired.ROUTINES_INTENT_TAB).toBe("practice");
      const index = retired.getSearchIndex();
      expect(index.some(row => row.id === "route:plans")).toBe(false);
      for (const query of ["routines", "שגרות"]) {
        const result = retired.searchCatalog(query, 1000).map(row => row.id);
        expect(result[0], query).toBe("route:practice");
        expect(result, query).toEqual(["route:practice", ...priorIds(query, 1000, index).filter(id => id !== "route:practice")]);
      }
      const home = homeForTab("practice");
      expect(home.kind === "place" ? home.place.id : home.door.id).toBe("together");
      for (const query of OLD_PLANS_NAMES) {
        expect(retired.searchCatalog(query, 1000).map(row => row.id), query).toEqual(priorIds(query, 1000, index));
      }
    } finally {
      vi.doUnmock("./routes");
      vi.resetModules();
    }
  });
});
