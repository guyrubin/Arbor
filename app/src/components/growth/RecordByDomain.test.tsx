import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Observation } from "../../lib/observations";

/* B-GROWTH-30 — "What we know about {name}, by area". Rendered EN + HE:
   a fixture child with observations in three domains shows exactly three
   rows in REGISTRY order (not count order), counts of noticed things and
   dates only — 0 "%", 0 "of {total}", 0 trend glyphs — and Hebrew names. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", obs: [] as Observation[] }));

vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Maya Cohen" }, setActiveTab: () => undefined, seedCoach: () => undefined }),
}));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => state.obs }));

import RecordByDomain from "./RecordByDomain";

const now = Date.now();
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
const ob = (id: string, domains: Observation["domains"], at: string, value: Observation["value"]): Observation => ({
  id, childId: "c1", at, domains, kind: "moment", value, source: "parent_typed", origin: "langObs",
  ageAtObservationMonths: 30, pretermCorrected: false,
});

const FIXTURE: Observation[] = [
  // body has the MOST observations, talking the fewest — registry order must win
  ob("g1", ["body"], ago(1), { type: "measurement", heightCm: 90 }),
  ob("g2", ["body"], ago(2), { type: "measurement", weightKg: 13 }),
  ob("g3", ["body"], ago(3), { type: "measurement", heightCm: 91 }),
  ob("b1", ["feelings"], ago(4), { type: "moment", behaviorType: "Transition Refusal" }),
  ob("b2", ["feelings"], ago(40), { type: "moment", behaviorType: "Transition Refusal" }),
  ob("w1", ["talking"], ago(5), { type: "word", language: "Hebrew", phrase: "עוד" }),
];

const render = (lang: "en" | "he") => {
  state.lang = lang;
  return renderToStaticMarkup(<RecordByDomain />);
};
const rowOrder = (html: string) => [...html.matchAll(/data-domain="(\w+)"/g)].map((m) => m[1]);

describe("B-GROWTH-30 — RecordByDomain", () => {
  beforeEach(() => { state.obs = FIXTURE; });

  it("three domain rows, registry order (talking, feelings, body) — not count order", () => {
    const html = render("en");
    expect(rowOrder(html)).toEqual(["talking", "feelings", "body"]);
    // W2-GROWTH r2: the Map view of the ONE Record card — DevelopmentTab
    // stamps the card; this view carries no stamp and no second heading.
    expect(html).not.toContain("data-module=");
    expect(html).not.toContain("<h2");
    expect(html).toContain("Talking &amp; understanding");
    expect(html).toContain("3 things noticed in the last 4 weeks");
    // feelings: one in the window, one older — the window count only
    expect(html).toContain("1 thing noticed in the last 4 weeks");
  });

  it("firewall: 0 %, 0 \"of {total}\", 0 trend glyphs, no per-domain colour, in EN and HE", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render(lang);
      const text = html.replace(/<[^>]+>/g, " ");
      expect(text, lang).not.toMatch(/%/);
      expect(text, lang).not.toMatch(/\bof \d+\b|מתוך/);
      expect(html, lang).not.toMatch(/trending_(up|down)|arrow_upward|arrow_downward/);
      expect(html, lang).not.toMatch(/--arbor-(coral|yellow|pink|lav|sky|mint)/);
      expect(html, lang).not.toMatch(/role="progressbar"/);
    }
  });

  it("Hebrew renders Hebrew domain names", () => {
    const html = render("he");
    for (const name of ["דיבור והבנה", "רגשות והתנהגות", "גוף, שינה ואכילה"]) expect(html).toContain(name);
    expect(html).not.toContain("Talking");
  });

  it("a domain with nothing noticed is not listed; day 0 shows one teach line and no rows", () => {
    expect(rowOrder(render("en"))).not.toContain("family");
    state.obs = [];
    const html = render("en");
    expect(rowOrder(html)).toEqual([]);
    expect(html).toContain("record-by-domain-empty");
  });
});
