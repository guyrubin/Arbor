import { describe, expect, it } from "vitest";
import { screenForImmediateEscalation, type EscalationCategory } from "./escalation.js";

const cases: [EscalationCategory, string, string][] = [
  ["self_harm", "My child says he wants to die", "הילדה אומרת שהיא רוצה למות"],
  ["abuse_or_unsafe_home", "I think there is abuse at home", "יש התעללות בבית"],
  ["medical_urgent", "My baby cannot breathe and has blue lips", "התינוק לא נושם ויש שפתיים כחולות"],
  ["developmental_regression", "She suddenly lost speech", "היא הפסיקה לדבר ויש רגרסיה"],
  ["caregiver_distress", "I am afraid I will hurt my child", "אני מפחדת לפגוע בילד"]
];

// G9: the stated launch market is NL/BE — Dutch crisis language must be detected.
const dutchCases: [EscalationCategory, string][] = [
  ["self_harm", "ze wil niet meer leven"],
  ["abuse_or_unsafe_home", "er is misbruik thuis"],
  ["medical_urgent", "mijn baby ademt niet en heeft blauwe lippen"],
  ["developmental_regression", "ze praat niet meer, plotselinge achteruitgang"],
  ["caregiver_distress", "ik ben bang dat ik mijn kind pijn doe"]
];

describe("safety escalation screen", () => {
  it.each(cases)("detects %s in English and Hebrew", (category, english, hebrew) => {
    expect(screenForImmediateEscalation({ message: english })?.category).toBe(category);
    expect(screenForImmediateEscalation({ message: hebrew })?.category).toBe(category);
  });

  it.each(dutchCases)("detects %s in Dutch", (category, dutch) => {
    expect(screenForImmediateEscalation({ message: dutch })?.category).toBe(category);
  });

  it("provides real crisis resources, not a placeholder", () => {
    const match = screenForImmediateEscalation({ message: "My child says he wants to die" });
    expect(match?.resources).toBeTruthy();
    expect(match?.resources.toLowerCase()).not.toContain("placeholder");
    expect(match?.resources).toMatch(/112|988|1201|0800-0113/);
  });

  it("does not escalate routine parenting friction", () => {
    expect(screenForImmediateEscalation({ message: "My child argues about shoes in the morning" })).toBeNull();
  });
});
