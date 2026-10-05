/**
 * Sneak & Freeze sound table — B-GAME-07b (files: B-GAME-08).
 *
 * ONE place that names every sound event the rules emit. Today each maps to
 * an existing kidAudio cue or to nothing: ruling G13 keeps synthesised beeps
 * and device text-to-speech OUT of the scene, so only the two celebratory
 * moments use a cue until the recorded files exist. When B-GAME-08 lands,
 * `file` is the clip each event plays (app/public/audio/kid/sneak/), with
 * EN + HE voice variants where a line is spoken; `cue` goes to null.
 * Every sound obeys the child's Sound control through kidAudio.
 */
import { kidSfx, type KidSfx } from "../../audio/kidAudio";
import type { SneakEventId } from "./rules";

export interface SneakSound {
  /** Existing kidAudio cue played today, or null (silent until the file exists). */
  cue: KidSfx | null;
  /** The recorded clip this event will play (B-GAME-08). */
  file: string;
  /** What the clip is. */
  note: string;
}

export const SNEAK_SOUNDS: Readonly<Record<SneakEventId, SneakSound>> = {
  beat: { cue: null, file: "chant-beat-{n}.{lang}.m4a", note: "the cat counts one beat (EN 'one… two…' / HE 'אחת… שתיים…')" },
  step: { cue: null, file: "step-stone-{1..3}.m4a", note: "a tiptoe step on Jerusalem stone (round-robin)" },
  tell: { cue: null, file: "chant-end.{lang}.m4a", note: "the last word with the ear twitch: 'Freeze!' / 'דג מלוח!'" },
  fake: { cue: null, file: "fake-hehe.m4a", note: "the cat starts to turn, then giggles 'hehe!'" },
  look: { cue: null, file: "turn-whoosh.m4a", note: "the spin round" },
  sunglasses: { cue: null, file: "sunglasses.{lang}.m4a", note: "'My sunglasses! I can't see a thing!'" },
  statue: { cue: null, file: "statue.{lang}.m4a", note: "squint, sniff… 'Just a statue!' / 'סתם פסל!'" },
  caught: { cue: null, file: "caught.{lang}.m4a", note: "giggle + 'I see you!' / 'ראיתי אותך!'" },
  still: { cue: null, file: "hmm.m4a", note: "the cat looks, nothing moved: 'hmm…'" },
  blind: { cue: null, file: "blind.{lang}.m4a", note: "the cat in sunglasses: 'Nothing moved… I think?'" },
  tag: { cue: "correct", file: "tag.{lang}.m4a", note: "the bright two-note tag + 'You got me!' / 'תפסת אותי!'" },
  prize: { cue: "finish", file: "prize-bell.m4a", note: "a real bell as the prize is held up" },
  hint: { cue: null, file: "hint.{lang}.{form}.m4a", note: "'Psst — hold to sneak!' (HE boy / girl / plural)" },
  waiting: { cue: null, file: "wait.{lang}.m4a", note: "the cat sits down: 'I'll wait'" },
  done: { cue: null, file: "finish-sting.m4a", note: "end of the sitting" },
};

/** Play an event's sound (or nothing, today). Never throws. */
export function sneakSound(id: SneakEventId): void {
  const cue = SNEAK_SOUNDS[id]?.cue;
  if (!cue) return;
  try {
    kidSfx(cue);
  } catch {
    /* audio is never load-bearing */
  }
}
