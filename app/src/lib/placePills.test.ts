/**
 * v3 IA-02 — pill rows per place (L1).
 *
 * A parent stands in one of three places. Before this item only Now carried a
 * row (in the legacy hub order Overview · Day Windows · Reminders · Weekly), My
 * child's home and Together's home showed none, and a My child leaf such as
 * #/milestones wore the Growth hub row (Growth · Milestones · Language &
 * Communication · Daily Play · Development Check), which named a hub the
 * parent can no longer see and put a Together activity inside My child.
 *
 * PLACE_PILLS is now the only rendered pill order for a place; SECTIONS stays
 * the hub index for More and search and still serves the doors' rows.
 *   - Now:      Now · Weekly report · Day windows · Reminders
 *   - My child: Development map · Milestones · Language · Portrait · Journal ·
 *               Moments · Profile
 *   - Together: no Shell row. Its first level is the in-page filter row on
 *               #/practice (TogetherView), and a second row would repeat it.
 * The record's two densities (#/journal, #/timeline) keep their own Feed ·
 * Story tablist and show no Shell row above it.
 *
 * Node-only vitest: rows and labels are data, and the Shell's use of them is
 * asserted on its source. Each rule has a negative control.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_TABS } from "../context/ArborContext";
import { COMPANION_PLACES, homeForTab } from "./companionPlaces";
import { translate } from "./i18n";
import {
  NO_PILL_ROW_TABS,
  PLACE_PILLS,
  homeIdForTab,
  hubTabsForSection,
  isCompactHiddenTool,
  pillRowFor,
  sectionForTab,
  type NavItem,
  type PillPlace,
} from "./navigation";

const here = path.dirname(fileURLToPath(import.meta.url));
const tabsOf = (row: readonly NavItem[]) => row.map((it) => it.tab);
const PLACES = Object.keys(PLACE_PILLS) as PillPlace[];
const rowFor = (tab: (typeof ALL_TABS)[number]) => pillRowFor(sectionForTab(tab), tab);
/** The key a pill's label renders from (Shell: `it.labelKey ?? "nav.tab." + it.tab`). */
const labelKeyOf = (it: NavItem) => it.labelKey ?? "nav.tab." + it.tab;
const label = (lang: "en" | "he", it: NavItem) => translate(lang, labelKeyOf(it));

describe("1 · each place's row, in table A's order", () => {
  it("Now: Now · Weekly report · Day windows · Reminders", () => {
    expect(tabsOf(PLACE_PILLS.now)).toEqual(["overview", "weekly", "day-windows", "smart-reminders"]);
  });

  it("My child: Development map · Milestones · Language · Portrait · Journal · Moments · Profile", () => {
    expect(tabsOf(PLACE_PILLS.child)).toEqual(["development", "milestones", "language", "timeline", "journal", "behaviors", "profile"]);
  });

  it("only Now and My child have a Shell row; Together's first level is its in-page filter row", () => {
    expect(PLACES).toEqual(["now", "child"]);
    const together = readFileSync(path.resolve(here, "../components/companion/TogetherView.tsx"), "utf8");
    expect(together).toContain('className="companion-filter"');
    expect(homeIdForTab("practice")).toBe("together");
  });

  it("each row leads with its place's home pill, then at most six, with no tab twice", () => {
    for (const place of PLACES) {
      const row = PLACE_PILLS[place];
      expect(row[0].tab, place).toBe(COMPANION_PLACES.find((p) => p.id === place)!.tab);
      expect(row.length, place).toBeLessThanOrEqual(7);
      expect(new Set(tabsOf(row)).size, place).toBe(row.length);
    }
  });

  it("every pill in a row belongs to that place (a route's home decides its row)", () => {
    for (const place of PLACES) for (const it of PLACE_PILLS[place]) expect(homeIdForTab(it.tab), it.tab).toBe(place);
  });
});

