/**
 * GP-19 — one word was doing seven jobs.
 *
 * Seven surfaces a parent can reach were called "Development …": the hub
 * (`nav.tab.development`), Development Milestones, the Development Check,
 * the Development Profile, the Development picture (`devscore.eyebrow`), the
 * Development snapshot (`ms.title`) and the Development Journey. A parent
 * reading the sidebar could not tell which of them held what, and "Development
 * Profile" in particular reads as a clinical document about a child rather than
 * the place their parent keeps them.
 *
 * The names now: the hub is Growth · the milestones page is Milestones (nav
 * label AND page title AND the Profile chapter that links to it — one name per
 * surface) · the Profile hub is My Child · the screening keeps "Development
 * Check", because that is precisely what it is and renaming it would hide a
 * screening behind a friendlier word.
 *
 * ROUTE IDS ARE UNTOUCHED. They are persisted in `arbor.activeTab` and baked
 * into every shared deep link, so this is a dictionary change; `routes.ts`
 * carries an alias for each new label's slug so the visible name stays typeable.
 */
import { describe, expect, it } from "vitest";
import { en, he } from "./i18n";
import { ROUTE_IDS, resolveRouteId } from "./routes";

/** The names that were retired. A dictionary must not ship any of them. */
const RETIRED_NAMES = [
  "Development Profile",
  "Development Milestones",
  "Development milestones",
  "Development picture",
  "Development snapshot",
  "Development Journey",
  "פרופיל התפתחותי",
  "אבני דרך התפתחותיות",
  "תמונת מצב התפתחותית",
];

/** The scan, as a function of the dictionary, so it can be run against one
 *  that still carries the old names (the negative control). */
function retiredNamesIn(dict: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(dict)) {
    for (const name of RETIRED_NAMES) if (value === name) out.push(`${key} → ${name}`);
  }
  return out.sort();
}

describe("GP-19 · the seven Development names", () => {
  it("neither dictionary ships a retired surface name", () => {
    expect(retiredNamesIn(en)).toEqual([]);
    expect(retiredNamesIn(he)).toEqual([]);
  });

  it("NEGATIVE CONTROL: the pre-fix dictionary trips the same scan", () => {
    // The exact values that shipped. If the scan passes on these, it is
    // measuring nothing.
    const preFix = {
      "nav.tab.profile": "Development Profile",
      "nav.tab.milestones": "Development Milestones",
      "ms.title": "Development snapshot",
      "nav.tab.screening": "Development Check", // kept on purpose — not an offender
    };
    expect(retiredNamesIn(preFix)).toEqual([
      "ms.title → Development snapshot",
      "nav.tab.milestones → Development Milestones",
      "nav.tab.profile → Development Profile",
    ]);
    const preFixHe = { "nav.tab.profile": "פרופיל התפתחותי" };
    expect(retiredNamesIn(preFixHe)).toHaveLength(1);
  });

  it("the recommended names are what both dictionaries say", () => {
    expect(en["nav.tab.development"]).toBe("Growth");
    expect(en["nav.tab.milestones"]).toBe("Milestones");
    expect(en["nav.tab.profile"]).toBe("My Child");
    expect(en["nav.cat.profile"]).toBe("My Child");
    expect(en["nav.title.profile"]).toBe("My Child");
    expect(en["nav.tab.journey"]).toBe("Growth Journey");
    expect(en["devscore.eyebrow"]).toBe("Growth picture");

    expect(he["nav.tab.profile"]).toBe("הילד שלי");
    expect(he["nav.cat.profile"]).toBe("הילד שלי");
    expect(he["nav.title.profile"]).toBe("הילד שלי");
    expect(he["nav.tab.milestones"]).toBe("אבני דרך");
    // The Hebrew hub keeps התפתחות: it is the natural word for this hub and it
    // is what nav.cat.growth already says, so EN and HE stay one hub, not two.
    expect(he["nav.tab.development"]).toBe(he["nav.cat.growth"]);
  });

  it("the screening keeps its honest name in both languages", () => {
    expect(en["nav.tab.screening"]).toBe("Development Check");
    expect(en["sec.screen.title"]).toBe("Development Check");
    expect(he["nav.tab.screening"]).toBe("בדיקת התפתחות");
  });

  it("one name per surface: the nav label, the page title and the chapter agree", () => {
    for (const dict of [en, he]) {
      expect(dict["ms.title"]).toBe(dict["nav.tab.milestones"]);
      expect(dict["cp.ch.milestones"]).toBe(dict["nav.tab.milestones"]);
    }
  });

  it("no route id moved — only the words changed", () => {
    for (const id of ["development", "profile", "milestones", "journey", "screening"]) {
      expect(ROUTE_IDS as readonly string[]).toContain(id);
    }
    // …and each new label's slug is typeable, old links still land.
    expect(resolveRouteId("#/my-child")).toBe("profile");
    expect(resolveRouteId("#/growth-journey")).toBe("journey");
    expect(resolveRouteId("#/growth")).toBe("development");
    expect(resolveRouteId("#/milestones")).toBe("milestones");
    expect(resolveRouteId("#/development-profile")).toBe("profile");
    expect(resolveRouteId("#/development-check")).toBe("screening");
  });
});
