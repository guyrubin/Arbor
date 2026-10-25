/**
 * kidAudio — B-KID-73 (KA-14 voice layer + KC-23 audio bus, v1): the ONE
 * audio module of the kid register.
 *
 * Voice: one `kidSay()` path for everything Kid Mode speaks (a game's
 * instruction on arrival, the reader's pages, the Decision question and its
 * choices) through the existing TTS (lib/voice speakText). A list of lines is
 * a queue (each starts when the previous ends); `kidHush()` cancels the queue
 * and the voice (navigation, unmount, the tab going hidden).
 *
 * Effects: five short, soft, SYNTHESISED sounds (no audio files): tap,
 * correct, try-again (a gentle falling pair — never a buzzer), page-turn
 * (a filtered-noise swish), finish (a small rising arpeggio). One shared
 * AudioContext, created on the first effect (always inside a user gesture —
 * a tap, a page turn, a finish) and closed when Kid Mode closes.
 *
 * Silence: ONE per-child mute (the read-aloud mute, `arbor.kid.readAloud.
 * muted.<childId>`, now named "Sound") silences both voice and effects and
 * persists. Effects play only while Kid Mode has an active child
 * (`setKidAudioChild`), so the parent register never makes a sound; nothing
 * plays while the tab is hidden. prefers-reduced-motion is not consulted
 * (audio is not motion).
 *
 * Fail-quiet: no AudioContext / no speech = silence, never an error.
 */
import { useSyncExternalStore } from "react";
import { speakText, stopVoice, voiceState, voiceSupported } from "../../../lib/voice";
import { stopKidVoice } from "../../../lib/kidVoicePlayer";

/* ── the per-child mute (persisted, device-local UI state) ─────────────────── */

const KEY = (childId: string) => `arbor.kid.readAloud.muted.${childId}`;
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function isKidReadAloudMuted(childId: string): boolean {
  if (memory.has(childId)) return memory.get(childId)!;
  let muted = false;
  try { muted = globalThis.localStorage?.getItem(KEY(childId)) === "1"; } catch { /* storage blocked: default on */ }
  memory.set(childId, muted);
  return muted;
}

export function setKidReadAloudMuted(childId: string, muted: boolean): void {
  memory.set(childId, muted);
  try { globalThis.localStorage?.setItem(KEY(childId), muted ? "1" : "0"); } catch { /* in-memory only */ }
  if (muted) kidHush();
  emit();
}

export function useKidReadAloudMuted(childId: string): boolean {
  const read = () => isKidReadAloudMuted(childId);
  return useSyncExternalStore(subscribe, read, read);
}

/** True once the page has had a user gesture (sticky activation). Browsers
 *  without the API: assume the opening tap happened (a refused utterance is
 *  silent, never an error the child sees). */
export function pageHasUserGesture(): boolean {
  const ua = (globalThis.navigator as (Navigator & { userActivation?: { hasBeenActive: boolean } }) | undefined)?.userActivation;
  return ua ? ua.hasBeenActive : true;
}

function pageHidden(): boolean {
  return (globalThis.document as Document | undefined)?.visibilityState === "hidden";
}

/* ── the active child (set by the Kid Mode overlay while it is open) ───────── */

let activeChild: string | null = null;
export function setKidAudioChild(childId: string | null): void {
  activeChild = childId;
}

/* ── voice ─────────────────────────────────────────────────────────────────── */

let queueToken = 0;

/** Speak `text` (or a queue of lines) for this child when the mute is off,
 *  the device can speak, a gesture has happened and the tab is visible.
 *  Interrupts whatever was speaking. Returns the first utterance id (0 = not
 *  spoken). */
export function kidSay(childId: string, text: string | readonly string[], lang: "en" | "he"): number {
  const lines = (typeof text === "string" ? [text] : text).map((l) => l.trim()).filter(Boolean);
  // B-BOOK-61: a device with only the neural engine (no speechSynthesis) still speaks.
  const canSpeak = voiceSupported() || voiceState().engine === "natural";
  if (lines.length === 0 || isKidReadAloudMuted(childId) || !canSpeak || !pageHasUserGesture() || pageHidden()) return 0;
  const token = ++queueToken;
  if (lines.length === 1) return speakText(lines[0], {}, lang);
  const next = (i: number): number => {
    if (token !== queueToken || i >= lines.length) return 0;
    return speakText(lines[i], { onEnd: () => { next(i + 1); } }, lang);
  };
  return next(0);
}

/** Other voices that must stop with the kid voice (B-GAME-08a: the file-based
 *  sound bank's voice clips) register here. */
const hushListeners = new Set<() => void>();
export function onKidHush(fn: () => void): () => void {
  hushListeners.add(fn);
  return () => { hushListeners.delete(fn); };
}

