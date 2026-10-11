import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import type { Milestone } from "../../types";

/* v3 FEAT-03 — the development map at the top of My child. Catalogue rows and
   invented observations only; no child data. Counts only: the one number is
   the Seen-it count (CountPips, VIS-02); a blank area says "No record yet". */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  buttons: [] as { onClick?: () => void; "data-testid"?: string; "data-domain"?: string }[],
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
import { DOMAIN_IDS } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { translate } from "../../lib/i18n";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";

const catalogue = (): Milestone[] => ALL_MILESTONES.map(m => ({ ...m }));
const seen = (m: Milestone): Milestone => ({ ...m, checked: true, observationStatus: "yes" });
/** The catalogue carries no Sleep skill: the Sleep shelf fills from rows the
 *  parent adds (tag `sleep`, lib/shelves/registry milestoneShelf). Invented. */
const PARENT_SLEEP: Milestone = { id: "ms-sleep-own", custom: true, tags: ["sleep"], domain: "health_sleep_feeding", ageGroup: "Custom", title: "Falls asleep after one story", description: "x", checked: false };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const words = (html: string) => html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ");
const moment = (id: string, domains: DomainId[], at: string, source: Observation["source"] = "parent_typed"): Observation => ({
  id, childId: "child-a", at, domains, kind: "moment", origin: "behaviorLogs", source,
  value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: null, pretermCorrected: false,
});
/** One tile's markup, from its button to the next tile. */
const tileOf = (html: string, domain: DomainId) => {
  const start = html.indexOf(`data-testid="dev-map-tile" data-domain="${domain}"`);
  const next = html.indexOf('data-testid="dev-map-tile"', start + 1);
  return html.slice(start, next === -1 ? html.indexOf('data-testid="dev-map-note"') : next);
};
const render = (props: Partial<React.ComponentProps<typeof DevelopmentMap>> = {}) => {
  state.buttons = [];
  return renderToStaticMarkup(
    <DevelopmentMap name="Noa" milestones={[]} observations={[]} momentText={o => o.id} onOpenDomain={vi.fn()} onCheck={vi.fn()} {...props} />,
  );
};

beforeEach(() => { state.lang = "en"; state.buttons = []; });

