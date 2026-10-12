import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * v3 IA-06r — the L2 crumb and the history entry its sheet owns.
 *
 * The crumb is the open dialog's companion: drawn in the dialog layer, above
 * the backdrop, ahead of the dialog box, where the chrome answers "where am I"
 * (over the top bar's title zone at lg+, a strip under the phone header below
 * lg). Markup is rendered on the server inside the REAL Sheet and Modal
 * (portal, motion and the dialog registration stubbed), so that placement is a
 * rendered fact, not a source pin. Its measurement (placeCrumb) runs against a
 * fake DOM. The hooks run their captured effects by hand (mount, StrictMode
 * replay, unmount) against a fake window whose history behaves like a
 * browser's: pushState truncates the forward stack, back()/forward() traverse
 * on a later task (or when the test delivers them), and a hash navigation
 * fires popstate at once, as a fragment navigation does.
 *
 * IA-06r re-pin (from IA-06 round 2): the crumb left the dialog's body for its
 * layer (testids topbar-crumb / mobile-crumb, never sheet-crumb), the compact
 * and wide modes became the two places (bar / strip), and the two timer tests
 * gave way to one that proves no timer exists: a Back lands when the browser
 * says so, and nothing runs before it.
 */
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  activeTab: "overview" as string,
  setActiveTab: vi.fn(),
  compact: false,
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
// The crumb picks its place from the same seam the dialogs use (lg = 1024).
vi.mock("../ui/Sheet", async (original) => ({ ...(await original<typeof import("../ui/Sheet")>()), useCompactSurface: () => state.compact }));
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
import {
  Breadcrumb, CRUMB_INSET_VAR, CRUMB_MAX_LEVELS, SheetBreadcrumb, crumbLevelsFor, placeCrumb, type CrumbLevel, type CrumbPlace,
} from "./Breadcrumb";
import { useSheetHistory } from "../../hooks/useSheetHistory";
import { sheetCrumbShownNow } from "../../hooks/useSheetCrumbShown";
import { DIALOG_COMPANION } from "../../lib/dialogStack";
import { Sheet } from "../ui/Sheet";
import { Modal } from "../ui/Modal";
import { translate } from "../../lib/i18n";

const QUESTION = "How could mornings feel easier?";
const FOUR: CrumbLevel[] = [
  { label: "Level one", tab: "overview" },
  { label: "My child", tab: "development" },
  { label: "Development map", tab: "development" },
  { label: "Mornings at home" },
];
const PLACES: CrumbPlace[] = ["bar", "strip"];
const TESTID: Record<CrumbPlace, string> = { bar: "topbar-crumb", strip: "mobile-crumb" };
const ORIGIN = "https://arbor.test/";
const OV = `${ORIGIN}#/overview`;
const DEV = `${ORIGIN}#/development`;

