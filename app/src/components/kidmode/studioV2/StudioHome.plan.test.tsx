/**
 * S1 (surfacing) 5–7 — the kid side of a running Everyday Plan, from data
 * alone: the kid home's bottom rail becomes the plan (hero title · "Tonight:
 * {step}" in the child's own words · Open my book · I tried!), Sprout's bubble
 * carries the plan line once the evening door is open, and the plan book
 * wears the "My plan" ribbon on Hero Stories. No plan → the cozy corner rail
 * and the ordinary hint, unchanged.
 *
 * FIREWALL: the child never sees the parent's words, a count, a streak,
 * "missed" or a grown-up word; "I tried!" writes one day key, nothing else.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanBookDoc } from "../../../lib/library/plans/planBookDoc";
import { getPattern } from "../../../lib/library/plans/planBooks";
import { recordTry } from "../../../lib/plans/planWeek";

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  rows: [] as unknown[],
  books: [] as { book: { id: string; kind?: string; title: { en: string; he: string } }; doc: { sheetId: string } }[],
  evening: false,
  upsert: vi.fn(async (_doc: unknown) => {}),
  sfx: vi.fn(),
  buttons: [] as Record<string, unknown>[],
}));
// The buttons' handlers, read off the JSX as it renders (no DOM in this repo).
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") h.buttons.push(props as Record<string, unknown>);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return {
    ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
vi.mock("../../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "kid", name: "Noa", gender: "girl", age: 3, languages: ["English"] } }) }));
vi.mock("../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock("../../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, name: string) => ({ items: name === "books" ? h.rows : [], loaded: true, confirmed: true, error: false, remote: false, isCurrent: () => true, upsert: h.upsert }) }));
vi.mock("../../../hooks/useKidTheme", () => ({ useKidTheme: () => "film3d" }));
vi.mock("../../../lib/timeOfDay", () => ({ bedtimeDoorOpen: () => h.evening }));
vi.mock("../useChildLibraryBooks", () => ({ useChildLibraryBooks: () => h.books }));
vi.mock("../LibraryBookCover", () => ({ LibraryBookCover: () => null }));
vi.mock("../audio/kidAudio", () => ({ kidSfx: (n: string) => h.sfx(n), kidSay: vi.fn() }));
vi.mock("../kidPrefetch", () => ({ prefetchKidSurfaces: () => undefined }));
vi.mock("../HoldExitButton", () => ({ HoldExitButton: () => null }));
vi.mock("../hero/HeroFigure", () => ({ HeroFigure: () => null }));
vi.mock("../../ui/ArborMascot", () => ({ ArborMascot: () => null }));
vi.mock("./useStudioHero", () => ({ useStudioHero: () => ({ name: "Noa", sheet: null, url: null }) }));
vi.mock("./StudioPortrait", () => ({ StudioPortrait: () => null }));
vi.mock("../rewards/useKidSouvenirs", () => ({ useKidSouvenirs: () => ({ items: [], loaded: true, isCurrent: () => true }) }));
vi.mock("./StudioActivityArt", () => ({ StudioActivityArt: () => null }));

import StudioHome from "./StudioHome";
import { StudioWorld } from "./StudioWorld";

const def = getPattern("plan-poo-sit")!;
const plan: PlanBookDoc = {
  id: "plan-poo-sit.kid", bookId: "plan-poo-sit.kid", kind: "plan", pattern: "plan-poo-sit", lang: "en",
  stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["song"], durationDays: 14,
  approvedAt: new Date(Date.now() - 2 * 86400000).toISOString(), approvedBy: "p", createdAt: "t", updatedAt: "t", status: "active",
};
const entry = { book: { id: "plan-poo-sit.kid", kind: "plan", title: def.title }, doc: { sheetId: "s" } };
const strip = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
/** The kid-register firewall: no grown-up word, no count, no loss language. */
const GROWN_UP = /\bparent|\bscore|\bstreak|\bmissed\b|\d+\s?%|\bnight \d|\btries\b|won't sit|wet patches|hard poo/i;
const home = (over: Partial<React.ComponentProps<typeof StudioHome>> = {}) => renderToStaticMarkup(<StudioHome onWorld={() => {}} onCollection={() => {}} onQuest={() => {}} onExit={() => {}} {...over} />);

beforeEach(() => { h.rows = []; h.books = []; h.evening = false; h.lang = "en"; h.buttons = []; h.upsert.mockClear(); h.sfx.mockClear(); });
const button = (attr: string) => h.buttons.find((b) => b[attr] !== undefined) as { onClick: () => void } | undefined;

