import { authHeaders, getAiLanguage } from "./api";
import { setNaturalSynth, setVoiceEngine, stopVoice, type NaturalSynth, type NaturalSynthHandle, type SpeakHandlers } from "./voice";
import { isKidModeActive } from "./kidModeGate";
import { kidVoiceElement } from "./kidVoicePlayer";

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
type AudioRequest = {
  promise: Promise<FetchedAudio | null>;
  cancel: () => void;
  ready: boolean;
};
const prefetchCache = new Map<string, AudioRequest>();
const pendingRequests = new Set<AudioRequest>();
// A bounded request includes auth lookup and body consumption, not just fetch.
const TTS_REQUEST_TIMEOUT_MS = 15_000;

/** B-BOOK-61: the prefetch cache is keyed by language as well as text
 *  (the two-letter prefix keeps the key unambiguous). */
const cacheKey = (text: string, lang: "en" | "he") => `${lang}:${text}`;

function requestTtsAudio(text: string, lang: "en" | "he"): AudioRequest {
  const controller = new AbortController();
  let settle: (audio: FetchedAudio | null) => void = () => {};
  let done = false;
  const request: AudioRequest = {
    ready: false,
    promise: new Promise((resolve) => { settle = resolve; }),
    cancel: () => { controller.abort(); finish(null); },
  };
  pendingRequests.add(request);
  const timer = setTimeout(() => request.cancel(), TTS_REQUEST_TIMEOUT_MS);
  function finish(audio: FetchedAudio | null): void {
    if (done) return;
    done = true;
    pendingRequests.delete(request);
    clearTimeout(timer);
    request.ready = audio !== null;
    settle(audio);
  }
  void (async () => {
    try {
      const headers = await authHeaders();
      // Stop/navigation during token refresh must not start a paid POST later.
      if (controller.signal.aborted) return;
      const res = await fetch("/api/tts", {
        method: "POST", headers, signal: controller.signal,
        body: JSON.stringify({ text, language: lang, screenedToken: takeTtsToken(text) }),
      });
      if (!res.ok || controller.signal.aborted) { finish(null); return; }
      const { audio, mimeType } = (await res.json()) as { audio?: string; mimeType?: string };
      finish(!controller.signal.aborted && typeof audio === "string" && audio
        ? { b64: audio, mime: mimeType || "audio/mpeg" } : null);
    } catch { finish(null); }
  })();
  return request;
}

/** Kid Mode read-aloud (10 Oct 2026): a game's or guide's authored lines are
 *  the same on every visit, so each line's audio is fetched once per signed-in
 *  scope and replayed from memory (a replay makes no /api/tts call). Bounded
 *  FIFO; the parent register's dynamic replies are never kept here, and
 *  resetNaturalVoice (sign-out, owner change) forgets every line. */
const KID_LINE_MAX = 120;
const kidLineCache = new Map<string, FetchedAudio>();
function keepKidLine(key: string, audio: FetchedAudio): void {
  if (kidLineCache.size >= KID_LINE_MAX) {
    const oldest = kidLineCache.keys().next().value;
    if (oldest !== undefined) kidLineCache.delete(oldest);
  }
  kidLineCache.set(key, audio);
}
const keptRequest = (audio: FetchedAudio): AudioRequest => ({ ready: true, promise: Promise.resolve(audio), cancel: () => {} });

/** Clear speculative audio, never persist it or reuse it across sign-ins. */
export function clearNaturalAudioPrefetch(): void {
  for (const request of prefetchCache.values()) request.cancel();
  prefetchCache.clear();
}

/** Start fetching `text`'s audio now (sentence N+1 while N plays). Idempotent
 *  per text; the synth consumes the cached promise on playback. */
export function prefetchNaturalAudio(text: string, lang: "en" | "he" = getAiLanguage()): void {
  const trimmed = text.trim();
  const key = cacheKey(trimmed, lang);
  if (!trimmed || prefetchCache.has(key) || (isKidModeActive() && kidLineCache.has(key))) return;
  if (prefetchCache.size >= PREFETCH_MAX) {
    const oldest = prefetchCache.keys().next().value;
    if (oldest !== undefined) {
      prefetchCache.get(oldest)?.cancel();
      prefetchCache.delete(oldest);
    }
  }
  const request = requestTtsAudio(trimmed, lang);
  prefetchCache.set(key, request);
  // Keep even a failed result until consumed/evicted: a prefetch failure must
  // not silently trigger another paid request for the same utterance.
}

/* ── The synth ─────────────────────────────────────────────────────────────── */

