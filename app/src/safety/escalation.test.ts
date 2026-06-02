import { describe, expect, it } from "vitest";
import {
  screenForImmediateEscalation,
  renderEscalationMarkdown,
  resolveCrisisLocale,
  type EscalationCategory
} from "./escalation.js";

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

describe("crisis locale resolution (K-03)", () => {
  it("maps Dutch and Hebrew language hints to localized resources", () => {
    expect(resolveCrisisLocale({ languages: ["Dutch", "English"] })).toBe("nl");
    expect(resolveCrisisLocale({ languages: ["Hebrew (Native)"] })).toBe("il");
    expect(resolveCrisisLocale({ languages: ["English"] })).toBe("intl");
    expect(resolveCrisisLocale(undefined)).toBe("intl");
  });
});

describe("escalation rendering carries real, localized contacts (K-03)", () => {
  it("includes Veilig Thuis for an unsafe-home concern in the Netherlands", () => {
    const md = renderEscalationMarkdown({ category: "abuse_or_unsafe_home", label: "abuse" }, "nl");
    expect(md).toContain("Veilig Thuis");
    expect(md).toContain("0800-2000");
    expect(md).not.toContain("placeholder");
  });

  it("includes ERAN for self-harm in Israel", () => {
    const md = renderEscalationMarkdown({ category: "self_harm", label: "self-harm" }, "il");
    expect(md).toContain("ERAN");
    expect(md).toContain("1201");
  });

  it("never emits placeholder text in any locale", () => {
    for (const locale of ["nl", "il", "intl"] as const) {
      const md = renderEscalationMarkdown({ category: "medical_urgent", label: "urgent" }, locale);
      expect(md.toLowerCase()).not.toContain("placeholder");
      expect(md).toContain("Who To Contact");
    }
  });
});