/** Cancel the queue and stop the voice (navigation, unmount, hidden tab). */
export function kidHush(): void {
  queueToken++;
  stopVoice();
  hushListeners.forEach((fn) => { try { fn(); } catch { /* never load-bearing */ } });
}

/* ── effects ───────────────────────────────────────────────────────────────── */

export type KidSfx = "tap" | "correct" | "tryAgain" | "pageTurn" | "finish";

type Note = { freq: number; at: number; dur: number; type: OscillatorType; gain: number };
/** Each cue as notes (seconds from now). Soft: peak gain ≤ 0.14. */
export const KID_SFX_NOTES: Readonly<Record<Exclude<KidSfx, "pageTurn">, readonly Note[]>> = {
  tap: [{ freq: 660, at: 0, dur: 0.05, type: "sine", gain: 0.08 }],
  correct: [
    { freq: 523.25, at: 0, dur: 0.11, type: "triangle", gain: 0.12 },
    { freq: 783.99, at: 0.09, dur: 0.16, type: "triangle", gain: 0.12 },
  ],
  // gentle: a soft falling pair, low and short — never a buzzer (no square/saw)
  tryAgain: [
    { freq: 392, at: 0, dur: 0.12, type: "sine", gain: 0.07 },
    { freq: 329.63, at: 0.1, dur: 0.16, type: "sine", gain: 0.06 },
  ],
  finish: [
    { freq: 523.25, at: 0, dur: 0.12, type: "triangle", gain: 0.12 },
    { freq: 659.25, at: 0.1, dur: 0.12, type: "triangle", gain: 0.12 },
    { freq: 783.99, at: 0.2, dur: 0.12, type: "triangle", gain: 0.12 },
    { freq: 1046.5, at: 0.3, dur: 0.3, type: "triangle", gain: 0.14 },
  ],
};
export const PAGE_TURN_SECONDS = 0.16;

type AudioCtor = new () => AudioContext;
let ctx: AudioContext | null = null;
let unavailable = false;

function audioContext(): AudioContext | null {
  if (unavailable) return null;
  if (ctx) return ctx;
  try {
    const w = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) { unavailable = true; return null; }
    ctx = new Ctor();
    return ctx;
  } catch {
    unavailable = true;
    return null;
  }
}

function playNote(ac: AudioContext, n: Note): void {
  const t0 = ac.currentTime + n.at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = n.type;
  osc.frequency.setValueAtTime(n.freq, t0);
  // soft attack, exponential decay: no click at either edge
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(n.gain, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + n.dur + 0.02);
}

function playSwish(ac: AudioContext): void {
  const t0 = ac.currentTime;
  const len = Math.max(1, Math.floor(ac.sampleRate * PAGE_TURN_SECONDS));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, t0);
  filter.frequency.exponentialRampToValueAtTime(700, t0 + PAGE_TURN_SECONDS);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + PAGE_TURN_SECONDS);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + PAGE_TURN_SECONDS + 0.02);
}

/** True when a kid sound may play now: Kid Mode has an active child, that
 *  child's Sound is on and the tab is visible (the same gate as kidSfx). */
export function kidAudioAllowed(): boolean {
  return !!activeChild && !isKidReadAloudMuted(activeChild) && !pageHidden();
}

/** The ONE shared AudioContext (created on first use; null when audio is
 *  unavailable). The file-based sound bank decodes and plays on it, so mute,
 *  hidden-tab suspend and close-on-exit cover it too. */
export function kidAudioContext(): AudioContext | null {
  return audioContext();
}

/** Play one effect for the active Kid Mode child. Silent when Kid Mode is not
 *  open, the child's sound is off, the tab is hidden or audio is unavailable. */
export function kidSfx(name: KidSfx): void {
  if (!kidAudioAllowed()) return;
  const ac = audioContext();
  if (!ac) return;
  try {
    void ac.resume?.();
    if (name === "pageTurn") playSwish(ac);
    else for (const n of KID_SFX_NOTES[name]) playNote(ac, n);
  } catch { /* fail quiet */ }
}

/** The tab went hidden / came back: pause and resume the shared context and
 *  stop the voice (a hidden tab never keeps talking). */
export function kidAudioVisibility(hidden: boolean): void {
  if (hidden) {
    kidHush();
    stopKidVoice();
    try { void ctx?.suspend?.(); } catch { /* ignore */ }
  } else {
    try { void ctx?.resume?.(); } catch { /* ignore */ }
  }
}

/** Kid Mode closed: release the shared context, stop the voice, forget the child. */
export function closeKidAudio(): void {
  kidHush();
  stopKidVoice();
  activeChild = null;
  const live = ctx;
  ctx = null;
  try { void live?.close?.(); } catch { /* ignore */ }
}

/** Test seam. */
export function resetKidAudioForTests(): void {
  ctx = null;
  unavailable = false;
  activeChild = null;
  memory.clear();
}
