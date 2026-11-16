/**
 * For you, the parent (v10.1, N-ForYou-D/M) — the hub, rendered in EN and HE
 * at both compositions, reading the markup a parent's browser would get.
 *
 * Kept from v3 EXTRA-FORYOU (rewritten for the v10 composition, never dropped):
 *  · "Picked for your question" shows only when the open family question moved
 *    the pick, and the question is quoted bidi-isolated, in the parent's ink;
 *  · the hero CTA opens today's read; one primary move; at most three
 *    top-level modules (the More to read tail is demoted, the rail behind ONE
 *    disclosure);
 *  · "Courses by area": registry areas, one control per area with aria-pressed,
 *    plain integer counts that add up to the courses on the page;
 *  · the family-ritual door ("Family formation") and the Library door;
 *  · no percentage anywhere in the visible text.
 * New in v10:
 *  · one <h1> (the pick's title); the guide's four stops match the four
 *    numbered sections, the same names and order on a phone and a desk;
 *  · Your programs: the running program as stepping stones (one stone per
 *    week, this week ringed), or the two programs to choose from;
 *  · no "Worth knowing" note on For you; short reads live in the Library.
 * Child, question and enrolment are invented examples.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { makeFamilyTopic, type FamilyTopic } from "../../lib/familyTopics";
import { LEARN_CARDS } from "../../learn/learnCards";
import { topicBoost } from "../../learn/learnLibrary";
import { topicWords } from "../../learn/topicMatch";
import { DOMAIN_IDS, domainName, type DomainId } from "../../lib/domains/registry";
import { FOR_YOU_COPY } from "../foryou/forYouCopy";
import { TALK_TOGETHER } from "../../content/programs";

const DAY = 86_400_000;
const CHILD_ID = "child-foryou";
const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  topic: null as FamilyTopic | null,
  birthDate: "",
  composition: "desk" as "desk" | "phone",
  programs: [] as unknown[],
}));

vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: { id: "child-foryou", name: "Mika", birthDate: harness.birthDate },
    behaviorLogs: [],
    savedLearnIds: [],
    requestLearnRead: () => {},
    setActiveTab: () => {},
    activeFamilyTopic: harness.topic,
  }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    aiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));
vi.mock("../../hooks/useDevScore", () => ({ useDevScore: () => ({ focusDomain: null, domains: [] }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: harness.programs, loaded: true, upsert: async () => {}, remove: async () => {} }) }));
vi.mock("../../design/useComposition", () => ({ useComposition: () => harness.composition }));
vi.mock("./AcademyForYou", () => ({ default: () => null }));
vi.mock("./ScholarHubCard", () => ({ default: () => null }));
vi.mock("../ui/EvidenceChip", () => ({ EvidenceChip: () => null, default: () => null }));
vi.mock("../ui/SpeakButton", () => ({ SpeakButton: () => null, default: () => null }));
vi.mock("../trust/TrustLink", () => ({ TrustLink: () => <button type="button" data-testid="trust-link">How Arbor decides</button> }));
vi.mock("../../lib/celebrate", () => ({ celebrate: () => {} }));
vi.mock("../../lib/analytics", () => ({ track: () => {} }));
vi.mock("motion/react", () => ({ AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: (_, tag: string) => ({ children, initial, animate, exit, transition, ...props }: any) => React.createElement(tag, props, children) }) }));

import Masterclasses from "./Masterclasses";

const QUESTION = {
  en: "How do we get through bedtime without a fight?",
  he: "איך עוברים את השינה בלי ריב?",
} as const;
/** Shares no word with any Learn read (asserted below, so the control is real). */
const UNRELATED = "Zebra kite accordion";

