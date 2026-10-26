/**
 * B-KID-167 — the plan lint bites: every rule is proven on a planted
 * violation (the diagnosis-noun ban EN + HE, the virtue nouns, second person,
 * pressure modals with the negated no-pressure rule allowed, the digit rule,
 * the 2 : 1 ratio, the name placement and the Hebrew prefix, the caps), and
 * the clean proof stays clean.
 */
import { describe, expect, it } from "vitest";
import { PLAN_FIXTURE_BOOKS } from "./planBooks";
import { isDirective, lintPlanBook, sentences, words, type LintHit } from "./planLint";
import type { PlanBook } from "../types";

const base = PLAN_FIXTURE_BOOKS["plan-poo-sit--demo"];

/** The proof with page `id`'s text replaced (EN, or HE m+f when `he`). */
function withText(id: string, en: string, he?: string): PlanBook {
  const pages = base.pages.map((p) => (p.id === id ? { ...p, text: { en, he: { m: he ?? p.text.he.m, f: he ?? p.text.he.f } } } : p));
  return { ...base, pages };
}
const rules = (hits: LintHit[]) => [...new Set(hits.map((h) => h.rule))].sort();

describe("plan lint", () => {
  it("the proof is clean", () => {
    expect(lintPlanBook(base)).toEqual([]);
  });

  it("rejects a seeded diagnosis noun in EN and in HE (with a Hebrew prefix too)", () => {
    expect(rules(lintPlanBook(withText("p3", "Sometimes my constipation makes it hard. My tummy holds on.")))).toContain("diagnosis-noun");
    expect(rules(lintPlanBook(withText("p3", base.pages[2].text.en, "לפעמים העצירות מקשה. הבטן שלי מחזיקה.")))).toContain("diagnosis-noun");
    expect(rules(lintPlanBook(withText("p3", base.pages[2].text.en, "יש לי בעיה קטנה. הבטן שלי מחזיקה.")))).toContain("diagnosis-noun");
    // a pattern's own banned word
    expect(rules(lintPlanBook(withText("p3", "Sometimes I have an accident. My tummy holds on."), { bannedEn: ["accident"] }))).toContain("diagnosis-noun");
    expect(rules(lintPlanBook(withText("p3", "Sometimes I have an accident. My tummy holds on.")))).not.toContain("diagnosis-noun");
  });

  it("rejects a verdict about the child (virtue nouns, EN and HE)", () => {
    expect(rules(lintPlanBook(withText("p8", "I am brave and I am a big boy now. My tummy feels light.")))).toContain("virtue-noun");
    expect(rules(lintPlanBook(withText("p8", base.pages[7].text.en, "אני ילד טוב. כל הכבוד לי. הבטן שלי קלה.")))).toContain("virtue-noun");
  });

  it("rejects second person and pressure modals; the negated no-pressure rule passes", () => {
    expect(rules(lintPlanBook(withText("s1-sit-after-meal-5m", "You sit on the toilet. Your tummy waits.")))).toContain("second-person");
    expect(rules(lintPlanBook(withText("s1-sit-after-meal-5m", "I must sit every evening. My tummy waits.")))).toContain("pressure-modal");
    expect(rules(lintPlanBook(withText("s1-sit-after-meal-5m", "I have to make poo every time. My tummy waits.")))).toContain("pressure-modal");
    expect(rules(lintPlanBook(withText("s1-sit-after-meal-5m", "I do not have to make poo every time. My tummy waits.")))).not.toContain("pressure-modal");
    expect(rules(lintPlanBook(withText("s1-sit-after-meal-5m", base.pages[4].text.en, "אתה יושב על האסלה. הבטן שלך מחכה.")))).toContain("second-person");
    expect(rules(lintPlanBook(withText("s1-sit-after-meal-5m", base.pages[4].text.en, "אני חייב לשבת כל ערב. הבטן שלי מחכה.")))).toContain("pressure-modal");
    expect(rules(lintPlanBook(withText("s1-sit-after-meal-5m", base.pages[4].text.en, "אני לא חייב לעשות קקי. הבטן שלי מחכה.")))).not.toContain("pressure-modal");
  });

  it("rejects a digit that is not a time, and a counter", () => {
    expect(rules(lintPlanBook(withText("p4", "We have 3 steps. We do them together. My tummy waits for the plan.")))).toContain("digit");
    expect(rules(lintPlanBook(withText("p4", "Every evening, we sit for 5 minutes. My tummy waits. The box is open.")))).not.toContain("digit");
  });

  it("rejects a chore chart: more directive than descriptive sentences", () => {
    const chores = base.pages.map((p) => ({ ...p, text: { en: "We sit. We try. We go.", he: p.text.he } }));
    expect(rules(lintPlanBook({ ...base, pages: chores }))).toContain("ratio");
    expect(isDirective("We sit calmly on the toilet.", "en")).toBe(true);
    expect(isDirective("My feet rest on a little step.", "en")).toBe(false);
    expect(isDirective("אנחנו יושבים בשקט על האסלה.", "he")).toBe(true);
    expect(isDirective("הרגליים שלי נחות על שרפרף.", "he")).toBe(false);
    expect(sentences("One. Two! Three? Four… five")).toHaveLength(5);
  });

  it("rejects the name off the cover and the frame line, and a Hebrew prefix glued to it", () => {
    expect(rules(lintPlanBook(withText("p2", "After {name} eats, the tummy works. What is left over becomes poo.")))).toContain("name-placement");
    const prefixed = { ...base, pages: base.pages.map((p) => (p.id === "p8" ? { ...p, closing: { en: "{name}'s tummy is learning.", he: { m: "הבטן של{name} לומדת.", f: "הבטן של{name} לומדת." } } } : p)) };
    expect(rules(lintPlanBook(prefixed))).toContain("name-prefix");
  });

  it("rejects a page over the band's cap and a missing or non-Hebrew HE-f line", () => {
    const long = Array.from({ length: 45 }, () => "word").join(" ") + ".";
    expect(rules(lintPlanBook(withText("p1", long)))).toContain("words");
    expect(rules(lintPlanBook(withText("p1", "Short.", "")))).toContain("missing");
    expect(rules(lintPlanBook(withText("p1", "Short.", "Latin only.")))).toContain("hebrew");
    expect(words("My tummy gets a chance, and we just try!")).toBe(9);
  });

  it("rejects non-NFC Hebrew", () => {
    // U+FB2B (shin with sin dot, a presentation form) is a composition exclusion: NFC decomposes it
    const notNfc = "הבטן \uFB2Bלי מחכה.";
    expect(notNfc).not.toBe(notNfc.normalize("NFC"));
    expect(rules(lintPlanBook(withText("p1", base.pages[0].text.en, notNfc)))).toContain("nfc");
  });
});