describe("2 · pillRowFor: the place's row on the place and on every leaf", () => {
  it("every route whose home is Now or My child wears that place's row", () => {
    const checked: string[] = [];
    for (const tab of ALL_TABS) {
      const home = homeIdForTab(tab);
      if (NO_PILL_ROW_TABS.has(tab) || (home !== "now" && home !== "child")) continue;
      expect(rowFor(tab), tab).toBe(PLACE_PILLS[home]);
      checked.push(tab);
    }
    // FEAT-07 moves Plans into Together. Keep exact coverage of every remaining
    // Now/My child route, rather than retaining the pre-routines count.
    expect(checked).toEqual([
      "overview", "behaviors", "milestones", "weekly", "language", "profile",
      "memory", "strengths", "screening", "copilot", "development",
      "day-windows", "smart-reminders", "science",
    ]);
    expect(homeIdForTab("plans")).toBe("together");
  });

  it("the acceptance routes: #/development, #/overview, and #/milestones in the My child row", () => {
    expect(tabsOf(rowFor("development"))).toEqual(tabsOf(PLACE_PILLS.child));
    expect(tabsOf(rowFor("overview"))).toEqual(tabsOf(PLACE_PILLS.now));
    expect(tabsOf(rowFor("milestones"))).toEqual(tabsOf(PLACE_PILLS.child));
    expect(tabsOf(rowFor("weekly"))).toEqual(tabsOf(PLACE_PILLS.now));
  });

  it("the record's two densities keep their own Feed · Story nav and render no Shell row; they stay doors in My child", () => {
    for (const tab of ["journal", "timeline"] as const) {
      expect(NO_PILL_ROW_TABS.has(tab), tab).toBe(true);
      expect(rowFor(tab), tab).toEqual([]);
      expect(tabsOf(PLACE_PILLS.child), tab).toContain(tab);
    }
    const timeline = readFileSync(path.resolve(here, "../components/tabs/TimelineTab.tsx"), "utf8");
    expect(timeline).toContain('data-density-toggle=""');
  });

  it("Together renders no Shell row, on its home or on any of its leaves", () => {
    const together = ALL_TABS.filter((tab) => homeIdForTab(tab) === "together");
    expect(together).toEqual(expect.arrayContaining(["practice", "stories", "comics", "daily-play"]));
    for (const tab of together) expect(rowFor(tab), tab).toEqual([]);
  });

  it("the doors keep their hub rows (Care, For you, the parent) and attribution keeps none", () => {
    for (const tab of ["consult", "masterclasses"] as const) {
      expect(homeForTab(tab).kind, tab).toBe("door");
      expect(rowFor(tab), tab).toEqual(hubTabsForSection(sectionForTab(tab)));
      expect(rowFor(tab).length, tab).toBeGreaterThan(1);
    }
    expect(rowFor("attribution")).toEqual([]);
  });

  it("NEGATIVE CONTROL: the shipped rule put #/milestones in the Growth hub row and gave #/development none", () => {
    const shipped = (tab: (typeof ALL_TABS)[number]) => (NO_PILL_ROW_TABS.has(tab) ? [] : hubTabsForSection(sectionForTab(tab)));
    expect(tabsOf(shipped("milestones"))).toEqual(["development", "milestones", "language", "daily-play", "screening"]);
    expect(tabsOf(shipped("milestones"))).not.toEqual(tabsOf(rowFor("milestones")));
    expect(tabsOf(shipped("overview"))).toEqual(["overview", "day-windows", "smart-reminders", "weekly"]);
    expect(tabsOf(shipped("overview"))).not.toEqual(tabsOf(rowFor("overview")));
  });
});

describe("3 · below md, Now shows Now and Weekly report; My child hides nothing", () => {
  const compact = (row: readonly NavItem[]) => tabsOf(row).filter((tab) => !isCompactHiddenTool(sectionForTab(tab), tab));

  it("Now collapses to its home and the Weekly report (TJB-25 class, unchanged)", () => {
    expect(compact(PLACE_PILLS.now)).toEqual(["overview", "weekly"]);
  });

  it("My child keeps all seven; the row scrolls instead", () => {
    expect(compact(PLACE_PILLS.child)).toEqual(tabsOf(PLACE_PILLS.child));
  });
});

