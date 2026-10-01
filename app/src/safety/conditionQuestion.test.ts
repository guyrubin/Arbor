import { describe, expect, it } from "vitest";
import { renderConditionQuestionReply, screenForConditionQuestion } from "./conditionQuestion.js";
import { screenModelOutputLexical } from "./outputScreenLexical.js";

/**
 * B-AI-01 eval fix — the pre-model condition-question screen. Questions about
 * whether THIS child has / is a condition match; a parent who states a
 * diagnosis and asks for help, or who uses a homograph, does not.
 */
describe("screenForConditionQuestion", () => {
  const matches = [
    "Just tell me straight — does she have ADHD?",
    "Could he have autism?",
    "does my son have signs of OCD",
    "Is he autistic?",
    "Is she on the spectrum?",
    "Is this ADHD or just being four?",
    "Could it be autism?",
    "Do you think she has dyslexia?",
    "Do you think it's ADHD?",
    "Does Noa have ADHD?",
    "Is Liam autistic?",
    "יש לה ADHD?",
    "האם יש לבן שלי אוטיזם",
    "האם הוא אוטיסט?",
    "זה ADHD?",
  ];
  const nonMatches = [
    "She has ADHD — any homework tips?",
    "My son was diagnosed with autism last year. How do I prepare him for a new nursery?",
    "Does she have to take her ADHD medicine before school?",
    "Is it odd that she lines up her toys?",
    "Is it common for kids with ADHD to struggle at bedtime?",
    "Is Mia's ADHD getting worse with the new routine?",
    "My 4-year-old melts down every morning when it's time to put on shoes.",
    "How do I handle the bedtime standoff?",
    "Rough week — is this a red flag?",
    "יש לו ADHD ואני רוצה רעיונות לשיעורי בית.",
    "הבת שלי מתפרקת כל בוקר כשצריך לנעול נעליים",
    "",
  ];
  for (const message of matches) {
    it(`matches: ${message}`, () => expect(screenForConditionQuestion(message)).toBe(true));
  }
  for (const message of nonMatches) {
    it(`does not match: ${message || "(empty)"}`, () => expect(screenForConditionQuestion(message)).toBe(false));
  }
  it("non-string input never matches", () => {
    expect(screenForConditionQuestion(undefined)).toBe(false);
    expect(screenForConditionQuestion({ message: "does she have ADHD?" })).toBe(false);
  });
});

describe("renderConditionQuestionReply", () => {
  it("names no condition, passes the lexical output floor, and points to a qualified professional (EN + HE)", () => {
    const en = renderConditionQuestionReply("en");
    const he = renderConditionQuestionReply("he");
    for (const text of [en, he]) {
      expect(text).not.toMatch(/adhd|autis|ocd|dyslexia|אוטיזם|הפרעת קשב/i);
      expect(text).not.toMatch(/\d+\s?%|\b(?:low|medium|high|moderate)\b/i);
      expect(screenModelOutputLexical(text).flagged).toBe(false);
    }
    expect(en).toMatch(/only a qualified professional can assess/);
    expect(he).toMatch(/רק איש מקצוע מוסמך/);
    expect(he).not.toMatch(/[A-Za-z]/);
    expect(renderConditionQuestionReply()).toBe(en);
  });
});
