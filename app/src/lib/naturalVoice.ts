import { authHeaders, getAiLanguage } from "./api";
import { setNaturalSynth, setVoiceEngine, type NaturalSynth, type NaturalSynthHandle, type SpeakHandlers } from "./voice";

/**
 * Client neural-voice adapter (Epic A) — bridges the voice controller to the server
 * `/api/tts` seam.
 *
 * AI-V4 (gate collapse): the old VITE_TTS_PROVIDER build flag is GONE — the
 * GET /api/tts `configured` probe alone decides whether the neural engine
 * activates, so enabling neural voice is a single server env change
 * (TTS_PROVIDER=google — the prod flip stays Guy's gate). When the server says
 * not configured, the browser `SpeechSynthesis` floor stays the shipped
 * default. The controller's TTFB watchdog falls back to the floor on any
 * latency/error, so this can never cause dead air.
 *
 * AI-V5 (cadence): two additions keep multi-sentence answers gapless:
 *  - screened-sentence tokens: /voice mints a short-TTL HMAC per sentence it
 *    screened; the client registers them here (registerTtsToken) and /api/tts
 *    then skips only the model re-screen. The server's lexical floor still
 *    runs on EVERY call — an invalid/expired/altered token just means the
 *    full screen runs (fail closed, never fail open).
 *  - prefetch: while sentence N plays, the pump prefetches sentence N+1's
 *    audio (prefetchNaturalAudio); the synth consumes the cached fetch so the
 *    inter-sentence gap is playback-bound, not network-bound. A prefetched
 *    handle is marked so the controller's TTFB watchdog (which budgets from
 *    fetch start) is not re-armed against playback start.
 *
 * No persistence, no PII: the text is app-rendered output that was already screened
 * server-side (screenModelOutput / the /voice cumulative sentence screen) before
 * it ever reached the client.
 */

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* ── AI-V5: screened-sentence token registry ───────────────────────────────── */

const TOKEN_REGISTRY_MAX = 64;
const tokenRegistry = new Map<string, string>();

/** Register a short-TTL screened-sentence token from a /voice delta, keyed by
 *  the EXACT sentence text /api/tts will receive. Bounded FIFO. */
export function registerTtsToken(text: string, token: string): void {
  if (!text || !token) return;
  if (!tokenRegistry.has(text) && tokenRegistry.size >= TOKEN_REGISTRY_MAX) {
    const oldest = tokenRegistry.keys().next().value;
    if (oldest !== undefined) tokenRegistry.delete(oldest);
  }
  tokenRegistry.set(text, token);
}

/** Consume (single-use) the token for `text`, if any. Missing token is fine —
 *  the server just runs the full screen. */
const takeTtsToken = (text: string): string | undefined => {
  const token = tokenRegistry.get(text);
  if (token !== undefined) tokenRegistry.delete(text);
  return token;
};

/* ── AI-V5: sentence audio prefetch ────────────────────────────────────────── */

type FetchedAudio = { b64: string; mime: string };

const PREFETCH_MAX = 16;
const prefetchCache = new Map<string, Promise<FetchedAudio | null>>();

async function fetchTtsAudio(text: string): Promise<FetchedAudio | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ text, language: getAiLanguage(), screenedToken: takeTtsToken(text) }),
    });
    if (!res.ok) return null;
    const { audio, mimeType } = (await res.json()) as { audio?: string; mimeType?: string };
    if (!audio) return null;
    return { b64: audio, mime: mimeType || "audio/mpeg" };
  } catch {
    return null;
  }
}

/** Start fetching `text`'s audio now (sentence N+1 while N plays). Idempotent
 *  per text; the synth consumes the cached promise on playback. */
export function prefetchNaturalAudio(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || prefetchCache.has(trimmed)) return;
  if (prefetchCache.size >= PREFETCH_MAX) {
    const oldest = prefetchCache.keys().next().value;
    if (oldest !== undefined) prefetchCache.delete(oldest);
  }
  prefetchCache.set(trimmed, fetchTtsAudio(trimmed));
}

/* ── The synth ─────────────────────────────────────────────────────────────── */

export const naturalSynth: NaturalSynth = (text, handlers: SpeakHandlers): NaturalSynthHandle => {
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

  // Consume a prefetched fetch when one exists (single-owner: the entry is
  // removed so an interrupted utterance can never replay a stale buffer).
  const prefetched = prefetchCache.get(text);
  if (prefetched) prefetchCache.delete(text);

  void (async () => {
    try {
      const fetched = await (prefetched ?? fetchTtsAudio(text));
      if (cancelled) return;
      if (!fetched) {
        handlers.onError?.();
        return;
      }
      url = URL.createObjectURL(base64ToBlob(fetched.b64, fetched.mime));
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
    prefetched: !!prefetched,
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

/** Test seam: reset module state (init latch, caches). */
export function resetNaturalVoiceForTest(): void {
  initialized = false;
  tokenRegistry.clear();
  prefetchCache.clear();
}

/** Bootstrap the neural engine. AI-V4: driven SOLELY by the server-side
 *  GET /api/tts `configured` probe (TTS_PROVIDER) — no client build flag.
 *  Safe to call once at app init; no-op when the server reports off. */
export async function initNaturalVoice(): Promise<void> {
  if (initialized) return;
  // The latch must NOT be set before the probe. AuthContext calls this on mount
  // — i.e. while signed OUT — and /api/tts answers 401 there. Latching first
  // meant that one guaranteed-to-fail pre-auth call permanently blocked the
  // retry after sign-in, so the neural engine never activated for the whole
  // session and every parent stayed on the browser-floor voice (plus a red 401
  // in the console on every load). Only a probe that actually ANSWERED is
  // allowed to be final.
  let answered = false;
  try {
    const res = await fetch("/api/tts", { headers: await authHeaders() });
    // 401/403 = "not signed in yet", never a verdict about TTS being off.
    if (res.status === 401 || res.status === 403) return;
    answered = true;
    if (!res.ok) return;
    const { configured } = (await res.json()) as { configured?: boolean };
    if (!configured) return;
    setNaturalSynth(naturalSynth);
    setVoiceEngine("natural");
  } catch {
    /* network error: leave the browser floor AND allow a later retry */
  } finally {
    if (answered) initialized = true;
  }
}
