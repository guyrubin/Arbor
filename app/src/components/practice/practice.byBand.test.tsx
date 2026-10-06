/**
 * B-PLAY-24 guard — the parent-side Practice page offers what fits the child.
 * Leni (22 months): three parent-led "together" cards, no game tiles, no Kid
 * Mode door ("From 3, Leni can play on her own"). Dylan (5 years): the worlds
 * whose band tags fit (read from the Kids sessions' registry), the door, one
 * start-world stamp. Tonight offers a story only when one fits the band.
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
  const value = () => ({ childProfile: ui.child, setActiveTab: () => undefined, addMoment: () => null });
  return { useArbor: value, useArborOptional: value };
});
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: () => undefined, step: null }) }));
vi.mock("../kidmode/parentGate", () => ({ markPinNudgeShown: () => undefined, readParentPin: () => "", shouldNudgeForPin: () => false }));
vi.mock("../../practice/usePracticeData", () => ({
  usePracticeData: () => ({ speech: { items: [] }, mimic: { items: [] }, adventures: { items: [] }, events: { items: [] }, missions: { items: [] } }),
}));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [] }) }));

import PracticeStudioTab from "./PracticeStudioTab";
import { STUDIO_WORLDS } from "./studioWorlds";
import { offersForChild, storyFitsChild, kidModeOpenFor } from "../../lib/age/playGate";
import { HERO_STORIES } from "../../lib/heroJourneys";

const render = (child: ChildProfile, lang: UiLang) => {
  ui.child = child;
  ui.lang = lang;
  return renderToStaticMarkup(React.createElement(PracticeStudioTab));
};
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/[‎‏⁦-⁩]/g, "").replace(/\s+/g, " ");

describe("B-PLAY-24 · Practice by band", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: Leni (22 m) gets three together cards, no game tiles, no Kid Mode door`, () => {
      const html = render(LENI, lang);
      expect(html.match(/data-together-card=/g)?.length).toBe(3);
      // the worlds module holds the together cards, never a game tile
      expect(html).not.toContain('data-testid="practice-count-window"');
      expect(html).not.toContain('data-module="practice-kidmode-door"');
      expect(html).toContain('data-testid="practice-kidmode-from-three"');
      expect(plain(html)).toMatch(lang === "en" ? /From 3, Leni can play on her own/ : /מגיל 3, Leni תוכל לשחק כאן לבד/);
      expect(html.match(/data-primary-move="start-world"/g)?.length).toBe(1);
      for (const w of STUDIO_WORLDS) expect(plain(html)).not.toContain(translate(lang, `practice.world.${w.key}.name`));
    });

    it(`${lang}: Dylan (5 y) gets the fitting worlds and the door, no together cards`, () => {
      const html = render(DYLAN, lang);
      expect(html).not.toContain("data-together-card");
      expect(html).toContain('data-module="practice-kidmode-door"');
      expect(html).toContain('data-module="practice-worlds"');
      expect(html.match(/data-primary-move="start-world"/g)?.length).toBe(1);
      const fitting = offersForChild(STUDIO_WORLDS, DYLAN);
      expect(fitting.length).toBeGreaterThan(5);
      for (const w of fitting) expect(plain(html)).toContain(translate(lang, `practice.world.${w.key}.name`));
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
