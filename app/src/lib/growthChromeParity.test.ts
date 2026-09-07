/**
 * Item 8 (chrome half) / GP-17 / OBJ-ASK-03 — the Growth, Profile and Ask
 * chrome that stayed English inside the Hebrew app.
 *
 * Law 7: both locales are the design. These are not clinical content and not
 * kid content (those are GD-6, item 31) — they are app furniture a Hebrew
 * parent reads every session: the Strengths leaf (eyebrow, both card titles,
 * the "Build a plan" link and the whole closing CTA), the Profile milestone
 * chapter's age-window label ("... in the 5 years window" — an English
 * catalogue label spliced into a Hebrew sentence), Daily Play's focus chip,
 * the Language Lab duration chips, the Course card's done-toggle accessible
 * name, and the seven coach lens CONCEPT labels.
 *
 * The scholar's own name ("Lev Vygotsky") is a proper name and deliberately
 * stays Latin — item 8's acceptance excludes names.
 *
 * Negative control: the verbatim pre-fix literals, asserted absent from the
 * files, plus the pre-fix band derivation.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as growth from "./i18nElevation/growth";
import * as growthTruth from "./i18nElevation/growthTruth";
import { coachContractText, en as ccEn, he as ccHe } from "./i18nElevation/coachcontract";

const SRC = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(SRC, f), "utf8");

const NEW_KEYS = {
  growth: [
    "elev.growth.play.setFocus",
    "elev.growth.play.goalsOne",
    "elev.growth.play.goalsMany",
    "elev.growth.lang.duration.minutes",
    "elev.growth.lang.duration.daily",
    "elev.growth.course.markDone",
    "elev.growth.course.markNotDone",
  ],
  growthTruth: ["elev.growthTruth.strengths.ctaTitle", "elev.growthTruth.strengths.ctaBody"],
};

const SCHOLAR_SLUGS = [
  "vygotsky",
  "bowlby",
  "winnicott",
  "montessori",
  "bronfenbrenner",
  "piaget",
  "erikson",
];

/** Hebrew letters — a transcreated string has to actually contain some. */
const HEBREW = /[֐-׿]/;

describe("every new chrome key lands in BOTH locales", () => {
  it("growth", () => {
    for (const k of NEW_KEYS.growth) {
      expect(growth.en[k], `${k} missing from en`).toBeTruthy();
      expect(growth.he[k], `${k} missing from he`).toBeTruthy();
      expect(HEBREW.test(growth.he[k]), `${k} he is not transcreated`).toBe(true);
    }
  });

  it("growthTruth", () => {
    for (const k of NEW_KEYS.growthTruth) {
      expect(growthTruth.en[k], `${k} missing from en`).toBeTruthy();
      expect(HEBREW.test(growthTruth.he[k] ?? ""), `${k} he is not transcreated`).toBe(true);
    }
  });

  it("the seven lens concepts, keyed by the slug initialData actually carries", () => {
    const data = read("initialData.ts");
    for (const slug of SCHOLAR_SLUGS) {
      expect(data, `initialData.ts no longer carries slug ${slug}`).toContain(`slug: "${slug}"`);
      const key = `elev.coachcontract.lens.concept.${slug}`;
      expect(ccEn[key], `${key} missing from en`).toBeTruthy();
      expect(HEBREW.test(ccHe[key] ?? ""), `${key} he is not transcreated`).toBe(true);
      // The lookup the component uses, not just the record.
      expect(coachContractText("he", key)).toBe(ccHe[key]);
      expect(coachContractText("en", key)).toBe(ccEn[key]);
    }
    // Every slug in initialData has a concept key — a new scholar cannot ship untranslated.
    const slugs = [...data.matchAll(/slug: "([a-z]+)"/g)].map((m) => m[1]);
    expect(slugs.sort()).toEqual([...SCHOLAR_SLUGS].sort());
  });

  it("the goal-count plural is two explicit keys, not a suffix token", () => {
    // The app DOES resolve a {plural} suffix (context/translate resolvePlural),
    // but Hebrew does not inflect that way, so a count that reads as a phrase
    // gets one key per form.
    for (const k of NEW_KEYS.growth) {
      expect(growth.en[k], k).not.toContain("{plural}");
      expect(growth.he[k], k).not.toContain("{plural}");
    }
    expect(growth.en["elev.growth.play.goalsMany"]).toContain("{n}");
    expect(growth.he["elev.growth.play.goalsMany"]).toContain("{n}");
  });
});

describe("the sites render through the keys", () => {
  const strengths = read("components/sections/Strengths.tsx");
  const profile = read("components/sections/ChildProfile.tsx");
  const play = read("components/tabs/DailyPlayTab.tsx");
  const lang = read("components/tabs/LanguageLabTab.tsx");
  const course = read("components/overview/CourseCard.tsx");
  const coach = read("components/tabs/CoachTab.tsx");

  it("Strengths carries no hard-coded English chrome", () => {
    for (const literal of [
      'eyebrow="My Child"',
      'title="Strengths"',
      'title="Where to support"',
      "Build a plan <Icon",
      "Turn a challenge into a calm next step</h3>",
      "> Ask Arbor",
    ]) {
      expect(strengths, literal).not.toContain(literal);
    }
    for (const key of ['t("cp.eyebrow")', 't("cp.ch.strengths")', 't("cp.ch.support")', 't("cp.buildPlan")', 't("nav.ask")']) {
      expect(strengths).toContain(key);
    }
  });

  it("the Profile age window renders a localized age, not a catalogue label", () => {
    expect(profile).toContain("ageLabelForMonths(milestoneAgeWindow(comparisonMonths).months, t)");
    // NEGATIVE CONTROL: the pre-fix derivation read the English band label.
    expect(profile).not.toContain("band: milestoneAgeWindow(comparisonMonths).label");
  });

  it("Daily Play, Language Lab, the course toggle and the lens picker are keyed", () => {
    expect(play).toContain('t("elev.growth.play.setFocus")');
    expect(play).not.toContain('"Set a focus"');
    expect(play).not.toMatch(/goal\$\{activeGoals\.length !== 1/);
    expect(lang).toContain('t("elev.growth.lang.duration.minutes"');
    expect(lang).not.toContain('time: "2 min"');
    expect(lang).not.toContain('time: "Daily"');
    expect(course).toContain("elev.growth.course.markNotDone");
    expect(course).not.toContain('aria-label={done ? "Mark not done" : "Mark done"}');
    expect(coach).toContain("elev.coachcontract.lens.concept.${scholar.slug}");
    expect(coach).not.toContain("(${scholar.concept})");
  });

  it("NEGATIVE CONTROL: the pre-fix literals would be caught by these same checks", () => {
    const preFixStrengths = '<PageHeader eyebrow="My Child" title={t("sec.strengths.title")} />';
    expect(preFixStrengths.includes('eyebrow="My Child"')).toBe(true);
    const preFixPlay = '{activeGoals.length > 0 ? `${activeGoals.length} goal${activeGoals.length !== 1 ? "s" : ""} active` : "Set a focus"}';
    expect(preFixPlay.includes('"Set a focus"')).toBe(true);
    const preFixCoach = '{scholar ? `${scholar.name} (${scholar.concept})` : t("coach.lens.integrated")}';
    expect(preFixCoach.includes("(${scholar.concept})")).toBe(true);
  });
});