describe("the kid home with a running plan (S1)", () => {
  it("no plan: the cozy corner rail and the ordinary hint, untouched", () => {
    const html = home();
    expect(html).toContain("MY COZY CORNER");
    expect(html).not.toContain("data-kid-plan-rail");
    expect(html).not.toContain("data-kid-plan-bubble");
    expect(html).toContain("Which game would you like to try?");
  });

  it("a running plan takes the rail: hero title, tonight's step in the child's words, Open my book, I tried!", () => {
    h.rows = [plan]; h.books = [entry];
    const html = home();
    expect(html).toContain('data-kid-plan-rail="plan-poo-sit"');
    expect(html).not.toContain("MY COZY CORNER");
    expect(html).toContain("MY PLAN");
    expect(html).toContain(def.title.en);
    expect(html).toContain('data-kid-plan-step=""');
    expect(strip(html)).toContain("Tonight: every evening, we sit calmly on the toilet for about 5 minutes.");
    expect(html).toContain('data-kid-plan-open=""');
    expect(html).toContain('data-kid-plan-tried=""');
    expect(html).toContain('aria-pressed="false"');
    expect(strip(html)).toContain("I tried!");
    expect(strip(html)).not.toContain(def.parentWords.en);
    expect(strip(html)).not.toMatch(GROWN_UP);
  });

  it("the child's tap is recorded once as a day key on the plan row — a count, never a streak, never 'missed'", () => {
    h.rows = [plan]; h.books = [entry];
    home();
    const tried = button("data-kid-plan-tried");
    expect(tried).toBeDefined();
    tried!.onClick();
    expect(h.sfx).toHaveBeenCalledWith("tap");
    expect(h.upsert).toHaveBeenCalledTimes(1);
    const written = h.upsert.mock.calls[0][0] as PlanBookDoc;
    expect(written.tries).toHaveLength(1);
    expect(written.tries![0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(written.nights).toBeUndefined();
    expect(JSON.stringify(written)).not.toMatch(/streak|missed|score/);
    // already tapped today: the button reads done and a second tap writes nothing
    h.rows = [recordTry(plan, new Date())];
    const done = home();
    expect(done).toContain('data-kid-plan-tried="tonight"');
    expect(done).toContain('aria-pressed="true"');
    expect(strip(done)).toContain("I tried tonight!");
    h.buttons = [];
    home();
    button("data-kid-plan-tried")!.onClick();
    expect(h.upsert).toHaveBeenCalledTimes(1);
  });

  it("Open my book deep-links to the plan book; without a printed sheet it opens Hero Stories instead", () => {
    h.rows = [plan]; h.books = [entry];
    const onOpenBook = vi.fn(), onWorld = vi.fn();
    home({ onWorld, onOpenBook });
    button("data-kid-plan-open")!.onClick();
    expect(onOpenBook).toHaveBeenCalledWith("plan-poo-sit.kid");
    expect(onWorld).not.toHaveBeenCalled();
    h.books = []; h.buttons = [];
    home({ onWorld, onOpenBook });
    button("data-kid-plan-open")!.onClick();
    expect(onWorld).toHaveBeenCalledWith("stories");
    expect(onOpenBook).toHaveBeenCalledTimes(1);
  });

  it("Sprout's evening line: 'Tonight: {step} Want to read our plan?' only when the evening door is open AND a plan runs", () => {
    h.rows = [plan]; h.books = [entry];
    expect(home()).not.toContain("data-kid-plan-bubble");
    h.evening = true;
    const html = home();
    expect(html).toContain('data-kid-plan-bubble="plan-poo-sit"');
    expect(strip(html)).toContain("Tonight: every evening, we sit calmly on the toilet for about 5 minutes. Want to read our plan?");
    expect(strip(html)).toContain("Read our plan");
    expect(html).not.toContain("Which game would you like to try?");
    expect(strip(html)).not.toMatch(GROWN_UP);
    h.rows = [];
    expect(home()).not.toContain("data-kid-plan-bubble");
  });

  it("Hebrew: the rail and the line are Hebrew, first person, in the girl's form", () => {
    h.lang = "he"; h.rows = [plan]; h.books = [entry]; h.evening = true;
    const html = home();
    expect(html).toContain(def.title.he);
    expect(strip(html)).toContain("הלילה: כל ערב, אנחנו יושבים בשקט על האסלה בערך 5 דקות.");
    expect(strip(html)).toContain("רוצה לקרוא את התוכנית שלנו?");
    expect(strip(html)).toContain("ניסיתי!");
    expect(strip(html)).not.toMatch(/Tonight|I tried|MY PLAN/);
    expect(strip(html)).not.toContain(def.parentWords.he);
  });

  it("Hero Stories: the plan book wears the 'My plan' ribbon; a canonical book does not", () => {
    h.books = [entry, { book: { id: "five-smooth-stones", title: { en: "Five Smooth Stones", he: "חמש אבנים חלקות" } }, doc: { sheetId: "s" } }];
    const html = renderToStaticMarkup(<StudioWorld worldId="stories" onActivity={() => {}} onBooks={() => {}} onOpenBook={() => {}} />);
    expect(html).toContain('data-kid-plan-book="plan-poo-sit.kid"');
    expect((html.match(/studio-v2__book-ribbon/g) ?? []).length).toBe(1);
    expect(strip(html)).toContain("My plan");
    expect(html.indexOf(def.title.en)).toBeLessThan(html.indexOf("Five Smooth Stones")); // the running plan sorts first
  });
});
