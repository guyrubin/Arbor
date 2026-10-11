/**
 * v3 EXTRA-FORYOU — the "For you, the parent" hub, rendered (EN + HE).
 *
 * The source pins live in masterclassesPick.test.ts; this renders the hub with
 * an open family question and reads the markup a parent's browser would get:
 *  · "Picked for your question" and a why-line that quotes the question inside
 *    a bidi-isolating <bdi>, while the hero CTA still opens today's read;
 *  · one primary move, at most three modules;
 *  · a short-reads row of 1–3 cards (≥ 44 px, minutes and area only);
 *  · "Courses by area" chips with exactly one pressed and plain integer counts
 *    that add up to the courses on the page;
 *  · the family-ritual door;
 *  · no percentage anywhere in the visible text.
 * Child and question are invented examples.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { makeFamilyTopic, type FamilyTopic } from "../../lib/familyTopics";
import { LEARN_CARDS } from "../../learn/learnCards";
import { topicBoost } from "../../learn/learnLibrary";
import { topicWords } from "../../learn/topicMatch";

const DAY = 86_400_000;
const CHILD_ID = "child-foryou";
const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  topic: null as FamilyTopic | null,
  birthDate: "",
}));

vi.mock("../../context/ArborContext", () => ({
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
vi.mock("./AcademyForYou", () => ({ default: () => null }));
vi.mock("./ScholarHubCard", () => ({ default: () => null }));
vi.mock("../ui/EvidenceChip", () => ({ EvidenceChip: () => null, default: () => null }));
vi.mock("../ui/SpeakButton", () => ({ SpeakButton: () => null, default: () => null }));
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
/** Text as react-dom/server escapes it ("Read today's pick" → "Read today&#x27;s pick"). */
const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
/** The markup of the element that opens at `marker`, up to the first `close` after it. */
const region = (html: string, marker: string, close: string) => {
  const at = html.indexOf(marker);
  expect(at, `not rendered: ${marker}`).toBeGreaterThan(-1);
  const end = html.indexOf(close, at);
  expect(end, `unclosed: ${marker}`).toBeGreaterThan(at);
  return html.slice(html.lastIndexOf("<", at), end);
};

