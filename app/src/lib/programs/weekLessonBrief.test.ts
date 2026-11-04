/**
 * B-PROG-14 — every Talk Together and Steady Nights week has four lines
 * (example, words, reason, fallback), each one a sentence that week already
 * carries. The face stays dark until B-GA-02 reviews the mapping.
 */
import { describe, expect, it } from "vitest";
import { TALK_TOGETHER } from "../../content/programs/talkTogether";
import { STEADY_NIGHTS } from "../../content/programs/steadyNights";
import { PRACTICES } from "../../content/practices";
import type { LocalizedText } from "../../content/governance";
import type { Program, ProgramWeek } from "../../content/programs/types";
import { ACCOUNT_DEVICE_KEYS } from "../childDataSinks";
import { PROGRAM_WEEK_LESSON_FLAG, programWeekLessonOn, weekLessonBrief } from "./weekLessonBrief";

const PROGRAMS = [TALK_TOGETHER, STEADY_NIGHTS] as const;

/** The mapping claim, pinned separately from the module so a quiet swap fails. */
const CLAIM: Record<string, Record<number, { example: LocalizedText; words: LocalizedText; fallback: LocalizedText }>> = {
  "talk-together": {
    1: from(TALK_TOGETHER, 1, "tt-w1-s1", "tt-w1-s2", "tt-w1-s3"),
    2: say(TALK_TOGETHER, 2, "tt-w2-s1", "pr-cdc-30m-4", "tt-w2-s3"),
    3: say(TALK_TOGETHER, 3, "tt-w3-s1", "pr-cdc-36m-6", "tt-w3-s3"),
    4: practice(TALK_TOGETHER, 4, "pr-words-07", "tt-w4-s3"),
    5: practice(TALK_TOGETHER, 5, "pr-cdc-24m-3", "tt-w5-s3"),
    6: practice(TALK_TOGETHER, 6, "pr-cdc-24m-4", "tt-w6-s1"),
    7: practice(TALK_TOGETHER, 7, "pr-words-03", "tt-w7-s3"),
    8: say(TALK_TOGETHER, 8, "tt-w8-s1", "pr-cdc-48m-7", "tt-w8-s3"),
  },
  "steady-nights": {
    1: practice(STEADY_NIGHTS, 1, "pr-sleep-07", "sn-w1-s3"),
    2: practice(STEADY_NIGHTS, 2, "pr-sleep-11", "sn-w2-s2"),
    3: practice(STEADY_NIGHTS, 3, "pr-sleep-04", "sn-w3-s3"),
    4: from(STEADY_NIGHTS, 4, "sn-w4-s1", "sn-w4-s2", "sn-w4-s3"),
    5: practice(STEADY_NIGHTS, 5, "pr-sleep-19", "sn-w5-s2"),
    6: practice(STEADY_NIGHTS, 6, "pr-sleep-21", "sn-w6-s2"),
  },
};

function week(program: Program, n: number): ProgramWeek {
  const found = program.weeks.find((item) => item.n === n);
  if (!found) throw new Error(`${program.id} week ${n}`);
  return found;
}

function script(program: Program, n: number, id: string): LocalizedText {
  const text = week(program, n).coachScripts.find((item) => item.id === id)?.text;
  if (!text) throw new Error(id);
  return text;
}

function practiceText(id: string, field: "do" | "say"): LocalizedText {
  const text = PRACTICES.find((item) => item.id === id)?.[field];
  if (!text) throw new Error(id);
  return text;
}

/** Example, words and fallback are three coach scripts. */
function from(program: Program, n: number, exampleId: string, wordsId: string, fallbackId: string) {
  return { example: script(program, n, exampleId), words: script(program, n, wordsId), fallback: script(program, n, fallbackId) };
}

/** Example is a script, words are a practice say-line, fallback is a script. */
function say(program: Program, n: number, exampleId: string, practiceId: string, fallbackId: string) {
  return { example: script(program, n, exampleId), words: practiceText(practiceId, "say"), fallback: script(program, n, fallbackId) };
}

/** Example and words are one practice's do and say; fallback is a script. */
function practice(program: Program, n: number, practiceId: string, fallbackId: string) {
  return { example: practiceText(practiceId, "do"), words: practiceText(practiceId, "say"), fallback: script(program, n, fallbackId) };
}

describe("B-PROG-14 · the pilot flag", () => {
  it("stays off unless the flag is exactly \"1\", and fails closed", () => {
    expect(PROGRAM_WEEK_LESSON_FLAG).toBe("arbor.flags.programWeekLesson");
    expect(ACCOUNT_DEVICE_KEYS[PROGRAM_WEEK_LESSON_FLAG]).toMatch(/B-GA-02/);
    expect(programWeekLessonOn(null)).toBe(false);
    expect(programWeekLessonOn({ getItem: () => null })).toBe(false);
    expect(programWeekLessonOn({ getItem: () => "0" })).toBe(false);
    expect(programWeekLessonOn({ getItem: () => "1" })).toBe(true);
    expect(programWeekLessonOn({ getItem: () => { throw new Error("denied"); } })).toBe(false);
  });
});

describe("B-PROG-14 · every week names example, words, reason and fallback", () => {
  for (const program of PROGRAMS) {
    it(`${program.id}: each week, both languages, and only sentences that week already carries`, () => {
      expect(Object.keys(CLAIM[program.id]).map(Number).sort((a, b) => a - b)).toEqual(program.weeks.map((item) => item.n));
      for (const item of program.weeks) {
        const face = weekLessonBrief(program.id, item);
        const claim = CLAIM[program.id][item.n];
        expect(face, `week ${item.n}`).not.toBeNull();
        expect(face!.example).toEqual(claim.example);
        expect(face!.words).toEqual(claim.words);
        expect(face!.fallback).toEqual(claim.fallback);
        expect(face!.reason).toEqual(item.skill);
        const lines = [face!.example, face!.words, face!.reason, face!.fallback];
        expect(new Set(lines.map((text) => text.en)).size, `week ${item.n} lines repeat`).toBe(4);
        for (const text of lines) {
          expect(text.en.trim()).toBeTruthy();
          expect(text.he.trim()).toBeTruthy();
          expect(text.he).not.toBe(text.en);
        }
      }
    });
  }

  it("weeks 4 and 7, which have no Learn read, still have the four lines", () => {
    for (const n of [4, 7]) {
      const item = TALK_TOGETHER.weeks.find((weekItem) => weekItem.n === n)!;
      expect(item.lesson).toBeUndefined();
      expect(weekLessonBrief("talk-together", item)?.words.en).toMatch(/cat|truck/i);
    }
  });

  it("fails quiet: an unknown program, a week the map does not name, or a missing script", () => {
    const item = TALK_TOGETHER.weeks[0];
    expect(weekLessonBrief(undefined, item)).toBeNull();
    expect(weekLessonBrief("other", item)).toBeNull();
    expect(weekLessonBrief("talk-together", { ...item, n: 99 })).toBeNull();
    expect(weekLessonBrief("talk-together", { ...item, coachScripts: [] })).toBeNull();
    expect(weekLessonBrief("talk-together", { n: 4, skill: item.skill })).toBeNull();
    expect(weekLessonBrief("talk-together", null)).toBeNull();
  });
});
