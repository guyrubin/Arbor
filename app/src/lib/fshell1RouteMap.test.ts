/**
 * v3 F-SHELL-1 — the v3 route map, line by line, and the one Back rule.
 *
 * Every old route lands on the place pill that now holds its content, in the
 * state the content lanes read: Together reads `?f=` (plus `world` and
 * `sheet`), Moments reads `?view=&area=`, About reads `?aspect=`, Milestones
 * reads `?area=`. A retired id keeps its ROUTE_IDS seat (Law 6) and its hash
 * lands on the pill. Back shows only on an L2 leaf: never on a home, never on a
 * route whose pill is lit in the drawn row (critic ruling [5]).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  HASH_ALIASES,
  LEARN_LIBRARY_HASH,
  RETIRED_ROUTES,
  RETIRED_ROUTE_QUERY,
  ROUTE_IDS,
  SHELF_AREA,
  SUB_ROUTES,
  hashQuery,
  learnRedirectFor,
  resolveHash,
  resolveRouteId,
  type ActiveTab,
} from "./routes";
import { NO_PILL_ROW_TABS, TOGETHER_FILTERS, activePillIndex, homeIdForTab, pillRowFor, sectionForTab } from "./navigation";
import { backTargetFor, isCompanionHome, placeForTab } from "./companionPlaces";
import { SHELVES } from "./shelves/registry";
import { STUDIO_WORLDS } from "../components/practice/studioWorlds";

/** The hash's query as a plain object (what the destination reads). */
function q(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  hashQuery(hash).forEach((v, k) => { out[k] = v; });
  return out;
}

/** Every line of the brief's route map (and each alias it names): hash → route + exact query. */
const ROUTE_MAP: Array<[string, ActiveTab, Record<string, string>]> = [
  ["#/overview", "overview", {}], ["#/now", "overview", {}], ["#/today", "overview", {}], ["#/home", "overview", {}],
  ["#/coach", "coach", {}], ["#/talk", "coach", {}], ["#/ask", "coach", {}], ["#/ask-arbor", "coach", {}],
  ["#/behaviors", "timeline", {}],
  ["#/milestones", "development", {}],
  ["#/plans", "practice", { f: "routines" }], ["#/action-plans", "practice", { f: "routines" }],
  ["#/stories", "practice", { f: "stories" }], ["#/story-journeys", "practice", { f: "stories" }],
  ["#/weekly", "weekly", {}], ["#/weekly-report", "weekly", {}],
  ["#/scholar", "coach", {}],
  ["#/language", "profile", { aspect: "lang" }],
  ["#/language/said", "timeline", { view: "areas", area: "talking" }],
  // F-SHELL-1 review fix (finding 2): the QUERY form resolves like the path form.
  ["#/language?view=said", "timeline", { view: "areas", area: "talking" }],
  ["#/handoff", "handoff", {}],
  ["#/safety", "safety", {}],
  ["#/profile", "profile", {}], ["#/my-child", "profile", {}], ["#/development-profile", "profile", {}], ["#/about", "profile", {}],
  ["#/memory", "memory", {}], ["#/child-memory", "memory", {}],
  ["#/strengths", "profile", { aspect: "strengths" }],
  ["#/screening", "screening", {}], ["#/development-check", "screening", {}],
  ["#/timeline", "timeline", {}], ["#/moments", "timeline", {}],
  ["#/journal", "journal", {}],
  ["#/find-pro", "consult", {}],
  ["#/care-team", "care-team", {}], ["#/my-care-team", "care-team", {}],
  ["#/appointments", "appointments", {}],
  ["#/sharing", "sharing", {}], ["#/trusted-sharing", "sharing", {}],
  ["#/reports", "reports", {}],
  ["#/masterclasses", "masterclasses", {}], ["#/academy", "masterclasses", {}], ["#/parent-masterclasses", "masterclasses", {}], ["#/for-you", "masterclasses", {}],
  ["#/family", "family", {}], ["#/family-formation", "family", {}],
  ["#/comics", "practice", { f: "stories" }], ["#/hero-comics", "practice", { f: "stories" }],
  // F-SHELL-1 review re-pin (finding 1): #/learn stays the reader's route, but a
  // visit without a read lands on For you's library section (LANDING below).
  ["#/learn", "learn", {}], ["#/learn-library", "learn", {}],
  ["#/speech", "practice", { f: "games", world: "speech" }],
  ["#/mimic", "practice", { f: "games", world: "mimic" }],
  ["#/feelings", "practice", { f: "games", world: "feelings" }],
  ["#/journey", "practice", { f: "games" }],
  ["#/adventures", "practice", { f: "games", world: "adventures" }],
  ["#/copilot", "copilot", {}],
  ["#/development", "development", {}], ["#/growth", "development", {}],
  ["#/daily-play", "practice", { f: "offscreen" }],
  ["#/practice", "practice", {}], ["#/together", "practice", {}], ["#/growth-journey", "practice", {}], ["#/practice-studio", "practice", {}],
  ["#/consult", "consult", {}], ["#/care", "consult", {}], ["#/care-network", "consult", {}],
  ["#/attribution", "attribution", {}],
  ["#/day-windows", "day-windows", {}],
  ["#/smart-reminders", "smart-reminders", {}], ["#/reminders", "smart-reminders", {}],
  ["#/science", "science", {}], ["#/the-science", "science", {}],
  ["#/school-brief", "school-brief", {}],
  ["#/bedtime-stories", "practice", { f: "stories", sheet: "create-story" }], ["#/bedtime-story", "practice", { f: "stories", sheet: "create-story" }],
  ["#/routines", "practice", { f: "routines" }],
];

