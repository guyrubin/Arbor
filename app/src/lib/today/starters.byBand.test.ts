/**
 * B-TODAY-35 guard — Today's band starters: a 22-month child opens with the
 * same-bedtime starter on day 0 and the words opener after a word; a 5-year
 * child gets none of the toddler starters; the check-up line renders only
 * from a REVIEWED visit schedule. EN + HE strings, gendered for a girl.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../i18n";
import { STARTERS_BY_STAGE, selectStarter, type StarterInput } from "./starters";
import { VISIT_SCHEDULES } from "../domains/visitSchedule";

let lang: UiLang = "en";
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v), uiLang: lang }),
}));
import TodayStarterCard from "../../components/overview/TodayStarterCard";

const NOW = new Date(2026, 9, 6, 12);
const ISO = "2026-10-06";
const LENI = { id: "leni", age: 1, ageMonths: 22, ageMonthsAsOf: ISO, gender: "girl" as const };
const DYLAN = { id: "dylan", age: 5, ageMonths: 62, ageMonthsAsOf: ISO, gender: "boy" as const };
const SEVEN = { id: "seven", age: 7, ageMonths: 84, ageMonthsAsOf: ISO };
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const input = (child: StarterInput["child"], over: Partial<StarterInput> = {}): StarterInput => ({ child, now: NOW, logs: [], words: [], ...over });

describe("B-TODAY-35 · starters by band", () => {
  it("22 months, day 0 → the same-bedtime starter", () => {
    expect(selectStarter(input(LENI))?.kind).toBe("bedtime");
  });
  it("22 months, after a word → the words opener leads", () => {
    expect(selectStarter(input(LENI, { words: [{ timestamp: daysAgo(1) }] }))?.kind).toBe("words");
  });
  it("22 months, bedtime already noted and no word → one tiny taste", () => {
    const logs = [{ timestamp: daysAgo(2), trigger: "Fell asleep after the same two songs at bedtime", behaviorType: "Moment" }];
    expect(selectStarter(input(LENI, { logs }))?.kind).toBe("tastes");
  });
  it("a word older than the window no longer leads", () => {
    expect(selectStarter(input(LENI, { words: [{ timestamp: daysAgo(30) }] }))?.kind).toBe("bedtime");
  });
  it("5 years and 7 years → none of the toddler starters (record openers only)", () => {
    for (const child of [DYLAN, SEVEN]) {
      expect(selectStarter(input(child))).toBeNull();
      expect(selectStarter(input(child, { words: [{ timestamp: daysAgo(1) }] }))).toBeNull();
    }
    expect(STARTERS_BY_STAGE.preschool).toEqual([]);
    expect(STARTERS_BY_STAGE.school).toEqual([]);
  });
  it("the check-up renders only from a reviewed schedule, inside the window", () => {
    // shipped tables are unreviewed: never a check-up line
    expect(VISIT_SCHEDULES["nl-jgz"].reviewed).toBe(false);
    expect(selectStarter(input(LENI, { programme: "nl-jgz" }))?.kind).toBe("bedtime");
    const reviewed = { ...VISIT_SCHEDULES, "nl-jgz": { ...VISIT_SCHEDULES["nl-jgz"], reviewed: true } };
    const s = selectStarter(input(LENI, { programme: "nl-jgz", schedules: reviewed }));
    expect(s?.kind).toBe("checkup");
    expect(s?.visitMonths).toBe(24);
    // Tipat Halav's next visit after 22 months is at 36 — outside the window
    const ilReviewed = { ...VISIT_SCHEDULES, "il-tipat-halav": { ...VISIT_SCHEDULES["il-tipat-halav"], reviewed: true } };
    expect(selectStarter(input(LENI, { schedules: ilReviewed }))?.kind).toBe("bedtime");
  });
});

describe("B-TODAY-35 · the card, EN + HE, gendered for a girl, no verdict", () => {
  const cases: Array<[UiLang, string, RegExp]> = [
    ["en", "words", /What did she say today\?/],
    ["he", "words", /מה היא אמרה היום\?/],
    ["en", "bedtime", /Same bedtime, every night/],
    ["he", "bedtime", /אותה שגרת שינה, כל ערב/],
    ["en", "tastes", /One tiny taste today/],
    ["he", "tastes", /טעימה קטנה אחת היום/],
  ];
  for (const [l, kind, want] of cases) {
    it(`${l} · ${kind}`, () => {
      lang = l;
      const html = renderToStaticMarkup(
        React.createElement(TodayStarterCard, { starter: { kind: kind as "words", key: `elev.ages.starter.${kind}` }, childName: "Leni", gender: "girl", onAct: () => undefined }),
      );
      expect(html).toMatch(want);
      expect(html).not.toMatch(/elev\.ages/);
      expect(html).not.toMatch(/behind|milestone|%|\bscore\b|מאחור|אבן דרך/i);
    });
  }
  it("the check-up line names the visit's age through the one formatter", () => {
    lang = "en";
    const html = renderToStaticMarkup(
      React.createElement(TodayStarterCard, { starter: { kind: "checkup", key: "elev.ages.starter.checkup", visitMonths: 24 }, childName: "Leni", gender: "girl", onAct: () => undefined }),
    );
    expect(html).toContain("Leni&#x27;s check-up at 24 months is coming");
  });
  it("design rules: tokens only, no upper-case label, no gradient, nothing under 12 px; Today wires it in the record slot", () => {
    const SRC = path.resolve(__dirname, "../..");
    const card = readFileSync(path.join(SRC, "components/overview/TodayStarterCard.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(card).not.toMatch(/#[0-9a-fA-F]{3,8}\b|gradient|uppercase|text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/);
    const overview = readFileSync(path.join(SRC, "components/tabs/OverviewTab.tsx"), "utf8");
    expect(overview).toMatch(/\) : starter \? \(\s*<div className="mb-4">\s*<TodayStarterCard /);
    expect(overview).toMatch(/recordSpeaks \|\| starter \? null : \(\s*<PromptCaptureCard/);
  });
});
