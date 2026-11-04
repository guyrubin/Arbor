/**
 * B-PROG-14 — the week's idea as four lines: an example, words, a reason,
 * and a fallback.
 *
 * Every line is a sentence the program week already carries: its skill, one
 * of its coach scripts, or the do / say of a practice that week already
 * names. Nothing here is new guidance. Which sentence fills which line is a
 * mapping, and B-GA-02 has not signed it (15 October feedback is not
 * reviewer approval). The face stays dark until
 * `arbor.flags.programWeekLesson` is "1". Off, Now keeps the title-only door.
 *
 * A week with no fitting Learn read (Talk Together 4 and 7) still has a face:
 * the week's own practice, not an off-skill article. Fails quiet: a missing
 * script, a practice the week does not name, or an unknown program shows
 * nothing — never a half lesson.
 */
import { PRACTICES } from "../../content/practices";
import type { LocalizedText } from "../../content/governance";
import type { ProgramWeek } from "../../content/programs/types";

export const PROGRAM_WEEK_LESSON_FLAG = "arbor.flags.programWeekLesson";

type StorageLike = { getItem(key: string): string | null } | null | undefined;

const deviceStorage = (): StorageLike => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Off unless the pilot flag says "1". Fails closed. */
export function programWeekLessonOn(storage?: StorageLike): boolean {
  const store = storage === undefined ? deviceStorage() : storage;
  try {
    return store?.getItem(PROGRAM_WEEK_LESSON_FLAG) === "1";
  } catch {
    return false;
  }
}

export interface WeekLessonFace {
  example: LocalizedText;
  words: LocalizedText;
  reason: LocalizedText;
  fallback: LocalizedText;
}

type LineRef =
  | { from: "script"; id: string }
  | { from: "practice"; id: string; field: "do" | "say" };

interface WeekLines {
  example: LineRef;
  words: LineRef;
  fallback: LineRef;
}

/**
 * The claim B-GA-02 reviews. Reason is always the week's skill.
 * Words are a sentence said to the child when the week has one that teaches
 * the skill; otherwise the week's own script (week 1 says nothing yet, and
 * the diary week has no say-line about the diary).
 */
const WEEK_LINES: Record<string, Record<number, WeekLines>> = {
  "talk-together": {
    1: { example: { from: "script", id: "tt-w1-s1" }, words: { from: "script", id: "tt-w1-s2" }, fallback: { from: "script", id: "tt-w1-s3" } },
    2: { example: { from: "script", id: "tt-w2-s1" }, words: { from: "practice", id: "pr-cdc-30m-4", field: "say" }, fallback: { from: "script", id: "tt-w2-s3" } },
    3: { example: { from: "script", id: "tt-w3-s1" }, words: { from: "practice", id: "pr-cdc-36m-6", field: "say" }, fallback: { from: "script", id: "tt-w3-s3" } },
    4: { example: { from: "practice", id: "pr-words-07", field: "do" }, words: { from: "practice", id: "pr-words-07", field: "say" }, fallback: { from: "script", id: "tt-w4-s3" } },
    5: { example: { from: "practice", id: "pr-cdc-24m-3", field: "do" }, words: { from: "practice", id: "pr-cdc-24m-3", field: "say" }, fallback: { from: "script", id: "tt-w5-s3" } },
    6: { example: { from: "practice", id: "pr-cdc-24m-4", field: "do" }, words: { from: "practice", id: "pr-cdc-24m-4", field: "say" }, fallback: { from: "script", id: "tt-w6-s1" } },
    7: { example: { from: "practice", id: "pr-words-03", field: "do" }, words: { from: "practice", id: "pr-words-03", field: "say" }, fallback: { from: "script", id: "tt-w7-s3" } },
    8: { example: { from: "script", id: "tt-w8-s1" }, words: { from: "practice", id: "pr-cdc-48m-7", field: "say" }, fallback: { from: "script", id: "tt-w8-s3" } },
  },
  "steady-nights": {
    1: { example: { from: "practice", id: "pr-sleep-07", field: "do" }, words: { from: "practice", id: "pr-sleep-07", field: "say" }, fallback: { from: "script", id: "sn-w1-s3" } },
    2: { example: { from: "practice", id: "pr-sleep-11", field: "do" }, words: { from: "practice", id: "pr-sleep-11", field: "say" }, fallback: { from: "script", id: "sn-w2-s2" } },
    3: { example: { from: "practice", id: "pr-sleep-04", field: "do" }, words: { from: "practice", id: "pr-sleep-04", field: "say" }, fallback: { from: "script", id: "sn-w3-s3" } },
    4: { example: { from: "script", id: "sn-w4-s1" }, words: { from: "script", id: "sn-w4-s2" }, fallback: { from: "script", id: "sn-w4-s3" } },
    5: { example: { from: "practice", id: "pr-sleep-19", field: "do" }, words: { from: "practice", id: "pr-sleep-19", field: "say" }, fallback: { from: "script", id: "sn-w5-s2" } },
    6: { example: { from: "practice", id: "pr-sleep-21", field: "do" }, words: { from: "practice", id: "pr-sleep-21", field: "say" }, fallback: { from: "script", id: "sn-w6-s2" } },
  },
};

function filled(text: LocalizedText | undefined): text is LocalizedText {
  return !!text && !!text.en.trim() && !!text.he.trim();
}

function textFor(week: ProgramWeek, ref: LineRef): LocalizedText | null {
  if (ref.from === "script") {
    const text = week.coachScripts.find((script) => script.id === ref.id)?.text;
    return filled(text) ? text : null;
  }
  if (!week.practices.includes(ref.id)) return null;
  const practice = PRACTICES.find((item) => item.id === ref.id);
  const text = practice?.[ref.field];
  return filled(text) ? text : null;
}

/** The four lines for this week, or null when the mapping cannot be shown whole. */
export function weekLessonBrief(programId: string | undefined, week: Partial<ProgramWeek> | null | undefined): WeekLessonFace | null {
  if (!programId || !week || typeof week.n !== "number" || !filled(week.skill)) return null;
  const mapped = WEEK_LINES[programId]?.[week.n];
  if (!mapped || !Array.isArray(week.coachScripts) || !Array.isArray(week.practices)) return null;
  const full = week as ProgramWeek;
  const example = textFor(full, mapped.example);
  const words = textFor(full, mapped.words);
  const fallback = textFor(full, mapped.fallback);
  if (!example || !words || !fallback) return null;
  return { example, words, reason: week.skill, fallback };
}
