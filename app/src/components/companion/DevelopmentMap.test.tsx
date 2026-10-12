import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import type { Milestone } from "../../types";

/* v3 F-CHILD-1 — "Milestones across areas" on the Milestones pill. Catalogue
   rows and invented observations only; no child data. Counts only: the one
   number is the Seen-it count (CountPips, VIS-02, and the one neutral chip);
   a blank area says "No record yet"; nothing has a denominator or a bar. */

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
import { DOMAIN_IDS, domainName } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { translate } from "../../lib/i18n";
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
/** One row's markup, from its button to the next row (or the card's foot). */
const rowOf = (html: string, domain: DomainId) => {
  const start = html.indexOf(`data-testid="dev-map-row" data-domain="${domain}"`);
  const next = html.indexOf('data-testid="dev-map-row"', start + 1);
  return html.slice(start, next === -1 ? html.indexOf('class="dev-map-foot"') : next);
};
const render = (props: Partial<React.ComponentProps<typeof DevelopmentMap>> = {}) => {
  state.buttons = [];
  return renderToStaticMarkup(
    <DevelopmentMap milestones={[]} observations={[]} momentText={o => o.id} openDomain={null} onToggle={vi.fn()} onCheck={vi.fn()} nowMs={NOW} {...props} />,
  );
};

beforeEach(() => { state.lang = "en"; state.buttons = []; });

