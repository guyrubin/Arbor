/**
 * GP-08 residue · RUN-08 · law 1 (Focus chip) · GP-25 · language primary move
 * · MOB-21 — six §3b rows that all say the same thing: the screen was telling
 * the parent something that was not true, or was not the thing they came for.
 *
 *  • The Journey and Copilot historical-progression rows printed a denominator
 *    from the WHOLE 0–6y catalogue — "0 of 38" for a three-year-old, 38 being
 *    mostly milestones that are not this child's age to reach. The Copilot's
 *    own LIVE cards had already moved to the age window; only the snapshot
 *    block had not.
 *  • Journey's four stat cards all read 0 on day 0 — a wall of zeros that
 *    teaches nothing and reads as a report card already failed.
 *  • "Focus: {domain}", a bare domain pointer with no why-line, sat on a
 *    parent surface. `recommend()` is charter-aimed since Builder A, but the
 *    CHIP never said so, and a pointer at an area of a child is a verdict
 *    however it was produced (law 1).
 *  • The Science page claimed "40+ cited public sources" above six rendered
 *    rows (law 8), and its data-collection list omitted the approved-memory
 *    ledger entirely while naming three of the nine profile fields the edit
 *    drawer writes.
 *  • The Language Lab's log form — its primary move — rendered at y 2431.
 *  • Onboarding's avatar step said "Continue" and opened a modal.
 *
 * Negative controls are the pre-fix expressions, each shown to be detectable.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as growth from "../../lib/i18nElevation/growth";
import * as authCopy from "../../lib/i18nElevation/auth";
import { en as trustEn, he as trustHe } from "../../lib/i18nElevation/trustcenter";

const SRC = path.resolve(__dirname, "..", "..");
const read = (f: string) => readFileSync(path.join(SRC, f), "utf8");
const journey = read("components/practice/JourneyTab.tsx");
const copilot = read("components/practice/DevelopmentCopilot.tsx");
const science = read("components/tabs/SciencePage.tsx");
const langTab = read("components/tabs/LanguageLabTab.tsx");
const vocab = read("components/tabs/LanguageLabVocabView.tsx");
const onboarding = read("components/auth/OnboardingFlow.tsx");

const HEBREW = /[֐-׿]/;
const at = (src: string, marker: string) => {
  const i = src.indexOf(marker);
  expect(i, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return i;
};

describe("GP-08 · the denominator is the child's age window, everywhere", () => {
  it("Journey computes its counts from ageWindowMilestones, not the catalogue", () => {
    expect(journey).toContain("ageWindowMilestones(milestones, comparisonAgeMonths(");
    expect(journey).toContain("domainMilestoneCounts(inWindow)");
    // NEGATIVE CONTROL: the pre-fix line counted every milestone that exists.
    expect(journey).not.toContain("domainMilestoneCounts(milestones), [milestones])");
  });

  it("both snapshot blocks drop a domain with nothing in the window", () => {
    for (const [name, src] of [["JourneyTab", journey], ["DevelopmentCopilot", copilot]] as const) {
      expect(src, `${name} still renders 0 of 0`).toContain("if (total === 0) return null;");
      // The total comes from the window, never from the persisted all-ages value.
      expect(src, `${name} still trusts the persisted total`).not.toContain("b.total ?? fallback?.total ?? 0");
      expect(src).toContain("Math.min(b.reached ??");
    }
  });

  it("NEGATIVE CONTROL: the pre-fix denominator expression is the one that was removed", () => {
    const preFix = "const total = b.total ?? fallback?.total ?? 0;";
    expect(preFix.includes("b.total")).toBe(true);
    expect(journey.includes(preFix)).toBe(false);
    expect(copilot.includes(preFix)).toBe(false);
  });
});

describe("RUN-08 · the Journey zero wall becomes one teach line", () => {
  it("the stat row is gated on there being something to count", () => {
    expect(journey).toContain("const statsAreEmpty =");
    expect(journey).toContain('data-testid="journey-zero-teach"');
    expect(journey).toContain('t("elev.growth.journey.zeroTeach")');
    // The teach line renders BEFORE the cards it replaces.
    expect(at(journey, "journey-zero-teach")).toBeLessThan(at(journey, "elev.practice.journey.missionsDone"));
  });

  it("the teach line exists in both locales and names the move that ends the wall", () => {
    expect(growth.en["elev.growth.journey.zeroTeach"]).toBeTruthy();
    expect(HEBREW.test(growth.he["elev.growth.journey.zeroTeach"] ?? "")).toBe(true);
  });

  it("the emptiness test covers all four cards, not just one", () => {
    const line = journey.slice(at(journey, "const statsAreEmpty ="));
    const decl = line.slice(0, line.indexOf(";"));
    for (const part of ["missionsDone === 0", "activeDays === 0", "objectivesDone === 0", "earnedCount === 0"]) {
      expect(decl, part).toContain(part);
    }
  });
});

describe("law 1 · the week chip names the family's aim, or says nothing", () => {
  it("the bare Focus pointer is gone; the chip reads the charter aim", () => {
    expect(journey).not.toContain("Focus: {DOMAIN_META[copilot.recommendation.domain].label}");
    expect(journey).toContain("aims.length > 0");
    // R22/R23 (Builder L): the aim chip's domain name resolves through
    // DOMAIN_META.labelKey now (EN + HE) instead of the English-only `label`.
    // Same selector, same chip — the name is just readable in both languages.
    expect(journey).toContain('t("elev.growth.journey.aim", { domain: t(DOMAIN_META[aims[0]].labelKey) })');
    // The aim comes from the charter selector, not from a reading of the child.
    expect(journey).toContain("aimDomains(aimVirtues(loadCharter()))");
    expect(growth.en["elev.growth.journey.aim"]).toContain("{domain}");
    expect(HEBREW.test(growth.he["elev.growth.journey.aim"] ?? "")).toBe(true);
  });

  it("NEGATIVE CONTROL: the pre-fix chip named a domain with no why-line", () => {
    const preFix = '<Chip tone="mint">Focus: {DOMAIN_META[copilot.recommendation.domain].label}</Chip>';
    expect(preFix.includes("Focus:")).toBe(true);
    expect(journey.includes(preFix)).toBe(false);
  });
});

describe("GP-25 · the Science page counts what it lists", () => {
  it('"40+" is replaced by the length of the list under it', () => {
    expect(science).toContain("value={String(CITATIONS.length)}");
    expect(science).not.toContain('value="40+"');
  });

  it("the data-collection list includes the memory ledger, in both locales", () => {
    expect(science).toContain('"screening", "coach", "memory"');
    for (const key of ["elev.trust.data.memory.label", "elev.trust.data.memory.desc"]) {
      expect(trustEn[key], `${key} missing from en`).toBeTruthy();
      expect(HEBREW.test(trustHe[key] ?? ""), `${key} he is not transcreated`).toBe(true);
    }
  });

  it("the profile row names the fields the edit drawer actually writes", () => {
    const desc = trustEn["elev.trust.data.profile.desc"];
    for (const field of ["languages", "school", "strengths", "challenges", "interests", "avatar"]) {
      expect(desc.toLowerCase(), `the notice omits ${field}`).toContain(field);
    }
    // NEGATIVE CONTROL: the pre-fix line named three fields.
    const preFix = "Name, birth date, and the interests you add.";
    expect(preFix.toLowerCase().includes("strengths")).toBe(false);
    expect(desc).not.toBe(preFix);
  });
});

describe("the primary move comes first", () => {
  it("the Language Lab log form is mounted under the hub header", () => {
    expect(langTab).toContain("import LanguageLabVocabView, { PhraseLogForm }");
    expect(langTab).toContain("<PhraseLogForm childId={childProfile.id}");
    // It renders before the daily-practice card and before the vocabulary view.
    const form = at(langTab, "<PhraseLogForm childId");
    expect(form).toBeLessThan(at(langTab, "lang.routinesTitle"));
    expect(form).toBeLessThan(at(langTab, "<LanguageLabVocabView />"));
    // ...and no longer at the bottom of the vocabulary view.
    expect(vocab).toContain("export function PhraseLogForm");
    expect(vocab).not.toContain("<PhraseLogForm\n        childId={childId}");
  });

  it("MOB-21 · the avatar CTA names what the tap does", () => {
    expect(onboarding).toContain('t("elev.auth.avatar.cta", { name: childName })');
    expect(authCopy.en["elev.auth.avatar.cta"]).toContain("{name}");
    expect(HEBREW.test(authCopy.he["elev.auth.avatar.cta"] ?? "")).toBe(true);
    // NEGATIVE CONTROL: the step's own button no longer says "Continue".
    const step = onboarding.slice(at(onboarding, "function StepAvatar"), at(onboarding, "First-run promise card"));
    expect(step).not.toContain('t("ob.step.continue")');
  });
});
