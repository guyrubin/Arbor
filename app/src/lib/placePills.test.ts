/**
 * v3 IA-02 / F-SHELL-1 — pill rows per place (L1), as the v3 mock draws them.
 *
 * A parent stands in one of three places, and each place draws one row:
 *   - Now:      Now · Weekly report
 *   - My child: Milestones (#/development) · Moments (#/timeline) ·
 *               About <child> (#/profile)
 *   - Together: All together · Games · Stories · Routines · Away from the
 *               screen — all on #/practice, told apart by its `f` filter.
 * The doors (Talk, For you, Care) are one pill each, so they draw no row (critic
 * ruling [1]). An L2 leaf (Day windows, Reminders, Your journal, What Arbor
 * remembers, the Development check, the Copilot, The Science, the admin
 * attribution page) draws none and keeps Back to its home (ruling [5]).
 *
 * Re-pinned by F-SHELL-1 (Guy's 12 Oct direction, rulings [1]-[4]): the IA-02
 * rows were Now · Weekly report · Day windows · Reminders and a seven-pill My
 * child row; Together had no Shell row; the doors wore their hub rows.
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
  TOGETHER_FILTERS,
  activePillIndex,
  homeIdForTab,
  hubTabsForSection,
  isCompactHiddenTool,
  pillRowFor,
  sectionForTab,
  type NavItem,
  type PillPlace,
} from "./navigation";
import { RETIRED_ROUTES } from "./routes";

const here = path.dirname(fileURLToPath(import.meta.url));
const tabsOf = (row: readonly NavItem[]) => row.map((it) => it.tab);
const filtersOf = (row: readonly NavItem[]) => row.map((it) => it.query?.f ?? "");
const PLACES = Object.keys(PLACE_PILLS) as PillPlace[];
type Tab = (typeof ALL_TABS)[number];
const rowFor = (tab: Tab, gamesOpen = true) => pillRowFor(sectionForTab(tab), tab, { gamesOpen });
/** The key a pill's label renders from (Shell: `it.labelKey ?? "nav.tab." + it.tab`). */
const labelKeyOf = (it: NavItem) => it.labelKey ?? "nav.tab." + it.tab;
const label = (lang: "en" | "he", it: NavItem) => translate(lang, labelKeyOf(it));
/** One pill's identity: its route and its filter. */
const idOf = (it: NavItem) => `${it.tab}?${new URLSearchParams(it.query ?? {}).toString()}`;

describe("1 · each place's row, in the mock's order", () => {
  it("Now: Now · Weekly report (Day windows and Reminders left the row)", () => {
    expect(tabsOf(PLACE_PILLS.now)).toEqual(["overview", "weekly"]);
    expect(tabsOf(PLACE_PILLS.now)).not.toContain("day-windows");
    expect(tabsOf(PLACE_PILLS.now)).not.toContain("smart-reminders");
  });

  it("My child: Milestones (#/development) · Moments (#/timeline) · About <child> (#/profile)", () => {
    expect(tabsOf(PLACE_PILLS.child)).toEqual(["development", "timeline", "profile"]);
    expect(PLACE_PILLS.child.map((it) => it.labelKey)).toEqual(["nav.pill.milestones", "nav.pill.moments", "nav.pill.about"]);
    expect(PLACE_PILLS.child.map((it) => it.msIcon)).toEqual(["check_circle", "photo_album", "person"]);
    // Ruling [2]: Moments stops borrowing the Behaviors hub's name.
    for (const it of PLACE_PILLS.child) expect(it.labelKey, it.tab).not.toBe("nav.tab.behaviors");
  });

  it("Together: five filters of #/practice, in the mock's order", () => {
    expect(TOGETHER_FILTERS).toEqual(["all", "games", "stories", "routines", "offscreen"]);
    expect(tabsOf(PLACE_PILLS.together)).toEqual(["practice", "practice", "practice", "practice", "practice"]);
    expect(filtersOf(PLACE_PILLS.together)).toEqual([...TOGETHER_FILTERS]);
    expect(PLACE_PILLS.together.map((it) => it.labelKey)).toEqual(TOGETHER_FILTERS.map((f) => `nav.pill.together.${f}`));
  });

  it("the three places draw a row; no door does", () => {
    expect(PLACES).toEqual(["now", "child", "together"]);
  });

  it("each row leads with its place's home pill, with no pill twice", () => {
    for (const place of PLACES) {
      const row = PLACE_PILLS[place];
      expect(row[0].tab, place).toBe(COMPANION_PLACES.find((p) => p.id === place)!.tab);
      expect(row.length, place).toBeGreaterThan(1);
      expect(new Set(row.map(idOf)).size, place).toBe(row.length);
    }
  });

  it("every pill in a row belongs to that place (a route's home decides its row)", () => {
    for (const place of PLACES) for (const it of PLACE_PILLS[place]) expect(homeIdForTab(it.tab), it.tab).toBe(place);
  });

  it("no pill names a retired route (a retired hash lands on a pill, it is never one)", () => {
    for (const place of PLACES) for (const it of PLACE_PILLS[place]) expect(it.tab in RETIRED_ROUTES, it.tab).toBe(false);
  });
});

