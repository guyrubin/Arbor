import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * v3 IA-06 — the L2 sheet crumb and the history entry its sheet owns.
 *
 * Markup is rendered on the server, inside the REAL Sheet and Modal (portal,
 * motion and the dialog registration stubbed), so "the crumb is in the dialog"
 * is a rendered fact, not a source pin. The hooks run their captured effects
 * by hand (mount, StrictMode replay, unmount) against a fake window whose
 * history behaves like a browser's: pushState truncates the forward stack,
 * back()/forward() traverse on a later task (or when the test delivers them),
 * and a hash navigation fires popstate at once, as a fragment navigation does.
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
vi.mock("react-dom", async (original) => ({ ...(await original<typeof import("react-dom")>()), createPortal: (children: React.ReactNode) => children }));
vi.mock("motion/react", async () => {
  const { createElement } = await vi.importActual<typeof import("react")>("react");
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy({}, { get: (_, tag: string) => ({ children, initial, animate, exit, transition, ...props }: any) => createElement(tag, props, children) }),
  };
});
vi.mock("../../hooks/useDialog", () => ({ useDialog: ({ onClose }: { onClose: () => void }) => ({ ref: { current: null }, requestClose: onClose, onBackdropClick: onClose }) }));
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
import { useSheetHistory } from "../../hooks/useSheetHistory";
import { Sheet } from "../ui/Sheet";
import { Modal } from "../ui/Modal";
import { translate } from "../../lib/i18n";

const QUESTION = "How could mornings feel easier?";
const FOUR: CrumbLevel[] = [
  { label: "Level one", tab: "overview" },
  { label: "My child", tab: "development" },
  { label: "Milestones", tab: "development" },
  { label: "Mornings at home" },
];
const ORIGIN = "https://arbor.test/";
const OV = `${ORIGIN}#/overview`;
const DEV = `${ORIGIN}#/development`;

type Level = { level: number; cls: string; label: string; current: boolean };
/** Each rendered level in order: its class, its visible label, whether it is the current page. */
function levelsOf(html: string): Level[] {
  return [...html.matchAll(/<li data-crumb-level="(\d+)" class="([^"]*)">([\s\S]*?)<\/li>/g)].map(([, level, cls, body]) => ({
    level: Number(level), cls,
    label: [...body.matchAll(/dir="auto"[^>]*>([^<]*)</g)].map(m => m[1]).pop() ?? "",
    current: body.includes('aria-current="page"'),
  }));
}
const has = (level: Level, cls: string) => level.cls.split(/\s+/).includes(cls);
/** The cap the crumb promises, as a check the negative control can fail. */
function expectCapped(html: string) {
  expect(levelsOf(html).length).toBeLessThanOrEqual(CRUMB_MAX_LEVELS);
}

