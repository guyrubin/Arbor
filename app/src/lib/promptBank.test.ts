import { describe, it, expect } from "vitest";
import {
  dailyPromptKeys,
  promptKey,
  localDayStamp,
  fnv1a,
  PROMPTS_PER_BAND,
  DAILY_PROMPT_COUNT,
  PROMPT_BANDS,
} from "./promptBank";
import { en as journalEn, he as journalHe } from "./i18nElevation/journal";

const DATE = new Date(2026, 6, 9, 14, 30); // 2026-07-09 local

describe("promptBank — deterministic daily rotation (E9)", () => {
  it("is deterministic: same child + same local day → same 3 keys", () => {
    const a = dailyPromptKeys({ ageYears: 4, childId: "child-1", date: DATE });
    const b = dailyPromptKeys({ ageYears: 4, childId: "child-1", date: new Date(2026, 6, 9, 23, 59) });
    expect(a).toEqual(b);
  });

  it("returns exactly 3 distinct keys, all inside the child's band", () => {
    for (let day = 1; day <= 31; day++) {
      const keys = dailyPromptKeys({ ageYears: 2, childId: "kid", date: new Date(2026, 0, day) });
      expect(keys).toHaveLength(DAILY_PROMPT_COUNT);
      expect(new Set(keys).size).toBe(DAILY_PROMPT_COUNT);
      for (const k of keys) expect(k).toMatch(/^elev\.prompt\.toddler\.([1-9]|[12][0-9]|30)$/);
    }
  });

  it("rotates across days and differs between siblings", () => {
    const today = dailyPromptKeys({ ageYears: 6, childId: "kid-a", date: new Date(2026, 6, 9) });
    const tomorrow = dailyPromptKeys({ ageYears: 6, childId: "kid-a", date: new Date(2026, 6, 10) });
    const sibling = dailyPromptKeys({ ageYears: 6, childId: "kid-b", date: new Date(2026, 6, 9) });
    expect(today).not.toEqual(tomorrow);
    expect(today).not.toEqual(sibling);
  });

  it("maps ages to the playbank bands", () => {
    expect(dailyPromptKeys({ ageYears: 0.5, childId: "x", date: DATE })[0]).toContain(".infant.");
    expect(dailyPromptKeys({ ageYears: 2, childId: "x", date: DATE })[0]).toContain(".toddler.");
    expect(dailyPromptKeys({ ageYears: 4, childId: "x", date: DATE })[0]).toContain(".preschool.");
    expect(dailyPromptKeys({ ageYears: 8, childId: "x", date: DATE })[0]).toContain(".early-school.");
  });

  it("helpers behave: local day stamp + stable hash", () => {
    expect(localDayStamp(DATE)).toBe("2026-07-09");
    expect(fnv1a("a|2026-07-09")).toBe(fnv1a("a|2026-07-09"));
    expect(fnv1a("a")).not.toBe(fnv1a("b"));
  });

  it("every possible prompt key exists in the journal i18n module, EN + HE, 30 per band", () => {
    for (const band of PROMPT_BANDS) {
      for (let i = 0; i < PROMPTS_PER_BAND; i++) {
        const key = promptKey(band, i);
        expect(journalEn[key], `missing EN ${key}`).toBeTruthy();
        expect(journalHe[key], `missing HE ${key}`).toBeTruthy();
      }
      // The bank holds EXACTLY the authored count (no stray 31st key).
      expect(journalEn[`elev.prompt.${band}.${PROMPTS_PER_BAND + 1}`]).toBeUndefined();
    }
  });
});
