import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* B-DESIGN-02 (P7-DESIGN framer decision, 7 Oct) — the three primitives of the
   chosen system, unit-pinned before any screen mounts them: ShelfGlyph (44 px
   duotone), SectionHead (kicker row), SegmentedAnswers (one 44 px three-cell
   control, EN + HE, keyboard, aria-pressed) — plus the chrome-icon props. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import { ShelfGlyph, SHELF_TONE, shelfTone } from "./ShelfGlyph";
import { SectionHead } from "./SectionHead";
import { SegmentedAnswers, segmentStep } from "./SegmentedAnswers";
import { Icon, CHROME_ICON_WEIGHT } from "./Icon";
import { NOTICE_ANSWER_KEYS, NOTICE_ANSWER_ORDER } from "../loop/NoticeCard";
import { SHELVES } from "../../lib/shelves/registry";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, f), "utf8");
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const PHYSICAL = /\b(?:ml|mr|pl|pr|left|right)-\d|\bborder-(?:l|r)\b|text-(?:left|right)\b|marginLeft|marginRight|paddingLeft|paddingRight/;

describe("ShelfGlyph — 44 px duotone, the tint names the shelf", () => {
  it("every registry shelf renders two layers of its glyph: FILL 1 jewel at 30 % under a 500 -ink outline", () => {
    for (const def of SHELVES) {
      const html = decode(renderToStaticMarkup(<ShelfGlyph shelf={def.id} />));
      const tone = SHELF_TONE[def.tint];
      expect(html).toContain(`data-shelf="${def.id}"`);
      expect(html).toContain("width:44px;height:44px");
      const layers = [...html.matchAll(/<span class="msr"[^>]*style="([^"]*)"[^>]*>([a-z_0-9]+)<\/span>/g)];
      expect(layers.map((l) => l[2])).toEqual([def.glyph, def.glyph]);
      expect(layers[0][1]).toContain("'FILL' 1");
      expect(layers[0][1]).toContain(`color:color-mix(in srgb, ${tone.jewel} 30%, transparent)`);
      expect(layers[1][1]).toContain("'wght' 500");
      expect(layers[1][1]).toContain("'FILL' 0");
      expect(layers[1][1]).toContain(`color:${tone.ink}`);
      // the .msr class forces ltr; the layers inherit the page direction
      for (const l of layers) expect(l[1]).toContain("direction:inherit");
      expect(html).toContain(`background:${tone.soft}`);
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it("on a wash the chip is white; the 36 px size keeps the duotone", () => {
    expect(decode(renderToStaticMarkup(<ShelfGlyph shelf="sleep" onWash />))).toContain("background:var(--arbor-paper-elevated)");
    expect(decode(renderToStaticMarkup(<ShelfGlyph shelf="words" size={36} />))).toContain("width:36px;height:36px");
  });

  it("every tint maps to declared tokens only (wash per jewel; hands = the paper well)", () => {
    const css = readFileSync(path.join(here, "..", "..", "index.css"), "utf8");
    for (const tone of Object.values(SHELF_TONE)) {
      for (const v of Object.values(tone)) {
        const name = /^var\((--[a-z0-9-]+)\)$/.exec(v)?.[1];
        expect(name, v).toBeTruthy();
        expect(css).toMatch(new RegExp(`${name}\\s*:`));
      }
    }
    expect(shelfTone("hands").wash).toBe("var(--arbor-paper-deep)");
    expect(shelfTone("play").wash).toBe("var(--arbor-green-wash)");
  });

  it("carries no count, answer or state input (same chip whatever the record holds) and no raw hex", () => {
    const code = src("ShelfGlyph.tsx");
    const props = /export function ShelfGlyph\(\{([^}]*)\}/.exec(code)![1];
    expect(props.replace(/\s+/g, " ").trim()).toBe("shelf, size = 44, onWash = false");
    expect(code).not.toMatch(HEX);
  });
});

describe("SectionHead — glyph + title + hairline rule, logical", () => {
  it("renders the icon, an h2 title and a flex-1 rule in both locales", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      const title = translate(lang, "elev.loop.notice.seen");
      const html = decode(renderToStaticMarkup(<SectionHead icon="visibility" title={title} sub="sub line" />));
      expect(html).toMatch(/<h2[^>]*>[^<]*<\/h2>/);
      expect(text(html)).toContain(title);
      expect(html).toContain(">visibility</span>");
      expect(html).toMatch(/data-section-rule=""[^>]*class="[^"]*flex-1/);
      expect(html).toContain("background:var(--arbor-rule)");
      expect(text(html)).toContain("sub line");
    }
    expect(renderToStaticMarkup(<SectionHead title="x" as="h3" />)).toMatch(/<h3/);
  });

  it("source: logical properties only, tokens only", () => {
    const code = src("SectionHead.tsx");
    expect(code).not.toMatch(PHYSICAL);
    expect(code).not.toMatch(HEX);
  });
});

