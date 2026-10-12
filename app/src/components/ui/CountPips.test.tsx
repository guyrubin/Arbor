/**
 * v3 VIS-02 — CountPips (components/ui/CountPips.tsx), the count primitive for
 * a domain's record, and the domain ink it draws with.
 *
 * ORCHESTRATOR DECISION (binding): SEEN-ONLY. Filled dots plus the number as
 * text; no ring for "not yet", no half state for "not sure" (the record keeps
 * no not-yet count and no denominator: lib/milestones/shelfMap.ts). One ink per
 * domain, from DOMAIN_VARS, which iterates the registry.
 *
 * Pinned here, EN + HE, each rule with a negative control:
 *  - the dots and the number are the seen count, capped dots, full number;
 *  - one sentence for a screen reader, in the page language;
 *  - law 1: no %, no "/", no width, no total, no not-yet, no progressbar;
 *  - one colour, chosen by the domain alone (never by the count);
 *  - logical layout (the number at the inline start in Hebrew), wraps into a
 *    cluster, never a bar; not a control, so no touch target to miss.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { CountPips, PIP_CAP } from "./CountPips";
import { translate } from "../../lib/i18n";
import { DOMAIN_IDS, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_VARS } from "../../lib/tokens";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(here, "CountPips.tsx"), "utf8").replace(/\r\n/g, "\n");
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CSS = readFileSync(path.join(here, "..", "..", "index.css"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

afterEach(() => {
  state.lang = "en";
});

const render = (seen: number, domain: DomainId = "talking", size?: 7 | 8 | 10) =>
  renderToStaticMarkup(<CountPips seen={seen} domain={domain} size={size} />);
const dotCount = (html: string) => (html.match(/<span class="arbor-pip"><\/span>/g) ?? []).length;
const ariaOf = (html: string) => /aria-label="([^"]*)"/.exec(html)?.[1] ?? "";
const textOf = (html: string) => html.replace(/<[^>]+>/g, "");

/** Every way a count could reach the colour: a conditional that picks a colour
 *  or a tone, or a literal palette token (the colour must come from the domain
 *  alone, via DOMAIN_VARS). Pure, so the forbidden shapes can be fed in. */
function countDrivenColour(code: string): string[] {
  const hits: string[] = [];
  for (const m of code.matchAll(/[^;\n{}]*\?[^;\n{}]*:[^;\n{}]*/g)) {
    if (/--arbor-|\btone\b|DOMAIN_VARS|\.ink\b|\.soft\b/.test(m[0])) hits.push(m[0].trim());
  }
  for (const m of code.matchAll(/var\(--arbor-[\w-]+\)/g)) hits.push(m[0]);
  return hits;
}

/** The CSS rules that draw the pips (selector → declarations). A linear split
 *  on braces: each "}" closes the innermost rule, whose selector is the text
 *  after the previous "{" (an enclosing @media keeps its inner rule intact). */
const PIP_RULES = CSS.split("}").flatMap((chunk) => {
  const open = chunk.lastIndexOf("{");
  if (open < 0) return [];
  const selector = chunk.slice(0, open).split("{").pop()!.trim();
  return /\.arbor-pip/.test(selector) ? [{ selector, body: chunk.slice(open + 1) }] : [];
});
const ruleFor = (selector: string) => PIP_RULES.find((r) => r.selector === selector)?.body ?? "";