type Level = { level: number; cls: string; body: string; label: string; current: boolean };
/** Each rendered level in order: its class, its markup, its visible label, whether it is the current page. */
function levelsOf(html: string): Level[] {
  return [...html.matchAll(/<li data-crumb-level="(\d+)" class="([^"]*)">([\s\S]*?)<\/li>/g)].map(([, level, cls, body]) => ({
    level: Number(level), cls, body,
    label: [...body.matchAll(/dir="auto"[^>]*>([^<]*)</g)].map(m => m[1]).pop() ?? "",
    current: body.includes('aria-current="page"'),
  }));
}
const has = (level: Level, cls: string) => level.cls.split(/\s+/).includes(cls);
/** The class of the element whose text is the level's label. */
const labelClass = (level: Level) => /class="([^"]*)"[^>]*dir="auto"[^>]*>[^<]*</.exec(level.body)?.[1] ?? "";
/** The cap the crumb promises, as a check the negative control can fail. */
function expectCapped(html: string) {
  expect(levelsOf(html).length).toBeLessThanOrEqual(CRUMB_MAX_LEVELS);
}
/** The sheet's own level keeps its whole text: it may wrap, it never ellipsizes or clips. */
function lastLevelWhole(html: string): boolean {
  const levels = levelsOf(html);
  const last = levels[levels.length - 1];
  if (!last || !last.current) return false;
  const label = labelClass(last);
  return /\bbreak-words\b/.test(label) && !/\b(?:truncate|text-ellipsis|line-clamp-\d+|overflow-hidden|whitespace-nowrap)\b/.test(`${last.cls} ${label}`);
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

beforeEach(() => { state.lang = "en"; state.activeTab = "overview"; state.setActiveTab = vi.fn(); state.compact = false; state.buttons = []; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("IA-06r · Breadcrumb markup, in both places", () => {
  const crumb = (place: CrumbPlace, levels: CrumbLevel[] = FOUR, onSelect = vi.fn()) =>
    renderToStaticMarkup(<Breadcrumb levels={levels} place={place} onSelect={onSelect} />);

  it.each(PLACES)("%s: at most three levels from four inputs, the last three, in order", (place) => {
    const html = crumb(place);
    expectCapped(html);
    expect(levelsOf(html).map(l => l.label)).toEqual(["My child", "Development map", "Mornings at home"]);
    expect(html).not.toContain("Level one");
  });

  it("NEGATIVE CONTROL: a four-level crumb fails the cap check", () => {
    const four = FOUR.map((l, i) => `<li data-crumb-level="${i + 1}" class="flex"><span dir="auto">${l.label}</span></li>`).join("");
    expect(levelsOf(`<ol>${four}</ol>`)).toHaveLength(4);
    expect(() => expectCapped(`<ol>${four}</ol>`)).toThrow();
  });

  it.each(PLACES)("%s: the last level is the current page, a span, and the only one", (place) => {
    const html = crumb(place);
    expect(levelsOf(html).map(l => l.current)).toEqual([false, false, true]);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<span aria-current="page"[^>]*>Mornings at home<\/span>/);
  });

  it.each(PLACES)("%s: each separator is the chevron, mirrored once under RTL, and never shrinks", (place) => {
    const html = crumb(place);
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

  it.each(PLACES)("%s: the ancestors are real 44 px buttons with logical alignment; nothing uses a physical side", (place) => {
    const html = crumb(place);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toContain('type="button"');
      expect(button).toMatch(/\bmin-h-11\b/);
      expect(button).toMatch(/\bmin-w-11\b/);
      expect(button).toMatch(/\btext-start\b/);
    }
    expect(html).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-\d|text-left|text-right/);
  });

  it("a level with no route to go to is not a button: never a dead control", () => {
    const html = crumb("bar", [{ label: "Now", tab: "overview" }, { label: "Plain" }, { label: "The sheet" }]);
    expect(html.match(/<button/g)).toHaveLength(1);
    const levels = levelsOf(html);
    expect(levels.map(l => l.label)).toEqual(["Now", "Plain", "The sheet"]);
    expect(levels[1].body).not.toContain("<button");
    expect(levels[1].current).toBe(false);
  });

  it("an ancestor reports its own tab; the current level is not a control", () => {
    const onSelect = vi.fn();
    state.buttons = [];
    crumb("bar", FOUR, onSelect);
    expect(state.buttons).toHaveLength(2);
    state.buttons[0].onClick();
    state.buttons[1].onClick();
    expect(onSelect.mock.calls).toEqual([["development"], ["development"]]);
  });

  it.each(PLACES)("%s: the first level and the last stay whole; only the middle gives way", (place) => {
    const html = crumb(place);
    const [first, middle, last] = levelsOf(html);
    // The home never shrinks and never cuts its name.
    expect(has(first, "shrink-0")).toBe(true);
    expect(labelClass(first)).toMatch(/\bwhitespace-nowrap\b/);
    expect(labelClass(first)).not.toMatch(/\btruncate\b/);
    // The middle shrinks first and far, down to a floor that holds its chevron
    // and a 44 px target; its label ellipsizes.
    expect(has(middle, "shrink-[999]")).toBe(true);
    expect(has(middle, "min-w-16")).toBe(true);
    expect(labelClass(middle)).toMatch(/\bmin-w-0\b.*\btruncate\b/);
    // The sheet's own level may wrap onto a second line; it never loses its end.
    expect(has(last, "min-w-0")).toBe(true);
    expect(has(last, "shrink-[999]")).toBe(false);
    expect(lastLevelWhole(html)).toBe(true);
    // Exactly one label in the crumb may ellipsize: the middle one.
    expect(html.match(/class="[^"]*\btruncate\b[^"]*"/g)).toHaveLength(1);
  });

  it("NEGATIVE CONTROL: the round-1 and round-2 sheet levels (ellipsized, or clipped to one line) fail the whole-last-level check", () => {
    const head = '<li data-crumb-level="1" class="flex shrink-0 items-center gap-1"><button type="button"><span class="whitespace-nowrap" dir="auto">My child</span></button></li>';
    const round1 = `${head}<li data-crumb-level="2" class="flex min-w-0 items-center gap-1"><span aria-current="page" class="min-w-0 truncate px-1" dir="auto">Mornings at home</span></li>`;
    const round2 = `${head}<li data-crumb-level="2" class="flex min-w-0 overflow-hidden items-center gap-1"><span aria-current="page" class="min-w-0 break-words px-1" dir="auto">Mornings at home</span></li>`;
    const fixed = round1.replace("min-w-0 truncate px-1", "min-w-0 break-words px-1");
    expect(lastLevelWhole(round1)).toBe(false);
    expect(lastLevelWhole(round2)).toBe(false);
    expect(lastLevelWhole(fixed)).toBe(true);
  });

  it.each(PLACES)("%s: no level clips its own box (that would cut the 2 px focus ring)", (place) => {
    const html = crumb(place);
    expect(levelsOf(html).some(l => has(l, "truncate") || /overflow/.test(l.cls))).toBe(false);
    expect(html.match(/<button[^>]*class="[^"]*\b(?:truncate|overflow-hidden)\b/g)).toBeNull();
  });

  it("names its landmark in both languages, with one testid per place and never the round-2 one", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      for (const place of PLACES) {
        const html = crumb(place);
        expect(html).toContain(`<nav aria-label="${translate(lang, "nav.crumb.aria")}" data-testid="${TESTID[place]}" data-crumb-place="${place}"`);
        expect(html.match(/data-testid="/g)).toHaveLength(1);
        expect(html).not.toContain("sheet-crumb");
        expect(html).not.toContain("secondary-place-back");
      }
    }
    expect(translate("en", "nav.crumb.aria")).toBe("Location");
    expect(translate("he", "nav.crumb.aria")).toBe("נתיב ניווט");
    expect(translate("he", "nav.crumb.aria")).not.toMatch(/[A-Za-z]/);
  });

  it("reads as the title it stands in for (15 px over the top bar, 13 px in the phone strip), on an opaque paper chip that takes the pointer", () => {
    const bar = crumb("bar"), strip = crumb("strip");
    expect(bar).toContain("text-[15px]");
    expect(bar).not.toContain("text-[13px]");
    expect(strip).toContain("text-[13px]");
    expect(strip).not.toContain("text-[15px]");
    for (const html of [bar, strip]) {
      const nav = html.match(/<nav [^>]*>/)?.[0] ?? "";
      for (const cls of ["pointer-events-auto", "absolute", "min-h-11", "min-w-0"]) expect(nav.split(/[\s"]/)).toContain(cls);
      expect(nav).toContain("background:var(--arbor-paper-elevated)");
      expect(nav).toContain("border:1px solid var(--arbor-rule)");
      expect(nav).toContain("color:var(--arbor-ink)");
    }
  });

  it("no levels: nothing renders", () => {
    for (const place of PLACES) expect(renderToStaticMarkup(<Breadcrumb levels={[]} place={place} onSelect={vi.fn()} />)).toBe("");
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

describe("IA-06r · placeCrumb puts the crumb in its place and keeps the dialog box below it", () => {
  type Box = { top: number; left: number; width: number; height: number };
  const rect = ({ top, left, width, height }: Box) => ({ top, left, width, height, right: left + width, bottom: top + height, x: left, y: top });
  const NONE: Box = { top: 0, left: 0, width: 0, height: 0 };
  const fakeStyle = () => {
    const props = new Map<string, string>();
    return { props, setProperty: (name: string, value: string) => { props.set(name, value); }, removeProperty: (name: string) => { props.delete(name); return ""; } };
  };
  type Watcher = { fire: () => void; observed: unknown[]; disconnected: boolean };

  /** A dialog layer, the two anchors (the top bar title zone, the phone header) and the crumb's nav. */
  function scene(opts: { place: CrumbPlace; frame: Box; nav: Box; anchors: Partial<Record<CrumbPlace, Box>>; dir?: "ltr" | "rtl"; observer?: boolean }) {
    const live = { anchors: { ...opts.anchors }, nav: { ...opts.nav } };
    const resize = new Set<() => void>();
    const watchers: Watcher[] = [];
    function FakeObserver(this: Watcher, fire: () => void) {
      this.fire = fire; this.observed = []; this.disconnected = false;
      watchers.push(this);
    }
    FakeObserver.prototype.observe = function (this: Watcher, target: unknown) { this.observed.push(target); };
    FakeObserver.prototype.disconnect = function (this: Watcher) { this.disconnected = true; };
    const win = {
      getComputedStyle: () => ({ direction: opts.dir ?? "ltr" }),
      addEventListener: (type: string, fn: () => void) => { if (type === "resize") resize.add(fn); },
      removeEventListener: (type: string, fn: () => void) => { if (type === "resize") resize.delete(fn); },
      ResizeObserver: opts.observer ? FakeObserver : undefined,
    };
    const layer = { style: fakeStyle(), getBoundingClientRect: () => rect(opts.frame) };
    const doc = {
      defaultView: win,
      documentElement: { getBoundingClientRect: () => rect(opts.frame) },
      querySelector: (selector: string) => {
        const place = /^\[data-crumb-anchor="(bar|strip)"\]$/.exec(selector)?.[1] as CrumbPlace | undefined;
        const box = place ? live.anchors[place] : undefined;
        return box ? { getBoundingClientRect: () => rect(box) } : null;
      },
    };
    const nav = { ownerDocument: doc, style: fakeStyle(), closest: (selector: string) => (selector === "[data-arbor-dialog-layer]" ? layer : null), getBoundingClientRect: () => rect(live.nav) };
    const undo = placeCrumb(nav as unknown as HTMLElement, opts.place);
    return { live, undo, nav, crumb: nav.style.props, layer: layer.style.props, resize, watchers };
  }
  const DESKTOP: Box = { top: 0, left: 0, width: 1920, height: 1080 };
  const PHONE: Box = { top: 0, left: 0, width: 390, height: 844 };

  it("lg+ at 1920: centred in the 64 px band, starting where the title starts, no wider than the title zone; the box starts 8 px below it", () => {
    const s = scene({ place: "bar", frame: DESKTOP, anchors: { bar: { top: 0, left: 280, width: 820, height: 64 }, strip: NONE }, nav: { top: 10, left: 280, width: 420, height: 44 } });
    expect(s.crumb.get("--crumb-top")).toBe("10px");
    expect(s.crumb.get("--crumb-start")).toBe("280px");
    expect(s.crumb.get("--crumb-max")).toBe("820px");
    expect(s.layer.get(CRUMB_INSET_VAR)).toBe("62px");
    expect(CRUMB_INSET_VAR).toBe("--arbor-crumb-inset");
    s.undo();
  });

  it("lg+ in Hebrew: the start is measured from the right edge, so the same logical inset mirrors", () => {
    const s = scene({ place: "bar", dir: "rtl", frame: DESKTOP, anchors: { bar: { top: 0, left: 820, width: 820, height: 64 }, strip: NONE }, nav: { top: 10, left: 1220, width: 420, height: 44 } });
    expect(s.crumb.get("--crumb-start")).toBe("280px");
    expect(s.crumb.get("--crumb-max")).toBe("820px");
    expect(s.crumb.get("--crumb-top")).toBe("10px");
    s.undo();
  });

  it("below lg at 390: a strip 8 px under the phone header, never under the status bar; the sheet's top edge stays below it", () => {
    const s = scene({ place: "strip", frame: PHONE, anchors: { bar: NONE, strip: { top: 12, left: 16, width: 358, height: 40 } }, nav: { top: 60, left: 16, width: 358, height: 44 } });
    expect(s.crumb.get("--crumb-top")).toBe("max(60px, calc(env(safe-area-inset-top) + 8px))");
    expect(s.crumb.has("--crumb-start")).toBe(false);
    expect(s.crumb.has("--crumb-max")).toBe(false);
    expect(s.layer.get(CRUMB_INSET_VAR)).toBe("112px");
    s.undo();
  });

  it("the page under the sheet was scrolled past the header: the strip holds just below the safe area", () => {
    const s = scene({ place: "strip", frame: PHONE, anchors: { strip: { top: -80, left: 16, width: 358, height: 40 } }, nav: { top: 8, left: 16, width: 358, height: 44 } });
    expect(s.crumb.get("--crumb-top")).toBe("max(-32px, calc(env(safe-area-inset-top) + 8px))");
    expect(s.layer.get(CRUMB_INSET_VAR)).toBe("60px");
    s.undo();
  });

  it("no anchor on screen (missing, or the hidden one at this width): the CSS fallback place stands, and the box still clears the crumb", () => {
    for (const anchors of [{}, { bar: NONE, strip: { top: 12, left: 16, width: 358, height: 40 } }] as Array<Partial<Record<CrumbPlace, Box>>>) {
      const s = scene({ place: "bar", frame: DESKTOP, anchors, nav: { top: 10, left: 20, width: 300, height: 44 } });
      expect(s.crumb.size).toBe(0);
      expect(s.layer.get(CRUMB_INSET_VAR)).toBe("62px");
      s.undo();
    }
  });

  it("re-measures on resize and when the crumb's own size changes (a long sheet label wraps); the undo lets go of everything", () => {
    const s = scene({ place: "bar", observer: true, frame: DESKTOP, anchors: { bar: { top: 0, left: 280, width: 820, height: 64 } }, nav: { top: 10, left: 280, width: 420, height: 44 } });
    expect(s.resize.size).toBe(1);
    expect(s.watchers).toHaveLength(1);
    expect(s.watchers[0].observed).toHaveLength(1);
    expect(s.watchers[0].observed[0]).toBe(s.nav);
    s.live.anchors.bar = { top: 0, left: 280, width: 600, height: 64 };
    s.resize.forEach(fn => fn());
    expect(s.crumb.get("--crumb-max")).toBe("600px");
    s.live.nav = { top: 10, left: 280, width: 600, height: 66 };
    s.watchers[0].fire();
    expect(s.layer.get(CRUMB_INSET_VAR)).toBe("84px");
    s.undo();
    expect(s.resize.size).toBe(0);
    expect(s.watchers[0].disconnected).toBe(true);
    expect(s.layer.has(CRUMB_INSET_VAR)).toBe(false);
  });

  it("without ResizeObserver it still measures once and follows the window", () => {
    const s = scene({ place: "strip", frame: PHONE, anchors: { strip: { top: 12, left: 16, width: 358, height: 40 } }, nav: { top: 60, left: 16, width: 358, height: 44 } });
    expect(s.watchers).toHaveLength(0);
    expect(s.resize.size).toBe(1);
    s.live.anchors.strip = { top: 12, left: 16, width: 358, height: 56 };
    s.resize.forEach(fn => fn());
    expect(s.crumb.get("--crumb-top")).toBe("max(76px, calc(env(safe-area-inset-top) + 8px))");
    s.undo();
    expect(s.resize.size).toBe(0);
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

  it("IA-06r: a slow Back holds the route change until the browser lands it; no timer stands in for it and nothing steps forward", async () => {
    vi.useFakeTimers();
    const browser = fakeBrowser("#/overview", { manual: true });
    const onClose = vi.fn();
    const sheet = mount(() => useSheetHistory(true, onClose));
    const go = vi.fn((tab: string) => browser.navigate(tab));
    sheet.value(() => go("development"));
    sheet.value(() => go("development")); // a second tap while the Back is still in flight
    expect(onClose).toHaveBeenCalled();
    expect(browser.history.back).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    // However long the browser takes, nothing gives up on the Back.
    vi.advanceTimersByTime(60_000);
    expect(go).not.toHaveBeenCalled();
    expect(browser.urls()).toEqual([OV, OV]);
    browser.deliver();
    expect(go).toHaveBeenCalledTimes(2);
    expect(browser.urls()).toEqual([OV, DEV]);
    expect(browser.url()).toBe(DEV);
    expect(browser.history.forward).not.toHaveBeenCalled();
    sheet.unmount();
    await Promise.resolve();
    expect(browser.history.back).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
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

  it("over an open Learn read (both markers on the stack): the sheet's Back and close leave the read open, and the read retires its own entry", async () => {
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

describe("IA-06r · no timer, no capture-phase hack: the land is the browser's own popstate", () => {
  const read = (rel: string) => readFileSync(path.join(__dirname, "..", "..", rel), "utf8");
  /** Code only: block and line comments go (they may name what the code must not do). */
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const HACKS: Array<[string, RegExp]> = [
    ["timer", /\b(?:setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)\b/],
    ["swallowed event", /\b(?:stopImmediatePropagation|stopPropagation)\b/],
    ["step forward", /\bhistory\.(?:forward|go)\b/],
    ["capture listener", /addEventListener\([^)]*,\s*(?:true\b|\{[^}]*\bcapture\b)/],
  ];
  const hacks = (src: string) => HACKS.filter(([, re]) => re.test(code(src))).map(([name]) => name);

  it("lib/sheetHistory and its hook carry none of them; the ledger listens to popstate once, in the bubble phase", () => {
    for (const file of ["lib/sheetHistory.ts", "hooks/useSheetHistory.ts"]) expect(hacks(read(file)), file).toEqual([]);
    const ledger = code(read("lib/sheetHistory.ts"));
    expect(ledger.match(/addEventListener\("popstate", onLand\)/g)).toHaveLength(1);
    expect(ledger).not.toMatch(/BACK_TIMEOUT|LATE_BACK|guardLateBack|disarmLateBack/);
    expect(ledger).not.toMatch(/export function sheetTokenOnTop/);
  });

  it("NEGATIVE CONTROL: the round-2 timer, capture guard and forward step are each caught", () => {
    const round2 = [
      "timer = setTimeout(() => land(true), BACK_TIMEOUT_MS);",
      'window.addEventListener("popstate", onLatePop, true);',
      "event.stopImmediatePropagation();",
      "try { window.history.forward(); } catch { /* nothing */ }",
    ].join("\n");
    expect(hacks(round2)).toEqual(["timer", "swallowed event", "step forward", "capture listener"]);
    expect(hacks('window.addEventListener("popstate", onLand, { capture: true });')).toEqual(["capture listener"]);
    // A comment that names them is not code.
    expect(hacks("/* no setTimeout, no capture */\n// history.forward is gone")).toEqual([]);
  });
});

describe("IA-06r · the sheet's crumb", () => {
  it("#/development with a selection open: My child › Development map › its title", () => {
    state.activeTab = "development";
    const html = renderToStaticMarkup(<SheetBreadcrumb label="Mornings at home" close={vi.fn()} />);
    expect(levelsOf(html).map(l => l.label)).toEqual(["My child", "Development map", "Mornings at home"]);
  });

  it("#/overview with the question sheet open: Now › the question (the Now pill is not repeated)", () => {
    expect(levelsOf(renderToStaticMarkup(<SheetBreadcrumb label={QUESTION} close={vi.fn()} />)).map(l => l.label)).toEqual(["Now", QUESTION]);
  });

  it("Hebrew: the levels in Hebrew under the Hebrew landmark name", () => {
    state.lang = "he"; state.activeTab = "development";
    const html = renderToStaticMarkup(<SheetBreadcrumb label="בוקר בבית" close={vi.fn()} />);
    expect(html).toContain('aria-label="נתיב ניווט"');
    expect(levelsOf(html).map(l => l.label)).toEqual(["הילד שלי", "מפת התפתחות", "בוקר בבית"]);
  });

  it("lg+: the top bar crumb, already over the title zone before it is measured", () => {
    state.activeTab = "development";
    const html = renderToStaticMarkup(<SheetBreadcrumb label="Mornings at home" close={vi.fn()} />);
    const nav = html.match(/<nav [^>]*>/)?.[0] ?? "";
    expect(nav).toContain('data-testid="topbar-crumb"');
    expect(nav).toContain('data-crumb-place="bar"');
    expect(nav).toContain("top:var(--crumb-top, 10px)");
    expect(nav).toContain("inset-inline-start:var(--crumb-start, 1.25rem)");
    expect(nav).toContain("max-inline-size:var(--crumb-max, none)");
    expect(html).not.toContain("mobile-crumb");
  });

  it("below lg: the phone strip, across the width under the header, with the 16 px gutter", () => {
    state.compact = true; state.activeTab = "development";
    const html = renderToStaticMarkup(<SheetBreadcrumb label="Mornings at home" close={vi.fn()} />);
    const nav = html.match(/<nav [^>]*>/)?.[0] ?? "";
    expect(nav).toContain('data-testid="mobile-crumb"');
    expect(nav).toContain('data-crumb-place="strip"');
    expect(nav).toContain("top:var(--crumb-top, calc(env(safe-area-inset-top) + 4rem))");
    expect(nav).toContain("inset-inline:16px");
    expect(nav).not.toContain("inset-inline-start");
    expect(html).not.toContain("topbar-crumb");
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

  it("while it is mounted the top bar's title steps aside; a count, so a crumb fading out under a new one never brings the title back early", () => {
    const mountCrumb = () => {
      state.effects = [];
      renderToStaticMarkup(<SheetBreadcrumb label={QUESTION} close={vi.fn()} />);
      const cleanups = state.effects.map(run => run());
      return () => cleanups.forEach(cleanup => { if (typeof cleanup === "function") cleanup(); });
    };
    expect(sheetCrumbShownNow()).toBe(false);
    const first = mountCrumb();
    expect(sheetCrumbShownNow()).toBe(true);
    const second = mountCrumb();
    first();
    expect(sheetCrumbShownNow()).toBe(true);
    second();
    expect(sheetCrumbShownNow()).toBe(false);
  });
});

describe("IA-06r · the crumb is the dialog's companion: in its layer, above the backdrop, ahead of the box", () => {
  beforeEach(() => { vi.stubGlobal("document", { body: {} }); });

  const at = (html: string, needle: string) => {
    const index = html.indexOf(needle);
    expect(index, needle).toBeGreaterThan(-1);
    return index;
  };
  /** Layer, companion slot, crumb, then the dialog box, its title and body; the box claims the slot. Returns the box's tag. */
  function expectCompanion(html: string, lang: "en" | "he", testid: string, body: string): string {
    const order = [
      at(html, "data-arbor-dialog-layer"),
      at(html, `${DIALOG_COMPANION}=""`),
      at(html, `<nav aria-label="${translate(lang, "nav.crumb.aria")}" data-testid="${testid}"`),
      at(html, "</nav>"),
      at(html, 'role="dialog"'),
      at(html, "<h3"),
      at(html, body),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html.match(/<nav /g)).toHaveLength(1);
    expect(html.match(/data-testid="(?:topbar|mobile)-crumb"/g)).toHaveLength(1);
    const slot = new RegExp(`<div id="([^"]+)" ${DIALOG_COMPANION}="" class="([^"]*)" style="([^"]*)"`).exec(html);
    expect(slot).not.toBeNull();
    const [, id, cls, style] = slot!;
    for (const c of ["pointer-events-none", "absolute", "inset-0"]) expect(cls.split(" ")).toContain(c);
    expect(style).toBe("z-index:1");
    const box = html.match(/<div [^>]*role="dialog"[^>]*>/)?.[0] ?? "";
    expect(box).toContain(`aria-owns="${id}"`);
    expect(box).toContain('aria-modal="true"');
    expect(box).toContain("bg-white");
    // The clinical firewall's render checks read any percentage as a score:
    // the crumb and the box height it added carry none. (Sheet's own shadow
    // ink mix predates IA-06r and is not this change's to rewrite.)
    expect(html.slice(html.indexOf("<nav "), html.indexOf("</nav>"))).not.toMatch(/\d+\s?%/);
    const maxHeight = /max-height:([^;"]*)/.exec(box)?.[1] ?? "";
    expect(maxHeight).toContain("100dvh");
    expect(maxHeight).not.toMatch(/\d+\s?%/);
    return box;
  }

  it.each(["en", "he"] as const)("the portrait selection on #/development, lg+ (%s): over the top bar title, and the box starts below it", (lang) => {
    state.lang = lang; state.activeTab = "development";
    const html = renderToStaticMarkup(
      <Modal open onClose={() => {}} title="Mornings at home" maxWidth="max-w-2xl" companion={<SheetBreadcrumb label="Mornings at home" close={vi.fn()} />}>
        <div className="portrait-evidence">body</div>
      </Modal>,
    );
    const box = expectCompanion(html, lang, "topbar-crumb", 'class="portrait-evidence"');
    expect(box).toContain("max-height:min(90vh, calc(100dvh - max(1rem, var(--arbor-crumb-inset, 0px)) - 1rem))");
    const layer = html.match(/<div [^>]*data-arbor-dialog-layer[^>]*>/)?.[0] ?? "";
    expect(layer).toContain("bg-black/60");
    expect(layer).toContain("padding-top:max(1rem, var(--arbor-crumb-inset, 0px))");
    expect(levelsOf(html).map(l => l.label)).toEqual(lang === "he" ? ["הילד שלי", "מפת התפתחות", "Mornings at home"] : ["My child", "Development map", "Mornings at home"]);
  });

  it.each(["en", "he"] as const)("the question sheet at 390 (%s): the strip under the phone header, and the sheet's top edge stays below it", (lang) => {
    state.lang = lang; state.compact = true;
    const html = renderToStaticMarkup(
      <Sheet open onClose={() => {}} title={translate(lang, "companion.family-topic-sheet.what-we-re-exploring")} companion={<SheetBreadcrumb label={QUESTION} close={vi.fn()} />}>
        <div className="topic-sheet">body</div>
      </Sheet>,
    );
    const box = expectCompanion(html, lang, "mobile-crumb", 'class="topic-sheet"');
    expect(box).toContain("max-height:min(88vh, calc(100dvh - var(--arbor-crumb-inset, 0px)))");
    expect(levelsOf(html).map(l => l.label)).toEqual([lang === "he" ? "עכשיו" : "Now", QUESTION]);
  });

  it("the question sheet at 1920 (it is a sheet at every width): the top bar crumb", () => {
    const html = renderToStaticMarkup(
      <Sheet open onClose={() => {}} title="x" companion={<SheetBreadcrumb label={QUESTION} close={vi.fn()} />}>
        <div className="topic-sheet">body</div>
      </Sheet>,
    );
    expectCompanion(html, "en", "topbar-crumb", 'class="topic-sheet"');
  });

  it("without a companion the dialogs are as they were: no slot, no aria-owns, no crumb", () => {
    const html = renderToStaticMarkup(<Modal open onClose={() => {}} title="x"><p>body</p></Modal>)
      + renderToStaticMarkup(<Sheet open onClose={() => {}} title="x"><p>body</p></Sheet>);
    expect(html).not.toContain(DIALOG_COMPANION);
    expect(html).not.toContain("aria-owns");
    expect(html).not.toContain("<nav");
  });

  it("with no sheet open, no crumb renders", () => {
    const sheet = renderToStaticMarkup(<Sheet open={false} onClose={() => {}} title="x" companion={<SheetBreadcrumb label={QUESTION} close={vi.fn()} />}><p>body</p></Sheet>);
    const modal = renderToStaticMarkup(<Modal open={false} onClose={() => {}} title="x" companion={<SheetBreadcrumb label={QUESTION} close={vi.fn()} />}><p>body</p></Modal>);
    expect(sheet + modal).not.toContain("<nav");
    expect(sheet + modal).not.toMatch(/topbar-crumb|mobile-crumb/);
  });
});

describe("IA-06r · wiring (source pins)", () => {
  const read = (rel: string) => readFileSync(path.join(__dirname, "..", "..", rel), "utf8");
  const ordered = (src: string, ...needles: string[]) => {
    const at = needles.map(needle => src.indexOf(needle));
    expect(at.every(index => index > -1), needles.join(" | ")).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  };

  it("the top bar holds the anchor and steps its title aside; it renders no crumb and owns no history", () => {
    const topbar = read("components/layout/Topbar.tsx");
    expect(topbar).toContain('data-crumb-anchor="bar"');
    expect(topbar).toContain('import { useSheetCrumbShown } from "../../hooks/useSheetCrumbShown"');
    expect(topbar).toContain('crumbShown ? " invisible" : ""');
    expect(topbar).toContain('data-testid="topbar-home-title"');
    expect(topbar).not.toMatch(/SheetBreadcrumb|topbar-crumb|useSheetHistory|from "\.\/Breadcrumb"/);
    expect(topbar).toMatch(/className="[^"]*\bhidden lg:flex\b/);
  });

  it("the phone header holds the strip's anchor, and both anchors switch at the dialogs' own lg breakpoint", () => {
    expect(read("components/layout/ChildContextHeader.tsx")).toContain('<header data-crumb-anchor="strip"');
    expect(read("components/layout/Shell.tsx")).toMatch(/<ChildContextHeader\s+className="lg:hidden"/);
    expect(read("components/ui/Sheet.tsx")).toContain('const COMPACT_QUERY = "(max-width: 1023.98px)";');
  });

  it("the shell gains no crumb, no history and no second listener for FEAT-05's event", () => {
    const shell = read("components/layout/Shell.tsx");
    expect(shell).not.toMatch(/Breadcrumb|useSheetHistory|useSheetCrumbShown/);
    expect(shell.match(/addEventListener\(FAMILY_TOPIC_SHEET_EVENT/g)).toHaveLength(1);
  });

  it("the dialogs draw the companion in their layer ahead of the box, and the box claims it", () => {
    // The JSX attribute lines, not Sheet's doc comment that names both.
    const line = (src: string, re: RegExp) => { const m = re.exec(src); expect(m, String(re)).not.toBeNull(); return m!.index; };
    for (const file of ["components/ui/Modal.tsx", "components/ui/Sheet.tsx"]) {
      const src = read(file);
      const order = [
        line(src, /^\s*data-arbor-dialog-layer\s*$/m),
        line(src, /^\s*\{companion && <DialogCompanion id=\{companionId\}>\{companion\}<\/DialogCompanion>\}\s*$/m),
        line(src, /^\s*role="dialog"\s*$/m),
      ];
      expect(order, file).toEqual([...order].sort((a, b) => a - b));
      expect(src).toContain("aria-owns={companion ? companionId : undefined}");
    }
    expect(read("components/ui/DialogCompanion.tsx")).toContain(`${DIALOG_COMPANION}=""`);
    expect(DIALOG_COMPANION).toBe("data-dialog-companion");
  });

  it("the question sheet: the crumb is its companion, outside its body, and every way out goes through its one close", () => {
    const sheet = read("components/companion/FamilyTopicSheet.tsx");
    ordered(sheet, "<Sheet open onClose={() => close()}", "companion={<SheetBreadcrumb label=", '<div className="topic-sheet"');
    expect(sheet.match(/<SheetBreadcrumb\b/g)).toHaveLength(1);
    expect(sheet).toContain("useSheetHistory(true, onClose)");
    expect(sheet).not.toMatch(/onClose\(\);\s*setActiveTab\(/);
    expect(sheet).toContain('close(() => setActiveTab("development"))');
  });

  it("the portrait selection: the same, and only the seam clears the selection", () => {
    const portrait = read("components/companion/ChildPortrait.tsx");
    ordered(portrait, "<Modal open={!!selected} onClose={() => closeSelection()}", "companion={<SheetBreadcrumb label={selected", '<div className="portrait-evidence"');
    expect(portrait.match(/<SheetBreadcrumb\b/g)).toHaveLength(1);
    expect(portrait).toContain("useSheetHistory(!!selected, () => setSelection(null))");
    expect(portrait.match(/setSelection\(null\)/g)).toHaveLength(1);
  });

  it("the domain sheet: one entry, its crumb, and each door that leaves runs once that entry is gone", () => {
    const domain = read("components/companion/DomainSheet.tsx");
    expect(domain).toContain("const close = useSheetHistory(domain !== null, onClose);");
    expect(domain).toContain("onClose={() => close()}");
    expect(domain).toContain("companion={domain ? <SheetBreadcrumb label={domainName(domain, t)} close={close} /> : undefined}");
    expect(domain).toContain("onCheck={() => close(onCheck)}");
    expect(domain).toContain("onExplore={() => close(() => onExplore(domain))}");
    expect(domain).toContain("onOpenMoments={() => close(() => onOpenMoments(domain))}");
  });

  it("the Learn reader keeps its own history marker, untouched", () => {
    const learn = read("components/sections/LearnLibrary.tsx");
    expect(learn).toContain('window.history.pushState({ ...(window.history.state ?? {}), arborLearnCard: id }, "", window.location.href);');
    expect(learn).not.toContain("useSheetHistory");
  });

  it("the separator glyph is in the shipped icon subset (the subset itself is not this item's to change)", () => {
    const subset = readFileSync(path.join(__dirname, "..", "..", "..", "public", "fonts", "material-symbols-rounded-subset.icons.txt"), "utf8");
    expect(subset.split(/\r?\n/).map(line => line.trim())).toContain("chevron_right");
  });
});
