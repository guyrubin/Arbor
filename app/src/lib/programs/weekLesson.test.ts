/**
 * B-PROG-14 — each Talk Together and Steady Nights week names ONE Learn read
 * (the existing Learn content object: a hook, five key points, the read and
 * one thing to try today). Old code fails: no week defined `lesson`, so the
 * week's door never showed.
 */
import { describe, expect, it } from "vitest";
import { TALK_TOGETHER, TALK_TOGETHER_META } from "../../content/programs/talkTogether";
import { STEADY_NIGHTS, STEADY_NIGHTS_META } from "../../content/programs/steadyNights";
import { LEARN_PILOT } from "../../learn/learnPilotRelease";
import { programWeekLesson, weekLessonDoor } from "./weekLesson";

const PROGRAMS = [
  { program: TALK_TOGETHER, meta: TALK_TOGETHER_META, category: "language" },
  { program: STEADY_NIGHTS, meta: STEADY_NIGHTS_META, category: "sleep" },
] as const;

describe("B-PROG-14 · every program week names one reviewed Learn read", () => {
  for (const { program, meta, category } of PROGRAMS) {
    it(`${program.id}: each week's lesson is a live Learn card on the program's own shelf, one per week, all different`, () => {
      const ids = program.weeks.map((w) => w.lesson);
      expect(ids.every(Boolean), "a week without a lesson").toBe(true);
      expect(new Set(ids).size).toBe(program.weeks.length);
      for (const week of program.weeks) {
        const card = programWeekLesson(week);
        expect(card, `week ${week.n}: ${week.lesson}`).not.toBeNull();
        expect(card!.category).toBe(category);
        // Not an editorial-pilot read: those expire (3 Dec) and would leave a week without its read.
        expect(Object.keys(LEARN_PILOT.entries)).not.toContain(card!.id);
        // The read fits the ages the program is built for (whole years vs months).
        expect(card!.ageMin * 12).toBeLessThanOrEqual(meta.builtFor.toMonths);
        expect((card!.ageMax + 1) * 12).toBeGreaterThan(meta.builtFor.fromMonths);
        // Concrete, both languages: a thing to try today and a read.
        expect(card!.tryToday.en.trim() && card!.tryToday.he.trim()).toBeTruthy();
        expect(card!.title.he).not.toBe(card!.title.en);
      }
    });
  }
});

describe("B-PROG-14 · the door shows once a week: until this week's read is opened", () => {
  const week = TALK_TOGETHER.weeks[2];
  it("unread → the card; read → no door; the next week names another read, so the door returns once", () => {
    expect(weekLessonDoor(week, [])?.id).toBe(week.lesson);
    expect(weekLessonDoor(week, [week.lesson!])).toBeNull();
    expect(weekLessonDoor(TALK_TOGETHER.weeks[3], [week.lesson!])?.id).toBe(TALK_TOGETHER.weeks[3].lesson);
  });
  it("fails quiet: no lesson or a lesson the catalogue no longer carries → no door, never a dead one", () => {
    expect(weekLessonDoor({}, [])).toBeNull();
    expect(weekLessonDoor({ lesson: "withdrawn-card" }, [])).toBeNull();
    expect(weekLessonDoor(null, [])).toBeNull();
  });
});
