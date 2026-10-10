/** B-SHELL-37: display current places without changing search or navigation. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { placeForTab } from "./companionPlaces";
import { translate } from "./i18n";
import { SECTIONS } from "./navigation";
import { HASH_ALIASES, RETIRED_ROUTES, ROUTE_IDS, SUB_ROUTES, resolveRouteId, type ActiveTab } from "./routes";
import { getSearchIndex, normalizeSearchText, UNSEARCHABLE_ROUTES, type LocalizedPair, type SearchEntry } from "./searchIndex";
import { LEARN_CARDS } from "../learn/learnCards";
import { LEARN_CATEGORIES } from "../learn/learnLibrary";
import { MASTERCLASSES, FRAME_LABELS } from "./masterclasses";
import { ROUTINES } from "./routines";
import { scholarsInfo } from "../initialData";
import { PLAY_ACTIVITIES } from "../playbank/content";
import { ALL_MILESTONES } from "./milestoneData";
import { HERO_STORIES } from "./heroJourneys";
import { WORLDS } from "../practice/worlds";

const pair = (en: string, he?: string): LocalizedPair => ({ en, he: he?.trim() ? he : en });
const label = (key: string): LocalizedPair => pair(translate("en", key), translate("he", key));
const excluded = {
  attribution: "Legal/credits surface reached from Settings; not somewhere a parent navigates to by name.",
  science: "Evidence and credits, reached from a trust link in context rather than as a destination.",
};

/** Pre-change route construction fixture from 0c0f017: the three
 * paths, order, titles and searchable metadata must survive a display-only fix. */
function legacyRouteRows(): SearchEntry[] {
  const rows: SearchEntry[] = [];
  const seen = new Set<ActiveTab>();
  function add(tab: ActiveTab, title: LocalizedPair, sub: LocalizedPair) {
    if (seen.has(tab) || tab in RETIRED_ROUTES) return;
    seen.add(tab);
    rows.push({
      id: `route:${tab}`, kind: "route", tab, title, sub,
      keywords: { en: [], he: [] },
      normTitles: [...new Set([title.en, title.he].map(normalizeSearchText))].filter(Boolean),
      normKeywords: [...new Set([sub.en, sub.he].map(normalizeSearchText))].filter(Boolean),
    });
  }
  for (const section of SECTIONS) {
    for (const item of section.items) add(item.tab, label("nav.tab." + item.tab), label("nav.cat." + section.id));
  }
  for (const tab of ["weekly", "handoff"] as const) add(tab, label("sm.extra." + tab), label("sm.extra." + tab + "Sub"));
  for (const tab of ROUTE_IDS) {
    if (tab in excluded || translate("en", "nav.tab." + tab) === "nav.tab." + tab) continue;
    add(tab, label("nav.tab." + tab), label("nav.short.more"));
  }
  return rows;
}

const routes = getSearchIndex().filter((row) => row.kind === "route");
const byTab = new Map(routes.map((row) => [row.tab, row]));
const legacy = legacyRouteRows();
const withoutSubtitle = ({ sub: _sub, ...rest }: SearchEntry) => rest;

function expectCurrentPlace(row: SearchEntry) {
  const place = placeForTab(row.tab);
  expect(row.sub, row.id).toEqual({ en: place.en, he: place.he });
}

describe("B-SHELL-37 · current-place search subtitles", () => {
  it.each(["en", "he"] as const)("every route displays its existing destination's %s place", (lang) => {
    expect(routes.length).toBeGreaterThan(20);
    for (const row of routes) expect(row.sub[lang], row.id).toBe(placeForTab(row.tab)[lang]);
  });

  it("keeps every route id, destination, order, title and searchable field unchanged", () => {
    expect(routes.map(withoutSubtitle)).toEqual(legacy.map(withoutSubtitle));
    expect(UNSEARCHABLE_ROUTES).toEqual(excluded);
  });

  const hashGroups: [string, [string, ActiveTab][]][] = [
    ["canonical and retired routes", ROUTE_IDS.map((tab) => [tab, RETIRED_ROUTES[tab] ?? tab])],
    ["all hash aliases", Object.entries(HASH_ALIASES).map(([alias, tab]) => [alias, RETIRED_ROUTES[tab] ?? tab])],
    ["existing sub-route modes", Object.entries(SUB_ROUTES).map(([key, sub]) => [key, sub.route])],
  ];
  it.each(hashGroups)("preserves %s and labels their actual destinations", (_name, hashes) => {
    expect(hashes.length).toBeGreaterThan(0);
    for (const [key, tab] of hashes) {
      expect(resolveRouteId(`#/${key}`), key).toBe(tab);
      if (tab in excluded) expect(byTab.has(tab), key).toBe(false);
      else {
        const row = byTab.get(tab);
        expect(row, key).toBeDefined();
        expectCurrentPlace(row!);
      }
      if (key in RETIRED_ROUTES) expect(byTab.has(key as ActiveTab), key).toBe(false);
    }
  });

  it.each(["overview", "handoff", "screening"] as const)("rejects the actual old subtitle for %s", (tab) => {
    // Section hub, consolidated extra and router-derived More, respectively.
    // The identical positive assertion is also run against real indexed rows.
    const old = legacy.find((row) => row.tab === tab)!;
    expect(old).toBeDefined();
    expect(() => expectCurrentPlace(old)).toThrow();
    expectCurrentPlace(byTab.get(tab)!);
  });

  it("keeps every content subtitle on its real shelf, domain, pack or concept", () => {
    const shelves = new Map(LEARN_CATEGORIES.map((shelf) => [shelf.id, shelf.label]));
    const expected = [
      ...LEARN_CARDS.map((card) => {
        const shelf = shelves.get(card.category);
        return [`learn:${card.id}`, pair(shelf?.en ?? card.category, shelf?.he ?? card.category)];
      }),
      ...MASTERCLASSES.map((mc) => [`masterclass:${mc.id}`, pair(FRAME_LABELS[mc.frame]?.en ?? "", FRAME_LABELS[mc.frame]?.he ?? "")]),
      ...ROUTINES.map((routine) => [`routine:${routine.id}`, pair(routine.domains.en, routine.domains.he)]),
      ...scholarsInfo.map((scholar) => [`scholar:${scholar.slug}`, pair(scholar.concept)]),
      ...PLAY_ACTIVITIES.map((activity) => [`activity:${activity.id}`, pair(activity.domain)]),
      ...ALL_MILESTONES.map((milestone) => [`milestone:${milestone.id}`, pair(milestone.domain)]),
      ...HERO_STORIES.map((story) => [`journey:${story.id}`, pair(story.pack)]),
      ...WORLDS.map((world) => [`world:${world.id}`, pair(world.status === "live" ? "available" : "coming soon")]),
    ];
    expect(getSearchIndex().filter((row) => row.kind !== "route").map((row) => [row.id, row.sub])).toEqual(expected);
  });

  it("the reused place helper stays catalogue-free and cannot eagerly load the index", () => {
    const source = readFileSync(new URL("./companionPlaces.ts", import.meta.url), "utf8");
    const runtimeImports = [...source.matchAll(/^import (?!type\b).*from "([^"]+)"/gm)].map((match) => match[1]);
    expect(runtimeImports).toEqual(["./navigation", "./i18nCompanion"]);
    expect(source).not.toMatch(/\bimport\s*\(|\bexport\s+.*\bfrom\b/);
  });
});
