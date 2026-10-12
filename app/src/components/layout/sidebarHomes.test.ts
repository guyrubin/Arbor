/**
 * v3 IA-01 — the desktop Sidebar is three places (Now · My child · Together)
 * and, under a hairline, three doors (Talk with Arbor · For you, the parent ·
 * Care, together). Exactly ONE of the six is current on every route: the
 * route's home in table A (lib/companionPlaces homeForTab).
 *
 * Before IA-01 the places resolved through placeForTab while the doors matched
 * the tab exactly, so #/consult lit My child AND Care, #/masterclasses lit Now
 * AND For you, and #/school-brief or #/learn lit a place instead of their
 * door. The negative control below replays that logic.
 *
 * Back follows the same homes: a leaf returns to its place or its door, and a
 * home's own route (a place, or coach / masterclasses / consult) has no Back.
 *
 * Rendered with renderToStaticMarkup (the vitest environment is node-only);
 * the 1280 px rendered sweep repeats the one-current check in a browser.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_IDS, type ActiveTab } from "../../lib/routes";
import { COMPANION_DOORS, COMPANION_PLACES, backTargetFor, homeForTab, placeForTab } from "../../lib/companionPlaces";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", activeTab: "overview" as string, setActiveTab: vi.fn() }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ activeTab: state.activeTab, setActiveTab: state.setActiveTab }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, signOut: vi.fn(), firebaseEnabled: false }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../profile/ProfileSwitcher", () => ({ default: () => null }));
// Capture each <button>'s props as React builds it, so a row's onClick can be
// called (a static render drops handlers). Same seam as parentRecordHierarchy.
const captured = vi.hoisted(() => ({ buttons: [] as Record<string, unknown>[] }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") captured.buttons.push(props as Record<string, unknown>);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import Sidebar from "./Sidebar";

beforeEach(() => { vi.clearAllMocks(); state.lang = "en"; state.activeTab = "overview"; captured.buttons = []; });

type Lang = "en" | "he";
type Row = { home: string; current: boolean; open: string; style: string; body: string; text: string };
const HOMES = [...COMPANION_PLACES, ...COMPANION_DOORS];
const homeIdOf = (tab: ActiveTab) => { const h = homeForTab(tab); return h.kind === "place" ? h.place.id : h.door.id; };

function render(tab: ActiveTab, lang: Lang = "en"): string {
  state.activeTab = tab;
  state.lang = lang;
  return renderToStaticMarkup(React.createElement(Sidebar));
}
/** Every sidebar place/door row (the account button carries no data-home). */
function rows(html: string): Row[] {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .map((m) => ({
      home: /\bdata-home="([^"]+)"/.exec(m[1])?.[1] ?? "",
      current: /\baria-current="page"/.test(m[1]),
      open: m[1],
      style: /\bstyle="([^"]*)"/.exec(m[1])?.[1] ?? "",
      body: m[2],
      text: m[2].replace(/<[^>]+>/g, ""),
    }))
    .filter((r) => r.home);
}
const fillOf = (body: string) => /FILL(?:&#x27;|')\s*([01])/.exec(body)?.[1];

describe("v3 IA-01 · three places and three doors, nothing else", () => {
  it.each(["en", "he"] as const)("lists Now, My child, Together, then Talk, For you, Care in %s, each with its own name", (lang) => {
    const list = rows(render("overview", lang));
    expect(list.map((r) => r.home)).toEqual(["now", "child", "together", "talk", "learn", "care"]);
    for (const [i, home] of HOMES.entries()) {
      const name = lang === "he" ? home.he : home.en;
      expect(list[i].text, home.id).toContain(name);
      // The glyph is the first thing in the row: inline-start in both directions.
      expect(list[i].body.startsWith('<span class="msr"'), home.id).toBe(true);
      expect(list[i].body.indexOf(`>${home.icon}</span>`), home.id).toBeGreaterThan(-1);
      if (lang === "he") expect(name, home.id).not.toMatch(/[A-Za-z]/);
    }
    expect(list.slice(3).map((r) => r.text)).toEqual(COMPANION_DOORS.map((d) => d.icon + (lang === "he" ? d.he : d.en)));
  });

  it("every row keeps the 44 px floor", () => {
    for (const row of rows(render("overview"))) expect(row.open, row.home).toMatch(/class="[^"]*\bmin-h-11\b/);
  });

  it("each row opens its own route: a place its landing tab, a door its route", () => {
    render("weekly");
    const byHome = new Map(captured.buttons.filter((b) => b["data-home"]).map((b) => [b["data-home"] as string, b] as const));
    expect([...byHome.keys()]).toEqual(HOMES.map((h) => h.id));
    for (const home of HOMES) {
      (byHome.get(home.id)!.onClick as () => void)();
      expect(state.setActiveTab).toHaveBeenLastCalledWith(home.tab);
    }
    expect(HOMES.map((h) => h.tab)).toEqual(["overview", "development", "practice", "coach", "masterclasses", "consult"]);
  });
});

