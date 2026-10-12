/**
 * v3 F-SHELL-2 (critic ruling 6) — the desktop header title is the route's
 * HOME, its place or its door, on every route, in one line. The old hub title
 * (nav.title.*) and its hub sentence (nav.sub.*) are gone from the header:
 * #/weekly read "Today · One small thing for {name} today", #/consult read
 * "Care Network" plus a sentence, #/masterclasses read "Learn".
 *
 * Talk is a panel over a page, never a place (critic ruling 10): #/coach and
 * #/scholar read Now, the home the Sidebar lights there (chromeLitHome), so the
 * chrome gives one answer to "where am I". Re-pinned in the F-SHELL-2 review
 * fix: EXPECTED.coach read the Talk door's name while the Sidebar lit Now.
 *
 * v3 IA-06r re-pin (review round 3, major): on a deep leaf, an L2 page of the
 * v3 route map (layout/Breadcrumb DEEP_LEAF_NAME_KEY: #/memory, #/safety,
 * #/day-windows …), the home's name alone did not say where the parent is, so
 * there the title zone holds the crumb home › page instead of the title span.
 * Only those 14 routes changed: EXPECTED.safety left the home-title table for
 * the leaf table, and the 43-route and one-line checks now hold the title span
 * to every other route and the crumb to the leaves.
 *
 * Rendered with renderToStaticMarkup (node-only vitest); the band's controls
 * are stubbed so only the title zone is under test.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ROUTE_IDS, type ActiveTab } from "../../lib/routes";
import { translate } from "../../lib/i18n";
import { homeForTab, chromeLitHome, COMPANION_DOORS } from "../../lib/companionPlaces";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", activeTab: "overview" as string }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ activeTab: state.activeTab, setActiveTab: () => {}, childProfile: { id: "c1", name: "Sam" } }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate: tr } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => tr(state.lang, key, vars) }) };
});
vi.mock("../search/TopbarSearch", () => ({ default: () => null }));
vi.mock("./KidModeButton", () => ({ default: () => null }));
vi.mock("./SafetyRing", () => ({ default: () => null }));
vi.mock("../ui/OfflineChip", () => ({ default: () => null }));
import Topbar from "./Topbar";
import { DEEP_LEAF_NAME_KEY } from "./Breadcrumb";

type Lang = "en" | "he";
type Crumb = { label: string; current: boolean; button: boolean };
function titleOf(tab: ActiveTab, lang: Lang): { html: string; title: string; crumb: Crumb[] } {
  state.activeTab = tab;
  state.lang = lang;
  const html = renderToStaticMarkup(React.createElement(Topbar));
  const m = /<span data-testid="topbar-home-title"[^>]*>([\s\S]*?)<\/span>/.exec(html);
  const nav = /<nav [^>]*data-testid="topbar-crumb"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
  const crumb = [...nav.matchAll(/<li data-crumb-level="\d+"[^>]*>([\s\S]*?)<\/li>/g)].map(([, body]) => ({
    label: [...body.matchAll(/dir="auto"[^>]*>([^<]*)</g)].map(x => x[1]).pop() ?? "",
    current: body.includes('aria-current="page"'),
    button: body.includes("<button"),
  }));
  return { html, title: m ? m[1] : "", crumb };
}
const homeName = (tab: ActiveTab, lang: Lang) => {
  const home = chromeLitHome(homeForTab(tab));
  const named = home.kind === "place" ? home.place : home.door;
  return lang === "he" ? named.he : named.en;
};
const isLeaf = (tab: ActiveTab) => DEEP_LEAF_NAME_KEY[tab] !== undefined;

const EXPECTED: Record<Lang, Partial<Record<ActiveTab, string>>> = {
  en: {
    overview: "Now", weekly: "Now",
    development: "My child", milestones: "My child",
    practice: "Together", stories: "Together",
    coach: "Now", scholar: "Now",
    masterclasses: "For you, the parent", learn: "For you, the parent",
    consult: "Care, together",
  },
  he: {
    overview: "עכשיו", weekly: "עכשיו",
    development: "הילד שלי", milestones: "הילד שלי",
    practice: "ביחד", stories: "ביחד",
    coach: "עכשיו", scholar: "עכשיו",
    masterclasses: "בשבילכם, ההורים", learn: "בשבילכם, ההורים",
    consult: "טיפול, ביחד",
  },
};
/** v3 IA-06r: deep leaves the brief names, as home › page. */
const LEAF_EXPECTED: Record<Lang, Partial<Record<ActiveTab, [string, string]>>> = {
  en: {
    memory: ["My child", "What Arbor remembers"],
    safety: ["Care, together", "Safety"],
    "day-windows": ["Now", "Day windows"],
    "smart-reminders": ["Now", "Reminders"],
    family: ["For you, the parent", "Family formation"],
  },
  he: {
    memory: ["הילד שלי", "מה ארבור זוכר"],
    safety: ["טיפול, ביחד", "בטיחות"],
    "day-windows": ["עכשיו", "חלונות היום"],
    "smart-reminders": ["עכשיו", "תזכורות"],
    family: ["בשבילכם, ההורים", "בניית משפחה"],
  },
};

