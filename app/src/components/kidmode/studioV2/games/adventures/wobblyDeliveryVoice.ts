/**
 * Wobbly Delivery's voice from FILES (B-GAME-38): the listening game never
 * waits on a live synthesis call, so a request is heard the moment its first
 * card turns up and the next card turns up as its thing is named.
 *
 * The files are the pinned read-aloud voice (Chirp 3 HD Sulafat, EN and HE),
 * rendered once by `scripts/render-delivery-voice.py` from the lines below:
 *
 *   /audio/kid/delivery/manifest.json   { ext, he: {id: ms}, en: {…}, foley: {} }
 *   /audio/kid/delivery/{he|en}/<id>.m4a
 *
 * A request is stitched from short lines: the friend and the first thing
 * ("Aya needs the watering can,"), then "then the journal," for a middle
 * thing and "then the lamp." for the last one. Read in order they are the
 * heading's own sentence (`requestLine`).
 *
 * When a line has no decoded file (no manifest yet, a missing clip, no audio)
 * the game falls back to the shared read-aloud voice; with sound off nothing
 * is spoken and the picture cards carry the request.
 */
import { createKidSoundBank, type KidSoundBank } from '../../../audio/kidSoundBank';
import type { WobblyDeliveryWords } from './wobblyDeliveryCopy';
import { DELIVERY_FRIENDS, DELIVERY_ITEMS, type DeliveryItem } from './wobblyDeliveryRules';

export const WOBBLY_AUDIO_BASE = '/audio/kid/delivery';
/** A spoken line starts this long after its cue, as the shared voice does. */
export const VOICE_DELAY_MS = 180;
/** Silence between two stitched lines of one request. */
export const VOICE_GAP_MS = 160;
/** The cards stay up this long after the last word. */
export const VOICE_HOLD_MS = 700;

/** The clip ids of one request, in the order they are spoken. */
export function requestClips(friend: number, request: readonly DeliveryItem[]): string[] {
  const name = DELIVERY_FRIENDS[friend];
  return request.map((item, index) => index === 0 ? `${name}-${item}` : index === request.length - 1 ? `last-${item}` : `then-${item}`);
}

/** Every line the files hold, by clip id, built only from the copy. */
export function voiceLines(words: WobblyDeliveryWords): Record<string, string> {
  const comma = words.listJoin.trim();
  const then = words.then.replace(/^[,\s]+/, '');
  const lines: Record<string, string> = {
    'line-ready': words.ready, 'fetch-next': words.fetchNext, 'fetch-last': words.fetchLast,
    'not-yet': words.notYet, 'good-asking': words.goodAsking,
  };
  DELIVERY_FRIENDS.forEach((name, friend) => {
    lines[`fetch-first-${name}`] = words.fetchFirst[friend];
    for (const item of DELIVERY_ITEMS) lines[`${name}-${item}`] = `${words.asks[friend]}${words.things[item]}${comma}`;
  });
  for (const item of DELIVERY_ITEMS) {
    lines[`then-${item}`] = `${then}${words.things[item]}${comma}`;
    lines[`last-${item}`] = `${then}${words.things[item]}${words.stop}`;
  }
  return lines;
}

export interface VoicePlan { starts: number[]; endMs: number }
/** When each stitched line starts, from the clips' lengths; null when any is unknown. */
export function voicePlan(ids: readonly string[], durationOf: (id: string) => number): VoicePlan | null {
  if (!ids.length) return null;
  const starts: number[] = [];
  let at = 0;
  for (const id of ids) {
    const ms = durationOf(id);
    if (!(ms > 0)) return null;
    starts.push(at); at += ms + VOICE_GAP_MS;
  }
  return { starts, endMs: at - VOICE_GAP_MS };
}

export interface WobblyVoice {
  /** Fetch and decode the clips; true when a manifest was read. */
  load(): Promise<boolean>;
  /** From a tap: lets audio start (autoplay rules). */
  unlock(): void;
  /** Every clip is decoded and has a length. */
  covers(ids: readonly string[]): boolean;
  /** The timing of a line, or null when it is not covered. */
  plan(ids: readonly string[]): VoicePlan | null;
  /** Speaks the clips through `later` (the game's own timers, so leaving or
   * playing again stops them); each clip checks `allowed` before it starts. */
  speak(ids: readonly string[], later: (run: () => void, ms: number) => void, allowed: () => boolean): VoicePlan | null;
  stop(): void;
  dispose(): void;
}

export function createWobblyVoice(lang: 'en' | 'he', bank: KidSoundBank = createKidSoundBank({ base: WOBBLY_AUDIO_BASE, lang })): WobblyVoice {
  const covers = (ids: readonly string[]) => ids.length > 0 && ids.every(id => bank.has(id, 'voice') && bank.durationMs(id, 'voice') > 0);
  const plan = (ids: readonly string[]) => covers(ids) ? voicePlan(ids, id => bank.durationMs(id, 'voice')) : null;
  return {
    load: () => bank.load(),
    unlock: () => bank.unlock(),
    covers,
    plan,
    speak(ids, later, allowed) {
      const timing = plan(ids);
      if (!timing) return null;
      // The first line cuts whatever was speaking; the rest follow it.
      ids.forEach((id, index) => later(() => { if (allowed()) bank.play(id, { kind: 'voice', mode: index === 0 ? 'cut' : 'queue' }); }, timing.starts[index]));
      return timing;
    },
    stop: () => bank.stopVoice(),
    dispose: () => bank.dispose(),
  };
}