/** The lines whose visit, arriving without a read, lands elsewhere (Shell, learnLanding.ts). */
const LANDING: Record<string, string> = {
  "#/learn": "#/masterclasses?section=library",
  "#/learn-library": "#/masterclasses?section=library",
};

describe("v3 F-SHELL-1 · every line of the route map", () => {
  it.each(ROUTE_MAP)("%s → #/%s with its place state", (hash, route, query) => {
    expect(resolveRouteId(hash)).toBe(route);
    expect(resolveHash(hash)).toEqual({ tab: route, unknown: false });
    expect(q(hash)).toEqual(query);
    expect(learnRedirectFor(route, undefined, hash)).toBe(LANDING[hash] ?? null);
  });

  it("the table covers every route id and every alias (a new route or alias needs a map line)", () => {
    const hashes = new Set(ROUTE_MAP.map(([hash]) => hash.slice(2)));
    for (const id of ROUTE_IDS) expect(hashes.has(id), id).toBe(true);
    for (const alias of Object.keys(HASH_ALIASES)) expect(hashes.has(alias), alias).toBe(true);
    for (const sub of Object.keys(SUB_ROUTES)) expect(hashes.has(sub), sub).toBe(true);
  });

  it("a parameter the link carries wins over the map's state, and rides along", () => {
    expect(q("#/plans?f=stories")).toEqual({ f: "stories" });
    expect(q("#/speech?world=mimic")).toEqual({ world: "mimic", f: "games" });
    expect(q("#/language?aspect=strengths")).toEqual({ aspect: "strengths" });
    expect(q("#/stories?month=2026-09")).toEqual({ month: "2026-09", f: "stories" });
    // the sub-route's query form: its mode names the state, other parameters ride along
    expect(q("#/language?view=said&month=2026-09")).toEqual({ view: "areas", area: "talking", month: "2026-09" });
    expect(q("#/language?month=2026-09&view=said&area=moving")).toEqual({ view: "areas", area: "talking", month: "2026-09" });
    // case-insensitive like every retired hash
    expect(resolveRouteId("#/STORIES")).toBe("practice");
    expect(q("#/STORIES")).toEqual({ f: "stories" });
  });

  it("#/milestones?shelf= opens Milestones on the shelf's area and keeps the shelf; an explicit area wins", () => {
    expect(resolveRouteId("#/milestones?shelf=words")).toBe("development");
    expect(q("#/milestones?shelf=words")).toEqual({ shelf: "words", area: "talking" });
    expect(q("#/milestones?shelf=sleep")).toEqual({ shelf: "sleep", area: "body" });
    expect(q("#/milestones?shelf=words&area=moving")).toEqual({ shelf: "words", area: "moving" });
    // an unknown shelf adds no area
    expect(q("#/milestones?shelf=nonsense")).toEqual({ shelf: "nonsense" });
    // NEGATIVE CONTROL: a LIVE route's shelf is its own business (Journal's shelf page)
    expect(q("#/journal?shelf=words")).toEqual({ shelf: "words" });
    expect(q("#/development?shelf=words")).toEqual({ shelf: "words" });
  });

  it("NEGATIVE CONTROL: a live route never gets an injected state, and an unknown hash stays unknown", () => {
    expect(q("#/practice")).toEqual({});
    expect(q("#/practice?f=games")).toEqual({ f: "games" });
    expect(q("#/profile")).toEqual({});
    expect(q("#/timeline")).toEqual({});
    expect(resolveRouteId("#/milestones")).not.toBe("milestones");
    expect(resolveHash("#/stories-x")).toEqual({ tab: "overview", unknown: true });
    expect(q("#/stories-x")).toEqual({});
  });
});

