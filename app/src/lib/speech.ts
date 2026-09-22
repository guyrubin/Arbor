/** Shared browser dictation lifecycle. Empty startup ends recover before a
 * capture is settled; every terminal failure reports its reason and ends once. */
type Handlers = {
  onResult: (text: string) => void;
  /** Full finalized + interim text, never an isolated fragment. */
  onInterim?: (text: string) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
};

export function speechSupported(): boolean {
  return typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export type DictationOpts = {
  continuous?: boolean;
  /** Applied after the first result, never while permission/startup is pending. */
  silenceFinalizeMs?: number;
  /** Owners with their own recovery loop set this to zero. */
  maxEmptyRestarts?: number;
};

export function startDictation(handlers: Handlers, lang = "en-US", opts: DictationOpts = {}): () => void {
  const Ctor = typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  let rec: any = null;
  let done = false;
  let stopping = false;
  let generation = 0;
  let retries = 0;
  let finalText = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clearTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const finish = (error?: string) => {
    if (done) return;
    done = true;
    generation++;
    clearTimer();
    if (error) handlers.onError?.(error);
    if (finalText.trim()) handlers.onResult(finalText.trim());
    handlers.onEnd?.();
  };
  const stop = () => {
    if (done || stopping) return;
    stopping = true;
    clearTimer();
    try { rec?.stop(); } catch { finish(); }
    // A recognizer between sessions or a Chrome stop that omits onend must
    // still settle. Keep the normal final-result event a chance to arrive.
    if (!done) timer = setTimeout(() => finish(), 1200);
  };
  const retryEmpty = () => {
    if (done || stopping) return;
    if (retries >= (opts.maxEmptyRestarts ?? 2)) { finish("no-speech"); return; }
    retries++;
    clearTimer();
    timer = setTimeout(begin, 250 * retries);
  };
  const begin = () => {
    if (done || stopping) return;
    const current = ++generation;
    const owns = () => !done && generation === current;
    let ended = false;
    try {
      rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = Boolean(handlers.onInterim);
      rec.maxAlternatives = 1;
      rec.continuous = Boolean(opts.continuous);
      rec.onresult = (e: any) => {
        if (!owns() || ended) return;
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        handlers.onInterim?.((finalText + interim).trim());
        if (opts.continuous) {
          clearTimer();
          timer = setTimeout(stop, opts.silenceFinalizeMs ?? 4500);
        }
      };
      rec.onerror = (e: any) => {
        if (!owns() || ended) return;
        ended = true;
        clearTimer();
        const error = e?.error || "error";
        if (stopping) { finish(); return; }
        // These often accompany Chrome's premature onend. Their paired end
        // belongs to this retired recognizer, not the replacement.
        if (!finalText.trim() && (error === "no-speech" || error === "aborted")) retryEmpty();
        else finish(error);
      };
      rec.onend = () => {
        if (!owns() || ended) return;
        ended = true;
        clearTimer();
        if (stopping || finalText.trim()) finish();
        else retryEmpty();
      };
      rec.start();
      // Give a parent time to grant permission and start a thought. The
      // shorter natural-pause window is armed only by recognized speech.
      if (opts.continuous && owns() && !ended) timer = setTimeout(() => {
        try { rec.abort?.(); } catch { /* release what remains */ }
        finish("no-speech");
      }, 30_000);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      finish(name === "NotAllowedError" || name === "SecurityError" ? "not-allowed"
        : name === "NotFoundError" || name === "NotReadableError" ? "audio-capture" : "start-failed");
    }
  };
  if (!Ctor) finish("unsupported");
  else begin();
  return stop;
}
