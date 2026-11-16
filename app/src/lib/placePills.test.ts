/**
 * v10 (design system v10.1, Guy 16 Nov 2026) re-pin — one pill row per home.
 *
 * Three places and three doors, at most two levels deep (home, then pill). A
 * view inside a pill (a chip, a filter) changes the screen in place and is not
 * a pill. Every folded route stays a deep link and lights the pill it belongs
 * to (PILL_LIT / litPillFor).
 *   - Now:      Now · Weekly report · Plans (Plans moved from Together, where
 *               it had no link) · Family plan (joins with its route)
 *   - My child: Milestones · Moments · About <name>
 *   - Together: Routines · Play · Stories (the old in-page filter row)
 *   - Talk:     none (a panel over any page)
 *   - For you, the parent: For you · Library
 *   - Care, together: Visits · People · Records (Safety keeps this row)
 *
 * History: v4 gave only Now (Now · Weekly report) and My child a row; Together
 * used an in-page filter row and the two doors were one screen each. v3 IA-02
 * before it used the legacy hub rows. The negative controls below keep both
 * shipped rules visible.
 *
 * Node-only vitest: rows and labels are data, and the Shell's use of them is
 * asserted on its source. Each rule has a negative control.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_TABS } from "../context/ArborContext";
import { COMPANION_DOORS, COMPANION_PLACES, homeForTab } from "./companionPlaces";
import { translate } from "./i18n";
import { RETIRED_ROUTES } from "./routes";
import {
  HOME_PILLS,
  NO_PILL_ROW_TABS,
  PILL_LIT,
  homeIdForTab,
  hubTabsForSection,
  isPillReading,
  litPillFor,
  pillLitTab,
  pillRowFor,
  sectionForTab,
  shellCrumbFor,
  type NavItem,
  type PillHome,
} from "./navigation";

const here = path.dirname(fileURLToPath(import.meta.url));
const tabsOf = (row: readonly NavItem[]) => row.map((it) => it.tab);
const HOMES = Object.keys(HOME_PILLS) as PillHome[];
const ROWED = HOMES.filter((h) => HOME_PILLS[h].length > 0);
const rowFor = (tab: (typeof ALL_TABS)[number]) => pillRowFor(sectionForTab(tab), tab);
/** The key a pill's label renders from (Shell: `it.labelKey ?? "nav.tab." + it.tab`). */
const labelKeyOf = (it: NavItem) => it.labelKey ?? "nav.tab." + it.tab;
const label = (lang: "en" | "he", it: NavItem) => translate(lang, labelKeyOf(it));
const homeTab = (home: PillHome) =>
  (COMPANION_PLACES.find((p) => p.id === home) ?? COMPANION_DOORS.find((d) => d.id === home))!.tab;

describe("1 · each home's row, in the target's order", () => {
  it("Now: Now · Weekly report · Plans", () => {
    expect(tabsOf(HOME_PILLS.now)).toEqual(["overview", "weekly", "plans"]);
  });

  it("My child: Milestones · Moments · About", () => {
    expect(tabsOf(HOME_PILLS.child)).toEqual(["development", "timeline", "profile"]);
  });

  it("Together: Routines · Play · Stories (its in-page filter row became the shell's)", () => {
    expect(tabsOf(HOME_PILLS.together)).toEqual(["practice", "daily-play", "stories"]);
  });

  it("the doors: For you · Library and Visits · People · Records; Talk has none", () => {
    expect(tabsOf(HOME_PILLS.learn)).toEqual(["masterclasses", "learn"]);
    expect(tabsOf(HOME_PILLS.care)).toEqual(["consult", "sharing", "reports"]);
    expect(HOME_PILLS.talk).toEqual([]);
  });

  it("fourteen pills today (Family plan makes fifteen with its route), at most four a row, none twice", () => {
    const all = HOMES.flatMap((h) => tabsOf(HOME_PILLS[h]));
    expect(all.length).toBe(14);
    expect(new Set(all).size).toBe(all.length);
    for (const home of HOMES) expect(HOME_PILLS[home].length, home).toBeLessThanOrEqual(4);
  });

  it("each row leads with its home's own route", () => {
    for (const home of ROWED) expect(HOME_PILLS[home][0].tab, home).toBe(homeTab(home));
  });

  it("every pill in a row belongs to that home (a route's home decides its row)", () => {
    for (const home of HOMES) for (const it of HOME_PILLS[home]) expect(homeIdForTab(it.tab), it.tab).toBe(home);
  });
});

