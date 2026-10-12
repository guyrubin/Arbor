import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* v3 F-CHILD-4 (MOB-02) — My child's doors, under a pill on a phone: Your
   journal, What Arbor remembers, the Development check and Care, each the
   place's own name and one plain line. Navigation, not content: no module, no
   primary move, no count, no badge. The memory door says in words when a
   proposal waits there. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  setActiveTab: vi.fn(),
  buttons: [] as { onClick?: () => void; "data-testid"?: string }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ setActiveTab: state.setActiveTab }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as typeof state.buttons[number]);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import ChildDoors, { CHILD_DOORS, useChildPhoneLayout, type ChildDoorsProps } from "./ChildDoors";
import { translate } from "../../lib/i18n";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
// Visible words: icon ligatures are glyphs, not text.
const words = (html: string) => html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const render = (props: ChildDoorsProps = {}) => {
  state.buttons = [];
  return renderToStaticMarkup(<ChildDoors {...props} />);
};
const doorOf = (html: string, tab: string) => {
  const start = html.indexOf(`data-testid="child-door-${tab}"`);
  return html.slice(start, html.indexOf("</button>", start));
};
const DOORS = [
  ["journal", "companion.portrait.journal", "companion.doors.journalSub"],
  ["memory", "companion.portrait.memory", "companion.doors.memorySub"],
  ["screening", "companion.doors.check", "companion.doors.checkSub"],
  ["consult", "companion.door.care", "companion.doors.careSub"],
] as const;
const SUBSET = readFileSync(new URL("../../../public/fonts/material-symbols-rounded-subset.icons.txt", import.meta.url), "utf8")
  .split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#"));

beforeEach(() => { vi.clearAllMocks(); state.lang = "en"; state.buttons = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("v3 F-CHILD-4 (MOB-02) — ChildDoors", () => {
  it.each(["en", "he"] as const)("four doors in the mock's order, each the place's own name and one plain line, in a labelled list (%s)", lang => {
    state.lang = lang;
    const html = render();
    expect(html).toContain(`<nav class="child-doors" data-testid="child-doors" aria-label="${esc(translate(lang, "companion.doors.aria"))}">`);
    expect(html).toContain('<ul class="child-doors-grid" role="list">');
    expect([...html.matchAll(/data-testid="child-door-([a-z]+)"/g)].map(m => m[1])).toEqual(DOORS.map(([tab]) => tab));
    for (const [tab, title, sub] of DOORS) {
      const door = doorOf(html, tab);
      expect(door, title).toContain(esc(translate(lang, title)));
      expect(door, sub).toContain(esc(translate(lang, sub)));
    }
    const text = words(html);
    expect(text).not.toMatch(/companion\.|elev\./);
    // No count anywhere: the mock's "12 facts · 2 proposals" is a sentence here.
    expect(text).not.toMatch(/\d/);
    expect(html).not.toMatch(/badge|data-count/);
  });

  it("every new Hebrew line is Hebrew only, and each differs from its English", () => {
    for (const key of ["companion.doors.aria", "companion.doors.check", "companion.doors.journalSub", "companion.doors.memorySub", "companion.doors.checkSub", "companion.doors.careSub", "companion.milestones.areasSubTiles"]) {
      const he = translate("he", key);
      expect(he, key).not.toBe(key);
      expect(he, key).not.toMatch(/[A-Za-z]/);
      expect(he, key).not.toBe(translate("en", key));
      expect(he, key).not.toMatch(/\//);
    }
  });

  it("each door opens its own place", () => {
    render();
    for (const [tab] of DOORS) {
      state.buttons.find(b => b["data-testid"] === `child-door-${tab}`)!.onClick!();
      expect(state.setActiveTab).toHaveBeenLastCalledWith(tab);
    }
    expect(state.setActiveTab).toHaveBeenCalledTimes(DOORS.length);
  });

  it.each(["en", "he"] as const)("a proposal waiting on #/memory: the memory door says so in words, never a number (%s)", lang => {
    state.lang = lang;
    expect(render()).not.toContain('data-testid="child-door-waiting"');
    const html = render({ memoryWaiting: true });
    expect(html.match(/data-testid="child-door-waiting"/g)).toHaveLength(1);
    const door = doorOf(html, "memory");
    expect(door).toContain('data-testid="child-door-waiting"');
    expect(door).toContain(esc(translate(lang, "companion.about.memoryWaiting")));
    expect(door).not.toContain(esc(translate(lang, "companion.doors.memorySub")));
    expect(words(door)).not.toMatch(/\d/);
  });

  it("a pill whose primary move already opens a place leaves that door out", () => {
    const html = render({ omit: "screening" });
    expect([...html.matchAll(/data-testid="child-door-([a-z]+)"/g)].map(m => m[1])).toEqual(["journal", "memory", "consult"]);
  });

  it("navigation, not content: no module, no primary move; every door a button at the 44 px floor", () => {
    const html = render({ memoryWaiting: true });
    expect(html).not.toContain("data-module");
    expect(html).not.toContain("data-primary-move");
    expect(html.match(/<button type="button" class="child-door min-h-11" data-testid="child-door-[a-z]+">/g)).toHaveLength(4);
  });

  it("every door glyph is in the shipped icon subset, and none is a direction (nothing mirrors)", () => {
    for (const door of CHILD_DOORS) expect(SUBSET, door.icon).toContain(door.icon);
    const html = render();
    expect([...html.matchAll(/<span class="msr[^"]*"[^>]*>([a-z0-9_]+)<\/span>/g)].map(m => m[1])).toEqual(CHILD_DOORS.map(door => door.icon));
    expect(html).not.toMatch(/rtl:|scale-x/);
  });
});

describe("v3 F-CHILD-4 (MOB-02) — useChildPhoneLayout", () => {
  const Probe = () => <span>{useChildPhoneLayout() ? "phone" : "wide"}</span>;
  it("reads the phone width on the first render, from one query below 768 px", () => {
    const queries: string[] = [];
    const media = (matches: boolean) => (query: string) => { queries.push(query); return { matches, media: query, addEventListener() {}, removeEventListener() {} }; };
    vi.stubGlobal("window", { matchMedia: media(true) });
    expect(renderToStaticMarkup(<Probe />)).toBe("<span>phone</span>");
    vi.stubGlobal("window", { matchMedia: media(false) });
    expect(renderToStaticMarkup(<Probe />)).toBe("<span>wide</span>");
    expect(new Set(queries)).toEqual(new Set(["(max-width: 767.98px)"]));
  });

  it("a host without matchMedia (the server, a test) reads the wide layout", () => {
    expect(renderToStaticMarkup(<Probe />)).toBe("<span>wide</span>");
    vi.stubGlobal("window", {});
    expect(renderToStaticMarkup(<Probe />)).toBe("<span>wide</span>");
  });
});

describe("v3 F-CHILD-4 (MOB-02) — childDoors.css", () => {
  const css = readFileSync(new URL("./childDoors.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = (sel: string) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.[\]"=>]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  it("two columns, an odd last door spanning the row, every door at the 44 px floor with text at the inline start", () => {
    expect(rule(".child-doors-grid")).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toContain(".child-doors-grid > li:last-child:nth-child(odd) { grid-column: 1 / -1; }");
    expect(rule(".child-door")).toContain("min-block-size: var(--touch-min)");
    expect(rule(".child-door")).toContain("text-align: start");
  });
  it("logical properties only, and no state colour", () => {
    expect(css).not.toMatch(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right)\s*:|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/);
    expect(css).not.toMatch(/--arbor-(?:green|red|amber|yellow|peach|pink)/);
  });
});