describe("CountPips — the seen count as the number plus filled dots", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: three seen = the digit 3, three dots, one sentence in the page language`, () => {
      state.lang = lang;
      const html = render(3);
      expect(dotCount(html)).toBe(3);
      expect(textOf(html)).toBe("3");
      expect(html).toContain('role="img"');
      const label = ariaOf(html);
      expect(label).toBe(translate(lang, "elev.pips.aria", { n: 3 }));
      expect(label).toContain("3");
      if (lang === "he") {
        expect(label).toMatch(/[֐-׿]/);
        expect(label).not.toMatch(/[A-Za-z]/);
      } else {
        expect(label).toBe("Seen so far: 3");
      }
      // the digit and the dots are hidden; the label is the one thing announced
      expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
    });
  }

  it("the sentence exists in both dictionaries and states the number only", () => {
    for (const lang of ["en", "he"] as const) {
      const s = translate(lang, "elev.pips.aria", { n: 7 });
      expect(s).not.toBe("elev.pips.aria");
      expect(s).toContain("7");
      expect(s.replace("7", "")).not.toMatch(/\d|%|\/|\{/);
    }
  });

  it("one seen is one dot; a fraction rounds down", () => {
    expect(dotCount(render(1))).toBe(1);
    expect(ariaOf(render(1))).toBe("Seen so far: 1");
    expect(dotCount(render(2.7))).toBe(2);
    expect(textOf(render(2.7))).toBe("2");
  });

  it("nothing to show renders nothing (zero, negative, NaN, Infinity): an empty row would read as a verdict", () => {
    for (const n of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) expect(render(n), String(n)).toBe("");
    // NEGATIVE CONTROL: the smallest real count does render
    expect(render(1)).not.toBe("");
  });

  it(`a long record draws at most ${PIP_CAP} dots while the number and the sentence keep the full count`, () => {
    const html = render(PIP_CAP + 9);
    expect(dotCount(html)).toBe(PIP_CAP);
    expect(textOf(html)).toBe(String(PIP_CAP + 9));
    expect(ariaOf(html)).toBe(`Seen so far: ${PIP_CAP + 9}`);
    // no "+N" overflow text either: the number already says it
    expect(html).not.toContain("+");
  });

  it("size 8 by default; 7 and 10 are carried for the stylesheet", () => {
    expect(render(2)).toContain('data-size="8"');
    expect(render(2, "talking", 7)).toContain('data-size="7"');
    expect(render(2, "talking", 10)).toContain('data-size="10"');
    expect(ruleFor('.arbor-pips[data-size="7"]')).toMatch(/--pip-size:\s*7px/);
    expect(ruleFor('.arbor-pips[data-size="10"]')).toMatch(/--pip-size:\s*10px/);
    expect(ruleFor(".arbor-pips")).toMatch(/--pip-size:\s*8px/);
  });
});

describe("CountPips — clinical firewall (law 1: counts only)", () => {
  it("the markup carries no %, no '/', no width and no progressbar, at any count", () => {
    for (const n of [1, 4, PIP_CAP, PIP_CAP + 30]) {
      for (const lang of ["en", "he"] as const) {
        state.lang = lang;
        const html = render(n, "moving");
        expect(html).not.toMatch(/%|\/(?!span>)|width|progressbar|aria-valuenow/);
      }
    }
    // NEGATIVE CONTROL: the mock's denominator and reviewed share trip the same check
    expect('<span>3<span>/5</span></span><div style="width:60%"></div>').toMatch(/%|\/(?!span>)|width/);
  });

  it("the props are the seen count, the domain and presentation only (no total, no not-yet, no not-sure)", () => {
    const props = /export interface CountPipsProps \{([\s\S]*?)\n\}/.exec(CODE)![1];
    const names = [...props.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
    expect(names).toEqual(["seen", "domain", "size", "className"]);
    expect(CODE).not.toMatch(/\b(?:total|notYet|notSure|unsure|percent|pct|ratio)\b/);
    // NEGATIVE CONTROL: the brief's pre-decision signature would be rejected
    expect("{ seen, notYet, notSure, domain }").toMatch(/\b(?:notYet|notSure)\b/);
  });

  it("no proportional-fill site and no kit progress primitive in the source", () => {
    expect(SOURCE).not.toMatch(/width:\s*`\$\{[^`]*\}%`|<ProgressBar\b|<RadialProgress\b/);
  });

  it("one colour, chosen by the domain alone: the count never reaches it", () => {
    expect(countDrivenColour(CODE)).toEqual([]);
    expect(CODE).toContain("const tone = DOMAIN_VARS[domain];");
    expect(CODE).toContain("style={{ color: tone.ink }}");
    // every dot is unstyled: it paints the wrapper's colour (currentColor)
    const html = render(5, "feelings");
    expect(html.match(/style="/g)).toHaveLength(1);
    expect(html).toContain('style="color:var(--arbor-domain-feelings-ink)"');
    expect(ruleFor(".arbor-pip")).toMatch(/background:\s*currentColor/);
    // NEGATIVE CONTROLS: per-state and per-count colours are caught
    expect(countDrivenColour('style={{ color: n >= 5 ? "var(--arbor-green-ink)" : "var(--arbor-yellow-ink)" }}')).not.toEqual([]);
    expect(countDrivenColour('<span className="arbor-pip" style={{ background: i < seen ? tone.ink : tone.soft }} />')).not.toEqual([]);
    expect(countDrivenColour('const tone = DOMAIN_VARS[n > 3 ? "moving" : domain];')).not.toEqual([]);
    expect(countDrivenColour('<span style={{ color: "var(--arbor-danger)" }} />')).not.toEqual([]);
  });

  it("every registry domain draws in its own token, and the same count looks the same in every domain but for that ink", () => {
    const shapes = new Set<string>();
    for (const id of DOMAIN_IDS) {
      const html = render(4, id);
      expect(html).toContain(`data-domain="${id}"`);
      expect(html).toContain(`style="color:${DOMAIN_VARS[id].ink}"`);
      shapes.add(html.replace(DOMAIN_VARS[id].ink, "INK").replace(`data-domain="${id}"`, ""));
    }
    expect(shapes.size).toBe(1);
  });
});