export const naturalSynth: NaturalSynth = (text, handlers: SpeakHandlers, lang: "en" | "he" = getAiLanguage()): NaturalSynthHandle => {
  // F-03: the HTMLAudioElement MUST be created SYNCHRONOUSLY, inside the user
  // gesture that triggered this utterance — before ANY await. Creating it only
  // after the /api/tts fetch resolved put the first play() outside the gesture,
  // so autoplay policy blocked it: POST /api/tts returned 200, nothing played,
  // and the rejection was swallowed. The src-less bless-play below "unlocks"
  // this element while the gesture is still live; its rejection (no source yet)
  // is expected and swallowed. onplay is attached only AFTER src is set, so the
  // bless-play can never fire onStart.
  // Kid Mode: the ONE page voice channel, already blessed by the child's first
  // tap (lib/kidVoicePlayer) — a game's arrival line and Sprout's lines start
  // outside any gesture, which iOS refuses for a fresh element.
  const kid = isKidModeActive();
  const shared = kid ? kidVoiceElement("page") : null;
  const audio = shared ?? new Audio();
  if (!shared) {
    try {
      audio.play().catch(() => {
        /* expected: no src yet — the bless is best-effort */
      });
    } catch {
      /* some engines throw synchronously on a src-less play() */
    }
  }

  let url: string | null = null;
  let cancelled = false;

  const cleanup = () => {
    if (url) {
      URL.revokeObjectURL(url);
      url = null;
    }
  };

  // Consume a prefetched fetch when one exists (single-owner: the entry is
  // removed so an interrupted utterance can never replay a stale buffer).
  const key = cacheKey(text, lang);
  const prefetched = prefetchCache.get(key);
  if (prefetched) prefetchCache.delete(key);
  const kept = kid ? kidLineCache.get(key) : undefined;
  if (kept) prefetched?.cancel();
  const request = kept ? keptRequest(kept) : prefetched ?? requestTtsAudio(text, lang);

  void (async () => {
    try {
      const fetched = await request.promise;
      if (cancelled) return;
      if (!fetched) {
        handlers.onError?.();
        return;
      }
      if (kid && !kept) keepKidLine(key, fetched);
      url = URL.createObjectURL(base64ToBlob(fetched.b64, fetched.mime));
      audio.src = url;
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
    } catch (err) {
      // F-03: never swallow a blocked play. NotAllowedError = the browser
      // refused playback (gesture expired / bless failed) — warn so it is
      // diagnosable, and surface onError so the controller can fall back to
      // the browser floor and the UI can tell the parent.
      if ((err as { name?: string } | null)?.name === "NotAllowedError") {
        console.warn("[voice] audio playback blocked by the browser (NotAllowedError)", err);
      }
      if (!cancelled) handlers.onError?.();
    }
  })();

  return {
    // An in-flight prefetch must NOT disable the controller's 1.5s watchdog.
    prefetched: !!kept || !!prefetched?.ready,
    stop: () => {
      cancelled = true;
      request.cancel();
      // Detach before pausing so a late media event can never fire handlers
      // for an utterance the controller already released.
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
      cleanup();
    },
  };
};

/**
 * B-SHELL-39 — speak a sentence that does not exist yet (the describe
 * conversation's next question). Call INSIDE the gesture that sends the
 * parent's mic answer: the audio element is created and blessed now (the F-03
 * rule above), and `speak` fetches /api/tts later — with the route's
 * screened-sentence token — and plays on that element. A failed fetch or a
 * refused play resolves false and the question simply stays as text.
 */
export function primeNaturalAudio(): { speak: (text: string, lang: "en" | "he", token?: string) => Promise<boolean>; cancel: () => void } {
  const audio = new Audio();
  try {
    audio.play().catch(() => {
      /* expected: no src yet — the bless is best-effort */
    });
  } catch {
    /* some engines throw synchronously on a src-less play() */
  }
  let url: string | null = null;
  let cancelled = false;
  let pending: AudioRequest | null = null;
  const cleanup = () => {
    if (url) {
      URL.revokeObjectURL(url);
      url = null;
    }
  };
  return {
    speak: async (text, lang, token) => {
      const trimmed = text.trim();
      if (cancelled || !trimmed) return false;
      if (token) registerTtsToken(trimmed, token);
      pending?.cancel();
      const request = requestTtsAudio(trimmed, lang);
      pending = request;
      const fetched = await request.promise;
      if (pending !== request) return false;
      if (cancelled || !fetched) return false;
      url = URL.createObjectURL(base64ToBlob(fetched.b64, fetched.mime));
      audio.src = url;
      audio.onended = cleanup;
      audio.onerror = cleanup;
      try {
        await audio.play();
        return true;
      } catch {
        cleanup();
        return false;
      }
    },
    cancel: () => {
      cancelled = true;
      pending?.cancel();
      pending = null;
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
      cleanup();
    },
  };
}

let initialized = false;
let probe: Promise<void> | null = null;
let probeController: AbortController | null = null;
let generation = 0;

/** Retire the signed-in voice scope; late responses cannot re-enable it. */
export function resetNaturalVoice(): void {
  generation++;
  initialized = false;
  probeController?.abort();
  probeController = null;
  probe = null;
  stopVoice();
  clearNaturalAudioPrefetch();
  for (const request of pendingRequests) request.cancel();
  tokenRegistry.clear();
  kidLineCache.clear();
  setNaturalSynth(null);
  setVoiceEngine("basic");
}

export const resetNaturalVoiceForTest = resetNaturalVoice;

/** One cheap capability GET at a time. Only a valid boolean is a final answer;
 *  401/403/429/5xx, timeout and malformed JSON remain retryable, not "off".
 *  This does not create synthesis requests or override a valid server kill switch. */
export function initNaturalVoice(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (probe) return probe;
  const scope = generation;
  const controller = new AbortController();
  probeController = controller;
  const timer = setTimeout(() => controller.abort(), 5_000);
  const attempt = (async () => {
    try {
      const headers = await authHeaders();
      if (controller.signal.aborted || generation !== scope) return;
      const res = await fetch("/api/tts", { headers, signal: controller.signal });
      if (!res.ok) return;
      const body: unknown = await res.json();
      if (controller.signal.aborted || generation !== scope || !body || typeof body !== "object"
        || !("configured" in body) || typeof body.configured !== "boolean") return;
      initialized = true;
      if (body.configured) {
        setNaturalSynth(naturalSynth);
        setVoiceEngine("natural");
      }
    } catch { /* leave the floor and allow the next user/online retry */ }
  })();
  // A held token lookup/body cannot keep the single-flight latch forever.
  const aborted = new Promise<void>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve(), { once: true });
  });
  probe = Promise.race([attempt, aborted]).finally(() => {
    clearTimeout(timer);
    if (generation === scope) { probe = null; probeController = null; }
  });
  return probe;
}
