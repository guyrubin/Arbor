import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * v3 IA-06 — the L2 sheet crumb and its history entry.
 *
 * Markup is rendered on the server; the hooks run their captured effects by
 * hand (mount, StrictMode replay, unmount) against a fake window whose history
 * behaves like a browser's: pushState truncates the forward stack, back() pops
 * one entry and fires popstate on a later task.
 */
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  activeTab: "overview" as string,
  setActiveTab: vi.fn(),
  effects: [] as Array<() => void | (() => void)>,
  buttons: [] as Record<string, any>[],
}));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); } };
});
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ activeTab: state.activeTab, setActiveTab: state.setActiveTab }) }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as Record<string, any>);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return {
    ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
import { Breadcrumb, CRUMB_MAX_LEVELS, SheetBreadcrumb, crumbLevelsFor, type CrumbLevel } from "./Breadcrumb";
import { currentSheetCrumb, useL2Sheet, useSheetHistory } from "./crumbBus";
import { translate } from "../../lib/i18n";

const QUESTION = "How could mornings feel easier?";
const FOUR: CrumbLevel[] = [
  { label: "Level one", tab: "overview" },
  { label: "My child", tab: "development" },
  { label: "Development map", tab: "development" },
  { label: "Mornings at home" },
];

type Level = { level: number; cls: string; label: string; current: boolean };
/** Each rendered level in order: its class, its visible label, whether it is the current page. */
function levelsOf(html: string): Level[] {
  return [...html.matchAll(/<li data-crumb-level="(\d+)" class="([^"]*)">([\s\S]*?)<\/li>/g)].map(([, level, cls, body]) => ({
    level: Number(level), cls,
    label: [...body.matchAll(/dir="auto"[^>]*>([^<]*)</g)].map(m => m[1]).pop() ?? "",
    current: body.includes('aria-current="page"'),
  }));
}
/** The cap the crumb promises, as a check the negative control can fail. */
function expectCapped(html: string) {
  expect(levelsOf(html).length).toBeLessThanOrEqual(CRUMB_MAX_LEVELS);
}