describe("v3 F-SHELL-1 · the route-map tables stay consistent", () => {
  it("every RETIRED_ROUTE_QUERY key is retired; every retirement lands on a LIVE route; no retired id is an alias", () => {
    for (const key of Object.keys(RETIRED_ROUTE_QUERY)) expect(key in RETIRED_ROUTES, key).toBe(true);
    for (const [key, target] of Object.entries(RETIRED_ROUTES)) {
      expect(target in RETIRED_ROUTES, `${key} → ${target} is retired too`).toBe(false);
      expect(ROUTE_IDS as readonly string[]).toContain(target);
      expect(Object.prototype.hasOwnProperty.call(HASH_ALIASES, key), key).toBe(false);
    }
    expect(Object.keys(RETIRED_ROUTES).length).toBe(17);
    expect(ROUTE_IDS.length).toBe(43);
  });

  it("each state names what its destination reads: f on Together, aspect on About, world only with Games", () => {
    for (const [key, state] of Object.entries(RETIRED_ROUTE_QUERY)) {
      const target = RETIRED_ROUTES[key];
      if ("f" in state) {
        expect(target, key).toBe("practice");
        expect(TOGETHER_FILTERS as readonly string[], key).toContain(state.f);
      }
      if ("aspect" in state) expect(target, key).toBe("profile");
      if ("world" in state) expect(state.f, key).toBe("games");
      if ("sheet" in state) expect(state.f, key).toBe("stories");
    }
  });

  it("every world a retired hash opens is a real Practice Studio world whose old door was that hash", () => {
    const worlds = Object.entries(RETIRED_ROUTE_QUERY).filter(([, state]) => "world" in state);
    expect(worlds.map(([key]) => key).sort()).toEqual(["adventures", "feelings", "mimic", "speech"]);
    for (const [key, state] of worlds) {
      const world = STUDIO_WORLDS.find((w) => w.id === state.world);
      expect(world, key).toBeDefined();
      expect(world!.tab, key).toBe(key);
    }
  });

  it("SHELF_AREA mirrors the shelf registry: one entry per shelf, the shelf's own domain", () => {
    const mismatches = (map: Readonly<Record<string, string>>) =>
      SHELVES.filter((s) => map[s.id] !== s.domain).map((s) => s.id);
    expect(Object.keys(SHELF_AREA).sort()).toEqual(SHELVES.map((s) => s.id).sort());
    expect(mismatches(SHELF_AREA)).toEqual([]);
    // NEGATIVE CONTROL: a drifted copy is caught
    expect(mismatches({ ...SHELF_AREA, words: "moving" })).toEqual(["words"]);
  });
});

