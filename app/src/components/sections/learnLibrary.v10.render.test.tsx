/**
 * For you, the parent › Library (v10.1, N-Library-D/M), rendered in EN and HE
 * at both compositions. What the parent's browser gets:
 *  · one <h1> (Learn Library), one primary move (the first picked read),
 *    at most four top-level modules (controls, picked, areas, shelf);
 *  · the guide's four stops match the four numbered sections, same order;
 *  · Reads · Courses, Saved and the search are in the controls;
 *  · Linked from your week lists short reads (the same rule For you used),
 *    and the Saved card says plainly when nothing is saved;
 *  · Choose an area: All plus every Learn shelf, one tap each;
 *  · Browse by area: every area with reads has "All in this area", and the
 *    shelf's own control opens every age-fit read;
 *  · no invented read-state ("Opened", "Go on reading"), no percentage.
 * The child is an invented example.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { LEARN_CATEGORIES } from "../../learn/learnLibrary";
import { FOR_YOU_COPY } from "../foryou/forYouCopy";

const DAY = 86_400_000;
const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he", composition: "desk" as "desk" | "phone", saved: [] as string[] }));

vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: { id: "child-lib", name: "Mika", birthDate: new Date(Date.now() - Math.round(3.5 * 365.25) * DAY).toISOString().slice(0, 10) },
    seedCoach: () => {},
    savedLearnIds: harness.saved,
    toggleSavedLearn: () => {},
    behaviorLogs: [],
    pendingLearnRequest: null,
    consumeLearnRequest: () => {},
    acceptTodayAction: async () => {},
    actionLoop: [],
    activeFamilyTopic: null,
  }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.locale, aiLang: harness.locale, t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars) }),
}));
vi.mock("../../hooks/useDevScore", () => ({ useDevScore: () => ({ focusDomain: null, domains: [] }) }));
vi.mock("../../hooks/useArborVoice", () => ({ useArborVoice: () => ({ supported: false, speaking: false, toggle: () => {}, stop: () => {} }) }));
vi.mock("../../design/useComposition", () => ({ useComposition: () => harness.composition }));
vi.mock("../trust/TrustLink", () => ({ TrustLink: () => <button type="button" data-testid="trust-link">How Arbor decides</button> }));
vi.mock("../../lib/analytics", () => ({ track: () => {} }));
vi.mock("motion/react", () => ({ AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: (_, tag: string) => ({ children, initial, animate, exit, transition, ...props }: any) => React.createElement(tag, props, children) }) }));

import LearnLibrary from "./LearnLibrary";

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const visibleText = (html: string) => html.replace(/<[^>]+>/g, " ");

beforeEach(() => {
  harness.locale = "en";
  harness.composition = "desk";
  harness.saved = [];
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal("window", { history: { state: null, pushState: () => {}, back: () => {} }, addEventListener: () => {}, removeEventListener: () => {}, location: { href: "" }, setTimeout });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Library v10", () => {
  for (const locale of ["en", "he"] as const) {
    for (const composition of ["desk", "phone"] as const) {
      it(`${locale} · ${composition}: one h1, one primary move, at most four modules, four stops in section order`, () => {
        harness.locale = locale;
        harness.composition = composition;
        const html = renderToStaticMarkup(<LearnLibrary />);
        expect(count(html, /<h1[\s>]/g)).toBe(1);
        expect(html).toContain(esc(translate(locale, "learn.title")));
        expect(count(html, /data-primary-move="open-learn-card"/g)).toBe(1);
        expect(count(html, /\bdata-module="/g)).toBeLessThanOrEqual(4);
        let last = -1;
        for (const id of ["lib-picked", "lib-linked", "lib-areas", "lib-browse"]) {
          expect(html).toContain(`href="#${id}"`);
          const at = html.indexOf(`id="${id}"`);
          expect(at, id).toBeGreaterThan(last);
          last = at;
        }
        expect(html).toContain(`data-composition="${composition}"`);
      });
    }

    it(`${locale}: controls, linked reads, the Saved card, area tiles and the by-area browse`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<LearnLibrary />);
      const copy = FOR_YOU_COPY[locale];
      expect(html).toContain(`placeholder="${esc(translate(locale, "learn.search"))}"`);
      expect(html).toContain(`>${esc(copy.libReads)}</button>`);
      expect(html).toContain(`>${esc(translate(locale, "learn.courses"))}</button>`);
      expect(count(html, /data-testid="learn-linked-read"/g)).toBe(3);
      expect(html).toContain(esc(translate(locale, "learn.emptySaved")));
      for (const c of LEARN_CATEGORIES) expect(html).toContain(`data-shelf="${c.id}"`);
      expect(count(html, new RegExp(esc(copy.libAllInArea), "g"))).toBeGreaterThan(1);
      expect(html).toContain('data-testid="learn-shelf-more"');
      expect(visibleText(html)).not.toMatch(/\d\s*%|Opened|Go on reading/);
    });
  }

  it("a saved read shows its count and a door to Saved", () => {
    harness.saved = ["x"];
    const html = renderToStaticMarkup(<LearnLibrary />);
    expect(html).toContain(esc(FOR_YOU_COPY.en.libSavedCount(1)));
    expect(html).toContain(esc(FOR_YOU_COPY.en.libSavedOpen));
  });
});
