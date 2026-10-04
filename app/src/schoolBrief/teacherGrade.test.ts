/**
 * W2-CAREPRO critic round 1 (school-brief P0) — a teacher never receives a
 * severity grade. The free draft printed "Current focus: Severe transition
 * anxiety (refusal to leave the house), Sensory meltdowns…" directly under
 * "never a diagnosis or a developmental verdict": the diagnosis-only scan let
 * "severe" through. Now the overview carries no focus line, harder moments are
 * their own ungraded list in the parent's words, and the fail-closed export
 * scan refuses grade words in EN and HE.
 */
import { describe, expect, it } from "vitest";
import { buildPacketInput, teacherBriefDraft } from "../consult/packet";
import { ClinicalLanguageError, findClinicalDiagnosisTerm, findTeacherBlockedTerm, findTeacherGradeTerm } from "../lib/clinicalScan";
import { buildSchoolBriefExport } from "./schoolBrief";
import { translate } from "../lib/i18n";
import type { ChildProfile } from "../types";

const DEMO_EN = "Severe transition anxiety (refusal to leave the house)";
const DEMO_HE = "חרדת מעברים חמורה (סירוב לצאת מהבית)";
const KEPT_EN = "Sensory meltdowns in overcrowded dynamic spaces";

function profile(challenges: string[]): ChildProfile {
  return {
    id: "c1", name: "Dylan", age: 4, languages: ["English"], schoolContext: "Gan Shaked",
    strengths: ["Builds towers"], challenges, interests: [],
  } as unknown as ChildProfile;
}

function draftFor(challenges: string[], lang: "en" | "he") {
  return teacherBriefDraft(buildPacketInput({ profile: profile(challenges), logs: [], milestones: [], plans: [], memory: [] }, Date.now()), lang);
}

describe("teacher grade scan — negative control", () => {
  it("the diagnosis scan alone misses the demo grade (this is the hole)", () => {
    expect(findClinicalDiagnosisTerm(DEMO_EN)).toBeNull();
    expect(findClinicalDiagnosisTerm(DEMO_HE)).toBeNull();
  });
  it("the grade scan catches it in EN and HE", () => {
    expect(findTeacherGradeTerm(DEMO_EN)).toBe("severe");
    expect(findTeacherGradeTerm(DEMO_HE)).not.toBeNull();
    expect(findTeacherBlockedTerm("mild speech delay")).toBe("delay");
    expect(findTeacherGradeTerm("He is at-risk at drop-off")).not.toBeNull();
    expect(findTeacherGradeTerm("Builds towers; loves trucks")).toBeNull();
  });
});

describe("teacherBriefDraft — no focus line, harder moments ungraded", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: overview carries basics + setting, never the focus line`, () => {
      const d = draftFor([DEMO_EN, DEMO_HE, KEPT_EN], lang);
      expect(d.overview).toContain("Gan Shaked");
      expect(d.overview).not.toMatch(/Current focus/);
      const focusLabel = translate(lang, "elev.packet.item.focus", { list: "" }).split(/[:：]/)[0].trim();
      if (focusLabel) expect(d.overview).not.toContain(focusLabel);
      expect(d.overview).not.toMatch(/severe|חמור/i);
      expect(d.harderMoments).toEqual([KEPT_EN]);
      expect(findTeacherBlockedTerm(JSON.stringify(d))).toBeNull();
    });
  }
});

describe("buildSchoolBriefExport — fail closed on a grade the parent typed", () => {
  for (const text of [DEMO_EN, DEMO_HE, "Moderately anxious at drop-off"]) {
    it(`blocks: ${text}`, () => {
      expect(() => buildSchoolBriefExport({ overview: "Hi", keyStrengths: [], classroomChallenges: [text], languageSupportPlan: [], suggestedTeacherStrategies: [] }, { title: "t", date: "d" }))
        .toThrow(ClinicalLanguageError);
    });
  }
  it("passes a parent-worded harder moment", () => {
    expect(() => buildSchoolBriefExport({ overview: "Hi", keyStrengths: [], classroomChallenges: [KEPT_EN], languageSupportPlan: [], suggestedTeacherStrategies: [] }, { title: "t", date: "d" }))
      .not.toThrow();
  });
});

describe("brief section labels say what the lists hold", () => {
  it("EN + HE: strengths are strengths, never 'what calms'", () => {
    expect(translate("en", "schoolBrief.section.strengths", { name: "Dylan" })).toBe("What Dylan is great at");
    expect(translate("he", "schoolBrief.section.strengths", { name: "Dylan" })).toBe("החוזקות של ⁨Dylan⁩");
    expect(translate("en", "schoolBrief.section.calm")).toBe("schoolBrief.section.calm");
    expect(translate("he", "schoolBrief.section.harder", { name: "Dylan" })).not.toMatch(/\/|ל\{?D/);
  });
});