describe("2 · pillRowFor: the home's row on the home and on every route it holds", () => {
  it("every route wears its home's row, except attribution (admin)", () => {
    for (const tab of ALL_TABS) {
      if (tab === "attribution") continue;
      expect(rowFor(tab), tab).toBe(HOME_PILLS[homeIdForTab(tab)]);
    }
    expect(NO_PILL_ROW_TABS.has("attribution")).toBe(true);
    expect(rowFor("attribution")).toEqual([]);
  });

  it("Plans and the retired routines id live under Now; How Arbor works under About; Family formation in Stories", () => {
    expect(homeIdForTab("plans")).toBe("now");
    expect(homeIdForTab("routines")).toBe("now");
    expect(homeIdForTab("science")).toBe("child");
    expect(homeIdForTab("family")).toBe("together");
    expect(homeIdForTab("safety")).toBe("care");
  });

  it("every folded route lights the pill it folds into, in its own row", () => {
    const expected: Record<string, string> = {
      "day-windows": "weekly", "smart-reminders": "overview", routines: "plans",
      milestones: "development", screening: "development", copilot: "development",
      journal: "timeline", behaviors: "timeline", language: "timeline",
      memory: "profile", strengths: "profile", science: "profile",
      journey: "practice", speech: "daily-play", mimic: "daily-play", feelings: "daily-play", adventures: "daily-play",
      "bedtime-stories": "stories", comics: "stories", family: "stories",
      handoff: "consult", "school-brief": "consult", "find-pro": "consult", appointments: "consult",
      "care-team": "sharing",
    };
    expect(PILL_LIT).toEqual(expected);
    for (const [leaf, lit] of Object.entries(PILL_LIT)) {
      expect(ALL_TABS, leaf).toContain(leaf);
      expect(tabsOf(rowFor(leaf as (typeof ALL_TABS)[number])), leaf).toContain(lit);
      expect(litPillFor(leaf as (typeof ALL_TABS)[number]), leaf).toBe(lit);
    }
  });

  it("a pill lights itself; Safety and Talk light none", () => {
    for (const home of ROWED) for (const it of HOME_PILLS[home]) expect(pillLitTab(it.tab), it.tab).toBe(it.tab);
    expect(litPillFor("safety")).toBeNull();
    expect(litPillFor("coach")).toBeNull();
  });

  it("isPillReading: a pill is a reading of its home; a folded route is not", () => {
    for (const tab of ["weekly", "plans", "timeline", "profile", "daily-play", "learn", "reports"] as const) expect(isPillReading(tab), tab).toBe(true);
    for (const tab of ["milestones", "language", "day-windows", "handoff", "comics", "safety"] as const) expect(isPillReading(tab), tab).toBe(false);
  });

  it("NEGATIVE CONTROL: the v4 rule gave Together and the doors no row, and the v3 rule used hub rows", () => {
    const v4Rowless = new Set(["together", "learn", "care"]);
    const v4 = (tab: (typeof ALL_TABS)[number]) => (v4Rowless.has(homeIdForTab(tab)) ? [] : rowFor(tab));
    expect(v4("practice")).toEqual([]);
    expect(rowFor("practice")).not.toEqual([]);
    const v3 = (tab: (typeof ALL_TABS)[number]) => hubTabsForSection(sectionForTab(tab));
    expect(tabsOf(v3("milestones"))).toEqual(["development", "milestones", "language", "daily-play", "screening"]);
    expect(tabsOf(v3("milestones"))).not.toEqual(tabsOf(rowFor("milestones")));
  });
});

describe("3 · the breadcrumb: place › pill › view", () => {
  it("a home's first pill is the place alone; a later pill adds itself", () => {
    expect(shellCrumbFor("overview")).toEqual({ pill: null, view: null });
    expect(shellCrumbFor("weekly")).toEqual({ pill: "weekly", view: null });
    expect(shellCrumbFor("development")).toEqual({ pill: null, view: null });
    expect(shellCrumbFor("timeline")).toEqual({ pill: "timeline", view: null });
  });

  it("a folded route adds its own view after the pill it lights", () => {
    expect(shellCrumbFor("day-windows")).toEqual({ pill: "weekly", view: "day-windows" });
    expect(shellCrumbFor("behaviors")).toEqual({ pill: "timeline", view: "behaviors" });
    expect(shellCrumbFor("school-brief")).toEqual({ pill: null, view: "school-brief" });
    expect(shellCrumbFor("smart-reminders")).toEqual({ pill: null, view: "smart-reminders" });
    expect(shellCrumbFor("safety")).toEqual({ pill: null, view: "safety" });
  });

  it("Talk has no crumb: it is a panel", () => {
    expect(shellCrumbFor("coach")).toEqual({ pill: null, view: null });
  });

  it("every view a crumb can show has its one name in both languages (a retired id never opens)", () => {
    for (const tab of ALL_TABS) {
      if (tab in RETIRED_ROUTES) continue;
      const { view } = shellCrumbFor(tab);
      if (!view) continue;
      for (const lang of ["en", "he"] as const) {
        const key = "nav.view." + view;
        const named = translate(lang, key, { name: "Mia" });
        const fallback = translate(lang, "nav.tab." + view);
        expect(named !== key || fallback !== "nav.tab." + view, `${lang}:${view}`).toBe(true);
      }
    }
  });
});