/** Shell's pill row and Back, composed exactly as Shell composes them (source-pinned below). */
function chromeFor(tab: ActiveTab, search = ""): { row: number; back: string | null } {
  const query = new URLSearchParams(search);
  const programView = tab === "development" && query.get("view") === "program";
  const row = programView ? [] : pillRowFor(sectionForTab(tab), tab, { gamesOpen: true });
  const lit = row.length > 1 ? activePillIndex(row, tab, query) : -1;
  const back = programView ? placeForTab(tab) : isCompanionHome(tab) || lit >= 0 ? null : backTargetFor(tab);
  return { row: row.length, back: back ? back.en : null };
}
function backFor(tab: ActiveTab): string | null {
  return chromeFor(tab).back;
}

/** Every LIVE route's Back, from the route map. */
const BACK: Record<string, string | null> = {
  // homes and the routes whose pill is lit: none
  overview: null, weekly: null, development: null, timeline: null, profile: null, practice: null,
  coach: null, masterclasses: null, consult: null,
  // Now's L2 leaves
  "day-windows": "Now", "smart-reminders": "Now",
  // My child's L2 leaves
  journal: "My child", memory: "My child", screening: "My child", science: "My child", copilot: "My child",
  // the Care door's L2 leaves
  safety: "Care, together", handoff: "Care, together", "care-team": "Care, together", appointments: "Care, together",
  sharing: "Care, together", reports: "Care, together", "school-brief": "Care, together", attribution: "Care, together",
  // For you's L2 leaves
  family: "For you, the parent", learn: "For you, the parent",
};

describe("v3 F-SHELL-1 · one Back rule (critic ruling [5])", () => {
  it("the table names every live route exactly once", () => {
    const live = ROUTE_IDS.filter((id) => !(id in RETIRED_ROUTES)).sort();
    expect(Object.keys(BACK).sort()).toEqual(live);
  });

  it.each(Object.entries(BACK))("#/%s → Back %s", (tab, expected) => {
    expect(backFor(tab as ActiveTab)).toBe(expected);
  });

  it("an L2 leaf draws no pill row; a lit route draws its place's", () => {
    for (const [tab, back] of Object.entries(BACK)) {
      const row = pillRowFor(sectionForTab(tab as ActiveTab), tab as ActiveTab, { gamesOpen: true });
      if (back) expect(row, tab).toEqual([]);
    }
    for (const tab of ["day-windows", "smart-reminders", "memory", "science", "journal", "screening", "copilot", "attribution"] as const) {
      expect(NO_PILL_ROW_TABS.has(tab), tab).toBe(true);
    }
    expect(NO_PILL_ROW_TABS.has("timeline")).toBe(false);
    expect(homeIdForTab("timeline")).toBe("child");
  });

  // F-SHELL-1 review fix (finding 6): the program page is an L2 leaf of My child.
  it("#/development?view=program draws no pill row and wears Back to My child; Milestones itself keeps its lit pill", () => {
    expect(chromeFor("development", "view=program")).toEqual({ row: 0, back: "My child" });
    expect(placeForTab("development").tab).toBe("development");
    // NEGATIVE CONTROL: Milestones (no view, or another view) is the lit pill of a drawn row, with no Back
    expect(chromeFor("development")).toEqual({ row: 3, back: null });
    expect(chromeFor("development", "view=areas")).toEqual({ row: 3, back: null });
    // and view=program means nothing on another route
    expect(chromeFor("timeline", "view=program")).toEqual({ row: 3, back: null });
  });

  it("Shell composes Back from the lit pill (source pin)", () => {
    const shell = readFileSync(path.resolve(__dirname, "../components/layout/Shell.tsx"), "utf8").replace(/\r\n/g, "\n");
    // F-SHELL-1 review re-pin (finding 6): the program view is pill-less with Back to My child.
    expect(shell).toContain('const programView = activeTab === "development" && query.get("view") === "program";');
    expect(shell).toContain("const pillRow = programView ? [] : pillRowFor(section, activeTab, { gamesOpen });");
    expect(shell).toContain("const activePill = pillRow.length > 1 ? activePillIndex(pillRow, activeTab, query) : -1;");
    expect(shell).toContain("const back = programView ? placeForTab(activeTab) : isCompanionHome(activeTab) || activePill >= 0 ? null : backTargetFor(activeTab);");
    // NEGATIVE CONTROL: the IA-01 rule (Back on every non-home route) is not it
    expect("const back = isCompanionHome(activeTab) ? null : backTargetFor(activeTab);".includes("activePill >= 0")).toBe(false);
    // …and under that rule a lit pill would have worn a Back
    expect(isCompanionHome("weekly") ? null : backTargetFor("weekly")).not.toBeNull();
  });
});