describe("v3 F-CHILD-1 — DevelopmentMap rows", () => {
  it.each(["en", "he"] as const)("eight closed rows in registry order, a list, each with its glyph and a turning chevron (%s)", lang => {
    state.lang = lang;
    const html = render();
    expect(html).toMatch(/<ul class="dev-map-rows" role="list">/);
    expect([...html.matchAll(/data-testid="dev-map-row" data-domain="([a-z]+)" aria-expanded="false"/g)].map(m => m[1])).toEqual([...DOMAIN_IDS]);
    expect(html).not.toContain("aria-controls");
    for (const d of DOMAIN_IDS) {
      const row = rowOf(html, d);
      expect(row).toContain(`>${DOMAIN_ICONS[d]}</span>`);
      expect(row).toContain(esc(domainName(d, (key: string) => translate(lang, key))));
      // The chevron turns when the row opens; it is not a direction, so it never mirrors.
      expect(row).toMatch(/class="msr dev-map-chevron"[^>]*>expand_more</);
      expect(row).not.toContain("rtl:-scale-x-100");
      expect(row).toContain(esc(translate(lang, "companion.devMap.none")));
    }
    for (const key of ["companion.milestones.mapKicker", "companion.milestones.areasTitle", "companion.milestones.areasSub", "companion.milestones.check", "companion.milestones.lastMoment", "companion.devMap.note", "elev.loop.ms.footer"]) {
      expect(html, key).toContain(esc(translate(lang, key)));
    }
    expect(html).toMatch(/<section class="dev-map" data-testid="dev-map" aria-labelledby="([^"]+)">[\s\S]*?<h2 id="\1">/);
    expect(html).not.toContain("data-module");
    expect(html).not.toContain("data-primary-move");
  });

  it("the one number is Seen it: Sleep and Food fold into body, Not yet adds nothing anywhere", () => {
    const by = groupMilestonesByShelf(catalogue());
    const notYet = new Set(by.words.slice(0, 3).map(m => m.id));
    const ms = [...catalogue().map(m => (m.id === by.food[0].id ? seen(m) : notYet.has(m.id) ? { ...m, observationStatus: "not_yet" as const } : m)), seen(PARENT_SLEEP)];
    const html = render({ milestones: ms });
    const body = rowOf(html, "body");
    expect(body).toContain('data-testid="count-pips" data-domain="body"');
    expect(body).toMatch(/class="arbor-pips-n"[^>]*>2</);
    expect(body).not.toContain('data-testid="dev-map-none"');
    // Talking carries three Not yet answers and still reads as no record: never a not-yet number.
    expect(rowOf(html, "talking")).toContain('data-testid="dev-map-none"');
    expect(rowOf(html, "talking")).not.toContain("count-pips");
    expect(html.match(/data-testid="count-pips"/g)).toHaveLength(1);
    expect(html.match(/data-testid="dev-map-none"/g)).toHaveLength(7);
    // The head's one chip is the same Seen-it count, with no total beside it.
    const chip = html.match(/<span class="dev-map-chip" data-testid="dev-map-seen">[\s\S]*?<\/span><\/span>/)?.[0] ?? "";
    expect(words(chip).replace(/\s+/g, " ").trim()).toBe(`2 ${translate("en", "companion.milestones.seenHeader")}`);
    expect(words(html)).not.toMatch(/%|\//);
  });

  it("with nothing seen there is no chip and no number at all", () => {
    const html = render({ milestones: catalogue() });
    expect(html).not.toContain('data-testid="dev-map-seen"');
    expect(html).not.toContain("count-pips");
    // The check's own label names its length ("a 5-minute check"); nothing about the child is a number.
    expect(words(html.replace(/<button type="button" class="dev-map-check"[\s\S]*?<\/button>/, ""))).not.toMatch(/\d/);
  });

  it.each(["en", "he"] as const)("CLINICAL FIREWALL: no share, no denominator, no 'n of m' anywhere in the card (%s)", lang => {
    state.lang = lang;
    const by = groupMilestonesByShelf(catalogue());
    const marked = new Set([...by.words.slice(0, 4), ...by.moving.slice(0, 3), ...by.hands.slice(0, 2)].map(m => m.id));
    const ms = catalogue().map(m => (marked.has(m.id) ? seen(m, "2026-06-10T10:00:00.000Z") : { ...m, observationStatus: "not_yet" as const }));
    const text = words(render({ milestones: ms, observations: [moment("a", ["talking"], "2026-06-01T10:00:00.000Z")], recheckDueAt: "2026-09-01T10:00:00.000Z" }));
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(text).not.toMatch(/\bof\s+\d+|\d+\s+of\s+\d+|\d+\s+מתוך\s+\d+|מתוך\s+\d+/);
  });

  it("each row quotes the newest moment the parent kept in that area; practice and professional entries stay off the map", () => {
    const observations = [
      moment("old-talk", ["talking"], "2026-03-01T10:00:00.000Z"),
      moment("new-talk", ["talking", "feelings"], "2026-04-02T10:00:00.000Z"),
      moment("kid-move", ["moving"], "2026-05-01T10:00:00.000Z", "kid_practice"),
      moment("pro-hands", ["hands"], "2026-05-01T10:00:00.000Z", "professional_entered"),
    ];
    const momentText = vi.fn((o: Observation) => `words of ${o.id}`);
    const html = render({ observations, momentText });
    expect(rowOf(html, "talking")).toContain("words of new-talk");
    expect(rowOf(html, "talking")).not.toContain("words of old-talk");
    expect(rowOf(html, "talking")).toMatch(/<time datetime="2026-04-02T10:00:00\.000Z">/i);
    expect(rowOf(html, "feelings")).toContain("words of new-talk");
    for (const d of ["moving", "hands", "thinking"] as const) expect(rowOf(html, d)).not.toContain('data-testid="dev-map-last"');
    expect(html.match(/data-testid="dev-map-last"/g)).toHaveLength(2);
    // A row that quotes a kept moment never says "No record yet" over it, even with no Seen-it skill.
    for (const d of ["talking", "feelings"] as const) {
      expect(rowOf(html, d)).not.toContain("count-pips");
      expect(rowOf(html, d)).not.toContain('data-testid="dev-map-none"');
    }
    expect(html.match(/data-testid="dev-map-none"/g)).toHaveLength(6);
  });

  it("a Seen-it skill is quoted only on the row that counts it", () => {
    // A motor row the record files under Moving AND Hands; the count puts it on the Moving shelf.
    const row = catalogue().find(m => m.domain === "sensory_motor_patterns" && !m.tags?.length)!;
    const marked: Milestone = { ...seen(row), observedAt: "2026-05-01T10:00:00.000Z" };
    const observations = toObservations({ milestones: [marked] }, { id: "child-a" });
    expect(observations).toHaveLength(1);
    expect(observations[0].domains).toContain("moving");
    expect(observations[0].domains).toContain("hands");
    const html = render({ milestones: [marked], observations, momentText: o => `words of ${o.id}` });
    expect(DOMAIN_IDS.filter(d => rowOf(html, d).includes('data-testid="count-pips"'))).toEqual(["moving"]);
    expect(rowOf(html, "moving")).toContain(`words of milestones:${row.id}`);
    expect(rowOf(html, "hands")).not.toContain('data-testid="dev-map-last"');
    expect(rowOf(html, "hands")).toContain('data-testid="dev-map-none"');
    expect(html.match(/data-testid="dev-map-last"/g)).toHaveLength(1);
    expect(html.match(/data-testid="dev-map-none"/g)).toHaveLength(7);
  });
});

