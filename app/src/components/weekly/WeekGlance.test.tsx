import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recapWeekStartMs } from "../../hooks/useWeeklyRecap";
import { DOMAIN_IDS, domainName, type DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import { weekGlance } from "../../lib/weekGlance";
import { weekReportLines } from "../../lib/weekReport";

/**
 * v3 F-NOW-3 — the Weekly report's dashboard, as the v3 mock draws it (re-pin
 * of v3 EXTRA-WEEKLY's glance): ALWAYS four count tiles (edit_note, flag,
 * check_circle, sports_esports; a zero reads "—" with no sub-line), each sub
 * a count only (places, the step that helped and how often, milestones by
 * area, the Kid Mode world played); the day-by-day strip named by date beside
 * What helped and, from 768 px, the child's own words; then EVERY registry
 * area, "—" for an empty one, a neutral count chip for the rest. The only
 * control is the Milestones tile's door. Never a share, a ratio, a gain sign
 * or a colour that grades. Invented examples only.
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
  obs({ at: on(0, 9), domains: ["feelings"], value: { type: "moment", behaviorType: "Moment", context: "Home" } }),
  obs({ at: on(1, 8), domains: ["family", "feelings"], value: { type: "moment", behaviorType: "Moment", context: "Home" } }),
  obs({ at: on(1, 19), value: { type: "moment", behaviorType: "Moment", context: "School" } }),
  obs({ at: on(3, 12), domains: ["moving"], kind: "milestone", origin: "milestones", value: { type: "milestone", milestoneId: "m-invented", title: "Hops on one foot" } }),
  obs({ at: on(2, 18), domains: ["talking"], source: "unverified", origin: "langObs", value: { type: "word", language: "en", phrase: "ball" } }),
  obs({ at: on(0, 17), domains: ["thinking"], kind: "practice", origin: "practiceEvents", source: "kid_practice", value: { type: "practice", activity: "memory" } }),
  obs({ at: on(4, 9), domains: ["feelings"], kind: "practice", origin: "missionRecords", source: "kid_practice", value: { type: "practice", activity: "mission:invented" } }),
];
const NAME = "Name the feeling first";
const COUNT = "Count to five together";
const STEPS = [
  { status: "completed" as const, recommendation: NAME, outcome: "helped" as const, outcomeAt: on(0, 20) },
  { status: "completed" as const, recommendation: COUNT, outcome: "not_today" as const, outcomeAt: on(1, 9) },
  { status: "completed" as const, recommendation: NAME, outcome: "helped" as const, outcomeAt: on(1, 21) },
  { status: "completed" as const, recommendation: COUNT, outcome: "somewhat" as const, outcomeAt: on(2, 20) },
];
const report = (observations = OBSERVATIONS, actionLoop = STEPS) => ({
  glance: weekGlance({ observations, actionLoop, now: NOW, weekStartMs: START }),
  lines: weekReportLines({ observations, actionLoop, startMs: START, endMs: NOW.getTime() }),
});
const FULL = report();
const EMPTY = report([], []);

const render = (lang: "en" | "he", week = FULL, extra: { onOpenMilestones?: () => void; helpedAction?: React.ReactNode } = {}) => {
  state.lang = lang;
  return renderToStaticMarkup(<WeekGlance glance={week.glance} lines={week.lines} childFirst="Noa" {...extra} />);
};
const GLYPH = /<span class="msr[^"]*"[^>]*>([a-z0-9_]+)<\/span>/g;
/** What a reader meets: glyph ligatures out (aria-hidden), tags and entities out, whitespace collapsed. */
const text = (html: string) => html
  .replace(GLYPH, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, " ").replace(/\s+/g, " ").trim();
/** The Material Symbols ligatures rendered, in order. */
const glyphs = (html: string) => [...html.matchAll(GLYPH)].map((m) => m[1]);
/** The parent's and the child's own words sit in <bdi>; the rest is the product's copy. */
const copyOnly = (html: string) => text(html.replace(/<bdi[^>]*>[\s\S]*?<\/bdi>/g, " "));
const tiles = (html: string) => [...html.matchAll(/<(?:div|button)[^>]*class="wk-glance-tile[^"]*"[^>]*data-tile="([a-z]+)"[^>]*>([\s\S]*?)<\/(?:div|button)><\/li>/g)]
  .map((m) => ({ key: m[1], n: /<b>([^<]*)<\/b>/.exec(m[2])?.[1], sub: /<small>([\s\S]*?)<\/small>/.exec(m[2])?.[1], icon: glyphs(m[2])[0] }));
const strip = (code: string) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const tr = (lang: "en" | "he") => (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);

beforeEach(() => { state.lang = "en"; });

describe("WeekGlance (v3 F-NOW-3)", () => {
  it("stamps its own module and carries no move; without a door it has no control", () => {
    const html = render("en");
    expect(html).toContain('data-module="weekly-glance"');
    expect(html).toContain('data-testid="weekly-glance"');
    expect(html).not.toContain("data-primary-move");
    expect(html).not.toContain("data-secondary-move");
    expect(html).not.toMatch(/<button|<a\s|tabindex/i);
  });

  it("four tiles, always, in the mock's order and glyphs: a zero reads '—' with no sub-line", () => {
    const full = tiles(render("en"));
    expect(full.map((x) => [x.key, x.icon, x.n])).toEqual([
      ["moments", "edit_note", "3"], ["helped", "flag", "2"], ["milestones", "check_circle", "1"], ["kid", "sports_esports", "2"],
    ]);
    const empty = tiles(render("en", EMPTY));
    expect(empty.map((x) => [x.key, x.n, x.sub])).toEqual([
      ["moments", "—", undefined], ["helped", "—", undefined], ["milestones", "—", undefined], ["kid", "—", undefined],
    ]);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: each tile's sub-line is a count: places, the step that helped, milestones by area, the Kid Mode world`, () => {
      const t = tr(lang);
      const subs = Object.fromEntries(tiles(render(lang)).map((x) => [x.key, text(x.sub ?? "")]));
      expect(subs.moments).toBe(`${t("elev.wk.place.home", { n: 2 })} · ${t("elev.wk.place.school", { n: 1 })}`);
      expect(subs.helped).toBe(`${NAME} · ${t("elev.wk.tile.helped", { n: 2 })}`);
      expect(subs.milestones).toBe(t("elev.wk.tile.area", { area: domainName("moving", t), n: 1 }));
      expect(subs.kid).toBe(t("elev.wk.tile.sessions", { game: t("elev.practice.world.kid.memory"), n: 1 }));
    });
  }

  it("a tile with no line of its own falls back to the days it happened on (never 'n of 7')", () => {
    // One helped step with no recommendation text, a moment with no place, a milestone with no area, an unmapped Kid Mode record.
    const plain = report(
      [
        obs({ at: on(0, 9) }),
        obs({ at: on(1, 9), kind: "milestone", origin: "milestones", value: { type: "milestone", milestoneId: "m-invented-2", title: "Stacks four blocks" } }),
        obs({ at: on(2, 9), kind: "practice", origin: "missionRecords", source: "kid_practice", value: { type: "practice", activity: "mission:invented" } }),
      ],
      [{ status: "completed" as const, recommendation: "", outcome: "helped" as const, outcomeAt: on(0, 20) }],
    );
    const subs = Object.fromEntries(tiles(render("en", plain)).map((x) => [x.key, x.sub]));
    expect(subs).toEqual({ moments: "kept on one day", helped: "tried on one day", milestones: "marked on one day", kid: "played on one day" });
  });

  it("the Milestones tile is a door to the milestones page when WeeklyTab hands it one", () => {
    const html = render("en", FULL, { onOpenMilestones: () => {} });
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/<button type="button" class="wk-glance-tile wk-glance-door" data-tile="milestones" data-testid="weekly-tile-milestones">/);
    expect(tiles(html).map((x) => x.key)).toEqual(["moments", "helped", "milestones", "kid"]);
  });

  it("day by day: seven columns, the last outcome of a day as a neutral glyph (thumbs up = helped, replay = not this time)", () => {
    const html = render("en");
    expect(html.match(/class="wk-glance-day"/g)).toHaveLength(7);
    expect([...html.matchAll(/<li class="wk-glance-day"( data-outcome="([a-z-]+)")?/g)].map((m) => m[2] ?? null))
      .toEqual(["helped", "helped", "not-this-time", null, null, null, null]);
    expect(glyphs(html.slice(html.indexOf("wk-glance-strip"), html.indexOf("wk-glance-legend")))).toEqual(["thumb_up", "thumb_up", "replay"]);
    expect(glyphs(html.slice(html.indexOf("wk-glance-legend"), html.indexOf("<table")))).toEqual(["thumb_up", "replay"]);
    expect(html).toMatch(/<ol class="wk-glance-strip" aria-hidden="true" style="--wk-max:2">/);
    expect(html).toContain('<i class="wk-glance-moments" style="--n:2"></i>');
    expect(html).toContain("What happened each day");
    expect(html).toContain("Moments you kept");
    expect(html).toContain("Kid world sessions");
    expect(html).toMatch(/<table class="sr-only"><caption>What was kept each day this week<\/caption>/);
    expect(html.match(/<th scope="row">/g)).toHaveLength(7);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: each column is named by its date, in the report week's order (the week opens on a Saturday)`, () => {
      const html = render(lang);
      const locale = lang === "he" ? "he-IL" : "en-US";
      const dates = [...html.matchAll(/<span class="wk-glance-date">([^<]*)<\/span>/g)].map((m) => m[1]);
      expect(dates).toEqual(["10", "11", "12", "13", "14", "15", "16"]);
      const rows = [...html.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]);
      expect(rows).toEqual(FULL.glance.perDay.map((day) => new Date(day.startMs).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })));
    });
  }

  it("today's column is marked once; the days after it keep a dashed baseline; a past week has no today", () => {
    const days = (html: string) => [...html.matchAll(/<li class="wk-glance-day"([^>]*)>/g)].map((m) => m[1]);
    expect(FULL.glance.today).toBe(4);
    const now = days(render("en"));
    expect(now.map((attrs) => attrs.includes("data-today"))).toEqual([false, false, false, false, true, false, false]);
    expect(now.map((attrs) => attrs.includes("data-ahead"))).toEqual([false, false, false, false, false, true, true]);
    const past = days(render("en", { ...FULL, glance: { ...FULL.glance, today: 7 } }));
    expect(past.filter((attrs) => attrs.includes("data-today") || attrs.includes("data-ahead"))).toHaveLength(0);
  });

  it("What helped: the steps rated this week, newest first, each with how often it helped and on which days", () => {
    const html = render("en");
    const card = html.slice(html.indexOf('data-testid="weekly-what-helped"'), html.indexOf('data-testid="weekly-glance-areas"'));
    expect(glyphs(card)[0]).toBe("flag");
    expect(card).toContain("What helped");
    const rows = [...card.matchAll(/<li data-testid="weekly-step"([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => ({ helped: m[1].includes("data-helped"), read: text(m[2]), glyph: glyphs(m[2])[0] }));
    expect(rows).toEqual([
      { helped: false, read: `${COUNT} Not this time: 2`, glyph: "replay" },
      { helped: true, read: `${NAME} Helped 2 times · Sat, Sun`, glyph: "thumb_up" },
    ]);
    const none = render("en", EMPTY);
    expect(none).toContain("No step tried this week yet.");
    expect(none).not.toContain('data-testid="weekly-step"');
  });

  it("What helped carries the action WeeklyTab hands it, and only that", () => {
    const html = render("en", FULL, { helpedAction: <button type="button" data-testid="invented-action">Send</button> });
    const card = html.slice(html.indexOf('data-testid="weekly-what-helped"'), html.indexOf('data-testid="weekly-glance-areas"'));
    expect(card).toContain('data-testid="invented-action"');
  });

  it("the child's words: a quote chip each, under 'What {child} said this week'; no words, no card", () => {
    const html = render("en");
    const card = html.slice(html.indexOf('data-testid="weekly-words"'));
    expect(html).toMatch(/<section class="wk-glance-card wk-glance-words" data-testid="weekly-words"/);
    expect(glyphs(card)[0]).toBe("auto_awesome");
    expect(card).toContain("What Noa said this week");
    expect(card).toContain('<li dir="auto"><bdi>“ball”</bdi></li>');
    expect(render("en", EMPTY)).not.toContain("weekly-words");
  });

  it("by area: every registry area in its own row, '—' when empty, a count chip only when there is one; then the note", () => {
    const html = render("en");
    const rows = [...html.matchAll(/<li data-area="([a-z]+)"( data-empty="")?>([\s\S]*?)<\/li>/g)]
      .map((m) => ({ area: m[1] as DomainId, empty: !!m[2], n: /<b>(\d+)<\/b>/.exec(m[3])?.[1] ?? null, line: text(/<span class="wk-glance-area-line">([\s\S]*?)<\/span><\/span>/.exec(m[3])?.[1] ?? "") }));
    expect(rows.map((r) => r.area)).toEqual([...DOMAIN_IDS]);
    const n: Partial<Record<DomainId, string>> = { talking: "1", moving: "1", feelings: "2", family: "1" };
    for (const row of rows) {
      expect(row.n).toBe(n[row.area] ?? null);
      expect(row.empty).toBe(!n[row.area]);
      if (!n[row.area]) expect(row.line).toBe("—");
    }
    const line = Object.fromEntries(rows.map((r) => [r.area, r.line]));
    expect(line.moving).toBe("Hops on one foot");
    expect(line.talking).toBe("“ball”");
    expect(line.feelings).toBe(translate("en", "ql.type.moment"));
    // Kid Mode sessions (thinking) are the child's, not a record in an area.
    expect(line.thinking).toBe("—");
    expect(glyphs(html.slice(html.indexOf('data-testid="weekly-glance-areas"')))[0]).toBe("eco");
    expect(html).toContain("One line per area. Blank = nothing recorded this week.");
    const empty = render("en", EMPTY);
    expect(empty.match(/data-area="/g)).toHaveLength(DOMAIN_IDS.length);
    expect(empty.match(/data-empty=""/g)).toHaveLength(DOMAIN_IDS.length);
    expect(empty.slice(empty.indexOf('data-testid="weekly-glance-areas"'))).not.toMatch(/<b>/);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: no share, no ratio, no gain sign anywhere in what it renders; an empty week renders the frame`, () => {
      for (const week of [FULL, EMPTY]) {
        const html = render(lang, week);
        const read = text(html);
        expect(read).not.toMatch(/%/);
        expect(read).not.toMatch(/\d\s*\/\s*\d/);
        expect(read).not.toMatch(/\+\s*\d/);
        expect(read).not.toMatch(/\d\s*(?:of|out of|מתוך)\s*\d/i);
        expect(html).not.toMatch(/role="progressbar"|aria-valuenow/);
        expect(read).toContain(translate(lang, "elev.wk.glance.days"));
        expect(read).toContain(translate(lang, "elev.wk.areas.note"));
        if (lang === "he") expect(copyOnly(html)).not.toMatch(/[A-Za-z]/);
      }
    });
  }
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
    expect(css).toMatch(/\.wk-glance-areas li > b \{[^}]*color: var\(--arbor-ink\)/);
  });

  it("logical properties only: Hebrew mirrors the strip once, through the grid's own direction", () => {
    expect(css).not.toMatch(/\b(?:margin|padding|border)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/m);
    expect(tsx).not.toMatch(/rtl:|scale-x|row-reverse/);
    expect(css).toMatch(/\.wk-glance-strip \{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
  });

  it("tiles: two by two on phones, four in a row from 768 px", () => {
    expect(css).toMatch(/\.wk-glance-tiles \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(min-width: 768px\) \{\s*\.wk-glance-tiles \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  });

  it("the Milestones door keeps the 44 px touch floor", () => {
    expect(css).toMatch(/\.wk-glance-door \{[^}]*min-block-size: 44px/);
  });

  it("by area: one column on phones, two from 768 px", () => {
    expect(css).toMatch(/\.wk-glance-areas ul \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
    expect(css).toMatch(/@media \(min-width: 768px\) \{\s*\.wk-glance-areas ul \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
    expect(css).not.toMatch(/auto-fill|auto-fit/);
  });

  it("the child's words show from 768 px only (the phone merges the week into the tiles)", () => {
    expect(css).toMatch(/\.wk-glance-words \{ display: none; \}/);
    expect(css).toMatch(/@media \(min-width: 768px\) \{\s*\.wk-glance-words \{ display: block; \}/);
  });

  it("today and the days ahead are marked in ink and line style, never a colour that grades", () => {
    expect(css).toMatch(/\.wk-glance-day\[data-today\] \.wk-glance-date \{[^}]*color: var\(--arbor-ink\)/);
    expect(css).toMatch(/\.wk-glance-day\[data-ahead\] \.wk-glance-col \{ border-block-end-style: dashed; \}/);
  });
});