type Entry = { state: unknown; url: string };
function fakeBrowser(hash = "#/overview", { manual = false } = {}) {
  const target = new EventTarget();
  const entries: Entry[] = [{ state: null, url: ORIGIN + hash }];
  let index = 0;
  const queued: Array<() => void> = [];
  const add = (entry: Entry) => { entries.splice(index + 1); entries.push(entry); index = entries.length - 1; };
  const traverse = (delta: number) => {
    const run = () => {
      const next = index + delta;
      if (next < 0 || next >= entries.length) return;
      index = next;
      target.dispatchEvent(new Event("popstate"));
    };
    if (manual) queued.push(run); else setTimeout(run, 0);
  };
  const history = {
    get state() { return entries[index].state; },
    get length() { return entries.length; },
    pushState: vi.fn((next: unknown, _title: string, url?: string) => add({ state: next, url: url ?? entries[index].url })),
    back: vi.fn(() => traverse(-1)),
    forward: vi.fn(() => traverse(1)),
  };
  const location = { get href() { return entries[index].url; } };
  vi.stubGlobal("window", Object.assign(target, { history, location }));
  return {
    history,
    /** ArborContext.setActiveTab: a new entry only when the hash differs, and a fragment navigation fires popstate at once. */
    navigate(tab: string) {
      const url = `${ORIGIN}#/${tab}`;
      if (entries[index].url === url) return;
      add({ state: null, url });
      target.dispatchEvent(new Event("popstate"));
    },
    /** Manual mode: perform the traversals asked for so far. */
    deliver() { queued.splice(0).forEach(run => run()); },
    depth: () => index + 1,
    top: () => entries[index].state as Record<string, unknown> | null,
    url: () => entries[index].url,
    urls: () => entries.map(entry => entry.url),
  };
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
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("IA-06 · Breadcrumb markup", () => {
  it("renders at most three levels from four inputs: the last three, in order", () => {
    const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} />);
    expectCapped(html);
    expect(levelsOf(html).map(l => l.label)).toEqual(["My child", "Milestones", "Mornings at home"]);
    expect(html).not.toContain("Level one");
  });

  it("NEGATIVE CONTROL: a four-level crumb fails the cap check", () => {
    const four = FOUR.map((l, i) => `<li data-crumb-level="${i + 1}" class="flex"><span dir="auto">${l.label}</span></li>`).join("");
    expect(levelsOf(`<ol>${four}</ol>`)).toHaveLength(4);
    expect(() => expectCapped(`<ol>${four}</ol>`)).toThrow();
  });

  it("the last level is the current page, a span, and the only one", () => {
    const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} onSelect={vi.fn()} />);
    expect(levelsOf(html).map(l => l.current)).toEqual([false, false, true]);
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

  it("with somewhere to go, the ancestors are 44 px buttons with logical alignment; nothing uses a physical side", () => {
    const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} onSelect={vi.fn()} />);
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

  it("without somewhere to go, no level is a button: never a dead control", () => {
    const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} />);
    expect(html).not.toContain("<button");
    expect(levelsOf(html).map(l => l.label)).toEqual(["My child", "Milestones", "Mornings at home"]);
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

  it("compact (in the sheet): the home stays whole, the middle gives way first, the sheet level last", () => {
    const levels = levelsOf(renderToStaticMarkup(<Breadcrumb levels={FOUR} compact onSelect={vi.fn()} />));
    expect(has(levels[0], "shrink-0")).toBe(true);
    expect(has(levels[1], "shrink-[999]")).toBe(true);
    // The middle level keeps a floor that holds its chevron and a 44 px target.
    expect(has(levels[1], "min-w-16")).toBe(true);
    expect(has(levels[2], "min-w-0")).toBe(true);
    expect(has(levels[2], "shrink-[999]")).toBe(false);
  });

  it("no level clips its own box (that would cut the 2 px focus ring); only label text ellipsizes", () => {
    for (const compact of [true, false]) {
      const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} compact={compact} onSelect={vi.fn()} />);
      const levels = levelsOf(html);
      expect(levels.some(l => has(l, "truncate") || /overflow/.test(l.cls))).toBe(false);
      const labels = html.match(/<span[^>]*class="[^"]*\btruncate\b[^"]*"[^>]*dir="auto"/g) ?? [];
      expect(labels).toHaveLength(3);
      expect(html.match(/<button[^>]*class="[^"]*\b(?:truncate|overflow-hidden)\b/g)).toBeNull();
    }
  });

  it("wide: every ancestor may shrink to the same 44 px floor, none is singled out", () => {
    const wide = levelsOf(renderToStaticMarkup(<Breadcrumb levels={FOUR} onSelect={vi.fn()} />));
    expect(wide.slice(0, 2).every(l => has(l, "min-w-16"))).toBe(true);
    expect(wide.some(l => has(l, "shrink-0") || has(l, "shrink-[999]"))).toBe(false);
  });

  it("names its landmark in both languages with its own testid, apart from the top bar and the back button", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      const html = renderToStaticMarkup(<Breadcrumb levels={FOUR} />);
      expect(html).toContain(`<nav aria-label="${translate(lang, "nav.crumb.aria")}" data-testid="sheet-crumb"`);
      expect(html).not.toContain("topbar-crumb");
      expect(html).not.toContain("secondary-place-back");
    }
    expect(translate("en", "nav.crumb.aria")).toBe("Location");
    expect(translate("he", "nav.crumb.aria")).toBe("נתיב ניווט");
    expect(translate("he", "nav.crumb.aria")).not.toMatch(/[A-Za-z]/);
  });

  it("no levels: nothing renders", () => {
    expect(renderToStaticMarkup(<Breadcrumb levels={[]} />)).toBe("");
  });
});

