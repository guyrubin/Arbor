/**
 * B-PLAY-24 guard — the parent-side Practice page offers what fits the child.
 * Parity 9 Oct: #/practice is Together (components/companion/TogetherView.tsx).
 * Leni (22 months): three parent-led "together" ideas, no games, no Kid Mode
 * hand-over ("From 3, Leni can play on her own"). Dylan (5 years): the games
 * whose band tags fit (read from the Kids sessions' registry) and the labelled
 * hand-over. Tonight offers a story only when one fits the band.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import type { ChildProfile } from "../../types";

const ISO = new Date().toISOString().slice(0, 10);
const LENI = { id: "leni", name: "Leni", age: 1, ageMonths: 22, ageMonthsAsOf: ISO, gender: "girl", languages: ["Hebrew"], schoolContext: "", strengths: [], challenges: [] } as unknown as ChildProfile;
const DYLAN = { id: "dylan", name: "Dylan", age: 5, ageMonths: 62, ageMonthsAsOf: ISO, gender: "boy", languages: ["Hebrew"], schoolContext: "", strengths: [], challenges: [] } as unknown as ChildProfile;

const ui = vi.hoisted(() => ({ lang: "en" as "en" | "he", child: null as unknown }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(ui.lang as UiLang, k, v), uiLang: ui.lang }),
}));
vi.mock("../../context/ArborContext", () => {
  const value = () => ({ childProfile: ui.child, setActiveTab: () => undefined, saveMoment: async () => null, activeFamilyTopic: null });
  return { useArbor: value, useArborOptional: value };
});
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: () => undefined, step: null }) }));
vi.mock("../kidmode/parentGate", () => ({ markPinNudgeShown: () => undefined, readParentPin: () => "", shouldNudgeForPin: () => false }));
vi.mock("../../practice/usePracticeData", () => ({
  usePracticeData: () => ({ speech: { items: [] }, mimic: { items: [] }, adventures: { items: [] }, events: { items: [] }, missions: { items: [] } }),
}));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [] }) }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));

import TogetherView from "../companion/TogetherView";
import { STUDIO_WORLDS, studioWorldsForChild } from "./studioWorlds";
import { offersForChild, storyFitsChild, kidModeOpenFor, TOGETHER_CARDS } from "../../lib/age/playGate";
import { HERO_STORIES } from "../../lib/heroJourneys";

const render = (child: ChildProfile, lang: UiLang) => {
  ui.child = child;
  ui.lang = lang;
  return renderToStaticMarkup(React.createElement(TogetherView));
};
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/[‎‏⁦-⁩]/g, "").replace(/\s+/g, " ");

describe("B-PLAY-24 · Together by band", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: Leni (22 m) gets the three together ideas, no games, no Kid Mode hand-over`, () => {
      const html = render(LENI, lang);
      expect(TOGETHER_CARDS).toHaveLength(3);
      for (const id of TOGETHER_CARDS) expect(plain(html)).toContain(translate(lang, `elev.ages.together.${id}.title`));
      expect(html).not.toContain('data-module="together-games"');
      expect(html).not.toContain('data-testid="together-handover"');
      expect(plain(html)).toMatch(lang === "en" ? /From 3, Leni can play on her own/ : /מגיל 3, Leni תוכל לשחק כאן לבד/);
      expect(html.match(/data-primary-move="choose-together"/g)?.length).toBe(1);
    });

    it(`${lang}: Dylan (5 y) gets the fitting games and the labelled hand-over`, () => {
      const html = render(DYLAN, lang);
      expect(html).toContain('data-module="together-games"');
      expect(html).toContain('data-testid="together-handover"');
      expect(html.match(/data-primary-move="choose-together"/g)?.length).toBe(1);
      const { worlds } = studioWorldsForChild(lang, DYLAN);
      expect(worlds.length).toBeGreaterThan(2);
      // "All" shows the first three; their kid names are what the child will see.
      for (const w of worlds.slice(0, 3)) expect(plain(html)).toContain(translate(lang, w.kidNameKey));
    });
  }

  it("the gate reads the Kids sessions' tags: nothing tagged fits 22 months; a world without tags is hidden under 36 m", () => {
    expect(offersForChild(STUDIO_WORLDS, LENI)).toEqual([]);
    const words = STUDIO_WORLDS.find((w) => w.id === "word-world")!;
    expect(words.ageBands).toBeUndefined();
    expect(offersForChild([words], DYLAN)).toHaveLength(1);
    for (const w of STUDIO_WORLDS.filter((x) => x.id !== "word-world")) expect(w.ageBands?.length, w.id).toBeGreaterThan(0);
    expect(kidModeOpenFor(LENI)).toBe(false);
    expect(kidModeOpenFor(DYLAN)).toBe(true);
  });

  it("Tonight differs: no story on the shelf fits a toddler; several fit Dylan", () => {
    expect(HERO_STORIES.some((s) => storyFitsChild(s, LENI))).toBe(false);
    expect(HERO_STORIES.filter((s) => storyFitsChild(s, DYLAN)).length).toBeGreaterThan(3);
  });
});
