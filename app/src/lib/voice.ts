/**
 * Arbor voice-output controller — the single path ALL spoken output flows through.
 *
 * Two engines behind ONE interface (callers never touch an engine directly):
 *   - "basic":   the browser `SpeechSynthesis` floor (always the default).
 *   - "natural": a registered neural synth (the Epic-A `/api/tts` adapter), enabled
 *                via `setNaturalSynth` + `setVoiceEngine("natural")`.
 * If the natural engine is slow to start (TTFB watchdog) or errors, the controller
 * auto-falls-back to the browser floor for that utterance and degrades the session
 * to "basic" — so a neural failure never means dead air on a child surface.
 *
 * Centralizing here means multiple SpeakButtons + the coach voice pump share ONE
 * engine, so a new utterance cleanly interrupts the prior one and exactly one
 * control ever shows the "speaking" state.
 *
 * SAFETY NOTE (Epic A): the natural engine only synthesizes text the app already
 * rendered AND screened upstream (screenModelOutput before res.json). The voice
 * layer adds no new un-screened surface.
 */

export type VoiceEngine = "basic" | "natural";
export type VoiceState = { speaking: boolean; engine: VoiceEngine };
export type SpeakHandlers = { onStart?: () => void; onEnd?: () => void; onError?: () => void };

/** A registered neural synth: plays `text`, drives the handlers, returns a stop handle
 *  (or null to decline, e.g. when the backend is unavailable → caller uses the floor). */
export type NaturalSynth = (text: string, handlers: SpeakHandlers) => { stop: () => void } | null;

type Listener = (state: VoiceState) => void;

// `basic` = browser floor; flipped to `natural` once the neural adapter registers.
let engine: VoiceEngine = "basic";

let utteranceSeq = 0; // monotonic id per utterance
let activeId = 0; // id of the utterance that currently owns playback (0 = none)
let speaking = false;
const listeners = new Set<Listener>();

let naturalSynth: NaturalSynth | null = null;
let activeNaturalStop: (() => void) | null = null;
let ttfbTimer: ReturnType<typeof setTimeout> | null = null;
// If the neural engine hasn't produced audio within this window, fall back to floor.
const NATURAL_TTFB_MS = 1500;

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function voiceState(): VoiceState {
  return { speaking, engine };
}

/** True iff `id` is the utterance currently owning playback. */
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

/** Register (or clear) the neural synth adapter. */
export function setNaturalSynth(fn: NaturalSynth | null): void {
  naturalSynth = fn;
}

/** Seam hook for the neural-TTS upgrade: set the reported/active engine. */
export function setVoiceEngine(next: VoiceEngine): void {
  if (engine !== next) {
    engine = next;
    emit();
  }
}

function clearWatchdog(): void {
  if (ttfbTimer) {
    clearTimeout(ttfbTimer);
    ttfbTimer = null;
  }
}

/** Stop whatever is currently playing (browser + any neural), and clear the watchdog. */
function stopActivePlayback(): void {
  clearWatchdog();
  if (activeNaturalStop) {
    try {
      activeNaturalStop();
    } catch {
      /* ignore */
    }
    activeNaturalStop = null;
  }
  if (voiceSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/** Browser `SpeechSynthesis` floor. Returns `id` on success, 0 if it could not start. */
function startBrowser(id: number, text: string, handlers: SpeakHandlers): number {
  if (!voiceSupported()) {
    if (isActive(id)) {
      activeId = 0;
      if (speaking) {
        speaking = false;
        emit();
      }
    }
    handlers.onError?.();
    return 0;
  }
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
    if (isActive(id)) {
      activeId = 0;
      speaking = false;
      emit();
      handlers.onEnd?.();
    }
  };
  utterance.onerror = () => {
    if (isActive(id)) {
      activeId = 0;
      speaking = false;
      emit();
    }
    handlers.onError?.();
  };
  // Reflect intent immediately (some engines fire `onstart` late or not at all).
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

/** Neural engine with a TTFB watchdog. Returns true if it took ownership of `id`. */
function startNatural(id: number, text: string, handlers: SpeakHandlers): boolean {
  let started = false;
  let fellBack = false;
  const fallback = () => {
    if (fellBack || !isActive(id)) return; // once-only; ignore if superseded
    fellBack = true;
    clearWatchdog();
    if (activeNaturalStop) {
      try {
        activeNaturalStop();
      } catch {
        /* ignore */
      }
      activeNaturalStop = null;
    }
    setVoiceEngine("basic"); // degrade the session to the floor
    startBrowser(id, text, handlers); // re-dispatch THIS utterance
  };

  const handle = naturalSynth!(text, {
    onStart: () => {
      if (!isActive(id)) return;
      started = true;
      clearWatchdog();
      speaking = true;
      emit();
      handlers.onStart?.();
    },
    onEnd: () => {
      if (isActive(id)) {
        clearWatchdog();
        activeNaturalStop = null;
        activeId = 0;
        speaking = false;
        emit();
        handlers.onEnd?.();
      }
    },
    onError: () => {
      if (!started) {
        fallback(); // never produced audio → silent fallback to the floor
      } else if (isActive(id)) {
        clearWatchdog();
        activeNaturalStop = null;
        activeId = 0;
        speaking = false;
        emit();
        handlers.onError?.();
      }
    },
  });

  if (!handle) return false; // adapter declined → caller uses the browser floor
  activeNaturalStop = handle.stop;
  speaking = true;
  emit();
  ttfbTimer = setTimeout(() => {
    if (!started) fallback();
  }, NATURAL_TTFB_MS);
  return true;
}

/**
 * Speak `text`. Returns a token identifying THIS utterance (0 if it could not
 * start). Starting a new utterance interrupts any prior one. `onEnd` fires only on
 * natural completion — never when superseded or stopped — so a sentence pump can
 * chain safely without double-firing on interruption.
 */
export function speakText(text: string, handlers: SpeakHandlers = {}): number {
  const trimmed = text.trim();
  const canNatural = engine === "natural" && !!naturalSynth;
  if (!trimmed || (!canNatural && !voiceSupported())) {
    handlers.onError?.();
    return 0;
  }
  const id = ++utteranceSeq;
  activeId = id; // own BEFORE interrupting, so a prior callback can't claim completion
  stopActivePlayback();

  if (canNatural && startNatural(id, trimmed, handlers)) return id;
  return startBrowser(id, trimmed, handlers);
}

/** Stop all spoken output immediately (barge-in / navigation / unmount). */
export function stopVoice(): void {
  activeId = 0;
  stopActivePlayback();
  if (speaking) {
    speaking = false;
    emit();
  }
}