const ask = (title: string) => makeFamilyTopic({ id: "topic-foryou", childId: CHILD_ID, title });
const render = () => renderToStaticMarkup(<Masterclasses />);
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const visibleText = (html: string) => html.replace(/<[^>]+>/g, " ");
const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const region = (html: string, marker: string, close: string) => {
  const at = html.indexOf(marker);
  expect(at, `not rendered: ${marker}`).toBeGreaterThan(-1);
  const end = html.indexOf(close, at);
  expect(end, `unclosed: ${marker}`).toBeGreaterThan(at);
  return html.slice(html.lastIndexOf("<", at), end);
};
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  harness.locale = "en";
  harness.topic = null;
  harness.composition = "desk";
  harness.programs = [];
  harness.birthDate = new Date(Date.now() - Math.round(4.5 * 365.25) * DAY).toISOString().slice(0, 10);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("For you · the pick and the open family question", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the pick says it was picked for the question and quotes it, bidi-isolated; the hero opens a read`, () => {
      harness.locale = locale;
      harness.topic = ask(QUESTION[locale]);
      const html = render();
      const tag = region(html, 'data-testid="academy-pick-topic"', "</b>");
      expect(tag).toContain(esc(translate(locale, "elev.learnCare.pick.topicTag")));
      // The parent's own words, in ink, isolated.
      const you = region(html, 'class="knot you"', "</div>");
      expect(you).toContain(`<bdi>${esc(QUESTION[locale])}</bdi>`);
      const cta = region(html, 'data-testid="academy-hero-cta"', "</button>");
      expect(cta).toContain('data-primary-move="open-todays-pick"');
      expect(cta).toContain(esc(translate(locale, "elev.learnCare.pick.cta")));
    });

    it(`${locale}: no question, or one that moved nothing → no tag, no quote; an honest why-line instead`, () => {
      harness.locale = locale;
      for (const topic of [null, ask(UNRELATED)]) {
        harness.topic = topic;
        const html = render();
        expect(html).not.toContain('data-testid="academy-pick-topic"');
        expect(html).not.toContain('class="knot you"');
        expect(html).toContain('data-testid="academy-pick-why"');
      }
      // The control is real: the unrelated question shares no word with any read.
      expect(topicWords(UNRELATED).length).toBeGreaterThan(0);
      expect(LEARN_CARDS.filter((c) => topicBoost(c, UNRELATED) > 0)).toEqual([]);
    });
  }
});

describe("For you · the composition", () => {
  for (const locale of ["en", "he"] as const) {
    for (const composition of ["desk", "phone"] as const) {
      it(`${locale} · ${composition}: one h1, one primary move, at most three top-level modules, the rail behind one disclosure`, () => {
        harness.locale = locale;
        harness.composition = composition;
        const html = render();
        expect(count(html, /<h1[\s>]/g)).toBe(1);
        expect(count(html, /data-primary-move="/g)).toBe(1);
        const stamped = count(html, /\bdata-module="/g);
        const demoted = count(html, /\bdata-module-demoted/g);
        expect(stamped - demoted).toBeLessThanOrEqual(3);
        expect(count(html, /data-module-disclosure="/g)).toBe(1);
        expect(count(html, /<details/g)).toBe(1);
        expect(html).toContain(`data-composition="${composition}"`);
      });

      it(`${locale} · ${composition}: the guide's four stops name the four numbered sections, in the same order`, () => {
        harness.locale = locale;
        harness.composition = composition;
        const html = render();
        const copy = FOR_YOU_COPY[locale];
        // V77: the desk reads pick, courses, programs, more; the phone reads
        // pick, programs, courses, more (N-ForYou-M), with one-word stops.
        const ids = composition === "desk" ? ["fy-today", "fy-courses", "fy-programs", "fy-more"] : ["fy-today", "fy-programs", "fy-courses", "fy-more"];
        let last = -1;
        let lastHref = -1;
        for (const id of ids) {
          const href = html.indexOf(`href="#${id}"`);
          expect(href, `stop ${id}`).toBeGreaterThan(lastHref);
          lastHref = href;
          const at = html.indexOf(`id="${id}"`);
          expect(at, id).toBeGreaterThan(last);
          last = at;
        }
        const names = composition === "desk"
          ? [copy.guideToday, copy.guideCourses, copy.guidePrograms, copy.guideMore]
          : [copy.stopPick, copy.stopPrograms, copy.stopCourses, copy.stopMore];
        for (const name of names) expect(html).toContain(esc(name));
      });
    }

    it(`${locale}: courses by area — registry areas, aria-pressed, integer counts that add up to the courses shown`, () => {
      harness.locale = locale;
      const html = render();
      const group = region(html, 'data-testid="academy-by-area"', "</div>");
      const areas = [...group.matchAll(/data-area="([a-z]+)" aria-pressed="(true|false)"[^>]*><b>(\d+)<\/b><span>([^<]+)<\/span>/g)];
      expect(areas.length).toBeGreaterThan(1);
      let total = 0;
      for (const [, area, pressed, n, name] of areas) {
        expect(DOMAIN_IDS).toContain(area as DomainId);
        expect(pressed).toBe("false");
        expect(Number.isInteger(Number(n))).toBe(true);
        expect(name).toBe(esc(domainName(area as DomainId, (key) => translate(locale, key))));
        total += Number(n);
      }
      const shown = Number(/(\d+)/.exec(visibleText(region(html, 'class="fy-areas"', "</span>")))?.[1]);
      expect(total).toBe(shown);
    });

    it(`${locale}: the family-ritual door and the Library door`, () => {
      harness.locale = locale;
      const html = render();
      expect(region(html, 'data-testid="academy-family-door"', "</span>")).toContain(esc(translate(locale, "elev.learnCare.family.cta")));
      expect(html).toContain(esc(translate(locale, "elev.learnCare.family.title")));
      expect(region(html, 'data-testid="academy-library-open"', "</span>")).toContain(esc(translate(locale, "elev.learnCare.library.open")));
      // The doors are buttons with a mirrored chevron (RTL), never a second primary.
      expect(html).toMatch(/class="ds-link[^"]*"[^>]*><span data-testid="academy-family-door"/);
      expect(html).toContain("rtl:-scale-x-100");
    });

    it(`${locale}: no percentage, no Worth knowing note, no short-reads row on For you`, () => {
      harness.locale = locale;
      harness.topic = ask(QUESTION[locale]);
      const html = render();
      expect(visibleText(html)).not.toMatch(/\d\s*%/);
      expect(html).not.toContain('class="know');
      expect(html).not.toContain("academy-short-read");
    });
  }
});