describe("v3 F-CHILD-1 — one open row", () => {
  const probe = (domain: DomainId, id: string) => <div data-testid="detail-probe" data-for={domain} id={id} />;

  it("the open row is expanded and controls its inline body; every other row stays closed with no body", () => {
    const html = render({ openDomain: "talking", renderDetail: probe });
    const open = html.match(/data-testid="dev-map-row" data-domain="talking" aria-expanded="true" aria-controls="([^"]+)"/);
    expect(open).not.toBeNull();
    expect(html.match(/data-testid="detail-probe"/g)).toHaveLength(1);
    expect(html).toContain(`data-testid="detail-probe" data-for="talking" id="${open![1]}"`);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html.match(/aria-controls=/g)).toHaveLength(1);
    // The body sits under its own row, inside the same list item.
    expect(rowOf(html, "talking")).toContain('class="dev-map-detail"');
    expect(html).toMatch(/<li class="dev-map-item" data-open="true">/);
  });

  it("on a phone (no inline body) the open row still says it is open, and points nowhere", () => {
    const html = render({ openDomain: "moving" });
    expect(html).toContain('data-testid="dev-map-row" data-domain="moving" aria-expanded="true"');
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain('class="dev-map-detail"');
  });

  it("a row toggles its own area; the check opens the 5-minute check", () => {
    const onToggle = vi.fn(), onCheck = vi.fn();
    render({ onToggle, onCheck });
    for (const d of DOMAIN_IDS) state.buttons.find(b => b["data-testid"] === "dev-map-row" && b["data-domain"] === d)!.onClick!();
    expect(onToggle.mock.calls.map(c => c[0])).toEqual([...DOMAIN_IDS]);
    state.buttons.find(b => b["data-testid"] === "dev-map-check")!.onClick!();
    expect(onCheck).toHaveBeenCalledOnce();
  });

  it("the page's primary-move stamp lands on the check button, once", () => {
    const html = render({ primaryMoveProps: { "data-primary-move": "start-development-check" } });
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toMatch(/<button type="button" class="dev-map-check" data-testid="dev-map-check" data-primary-move="start-development-check">/);
    expect(state.buttons.find(b => b["data-testid"] === "dev-map-check")!["data-primary-move"]).toBe("start-development-check");
  });
});

