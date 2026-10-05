/**
 * Sneak & Freeze sound table — B-GAME-08a (files rendered for B-GAME-08).
 *
 * ONE place that names what every rules event sounds like. Every sound is a
 * pre-rendered FILE played through the kid sound bank (audio/kidSoundBank.ts)
 * on the shared kid AudioContext — ruling G13: no synthesised beep and no
 * device text-to-speech inside the scene. Voice is in the kid UI language.
 *
 *   /audio/kid/sneak/manifest.json   { ext, he: {id: ms}, en: {…}, foley: {…} }
 *   /audio/kid/sneak/{he|en}/<voice id>.<ext>
 *   /audio/kid/sneak/foley/<foley id>.<ext>
 *
 * Voice never overlaps (the bank): chant words (n1..n5, the freeze call)
 * CUT the line before them; every other line queues behind the current one
 * (at most one waiting). The first sunglasses line of a sitting is not cut by
 * the chant: its count words are skipped while it plays. Every sound obeys
 * the child's Sound control (kidAudio).
 */
import { createKidSoundBank, type KidSoundBank } from "../../audio/kidSoundBank";
import type { SneakEventId, SneakState } from "./rules";

export const SNEAK_AUDIO_BASE = "/audio/kid/sneak";

export const SNEAK_VOICE_IDS = [
  "n1", "n2", "n3", "n4", "n5", "freeze",
  "statue1", "statue2", "statue3", "caught1", "caught2", "tag",
  "intro", "hint", "waiting", "sunglasses", "fake", "laugh1", "laugh2", "again",
] as const;
export const SNEAK_FOLEY_IDS = ["step1", "step2", "step3", "turn", "tell", "plop", "tag", "prize", "finish"] as const;
export type SneakVoiceId = (typeof SNEAK_VOICE_IDS)[number];
export type SneakFoleyId = (typeof SNEAK_FOLEY_IDS)[number];

export interface SneakSound {
  /** Voice line(s) for the event; several rotate. "count" = n<beat> (beat k plays n k). */
  voice: readonly SneakVoiceId[] | "count";
  /** Chant words cut the line before them; everything else queues. */
  cut?: boolean;
  /** Play the voice only the first time the event happens in a sitting. */
  oncePerSitting?: boolean;
  /** Foley clip(s); several rotate (round-robin). */
  foley: readonly SneakFoleyId[];
  /** What it is. */
  note: string;
}

export const SNEAK_SOUNDS: Readonly<Record<SneakEventId, SneakSound>> = {
  beat: { voice: "count", cut: true, foley: [], note: "the cat counts one beat: n1..n5, one word per beat ('one… two…' / 'אחת… שתיים…')" },
  step: { voice: [], foley: ["step1", "step2", "step3"], note: "a tiptoe step on Jerusalem stone, round-robin on every lurch" },
  tell: { voice: ["freeze"], cut: true, foley: ["tell"], note: "the chant ends: the call 'Freeze!' / 'דג מלוח!' with the ear flick, before the look" },
  fake: { voice: [], foley: ["tell"], note: "the ears flick… (a fake turn)" },
  fooled: { voice: ["fake"], foley: [], note: "…and no turn: the cat giggles 'fooled you!'" },
  look: { voice: [], foley: ["turn"], note: "the spin round" },
  sunglasses: { voice: ["sunglasses"], oncePerSitting: true, foley: [], note: "'My sunglasses! I can't see a thing!' (the first time the trick appears)" },
  statue: { voice: ["statue1", "statue2", "statue3"], foley: [], note: "squint, sniff… 'Just a statue!' (three lines, rotating)" },
  caught: { voice: ["caught1", "caught2"], foley: ["plop"], note: "the tumble + 'I see you!' (two lines, rotating)" },
  still: { voice: [], foley: [], note: "the cat looks and nothing moved (no line)" },
  blind: { voice: ["laugh1", "laugh2"], foley: [], note: "the cat in sunglasses laughs it off" },
  tag: { voice: ["tag"], foley: ["tag"], note: "the tag + 'You got me!'" },
  prize: { voice: [], foley: ["prize"], note: "a real bell as the prize is held up" },
  hint: { voice: ["hint"], foley: [], note: "a whisper: 'Psst — hold to sneak!'" },
  waiting: { voice: ["waiting"], foley: [], note: "the cat sits down: 'I'll wait'" },
  done: { voice: [], foley: ["finish"], note: "end of the sitting" },
};

export interface SneakSounds {
  /** Fetch and decode the clips (the game never waits for it). */
  load(): Promise<boolean>;
  /** From a pointerdown / keydown: lets audio start (autoplay rules). */
  unlock(): void;
  /** Play the sounds of one step's events. */
  events(events: readonly SneakEventId[], s: Pick<SneakState, "beatIndex">): void;
  /** The cat's first line (first sitting only). */
  intro(): void;
  /** The ending's "again?" line, before Play again. */
  again(): void;
  /** A new sitting: the once-per-sitting lines may play again. */
  newSitting(): void;
  dispose(): void;
}

export function createSneakSounds(lang: "en" | "he", bank: KidSoundBank = createKidSoundBank({ base: SNEAK_AUDIO_BASE, lang })): SneakSounds {
  const turn = new Map<string, number>();
  const said = new Set<SneakEventId>();
  let unlocked = false;
  /** Count words are skipped (not cutting) until then: a line that must be heard. */
  let protectUntil = 0;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const pick = <T,>(slot: string, list: readonly T[]): T | undefined => {
    if (list.length === 0) return undefined;
    const i = turn.get(slot) ?? 0;
    turn.set(slot, i + 1);
    return list[i % list.length];
  };

  const one = (e: SneakEventId, s: Pick<SneakState, "beatIndex">) => {
    const row = SNEAK_SOUNDS[e];
    if (!row) return;
    const foley = pick(e, row.foley);
    if (foley) bank.play(foley, { kind: "foley" });
    if (row.voice === "count") {
      if (now() < protectUntil) return;
      const k = Math.min(5, Math.max(1, s.beatIndex + 1));
      bank.play(`n${k}`, { kind: "voice", mode: "cut" });
      return;
    }
    if (row.oncePerSitting) {
      if (said.has(e)) return;
      said.add(e);
    }
    const line = pick(`${e}#voice`, row.voice);
    if (!line) return;
    const started = bank.play(line, { kind: "voice", mode: row.cut ? "cut" : "queue" });
    if (started && row.oncePerSitting) protectUntil = now() + bank.durationMs(line, "voice");
  };

  return {
    load: () => bank.load(),
    unlock: () => {
      if (unlocked) return;
      unlocked = true;
      bank.unlock();
    },
    events: (events, s) => {
      for (const e of events) {
        try { one(e, s); } catch { /* sound is never load-bearing */ }
      }
    },
    intro: () => { bank.play("intro", { kind: "voice" }); },
    again: () => { bank.play("again", { kind: "voice" }); },
    newSitting: () => { said.clear(); protectUntil = 0; },
    dispose: () => bank.dispose(),
  };
}
