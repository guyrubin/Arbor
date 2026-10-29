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
  { program: TALK_TOGETHER, meta: TALK_TOGETHER_META },
  { program: STEADY_NIGHTS, meta: STEADY_NIGHTS_META },
] as const;

/** Round-2 critic P1: the read must teach the WEEK'S SKILL. These two opened a
 *  worried parent's first week on age norms (late-talker ranges) or sent a
 *  one-language family a bilingual read; no week may name them. */
const OFF_SKILL_READS = [
  "late-talker-ranges", "bilingual-mixing",
  // Round 3 (critic): an age norm and a when-to-see-a-professional point under "Follow the lead".
  "attention-spans",
];
/** Weeks the catalogue holds no on-skill, age-fitting read for: NO lesson, so
 *  no door (weekLessonDoor fails quiet) rather than an off-skill one. */
const NO_LESSON_WEEKS: Record<string, readonly number[]> = { "talk-together": [], "steady-nights": [] };

describe("B-PROG-14 · every program week names one reviewed Learn read", () => {
  for (const { program, meta } of PROGRAMS) {
    it(`${program.id}: each week's lesson is a live Learn card, one per week, all different, never an off-skill read`, () => {
      const empty = NO_LESSON_WEEKS[program.id] ?? [];
      expect(program.weeks.filter((w) => !w.lesson).map((w) => w.n), "only the named weeks go without a read").toEqual([...empty]);
      const ids = program.weeks.flatMap((w) => (w.lesson ? [w.lesson] : []));
      expect(new Set(ids).size).toBe(ids.length);
      for (const week of program.weeks.filter((w) => w.lesson)) {
        const card = programWeekLesson(week);
        expect(card, `week ${week.n}: ${week.lesson}`).not.toBeNull();
        expect(OFF_SKILL_READS, `week ${week.n}`).not.toContain(card!.id);
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

describe("B-PROG-14 · Talk Together: each week's read teaches that week's skill (mapping awaits B-GA-02)", () => {
  // The reader-facing reason for each pairing, so the reviewer reads the claim, not just an id.
  const MAPPING: Record<number, [string, RegExp] | null> = {
    1: ["gestures-before-words", /follow every point|name the thing/i],          // observe, wait, listen: answer what they show you
    2: ["process-over-product", /tell me about it/i],                            // follow the lead: talk about what they chose
    3: ["serve-and-return", /return every serve/i],                               // serve and return
    4: ["questions-that-open", /specific opener|count/i],                         // say it back
    5: ["language-explosion", /name it, expand it/i],                              // add one word
    6: ["reading-aloud", /fills in the last word|reads' one spread/i],           // share a book (dialogic reading for week 7 too)
    7: ["theory-of-mind", /During tonight's story, pause and ask/i],              // book prompts
    8: ["music-and-brain", /give it a song|same tune/i],                         // leave a gap in songs and routines
  };
  for (const week of TALK_TOGETHER.weeks) {
    const m = MAPPING[week.n];
    it(`week ${week.n} → ${m ? m[0] : "no read (no door)"}`, () => {
      if (!m) { expect(week.lesson).toBeUndefined(); expect(weekLessonDoor(week, [])).toBeNull(); return; }
      expect(week.lesson).toBe(m[0]);
      expect(programWeekLesson(week)!.tryToday.en).toMatch(m[1]);
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