/** The pill a hash lights: the label key of the lit pill in its route's row. */
function litPill(hash: string, gamesOpen: boolean): string | null {
  const tab = resolveRouteId(hash)!;
  const row = pillRowFor(sectionForTab(tab), tab, { gamesOpen });
  if (row.length < 2) return null;
  const at = activePillIndex(row, tab, hashQuery(hash));
  return at < 0 ? null : row[at].labelKey ?? `nav.tab.${row[at].tab}`;
}

describe("v3 F-SHELL-1 · every old route lights the pill that holds its content", () => {
  it.each([
    ["#/behaviors", "nav.pill.moments"],
    ["#/language/said", "nav.pill.moments"],
    ["#/language?view=said", "nav.pill.moments"],
    ["#/milestones", "nav.pill.milestones"],
    ["#/milestones?shelf=words", "nav.pill.milestones"],
    ["#/language", "nav.pill.about"],
    ["#/strengths", "nav.pill.about"],
    ["#/plans", "nav.pill.together.routines"],
    ["#/action-plans", "nav.pill.together.routines"],
    ["#/routines", "nav.pill.together.routines"],
    ["#/stories", "nav.pill.together.stories"],
    ["#/comics", "nav.pill.together.stories"],
    ["#/bedtime-stories", "nav.pill.together.stories"],
    ["#/daily-play", "nav.pill.together.offscreen"],
    ["#/speech", "nav.pill.together.games"],
    ["#/mimic", "nav.pill.together.games"],
    ["#/feelings", "nav.pill.together.games"],
    ["#/adventures", "nav.pill.together.games"],
    ["#/journey", "nav.pill.together.games"],
    ["#/practice", "nav.pill.together.all"],
    ["#/growth-journey", "nav.pill.together.all"],
    ["#/weekly", "nav.pill.weekly"],
  ] as const)("%s → %s", (hash, key) => {
    expect(litPill(hash, true)).toBe(key);
  });

  it("with no game world open to the child, a Games hash lights All together (the Games pill is not drawn)", () => {
    for (const hash of ["#/speech", "#/journey", "#/practice?f=games"]) expect(litPill(hash, false), hash).toBe("nav.pill.together.all");
    expect(litPill("#/stories", false)).toBe("nav.pill.together.stories");
  });

  it("a door draws no row, so its retired hashes light nothing", () => {
    expect(litPill("#/scholar", true)).toBeNull();
    expect(litPill("#/find-pro", true)).toBeNull();
    expect(litPill("#/safety", true)).toBeNull();
  });
});

