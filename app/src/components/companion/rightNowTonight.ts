import { childScopedKey } from "../../lib/childLocalState";

/* v4.1 (12 Nov) — tonight's questions answered INSIDE Right now, one tap
   each, as the design draws them ("Tonight · question 1 of 3. One tap is
   enough."), instead of a door to the full Tonight flow.

   The questions are the full flow's own, through its own seams (useNowLoop's
   `tonight`): did you try today's practice (only one the parent SAW and has
   not answered), the one thing to notice, and the day's words. The words
   question opens the full flow at its words step, so the parent writes in
   the reviewed field; nothing here writes a sentence of its own.

   Progress is kept per child and per day on the device, so a reload does not
   ask an answered question again; a new day starts empty. The key is
   child-scoped (`arbor.rightNowTonight.<childId>`), swept when the child's
   device state is cleared. Only question ids and a count are stored, never
   an answer's words. */

export type TonightQuestion = "practice" | "notice" | "words";
export const TONIGHT_ORDER: readonly TonightQuestion[] = ["practice", "notice", "words"];

export interface TonightProgress { day: string; done: TonightQuestion[]; kept: number }

type StorageLike = Pick<Storage, "getItem" | "setItem"> | null;

const deviceStore = (): StorageLike => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const empty = (day: string): TonightProgress => ({ day, done: [], kept: 0 });

export function readTonightProgress(childId: string, day: string, storage: StorageLike = deviceStore()): TonightProgress {
  if (!childId || !storage) return empty(day);
  try {
    const raw = storage.getItem(childScopedKey("rightNowTonight", childId));
    const parsed = raw ? JSON.parse(raw) as Partial<TonightProgress> : null;
    if (!parsed || parsed.day !== day || !Array.isArray(parsed.done)) return empty(day);
    const done = TONIGHT_ORDER.filter((q) => parsed.done!.includes(q));
    const kept = typeof parsed.kept === "number" && Number.isFinite(parsed.kept) ? Math.max(0, Math.min(done.length, Math.floor(parsed.kept))) : 0;
    return { day, done, kept };
  } catch {
    return empty(day);
  }
}

export function writeTonightProgress(childId: string, progress: TonightProgress, storage: StorageLike = deviceStore()): void {
  if (!childId || !storage) return;
  try {
    storage.setItem(childScopedKey("rightNowTonight", childId), JSON.stringify(progress));
  } catch {
    /* a full or private store keeps this render's progress only */
  }
}

/** One question answered (kept: it wrote an answer to the record). */
export function answerTonight(progress: TonightProgress, question: TonightQuestion, kept: boolean): TonightProgress {
  if (progress.done.includes(question)) return progress;
  return { day: progress.day, done: TONIGHT_ORDER.filter((q) => q === question || progress.done.includes(q)), kept: progress.kept + (kept ? 1 : 0) };
}

/**
 * The evening's queue. `total` counts what was asked tonight plus what is
 * still open, so answering one (which can retire its source, e.g. the dose
 * row now exists) never shrinks "of 3" to "of 2" mid-evening.
 */
export function tonightQueue(available: Readonly<Record<TonightQuestion, boolean>>, progress: TonightProgress): {
  next: TonightQuestion | null; index: number; total: number; finished: boolean;
} {
  const open = TONIGHT_ORDER.filter((q) => available[q] && !progress.done.includes(q));
  const total = progress.done.length + open.length;
  const next = open[0] ?? null;
  return { next, index: progress.done.length + 1, total, finished: !next && progress.done.length > 0 };
}
