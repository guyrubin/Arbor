/** Thin wrapper around the browser SpeechRecognition API for voice dictation. */

type Handlers = {
  onResult: (text: string) => void;
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
 * Starts a single dictation. Returns a stop() function. The final transcript is
 * delivered via onResult when recognition ends.
 */
export function startDictation(handlers: Handlers, lang = "en-US"): () => void {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) {
    handlers.onError?.("unsupported");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  let finalText = "";
  rec.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
    }
  };
  rec.onerror = (e: any) => handlers.onError?.(e?.error || "error");
  rec.onend = () => {
    if (finalText.trim()) handlers.onResult(finalText.trim());
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    handlers.onError?.("start-failed");
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}