describe("4 · glyphs: shipped, one per destination, and `history` stays Talk's", () => {
  const subset = new Set(
    readFileSync(path.resolve(here, "../../public/fonts/material-symbols-rounded-subset.icons.txt"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );

  /** Glyphs that two different pills share, across rows. */
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
    for (const home of HOMES) for (const it of HOME_PILLS[home]) expect(subset.has(it.msIcon), `${it.tab} → ${it.msIcon}`).toBe(true);
  });

  it("no two pills share a glyph, Moments is photo_library, and no pill takes history", () => {
    expect(sharedGlyphs(HOMES.map((h) => HOME_PILLS[h]))).toEqual([]);
    expect(HOME_PILLS.child.find((it) => it.tab === "timeline")?.msIcon).toBe("photo_library");
    for (const home of HOMES) for (const it of HOME_PILLS[home]) expect(it.msIcon, it.tab).not.toBe("history");
  });

  it("NEGATIVE CONTROL: a duplicated glyph is caught", () => {
    const dup = HOME_PILLS.child.map((it) => (it.tab === "profile" ? { ...it, msIcon: "map" } : it));
    expect(sharedGlyphs([HOME_PILLS.now, dup])).toEqual(["map: development, profile"]);
    expect(subset.has("not_a_shipped_glyph")).toBe(false);
  });
});

describe("5 · every pill label exists in EN and HE", () => {
  const pills = HOMES.flatMap((home) => HOME_PILLS[home]).filter((it) => it.tab !== "overview");
  const latin = (s: string) => /[A-Za-z]/.test(s.replace(/\{[a-z]+\}/g, ""));

  it("each label key resolves in both languages; Hebrew is Hebrew, with no Latin word", () => {
    for (const it of pills) {
      for (const lang of ["en", "he"] as const) expect(label(lang, it), `${lang}:${labelKeyOf(it)}`).not.toBe(labelKeyOf(it));
      expect(label("he", it), labelKeyOf(it)).toMatch(/[֐-׿]/);
      expect(latin(label("he", it)), labelKeyOf(it)).toBe(false);
    }
  });

  it("the rows read as the target table in English and Hebrew; About names the child", () => {
    expect(HOME_PILLS.now.slice(1).map((it) => label("en", it))).toEqual(["Weekly report", "Plans"]);
    expect(HOME_PILLS.child.map((it) => label("en", it))).toEqual(["Milestones", "Moments", "About"]);
    expect(HOME_PILLS.together.map((it) => label("en", it))).toEqual(["Routines", "Play", "Stories"]);
    expect(HOME_PILLS.learn.map((it) => label("en", it))).toEqual(["For you", "Library"]);
    expect(HOME_PILLS.care.map((it) => label("en", it))).toEqual(["Visits", "People", "Records"]);
    expect(HOME_PILLS.child.map((it) => label("he", it))).toEqual(["אבני דרך", "רגעים", "אודות"]);
    expect(HOME_PILLS.together.map((it) => label("he", it))).toEqual(["שגרות", "משחק", "סיפורים"]);
    expect(translate("en", "nav.pill.profile.named", { name: "Mia" })).toBe("About Mia");
    expect(translate("he", "nav.pill.profile.named", { name: "מיה" })).toBe("על מיה");
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

  it("the row shows wherever pillRowFor has more than one pill", () => {
    expect(shell).toContain("const pillRow = pillRowFor(section, activeTab);");
    expect(shell).toContain("{pillRow.length > 1 && (");
  });

  it("the tablist name is keyed, never the English hub label", () => {
    expect(shell).toContain('aria-label={t("nav.pills.aria", { place: pillRowHomeName(activeTab, uiLang) })}');
    expect(shell).not.toContain("${section.label} sections");
  });

  it("each pill reads its own label key, draws no glyph, lights through litPillFor and uses the design-system pill", () => {
    expect(shell).toContain('t(it.labelKey ?? "nav.tab." + it.tab)');
    expect(shell).toContain("it.tab === litPillFor(activeTab)");
    const pill = shell.slice(shell.indexOf('role="tab"'), shell.indexOf("</button>", shell.indexOf('role="tab"')));
    expect(pill).not.toContain("<Icon");
    expect(pill).toContain('className={on ? "pill on" : "pill"}');
  });

  it("the design system holds the pill's 44 px floor and the phone row never wraps", () => {
    const css = readFileSync(path.resolve(here, "../design/ds.css"), "utf8");
    expect(css).toMatch(/\.ds \.pill \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.ds\.ds-shellrow\[data-composition="phone"\] \.ds-pillrow \{[^}]*flex-wrap: nowrap/);
    expect(css).toMatch(/\.ds \.ds-pillrow \.pill \{[^}]*white-space: nowrap/);
  });
});
