/**
 * W2-CAREPRO r2 — rendered Safety (EN + HE).
 *
 * P0: an unattributed English parent (EU-wide 112 primary) must never be
 * handed Israel's ERAN 1201 as "Need to talk it through?" — the talk line
 * comes from the family's own region only, else the card offers "Find the
 * line for your country" (opens the helpline groups). HE (ERAN primary) keeps
 * the MDA 101 danger call. P1: the Hebrew script is upright in the display
 * face (no synthetic oblique); EN keeps the editorial italic. P1: at lg the
 * fold is a two-column grid; the disclosure stays outside it.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { dangerLineFor, helplineOrderFor, HELPLINE_DIRECTORY, EMERGENCY_HELPLINE_IDS } from "../../safety/escalation";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he" }));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan", age: 5 },
    requestConsultPrefill: vi.fn(),
    setActiveTab: vi.fn(),
  }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, upsert: vi.fn(), remove: vi.fn() }),
}));
vi.mock("../../lib/attribution", () => ({ loadAttribution: () => null }));
vi.mock("../../lib/analytics", () => ({ track: vi.fn() }));

import SafetyTab from "./SafetyTab";

const render = (locale: "en" | "he") => {
  harness.locale = locale;
  return renderToStaticMarkup(<SafetyTab />);
};
const crisisCard = (html: string) => html.slice(html.indexOf('data-module="safety-crisis-language"'), html.indexOf('data-module-disclosure="safety-more"'));

describe("W2-CAREPRO r2 — the talk line never crosses a border", () => {
  beforeEach(() => { harness.locale = "en"; });

  it("unit: an EU-wide 112 primary never returns a foreign-region entry (find door instead)", () => {
    const order = helplineOrderFor("en");
    const primary = HELPLINE_DIRECTORY.find((h) => h.region === order[0])!;
    expect(primary.id).toBe("eu_112");
    const line = dangerLineFor(order, primary)!;
    expect(line.kind).toBe("find");
    // every region: a talk line, when returned, is in the primary's own region
    for (const hint of ["en", "he", "nl", "be", "us", "fr", null]) {
      const o = helplineOrderFor(hint);
      const p = HELPLINE_DIRECTORY.find((h) => h.region === o[0])!;
      const l = dangerLineFor(o, p);
      if (l && l.kind === "talk") expect(l.entry.region).toBe(p.region);
    }
  });

  it("negative control: the old walk (whole order) WOULD have reached Israel's ERAN", () => {
    const order = helplineOrderFor("en");
    const walked = order.map((r) => HELPLINE_DIRECTORY.find((h) => h.region === r && !EMERGENCY_HELPLINE_IDS.has(h.id))).find(Boolean);
    expect(walked?.id).toBe("il_eran");
  });

  it("rendered EN: no 1201 / ERAN in the crisis card; the find-your-country door is there", () => {
    const card = crisisCard(render("en"));
    expect(card).not.toContain("1201");
    expect(card).not.toContain("tel:1201");
    expect(card).toContain('data-testid="safety-find-line"');
    expect(card).toContain(translate("en", "elev.safety.crisis.findLine"));
  });

  it("rendered HE: the ERAN primary keeps the MDA 101 danger call, no find door", () => {
    const card = crisisCard(render("he"));
    expect(card).toContain("tel:101");
    expect(card).not.toContain('data-testid="safety-find-line"');
  });
});

describe("W2-CAREPRO r2 — the Hebrew script is upright; the fold is two columns at lg", () => {
  const scriptTag = (html: string) => /<p data-testid="safety-crisis-script"[^>]*>/.exec(html)?.[0] ?? "";

  it("HE: no italic, the display face", () => {
    const tag = scriptTag(render("he"));
    expect(tag).not.toContain("italic");
    expect(tag).toContain("var(--font-display)");
    expect(tag).not.toContain("var(--font-editorial)");
  });

  it("EN (control): editorial italic", () => {
    const tag = scriptTag(render("en"));
    expect(tag).toContain("italic");
    expect(tag).toContain("var(--font-editorial)");
  });

  it("the fold grid holds the one tap + the crisis card; the disclosure is outside it", () => {
    const html = render("en");
    const fold = html.indexOf('data-testid="safety-fold"');
    expect(html.slice(fold, fold + 200)).toContain("lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]");
    expect(html.indexOf('data-primary-move="call-helpline"')).toBeGreaterThan(fold);
    expect(html.indexOf('data-module="safety-crisis-language"')).toBeGreaterThan(fold);
    expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
  });

  it("the H1 and subtitle carry the page's own promise (EN + HE)", () => {
    expect(render("en")).toContain("Safety &amp; urgent help");
    expect(render("en")).toContain(translate("en", "elev.safety.header.sub"));
    expect(render("he")).toContain(translate("he", "elev.safety.header.sub"));
  });
});