describe("2 · pillRowFor: the place's row, none for a door or an L2 leaf", () => {
  it("every route gets its place's row, or none (ruling [1])", () => {
    const wearing: string[] = [];
    for (const tab of ALL_TABS) {
      const home = homeIdForTab(tab);
      const row = rowFor(tab);
      if (NO_PILL_ROW_TABS.has(tab) || (home !== "now" && home !== "child" && home !== "together")) {
        expect(row, tab).toEqual([]);
        continue;
      }
      expect(row, tab).toBe(PLACE_PILLS[home]);
      wearing.push(tab);
    }
    // The retired ids wear the row of the route they land on (resolveHash
    // never hands Shell a retired id); the live ones are the six pill routes.
    expect(wearing.filter((tab) => !(tab in RETIRED_ROUTES))).toEqual(["overview", "weekly", "profile", "timeline", "development", "practice"]);
  });

  it("every live route that wears a row has its own pill lit; an L2 leaf wears none", () => {
    for (const tab of ALL_TABS) {
      if (tab in RETIRED_ROUTES) continue;
      const row = rowFor(tab);
      if (row.length > 1) expect(activePillIndex(row, tab, new URLSearchParams()), tab).toBeGreaterThanOrEqual(0);
    }
  });

  it("the L2 leaves draw no row (rulings [1] and [3]); #/timeline left the set as the Moments pill", () => {
    expect([...NO_PILL_ROW_TABS].sort()).toEqual(
      ["attribution", "copilot", "day-windows", "journal", "memory", "science", "screening", "smart-reminders"],
    );
    for (const tab of NO_PILL_ROW_TABS) expect(rowFor(tab), tab).toEqual([]);
    expect(NO_PILL_ROW_TABS.has("timeline")).toBe(false);
    expect(rowFor("timeline")).toBe(PLACE_PILLS.child);
  });

  it("the doors draw no row: Talk, For you, the parent, and Care, together", () => {
    for (const tab of ["coach", "masterclasses", "learn", "family", "consult", "safety", "handoff", "school-brief", "sharing", "appointments", "care-team", "reports"] as const) {
      expect(homeForTab(tab).kind, tab).toBe("door");
      expect(rowFor(tab), tab).toEqual([]);
    }
  });

  it("Together's Games pill shows only while a game world is open to the child", () => {
    expect(filtersOf(rowFor("practice", true))).toEqual(["all", "games", "stories", "routines", "offscreen"]);
    expect(filtersOf(rowFor("practice", false))).toEqual(["all", "stories", "routines", "offscreen"]);
    expect(filtersOf(pillRowFor(sectionForTab("practice"), "practice"))).not.toContain("games");
  });

  it("NEGATIVE CONTROL: the IA-02 rule gave the doors their hub rows and Together none", () => {
    const shipped = (tab: Tab) => {
      if (NO_PILL_ROW_TABS.has(tab)) return [];
      const home = homeIdForTab(tab);
      if (home === "now" || home === "child") return PLACE_PILLS[home];
      if (home === "together") return [];
      return hubTabsForSection(sectionForTab(tab));
    };
    expect(shipped("consult").length).toBeGreaterThan(1);
    expect(shipped("masterclasses").length).toBeGreaterThan(1);
    expect(shipped("consult")).not.toEqual(rowFor("consult"));
    expect(shipped("practice")).toEqual([]);
    expect(shipped("practice")).not.toEqual(rowFor("practice"));
  });
});

