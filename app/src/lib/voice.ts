/**
 * Arbor voice-output controller — the single path ALL spoken output flows through.
 *
 * Today the only engine is the browser `SpeechSynthesis` "basic" voice. The neural
 * ("natural") engine — the Epic-A neural-TTS seam (`/api/tts`, Gemini-TTS) — swaps
 * in BEHIND this interface with no call-site changes: callers speak through
 * `speakText`/`stopVoice` (or the legacy `lib/tts` `speak`/`stopSpeaking` shims,
 * or the `<SpeakButton>`/`useArborVoice` UI keystone) and never touch an engine
 * directly. Centralizing here also means multiple SpeakButtons + the coach voice
 * pump share ONE engine, so starting a new utterance cleanly interrupts the prior
 * one and exactly one control ever shows the "speaking" state.
 *
 * SAFETY NOTE (Epic A): when the neural engine lands, every text span MUST pass the
 * server-side output screen before synthesis. The browser engine here only voices
 * text the app already rendered on screen, so it adds no new un-screened surface.
 */

export type VoiceEngine = "basic" | "natural";
export type VoiceState = { speaking: boolean; engine: VoiceEngine };
export type SpeakHandlers = { onStart?: () => void; onEnd?: () => void; onError?: () => void };

type Listener = (state: VoiceState) => void;

// The active engine. `basic` = browser floor; the neural seam flips this to
// `natural` once `/api/tts` is wired. Kept as a module value (not a constant) so
// the seam can set it without touching callers.
let engine: VoiceEngine = "basic";

let utteranceSeq = 0; // monotonic id per utterance
let activeId = 0; // id of the utterance that currently owns playback (0 = none)
let speaking = false;
const listeners = new Set<Listener>();

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function voiceState(): VoiceState {
  return { speaking, engine };
}

/** True iff `id` is the utterance currently owning playback. Lets a caller know
 *  whether it still "owns" the voice (another caller may have interrupted it). */
export function isActive(id: number): boolean {
  return id !== 0 && activeId === id;
}

function emit(): void {
  const snapshot: VoiceState = { speaking, engine };
  listeners.forEach((fn) => fn(snapshot));
}

/** Subscribe to voice state; fires immediately with the current state. */
export function subscribeVoice(fn: Listener): () => void {
  listeners.add(fn);
  fn({ speaking, engine });
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Speak `text`. Returns a token identifying THIS utterance (0 if it could not
 * start). Starting a new utterance cancels any prior one. `onEnd` fires only on
 * natural completion — never when this utterance is superseded or stopped — so a
 * sentence pump can chain safely without double-firing on interruption.
 */
export function speakText(text: string, handlers: SpeakHandlers = {}): number {
  if (!voiceSupported() || !text.trim()) {
    handlers.onError?.();
    return 0;
  }
  const id = ++utteranceSeq;
  // Interrupt whatever is playing; we become the owner.
  window.speechSynthesis.cancel();
  activeId = id;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.onstart = () => {
    if (isActive(id)) {
      speaking = true;
      emit();
      handlers.onStart?.();
    }
  };
  utterance.onend = () => {
    const wasActive = isActive(id);
    if (wasActive) {
      activeId = 0;
      speaking = false;
      emit();
      handlers.onEnd?.();
    }
  };
  utterance.onerror = () => {
    const wasActive = isActive(id);
    if (wasActive) {
      activeId = 0;
      speaking = false;
      emit();
    }
    handlers.onError?.();
  };

  // Some engines fire `onstart` late or not at all; reflect intent immediately.
  speaking = true;
  emit();
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    if (isActive(id)) {
      activeId = 0;
      speaking = false;
      emit();
    }
    handlers.onError?.();
    return 0;
  }
  return id;
}

/** Stop all spoken output immediately (barge-in / navigation / unmount). */
export function stopVoice(): void {
  activeId = 0;
  if (speaking) {
    speaking = false;
    emit();
  }
  if (voiceSupported()) window.speechSynthesis.cancel();
}

/** Seam hook for the neural-TTS upgrade: set the reported engine label. */
export function setVoiceEngine(next: VoiceEngine): void {
  if (engine !== next) {
    engine = next;
    emit();
  }
}