function fakeBrowser(href = "https://arbor.test/#/overview") {
  const target = new EventTarget();
  const stack: unknown[] = [null];
  let index = 0;
  const history = {
    get state() { return stack[index]; },
    get length() { return stack.length; },
    pushState: vi.fn((next: unknown, _title: string, _url?: string) => { stack.splice(index + 1); stack.push(next); index = stack.length - 1; }),
    back: vi.fn(() => {
      if (index === 0) return;
      index -= 1;
      setTimeout(() => target.dispatchEvent(new Event("popstate")), 0);
    }),
  };
  vi.stubGlobal("window", Object.assign(target, { history, location: { href } }));
  return { history, depth: () => index + 1, top: () => stack[index] as Record<string, unknown> | null };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settle = async () => { await Promise.resolve(); await tick(); await tick(); };

/** Render once, then drive the captured effects the way React would. */
function mount<T>(hook: () => T) {
  const out = {} as { value: T };
  state.effects = [];
  function Probe() { out.value = hook(); return null; }
  renderToStaticMarkup(<Probe />);
  const effects = state.effects.slice();
  let cleanups = effects.map(run => run());
  const release = () => { cleanups.forEach(cleanup => { if (typeof cleanup === "function") cleanup(); }); cleanups = []; };
  return {
    get value() { return out.value; },
    replay() { release(); cleanups = effects.map(run => run()); },
    unmount: release,
  };
}

beforeEach(() => { state.lang = "en"; state.activeTab = "overview"; state.setActiveTab = vi.fn(); state.buttons = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("IA-06 · Breadcrumb markup", () => {
  it("renders at most three levels from four inputs: the last three, in order", () => {
    const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} />);
    expectCapped(html);
    expect(levelsOf(html).map(l => l.label)).toEqual(["My child", "Development map", "Mornings at home"]);
    expect(html).not.toContain("Level one");
  });

  it("NEGATIVE CONTROL: a four-level crumb fails the cap check", () => {
    const four = FOUR.map((l, i) => `<li data-crumb-level="${i + 1}" class="flex"><span dir="auto">${l.label}</span></li>`).join("");
    expect(levelsOf(`<ol>${four}</ol>`)).toHaveLength(4);
    expect(() => expectCapped(`<ol>${four}</ol>`)).toThrow();
  });

  it("the last level is the current page, a span, and the only one", () => {
    const levels = levelsOf(renderToStaticMarkup(<Breadcrumb levels={FOUR} />));
    expect(levels.map(l => l.current)).toEqual([false, false, true]);
    const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<span aria-current="page"[^>]*>Mornings at home<\/span>/);
  });

  it("each separator is the chevron, mirrored once under RTL, and never shrinks", () => {
    const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} />);
    const chevrons = html.match(/<span class="msr[^"]*"[^>]*>chevron_right<\/span>/g) ?? [];
    expect(chevrons).toHaveLength(2);
    for (const chevron of chevrons) {
      expect(chevron).toContain("rtl:-scale-x-100");
      expect(chevron).toContain("shrink-0");
      expect(chevron.match(/-scale-x-100/g)).toHaveLength(1);
      expect(chevron).toContain('aria-hidden="true"');
    }
    expect(html).not.toMatch(/chevron_left|arrow_back|arrow_forward/);
  });

  it("the ancestors are 44 px buttons with logical alignment; nothing uses a physical side", () => {
    state.buttons = [];
    const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} />);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toContain('type="button"');
      expect(button).toMatch(/\bmin-h-11\b/);
      expect(button).toMatch(/\bmin-w-11\b/);
      expect(button).toMatch(/\bpx-1\b/);
      expect(button).toMatch(/\btext-start\b/);
    }
    expect(html).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-\d|text-left|text-right/);
  });

  it("compact (phone): the middle level truncates first; the first stays whole; the last ellipsizes only as a last resort", () => {
    const levels = levelsOf(renderToStaticMarkup(<Breadcrumb levels={FOUR} compact />));
    const has = (l: Level, cls: string) => l.cls.split(/\s+/).includes(cls);
    expect(levels.map(l => has(l, "truncate"))).toEqual([false, true, false]);
    expect(has(levels[0], "shrink-0")).toBe(true);
    expect(has(levels[1], "shrink-[999]")).toBe(true);
    // The middle level keeps a floor that holds its chevron and a 44 px target.
    expect(has(levels[1], "min-w-16")).toBe(true);
    expect(has(levels[2], "min-w-0")).toBe(true);
    // Desktop: no level is singled out.
    const wide = levelsOf(renderToStaticMarkup(<Breadcrumb levels={FOUR} />));
    expect(wide.some(l => has(l, "truncate") || has(l, "shrink-[999]"))).toBe(false);
  });

  it("names its landmark in both languages and keeps the testid apart from the back button", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} />);
      expect(html).toContain(`<nav aria-label="${translate(lang, "nav.crumb.aria")}" data-testid="topbar-crumb"`);
      expect(html).not.toContain("secondary-place-back");
    }
    expect(translate("en", "nav.crumb.aria")).toBe("Location");
    expect(translate("he", "nav.crumb.aria")).toBe("נתיב ניווט");
    expect(translate("he", "nav.crumb.aria")).not.toMatch(/[A-Za-z]/);
  });

  it("an ancestor reports its own tab; the current level is not a control", () => {
    const onSelect = vi.fn();
    state.buttons = [];
    renderToStaticMarkup(<Breadcrumb levels={FOUR} onSelect={onSelect} />);
    expect(state.buttons).toHaveLength(2);
    state.buttons[0].onClick();
    state.buttons[1].onClick();
    expect(onSelect.mock.calls).toEqual([["development"], ["development"]]);
  });
});

describe("IA-06 · crumb levels follow the route's home and its pill row", () => {
  const t = (lang: "en" | "he") => (key: string) => translate(lang, key);
  it.each([
    ["overview", ["Now", QUESTION]],
    ["development", ["My child", "Development map", QUESTION]],
    ["milestones", ["My child", "Milestones", QUESTION]],
    ["coach", ["Talk with Arbor", QUESTION]],
  ] as const)("EN %s", (tab, expected) => {
    expect(crumbLevelsFor(tab, QUESTION, "en", t("en")).map(l => l.label)).toEqual(expected);
  });

  it("HE: the same levels in Hebrew", () => {
    expect(crumbLevelsFor("development", QUESTION, "he", t("he")).map(l => l.label)).toEqual(["הילד שלי", "מפת התפתחות", QUESTION]);
    expect(crumbLevelsFor("overview", QUESTION, "he", t("he")).map(l => l.label)).toEqual(["עכשיו", QUESTION]);
  });

  it("ancestors carry their routes; the sheet level carries none", () => {
    expect(crumbLevelsFor("milestones", QUESTION, "en", t("en"))).toEqual([
      { label: "My child", tab: "development" }, { label: "Milestones", tab: "milestones" }, { label: QUESTION },
    ]);
  });
});