beforeEach(() => {
  harness.locale = "en";
  harness.topic = null;
  harness.birthDate = new Date(Date.now() - Math.round(4.5 * 365.25) * DAY).toISOString().slice(0, 10);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("v3 EXTRA-FORYOU · with a family question open", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the pick says it was picked for the question and quotes it, bidi-isolated; the hero still opens a read`, () => {
      harness.locale = locale;
      harness.topic = ask(QUESTION[locale]);
      const html = render();
      // The tag holds an Icon <span>, so the region runs to the pick title that follows it.
      const tag = region(html, 'data-testid="academy-pick-topic"', "<h2");
      expect(tag).toContain("auto_awesome");
      expect(tag).toContain(esc(translate(locale, "elev.learnCare.pick.topicTag")));
      const why = region(html, 'data-why="family-question"', "</p>");
      expect(why).toContain('dir="auto"');
      expect(why).toMatch(new RegExp(`<bdi dir="auto" data-free-text=""[^>]*>${QUESTION[locale].replace("?", "\\?")}</bdi>`));
      const [lead] = translate(locale, "elev.learnCare.pick.why.topic", { title: "\uE000" }).split("\uE000");
      expect(why).toContain(esc(lead.trim()));
      const cta = region(html, 'data-testid="academy-hero-cta"', "</button>");
      expect(cta).toContain(esc(translate(locale, "elev.learnCare.pick.cta")));
    });

    it(`${locale}: one primary move, at most three modules`, () => {
      harness.locale = locale;
      harness.topic = ask(QUESTION[locale]);
      const html = render();
      expect(count(html, /data-primary-move="/g)).toBe(1);
      expect(html).toContain('data-primary-move="open-todays-pick"');
      const modules = count(html, /data-module="/g);
      expect(modules).toBeGreaterThanOrEqual(1);
      expect(modules).toBeLessThanOrEqual(3);
    });

    it(`${locale}: short reads are 1 to 3 cards, each a 44 px button with minutes`, () => {
      harness.locale = locale;
      harness.topic = ask(QUESTION[locale]);
      const html = render();
      const row = region(html, 'data-testid="academy-short-reads"', "</section>");
      const cards = row.match(/<button[^>]*data-testid="academy-short-read"[^>]*>/g) ?? [];
      expect(cards.length).toBeGreaterThanOrEqual(1);
      expect(cards.length).toBeLessThanOrEqual(3);
      for (const card of cards) expect(card).toContain("min-h-11");
      expect(row).toContain(esc(translate(locale, "learn.minutes", { n: "" }).trim()));
      expect([translate(locale, "elev.learnCare.shortReads.title"), translate(locale, "elev.learnCare.shortReads.titleAll")]
        .some((title) => row.includes(esc(title)))).toBe(true);
      expect(visibleText(row)).not.toMatch(/\d\s*%/);
      expect(row).not.toContain('role="progressbar"');
    });

    it(`${locale}: courses by area — one chip pressed, 44 px chips, integer counts that add up to the courses shown`, () => {
      harness.locale = locale;
      harness.topic = ask(QUESTION[locale]);
      const html = render();
      const group = region(html, 'data-testid="academy-by-area"', "</div>");
      expect(group).toContain('role="group"');
      expect(group).toContain('aria-labelledby="academy-by-area-label"');
      expect(html).toContain('id="academy-by-area-label"');
      const chips = group.match(/<button[^>]*aria-pressed="(?:true|false)"[^>]*>/g) ?? [];
      expect(chips.length).toBeGreaterThan(2);
      expect(count(group, /aria-pressed="true"/g)).toBe(1);
      expect(chips[0]).toContain('aria-pressed="true"'); // "All" is the default
      for (const chip of chips) expect(chip).toContain("min-h-11");
      const counts = [...group.matchAll(/<span class="tabular-nums"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
      expect(counts.length).toBe(chips.length - 1);
      for (const n of counts) expect(n).toMatch(/^\d+$/);
      const courses = count(html, /<h3 /g);
      expect(courses).toBeGreaterThan(0);
      expect(counts.reduce((sum, n) => sum + Number(n), 0)).toBe(courses);
    });

    it(`${locale}: the family-ritual door is a 44 px button with a mirrored arrow`, () => {
      harness.locale = locale;
      harness.topic = ask(QUESTION[locale]);
      const html = render();
      const door = region(html, 'data-testid="academy-family-door"', "</button>");
      expect(door).toMatch(/^<button[^>]*min-h-11/);
      expect(door).toContain(esc(translate(locale, "elev.learnCare.family.cta")));
      expect(door).toContain(esc(translate(locale, "elev.learnCare.family.headline")));
      expect(door).toContain('alt=""');
      expect(door).toContain("rtl:-scale-x-100");
      expect(door).not.toContain("--gradient-cta");
    });

    it(`${locale}: no percentage anywhere in the visible text`, () => {
      harness.locale = locale;
      harness.topic = ask(QUESTION[locale]);
      const text = visibleText(render());
      expect(text.length).toBeGreaterThan(500);
      expect(text).not.toMatch(/\d\s*%/);
      // NEGATIVE CONTROL: the same scan catches a percentage.
      expect(visibleText("<span>72%</span>")).toMatch(/\d\s*%/);
    });
  }
});

describe("v3 EXTRA-FORYOU · the tag needs a question that moved the pick", () => {
  it("the unrelated control question really shares no word with any read", () => {
    expect(topicWords(UNRELATED).length).toBeGreaterThan(0);
    expect(LEARN_CARDS.filter((c) => topicBoost(c, UNRELATED) > 0)).toEqual([]);
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: no question, or one that moved nothing → no tag, no quote; the hub still renders its reads`, () => {
      harness.locale = locale;
      for (const topic of [null, ask(UNRELATED)]) {
        harness.topic = topic;
        const html = render();
        expect(html).not.toContain('data-testid="academy-pick-topic"');
        expect(html).not.toContain('data-why="family-question"');
        expect(html).toContain('data-testid="academy-pick-why"');
        expect(html).toContain('data-testid="academy-by-area"');
        expect(html).toContain('data-testid="academy-family-door"');
        expect(count(html, /data-primary-move="/g)).toBe(1);
        if (html.includes('data-testid="academy-short-reads"')) {
          expect(html).toContain(esc(translate(locale, "elev.learnCare.shortReads.titleAll")));
          expect(html).not.toContain(esc(translate(locale, "elev.learnCare.shortReads.title")));
        }
      }
    });
  }
});
