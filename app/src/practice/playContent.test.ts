import { describe, expect, it } from "vitest";
import { EMOTIONS, EMOTION_SCENARIOS, MEMORY_EMOJI_SETS, MEMORY_THEMES } from "./playContent";

const HEBREW_EMOTION_LABELS: Record<string, string> = {
  happy: "שמחה",
  sad: "עצב",
  angry: "כעס",
  frustrated: "תסכול",
  afraid: "פחד",
  excited: "התרגשות",
};

describe("expanded authored play content", () => {
  it("keeps fourteen distinct recognition scenarios with named matching answers in both languages", () => {
    expect(EMOTION_SCENARIOS).toHaveLength(14);
    expect(new Set(EMOTION_SCENARIOS.map((scenario) => scenario.id)).size).toBe(EMOTION_SCENARIOS.length);
    const emotionsById = new Map(EMOTIONS.map((emotion) => [emotion.id, emotion]));
    for (const scenario of EMOTION_SCENARIOS) {
      const choices = [scenario.answer, ...scenario.distractors];
      expect(choices.every((choice) => emotionsById.has(choice))).toBe(true);
      expect(new Set(choices).size).toBe(choices.length);
      expect(scenario.text).toContain(`I feel ${emotionsById.get(scenario.answer)?.label.toLowerCase()}`);
      expect(scenario.text).toContain("Which feeling did");
      expect(scenario.text).not.toContain("talk about together");
      expect(scenario.answerLabelHe).toBe(HEBREW_EMOTION_LABELS[scenario.answer]);
      expect(scenario.textHe).toContain(scenario.answerLabelHe);
      expect(scenario.textHe).toContain("איזה רגש");
    }
  });

  it("exposes five selectable eight-symbol memory themes through the legacy alias", () => {
    expect(MEMORY_THEMES).toHaveLength(5);
    expect(MEMORY_EMOJI_SETS).toBe(MEMORY_THEMES);
    expect(new Set(MEMORY_THEMES.map((theme) => theme.id)).size).toBe(MEMORY_THEMES.length);
    for (const theme of MEMORY_THEMES) {
      expect(theme.emojis).toHaveLength(8);
      expect(new Set(theme.emojis).size).toBe(8);
      expect(theme.titleHe.length).toBeGreaterThan(0);
    }
  });
});