describe("IA-06 · crumb levels follow the route's home and its pill row", () => {
  const t = (lang: "en" | "he") => (key: string) => translate(lang, key);
  it.each([
    ["overview", ["Now", QUESTION]],
    // v4: #/development is My child's "Milestones" reading.
    ["development", ["My child", "Milestones", QUESTION]],
    ["milestones", ["My child", "Milestones", QUESTION]],
    ["coach", ["Talk with Arbor", QUESTION]],
  ] as const)("EN %s", (tab, expected) => {
    expect(crumbLevelsFor(tab, QUESTION, "en", t("en")).map(l => l.label)).toEqual(expected);
  });

  it("HE: the same levels in Hebrew", () => {
    expect(crumbLevelsFor("development", QUESTION, "he", t("he")).map(l => l.label)).toEqual(["הילד שלי", "אבני דרך", QUESTION]);
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
    expect(browser.history.pushState.mock.calls[0][2]).toBe(OV);
    expect(browser.depth()).toBe(2);
    expect(typeof browser.top()?.arborSheet).toBe("string");

    sheet.value();
    sheet.unmount();
    await settle();
    expect(onClose).toHaveBeenCalledOnce();
    expect(browser.history.back).toHaveBeenCalledOnce();
    expect(browser.depth()).toBe(1);
    expect(browser.urls()).toEqual([OV, OV]);
    expect(browser.history.pushState).toHaveBeenCalledTimes(1);
  });

  it("browser Back closes the sheet once, leaves the route where it was, and retires nothing more", async () => {
    const browser = fakeBrowser("#/development");
    const onClose = vi.fn();
    const sheet = mount(() => useSheetHistory(true, onClose));
    browser.history.back();
    await tick();
    expect(onClose).toHaveBeenCalledOnce();
    expect(browser.url()).toBe(DEV);
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
    sheet.value(() => { seen.push(browser.depth()); browser.navigate("development"); });
    expect(onClose).toHaveBeenCalledOnce();
    expect(seen).toEqual([]);
    await settle();
    expect(seen).toEqual([1]);
    expect(browser.urls()).toEqual([OV, DEV]);
    sheet.unmount();
    await settle();
    expect(browser.history.back).toHaveBeenCalledOnce();
  });

  it("a double tap on a way out queues behind the first Back: one Back, then the route, one entry", async () => {
    const browser = fakeBrowser();
    const onClose = vi.fn();
    const sheet = mount(() => useSheetHistory(true, onClose));
    const go = vi.fn((tab: string) => browser.navigate(tab));
    sheet.value(() => go("development"));
    sheet.value(() => go("development"));
    expect(go).not.toHaveBeenCalled();
    await settle();
    expect(go).toHaveBeenCalledTimes(2);
    expect(browser.history.back).toHaveBeenCalledOnce();
    expect(browser.urls()).toEqual([OV, DEV]);
    expect(browser.url()).toBe(DEV);
    sheet.unmount();
    await settle();
    expect(browser.history.back).toHaveBeenCalledOnce();
  });

  it("a Back the browser performs only after the timer gave up on it never pops the route the parent went to", async () => {
    vi.useFakeTimers();
    const browser = fakeBrowser("#/overview", { manual: true });
    const onClose = vi.fn();
    const sheet = mount(() => useSheetHistory(true, onClose));
    sheet.value(() => browser.navigate("development"));
    expect(browser.urls()).toEqual([OV, OV]);
    vi.advanceTimersByTime(1000);
    // The timer landed it; the route change (and the popstate it fires) went through.
    expect(browser.urls()).toEqual([OV, OV, DEV]);
    // A browser runs window's capture listeners first; Node's EventTarget runs
    // them in registration order, and this one registers after the guard.
    const later = vi.fn();
    window.addEventListener("popstate", later);
    browser.deliver();
    expect(later).not.toHaveBeenCalled();
    expect(browser.history.forward).toHaveBeenCalledOnce();
    browser.deliver();
    expect(browser.url()).toBe(DEV);
    expect(browser.depth()).toBe(3);
    expect(later).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    window.removeEventListener("popstate", later);
    sheet.unmount();
    await Promise.resolve();
    expect(browser.history.back).toHaveBeenCalledOnce();
  });

  it("a late Back with nothing pushed since simply finishes: no step forward", async () => {
    vi.useFakeTimers();
    const browser = fakeBrowser("#/overview", { manual: true });
    const sheet = mount(() => useSheetHistory(true, vi.fn()));
    sheet.value();
    vi.advanceTimersByTime(1000);
    browser.deliver();
    expect(browser.depth()).toBe(1);
    expect(browser.url()).toBe(OV);
    browser.deliver();
    expect(browser.history.forward).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    sheet.unmount();
    await Promise.resolve();
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

  it("over an open Learn read: the sheet's Back and close leave the read open, and the read retires its own entry", async () => {
    const browser = fakeBrowser("#/learn");
    // LearnLibrary's own open / popstate / close (OBJ-LEARN-02), line for line in behaviour.
    let read: string | null = null;
    const openCard = (id: string) => { read = id; window.history.pushState({ ...(window.history.state ?? {}), arborLearnCard: id }, "", window.location.href); };
    const onLearnPop = () => { read = ((window.history.state ?? {}) as { arborLearnCard?: string }).arborLearnCard ?? null; };
    const closeCard = () => { read = null; if (((window.history.state ?? {}) as { arborLearnCard?: string }).arborLearnCard) window.history.back(); };
    window.addEventListener("popstate", onLearnPop);
    openCard("card-1");

    const onClose = vi.fn();
    const first = mount(() => useSheetHistory(true, onClose));
    expect(browser.top()).toEqual({ arborLearnCard: "card-1", arborSheet: expect.any(String) });
    browser.history.back();
    await tick();
    expect(onClose).toHaveBeenCalledOnce();
    expect(read).toBe("card-1");
    expect(browser.depth()).toBe(2);
    first.unmount();
    await settle();
    expect(browser.history.back).toHaveBeenCalledTimes(1);

    const second = mount(() => useSheetHistory(true, vi.fn()));
    expect(browser.depth()).toBe(3);
    second.value();
    second.unmount();
    await settle();
    expect(read).toBe("card-1");
    expect(browser.top()).toEqual({ arborLearnCard: "card-1" });

    closeCard();
    await settle();
    expect(read).toBeNull();
    expect(browser.depth()).toBe(1);
    expect(browser.top()).toBeNull();
    window.removeEventListener("popstate", onLearnPop);
  });
});

describe("IA-06 · the sheet's crumb", () => {
  it("#/development with a selection open: My child › Milestones › its title", () => {
    state.activeTab = "development";
    const html = renderToStaticMarkup(<SheetBreadcrumb label="Mornings at home" close={vi.fn()} />);
    expect(levelsOf(html).map(l => l.label)).toEqual(["My child", "Milestones", "Mornings at home"]);
  });

  it("#/overview with the question sheet open: Now › the question (the Now pill is not repeated)", () => {
    expect(levelsOf(renderToStaticMarkup(<SheetBreadcrumb label={QUESTION} close={vi.fn()} />)).map(l => l.label)).toEqual(["Now", QUESTION]);
  });

  it("Hebrew: the levels in Hebrew under the Hebrew landmark name", () => {
    state.lang = "he"; state.activeTab = "development";
    const html = renderToStaticMarkup(<SheetBreadcrumb label="בוקר בבית" close={vi.fn()} />);
    expect(html).toContain('aria-label="נתיב ניווט"');
    expect(levelsOf(html).map(l => l.label)).toEqual(["הילד שלי", "אבני דרך", "בוקר בבית"]);
  });

  it("is always the compact crumb, pulled up under the dialog title", () => {
    state.activeTab = "development";
    const html = renderToStaticMarkup(<SheetBreadcrumb label="Mornings at home" close={vi.fn()} />);
    const nav = html.match(/<nav [^>]*>/)?.[0] ?? "";
    for (const cls of ["min-w-0", "-mt-3", "mb-1", "-ms-1"]) expect(nav.split(/[\s"]/)).toContain(cls);
    const levels = levelsOf(html);
    expect(has(levels[0], "shrink-0") && has(levels[1], "shrink-[999]")).toBe(true);
  });

  it("an ancestor closes the sheet first and goes to its route once the entry is gone", async () => {
    const browser = fakeBrowser("#/milestones");
    state.activeTab = "milestones";
    state.setActiveTab = vi.fn((tab: string) => browser.navigate(tab));
    const onClose = vi.fn();
    const sheet = mount(() => useSheetHistory(true, onClose));
    state.buttons = [];
    renderToStaticMarkup(<SheetBreadcrumb label="Mornings at home" close={sheet.value} />);
    expect(state.buttons).toHaveLength(2);
    state.buttons[0].onClick();
    expect(onClose).toHaveBeenCalledOnce();
    expect(state.setActiveTab).not.toHaveBeenCalled();
    await settle();
    expect(state.setActiveTab).toHaveBeenCalledWith("development");
    expect(browser.urls()).toEqual([`${ORIGIN}#/milestones`, DEV]);
    sheet.unmount();
    await settle();
    expect(browser.history.back).toHaveBeenCalledOnce();
  });
});

describe("IA-06 · the crumb renders inside the open dialog, under its title", () => {
  beforeEach(() => { vi.stubGlobal("document", { body: {} }); });

  function expectInDialog(html: string, lang: "en" | "he", body: string) {
    const at = (needle: string) => {
      const index = html.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at('role="dialog"'),
      at("<h3"),
      at(`aria-label="${translate(lang, "aria.close")}"`),
      at(`<nav aria-label="${translate(lang, "nav.crumb.aria")}" data-testid="sheet-crumb"`),
      at(body),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html.match(/data-testid="sheet-crumb"/g)).toHaveLength(1);
    expect(html.match(/<div [^>]*role="dialog"[^>]*>/)?.[0]).toContain("bg-white");
  }

  it.each(["en", "he"] as const)("the question sheet (%s): dialog, title, close, crumb, then the body", (lang) => {
    state.lang = lang;
    const html = renderToStaticMarkup(
      <Sheet open onClose={() => {}} title={translate(lang, "companion.family-topic-sheet.what-we-re-exploring")}>
        <SheetBreadcrumb label={QUESTION} close={vi.fn()} />
        <div className="topic-sheet">body</div>
      </Sheet>,
    );
    expectInDialog(html, lang, 'class="topic-sheet"');
    expect(levelsOf(html).map(l => l.label)).toEqual([lang === "he" ? "עכשיו" : "Now", QUESTION]);
  });

  it.each(["en", "he"] as const)("the portrait selection on #/development (%s): the same, in the centred dialog", (lang) => {
    state.lang = lang; state.activeTab = "development";
    const html = renderToStaticMarkup(
      <Modal open onClose={() => {}} title="Mornings at home" maxWidth="max-w-2xl">
        <SheetBreadcrumb label="Mornings at home" close={vi.fn()} />
        <div className="portrait-evidence">body</div>
      </Modal>,
    );
    expectInDialog(html, lang, 'class="portrait-evidence"');
    expect(levelsOf(html).map(l => l.label)).toEqual(lang === "he" ? ["הילד שלי", "אבני דרך", "Mornings at home"] : ["My child", "Milestones", "Mornings at home"]);
  });

  it("with no sheet open, no crumb renders", () => {
    const sheet = renderToStaticMarkup(<Sheet open={false} onClose={() => {}} title="x"><SheetBreadcrumb label={QUESTION} close={vi.fn()} /></Sheet>);
    const modal = renderToStaticMarkup(<Modal open={false} onClose={() => {}} title="x"><SheetBreadcrumb label={QUESTION} close={vi.fn()} /></Modal>);
    expect(sheet + modal).not.toContain("sheet-crumb");
  });
});

describe("IA-06 · wiring (source pins)", () => {
  const read = (rel: string) => readFileSync(path.join(__dirname, "..", "..", rel), "utf8");
  const ordered = (src: string, ...needles: string[]) => {
    const at = needles.map(needle => src.indexOf(needle));
    expect(at.every(index => index > -1), needles.join(" | ")).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  };

  it("the crumb belongs to the dialog: the top bar and the shell carry none, and FEAT-05's event keeps its one listener", () => {
    for (const file of ["components/layout/Topbar.tsx", "components/layout/Shell.tsx"]) {
      expect(read(file)).not.toMatch(/Breadcrumb|sheet-crumb|useSheetHistory/);
    }
    expect(read("components/layout/Shell.tsx").match(/addEventListener\(FAMILY_TOPIC_SHEET_EVENT/g)).toHaveLength(1);
  });

  it("the question sheet: the crumb is the first line of its body, and every way out goes through its one close", () => {
    const sheet = read("components/companion/FamilyTopicSheet.tsx");
    ordered(sheet, "<Sheet open onClose={() => close()}", "<SheetBreadcrumb label=", '<div className="topic-sheet"');
    expect(sheet).toContain("useSheetHistory(true, onClose)");
    expect(sheet).not.toMatch(/onClose\(\);\s*setActiveTab\(/);
    expect(sheet).toContain('close(() => setActiveTab("development"))');
  });

  // v3 F-CHILD-1 RE-PIN: the portrait's evidence views (thread map, places,
  // across areas) and their selection dialog leave My child for the Moments
  // pill (F-CHILD-2), so the page no longer opens that dialog or owns its
  // history entry. Was: the selection dialog's crumb order and its one close.
  it("v3 F-CHILD-1: My child opens no selection dialog, so it holds no sheet history entry of its own", () => {
    const portrait = read("components/companion/ChildPortrait.tsx");
    expect(portrait).not.toContain("useSheetHistory(");
    expect(portrait).not.toContain("<Modal");
    expect(portrait).not.toContain("setSelection(");
  });

  it("the Learn reader keeps its own history marker, untouched", () => {
    const learn = read("components/sections/LearnLibrary.tsx");
    expect(learn).toContain('window.history.pushState({ ...(window.history.state ?? {}), arborLearnCard: id }, "", window.location.href);');
    expect(learn).not.toContain("useSheetHistory");
  });
});