describe("v3 F-SHELL-2 · the header names the route's home, nothing else", () => {
  it.each(["en", "he"] as const)("the routes the brief names read their home in %s", (lang) => {
    for (const [tab, name] of Object.entries(EXPECTED[lang]) as [ActiveTab, string][]) {
      expect(titleOf(tab, lang).title, tab).toBe(name);
    }
  });

  it.each(["en", "he"] as const)("all 43 routes in %s: the title is the lit home's name (chromeLitHome), in the UI language; a deep leaf's title zone is its crumb from that home", (lang) => {
    expect(ROUTE_IDS).toHaveLength(43);
    expect(ROUTE_IDS.filter(isLeaf)).toHaveLength(14);
    for (const tab of ROUTE_IDS) {
      const { title, crumb } = titleOf(tab, lang);
      if (isLeaf(tab)) {
        expect(title, tab).toBe("");
        expect(crumb.map(level => level.label), tab).toEqual([homeName(tab, lang), translate(lang, DEEP_LEAF_NAME_KEY[tab]!)]);
        expect(crumb.map(level => [level.button, level.current]), tab).toEqual([[true, false], [false, true]]);
        if (lang === "he") expect(crumb.map(level => level.label).join(" "), tab).not.toMatch(/[A-Za-z]/);
      } else {
        expect(title, tab).toBe(homeName(tab, lang));
        expect(crumb, tab).toEqual([]);
        if (lang === "he") expect(title, tab).not.toMatch(/[A-Za-z]/);
      }
    }
  });

  it.each(["en", "he"] as const)("v3 IA-06r: the deep leaves the brief names read home › page in %s", (lang) => {
    for (const [tab, levels] of Object.entries(LEAF_EXPECTED[lang]) as [ActiveTab, [string, string]][]) {
      expect(titleOf(tab, lang).crumb.map(level => level.label), tab).toEqual(levels);
    }
  });

  it("one line: no hub sentence under the title, on any route", () => {
    for (const lang of ["en", "he"] as const) {
      for (const tab of ROUTE_IDS) {
        const { html, crumb } = titleOf(tab, lang);
        if (isLeaf(tab)) {
          // The title zone holds the crumb alone: one nav, two levels, no title span.
          expect(html.match(/<nav\b/g) ?? [], `${lang} ${tab}`).toHaveLength(1);
          expect(crumb, `${lang} ${tab}`).toHaveLength(2);
          expect(html, `${lang} ${tab}`).not.toContain('data-testid="topbar-home-title"');
        } else {
          // The title zone holds exactly one text node: the title span.
          expect((html.match(/<span\b/g) ?? []).length, `${lang} ${tab}`).toBe(1);
        }
        expect(html, `${lang} ${tab}`).not.toContain(translate(lang, "nav.sub.today", { name: "Sam" }));
        expect(html, `${lang} ${tab}`).not.toMatch(/nav\.(?:sub|title)\./);
      }
    }
  });

  it("NEGATIVE CONTROL: the old hub titles differ from the home names, so the checks above can fail", () => {
    // #/consult read "Care Network", #/masterclasses "Learn", #/weekly "Today".
    expect(translate("en", "nav.title.care")).not.toBe(EXPECTED.en.consult);
    expect(translate("en", "nav.title.learn")).not.toBe(EXPECTED.en.masterclasses);
    expect(translate("en", "nav.title.today")).not.toBe(EXPECTED.en.weekly);
  });

  it("NEGATIVE CONTROL (IA-06r): the round-2 leaf title (the home alone) and the old long names fail the leaf checks", () => {
    // Round 2: #/memory printed only "My child", which the leaf check rejects.
    expect(["My child"]).not.toEqual(LEAF_EXPECTED.en.memory);
    expect(translate("en", "nav.tab.memory")).not.toBe(LEAF_EXPECTED.en.memory![1]);
    expect(translate("en", "nav.tab.safety")).not.toBe(LEAF_EXPECTED.en.safety![1]);
    // A non-leaf route still has its title span, so the leaf branch cannot pass by accident.
    expect(titleOf("milestones", "en").title).toBe("My child");
    expect(titleOf("memory", "en").title).toBe("");
  });

  it("NEGATIVE CONTROL: Talk's routes are homed on the Talk door, yet the header never names it", () => {
    const talk = COMPANION_DOORS.find(door => door.id === "talk")!;
    for (const tab of ["coach", "scholar"] as const) {
      const home = homeForTab(tab);
      expect(home.kind === "door" && home.door.id, tab).toBe("talk");
      expect(titleOf(tab, "en").title, tab).not.toBe(talk.en);
      expect(titleOf(tab, "he").title, tab).not.toBe(talk.he);
    }
    // chromeLitHome changes Talk only: every other door keeps its own name.
    expect(titleOf("consult", "en").title).toBe(COMPANION_DOORS.find(door => door.id === "care")!.en);
  });

  it("the band is 64 px and the title is display 20/600", () => {
    const { html } = titleOf("overview", "en");
    expect(html).toMatch(/<header[^>]*style="[^"]*height:64px/);
    expect(html).toMatch(/data-testid="topbar-home-title" class="[^"]*\btext-\[20px\] font-semibold\b/);
    expect(html).toContain("font-family:var(--font-display)");
  });
});
