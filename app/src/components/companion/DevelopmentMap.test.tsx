import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import type { Milestone } from "../../types";

/* v10.1 — the milestone map on the Milestones pill (eight territories), and
   its check object. Catalogue rows and invented observations only; no child
   data. Counts only: the one number is the Seen-it count (on its territory
   and in the hub); a blank area says "No record yet"; nothing has a
   denominator or a bar. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  buttons: [] as { onClick?: () => void; "data-testid"?: string; "data-domain"?: string; "data-primary-move"?: string }[],
}));
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
import DevelopmentMap from "./DevelopmentMap";
import DevelopmentCheckCard from "./DevelopmentCheckCard";
import AreaTimeline, { daysBetween, onAreaLine, timelineCalendar } from "./AreaTimeline";
import { DOMAIN_IDS, domainName } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { translate } from "../../lib/i18n";
import { fmtDay } from "../../lib/formatDate";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";
import { toObservations } from "../../lib/observations";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");
const catalogue = (): Milestone[] => ALL_MILESTONES.map(m => ({ ...m }));
const seen = (m: Milestone, at?: string): Milestone => ({ ...m, checked: true, observationStatus: "yes", ...(at ? { observationUpdatedAt: at } : {}) });
/** The catalogue carries no Sleep skill: the Sleep shelf fills from rows the
 *  parent adds (tag `sleep`, lib/shelves/registry milestoneShelf). Invented. */
const PARENT_SLEEP: Milestone = { id: "ms-sleep-own", custom: true, tags: ["sleep"], domain: "health_sleep_feeding", ageGroup: "Custom", title: "Falls asleep after one story", description: "x", checked: false };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const words = (html: string) => html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const moment = (id: string, domains: DomainId[], at: string, source: Observation["source"] = "parent_typed"): Observation => ({
  id, childId: "child-a", at, domains, kind: "moment", origin: "behaviorLogs", source,
  value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: null, pretermCorrected: false,
});
/** One territory's markup, from its button to the end of that button. */
const terOf = (html: string, domain: DomainId) => {
  const start = html.indexOf(`data-testid="dev-map-tile" data-domain="${domain}"`);
  return html.slice(start, html.indexOf("</button>", start));
};
const render = (props: Partial<React.ComponentProps<typeof DevelopmentMap>> = {}) => {
  state.buttons = [];
  return renderToStaticMarkup(
    <DevelopmentMap milestones={[]} observations={[]} openDomain={null} onToggle={vi.fn()} composition="desk" nowMs={NOW} {...props} />,
  );
};
const seenFig = (html: string) => (html.match(/<b class="arbor-num" data-testid="dev-map-seen-area">(\d+)<\/b>/) ?? [])[1];

beforeEach(() => { state.lang = "en"; state.buttons = []; });