describe("IA-06 · useSheetHistory owns one history entry", () => {
  it("pushes once (a StrictMode replay included) at the same url, and its close calls history.back once", async () => {
    const browser = fakeBrowser();
    const onClose = vi.fn();
    const sheet = mount(() => useSheetHistory(true, onClose));
    sheet.replay();
    await Promise.resolve();
    expect(browser.history.pushState).toHaveBeenCalledTimes(1);
    expect(browser.history.pushState.mock.calls[0][2]).toBe("https://arbor.test/#/overview");
    expect(browser.depth()).toBe(2);
    expect(typeof browser.top()?.arborSheet).toBe("string");

    sheet.value();
    sheet.unmount();
    await settle();
    expect(onClose).toHaveBeenCalledOnce();
    expect(browser.history.back).toHaveBeenCalledOnce();
    expect(browser.depth()).toBe(1);
    expect(browser.history.pushState).toHaveBeenCalledTimes(1);
  });

  it("browser Back closes the sheet once and retires nothing more", async () => {
    const browser = fakeBrowser();
    const onClose = vi.fn();
    const sheet = mount(() => useSheetHistory(true, onClose));
    browser.history.back();
    await tick();
    expect(onClose).toHaveBeenCalledOnce();
    sheet.unmount();
    await settle();
    expect(browser.history.back).toHaveBeenCalledOnce();
    expect(browser.depth()).toBe(1);
  });

  it("a row that leaves for a route navigates only after the sheet's entry is gone", async () => {
    const browser = fakeBrowser();
    const onClose = vi.fn();
    const sheet = mount(() => useSheetHistory(true, onClose));
    const seen: number[] = [];
    sheet.value(() => seen.push(browser.depth()));
    expect(onClose).toHaveBeenCalledOnce();
    expect(seen).toEqual([]);
    await settle();
    expect(seen).toEqual([1]);
    sheet.unmount();
    await settle();
    expect(browser.history.back).toHaveBeenCalledOnce();
  });

  it("a sheet that unmounts without closing still retires its entry", async () => {
    const browser = fakeBrowser();
    const sheet = mount(() => useSheetHistory(true, vi.fn()));
    sheet.unmount();
    await settle();
    expect(browser.history.back).toHaveBeenCalledOnce();
    expect(browser.depth()).toBe(1);
  });

  it("a second sheet opened while the first one's Back is in flight pushes after it lands", async () => {
    const browser = fakeBrowser();
    const first = mount(() => useSheetHistory(true, vi.fn()));
    first.value();
    const second = mount(() => useSheetHistory(true, vi.fn()));
    expect(browser.history.pushState).toHaveBeenCalledTimes(1);
    first.unmount();
    await settle();
    expect(browser.history.pushState).toHaveBeenCalledTimes(2);
    expect(browser.depth()).toBe(2);
    second.value();
    second.unmount();
    await settle();
    expect(browser.depth()).toBe(1);
    expect(browser.history.back).toHaveBeenCalledTimes(2);
  });

  it("closed: no entry, no listener work", async () => {
    const browser = fakeBrowser();
    const sheet = mount(() => useSheetHistory(false, vi.fn()));
    sheet.unmount();
    await settle();
    expect(browser.history.pushState).not.toHaveBeenCalled();
    expect(browser.history.back).not.toHaveBeenCalled();
  });
});