describe("CountPips — layout: logical, a cluster never a bar, not a control", () => {
  it("the stylesheet draws it with logical properties only (Hebrew needs no mirroring)", () => {
    expect(PIP_RULES.length).toBeGreaterThanOrEqual(6);
    for (const { selector, body } of PIP_RULES) {
      expect(body, selector).not.toMatch(/(?:^|[\s;])(?:left|right|float|(?:margin|padding|border)-(?:left|right)|width|height)\s*:/);
      expect(body, selector).not.toMatch(/%/);
    }
    expect(ruleFor(".arbor-pip")).toMatch(/inline-size:\s*var\(--pip-size\)/);
    expect(ruleFor(".arbor-pip")).toMatch(/block-size:\s*var\(--pip-size\)/);
    // NEGATIVE CONTROL: a physical offset trips the same scan
    expect("margin-left: 4px;").toMatch(/(?:^|[\s;])(?:left|right|float|(?:margin|padding|border)-(?:left|right)|width|height)\s*:/);
  });

  it("the dots wrap after six, so even the capped row is two short lines, never a long bar", () => {
    const dots = ruleFor(".arbor-pips-dots");
    expect(dots).toMatch(/flex-wrap:\s*wrap/);
    expect(dots).toMatch(/max-inline-size:\s*calc\(6 \* var\(--pip-size\) \+ 5 \* var\(--pip-gap\) \+ 1px\)/);
    expect(PIP_CAP).toBe(12);
  });

  it("a forced-colours user still sees the dots", () => {
    expect(CSS).toMatch(/@media \(forced-colors: active\) \{\s*\.arbor-pip \{ background: CanvasText; \}/);
  });

  it("Hebrew renders the same structure (number first = inline start = the right edge); only the sentence changes", () => {
    state.lang = "en";
    const en = render(3, "hands");
    state.lang = "he";
    const he = render(3, "hands");
    const strip = (html: string) => html.replace(/aria-label="[^"]*"/, "");
    expect(strip(he)).toBe(strip(en));
    expect(ariaOf(he)).not.toBe(ariaOf(en));
    expect(he.indexOf("arbor-pips-n")).toBeLessThan(he.indexOf("arbor-pips-dots"));
    // no dir, no row-reverse, no per-language branch in the component
    expect(CODE).not.toMatch(/\bdir\b|row-reverse|uiLang|=== "he"/);
  });

  it("read-only: no button, link, tab stop or handler (so no 44 px target to miss)", () => {
    const html = render(6);
    expect(html).not.toMatch(/<button|<a |tabindex|onclick/i);
    expect(CODE).not.toMatch(/\bon[A-Z]\w*=/);
  });
});