describe("v3 IA-01 · exactly one current entry on every route, from table A", () => {
  it.each(["en", "he"] as const)("all 43 routes in %s: one aria-current, and it is the route's home", (lang) => {
    expect(ROUTE_IDS).toHaveLength(43);
    for (const tab of ROUTE_IDS) {
      const html = render(tab, lang);
      expect((html.match(/aria-current="page"/g) ?? []).length, tab).toBe(1);
      const current = rows(html).filter((r) => r.current);
      expect(current.map((r) => r.home), tab).toEqual([homeIdOf(tab)]);
    }
  });

  it("the routes the audit named light the right row and only that row", () => {
    const expected: Partial<Record<ActiveTab, string>> = {
      consult: "care", "school-brief": "care", appointments: "care", sharing: "care", safety: "care", reports: "care", handoff: "care", "care-team": "care",
      masterclasses: "learn", learn: "learn", family: "learn",
      coach: "talk", scholar: "talk",
      behaviors: "child", milestones: "child", development: "child",
      // FEAT-07 is included: Together's Routines entry now owns Plans.
      plans: "together",
      stories: "together", practice: "together",
      weekly: "now", overview: "now",
    };
    for (const [tab, home] of Object.entries(expected) as [ActiveTab, string][]) {
      expect(rows(render(tab)).filter((r) => r.current).map((r) => r.home), tab).toEqual([home]);
    }
  });

  it("the current row is the only one with the clay-dim wash and a filled glyph", () => {
    for (const tab of ["consult", "masterclasses", "coach", "milestones", "stories", "weekly"] as const) {
      for (const row of rows(render(tab))) {
        if (row.current) {
          expect(row.style, `${tab} ${row.home}`).toContain("background:var(--arbor-clay-dim)");
          expect(fillOf(row.body), `${tab} ${row.home}`).toBe("1");
        } else {
          expect(row.style, `${tab} ${row.home}`).toContain("background:transparent");
          expect(fillOf(row.body), `${tab} ${row.home}`).toBe("0");
        }
      }
    }
  });

  it("the Talk door shows no count, even while it is current (B-SHELL-26)", () => {
    for (const tab of ["coach", "overview"] as const) {
      const talk = rows(render(tab)).find((r) => r.home === "talk")!;
      expect(talk.text).toBe("forum" + COMPANION_DOORS[0].en);
      expect(talk.text).not.toMatch(/\d/);
    }
  });

  it("NEGATIVE CONTROL: the shipped logic (places by placeForTab, doors by exact tab) lit two rows or the wrong one", () => {
    const shipped = (tab: ActiveTab) => [
      ...COMPANION_PLACES.filter((p) => p.id === placeForTab(tab).id && tab !== "coach").map((p) => p.id),
      ...COMPANION_DOORS.filter((d) => d.tab === tab).map((d) => d.id),
    ];
    expect(shipped("consult")).toEqual(["child", "care"]);
    expect(shipped("masterclasses")).toEqual(["now", "learn"]);
    expect(shipped("school-brief")).toEqual(["child"]);
    expect(shipped("learn")).toEqual(["now"]);
    // The rendered Sidebar does not: one row, the door.
    for (const tab of ["consult", "masterclasses", "school-brief", "learn"] as const) {
      const current = rows(render(tab)).filter((r) => r.current).map((r) => r.home);
      expect(current, tab).toEqual([homeIdOf(tab)]);
      expect(current, tab).not.toEqual(shipped(tab));
    }
  });
});

