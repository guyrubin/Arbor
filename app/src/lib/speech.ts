/** Thin wrapper around the browser SpeechRecognition API for voice dictation. */

type Handlers = {
  onResult: (text: string) => void;
  /**
   * AI-V7: live partial transcript while the parent is still speaking.
   * Providing this handler flips `interimResults` on; it is called with the
   * FULL text so far (finalized + interim), never an isolated fragment, so
   * captions can render it directly. Callers that omit it keep today's
   * final-only behavior byte-identical.
   */
  onInterim?: (text: string) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
};

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

/**
 * AI-CAP-6: generous-endpointing dictation options. `continuous: true` keeps
 * recognition alive across natural mid-story pauses (a 1.5s breath must NOT
 * end the capture); the session finalizes only on the caller's manual stop()
 * or after `silenceFinalizeMs` (~4-5s) with no new recognition results.
 * Callers that omit opts keep the single-shot behavior byte-identical.
 */
export type DictationOpts = {
  continuous?: boolean;
  /** Silence window (ms) that finalizes a continuous session. Default 4500. */
  silenceFinalizeMs?: number;
};

const DEFAULT_SILENCE_FINALIZE_MS = 4500;

/**
 * Starts a single dictation. Returns a stop() function. The final transcript is
 * delivered via onResult when recognition ends.
 */
export function startDictation(handlers: Handlers, lang = "en-US", opts: DictationOpts = {}): () => void {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) {
    handlers.onError?.("unsupported");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = Boolean(handlers.onInterim);
  rec.maxAlternatives = 1;
  rec.continuous = Boolean(opts.continuous);

  // AI-CAP-6 silence-finalize: in continuous mode every recognition result
  // re-arms this timer; expiry calls rec.stop(), which routes through onend so
  // the FULL accumulated transcript is delivered exactly like a manual stop.
  const silenceMs = opts.silenceFinalizeMs ?? DEFAULT_SILENCE_FINALIZE_MS;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  const clearSilenceTimer = () => {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };
  const armSilenceTimer = () => {
    if (!opts.continuous) return;
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      silenceTimer = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }, silenceMs);
  };

  let finalText = "";
  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    handlers.onInterim?.((finalText + interim).trim());
    armSilenceTimer();
  };
  rec.onerror = (e: any) => {
    clearSilenceTimer();
    handlers.onError?.(e?.error || "error");
  };
  rec.onend = () => {
    clearSilenceTimer();
    if (finalText.trim()) handlers.onResult(finalText.trim());
    handlers.onEnd?.();
  };

  try {
    rec.start();
    armSilenceTimer();
  } catch {
    clearSilenceTimer();
    handlers.onError?.("start-failed");
  }
  return () => {
    clearSilenceTimer();
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}
