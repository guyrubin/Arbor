import { describe, expect, it } from "vitest";
import { RETIRED_ROUTES, ROUTE_IDS, type ActiveTab } from "./routes";
import { COMPANION_DOORS, COMPANION_PLACES, homeForTab, placeForTab } from "./companionPlaces";
import { homeIdForTab, type HomeId } from "./navigation";
describe("three places, complete route coverage", () => {
  it("keeps every deep link in a named place", () => {
    expect(ROUTE_IDS).toHaveLength(43);
    for (const tab of ROUTE_IDS) expect(COMPANION_PLACES).toContain(placeForTab(tab));
  });
  it("keeps family care with the child and play with Together", () => {
    expect(placeForTab("consult").id).toBe("child");
    expect(placeForTab("memory").id).toBe("child");
    expect(placeForTab("stories").id).toBe("together");
    expect(placeForTab("daily-play").id).toBe("together");
    expect(placeForTab("masterclasses").id).toBe("now");
  });
});

/** v3 table A ("Where every one of the 43 routes goes"), transcribed route by
 *  route. A Record over ActiveTab, so a route added to ROUTE_IDS without a
 *  home here fails the type check. FEAT-07 re-pin: table A sends plans (and
 *  the retired routines) to Together → Routines, and that Together entry now
 *  ships, so both live in Together. */
const TABLE_A: Record<ActiveTab, HomeId> = {
  // Today → Now
  overview: "now", "day-windows": "now", "smart-reminders": "now", weekly: "now",
  // Growth → My child
  development: "child", milestones: "child", language: "child", screening: "child", copilot: "child",
  // Journal / Profile → My child (strengths is retired to profile)
  journal: "child", timeline: "child", profile: "child", memory: "child", strengths: "child", science: "child",
  // Behaviors → My child; plans and the retired routines → Together (FEAT-07, see above)
  behaviors: "child", plans: "together", routines: "together",
  // Practice → Together (journey is retired to practice; Daily Play is play the family shares)
  practice: "together", speech: "together", mimic: "together", feelings: "together", adventures: "together", journey: "together", "daily-play": "together",
  // Stories → Together
  stories: "together", comics: "together", "bedtime-stories": "together",
  // Ask Arbor → the Talk door (scholar is retired to coach)
  coach: "talk", scholar: "talk",
  // Learn → For you, the parent
  masterclasses: "learn", learn: "learn", family: "learn",
  // Care Network → Care, together (find-pro is retired to consult; attribution is admin-only, under Care)
  consult: "care", safety: "care", "school-brief": "care", sharing: "care", "care-team": "care", appointments: "care", reports: "care", handoff: "care", "find-pro": "care", attribution: "care",
};
const HOME_IDS: readonly HomeId[] = ["now", "child", "together", "talk", "learn", "care"];

describe("v3 IA-04 · every route has exactly one home, a place or a door (table A)", () => {
  it("the fixture covers the 43 routes, no more and no fewer", () => {
    expect(Object.keys(TABLE_A).sort()).toEqual([...ROUTE_IDS].sort());
  });

  it("homeIdForTab reads table A for every route", () => {
    for (const tab of ROUTE_IDS) expect(homeIdForTab(tab), tab).toBe(TABLE_A[tab]);
  });

  it("homeForTab names that one home, as its place or its door", () => {
    for (const tab of ROUTE_IDS) {
      const home = homeForTab(tab);
      const id = home.kind === "place" ? home.place.id : home.door.id;
      expect(id, tab).toBe(TABLE_A[tab]);
      if (home.kind === "place") {
        expect(COMPANION_PLACES, tab).toContain(home.place);
        expect(COMPANION_DOORS.some((door) => door.id === id), tab).toBe(false);
      } else {
        expect(COMPANION_DOORS, tab).toContain(home.door);
        expect(COMPANION_PLACES.some((place) => place.id === id), tab).toBe(false);
      }
    }
  });

  it("the homes are exactly the three places and the three doors, and each is used", () => {
    expect([...COMPANION_PLACES.map((p) => p.id), ...COMPANION_DOORS.map((d) => d.id)]).toEqual([...HOME_IDS]);
    expect(new Set(ROUTE_IDS.map(homeIdForTab))).toEqual(new Set(HOME_IDS));
  });

  it("a retired route keeps the home of the route it redirects to", () => {
    expect(Object.keys(RETIRED_ROUTES).length).toBeGreaterThan(0);
    for (const [retired, target] of Object.entries(RETIRED_ROUTES)) {
      expect(homeIdForTab(retired as ActiveTab), retired).toBe(homeIdForTab(target));
    }
  });

  it("each door opens on a route that lives behind it, with its own glyph from the shipped set", () => {
    expect(COMPANION_DOORS.map((d) => [d.id, d.tab, d.icon])).toEqual([
      ["talk", "coach", "forum"],
      ["learn", "masterclasses", "school"],
      ["care", "consult", "diversity_1"],
    ]);
    for (const door of COMPANION_DOORS) expect(homeForTab(door.tab)).toEqual({ kind: "door", door });
    for (const place of COMPANION_PLACES) expect(homeForTab(place.tab)).toEqual({ kind: "place", place });
    const glyphs = [...COMPANION_PLACES, ...COMPANION_DOORS].map((h) => h.icon);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("each door is named in EN and HE, the Hebrew with no Latin letters", () => {
    expect(COMPANION_DOORS.map((d) => d.en)).toEqual(["Talk with Arbor", "For you, the parent", "Care, together"]);
    for (const door of COMPANION_DOORS) {
      expect(door.he, door.id).toBeTruthy();
      expect(door.he, door.id).not.toMatch(/[A-Za-z]/);
      expect(door.he, door.id).not.toBe(door.en);
    }
  });
});

describe("v3 IA-04 · Back returns to a place", () => {
  it("a place route returns to its own place; a door route to the place its door belongs to", () => {
    const doorReturn: Record<string, string> = { talk: "now", learn: "now", care: "child" };
    for (const tab of ROUTE_IDS) {
      const home = homeForTab(tab);
      expect(placeForTab(tab).id, tab).toBe(home.kind === "place" ? home.place.id : doorReturn[home.door.id]);
    }
  });

  it("Behaviors returns to My child, not Now; Plans and Routines return to Together (FEAT-07)", () => {
    // Before IA-04 the Behaviors hub fell through to Now.
    expect(placeForTab("behaviors").tab).toBe("development");
    expect(placeForTab("behaviors").id).toBe("child");
    // FEAT-07 re-pin: a plan is started and run from Together → Routines.
    expect(placeForTab("plans").id).toBe("together");
    expect(placeForTab("routines").id).toBe("together");
  });

  it("old deep links keep the place of the route they now land on", () => {
    expect(placeForTab("scholar")).toBe(placeForTab("coach"));
    expect(placeForTab("strengths")).toBe(placeForTab("profile"));
    expect(placeForTab("journey")).toBe(placeForTab("practice"));
    expect(placeForTab("find-pro")).toBe(placeForTab("consult"));
  });
});
