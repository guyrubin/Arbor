import { authHeaders, getAiLanguage } from "./api";
import { setNaturalSynth, setVoiceEngine, type NaturalSynth, type SpeakHandlers } from "./voice";

/**
 * Client neural-voice adapter (Epic A) — bridges the voice controller to the server
 * `/api/tts` seam. Default-OFF: `initNaturalVoice()` is a no-op unless the build flag
 * `VITE_TTS_PROVIDER` is set, so the browser `SpeechSynthesis` floor stays the shipped
 * default. When on, it probes `/api/tts`; if the server reports configured, it
 * registers a `NaturalSynth` and flips the controller to the "natural" engine. The
 * controller's TTFB watchdog falls back to the floor on any latency/error, so this
 * can never cause dead air.
 *
 * No persistence, no PII: the text is app-rendered output that was already screened
 * server-side (screenModelOutput) before it ever reached the client.
 */

const ttsEnabled = (): boolean => {
  try {
    return String((import.meta as any).env?.VITE_TTS_PROVIDER || "").toLowerCase() === "google";
  } catch {
    return false;
  }
};

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const naturalSynth: NaturalSynth = (text, handlers: SpeakHandlers) => {
  let audio: HTMLAudioElement | null = null;
  let url: string | null = null;
  let cancelled = false;

  const cleanup = () => {
    if (url) {
      URL.revokeObjectURL(url);
      url = null;
    }
    audio = null;
  };

  void (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ text, language: getAiLanguage() }),
      });
      if (cancelled) return;
      if (!res.ok) {
        handlers.onError?.();
        return;
      }
      const { audio: b64, mimeType } = (await res.json()) as { audio?: string; mimeType?: string };
      if (cancelled) return;
      if (!b64) {
        handlers.onError?.();
        return;
      }
      url = URL.createObjectURL(base64ToBlob(b64, mimeType || "audio/mpeg"));
      audio = new Audio(url);
      audio.onplay = () => handlers.onStart?.();
      audio.onended = () => {
        cleanup();
        handlers.onEnd?.();
      };
      audio.onerror = () => {
        cleanup();
        handlers.onError?.();
      };
      await audio.play();
    } catch {
      if (!cancelled) handlers.onError?.();
    }
  })();

  return {
    stop: () => {
      cancelled = true;
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
      }
      cleanup();
    },
  };
};

let initialized = false;

/** Bootstrap the neural engine. No-op unless VITE_TTS_PROVIDER is set AND the server
 *  reports /api/tts configured. Safe to call once at app init. */
export async function initNaturalVoice(): Promise<void> {
  if (initialized || !ttsEnabled()) return;
  initialized = true;
  try {
    const res = await fetch("/api/tts", { headers: await authHeaders() });
    if (!res.ok) return;
    const { configured } = (await res.json()) as { configured?: boolean };
    if (!configured) return;
    setNaturalSynth(naturalSynth);
    setVoiceEngine("natural");
  } catch {
    /* leave the browser floor as the default */
  }
}
