/** One browser dictation session, including any empty-start retries. */
export type DictationPhase = "starting" | "recording" | "finishing";
export type DictationHandlers = {
  onResult: (text: string) => void;
  /** Full finalized + interim text, never an isolated fragment. */
  onInterim?: (text: string) => void;
  /** A conversation can return an unconfirmed caption to the editable draft. */
  onUnconfirmed?: (text: string) => void;
  onPhase?: (phase: DictationPhase) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
};

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
function transcript(results: RecognitionResult[]): string {
  return results.map(result => result[0].transcript.trim()).filter(Boolean)
    .join(" ").replace(/\s+([.,!?;:])/g, "$1");
}
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => Recognition;
function recognizer() {
  if (typeof window === "undefined") return undefined;
  const browser = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}
export function speechSupported(): boolean {
  return typeof recognizer() === "function";
}

export type DictationOpts = {
  continuous?: boolean;
  /** Natural pause after the latest words. Defaults to 4.5s for continuous drafts. */
  silenceFinalizeMs?: number;
  /** Owners with their own recovery loop set this to zero. */
  maxEmptyRestarts?: number;
};

const STARTUP_MS = 30_000;
const STOP_GRACE_MS = 1200;

export function startDictation(handlers: DictationHandlers, lang = "en-US", opts: DictationOpts = {}): () => void {
  const Ctor = recognizer();
  const pauseMs = opts.silenceFinalizeMs ?? (opts.continuous ? 4500 : undefined);
  let active: Recognition | null = null;
  let done = false;
  let stopping = false;
  let retries = 0;
  let caption = "";
  let finalText = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let phase: DictationPhase | undefined;

  const report = (next: DictationPhase) => {
    if (phase === next) return;
    phase = next;
    handlers.onPhase?.(next);
  };
  const finish = (error?: string, release = false) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    const rec = active;
    active = null;
    if (release) {
      try { rec?.abort(); } catch { /* already disconnected */ }
    }
    // A draft may keep the last visible words when the browser omits a final.
    // An unattended conversation turn or a failed recognition uses finals only.
    const text = opts.continuous && !error ? caption : finalText;
    if (error) handlers.onError?.(error);
    if (!error && handlers.onUnconfirmed && caption && caption !== finalText) {
      handlers.onUnconfirmed(caption);
    } else if (text) {
      handlers.onResult(text);
    }
    handlers.onEnd?.();
  };
  const awaitEnd = () => {
    stopping = true;
    clearTimeout(timer);
    report("finishing");
    // Arm before stop(): some engines synchronously send their last results.
    timer = setTimeout(() => finish(undefined, true), STOP_GRACE_MS);
  };
  const stop = () => {
    if (done || stopping) return;
    if (!active) { finish(); return; } // between empty-start attempts
    if (phase === "starting" && typeof active.abort === "function") {
      finish(undefined, true);
      return;
    }
    awaitEnd();
    try { active.stop(); } catch { finish(undefined, true); }
  };
  const begin = () => {
    if (done || stopping || !Ctor) return;
    try {
      const rec = new Ctor();
      active = rec;
      let heardAudio = false;
      const recording = () => {
        if (active !== rec || stopping || phase === "finishing") return;
        heardAudio = true;
        report("recording");
      };
      const emptyEnd = () => {
        active = null; // Ignore paired error/end and any late results on this instance.
        clearTimeout(timer);
        if (stopping) { finish(); return; }
        if (retries >= (opts.maxEmptyRestarts ?? 2)) { finish("no-speech"); return; }
        report("starting");
        timer = setTimeout(begin, 250 * ++retries);
      };
      rec.lang = lang;
      rec.interimResults = Boolean(handlers.onInterim);
      rec.maxAlternatives = 1;
      rec.continuous = Boolean(opts.continuous);
      rec.onaudiostart = recording;
      rec.onaudioend = () => {
        if (active !== rec || stopping || phase === "finishing") return;
        // Audio has stopped. Give the service time for its final transcript
        // and end event. An empty natural end can still retry.
        clearTimeout(timer);
        report("finishing");
        timer = setTimeout(() => finish(caption ? undefined : "no-speech", true), STOP_GRACE_MS);
      };
      rec.onresult = ({ results }) => {
        if (active !== rec) return;
        recording();
        // The browser supplies the whole list, including revised/removed
        // interim words. Rebuilding it avoids duplicating replayed finals.
        const segments = Array.from(results);
        finalText = transcript(segments.filter(r => r.isFinal));
        const next = transcript(segments);
        if (next === caption) return;
        caption = next;
        handlers.onInterim?.(caption);
        // A late result updates the draft, never the pending Stop deadline.
        if (phase !== "finishing" && pauseMs !== undefined) {
          clearTimeout(timer);
          timer = setTimeout(stop, pauseMs);
        }
      };
      rec.onerror = ({ error }) => {
        if (active !== rec) return;
        if (stopping) { finish(); return; }
        if (error === "no-speech" || error === "aborted") {
          if (caption) finish();
          else emptyEnd();
        } else finish(error || "error");
      };
      rec.onend = () => {
        if (active !== rec) return;
        if (stopping || caption) finish();
        else emptyEnd();
      };
      report("starting");
      if (pauseMs !== undefined) {
        timer = setTimeout(() => finish(heardAudio ? "no-speech" : "audio-capture", true), STARTUP_MS);
      }
      rec.start();
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      finish(name === "NotAllowedError" || name === "SecurityError" ? "not-allowed"
        : name === "NotFoundError" || name === "NotReadableError" ? "audio-capture" : "start-failed", true);
    }
  };
  if (typeof Ctor !== "function") finish("unsupported");
  else begin();
  return stop;
}