describe("v10.1 — DevelopmentMap, the index of eight areas", () => {
  it.each(["en", "he"] as const)("eight equal segments in registry order, a list, each its glyph and name; nothing recorded says so (%s)", lang => {
    state.lang = lang;
    const html = render();
    expect(html).toMatch(/<ul class="mci" role="list" aria-label="[^"]+">/);
    expect([...html.matchAll(/data-testid="dev-map-tile" data-domain="([a-z]+)" data-tone="quiet" aria-pressed="false"/g)].map(m => m[1])).toEqual([...DOMAIN_IDS]);
    for (const d of DOMAIN_IDS) {
      const ter = terOf(html, d);
      expect(ter).toContain(`>${DOMAIN_ICONS[d]}</span>`);
      expect(ter).toContain(esc(domainName(d, (key: string) => translate(lang, key))));
      expect(ter).toContain(esc(translate(lang, "companion.devMap.none")));
    }
    expect(html).toContain(esc(translate(lang, "companion.devMap.note")));
    expect(html).toContain(esc(translate(lang, "companion.milestones.areasSubTiles")));
    expect(html).not.toContain("data-module");
    expect(html).not.toContain("data-primary-move");
  });

  it("on a phone the same eight scroll sideways in one row", () => {
    const html = render({ composition: "phone" });
    expect(html).toMatch(/<ul class="mci m ds-snap-scroll" role="list"/);
    expect(html.match(/data-testid="dev-map-tile"/g)).toHaveLength(8);
  });

  it("the one number is Seen it: Sleep and Food fold into body, Not yet adds nothing anywhere", () => {
    const by = groupMilestonesByShelf(catalogue());
    const notYet = new Set(by.words.slice(0, 3).map(m => m.id));
    const ms = [...catalogue().map(m => (m.id === by.food[0].id ? seen(m) : notYet.has(m.id) ? { ...m, observationStatus: "not_yet" as const } : m)), seen(PARENT_SLEEP)];
    const html = render({ milestones: ms });
    const body = terOf(html, "body");
    expect(seenFig(body)).toBe("2");
    expect(words(body)).toContain("things seen");
    expect(body).not.toContain('data-testid="dev-map-none"');
    // Talking carries three Not yet answers and still reads as no record: never a not-yet number.
    expect(terOf(html, "talking")).toContain('data-testid="dev-map-none"');
    expect(terOf(html, "talking")).not.toContain("dev-map-seen-area");
    expect(html.match(/data-testid="dev-map-seen-area"/g)).toHaveLength(1);
    expect(html.match(/data-testid="dev-map-none"/g)).toHaveLength(7);
    expect(words(html)).not.toMatch(/%|\//);
  });

  it("one thing seen reads in the singular", () => {
    const by = groupMilestonesByShelf(catalogue());
    const html = render({ milestones: catalogue().map(m => (m.id === by.words[0].id ? seen(m) : m)) });
    expect(seenFig(terOf(html, "talking"))).toBe("1");
    expect(words(terOf(html, "talking"))).toContain("thing seen");
  });

  it("with nothing seen there is no number at all", () => {
    const html = render({ milestones: catalogue() });
    expect(html).not.toContain("dev-map-seen-area");
    expect(words(html)).not.toMatch(/\d/);
  });

  it.each(["en", "he"] as const)("CLINICAL FIREWALL: no share, no denominator, no 'n of m', no level word anywhere in the index (%s)", lang => {
    state.lang = lang;
    const by = groupMilestonesByShelf(catalogue());
    const marked = new Set([...by.words.slice(0, 4), ...by.moving.slice(0, 3), ...by.hands.slice(0, 2)].map(m => m.id));
    const ms = catalogue().map(m => (marked.has(m.id) ? seen(m, "2026-06-10T10:00:00.000Z") : { ...m, observationStatus: "not_yet" as const }));
    const text = words(render({ milestones: ms, observations: [moment("a", ["talking"], "2026-06-01T10:00:00.000Z")] }));
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(text).not.toMatch(/\bof\s+\d+|\d+\s+of\s+\d+|\d+\s+מתוך\s+\d+|מתוך\s+\d+/);
    expect(text).not.toMatch(/\b(low|medium|high|behind|ahead|on track|not yet|not sure)\b/i);
  });

  it("each segment dates the newest moment the parent kept in that area (the day only); practice and professional entries stay off", () => {
    const observations = [
      moment("old-talk", ["talking"], "2026-03-01T10:00:00.000Z"),
      moment("new-talk", ["talking", "feelings"], "2026-04-02T10:00:00.000Z"),
      moment("kid-move", ["moving"], "2026-05-01T10:00:00.000Z", "kid_practice"),
      moment("pro-hands", ["hands"], "2026-05-01T10:00:00.000Z", "professional_entered"),
    ];
    const html = render({ observations });
    expect(terOf(html, "talking")).toMatch(/<time datetime="2026-04-02T10:00:00\.000Z"/i);
    expect(terOf(html, "feelings")).toMatch(/<time datetime="2026-04-02T10:00:00\.000Z"/i);
    for (const d of ["moving", "hands", "thinking"] as const) expect(terOf(html, d)).not.toContain('data-testid="dev-map-last"');
    expect(html.match(/data-testid="dev-map-last"/g)).toHaveLength(2);
    // A segment that dates a kept moment never says "No record yet" over it.
    for (const d of ["talking", "feelings"] as const) expect(terOf(html, d)).not.toContain('data-testid="dev-map-none"');
    expect(html.match(/data-testid="dev-map-none"/g)).toHaveLength(6);
  });

  it("a Seen-it skill is counted and dated only on the area that counts it", () => {
    // A motor row the record files under Moving AND Hands; the count puts it on the Moving shelf.
    const row = catalogue().find(m => m.domain === "sensory_motor_patterns" && !m.tags?.length)!;
    const marked: Milestone = { ...seen(row), observedAt: "2026-05-01T10:00:00.000Z" };
    const observations = toObservations({ milestones: [marked] }, { id: "child-a" });
    const html = render({ milestones: [marked], observations });
    expect(DOMAIN_IDS.filter(d => terOf(html, d).includes('data-testid="dev-map-seen-area"'))).toEqual(["moving"]);
    expect(terOf(html, "moving")).toContain('data-testid="dev-map-last"');
    expect(terOf(html, "hands")).not.toContain('data-testid="dev-map-last"');
    expect(terOf(html, "hands")).toContain('data-testid="dev-map-none"');
  });

  it("the picked area is pressed and lit, the only one; a tap asks for its own area", () => {
    const onToggle = vi.fn();
    const html = render({ openDomain: "hands", onToggle });
    expect(html).toContain('data-testid="dev-map-tile" data-domain="hands" data-tone="quiet" aria-pressed="true"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/class="mcs[^"]*\bon\b[^"]*"[^>]*data-domain="hands"/);
    for (const d of DOMAIN_IDS) state.buttons.find(b => b["data-testid"] === "dev-map-tile" && b["data-domain"] === d)!.onClick!();
    expect(onToggle.mock.calls.map(c => c[0])).toEqual([...DOMAIN_IDS]);
  });

  it("one accent: no area colour, no picture and no inline paint on any segment", () => {
    const by = groupMilestonesByShelf(catalogue());
    const html = render({ milestones: catalogue().map(m => (m.id === by.words[0].id ? seen(m) : m)), openDomain: "talking" });
    for (const d of DOMAIN_IDS) {
      const ter = terOf(html, d);
      expect(ter, d).not.toMatch(/<img|--arbor-domain/);
      expect(ter.slice(0, ter.indexOf(">")), d).not.toContain("style=");
    }
  });
});

describe("v10.1 — the index's foot", () => {
  it.each(["en", "he"] as const)("names the areas with a new Seen it in the last 30 days, names only (%s)", lang => {
    state.lang = lang;
    const by = groupMilestonesByShelf(catalogue());
    const recentWord = by.words[0].id, recentMove = by.moving[0].id, oldHands = by.hands[0].id;
    const ms = catalogue().map(m => (m.id === recentWord ? seen(m, "2026-06-10T10:00:00.000Z")
      : m.id === recentMove ? seen(m, "2026-05-20T10:00:00.000Z")
      : m.id === oldHands ? seen(m, "2026-03-01T10:00:00.000Z") : m));
    const html = render({ milestones: ms });
    const line = html.match(/<p data-testid="dev-map-growing">[\s\S]*?<\/p>/)?.[0] ?? "";
    const t = (key: string) => translate(lang, key);
    expect(line).toContain(esc(t("companion.milestones.growing")));
    expect(line).toContain(esc(domainName("talking", t)));
    expect(line).toContain(esc(domainName("moving", t)));
    expect(line).not.toContain(esc(domainName("hands", t)));
    expect(words(line)).not.toMatch(/\d/);
    expect(html.indexOf('data-testid="dev-map-note"')).toBeLessThan(html.indexOf('data-testid="dev-map-growing"'));
  });

  it("is hidden when no area has a new Seen it this month", () => {
    const by = groupMilestonesByShelf(catalogue());
    const ms = catalogue().map(m => (m.id === by.words[0].id ? seen(m, "2026-01-10T10:00:00.000Z") : m));
    const html = render({ milestones: ms });
    expect(html).not.toContain('data-testid="dev-map-growing"');
    expect(html).toContain('data-testid="dev-map-note"');
  });
});

describe("v10.1 — AreaTimeline, the open area's dated line (calendar-true)", () => {
  const line = (props: Partial<React.ComponentProps<typeof AreaTimeline>> = {}) =>
    renderToStaticMarkup(<AreaTimeline domain="talking" milestones={[]} composition="desk" nowMs={NOW} {...props} />);
  const cols = (html: string) => [...html.matchAll(/class="ms-tl-leaf" style="grid-column:(\d+) \/ span 1"/g)].map(m => Number(m[1]));
  const twoSeen = () => {
    const by = groupMilestonesByShelf(catalogue());
    return catalogue().map(m => (m.id === by.words[0].id ? seen(m, "2026-06-10T10:00:00.000Z")
      : m.id === by.words[1].id ? seen(m, "2026-05-02T10:00:00.000Z")
      : m.id === by.words[2].id ? seen(m)
      : m.id === by.words[3].id ? { ...m, observationStatus: "not_yet" as const, observationUpdatedAt: "2026-06-01T10:00:00.000Z" }
      : m.id === by.moving[0].id ? seen(m, "2026-06-01T10:00:00.000Z") : m));
  };
  it("draws only dated Seen-it skills of this area, oldest first, with today at the end", () => {
    const html = line({ milestones: twoSeen() });
    const cards = html.slice(html.indexOf('class="ms-tl-cards"'));
    const dates = [...cards.matchAll(/<time datetime="([^"]+)"/gi)].map(m => m[1]);
    expect(dates).toEqual(["2026-05-02T10:00:00.000Z", "2026-06-10T10:00:00.000Z"]);
    expect(html.match(/data-testid="area-timeline-leaf"/g)).toHaveLength(2);
    expect(html).toContain('data-testid="area-timeline-today"');
    expect(html).toMatch(/data-testid="area-timeline-stats"[\s\S]*?<b class="arbor-num">2<\/b>/);
    expect(words(html)).not.toMatch(/%/);
    expect(html).not.toContain("<svg");
  });
  it("places each mark on its day: the gap between columns is the days between, written between them", () => {
    const html = line({ milestones: twoSeen() });
    const [a, b] = cols(html);
    expect(b - a).toBe(daysBetween(Date.parse("2026-05-02T10:00:00.000Z"), Date.parse("2026-06-10T10:00:00.000Z")));
    expect(b - a).toBe(39);
    expect(html).toMatch(/class="ms-tl-gap"[^>]*>39 days</);
    expect(html).toMatch(/class="ms-tl-gap"[^>]*>5 days</);
    // Negative control: equal spacing (columns one apart) would not be calendar-true.
    expect(b - a).not.toBe(1);
  });
  it("the axis is whole weeks from a week start, at least six, to today (Monday in English, Sunday in Hebrew)", () => {
    const marks = [Date.parse("2026-05-02T10:00:00.000Z"), Date.parse("2026-06-10T10:00:00.000Z")];
    const en = timelineCalendar(marks, NOW, 1);
    const he = timelineCalendar(marks, NOW, 0);
    expect(new Date(en.start).getDay()).toBe(1);
    expect(new Date(he.start).getDay()).toBe(0);
    expect(en.days).toBeGreaterThanOrEqual(42);
    expect(en.marks[1] - en.marks[0]).toBe(39);
    expect(en.start + en.marks[0] * 86_400_000).toBeLessThanOrEqual(marks[0]);
    expect(daysBetween(en.start, NOW) + 1).toBe(en.days);
    expect(timelineCalendar([], NOW, 1).days).toBeGreaterThanOrEqual(42);
  });
  it("keeps the newest five; nothing dated draws the empty weeks with No record yet", () => {
    const by = groupMilestonesByShelf(catalogue());
    const six = new Map(by.words.slice(0, 6).map((m, i) => [m.id, `2026-0${i + 1}-02T10:00:00.000Z`]));
    const html = line({ milestones: catalogue().map(m => (six.has(m.id) ? seen(m, six.get(m.id)) : m)) });
    expect(html.match(/data-testid="area-timeline-leaf"/g)).toHaveLength(5);
    expect(html).not.toContain("2026-01-02");
    const empty = line({ milestones: catalogue() });
    expect(empty).toContain('data-testid="area-timeline-none"');
    expect(empty).not.toContain("area-timeline-leaf");
    expect(empty).not.toContain("area-timeline-stats");
    expect(empty).not.toContain("ms-tl-cards");
  });
  it("a bare Seen it already on the line is not quoted again; a keepsake (the parent's words) still is", () => {
    const ms = twoSeen();
    const by = groupMilestonesByShelf(catalogue());
    const entry = (type: "milestone" | "keepsake", id: string) => ({ id: "o1", at: "2026-06-10T10:00:00.000Z", domains: ["talking"], source: "parent_typed",
      value: type === "milestone" ? { type, milestoneId: id, title: "x" } : { type, milestoneId: id, note: "x" } }) as unknown as Parameters<typeof onAreaLine>[0];
    expect(onAreaLine(entry("milestone", by.words[0].id), ms, "talking", NOW)).toBe(true);
    expect(onAreaLine(entry("keepsake", by.words[0].id), ms, "talking", NOW)).toBe(false);
    // Negative control: a Seen it that is not on this area's line is still quoted.
    expect(onAreaLine(entry("milestone", by.moving[0].id), ms, "talking", NOW)).toBe(false);
  });
  it("on a phone the same leaves are a dated list, each with the days since the one before", () => {
    const html = line({ composition: "phone", milestones: twoSeen() });
    expect(html).toMatch(/<ol class="ms-tl-list" data-testid="area-timeline">/);
    expect(html.match(/data-testid="area-timeline-leaf"/g)).toHaveLength(2);
    expect(html).toContain("39 days after");
    expect(line({ composition: "phone", milestones: catalogue() })).toContain('data-testid="area-timeline-none"');
  });
});

// v4 → v10.1: the 5-minute check is one object on the map: its name, the day
// of the latest saved check (or "not done yet"), that answers write into
// these same areas, the saved re-check day, and Start / Check again.
describe("v10.1 — DevelopmentCheckCard", () => {
  const card = (props: Partial<React.ComponentProps<typeof DevelopmentCheckCard>> = {}) => {
    state.buttons = [];
    return renderToStaticMarkup(<DevelopmentCheckCard onCheck={vi.fn()} {...props} />);
  };
  it.each(["en", "he"] as const)("never checked: its name, not done yet, Start (%s)", lang => {
    state.lang = lang;
    const html = card();
    for (const key of ["companion.milestones.checkTitle", "companion.milestones.checkNever", "companion.milestones.checkStart"]) expect(html, key).toContain(esc(translate(lang, key)));
    expect(html).not.toContain("dev-map-recheck");
  });
  it("a saved check: its day and Check again; the re-check day is plain text in the same card", () => {
    const html = card({ lastCheckAt: "2026-06-01T10:00:00.000Z", recheckDueAt: "2026-06-22T10:00:00.000Z" });
    expect(html).toContain(esc(translate("en", "companion.milestones.checkLast", { date: fmtDay("2026-06-01T10:00:00.000Z", "en") })));
    expect(html).toContain(translate("en", "companion.milestones.checkAgain"));
    expect(html).toMatch(/<span class="ms-obj-src ms-check-recheck" data-testid="dev-map-recheck">[^<]+<\/span>/);
    expect(html).not.toContain(translate("en", "companion.milestones.checkNever"));
  });
  it("Start opens the check, and the page's primary-move stamp lands on it, once", () => {
    const onCheck = vi.fn();
    const html = card({ onCheck, primaryMoveProps: { "data-primary-move": "start-development-check" } });
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toMatch(/data-testid="dev-map-check" data-primary-move="start-development-check"/);
    state.buttons.find(b => b["data-testid"] === "dev-map-check")!.onClick!();
    expect(onCheck).toHaveBeenCalledOnce();
  });
});

describe("v10.1 — milestonesV10.css and the area body's developmentMap.css", () => {
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const v10 = read("./milestonesV10.css");
  const area = read("./developmentMap.css");
  const rule = (css: string, sel: string) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.[\]"=]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  it("everything is scoped to the .ds root", () => {
    for (const line of v10.split("\n").filter(l => l.includes("{") && !l.trim().startsWith("@") && !l.trim().startsWith("}"))) {
      expect(line, line).toMatch(/\.ds/);
    }
  });
  it("one row of eight equal segments on a desk; a sideways row on a phone", () => {
    expect(rule(v10, ".ds .mci")).toContain("grid-template-columns: repeat(8, minmax(0, 1fr))");
    expect(rule(v10, ".ds .mci.m")).toContain("overflow-x: auto");
  });
  it("an open area lays its skills in two columns, one on a phone", () => {
    expect(rule(area, ".area-detail-skills")).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(area).toMatch(/@media \(max-width: 640px\) \{\s*\.area-detail-skills \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });
  it("every target keeps the 44 px floor and the layout is logical only", () => {
    for (const sel of [".area-detail-check", ".area-detail-explore", ".area-detail-moments", ".area-detail-later summary", ".area-detail-keep", ".area-detail-text", ".area-detail-add-input", ".area-detail-add-save"]) {
      expect(rule(area, sel), sel).toContain("min-block-size: var(--touch-min)");
    }
    expect(rule(v10, ".ds .vseg a")).toContain("min-height: 44px");
    expect(rule(v10, ".ds .obj .oa")).toContain("min-height: 44px");
    for (const css of [v10, area]) expect(css).not.toMatch(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right)\s*:|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/);
  });
  it("paints no verdict: no area colour, one accent, nothing reads as a bar", () => {
    for (const css of [v10, area]) {
      expect(css).not.toMatch(/progress|(?:width|inline-size):\s*(?!100%)\d+(?:\.\d+)?%/);
      expect(css).not.toMatch(/--arbor-(?:green|red|amber|yellow|peach|pink)/);
    }
    expect(v10).not.toMatch(/--ar-(?:talking|moving|hands|thinking|playing|feelings|body|family)|--arbor-domain|var\(--t[wim]\)/);
    // The lit segment is the one accent (sapphire).
    expect(rule(v10, ".ds .mcs.on")).toContain("var(--sapphire-deep)");
  });
  it("the area's newest-moment line is ruled on the inline start", () => {
    expect(rule(area, ".area-detail-last")).toContain("border-inline-start:");
    expect(rule(area, ".area-detail-last")).toContain("padding-inline-start:");
  });
});
