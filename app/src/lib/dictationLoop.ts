/**
 * AI-V3 (voice-cadence, 2026-07-25): truthful continuous-mic cycling for the
 * browser voice loop.
 *
 * The old CoachTab wiring handled a recognition error with
 * `setVoicePhase("listening")` — the LABEL said listening while no recognition
 * was running: the literal "I'm pressing talk and it's not working" bug. This
 * loop owns one listening session end-to-end:
 *
 *  - recoverable errors ('no-speech', 'aborted', 'network', …) restart
 *    recognition with exponential backoff and a max-retry circuit breaker, so
 *    the phase label is truthful — when it says listening, a recognizer is
 *    (or is about to be) live;
 *  - fatal errors ('not-allowed', 'service-not-allowed', 'unsupported') stop
 *    immediately with a reason the caller can toast (mic permission);
 *  - a session that ENDS silently with no transcript auto-cycles the mic
 *    (onEnd wiring), like a continuous microphone;
 *  - a delivered transcript settles the loop — the caller resumes listening
 *    itself after the answer is spoken (the existing pump behavior).
 *
 * Pure and dependency-injected (the `start` seam is lib/speech.startDictation)
 * so the restart/breaker contract is unit-testable without React or a browser.
 */

type DictationHandlers = {
  onResult: (text: string) => void;
  /** AI-V7: live partial transcript (full text so far) while still speaking. */
  onInterim?: (text: string) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
};

export type StartDictationFn = (handlers: DictationHandlers, lang?: string) => () => void;

export type DictationFatalReason = "permission" | "unsupported" | "retry-exhausted";

export type DictationLoopOptions = {
  /** The recognition seam — lib/speech.startDictation in production. */
  start: StartDictationFn;
  /** BCP-47 recognition language, e.g. "he-IL" / "en-US". */
  lang: string;
  /** The loop cycles only while this is true (CoachTab's voiceOnRef). */
  isActive: () => boolean;
  /** A non-empty final transcript arrived; the loop settles (no auto-restart —
   *  the caller resumes after the spoken answer drains). */
  onTranscript: (text: string) => void;
  /** The loop stopped itself; the caller must reflect a truthful "off" state. */
  onFatal: (reason: DictationFatalReason) => void;
  /** AI-V7: live interim transcript of the CURRENT session (parent's own
   *  words) — forwarded to lib/speech's onInterim, which flips interimResults
   *  on. Omitting it keeps recognition in final-only mode. */
  onInterim?: (text: string) => void;
  /** Circuit breaker: consecutive recoverable restarts before giving up. */
  maxRestarts?: number;
  /** First backoff delay; doubles per consecutive restart, capped at 2s. */
  baseBackoffMs?: number;
};

export type DictationLoop = { start: () => void; stop: () => void };

const FATAL_BY_ERROR: Record<string, DictationFatalReason> = {
  "not-allowed": "permission",
  "service-not-allowed": "permission",
  unsupported: "unsupported",
};

const MAX_BACKOFF_MS = 2000;

export function createDictationLoop(opts: DictationLoopOptions): DictationLoop {
  const maxRestarts = opts.maxRestarts ?? 5;
  const baseBackoffMs = opts.baseBackoffMs ?? 250;

  let stopRecognition: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let restarts = 0;
  let stopped = false;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const scheduleRestart = () => {
    if (stopped || !opts.isActive()) return;
    restarts += 1;
    if (restarts > maxRestarts) {
      stopped = true;
      opts.onFatal("retry-exhausted");
      return;
    }
    const delay = Math.min(baseBackoffMs * 2 ** (restarts - 1), MAX_BACKOFF_MS);
    timer = setTimeout(() => {
      timer = null;
      beginSession();
    }, delay);
  };

  const beginSession = () => {
    if (stopped || !opts.isActive()) return;
    // One outcome per session: a transcript, a fatal stop, or ONE restart.
    let settled = false;
    stopRecognition = opts.start(
      {
        onInterim: opts.onInterim
          ? (text) => {
              if (settled || stopped) return;
              opts.onInterim?.(text);
            }
          : undefined,
        onResult: (text) => {
          if (settled || stopped) return;
          settled = true;
          restarts = 0; // a real transcript resets the breaker
          opts.onTranscript(text);
        },
        onError: (err) => {
          if (settled || stopped) return;
          settled = true;
          const fatal = FATAL_BY_ERROR[err];
          if (fatal) {
            stopped = true;
            opts.onFatal(fatal);
            return;
          }
          scheduleRestart();
        },
        onEnd: () => {
          if (settled || stopped) return;
          // Recognition ended with no transcript and no error (silence) —
          // auto-cycle so the mic behaves continuously.
          settled = true;
          scheduleRestart();
        },
      },
      opts.lang,
    );
  };

  return {
    start: () => {
      if (stopped) return; // single-use: a stopped loop stays stopped
      beginSession();
    },
    stop: () => {
      stopped = true;
      clearTimer();
      try {
        stopRecognition?.();
      } catch {
        /* ignore */
      }
      stopRecognition = null;
    },
  };
}