describe("3 · the lit pill: the route's own, under the hash's filter", () => {
  const q = (s = "") => new URLSearchParams(s);
  const together = PLACE_PILLS.together;
  const fourPills = together.filter((it) => it.query?.f !== "games");

  it("Together lights the pill whose filter the hash carries, else All together", () => {
    expect(activePillIndex(together, "practice", q())).toBe(0);
    expect(activePillIndex(together, "practice", q("f=games"))).toBe(1);
    expect(activePillIndex(together, "practice", q("f=stories&sheet=create-story"))).toBe(2);
    expect(activePillIndex(together, "practice", q("f=routines"))).toBe(3);
    expect(activePillIndex(together, "practice", q("f=offscreen"))).toBe(4);
    expect(activePillIndex(together, "practice", q("f=nonsense"))).toBe(0);
    // Games hidden for this child: a games link falls back to All together.
    expect(activePillIndex(fourPills, "practice", q("f=games"))).toBe(0);
  });

  it("a place pill without a filter lights on its route, whatever the query", () => {
    expect(activePillIndex(PLACE_PILLS.child, "development", q("area=talking&shelf=words"))).toBe(0);
    expect(activePillIndex(PLACE_PILLS.child, "timeline", q("view=areas&area=talking"))).toBe(1);
    expect(activePillIndex(PLACE_PILLS.child, "profile", q("aspect=lang"))).toBe(2);
    expect(activePillIndex(PLACE_PILLS.now, "weekly", q())).toBe(1);
  });

  it("NEGATIVE CONTROL: a route outside the row lights nothing; the old tab-only test lit all five", () => {
    expect(activePillIndex(PLACE_PILLS.now, "day-windows", q())).toBe(-1);
    expect(activePillIndex(PLACE_PILLS.child, "journal", q())).toBe(-1);
    const tabOnly = together.filter((it) => it.tab === "practice");
    expect(tabOnly).toHaveLength(5);
  });
});

describe("4 · below md nothing in a place row is hidden; the row scrolls", () => {
  const compact = (row: readonly NavItem[]) => row.filter((it) => !isCompactHiddenTool(sectionForTab(it.tab), it.tab));

  it("every place keeps its whole row (COMPACT_HIDDEN_TOOLS has nothing left to hide in PLACE_PILLS)", () => {
    for (const place of PLACES) expect(compact(PLACE_PILLS[place]), place).toEqual(PLACE_PILLS[place]);
  });

  it("NEGATIVE CONTROL: the tools it still lists are the two pills that left the Now row", () => {
    expect(isCompactHiddenTool(sectionForTab("day-windows"), "day-windows")).toBe(true);
    expect(isCompactHiddenTool(sectionForTab("smart-reminders"), "smart-reminders")).toBe(true);
  });
});