describe("v3 F-SHELL-1 · a retired id never mounts", () => {
  it("ArborContext's one state setter maps a retired id to its destination (source pin)", () => {
    const ctx = readFileSync(path.resolve(__dirname, "../context/ArborContext.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(ctx).toContain("const [activeTab, setActiveTabRaw] = useState<ActiveTab>(initialHash.tab);");
    expect(ctx).toContain("const setActiveTabState = (t: ActiveTab) => setActiveTabRaw(RETIRED_ROUTES[t] ?? t);");
    // the raw setter has exactly one caller: the mapping wrapper
    expect(ctx.match(/setActiveTabRaw\(/g)).toHaveLength(1);
    // NEGATIVE CONTROL: the pre-F-SHELL-1 state line fails the pin
    expect("const [activeTab, setActiveTabState] = useState<ActiveTab>(initialHash.tab);".includes("setActiveTabRaw")).toBe(false);
  });

  it("a stored retired id restores to its destination, never to itself", () => {
    for (const [key, target] of Object.entries(RETIRED_ROUTES)) {
      expect(resolveHash("", key)).toEqual({ tab: target, unknown: false });
    }
  });

  it("a hard-moment search row opens its card in the hard-moment sheet, not the retired Behaviors route (source pin)", () => {
    const hook = readFileSync(path.resolve(__dirname, "../components/search/useSearchResults.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(hook).toContain('if (e.kind === "hard-moment") { openHardMomentNow(e.id.slice("hard-moment:".length)); return; }');
    const index = readFileSync(path.resolve(__dirname, "searchIndex.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(index).toContain('{ en: [card.category], he: [] }, "timeline",');
    // NEGATIVE CONTROL: the pre-F-SHELL-1 row (a switch to Behaviors) fails the pin
    expect('go: () => { if (e.lens) setSelectedLens(e.lens); setActiveTab(e.tab); },'.includes("openHardMomentNow")).toBe(false);
  });
});

describe("v3 F-SHELL-1 review fix (finding 1) · #/learn without a read lands on For you's library", () => {
  it("a read-less visit lands on #/masterclasses at the library section; a visit with a read keeps the reader", () => {
    expect(LEARN_LIBRARY_HASH).toBe("#/masterclasses?section=library");
    expect(resolveHash(LEARN_LIBRARY_HASH)).toEqual({ tab: "masterclasses", unknown: false });
    expect(q(LEARN_LIBRARY_HASH)).toEqual({ section: "library" });
    expect(learnRedirectFor("learn", undefined, "#/learn")).toBe(LEARN_LIBRARY_HASH);
    expect(learnRedirectFor("learn", null, "#/learn-library")).toBe(LEARN_LIBRARY_HASH);
    // a pending card request (requestLearnRead) or a ?card= link is a read: no landing
    expect(learnRedirectFor("learn", "card-1", "#/learn")).toBeNull();
    expect(learnRedirectFor("learn", undefined, "#/learn?card=card-1")).toBeNull();
    // the reader wears Back to For you, the parent
    expect(backFor("learn")).toBe("For you, the parent");
    // NEGATIVE CONTROL: no other route lands anywhere
    expect(learnRedirectFor("masterclasses", undefined, "#/masterclasses")).toBeNull();
    expect(learnRedirectFor("family", undefined, "#/family")).toBeNull();
  });

  it("Shell renders nothing for the read-less visit and the landing replaces the hash (source pins)", () => {
    const read = (rel: string) => readFileSync(path.resolve(__dirname, rel), "utf8").replace(/\r\n/g, "\n");
    const shell = read("../components/layout/Shell.tsx");
    expect(shell).toContain('const learnRedirect = useLearnLanding(activeTab, pendingLearnRequest?.cardId, consumeLearnRequest, activeTab === "masterclasses" && query.get("section") === "library");');
    expect(shell).toContain("{learnRedirect ? null");
    const landing = read("../components/layout/learnLanding.ts");
    // decided once, at arrival: the Library consumes the request as it opens the read
    expect(landing).toContain("else if (arrival.current === undefined) arrival.current = learnRedirectFor(activeTab, pendingCardId, liveHash());");
    // replace, never push: Back does not return to an empty #/learn
    expect(landing).toContain("window.location.replace(redirect);");
    expect(landing).not.toContain("window.location.hash =");
    expect(landing).toContain(`['[data-testid="academy-by-area"]', '[data-testid="academy-courses"]']`);
  });
});