describe("SegmentedAnswers — one 44 px three-cell control", () => {
  const render = (lang: "en" | "he", selected?: "yes" | "not_yet" | "not_sure" | null) => {
    state.lang = lang;
    return decode(renderToStaticMarkup(
      <SegmentedAnswers onAnswer={() => undefined} ariaLabel="answers" {...(selected !== undefined ? { selected } : {})} attrs={{ "data-primary-move": "x" }} />,
    ));
  };

  it("the NoticeAnswers order and keys, EN + HE, each cell >= 44 px, on a deep-well track", () => {
    expect(NOTICE_ANSWER_ORDER).toEqual(["yes", "not_yet", "not_sure"]);
    for (const lang of ["en", "he"] as const) {
      const html = render(lang);
      const cells = [...html.matchAll(/<button[^>]*data-answer="([a-z_]+)"[^>]*>([^<]*)<\/button>/g)];
      expect(cells.map((c) => c[1])).toEqual(["yes", "not_yet", "not_sure"]);
      expect(cells.map((c) => c[2])).toEqual(NOTICE_ANSWER_ORDER.map((s) => translate(lang, NOTICE_ANSWER_KEYS[s])));
      for (const c of cells) expect(c[0]).toMatch(/min-h-\[44px\]/);
      expect(html).toMatch(/role="group" aria-label="answers" data-testid="segmented-answers" data-primary-move="x"/);
      expect(html).toContain("grid-cols-3");
      expect(html).toContain("background:var(--arbor-paper-deep)");
    }
    expect(render("he")).toContain("ראיתי");
  });

  it("R1 (P7-DESIGN fix r1): resting is NEUTRAL — no cell reads pre-selected; aria-pressed only when an answer is stored", () => {
    const cellStyle = (html: string, s: string) => new RegExp(`data-answer="${s}"[^>]*style="([^"]*)"`).exec(html)![1];
    for (const lang of ["en", "he"] as const) {
      const fresh = render(lang);
      expect(fresh).not.toContain("aria-pressed");
      // three equal plain cells: the same style, no clay, no outline, no glyph
      const styles = NOTICE_ANSWER_ORDER.map((s) => cellStyle(fresh, s));
      expect(new Set(styles).size).toBe(1);
      expect(styles[0]).not.toContain("--arbor-clay");
      expect(styles[0]).not.toContain("box-shadow");
      expect(fresh).not.toContain(">check<");
    }
    const stored = render("en", "not_sure");
    expect([...stored.matchAll(/data-answer="([a-z_]+)" aria-pressed="(true|false)"/g)].map((m) => `${m[1]}:${m[2]}`))
      .toEqual(["yes:false", "not_yet:false", "not_sure:true"]);
  });

  it("R1: the pressed cell = --arbor-clay fill, on-accent label, a check glyph; the same for every answer (state, never a colour verdict)", () => {
    const cellStyle = (html: string, s: string) => new RegExp(`data-answer="${s}"[^>]*style="([^"]*)"`).exec(html)![1];
    const cell = (html: string, s: string) => new RegExp(`<button[^>]*data-answer="${s}"[^>]*>([\\s\\S]*?)</button>`).exec(html)![1];
    for (const lang of ["en", "he"] as const) {
      for (const s of NOTICE_ANSWER_ORDER) {
        const html = render(lang, s);
        const pressed = cellStyle(html, s);
        expect(pressed).toContain("background:var(--arbor-clay)");
        expect(pressed).toContain("color:var(--arbor-on-accent)");
        // pressed and resting differ in background token
        const other = NOTICE_ANSWER_ORDER.find((o) => o !== s)!;
        expect(cellStyle(html, other)).not.toContain("--arbor-clay");
        expect(cell(html, s)).toMatch(/>check<\/span>/);
        expect(cell(html, s)).toContain(translate(lang, NOTICE_ANSWER_KEYS[s]));
        expect(cell(html, other)).not.toContain(">check<");
      }
    }
    expect(cellStyle(render("en", "not_yet"), "not_yet")).toBe(cellStyle(render("en", "yes"), "yes"));
  });

  it("NEGATIVE CONTROL: the pre-R1 resting style (Seen it outlined on white) fails the neutral check", () => {
    const BEFORE = ["color:var(--arbor-clay);background:var(--arbor-paper-elevated);box-shadow:inset 0 0 0 1.5px var(--arbor-clay)", "color:var(--arbor-ink);background:transparent", "color:var(--arbor-ink);background:transparent"];
    expect(new Set(BEFORE).size).not.toBe(1);
  });

  it("keyboard: arrows move in reading order (mirrored in Hebrew), Home/End jump, other keys do nothing", () => {
    expect(segmentStep(0, "ArrowRight", false, 3)).toBe(1);
    expect(segmentStep(2, "ArrowRight", false, 3)).toBe(0);
    expect(segmentStep(0, "ArrowLeft", false, 3)).toBe(2);
    expect(segmentStep(0, "ArrowLeft", true, 3)).toBe(1);
    expect(segmentStep(1, "ArrowRight", true, 3)).toBe(0);
    expect(segmentStep(1, "Home", true, 3)).toBe(0);
    expect(segmentStep(0, "End", false, 3)).toBe(2);
    expect(segmentStep(0, "Enter", false, 3)).toBeNull();
  });

  it("source: tokens only, logical only", () => {
    const code = src("SegmentedAnswers.tsx");
    expect(code).not.toMatch(HEX);
    expect(code).not.toMatch(PHYSICAL);
  });
});

describe("Icon — chrome icons 300 outline, filled when active", () => {
  const style = (el: React.ReactElement) => decode(renderToStaticMarkup(el));
  it("chrome at rest = wght 300 FILL 0; active = FILL 1 at 500; plain icons keep 500", () => {
    expect(CHROME_ICON_WEIGHT).toBe(300);
    expect(style(<Icon name="home" chrome />)).toContain("'wght' 300, 'GRAD' 0, 'FILL' 0");
    expect(style(<Icon name="home" chrome active />)).toContain("'wght' 500, 'GRAD' 0, 'FILL' 1");
    expect(style(<Icon name="home" />)).toContain("'wght' 500, 'GRAD' 0, 'FILL' 0");
    expect(style(<Icon name="home" weight={600} fill={1} />)).toContain("'wght' 600, 'GRAD' 0, 'FILL' 1");
  });
});
