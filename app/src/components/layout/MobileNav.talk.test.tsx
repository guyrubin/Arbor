/**
 * v10 (design system v10.1) — the phone dock is Now · My child · Together ·
 * Talk · Menu, and Menu is four rows: For you, the parent; Care, together;
 * Settings; Pause Arbor. (v3 F-SHELL-3's More sheet indexed fifteen entries:
 * the doors, Search and every place's pages; the pills are the shell's row now
 * and Search, Safety and Kid Mode stay in the top strip.)
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
import fs from "node:fs";
import path from "node:path";
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
  noWorlds: false,
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
// No world fits the child (state.noWorlds): Kid Mode stays open from three,
// but the band filter hands back an empty list (no world tagged for her band).
vi.mock("../../lib/age/playGate", async (original) => {
  const actual = await original<typeof import("../../lib/age/playGate")>();
  return { ...actual, offersForChild: (...args: Parameters<typeof actual.offersForChild>) => (state.noWorlds ? [] : actual.offersForChild(...args)) };
});
vi.mock("../../lib/native", () => ({ selectionHaptic: vi.fn() }));
vi.mock("./Sidebar", () => ({ badgeText: () => "" }));
vi.mock("./SafetyRing", () => ({ default: () => <span data-sheet-header="safety" /> }));
vi.mock("./KidModeButton", () => ({ default: () => <span data-sheet-header="kid-mode" /> }));
vi.mock("../search/SearchModal", () => ({ requestOpenSearch: vi.fn() }));
const settingsBus = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("./settingsBus", () => ({ requestOpenSettings: settingsBus.open }));
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
  state.lang = "en"; state.activeTab = "overview"; state.buttons = []; state.noWorlds = false;
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

describe("v10 — the dock: Now · My child · Together · Talk · Menu", () => {
  it.each(["en", "he"] as const)("five buttons in that order, equal flex slots, 64 px tall, labels at 12 px (%s)", (lang) => {
    const html = render("overview", lang);
    const buttons = dockButtons(html);
    expect(buttons.map(words)).toEqual([
      ...COMPANION_PLACES.map((place) => (lang === "he" ? place.he : place.en)),
      translate(lang, "companion.mobile-nav.talk"),
      translate(lang, "nav.short.menu"),
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

  // [route, the one lit slot]: 0 Now · 1 My child · 2 Together · 3 Talk · 4 Menu
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

describe("v10 — Menu: four rows (For you, Care, Settings, Pause Arbor)", () => {
  const sheetOf = (html: string) => html.slice(html.indexOf('data-testid="more-sheet"'));
  const rowsOfSheet = (html: string) => sheetOf(html).split("<button").slice(1).map((row) => "<button" + row.slice(0, row.indexOf("</button>")));

  it.each(["en", "he"] as const)("titled Menu, the two doors without a slot, then Settings and Pause Arbor (%s)", (lang) => {
    const html = render("overview", lang);
    const sheet = sheetOf(html);
    expect(sheet).toContain(translate(lang, "nav.popover.menu"));
    const rows = rowsOfSheet(html);
    const titles = rows.map((row) => /<b>([^<]*)<\/b>/.exec(row)?.[1]);
    const door = (id: string) => name(COMPANION_DOORS.find((d) => d.id === id)!, lang);
    expect(titles).toEqual([door("learn"), door("care"), translate(lang, "aria.settings"), translate(lang, "companion.pause.more")]);
    // Search, Safety and Kid Mode stay in the top strip: the sheet never repeats them.
    expect(sheet).not.toContain("data-sheet-header");
    expect(sheet).not.toContain('data-testid="more-search"');
    // Talk has its own slot in the bar, so it is not a row.
    expect(sheet).not.toContain('data-more-door="talk"');
  });

  it.each(["en", "he"] as const)("each row names what is inside it, in the parent's language (%s)", (lang) => {
    const rows = rowsOfSheet(render("overview", lang));
    const subs = rows.map((row) => /<span class="small">([^<]*)<\/span>/.exec(row)?.[1]);
    expect(subs).toEqual(["nav.menu.learn.sub", "nav.menu.care.sub", "nav.menu.settings.sub", "nav.menu.pause.sub"].map((k) => translate(lang, k)));
    for (const sub of subs) expect(sub).toBeTruthy();
    if (lang === "he") for (const sub of subs) expect(sub).not.toMatch(/[A-Za-z]/);
  });

  it("For you and Care open their homes; Settings and Pause ask the shell for the settings sheet", () => {
    render("overview");
    const learn = state.buttons.find((b) => b["data-more-door"] === "learn") as Props;
    const care = state.buttons.find((b) => b["data-more-door"] === "care") as Props;
    learn.onClick();
    care.onClick();
    expect(state.setActiveTab).toHaveBeenNthCalledWith(1, "masterclasses");
    expect(state.setActiveTab).toHaveBeenNthCalledWith(2, "consult");
    const settings = state.buttons.find((b) => b["data-testid"] === "menu-settings") as Props;
    const pause = state.buttons.find((b) => b["data-testid"] === "more-pause") as Props;
    settings.onClick();
    pause.onClick();
    expect(settingsBus.open).toHaveBeenNthCalledWith(1);
    expect(settingsBus.open).toHaveBeenNthCalledWith(2, { focus: "pause-arbor" });
    expect(conversation.request).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("a door row is current on its own door's routes only (%s)", (lang) => {
    for (const [tab, current] of [["masterclasses", "learn"], ["learn", "learn"], ["consult", "care"], ["safety", "care"], ["overview", null], ["development", null]] as const) {
      const rows = rowsOfSheet(render(tab, lang));
      const lit = rows.filter((row) => row.includes('aria-current="page"')).map((row) => /data-more-door="([^"]*)"/.exec(row)?.[1]);
      expect(lit, tab).toEqual(current ? [current] : []);
    }
  });

  it.each(["en", "he"] as const)("navigating rows end in a chevron that flips in Hebrew; Pause Arbor has none (%s)", (lang) => {
    const rows = rowsOfSheet(render("overview", lang));
    for (const row of rows.slice(0, 3)) {
      expect(row).toContain(">chevron_right</span>");
      expect(row).toContain("rtl:-scale-x-100");
      expect(row).not.toContain("chevron_left");
    }
    expect(rows[3]).not.toContain("chevron_right");
  });

  it("every dock button and menu row keeps the 44 px floor", () => {
    const html = render("overview");
    const classes = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    expect(classes.length).toBe(5 + 4);
    for (const cls of classes) expect(cls).toMatch(/min-h-\[64px\]|ds-menurow/);
    const css = fs.readFileSync(path.resolve(__dirname, "../../design/ds.css"), "utf8");
    expect(css).toMatch(/\.ds \.ds-menurow \{[^}]*min-height: 64px/);
  });

  it("the new keys exist in both languages; the Hebrew has no Latin words", () => {
    for (const key of ["nav.short.menu", "nav.popover.menu", "nav.menu.learn.sub", "nav.menu.care.sub", "nav.menu.settings.sub", "nav.menu.pause.sub"]) {
      expect(translate("en", key), key).not.toBe(key);
      expect(translate("he", key), key).not.toBe(key);
      expect(translate("he", key)).not.toMatch(/[A-Za-z]/);
    }
    expect(translate("en", "nav.short.menu")).toBe("Menu");
  });
});

describe("v3 IA-03 — a conversation the dock opened gives focus back to the dock (WCAG 2.4.3)", () => {
  it("the workspace keeps the chrome opener of a request and focuses it on an explicit close, else the launcher", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../companion/CompanionWorkspace.tsx"), "utf8");
    // Recorded when the one conversation door is used from outside the
    // workspace (the dock's Talk, the sidebar's Talk), never from inside it.
    const receive = src.slice(src.indexOf("const receive"), src.indexOf('show("seed")'));
    expect(receive).toContain("document.activeElement");
    expect(receive).toContain("!workspaceRef.current?.contains(from)");
    // Given back after the close commits, while it is still on screen.
    expect(src).toContain("(door?.isConnected && door.getClientRects().length ? door : launchRef.current)?.focus({ preventScroll: true })");
    // The launcher and a conversation route forget it; "What Arbor remembers"
    // keeps landing on the launcher.
    expect(src).toContain('if (!openRef.current && via !== "seed") opener.current = null;');
    const remembers = src.slice(src.indexOf('action === "remembers"'), src.indexOf('setActiveTab("memory")'));
    expect(remembers).toContain("opener.current = null;");
  });
});