describe("v3 FEAT-03 — DevelopmentMap", () => {
  it.each(["en", "he"] as const)("eight tiles in registry order, each with its glyph and a mirrored chevron (%s)", lang => {
    state.lang = lang;
    const html = render();
    expect([...html.matchAll(/data-testid="dev-map-tile" data-domain="([a-z]+)"/g)].map(m => m[1])).toEqual([...DOMAIN_IDS]);
    for (const d of DOMAIN_IDS) {
      const tile = tileOf(html, d);
      expect(tile).toContain(`>${DOMAIN_ICONS[d]}</span>`);
      expect(tile).toMatch(/class="msr dev-map-chevron rtl:-scale-x-100"[^>]*>chevron_right</);
      expect(tile).toContain(esc(translate(lang, "companion.devMap.none")));
    }
    expect(html).toContain(esc(translate(lang, "companion.devMap.note")));
    expect(html).toContain(esc(translate(lang, "companion.devMap.check")));
    expect(html).not.toContain("data-module");
    expect(html).not.toContain("data-primary-move");
  });

  it("the one number is Seen it: Sleep and Food fold into body, Not yet adds nothing anywhere", () => {
    const by = groupMilestonesByShelf(catalogue());
    const notYet = new Set(by.words.slice(0, 3).map(m => m.id));
    const ms = [...catalogue().map(m => (m.id === by.food[0].id ? seen(m) : notYet.has(m.id) ? { ...m, observationStatus: "not_yet" as const } : m)), seen(PARENT_SLEEP)];
    const html = render({ milestones: ms });
    const body = tileOf(html, "body");
    expect(body).toContain('data-testid="count-pips" data-domain="body"');
    expect(body).toMatch(/class="arbor-pips-n"[^>]*>2</);
    expect(body).not.toContain('data-testid="dev-map-none"');
    // Talking carries three Not yet answers and still reads as no record: never a not-yet number.
    expect(tileOf(html, "talking")).toContain('data-testid="dev-map-none"');
    expect(tileOf(html, "talking")).not.toContain("count-pips");
    expect(html.match(/data-testid="count-pips"/g)).toHaveLength(1);
    expect(html.match(/data-testid="dev-map-none"/g)).toHaveLength(7);
    expect(words(html)).not.toMatch(/%|\//);
  });

  it("each tile quotes the newest moment the parent kept in that area; practice and professional entries stay off the map", () => {
    const observations = [
      moment("old-talk", ["talking"], "2026-03-01T10:00:00.000Z"),
      moment("new-talk", ["talking", "feelings"], "2026-04-02T10:00:00.000Z"),
      moment("kid-move", ["moving"], "2026-05-01T10:00:00.000Z", "kid_practice"),
      moment("pro-hands", ["hands"], "2026-05-01T10:00:00.000Z", "professional_entered"),
    ];
    const momentText = vi.fn((o: Observation) => `words of ${o.id}`);
    const html = render({ observations, momentText });
    expect(tileOf(html, "talking")).toContain("words of new-talk");
    expect(tileOf(html, "talking")).not.toContain("words of old-talk");
    expect(tileOf(html, "talking")).toMatch(/<time datetime="2026-04-02T10:00:00\.000Z">/i);
    expect(tileOf(html, "feelings")).toContain("words of new-talk");
    for (const d of ["moving", "hands", "thinking"] as const) expect(tileOf(html, d)).not.toContain('data-testid="dev-map-last"');
    expect(html.match(/data-testid="dev-map-last"/g)).toHaveLength(2);
  });

  it("a tile opens its own area; the check opens the 5-minute check", () => {
    const onOpenDomain = vi.fn(), onCheck = vi.fn();
    render({ onOpenDomain, onCheck });
    for (const d of DOMAIN_IDS) state.buttons.find(b => b["data-testid"] === "dev-map-tile" && b["data-domain"] === d)!.onClick!();
    expect(onOpenDomain.mock.calls.map(c => c[0])).toEqual([...DOMAIN_IDS]);
    state.buttons.find(b => b["data-testid"] === "dev-map-check")!.onClick!();
    expect(onCheck).toHaveBeenCalledOnce();
  });

  it.each(["en", "he"] as const)("the heading names the child through the bidi-isolated placeholder (%s)", lang => {
    state.lang = lang;
    const html = render();
    expect(html).toContain(esc(translate(lang, "companion.devMap.title", { name: "Noa" })));
    expect(html).toMatch(/<section class="dev-map" data-testid="dev-map" aria-labelledby="([^"]+)"><div class="dev-map-head"><h2 id="\1">/);
  });
});

describe("v3 FEAT-03 — developmentMap.css", () => {
  const css = readFileSync(new URL("./developmentMap.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  it("four columns by two rows on a wide screen, two by four on a phone; never a full-width tile", () => {
    expect(css).toMatch(/\.dev-map-grid \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 640px\) \{\s*\.dev-map-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).not.toMatch(/grid-column:\s*(?:1\s*\/\s*-1|span)/);
  });
  it("every target keeps the 44 px floor and the layout is logical only", () => {
    for (const sel of [".dev-map-check", ".dev-map-tile", ".domain-sheet-actions button", ".domain-sheet-later summary"]) {
      const rule = css.match(new RegExp(`${sel.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";
      expect(rule, sel).toContain("min-block-size: var(--touch-min)");
    }
    expect(css).not.toMatch(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right)\s*:|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/);
  });
  it("paints no verdict: no colour is chosen from a count, nothing reads as a bar", () => {
    // A percentage width other than a full 100% is what a bar is made of.
    expect(css).not.toMatch(/progress|(?:width|inline-size):\s*(?!100%)\d+(?:\.\d+)?%/);
  });
});
