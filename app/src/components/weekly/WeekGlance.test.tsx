import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recapWeekStartMs } from "../../hooks/useWeeklyRecap";
import { DOMAIN_IDS, type DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import { weekGlance } from "../../lib/weekGlance";

/**
 * v3 EXTRA-WEEKLY — the Weekly glance renders the report week as counts:
 * up to four tiles (a zero is left out), seven day columns with a neutral
 * glyph for the step outcome the parent recorded, a legend, a screen-reader
 * table, and only the areas that hold a record. Never a share, a ratio, a
 * trend sign or a colour that grades; no control, no move. Invented examples.
 */
const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
import WeekGlance from "./WeekGlance";
import { translate } from "../../lib/i18n";

const NOW = new Date(2026, 9, 14, 15, 0);
const START = recapWeekStartMs(NOW);
const FIRST = new Date(START);
const on = (day: number, hour: number) => new Date(FIRST.getFullYear(), FIRST.getMonth(), FIRST.getDate() + day, hour).toISOString();
let seq = 0;
function obs(over: Partial<Observation> & { at: string }): Observation {
  seq += 1;
  return {
    id: `behaviorLogs:invented-${seq}`, childId: "child-invented", domains: [] as DomainId[], kind: "moment",
    value: { type: "moment", behaviorType: "Moment" }, source: "parent_typed", origin: "behaviorLogs",
    ageAtObservationMonths: 40, pretermCorrected: false, ...over,
  } as unknown as Observation;
}
const OBSERVATIONS = [
  obs({ at: on(0, 9), domains: ["feelings"] }),
  obs({ at: on(1, 8), domains: ["family", "feelings"] }),
  obs({ at: on(1, 19) }),
  obs({ at: on(3, 12), domains: ["moving"], kind: "milestone", origin: "milestones", value: { type: "milestone", milestoneId: "m-invented", title: "Hops on one foot" } }),
  obs({ at: on(2, 18), domains: ["talking"], source: "unverified", origin: "langObs", value: { type: "word", language: "en", phrase: "ball" } }),
  obs({ at: on(0, 17), domains: ["thinking"], kind: "practice", origin: "practiceEvents", source: "kid_practice", value: { type: "practice", activity: "memory" } }),
  obs({ at: on(4, 9), domains: ["feelings"], kind: "practice", origin: "missionRecords", source: "kid_practice", value: { type: "practice", activity: "mission:invented" } }),
];
const STEPS = [
  { outcome: "helped" as const, outcomeAt: on(0, 20) },
  { outcome: "not_today" as const, outcomeAt: on(1, 9) },
  { outcome: "helped" as const, outcomeAt: on(1, 21) },
  { outcome: "somewhat" as const, outcomeAt: on(2, 20) },
];
const GLANCE = weekGlance({ observations: OBSERVATIONS, actionLoop: STEPS, now: NOW, weekStartMs: START });

const render = (lang: "en" | "he", glance = GLANCE) => {
  state.lang = lang;
  return renderToStaticMarkup(<WeekGlance glance={glance} />);
};
/** What a reader meets: glyph ligatures (aria-hidden), tags and entities out, whitespace collapsed (the screen-reader table included). */
const text = (html: string) => html
  .replace(/<span class="msr"[^>]*>[a-z_]+<\/span>/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, " ").replace(/\s+/g, " ").trim();
/** The Material Symbols ligatures rendered, in order. */
const glyphs = (html: string) => [...html.matchAll(/<span class="msr"[^>]*>([a-z_]+)<\/span>/g)].map((m) => m[1]);
const strip = (code: string) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

beforeEach(() => { state.lang = "en"; });

describe("WeekGlance (v3 EXTRA-WEEKLY)", () => {
  it("stamps its own module, carries no move and no control", () => {
    const html = render("en");
    expect(html).toContain('data-module="weekly-glance"');
    expect(html).toContain('data-testid="weekly-glance"');
    expect(html).not.toContain("data-primary-move");
    expect(html).not.toContain("data-secondary-move");
    expect(html).not.toMatch(/<button|<a\s|tabindex/i);
  });

  it("tiles: moments, steps that helped, milestones, Kid Mode sessions — at most four, a zero left out", () => {
    const html = render("en");
    expect([...html.matchAll(/data-tile="([a-z]+)"/g)].map((m) => m[1])).toEqual(["moments", "helped", "milestones", "kid"]);
    expect([...html.matchAll(/<li class="wk-glance-tile"[^>]*><b>(\d+)<\/b>/g)].map((m) => Number(m[1]))).toEqual([3, 2, 1, 2]);
    expect(html).toContain("tried on 3 days");
    const quiet = weekGlance({ observations: OBSERVATIONS.slice(3, 4), actionLoop: [], now: NOW, weekStartMs: START });
    expect([...render("en", quiet).matchAll(/data-tile="([a-z]+)"/g)].map((m) => m[1])).toEqual(["milestones"]);
    const once = weekGlance({ observations: [], actionLoop: STEPS.slice(0, 1), now: NOW, weekStartMs: START });
    expect(render("en", once)).toContain("tried on one day");
  });

  it("day by day: seven columns, the last outcome of a day as a neutral glyph (thumbs up = helped, replay = not this time)", () => {
    const html = render("en");
    expect(html.match(/class="wk-glance-day"/g)).toHaveLength(7);
    expect([...html.matchAll(/<li class="wk-glance-day"( data-outcome="([a-z-]+)")?/g)].map((m) => m[2] ?? null))
      .toEqual(["helped", "helped", "not-this-time", null, null, null, null]);
    // Strip glyphs (3 days) then the legend (2): neutral glyphs only.
    expect(glyphs(html.slice(html.indexOf("wk-glance-strip"), html.indexOf("wk-glance-legend")))).toEqual(["thumb_up", "thumb_up", "replay"]);
    expect(glyphs(html.slice(html.indexOf("wk-glance-legend"), html.indexOf("<table")))).toEqual(["thumb_up", "replay"]);
    expect(html).toMatch(/<ol class="wk-glance-strip" aria-hidden="true" style="--wk-max:2">/);
    expect(html).toContain('<i class="wk-glance-moments" style="--n:2"></i>');
    expect(html).toContain("Step helped");
    expect(html).toContain("Not this time");
    // The strip is aria-hidden; the same counts reach a screen reader as a table.
    expect(html).toMatch(/<table class="sr-only"><caption>What was kept each day this week<\/caption>/);
    expect(html.match(/<th scope="row">/g)).toHaveLength(7);
  });

  it("by area: only the areas that hold a record, in registry order, each with a plain count; then the blank line", () => {
    const html = render("en");
    const areas = [...html.matchAll(/data-area="([a-z]+)"/g)].map((m) => m[1]);
    expect(areas).toEqual(DOMAIN_IDS.filter((d) => ["feelings", "family", "moving", "talking", "thinking"].includes(d)));
    expect(html).toMatch(/data-area="feelings">[\s\S]*?<b>3<\/b>/);
    expect(html).toContain("Blank = nothing recorded this week.");
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: no share, no ratio, no trend sign anywhere in what it renders`, () => {
      const html = render(lang);
      const read = text(html);
      expect(read).not.toMatch(/%/);
      expect(read).not.toMatch(/\d\s*\/\s*\d/);
      expect(read).not.toMatch(/\+\s*\d/);
      expect(read).not.toMatch(/\d\s*(?:of|out of|מתוך)\s*\d/i);
      expect(html).not.toMatch(/role="progressbar"|aria-valuenow/);
      expect(read).toContain(translate(lang, "elev.wk.glance.days"));
      expect(read).toContain(translate(lang, "elev.wk.glance.areas.blank"));
      if (lang === "he") expect(read).not.toMatch(/[A-Za-z]/);
    });
  }

  it("a week with nothing in it renders nothing", () => {
    const empty = weekGlance({ observations: [], actionLoop: [], now: NOW, weekStartMs: START });
    expect(render("en", empty)).toBe("");
    expect(render("he", empty)).toBe("");
  });
});

describe("WeekGlance source — parent register, tokens, logical CSS", () => {
  const tsx = strip(readFileSync(new URL("./WeekGlance.tsx", import.meta.url), "utf8"));
  const css = readFileSync(new URL("./weekGlance.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("no gradient, no stamp of a move, no percentage width, no raw colour", () => {
    expect(tsx).not.toMatch(/gradient|data-primary-move|width:\s*`/);
    expect(`${tsx}\n${css}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("every colour is a token; the outcome glyph and the numbers carry no verdict colour", () => {
    expect(css).not.toMatch(/green|amber|peach|danger|success|warning|red\b/);
    expect(css).toMatch(/\.wk-glance-outcome \{[^}]*color: var\(--arbor-muted\)/);
    expect(css).toMatch(/\.wk-glance-tile b \{[^}]*color: var\(--arbor-ink\)/);
  });

  it("logical properties only: Hebrew mirrors the strip once, through the grid's own direction", () => {
    expect(css).not.toMatch(/\b(?:margin|padding|border)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/m);
    expect(tsx).not.toMatch(/rtl:|scale-x|row-reverse/);
    expect(css).toMatch(/\.wk-glance-strip \{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
  });

  it("tiles: two by two on phones, four in a row from 768 px", () => {
    expect(css).toMatch(/\.wk-glance-tiles \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(min-width: 768px\) \{\s*\.wk-glance-tiles \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
  });
});
