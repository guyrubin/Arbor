/**
 * T7 (kid register: no digits), wave-3 kids round 2 — the Kids home carried
 * "0 of 4 done" and the step numerals 1–4 on the cozy-corner rail. A child
 * sees no count: the line is gone and a step not yet taken is a dot. This
 * guard renders the home (EN + HE; before, during and after the quest) and
 * fails on any Arabic numeral in the visible text or an accessible name.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he", quest: [] as unknown[] }));
vi.mock("../../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "kid", name: "Noa", gender: "girl", age: 5, languages: ["English"] } }) }));
vi.mock("../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock("../../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, name: string) => ({ items: name === "studioQuestProgress" ? h.quest : [], loaded: true, confirmed: true, error: false, remote: false, isCurrent: () => true, upsert: vi.fn(async () => {}) }) }));
vi.mock("../../../hooks/useKidTheme", () => ({ useKidTheme: () => "film3d" }));
vi.mock("../../../lib/timeOfDay", () => ({ bedtimeDoorOpen: () => false }));
vi.mock("../useChildLibraryBooks", () => ({ useChildLibraryBooks: () => [] }));
vi.mock("../LibraryBookCover", () => ({ LibraryBookCover: () => null }));
vi.mock("../audio/kidAudio", () => ({ kidSfx: vi.fn(), kidSay: vi.fn() }));
vi.mock("../kidPrefetch", () => ({ prefetchKidSurfaces: () => undefined }));
vi.mock("../HoldExitButton", () => ({ HoldExitButton: () => null }));
vi.mock("../hero/HeroFigure", () => ({ HeroFigure: () => null }));
vi.mock("../../ui/ArborMascot", () => ({ ArborMascot: () => null }));
vi.mock("./useStudioHero", () => ({ useStudioHero: () => ({ name: "Noa", sheet: null, url: null }) }));
vi.mock("./StudioPortrait", () => ({ StudioPortrait: () => null }));
vi.mock("../rewards/useKidSouvenirs", () => ({ useKidSouvenirs: () => ({ items: [], loaded: true, isCurrent: () => true }) }));
vi.mock("./StudioActivityArt", () => ({ StudioActivityArt: () => null }));

import StudioHome from "./StudioHome";
import { QUEST_STEPS, QUEST_CHOICES, STUDIO_QUEST_ID } from "./studioProgress";

const home = () => renderToStaticMarkup(<StudioHome onWorld={() => {}} onCollection={() => {}} onQuest={() => {}} onExit={() => {}} />);
/** What a child can read or hear: the text, and every accessible name / title / alt. */
function childFacing(html: string): string {
  const attrs = [...html.matchAll(/\s(?:aria-label|title|alt|aria-valuetext)="([^"]*)"/g)].map((m) => m[1]);
  return [html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " "), ...attrs].join(" ");
}
const steps = (n: number) => QUEST_STEPS.slice(0, n).map((step) => ({ id: `${STUDIO_QUEST_ID}:${step}`, questId: STUDIO_QUEST_ID, step, choice: QUEST_CHOICES[step][0] }));

beforeEach(() => { h.lang = "en"; h.quest = []; });

describe("T7: no digit anywhere on the Kids home", () => {
  for (const lang of ["en", "he"] as const) {
    it.each([0, 2, 4])(`${lang}: the home with %s quest steps taken shows no numeral`, (n) => {
      h.lang = lang; h.quest = steps(n);
      const html = home();
      expect(html).toContain("studio-v2__quest");
      expect(childFacing(html)).not.toMatch(/\d/);
    });
  }
  it("a step not yet taken is a dot; a step taken is a check; the old count line is gone", () => {
    h.quest = steps(1);
    const html = home();
    expect(html.match(/studio-v2__quest-dot/g)).toHaveLength(3);
    expect(html).not.toMatch(/of 4 done|מתוך 4/);
  });
  it("negative control: a numeral in the home would be caught", () => {
    expect(childFacing('<p>0 of 4 done</p><span aria-label="step 2"></span>')).toMatch(/\d/);
  });
});