describe("5 · glyphs: shipped, one per destination, and `history` stays Talk's", () => {
  const subset = new Set(
    readFileSync(path.resolve(here, "../../public/fonts/material-symbols-rounded-subset.icons.txt"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );

  /** Glyphs that two different pills share, across the rows. */
  function sharedGlyphs(rows: ReadonlyArray<readonly NavItem[]>): string[] {
    const byGlyph = new Map<string, Set<string>>();
    for (const row of rows) for (const it of row) {
      if (!byGlyph.has(it.msIcon)) byGlyph.set(it.msIcon, new Set());
      byGlyph.get(it.msIcon)!.add(idOf(it));
    }
    return [...byGlyph].filter(([, ids]) => ids.size > 1).map(([glyph, ids]) => `${glyph}: ${[...ids].sort().join(", ")}`).sort();
  }

  it("every pill glyph is in the shipped font subset", () => {
    expect(subset.size).toBeGreaterThan(100);
    for (const place of PLACES) for (const it of PLACE_PILLS[place]) expect(subset.has(it.msIcon), `${idOf(it)} → ${it.msIcon}`).toBe(true);
  });

  it("no two pills share a glyph, Moments is photo_album, and no pill takes history", () => {
    expect(sharedGlyphs(PLACES.map((p) => PLACE_PILLS[p]))).toEqual([]);
    expect(PLACE_PILLS.child.find((it) => it.tab === "timeline")?.msIcon).toBe("photo_album");
    for (const place of PLACES) for (const it of PLACE_PILLS[place]) expect(it.msIcon, idOf(it)).not.toBe("history");
  });

  it("NEGATIVE CONTROL: a duplicated glyph is caught", () => {
    const dup = PLACE_PILLS.together.map((it) => (it.query?.f === "games" ? { ...it, msIcon: "park" } : it));
    expect(sharedGlyphs([PLACE_PILLS.now, dup])).toEqual(["park: practice?f=games, practice?f=offscreen"]);
    expect(subset.has("not_a_shipped_glyph")).toBe(false);
  });
});

describe("6 · every pill label exists in EN and HE", () => {
  const pills = PLACES.flatMap((place) => PLACE_PILLS[place]).filter((it) => it.tab !== "overview");
  const latin = (s: string) => /[A-Za-z]/.test(s.replace(/\{[a-z]+\}/g, ""));

  it("each label key resolves in both languages; Hebrew is Hebrew, with no Latin word", () => {
    for (const it of pills) {
      for (const lang of ["en", "he"] as const) expect(label(lang, it), `${lang}:${labelKeyOf(it)}`).not.toBe(labelKeyOf(it));
      expect(label("he", it), labelKeyOf(it)).toMatch(/[֐-׿]/);
      expect(latin(label("he", it)), labelKeyOf(it)).toBe(false);
    }
    for (const lang of ["en", "he"] as const) expect(translate(lang, "nav.pill.aboutChild")).not.toBe("nav.pill.aboutChild");
    expect(latin(translate("he", "nav.pill.aboutChild"))).toBe(false);
  });

  it("the rows read as the mock in English and Hebrew", () => {
    expect(PLACE_PILLS.now.slice(1).map((it) => label("en", it))).toEqual(["Weekly report"]);
    expect(PLACE_PILLS.now.slice(1).map((it) => label("he", it))).toEqual(["דוח שבועי"]);
    expect(PLACE_PILLS.child.map((it) => label("en", it))).toEqual(["Milestones", "Moments", "About {name}"]);
    expect(PLACE_PILLS.child.map((it) => label("he", it))).toEqual(["אבני דרך", "רגעים", "על {name}"]);
    expect(PLACE_PILLS.together.map((it) => label("en", it))).toEqual(["All together", "Games", "Stories", "Routines", "Away from the screen"]);
    expect(PLACE_PILLS.together.map((it) => label("he", it))).toEqual(["הכול", "משחקים", "סיפורים", "שגרות", "בלי מסך"]);
  });

  it("About names the child (an invented name here), isolated when its script is foreign", () => {
    expect(translate("en", "nav.pill.about", { name: "Mia" })).toBe("About Mia");
    expect(translate("he", "nav.pill.about", { name: "מיה" })).toBe("על מיה");
    expect(translate("he", "nav.pill.about", { name: "Mia" })).toBe("על ⁨Mia⁩");
    expect(translate("en", "nav.pill.aboutChild")).toBe("About your child");
  });

  it("the tablist is named for its home in both languages", () => {
    expect(translate("en", "nav.pills.aria", { place: "My child" })).toBe("My child: sections");
    expect(translate("he", "nav.pills.aria", { place: "הילד שלי" })).toBe("הילד שלי: אזורים");
    expect(latin(translate("he", "nav.pills.aria"))).toBe(false);
  });

  it("NEGATIVE CONTROL: the nav.tab names the pills replace were long, or repeated the place", () => {
    expect(translate("en", "nav.tab.timeline")).toBe("Story");
    expect(translate("en", "nav.tab.profile")).toBe("My Child");
    expect(translate("en", "nav.tab.development")).toBe("Growth");
    expect(translate("en", "nav.tab.practice")).toBe("Practice Studio");
    expect(translate("en", "nav.pill.no-such-pill")).toBe("nav.pill.no-such-pill");
  });
});

describe("7 · Shell renders the row from pillRowFor alone", () => {
  const shell = readFileSync(path.resolve(here, "../components/layout/Shell.tsx"), "utf8");

  it("the row is computed once, with Together's Games gate, and shows wherever it has more than one pill", () => {
    expect(shell).toContain("const pillRow = pillRowFor(section, activeTab, { gamesOpen });");
    expect(shell).toContain("const gamesOpen = kidModeOpenFor(childProfile) && studioWorldsForChild(");
    expect(shell).toContain("{pillRow.length > 1 && (");
    expect(shell).not.toContain("{pillRowFor(section, activeTab).length > 1 && (");
  });

  it("the lit pill reads the hash query, and a filter pill opens its route with that filter", () => {
    expect(shell).toContain("const activePill = pillRow.length > 1 ? activePillIndex(pillRow, activeTab, query) : -1;");
    expect(shell).toContain("const on = index === activePill;");
    expect(shell).toContain("if (it.query) goToRoute(it.tab, it.query); else setActiveTab(it.tab);");
    expect(shell).not.toContain("const on = it.tab === activeTab;");
  });

  it("the tablist name is keyed, never the English hub label", () => {
    expect(shell).toContain('aria-label={t("nav.pills.aria", { place: pillRowHomeName(activeTab, uiLang) })}');
    expect(shell).not.toContain("${section.label} sections");
  });

  it("each pill reads its own label key, keeps its glyph, never wraps and clears 44 px", () => {
    expect(shell).toContain('t(it.labelKey ?? "nav.tab." + it.tab)');
    expect(shell).toContain("<Icon name={it.msIcon} size={14} />");
    const pill = shell.slice(shell.indexOf('role="tab"'), shell.indexOf("</button>", shell.indexOf('role="tab"')));
    expect(pill).toContain("min-h-[44px]");
    expect(pill).toContain("whitespace-nowrap");
  });

  it("About <child> draws the first name inside <bdi>, and a nameless child reads 'About your child'", () => {
    expect(shell).toContain('<AboutChildLabel template={t("nav.pill.about")} name={childFirstName} />');
    expect(shell).toContain("<bdi>{name}</bdi>");
    expect(shell).toContain('t("nav.pill.aboutChild")');
  });
});
