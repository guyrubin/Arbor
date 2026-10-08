import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PRACTICES } from "./practices";
import { adaptPractice, adaptationSessionKey, PRACTICE_ADAPTATIONS, PRACTICE_ADAPTATION_KEYS, restorePracticeAdaptation } from "./practiceAdaptations";
import { choosePractice, practiceDoseEntry } from "../lib/practice/choosePractice";
import { loopFirewallHits } from "../lib/loop/firewall";

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../lib/i18n")>("../lib/i18n");
  return { useLanguage: () => ({ uiLang: locale.lang, t: (key: string, values?: Record<string, string | number>) => translate(locale.lang, key, values) }) };
});
import PracticeCard from "../components/loop/PracticeCard";

const base = PRACTICES.find((p) => p.id === "pr-words-01")!;
const day = new Date(2026, 9, 8, 10);
const words = (s: string) => s.trim().split(/\s+/).length;

describe("B-NEXT-18 authored activity adaptations", () => {
  it("offers four complete bilingual alternatives for ten existing activities", () => {
    expect(Object.keys(PRACTICE_ADAPTATIONS)).toHaveLength(10);
    for (const [id, menu] of Object.entries(PRACTICE_ADAPTATIONS)) {
      const original = PRACTICES.find((p) => p.id === id);
      expect(original, id).toBeTruthy();
      expect(Object.keys(menu)).toEqual([...PRACTICE_ADAPTATION_KEYS]);
      expect(new Set(Object.values(menu).map((v) => v.do.en)).size, id).toBe(4);
      for (const [key, variant] of Object.entries(menu)) {
        expect([2, 5, 10, 15]).toContain(variant.minutes);
        for (const lang of ["en", "he"] as const) {
          expect(variant.do[lang].trim(), `${id}/${key}/do/${lang}`).not.toBe("");
          expect(variant.say[lang].trim(), `${id}/${key}/say/${lang}`).not.toBe("");
          expect(variant.materials?.[lang].trim(), `${id}/${key}/materials/${lang}`).toBeTruthy();
          expect(words(variant.do[lang]), `${id}/${key}/do/${lang}`).toBeLessThanOrEqual(25);
          expect(words(variant.say[lang]), `${id}/${key}/say/${lang}`).toBeLessThanOrEqual(15);
          expect(loopFirewallHits(`${variant.do[lang]} ${variant.say[lang]} ${variant.materials?.[lang]}`), `${id}/${key}/${lang}`).toEqual([]);
        }
        expect(/[A-Za-z]/.test(`${variant.do.he}${variant.say.he}${variant.materials?.he}`), id).toBe(false);
      }
      expect(menu.two_minutes.minutes).toBe(2);
      expect(menu.no_materials.materials).toEqual({ en: "No materials needed", he: "אין צורך באביזרים" });
    }
  });

  it("updates all fields as one choice without mutating the base, and restores the exact original", () => {
    const before = JSON.stringify(base);
    for (const key of PRACTICE_ADAPTATION_KEYS) {
      const adapted = adaptPractice(base, key);
      expect(adapted.practice).toMatchObject(PRACTICE_ADAPTATIONS[base.id][key]);
      expect(adapted.practice).toMatchObject({ id: base.id, ageMonths: base.ageMonths, shelf: base.shelf, milestoneId: base.milestoneId });
      expect(adapted.adaptation).toMatchObject({ key, version: 1, basePracticeId: base.id });
    }
    expect(JSON.stringify(base)).toBe(before);
    expect(adaptPractice(base, null)).toEqual({ practice: base });
    const unsupported = PRACTICES.find((p) => !PRACTICE_ADAPTATIONS[p.id])!;
    expect(adaptPractice(unsupported, "two_minutes")).toEqual({ practice: unsupported });
  });

  it("does not present new copy as a clinical approval inherited from its base", () => {
    const reviewed = { ...base, reviewStatus: "approved" as const, review: { reviewedBy: "reviewer", reviewedAt: "2026-10-01", reviewDueAt: "2027-10-01" } };
    expect(adaptPractice(reviewed, "two_minutes").practice.reviewStatus).toBe("draft");
    expect(adaptPractice(reviewed, "two_minutes").practice.review).toBeUndefined();
    expect(adaptPractice(reviewed, null).practice).toBe(reviewed);
  });

  it("records the chosen version on the existing daily row only when the parent answers", () => {
    const selected = adaptPractice(base, "two_minutes");
    const pick = { ...selected, milestone: null, shelf: base.shelf };
    const did = practiceDoseEntry(pick, "did", "child-a", selected.practice.say.he, day);
    expect(did).toMatchObject({ id: "practice.child-a.2026-10-08", source: "practice", status: "completed", practiceId: base.id, recommendation: selected.practice.say.he, capacity: "tiny", practiceAdaptation: selected.adaptation });
    expect(did.outcome).toBeUndefined();
    const later = practiceDoseEntry(pick, "not_today", "child-a", selected.practice.say.he, day);
    expect(later.id).toBe(did.id);
    expect(later.outcome).toBe("not_today");
    const original = practiceDoseEntry({ practice: base, milestone: null, shelf: base.shelf }, "did", "child-a", base.say.he, day);
    expect(original.practiceAdaptation).toBeUndefined();
  });

  it("restores the recorded copy after a reload while retaining its base practice ID", () => {
    const selected = adaptPractice(base, "no_materials");
    const picked = choosePractice({ childId: "child-a", milestones: [], comparisonMonths: 20, practices: PRACTICES, coverage: {}, today: day, todayPracticeId: base.id, todayAdaptation: selected.adaptation });
    expect(picked?.practice).toEqual(selected.practice);
    expect(picked?.adaptation).toEqual(selected.adaptation);
    // A later content edit must not rewrite what the parent recorded.
    const revisedBase = { ...base, say: { en: "A later line", he: "משפט מאוחר יותר" } };
    expect(restorePracticeAdaptation(revisedBase, selected.adaptation).practice.say).toEqual(selected.practice.say);
    const other = PRACTICES.find((p) => p.id === "pr-family-01")!;
    expect(restorePracticeAdaptation(other, selected.adaptation)).toEqual({ practice: other });
  });

  it("scopes a draft choice to this child, activity and day, without ambiguous joined IDs", () => {
    const current = adaptationSessionKey("child-a", base.id, "2026-10-08");
    expect(adaptationSessionKey("child-b", base.id, "2026-10-08")).not.toBe(current);
    expect(adaptationSessionKey("child-a", "pr-family-01", "2026-10-08")).not.toBe(current);
    expect(adaptationSessionKey("child-a", base.id, "2026-10-09")).not.toBe(current);
    expect(adaptationSessionKey("a|b", "c", "d")).not.toBe(adaptationSessionKey("a", "b|c", "d"));
  });

  it("falls back safely for a malformed saved record rather than crashing the activity card", () => {
    const saved = adaptPractice(base, "two_minutes").adaptation!;
    for (const override of [
      { do: { en: 123, he: "טקסט" } },
      { say: { en: "", he: "טקסט" } },
      { materials: { en: "x".repeat(801), he: "טקסט" } },
      { minutes: 600 },
      { version: 2 },
      { key: "invented" },
    ]) expect(restorePracticeAdaptation(base, { ...saved, ...override } as never)).toEqual({ practice: base });
  });

  it.each(["en", "he"] as const)("keeps the completion action before the adaptation menu in %s", (lang) => {
    locale.lang = lang;
    const selected = adaptPractice(base, "two_minutes");
    const html = renderToStaticMarkup(<PracticeCard practice={selected.practice} milestone={null} shelf={base.shelf} adaptation="two_minutes" onAdapt={() => undefined} onAnswer={() => undefined} />);
    expect(html.indexOf('data-testid="practice-answers"')).toBeLessThan(html.indexOf('data-testid="practice-adapt"'));
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('min-h-11');
    expect(html).not.toContain("elev.adapt.");
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    const recorded = renderToStaticMarkup(<PracticeCard practice={selected.practice} milestone={null} shelf={base.shelf} adaptation="two_minutes" onAdapt={() => undefined} onAnswer={() => undefined} answered="did" />);
    expect(recorded).not.toContain('data-testid="practice-adapt"');
  });
});