describe("v3 F-CHILD-1 — the card's foot", () => {
  it.each(["en", "he"] as const)("names the areas with a new Seen it in the last 30 days, names only (%s)", lang => {
    state.lang = lang;
    const by = groupMilestonesByShelf(catalogue());
    const recentWord = by.words[0].id, recentMove = by.moving[0].id, oldHands = by.hands[0].id;
    const ms = catalogue().map(m => (m.id === recentWord ? seen(m, "2026-06-10T10:00:00.000Z")
      : m.id === recentMove ? seen(m, "2026-05-20T10:00:00.000Z")
      : m.id === oldHands ? seen(m, "2026-03-01T10:00:00.000Z") : m));
    const html = render({ milestones: ms });
    const line = html.match(/<p class="dev-map-growing" data-testid="dev-map-growing">[\s\S]*?<\/p>/)?.[0] ?? "";
    const t = (key: string) => translate(lang, key);
    expect(line).toContain(esc(t("companion.milestones.growing")));
    expect(line).toContain(esc(domainName("talking", t)));
    expect(line).toContain(esc(domainName("moving", t)));
    expect(line).not.toContain(esc(domainName("hands", t)));
    expect(words(line)).not.toMatch(/\d/);
    // The growing line comes first, then the blank-means-no-record note, then the record line.
    expect(html.indexOf('data-testid="dev-map-growing"')).toBeLessThan(html.indexOf('data-testid="dev-map-note"'));
    expect(html.indexOf('data-testid="dev-map-note"')).toBeLessThan(html.indexOf('data-testid="dev-map-record"'));
  });

  it("is hidden when no area has a new Seen it this month", () => {
    const by = groupMilestonesByShelf(catalogue());
    const ms = catalogue().map(m => (m.id === by.words[0].id ? seen(m, "2026-01-10T10:00:00.000Z") : m));
    const html = render({ milestones: ms });
    expect(html).not.toContain('data-testid="dev-map-growing"');
    expect(html).toContain('data-testid="dev-map-note"');
  });

  it("the Development Check's re-check date is plain text under the heading, in neutral ink", () => {
    const html = render({ recheckDueAt: "2026-09-01T10:00:00.000Z" });
    const line = html.match(/<p class="dev-map-recheck" data-testid="dev-map-recheck">([^<]*)<\/p>/);
    expect(line).not.toBeNull();
    expect(line![1]).not.toBe("elev.growth.recheck.date");
    expect(render()).not.toContain("dev-map-recheck");
  });
});

describe("v3 F-CHILD-1 — developmentMap.css", () => {
  const css = readFileSync(new URL("./developmentMap.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = (sel: string) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.[\]"=]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  it("rows are one grid (area, count, quote, chevron); a phone drops the quote and the column header", () => {
    expect(rule(".dev-map-row")).toMatch(/display: grid; grid-template-columns:/);
    expect(css).toMatch(/@media \(max-width: 640px\) \{[^@]*\.dev-map-quote \{ display: none; \}/);
    expect(css).toMatch(/@media \(max-width: 640px\) \{[^@]*\.dev-map-columns \{ display: none; \}/);
    expect(css).toMatch(/\.dev-map-row\[aria-expanded="true"\] \.dev-map-chevron \{ transform: rotate\(180deg\); \}/);
  });
  it("an open row lays its skills in two columns, one on a phone", () => {
    expect(rule(".area-detail-skills")).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toMatch(/@media \(max-width: 640px\) \{\s*\.area-detail-skills \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });
  it("the first two portrait cards are wide-screen only; the goal card stays", () => {
    expect(css).toMatch(/@media \(max-width: 1023\.98px\) \{[^@]*\.portrait-card-wide \{ display: none; \}/);
    expect(css).not.toMatch(/\.portrait-card-goal \{[^}]*display: none/);
  });
  it("every target keeps the 44 px floor and the layout is logical only", () => {
    for (const sel of [".dev-map-check", ".dev-map-row", ".area-detail-check", ".area-detail-explore", ".area-detail-moments", ".area-detail-later summary", ".area-detail-keep", ".area-detail-text", ".area-detail-add-input", ".area-detail-add-save", ".portrait-card-tell", ".portrait-card-goal"]) {
      expect(rule(sel), sel).toContain("min-block-size: var(--touch-min)");
    }
    expect(css).not.toMatch(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right)\s*:|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/);
  });
  it("paints no verdict: one neutral chip, no state colour, nothing that reads as a bar", () => {
    // A percentage width other than a full 100% is what a bar is made of.
    expect(css).not.toMatch(/progress|(?:width|inline-size):\s*(?!100%)\d+(?:\.\d+)?%/);
    expect(css).not.toMatch(/--arbor-(?:green|red|amber|yellow|peach|pink)/);
    expect(rule(".dev-map-chip")).toContain("background: var(--arbor-paper)");
    expect(rule(".dev-map-chip-dot")).toContain("background: var(--arbor-ink-soft)");
  });
});