describe("v3 IA-01 · Back returns to the home", () => {
  it("a home's own route has no Back: the three places and the three door routes", () => {
    for (const home of HOMES) expect(backTargetFor(home.tab), home.tab).toBeNull();
    expect(["coach", "masterclasses", "consult"].every((tab) => backTargetFor(tab as ActiveTab) === null)).toBe(true);
  });

  it("every other route returns to its own home, a place or a door", () => {
    for (const tab of ROUTE_IDS) {
      if (HOMES.some((h) => h.tab === tab)) continue;
      const target = backTargetFor(tab);
      expect(target, tab).not.toBeNull();
      expect(target!.id, tab).toBe(homeIdOf(tab));
    }
    expect(backTargetFor("learn")?.tab).toBe("masterclasses");
    expect(backTargetFor("family")?.tab).toBe("masterclasses");
    expect(backTargetFor("school-brief")?.tab).toBe("consult");
    expect(backTargetFor("appointments")?.tab).toBe("consult");
    expect(backTargetFor("milestones")?.tab).toBe("development");
    expect(backTargetFor("stories")?.tab).toBe("practice");
    expect(backTargetFor("weekly")?.tab).toBe("overview");
  });

  it("NEGATIVE CONTROL: Back by placeForTab sent a door's leaves past their door, and gave the door itself a Back", () => {
    expect(placeForTab("learn").tab).toBe("overview");
    expect(placeForTab("school-brief").tab).toBe("development");
    expect(placeForTab("coach").tab).not.toBe("coach");
    expect(backTargetFor("learn")?.tab).not.toBe(placeForTab("learn").tab);
  });

  it("Shell renders Back only when there is a target, labelled with that home's name", () => {
    const shell = readFileSync(new URL("./Shell.tsx", import.meta.url), "utf8");
    expect(shell).toContain("const back = isCompanionHome(activeTab) ? null : backTargetFor(activeTab);");
    expect(shell).toMatch(/\{back && <button data-testid="secondary-place-back" onClick=\{\(\) => setActiveTab\(back\.tab\)\}/);
    expect(shell).toContain('{uiLang === "he" ? back.he : back.en}');
    expect(shell).not.toContain("setActiveTab(placeForTab(activeTab).tab)");
  });
});

describe("v3 IA-01 · the Sidebar source", () => {
  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const code = strip(readFileSync(new URL("./Sidebar.tsx", import.meta.url), "utf8"));
  const doorsAt = code.indexOf("COMPANION_DOORS.map(");
  const doors = code.slice(doorsAt, code.indexOf("})}", doorsAt));

  it("reads the one home resolver and renders the doors from COMPANION_DOORS, after the places", () => {
    expect(code).toContain("const home = homeForTab(activeTab);");
    expect(doorsAt).toBeGreaterThan(code.indexOf("})}", code.indexOf("COMPANION_PLACES.map(")));
    expect(code).not.toContain("placeForTab");
    expect(code).not.toContain('activeTab !== "coach"');
  });

  it("holds no door label, no Hebrew and no badge of its own", () => {
    for (const door of COMPANION_DOORS) expect(code).not.toContain(door.en);
    expect(code).not.toContain("Talk with Arbor");
    expect(code).not.toMatch(/\p{Script=Hebrew}/u);
    expect(doors).toContain("{he ? door.he : door.en}");
    expect(doors).not.toMatch(/badge/i);
  });
});
