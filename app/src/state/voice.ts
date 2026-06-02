import { useCallback, useEffect, useRef, useState } from "react";

/**
 * E-02 — Voice in, read-aloud out.
 *
 * A parent holding a screaming child cannot type or read a screen. These hooks
 * wrap the browser's built-in Web Speech API: text-to-speech for reading
 * scripts/stories aloud, and speech-to-text for asking the coach hands-free.
 * Both degrade silently when unsupported — voice is an assist, never required.
 */

const getSpeechSynthesis = (): SpeechSynthesis | null =>
  typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

const getRecognitionCtor = (): any => {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

/** Read text aloud calmly. Returns controls + whether something is currently speaking. */
export const useSpeech = () => {
  const synth = getSpeechSynthesis();
  const [speaking, setSpeaking] = useState(false);
  const supported = !!synth;

  const stop = useCallback(() => {
    if (!synth) return;
    synth.cancel();
    setSpeaking(false);
  }, [synth]);

  const speak = useCallback(
    (text: string, opts?: { lang?: string }) => {
      if (!synth || !text.trim()) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92; // a touch slower than default, for calm
      utterance.pitch = 1;
      if (opts?.lang) utterance.lang = opts.lang;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utterance);
    },
    [synth]
  );

  // Stop any speech on unmount.
  useEffect(() => () => synth?.cancel(), [synth]);

  return { supported, speaking, speak, stop };
};

/** Capture the parent's voice as text. onResult fires with the final transcript. */
export const useSpeechInput = (onResult: (text: string) => void) => {
  const Ctor = getRecognitionCtor();
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* no-op */
    }
    setListening(false);
  }, []);

  const start = useCallback(
    (lang = "en-US") => {
      if (!Ctor) return;
      try {
        const recognition = new Ctor();
        recognition.lang = lang;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) onResultRef.current(transcript);
        };
        recognition.onend = () => setListening(false);
        recognition.onerror = () => setListening(false);
        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    },
    [Ctor]
  );

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* no-op */
      }
    },
    []
  );

  return { supported, listening, start, stop };
};

/** Map an Arbor child language hint to a BCP-47 speech locale. */
export const speechLocaleFor = (languages?: string[]): string => {
  const hint = (languages || []).join(" ").toLowerCase();
  if (/(he|hebrew|עברית)/.test(hint)) return "he-IL";
  if (/(nl|dutch|nederlands)/.test(hint)) return "nl-NL";
  return "en-US";
};