describe("IA-06 · the open sheet's crumb", () => {
  it("no sheet open: no crumb", () => {
    expect(currentSheetCrumb()).toBeNull();
    expect(renderToStaticMarkup(<SheetBreadcrumb />)).toBe("");
  });

  it("#/development with a selection open: My child › Development map › its title; gone once it closes", async () => {
    fakeBrowser("https://arbor.test/#/development");
    state.activeTab = "development";
    const sheet = mount(() => useL2Sheet(true, "Mornings at home", vi.fn()));
    const html = renderToStaticMarkup(<SheetBreadcrumb compact />);
    expect(levelsOf(html).map(l => l.label)).toEqual(["My child", "Development map", "Mornings at home"]);
    sheet.unmount();
    expect(renderToStaticMarkup(<SheetBreadcrumb compact />)).toBe("");
    await settle();
  });

  it("#/overview with the question sheet open: Now › the question (the Now pill is not repeated)", async () => {
    fakeBrowser();
    const sheet = mount(() => useL2Sheet(true, QUESTION, vi.fn()));
    sheet.replay();
    expect(levelsOf(renderToStaticMarkup(<SheetBreadcrumb />)).map(l => l.label)).toEqual(["Now", QUESTION]);
    sheet.unmount();
    await settle();
  });

  it("Hebrew: the levels in Hebrew under the Hebrew landmark name", async () => {
    fakeBrowser("https://arbor.test/#/development");
    state.lang = "he"; state.activeTab = "development";
    const sheet = mount(() => useL2Sheet(true, "בוקר בבית", vi.fn()));
    const html = renderToStaticMarkup(<SheetBreadcrumb compact />);
    expect(html).toContain('aria-label="נתיב ניווט"');
    expect(levelsOf(html).map(l => l.label)).toEqual(["הילד שלי", "מפת התפתחות", "בוקר בבית"]);
    sheet.unmount();
    await settle();
  });

  it("an ancestor closes the sheet first and goes to its route once the entry is gone", async () => {
    const browser = fakeBrowser("https://arbor.test/#/milestones");
    state.activeTab = "milestones";
    const onClose = vi.fn();
    const sheet = mount(() => useL2Sheet(true, "Mornings at home", onClose));
    state.buttons = [];
    renderToStaticMarkup(<SheetBreadcrumb />);
    expect(state.buttons).toHaveLength(2);
    state.buttons[1].onClick();
    expect(onClose).toHaveBeenCalledOnce();
    expect(state.setActiveTab).not.toHaveBeenCalled();
    await settle();
    expect(state.setActiveTab).toHaveBeenCalledWith("milestones");
    expect(browser.depth()).toBe(1);
    sheet.unmount();
    await settle();
    expect(browser.history.back).toHaveBeenCalledOnce();
  });

  it("the most recently opened sheet is the one named; closing it names the one below", async () => {
    fakeBrowser();
    const below = mount(() => useL2Sheet(true, "Below", vi.fn()));
    const above = mount(() => useL2Sheet(true, "Above", vi.fn()));
    expect(currentSheetCrumb()?.label).toBe("Above");
    above.unmount();
    expect(currentSheetCrumb()?.label).toBe("Below");
    below.unmount();
    expect(currentSheetCrumb()).toBeNull();
    await settle();
  });
});

describe("IA-06 · wiring (source pins)", () => {
  const read = (rel: string) => readFileSync(path.join(__dirname, "..", "..", rel), "utf8");
  it("the top bar swaps the hub sentence for the crumb; the phone strip sits under the header", () => {
    const topbar = read("components/layout/Topbar.tsx");
    expect(topbar).toContain("{sheet && <SheetBreadcrumb");
    expect(topbar).toContain("{!sheet && !isCompanionHome(activeTab) && (");
    const shell = read("components/layout/Shell.tsx");
    expect(shell).toContain('<SheetBreadcrumb compact className="lg:hidden');
    expect(shell.indexOf("<SheetBreadcrumb")).toBeGreaterThan(shell.indexOf("<ChildContextHeader"));
    expect(shell.indexOf("<SheetBreadcrumb")).toBeLessThan(shell.indexOf('data-testid="secondary-place-back"'));
    // FEAT-05's event keeps its single listener.
    expect(shell.match(/addEventListener\(FAMILY_TOPIC_SHEET_EVENT/g)).toHaveLength(1);
  });

  it("the question sheet and the portrait selection close only through the seam", () => {
    const sheet = read("components/companion/FamilyTopicSheet.tsx");
    expect(sheet).toContain("useL2Sheet(true,");
    expect(sheet).not.toMatch(/onClose\(\);\s*setActiveTab\(/);
    expect(sheet).toContain('close(() => setActiveTab("development"))');
    const portrait = read("components/companion/ChildPortrait.tsx");
    expect(portrait).toContain("useL2Sheet(!!selected,");
    expect(portrait).not.toContain("setSelection(null);");
  });

  it("the Learn reader keeps its own history marker, untouched", () => {
    const learn = read("components/sections/LearnLibrary.tsx");
    expect(learn).toContain('window.history.pushState({ ...(window.history.state ?? {}), arborLearnCard: id }, "", window.location.href);');
    expect(learn).not.toContain("useL2Sheet");
  });
});
