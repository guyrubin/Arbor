/** B-SHELL-37: visits stay findable through the current destinations, not a new Help route. */
import { describe, expect, it } from "vitest";
import { getSearchIndex, normalizeSearchText, searchCatalog } from "./searchIndex";
import { placeForTab } from "./companionPlaces";
import { translate } from "./i18n";
import { RETIRED_ROUTES, ROUTE_IDS, resolveRouteId } from "./routes";

/** Pre-alias ranking, kept here as a negative/control fixture. Exact intent
 * aliases may promote one route; all other rows must retain their old order. */
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

const intents = [
  ["visit", "appointments"], ["visits", "appointments"], ["  VISIT  ", "appointments"],
  ["ביקור", "appointments"], ["בִּיקוּר", "appointments"], ["ביקורים", "appointments"], ["בִּיקוּרִים", "appointments"], ["ביקורימ", "appointments"],
  [translate("en", "elev.consult.h1"), "consult"], [translate("he", "elev.consult.h1"), "consult"],
  ["  PRÉPARE FOR A VISIT  ", "consult"], ["מִתְכּוֹנְנִים לַפְּגִישָׁה", "consult"],
] as const;

describe("B-SHELL-37 · explicit visit intent in the accepted three-place architecture", () => {
  it.each(intents)("%j leads to the existing %s row", (query, tab) => {
    const result = searchCatalog(query, 1000);
    const destination = getSearchIndex().find(row => row.id === `route:${tab}`)!;
    expect(destination).toBeDefined();
    expect(result[0]).toBe(destination);
    expect(result[0].title).toEqual({ en: translate("en", `nav.tab.${tab}`), he: translate("he", `nav.tab.${tab}`) });
    const place = placeForTab(tab);
    expect(result[0].sub).toEqual({ en: place.en, he: place.he });
    expect(resolveRouteId(`#/${result[0].tab}`)).toBe(tab);
    expect(result.map(row => row.id)).toEqual([destination.id, ...priorIds(query).filter(id => id !== destination.id)]);
    expect(searchCatalog(query, 1).map(row => row.id)).toEqual([destination.id]);
    expect(searchCatalog(query, 0)).toEqual([]);
  });

  it("the source-backed bilingual preparation labels are real, not fallback keys", () => {
    expect(translate("en", "elev.consult.h1")).toBe("Prepare for a visit");
    expect(translate("he", "elev.consult.h1")).toBe("מתכוננים לפגישה");
  });

  it.each(["vis", "visit?", "visit!", "revisit", "ביק", "ביקור?", "Appóintments", "Consult", "שינה", "tantrums", "calm morning", "", "\u05B0\u05B7"])("does not change general ranking or punctuation semantics for %j", (query) => {
    expect(searchCatalog(query, 1000).map(row => row.id)).toEqual(priorIds(query));
  });

  it("does not add a Help/Visits destination, reintroduce retired rows or mutate the static index", () => {
    const index = getSearchIndex(), snapshot = JSON.stringify(index);
    for (const [query] of intents) searchCatalog(query);
    expect(getSearchIndex()).toBe(index);
    expect(JSON.stringify(index)).toBe(snapshot);
    expect(ROUTE_IDS).not.toContain("help");
    expect(ROUTE_IDS).not.toContain("visits");
    expect(index.filter(row => row.kind === "route" && row.tab in RETIRED_ROUTES)).toEqual([]);
    expect(index.filter(row => row.id === "route:help" || row.id === "route:visits")).toEqual([]);
  });

  it("NEGATIVE CONTROL: the previous generic matcher missed the intended visit destination", () => {
    expect(priorIds("visit")[0]).not.toBe("route:appointments");
    expect(priorIds("ביקור")[0]).not.toBe("route:appointments");
  });
});
