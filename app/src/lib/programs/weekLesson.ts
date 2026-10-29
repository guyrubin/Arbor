/**
 * B-PROG-14 — "This week's idea": each program week opens ONE Learn read.
 *
 * The week's lesson is a Learn card id on the program week (content/programs
 * `ProgramWeek.lesson`); the read itself is the existing Learn content object
 * (hook, five key points, the read, one thing to try today), opened through
 * the existing deep-link seam (ArborContext requestLearnRead). Nothing new is
 * authored here and nothing is written: the door's "once a week" is the
 * parent's own Learn read state (learn/learnReadState, per child) — the door
 * shows while this week's read is unopened and goes away once it is opened;
 * the next week names a different read, so the door comes back once.
 *
 * Fails quiet: a week with no lesson, or a lesson the catalogue no longer
 * carries (withdrawn, an expired pilot), shows no door — never a dead one.
 */
import type { ProgramWeek } from "../../content/programs/types";
import { learnCardById } from "../../learn/learnCards";
import type { LearnCard } from "../../learn/learnLibrary";

export function programWeekLesson(week: Pick<ProgramWeek, "lesson"> | null | undefined): LearnCard | null {
  const id = week?.lesson;
  return id ? learnCardById(id) ?? null : null;
}

/** The door's card: this week's lesson while the parent has not opened it for this child; else null. */
export function weekLessonDoor(week: Pick<ProgramWeek, "lesson"> | null | undefined, readIds: readonly string[]): LearnCard | null {
  const card = programWeekLesson(week);
  return card && !readIds.includes(card.id) ? card : null;
}
