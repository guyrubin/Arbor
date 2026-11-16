/** v10 (design system v10.1): "Routines" is the name of Together's pill only
 * (one name per thing), so the word a parent types for routines lands on
 * Together › Routines (#/practice), where the twelve ready-made routines live;
 * starting one makes it a plan under Now › Plans. #/plans is named Plans again
 * (nav.tab.plans), and its old names ("plans", "Growth Plans", "Action Plans")
 * find it exactly. One exact intent per route: every partial query ranks as
 * before.
 *
 * History: v3 IA-05 sent the routines words to #/plans and IA-05r renamed that
 * route Routines; the negative controls below run the pre-intent index as a
 * mutation of the real one. */
import { describe, expect, it } from "vitest";
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

describe("v10 · routines lands on Together › Routines; Plans keeps its names", () => {
  it("the target is Together's Routines pill (#/practice)", () => {
    expect(ROUTINES_INTENT_TAB).toBe("practice");
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

  it("keeps #/routines retired (it resolves to Plans) with no row of its own", () => {
    expect("routines" in RETIRED_ROUTES).toBe(true);
    expect(resolveRouteId("#/routines")).toBe("plans");
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

  it.each(OLD_PLANS_NAMES)("Plans' name or an old one, %j, finds Now › Plans first, and nothing else moves", (query) => {
    const result = searchCatalog(query, 1000).map(row => row.id);
    expect(result[0]).toBe("route:plans");
    expect(result).toEqual(["route:plans", ...priorIds(query).filter(id => id !== "route:plans")]);
  });

  it("the heading PlansTab shows is one of those names", () => {
    expect(translate("en", "plan.title")).toBe("Action Plans");
    expect(translate("he", "plan.title")).toBe("תוכניות פעולה");
  });

  it("one name per thing: #/plans is Plans and #/practice is Routines, in both languages", () => {
    expect(translate("en", "nav.tab.plans")).toBe("Plans");
    expect(translate("he", "nav.tab.plans")).toBe("תוכניות");
    expect(translate("en", "nav.tab.practice")).toBe(translate("en", "nav.tab.routines"));
    expect(translate("he", "nav.tab.practice")).toBe(translate("he", "nav.tab.routines"));
    expect(translate("en", "nav.tab.plans")).toBe(translate("en", "nav.pill.plans"));
    expect(translate("en", "nav.tab.practice")).toBe(translate("en", "nav.pill.routines"));
    const plans = getSearchIndex().find(row => row.id === "route:plans")!;
    expect(plans.title).toEqual({ en: "Plans", he: "תוכניות" });
  });

  it("NEGATIVE CONTROL: with #/practice under its old name and no intent, routines did not open Together", () => {
    const before = getSearchIndex().map(entry => entry.id !== "route:practice" ? entry : {
      ...entry, normTitles: ["Practice Studio", "סטודיו תרגול"].map(normalizeSearchText),
    });
    expect(before.some(entry => entry.id === "route:practice")).toBe(true);
    for (const query of ["routines", "שגרות"]) {
      expect(priorIds(query, 1000, before)[0], query).not.toBe("route:practice");
      expect(searchCatalog(query, 1)[0].id, query).toBe("route:practice");
    }
  });
});