describe("For you · Your programs", () => {
  it("no program running → the two programs to choose from, each opening the program page", () => {
    const html = render();
    expect(count(html, /data-testid="foryou-program-choice"/g)).toBe(2);
    expect(html).toContain(esc(FOR_YOU_COPY.en.seeProgram));
    expect(html).not.toContain('data-testid="foryou-program-open"');
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: a running program → its week as stepping stones, this week ringed, one door to the week`, () => {
      harness.locale = locale;
      const start = new Date(Date.now() - 15 * DAY);
      harness.programs = [{
        id: `talk-together.${localDay(start)}`, programId: "talk-together", startedAt: localDay(start), enrolledAt: start.toISOString(),
        currentWeek: 3, status: "active", baseline: { childProxy: null, capturedAt: null }, updatedAt: start.toISOString(),
      }];
      const html = render();
      const copy = FOR_YOU_COPY[locale];
      const weeks = TALK_TOGETHER.weeks.length;
      expect(count(html, /class="tok plan[^"]*at"/g)).toBe(weeks);
      expect(html).toContain(`aria-label="${esc(copy.weekNow(3))}"`);
      expect(count(html, /class="tok plan here at"/g)).toBe(1);
      expect(count(html, /class="tok plan at"/g)).toBe(2);
      expect(html).toContain(esc(copy.programWeeks(weeks)));
      expect(html).toContain('data-testid="foryou-program-open"');
      // The pick's thread names this week's practice.
      expect(html).toContain('class="knot sets fy-practice"');
    });
  }

  for (const composition of ["desk", "phone"] as const) {
    it(`V77 ${composition}: two programs running → one card each (phone: one swipe row with its dots), each with its own door`, () => {
      harness.composition = composition;
      const tt = new Date(Date.now() - 2 * DAY);
      const sn = new Date(Date.now() - 9 * DAY);
      harness.programs = [
        { id: `talk-together.${localDay(tt)}`, programId: "talk-together", startedAt: localDay(tt), enrolledAt: tt.toISOString(), currentWeek: 1, status: "active", baseline: { childProxy: null, capturedAt: null }, updatedAt: tt.toISOString() },
        { id: `steady-nights.${localDay(sn)}`, programId: "steady-nights", startedAt: localDay(sn), enrolledAt: sn.toISOString(), currentWeek: 2, status: "active", baseline: { childProxy: null, capturedAt: null }, updatedAt: sn.toISOString() },
      ];
      const html = render();
      expect(count(html, /data-testid="foryou-program-open"/g)).toBe(2);
      expect(count(html, /data-testid="foryou-program-choice"/g)).toBe(0);
      expect(html).toContain("Talk Together");
      expect(html).toContain("Steady Nights");
      expect(count(html, /class="tok plan here at"/g)).toBe(2);
      if (composition === "phone") expect(html).toMatch(/class="snap ds-snap-scroll"[^>]*aria-label="Your programs"/);
      else expect(count(html, /class="vt fy-prog x6"|fy-prog x6/g)).toBeGreaterThanOrEqual(2);
      // NEGATIVE CONTROL: the v10.1 single-card shape would show one door.
      expect(count('<button data-testid="foryou-program-open">', /data-testid="foryou-program-open"/g)).toBe(1);
    });
  }
});
