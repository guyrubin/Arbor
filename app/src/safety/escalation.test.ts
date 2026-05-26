import { describe, expect, it } from "vitest";
import { screenForImmediateEscalation, type EscalationCategory } from "./escalation.js";

const cases: [EscalationCategory, string, string][] = [
  ["self_harm", "My child says he wants to die", "הילדה אומרת שהיא רוצה למות"],
  ["abuse_or_unsafe_home", "I think there is abuse at home", "יש התעללות בבית"],
  ["medical_urgent", "My baby cannot breathe and has blue lips", "התינוק לא נושם ויש שפתיים כחולות"],
  ["developmental_regression", "She suddenly lost speech", "היא הפסיקה לדבר ויש רגרסיה"],
  ["caregiver_distress", "I am afraid I will hurt my child", "אני מפחדת לפגוע בילד"]
];

describe("safety escalation screen", () => {
  it.each(cases)("detects %s in English and Hebrew", (category, english, hebrew) => {
    expect(screenForImmediateEscalation({ message: english })?.category).toBe(category);
    expect(screenForImmediateEscalation({ message: hebrew })?.category).toBe(category);
  });

  it("does not escalate routine parenting friction", () => {
    expect(screenForImmediateEscalation({ message: "My child argues about shoes in the morning" })).toBeNull();
  });
});
