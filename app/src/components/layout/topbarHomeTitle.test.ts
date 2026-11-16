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
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ activeTab: state.activeTab, childProfile: { id: "c1", name: "Sam" } }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate: tr } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => tr(state.lang, key, vars) }) };
});
vi.mock("../search/TopbarSearch", () => ({ default: () => null }));
vi.mock("./KidModeButton", () => ({ default: () => null }));
vi.mock("./SafetyRing", () => ({ default: () => null }));
vi.mock("../ui/OfflineChip", () => ({ default: () => null }));
import Topbar from "./Topbar";

type Lang = "en" | "he";
function titleOf(tab: ActiveTab, lang: Lang): { html: string; title: string } {
  state.activeTab = tab;
  state.lang = lang;
  const html = renderToStaticMarkup(React.createElement(Topbar));
  const m = /<span data-testid="topbar-home-title"[^>]*>([\s\S]*?)<\/span>/.exec(html);
  return { html, title: m ? m[1] : "" };
}

const EXPECTED: Record<Lang, Partial<Record<ActiveTab, string>>> = {
  en: {
    overview: "Now", weekly: "Now",
    development: "My child", milestones: "My child",
    practice: "Together", stories: "Together",
    coach: "Now", scholar: "Now",
    masterclasses: "For you, the parent", learn: "For you, the parent",
    consult: "Care, together", safety: "Care, together",
  },
  he: {
    overview: "עכשיו", weekly: "עכשיו",
    development: "הילד שלי", milestones: "הילד שלי",
    practice: "ביחד", stories: "ביחד",
    coach: "עכשיו", scholar: "עכשיו",
    masterclasses: "בשבילכם, ההורים", learn: "בשבילכם, ההורים",
    consult: "טיפול, ביחד", safety: "טיפול, ביחד",
  },
};

describe("v3 F-SHELL-2 · the header names the route's home, nothing else", () => {
  it.each(["en", "he"] as const)("the routes the brief names read their home in %s", (lang) => {
    for (const [tab, name] of Object.entries(EXPECTED[lang]) as [ActiveTab, string][]) {
      expect(titleOf(tab, lang).title, tab).toBe(name);
    }
  });

  it.each(["en", "he"] as const)("all 44 routes in %s: the title is the lit home's name (chromeLitHome), in the UI language", (lang) => {
    expect(ROUTE_IDS).toHaveLength(44);
    for (const tab of ROUTE_IDS) {
      const home = chromeLitHome(homeForTab(tab));
      const named = home.kind === "place" ? home.place : home.door;
      const { title } = titleOf(tab, lang);
      expect(title, tab).toBe(lang === "he" ? named.he : named.en);
      if (lang === "he") expect(title, tab).not.toMatch(/[A-Za-z]/);
    }
  });

  // v10 re-pin: the title is followed, on one line, by the breadcrumb (a
  // labelled <nav>: place › pill › view); there is still no hub sentence.
  it("one line: the title, then at most the breadcrumb, and no hub sentence, on any route", () => {
    for (const lang of ["en", "he"] as const) {
      for (const tab of ROUTE_IDS) {
        const { html } = titleOf(tab, lang);
        const crumbAt = html.indexOf('data-testid="topbar-crumb"');
        const outside = crumbAt < 0 ? html : html.slice(0, html.lastIndexOf("<nav", crumbAt)) + html.slice(html.indexOf("</nav>", crumbAt));
        // Outside the crumb the title zone holds exactly one text node: the title span.
        expect((outside.match(/<span\b/g) ?? []).length, `${lang} ${tab}`).toBe(1);
        if (crumbAt >= 0) expect(html.slice(html.lastIndexOf("<nav", crumbAt), crumbAt)).toContain(`aria-label="${translate(lang, "nav.crumb.aria")}"`);
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

describe("v10 · the breadcrumb continues the title: place › pill › view", () => {
  const crumbText = (html: string) => {
    const at = html.indexOf('data-testid="topbar-crumb"');
    if (at < 0) return [];
    const nav = html.slice(at, html.indexOf("</nav>", at));
    const decode = (t: string) => t.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    return [...nav.matchAll(/<(?:span|button)[^>]*class="[^"]*truncate[^"]*"[^>]*>([^<]*)</g)].map((m) => decode(m[1]));
  };
  it.each(["en", "he"] as const)("a home's first pill shows the place alone; later pills and folded views add levels (%s)", (lang) => {
    expect(crumbText(titleOf("overview", lang).html)).toEqual([]);
    expect(crumbText(titleOf("development", lang).html)).toEqual([]);
    expect(crumbText(titleOf("weekly", lang).html)).toEqual([translate(lang, "nav.pill.weekly")]);
    expect(crumbText(titleOf("day-windows", lang).html)).toEqual([translate(lang, "nav.pill.weekly"), translate(lang, "nav.view.day-windows")]);
    expect(crumbText(titleOf("behaviors", lang).html)).toEqual([translate(lang, "nav.pill.portrait"), translate(lang, "nav.view.behaviors")]);
    expect(crumbText(titleOf("profile", lang).html)).toEqual([translate(lang, "nav.pill.profile.named", { name: "Sam" })]);
    expect(crumbText(titleOf("safety", lang).html)).toEqual([translate(lang, "nav.view.safety")]);
    // Talk is a panel over Now: no crumb.
    expect(crumbText(titleOf("coach", lang).html)).toEqual([]);
  });

  it("the pill level is a button back to the pill only when a view follows it; the last level is the current page", () => {
    const { html } = titleOf("day-windows", "en");
    const nav = html.slice(html.indexOf('data-testid="topbar-crumb"'), html.indexOf("</nav>", html.indexOf('data-testid="topbar-crumb"')));
    expect(nav).toContain("<button");
    expect((nav.match(/aria-current="page"/g) ?? []).length).toBe(1);
    const weekly = titleOf("weekly", "en").html;
    const weeklyNav = weekly.slice(weekly.indexOf('data-testid="topbar-crumb"'));
    expect(weeklyNav.slice(0, weeklyNav.indexOf("</nav>"))).not.toContain("<button");
  });
});