describe("4 · glyphs: shipped, one per destination, and `history` stays Talk's", () => {
  const subset = new Set(
    readFileSync(path.resolve(here, "../../public/fonts/material-symbols-rounded-subset.icons.txt"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );

  /** Glyphs that two different pills share, across both rows. */
  function sharedGlyphs(rows: ReadonlyArray<readonly NavItem[]>): string[] {
    const byGlyph = new Map<string, Set<string>>();
    for (const row of rows) for (const it of row) {
      if (!byGlyph.has(it.msIcon)) byGlyph.set(it.msIcon, new Set());
      byGlyph.get(it.msIcon)!.add(it.tab);
    }
    return [...byGlyph].filter(([, tabs]) => tabs.size > 1).map(([glyph, tabs]) => `${glyph}: ${[...tabs].sort().join(", ")}`).sort();
  }

  it("every pill glyph is in the shipped font subset", () => {
    expect(subset.size).toBeGreaterThan(100);
    for (const place of PLACES) for (const it of PLACE_PILLS[place]) expect(subset.has(it.msIcon), `${it.tab} → ${it.msIcon}`).toBe(true);
  });

  it("no two pills share a glyph, Portrait is photo_library, and no pill takes history", () => {
    expect(sharedGlyphs(PLACES.map((p) => PLACE_PILLS[p]))).toEqual([]);
    expect(PLACE_PILLS.child.find((it) => it.tab === "timeline")?.msIcon).toBe("photo_library");
    for (const place of PLACES) for (const it of PLACE_PILLS[place]) expect(it.msIcon, it.tab).not.toBe("history");
  });

  it("NEGATIVE CONTROL: a duplicated glyph is caught", () => {
    const dup = PLACE_PILLS.child.map((it) => (it.tab === "milestones" ? { ...it, msIcon: "map" } : it));
    expect(sharedGlyphs([PLACE_PILLS.now, dup])).toEqual(["map: development, milestones"]);
    expect(subset.has("not_a_shipped_glyph")).toBe(false);
  });
});

describe("5 · every pill label exists in EN and HE", () => {
  const pills = PLACES.flatMap((place) => PLACE_PILLS[place]).filter((it) => it.tab !== "overview");
  const latin = (s: string) => /[A-Za-z]/.test(s.replace(/\{[a-z]+\}/g, ""));

  it("each label key resolves in both languages; Hebrew is Hebrew, with no Latin word", () => {
    for (const it of pills) {
      for (const lang of ["en", "he"] as const) expect(label(lang, it), `${lang}:${labelKeyOf(it)}`).not.toBe(labelKeyOf(it));
      expect(label("he", it), labelKeyOf(it)).toMatch(/[֐-׿]/);
      expect(latin(label("he", it)), labelKeyOf(it)).toBe(false);
    }
  });

  it("the rows read as table A in English", () => {
    expect(PLACE_PILLS.child.map((it) => label("en", it))).toEqual(["Development map", "Milestones", "Language", "Portrait", "Journal", "Moments", "Profile"]);
    expect(PLACE_PILLS.now.slice(1).map((it) => label("en", it))).toEqual(["Weekly report", "Day windows", "Reminders"]);
    expect(PLACE_PILLS.child.map((it) => label("he", it))).toEqual(["מפת התפתחות", "אבני דרך", "שפה", "דיוקן", "יומן", "רגעים", "פרופיל"]);
  });

  it("the tablist is named for its home in both languages", () => {
    expect(translate("en", "nav.pills.aria", { place: "My child" })).toBe("My child: sections");
    expect(translate("he", "nav.pills.aria", { place: "הילד שלי" })).toBe("הילד שלי: אזורים");
    expect(latin(translate("he", "nav.pills.aria"))).toBe(false);
  });

  it("NEGATIVE CONTROL: the nav.tab names the pills replace were too long, or repeated the place", () => {
    expect(translate("en", "nav.tab.language")).toBe("Language & Communication");
    expect(translate("en", "nav.tab.profile")).toBe("My Child");
    expect(translate("en", "nav.tab.development")).toBe("Growth");
    expect(translate("en", "nav.pill.no-such-pill")).toBe("nav.pill.no-such-pill");
  });
});

describe("6 · Shell renders the row from pillRowFor alone", () => {
  const shell = readFileSync(path.resolve(here, "../components/layout/Shell.tsx"), "utf8");

  it("the row shows wherever pillRowFor has more than one pill (on the places too)", () => {
    expect(shell).toContain("{pillRowFor(section, activeTab).length > 1 && (");
    expect(shell).not.toContain('activeTab === "overview") && pillRowFor');
  });

  it("the tablist name is keyed, never the English hub label", () => {
    expect(shell).toContain('aria-label={t("nav.pills.aria", { place: pillRowHomeName(activeTab, uiLang) })}');
    expect(shell).not.toContain("${section.label} sections");
  });

  // v3 F-SHELL-2 re-pin (critic ruling 13): pills are label-only. The glyph
  // left the pill (msIcon stays in the data: search and the More sheet read it,
  // and the iconFamily one-glyph check still runs on it); the 44 px floor and
  // the no-wrap rule stay.
  it("each pill reads its own label key, draws no glyph, never wraps and clears 44 px", () => {
    expect(shell).toContain('t(it.labelKey ?? "nav.tab." + it.tab)');
    expect(shell).not.toContain("<Icon name={it.msIcon} size={14} />");
    expect(shell).not.toContain("<Icon name={placeForTab(it.tab).icon} size={14} />");
    const pill = shell.slice(shell.indexOf('role="tab"'), shell.indexOf("</button>", shell.indexOf('role="tab"')));
    expect(pill).not.toContain("<Icon");
    expect(pill).toContain("min-h-[44px]");
    expect(pill).toContain("whitespace-nowrap");
    expect(pill).toContain("text-[12.5px] font-bold");
    expect(pill).toContain("px-4 py-2");
  });
});
