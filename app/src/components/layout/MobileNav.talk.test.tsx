/**
 * v3 F-SHELL-3 (IA-03) — the phone dock is Now · My child · Together · Talk ·
 * More, and the More sheet reads: the three doors, Search, then the three
 * places under their v3 pill names.
 *
 * Talk is the Talk with Arbor door (COMPANION_DOORS). It opens the
 * conversation through the one conversation door (lib/companionConversation,
 * shared contract 2) and never changes the route, so the place underneath
 * keeps its page and its scroll position. It is a dialog opener
 * (aria-haspopup), never a current page, and it never carries a number
 * (B-SHELL-26), however many notes wait for review.
 *
 * The dock lights the route's ONE home through the resolver the desktop
 * Sidebar reads (chromeLitHome(homeForTab)): a place lights its place; on
 * #/coach the page under the conversation panel is Now, so Now is lit and
 * Talk never is (critic ruling 10); the two doors that live in the sheet
 * (For you, the parent; Care, together) light More.
 *
 * The sheet's old records and support groups, their pulse sub-lines and the
 * old hub names (Journal, Behaviors, Stories, Learn, Care, Profile) are gone
 * (critic ruling 14). The index rows reuse the label key of the pill they
 * stand for; the Together rows open #/practice?f=<filter> (shared contract 1).
 *
 * Rendered with renderToStaticMarkup (the vitest environment is node-only);
 * the 390 px rendered sweep measures widths, the safe area, the Hebrew mirror
 * and the scroll position around an open conversation.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { COMPANION_DOORS, COMPANION_PLACES } from "../../lib/companionPlaces";
import type { ActiveTab } from "../../lib/routes";

type Lang = "en" | "he";
type Props = Record<string, any>;
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he", activeTab: "overview" as string, setActiveTab: vi.fn(),
  child: { id: "child-a", name: "Noa Lee", age: 5 } as Record<string, unknown>,
  buttons: [] as Record<string, any>[],
}));
const conversation = vi.hoisted(() => ({ request: vi.fn() }));
// Seven notes wait for review: the dock must still show no number anywhere.
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  activeTab: state.activeTab, setActiveTab: state.setActiveTab, milestones: [], actionPlans: [], pendingReviewCount: 7,
  childProfile: state.child,
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../lib/companionConversation", () => ({ requestCompanionConversation: conversation.request }));
vi.mock("../../lib/native", () => ({ selectionHaptic: vi.fn() }));
vi.mock("./Sidebar", () => ({ badgeText: () => "" }));
vi.mock("./SafetyRing", () => ({ default: () => <span data-sheet-header="safety" /> }));
vi.mock("./KidModeButton", () => ({ default: () => <span data-sheet-header="kid-mode" /> }));
vi.mock("../search/SearchModal", () => ({ requestOpenSearch: vi.fn() }));
vi.mock("../ui/Sheet", () => ({
  Sheet: ({ title, headerActions, children }: { title?: string; headerActions?: React.ReactNode; children: React.ReactNode }) =>
    <div data-testid="more-sheet"><header>{title}{headerActions}</header>{children}</div>,
}));
// Capture each <button>'s props as React builds it, so a handler can be called
// (a static render drops handlers). Same seam as parentRecordHierarchy.
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as Record<string, any>);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import MobileNav from "./MobileNav";

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en"; state.activeTab = "overview"; state.buttons = [];
  state.child = { id: "child-a", name: "Noa Lee", age: 5 };
});
afterEach(() => { vi.unstubAllGlobals(); });

function render(tab: ActiveTab, lang: Lang = "en"): string {
  state.activeTab = tab;
  state.lang = lang;
  state.buttons = [];
  return renderToStaticMarkup(<MobileNav />);
}
const dockOf = (html: string) => html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
const dockButtons = (html: string) => dockOf(html).split("<button").slice(1).map((b) => "<button" + b.slice(0, b.indexOf("</button>")));
/** A button's visible words: glyph ligatures (the .msr spans) and tags removed. */
const words = (markup: string) => markup.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "").trim();
const FILLED = /FILL(?:'|&#x27;) 1/;
const name = (door: { en: string; he: string }, lang: Lang) => (lang === "he" ? door.he : door.en);
const groupOf = (html: string, id: string) => new RegExp(`<div[^>]*data-testid="more-place-${id}-group"[^>]*>[\\s\\S]*?</div></div>`).exec(html)?.[0] ?? "";
const rowsOf = (group: string) => group.split("<button").slice(1).map((row) => "<button" + row.slice(0, row.indexOf("</button>")));

describe("v3 IA-03 — the dock: Now · My child · Together · Talk · More", () => {
  it.each(["en", "he"] as const)("five buttons in that order, equal flex slots, 64 px tall, labels at 12 px (%s)", (lang) => {
    const html = render("overview", lang);
    const buttons = dockButtons(html);
    expect(buttons.map(words)).toEqual([
      ...COMPANION_PLACES.map((place) => (lang === "he" ? place.he : place.en)),
      translate(lang, "companion.mobile-nav.talk"),
      translate(lang, "nav.short.more"),
    ]);
    for (const button of buttons) {
      const cls = /class="([^"]*)"/.exec(button)![1].split(" ");
      expect(cls).toEqual(expect.arrayContaining(["min-h-[64px]", "min-w-0", "flex-1", "text-[12px]"]));
    }
    // The bar keeps the safe area, and HE mirrors the order through dir="rtl"
    // alone: DOM order is the reading order, nothing in the bar is physical.
    const dock = dockOf(html);
    expect(dock.slice(0, dock.indexOf(">"))).toContain("padding-bottom:env(safe-area-inset-bottom, 0px)");
    expect(dock).not.toMatch(/\b(?:left|right)\b|(?:^|[\s"])(?:ml|mr|pl|pr)-/);
  });

  it("Talk opens the conversation through its one door and leaves the route alone", () => {
    render("overview");
    const talk = state.buttons.find((button) => button["data-testid"] === "dock-talk") as Props;
    expect(talk).toBeTruthy();
    talk.onClick();
    expect(conversation.request).toHaveBeenCalledTimes(1);
    expect(conversation.request).toHaveBeenCalledWith({ source: "mobile-dock" });
    // No route change: the place and its scroll position stay underneath.
    expect(state.setActiveTab).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("Talk is a dialog opener, never a current page, and never shows a number (%s)", (lang) => {
    const talkDoor = COMPANION_DOORS.find((door) => door.id === "talk")!;
    // Its accessible name is the door's name, which contains the visible label.
    expect(name(talkDoor, lang)).toContain(translate(lang, "companion.mobile-nav.talk"));
    for (const tab of ["overview", "coach", "consult", "journal"] as const) {
      const talk = dockButtons(render(tab, lang))[3];
      expect(talk).toContain('data-testid="dock-talk"');
      expect(talk).toContain('aria-haspopup="dialog"');
      expect(talk).not.toContain("aria-current");
      expect(talk).toContain(`aria-label="${name(talkDoor, lang)}"`);
      expect(words(talk)).not.toMatch(/\d/);
      expect(talk).toContain(">forum</span>");
    }
  });

  // [route, the one lit slot]: 0 Now · 1 My child · 2 Together · 3 Talk · 4 More
  const LIT: [ActiveTab, number][] = [
    ["overview", 0], ["weekly", 0], ["coach", 0], ["scholar", 0],
    ["development", 1], ["journal", 1], ["profile", 1], ["memory", 1],
    ["practice", 2], ["stories", 2], ["daily-play", 2],
    ["masterclasses", 4], ["learn", 4], ["consult", 4], ["safety", 4],
  ];
  it.each(LIT)("on %s exactly slot %i is lit and filled (chromeLitHome(homeForTab))", (tab, slot) => {
    const buttons = dockButtons(render(tab));
    buttons.forEach((button, i) => {
      expect(button.includes("color:var(--arbor-clay-deep)"), `slot ${i} colour`).toBe(i === slot);
      expect(FILLED.test(button), `slot ${i} FILL`).toBe(i === slot);
    });
    // aria-current names the page: one slot, and it is never Talk.
    expect(buttons.map((button) => button.includes('aria-current="page"'))).toEqual(buttons.map((_, i) => i === slot));
  });
});

describe("v3 IA-03 — the More sheet: doors, Search, then the three places", () => {
  it.each(["en", "he"] as const)("reads header, doors, Search, then the place groups, with no support group (%s)", (lang) => {
    const html = render("overview", lang);
    const sheet = html.slice(html.indexOf('data-testid="more-sheet"'));
    const at = (needle: string) => {
      const i = sheet.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const order = [
      at('data-sheet-header="safety"'), at('data-sheet-header="kid-mode"'), at(`aria-label="${translate(lang, "aria.settings")}"`),
      at('data-testid="more-doors-group"'), at(`<span>${translate(lang, "top.search")}</span>`),
      at('data-testid="more-records-group"'),
      ...COMPANION_PLACES.map((place) => at(`data-testid="more-place-${place.id}-group"`)),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(sheet).not.toContain("more-support-group");
  });

  it.each(["en", "he"] as const)("three door rows in COMPANION_DOORS order, named in the parent's language (%s)", (lang) => {
    const html = render("overview", lang);
    const group = /<section[^>]*data-testid="more-doors-group"[^>]*>[\s\S]*?<\/section>/.exec(html)![0];
    expect(group).toContain(`>${translate(lang, "companion.more.doors")}</h3>`);
    const rows = group.split("<button").slice(1);
    expect(rows).toHaveLength(COMPANION_DOORS.length);
    rows.forEach((row, i) => {
      const door = COMPANION_DOORS[i];
      expect(row).toContain(`data-more-door="${door.id}"`);
      expect(row).toContain(name(door, lang));
      expect(row).toContain(`>${door.icon}</span>`);
      expect(words(row.slice(0, row.indexOf("</button>")))).not.toMatch(/\d/);
    });
    if (lang === "he") for (const door of COMPANION_DOORS) expect(door.he).not.toMatch(/[A-Za-z]/);
  });

  it("the Talk door opens the conversation; For you and Care open their homes; none joins the destination set", () => {
    render("overview");
    const rows = state.buttons.filter((button) => button["data-more-door"]) as Props[];
    expect(rows.map((row) => row["data-more-door"])).toEqual(COMPANION_DOORS.map((door) => door.id));
    for (const row of rows) expect(row["data-more-destination"]).toBeUndefined();
    rows.forEach((row, i) => {
      const door = COMPANION_DOORS[i];
      state.setActiveTab.mockClear();
      row.onClick();
      if (door.id === "talk") {
        expect(row["aria-haspopup"]).toBe("dialog");
        expect(state.setActiveTab).not.toHaveBeenCalled();
      } else {
        expect(row["aria-haspopup"]).toBeUndefined();
        expect(state.setActiveTab).toHaveBeenCalledWith(door.tab);
      }
    });
    expect(conversation.request.mock.calls).toEqual([[{ source: "more" }]]);
  });

  it.each(["en", "he"] as const)("a door row is current on its own door's routes only (%s)", (lang) => {
    for (const [tab, current] of [["masterclasses", "learn"], ["consult", "care"], ["coach", null], ["overview", null]] as const) {
      render(tab, lang);
      const rows = state.buttons.filter((button) => button["data-more-door"]);
      expect(rows.filter((row) => row["aria-current"] === "page").map((row) => row["data-more-door"]), tab).toEqual(current ? [current] : []);
    }
  });

  it.each(["en", "he"] as const)("each place lists its v3 pill names, in place order, and nothing else (%s)", (lang) => {
    const html = render("overview", lang);
    const expected: Record<string, string[]> = {
      now: [translate(lang, "nav.pill.weekly")],
      child: [translate(lang, "companion.more.milestones"), translate(lang, "companion.more.moments"), translate(lang, "companion.more.about", { name: "Noa" })],
      together: ["companion.together-view.games", "companion.together-view.stories", "companion.together-view.routines", "companion.together-view.away-from-the-screen"].map((key) => translate(lang, key)),
    };
    for (const place of COMPANION_PLACES) {
      const group = groupOf(html, place.id);
      expect(group, place.id).toContain(`>${lang === "he" ? place.he : place.en}</h4>`);
      expect(rowsOf(group).map(words), place.id).toEqual(expected[place.id]);
    }
    // Every label resolves (no key shape) and the Hebrew carries no Latin
    // except the child's name.
    for (const label of Object.values(expected).flat()) {
      expect(label).not.toMatch(/^[a-z]+(?:\.[\w-]+)+$/);
      if (lang === "he") expect(label.replace("Noa", "")).not.toMatch(/[A-Za-z]/);
    }
  });

  it.each(["en", "he"] as const)("no old hub name is an entry, and no row carries a sub-line or a number (%s)", (lang) => {
    const html = render("overview", lang);
    const records = /<section[^>]*data-testid="more-records-group"[^>]*>[\s\S]*?<\/section>/.exec(html)![0];
    const labels = rowsOf(records).map(words);
    expect(labels).toHaveLength(8);
    // "Stories" survives only as Together's pill (it opens #/practice?f=stories);
    // the old Stories hub, like the others, is never a row's destination.
    for (const hub of ["journal", "behaviors", "learn", "care", "profile"]) {
      expect(labels, hub).not.toContain(translate(lang, "nav.cat." + hub));
    }
    const destinations = [...records.matchAll(/data-more-destination="([^"]*)"/g)].map((m) => m[1]);
    for (const old of ["journal", "behaviors", "stories", "learn", "care", "memory", "masterclasses", "consult"]) {
      expect(destinations, old).not.toContain(old);
    }
    for (const row of rowsOf(records)) {
      expect(row.match(/<span/g)?.length, "glyph, label, chevron").toBe(3);
      expect(words(row)).not.toMatch(/\d/);
    }
  });

  it("the destination set is the v3 index, and every row lands where its pill does", () => {
    const hashes: string[] = [];
    render("overview");
    const rows = state.buttons.filter((button) => button["data-more-destination"]) as Props[];
    expect(rows.map((row) => row["data-more-destination"])).toEqual([
      "weekly", "development", "timeline", "profile",
      "practice?f=games", "practice?f=stories", "practice?f=routines", "practice?f=offscreen",
    ]);
    const win = { location: { hash: "" } };
    vi.stubGlobal("window", win);
    for (const row of rows) {
      state.setActiveTab.mockClear();
      win.location.hash = "";
      row.onClick();
      const [route, query] = String(row["data-more-destination"]).split("?");
      if (query) {
        // Together's filter rides the hash query (shared contract 1).
        expect(state.setActiveTab).not.toHaveBeenCalled();
        hashes.push(win.location.hash);
        expect(win.location.hash).toBe(`/${route}?${query}`);
      } else {
        expect(state.setActiveTab).toHaveBeenCalledWith(route);
        expect(win.location.hash).toBe("");
      }
    }
    expect(hashes).toHaveLength(4);
  });

  it("Games follows the Together pill: no Games row before three, and About falls back when there is no name", () => {
    state.child = { id: "child-b", name: "", age: 2 };
    const html = render("overview");
    const together = rowsOf(groupOf(html, "together")).map(words);
    expect(together).not.toContain(translate("en", "companion.together-view.games"));
    expect(together).toHaveLength(3);
    expect(rowsOf(groupOf(html, "child")).map(words)).toContain(translate("en", "companion.more.about-child"));
  });

  it.each(["en", "he"] as const)("a row is current only on its own route, and a Together row only with its filter (%s)", (lang) => {
    render("profile", lang);
    expect(state.buttons.filter((b) => b["aria-current"] === "page" && b["data-more-destination"]).map((b) => b["data-more-destination"])).toEqual(["profile"]);
    vi.stubGlobal("window", { location: { hash: "#/practice?f=stories" }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render("practice", lang);
    expect(state.buttons.filter((b) => b["aria-current"] === "page" && b["data-more-destination"]).map((b) => b["data-more-destination"])).toEqual(["practice?f=stories"]);
  });

  it.each(["en", "he"] as const)("every chevron points inline-end: one rtl flip each, never a left glyph (%s)", (lang) => {
    const html = render("overview", lang);
    const chevrons = [...html.matchAll(/<span class="([^"]*)"[^>]*>chevron_right<\/span>/g)].map((m) => m[1]);
    const rows = state.buttons.filter((button) => button["data-more-door"] || button["data-more-destination"]);
    expect(rows).toHaveLength(COMPANION_DOORS.length + 8);
    expect(chevrons).toHaveLength(rows.length);
    for (const cls of chevrons) {
      expect(cls.split(" ").filter((c) => c === "rtl:-scale-x-100")).toHaveLength(1);
      expect(cls).not.toContain("rotate");
    }
    expect(html).not.toContain("chevron_left");
  });

  it("every dock button and sheet row keeps the 44 px floor", () => {
    const html = render("overview");
    const classes = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThanOrEqual(5 + 1 + COMPANION_DOORS.length + 1 + 8);
    for (const cls of classes) expect(cls).toMatch(/min-h-\[64px\]|min-h-11|min-h-\[44px\]|w-11 h-11/);
  });

  it("the new keys exist in both languages; the Hebrew has no Latin words but the name slot", () => {
    for (const key of ["companion.more.doors", "companion.more.milestones", "companion.more.moments", "companion.more.about", "companion.more.about-child"] as const) {
      expect(companionEn[key], key).toBeTruthy();
      expect(companionHe[key], key).toBeTruthy();
      expect(companionHe[key].replace("{name}", "")).not.toMatch(/[A-Za-z]/);
    }
    expect(companionEn["companion.more.doors"]).toBe("Talk, learn, get support");
  });
});
