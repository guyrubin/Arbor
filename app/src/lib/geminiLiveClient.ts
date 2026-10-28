/**
 * Gemini Live browser client (RT-1). Opens a true bidirectional audio session
 * directly from the browser using a short-lived ephemeral token (the server key
 * is never exposed): mic → 16 kHz PCM → Live, and Live's 24 kHz PCM → speakers.
 *
 * VC-1/VC-2/VC-3/VC-5 (2026-07-25): NOTHING plays raw anymore. Every model
 * audio chunk is buffered inside the liveTurnGuard and released only after the
 * turn's output transcription passes BOTH the shared synchronous lexical floor
 * (safety/outputScreenLexical) and the authoritative server verdict from
 * POST /api/live/turn. `playChunk` is module-private and reachable ONLY as the
 * guard's sink — there is no direct playback path from the socket. Input and
 * output transcription are always requested (the token constraints pin them on
 * server-side, so a modified client cannot disable them). Screening
 * unavailability fails CLOSED: the guard halts the session and the caller
 * degrades to the screened browser voice loop with a visible notice.
 *
 * This module is **dynamically imported only when the server reports Live is
 * available**, so the @google/genai SDK and audio code never weigh down the main
 * bundle, and the working browser-speech voice loop remains the guaranteed
 * fallback when Live is not provisioned.
 */
import { GoogleGenAI, Modality } from "@google/genai";
import { createLiveTurnGuard, type LiveTurnRole, type LiveTurnVerdict } from "./liveTurnGuard";
import { screenModelOutputLexical } from "../safety/outputScreenLexical";

export type LivePhase = "connecting" | "listening" | "speaking" | "closed";
/** B-AIOPS-03: "failed" = a minted slice whose audio never came up. */
export type LiveUsageEvent = "opened" | "heartbeat" | "closed" | "failed";
/** B-AIOPS-02: one server-reserved slice of the family's daily voice time —
 *  the token, its pinned config, when it ends and what the family has left. */
export type LiveSlice = {
  token: string;
  model: string;
  systemInstruction: string;
  speechConfig?: unknown;
  /** ISO end of the reservation (= the token's provider expiry). */
  expiresAt?: string;
  /** What the family has left after this slice, in ms. */
  remainingMs?: number;
  reportUsage?: (event: LiveUsageEvent) => Promise<unknown>;
  /** The slice's usage-session id: what a renewal of it names (`renewOf`). */
  usageId?: string;
};
export type LiveHandlers = {
  onPhase?: (p: LivePhase) => void;
  onError?: (msg: string) => void;
  /** Ordinary remote close after readiness; resources are already stopped.
   *  Separate from phase closure, which also precedes safety notifications. */
  onRemoteClose?: () => void;
  /** POST /api/live/turn — the authoritative server screen (MUST reject on failure). */
  screenTurn: (role: LiveTurnRole, text: string) => Promise<LiveTurnVerdict>;
  /** Screened user transcript → persist via the COACH-2 appendVoiceUser seam. */
  onUserTurn?: (text: string) => void;
  /** AI-V7: incremental input transcription — the PARENT'S OWN words only,
   *  surfaced as the live caption while they speak (never model output). */
  onUserInterim?: (textDelta: string) => void;
  /** Released (screened) model transcript → persist via applyVoiceDelta/settle. */
  onModelTurn?: (text: string) => void;
  /** Crisis stop — the session is ALREADY closed when this fires. */
  onCrisis?: (verdict: LiveTurnVerdict) => void;
  /** Blocked model output — the session is ALREADY closed when this fires. */
  onBlocked?: (verdict: LiveTurnVerdict) => void;
  /** VC-5 fail-closed degrade — the session is ALREADY closed when this fires. */
  onFailClosed?: (reason: string) => void;
  /** B-AIOPS-02: the family's daily voice time ended the conversation calmly
   *  (no renewal was possible). The session is ALREADY closed when this fires;
   *  this is a resting state, never a connection failure. */
  onAllowanceEnd?: () => void;
};
export type LiveSessionOptions = {
  /** Cancels pending microphone/socket startup as well as an adopted session. */
  signal?: AbortSignal;
  reportUsage?: (event: LiveUsageEvent) => Promise<unknown>;
  token: string;
  model: string;
  /** The server-pinned instruction returned by /live/token (cosmetic here —
   *  the token's liveConnectConstraints are authoritative). */
  systemInstruction: string;
  /** The server-pinned per-language speechConfig returned by /live/token. */
  speechConfig?: unknown;
  /** B-AIOPS-02: the microphone the caller opened BEFORE the mint (see
   *  requestLiveMicrophone). Ownership passes to the session: it is released
   *  with the session, whatever ends it. */
  stream?: MediaStream;
  /** B-AIOPS-02: when this slice ends and what the family has left after it. */
  expiresAt?: string;
  remainingMs?: number;
  /** B-AIOPS-02: mint the next slice before this one ends. Resolves the next
   *  slice, or null when the family's voice time is spent (the conversation
   *  then ends calmly at `expiresAt`). Absent: no renewal (legacy tokens). */
  renew?: (renewOf?: string) => Promise<LiveSlice | null>;
  /** B-AIOPS-02: this first slice's usage-session id (its renewal names it). */
  usageId?: string;
};
export type LiveController = { stop: () => void };

/** F-01: a connect that cannot succeed must fail fast instead of wedging the
 *  chip — the SDK promise races a hard deadline (same race pattern as the
 *  guard's screenWithDeadline in lib/liveTurnGuard.ts). */
const CONNECT_TIMEOUT_MS = 10_000;
/** S5: getUserMedia can pend indefinitely (a stuck permission prompt, a
 *  webview with no mic plumbing) — BEFORE the connect deadline ever starts.
 *  Slightly longer than the connect deadline so a parent reading the
 *  permission dialog isn't yanked mid-decision; on expiry the caller falls
 *  back to the screened browser loop with a visible toast. */
const MIC_TIMEOUT_MS = 15_000;
const abortError = () => new DOMException("Voice start cancelled", "AbortError");
const withDeadline = <T,>(p: Promise<T>, ms: number, label: string, signal?: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); };
    const fail = (error: unknown) => { cleanup(); reject(error); };
    const onAbort = () => fail(abortError());
    const timer = setTimeout(() => fail(new Error(label)), ms);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    p.then(
      (value) => { cleanup(); resolve(value); },
      (error) => fail(error),
    );
  });
const withConnectDeadline = <T,>(p: Promise<T>, signal?: AbortSignal): Promise<T> =>
  withDeadline(p, CONNECT_TIMEOUT_MS, "live-connect-timeout", signal);

const floatTo16BitB64 = (input: Float32Array): string => {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const b64ToFloat32 = (b64: string): Float32Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const out = new Float32Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
};

const MIC_CONSTRAINTS: MediaStreamConstraints = { audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } };
const releaseTracks = (granted: MediaStream) => {
  for (const track of granted.getTracks()) {
    try { track.stop(); } catch { /* release the other tracks too */ }
  }
};

/**
 * B-AIOPS-02: open the microphone BEFORE any token is minted. A refused,
 * missing or stuck microphone then fails here, and the family's daily voice
 * time is never spent on a conversation that could not start. A grant that
 * arrives after cancellation or the deadline releases itself.
 */
export async function requestLiveMicrophone(signal?: AbortSignal): Promise<MediaStream> {
  if (signal?.aborted) throw abortError();
  const micRequest = navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  let abandoned = false;
  void micRequest.then((granted) => { if (abandoned) releaseTracks(granted); }).catch(() => {});
  try {
    return await withDeadline(micRequest, MIC_TIMEOUT_MS, "live-mic-timeout", signal);
  } catch (error) {
    abandoned = true;
    throw error;
  }
}

/** Release a microphone that never reached a session (e.g. the mint failed). */
export const releaseLiveMicrophone = (stream: MediaStream | null | undefined): void => {
  if (stream) releaseTracks(stream);
};

/** B-AIOPS-02 renewal. The first slice is short (a start that never reaches
 *  audio costs only it). It is renewed with a LONG slice, chained server-side
 *  onto its end, as soon as the first exchange has completed (or RENEW_LEAD_MS
 *  before it ends); every later slice is renewed RENEW_LEAD_MS before its end.
 *  The socket is swapped only at a QUIET moment: no model turn open, screening
 *  or playing, no reply awaited, the parent silent for QUIET_INPUT_MS — so no
 *  seam cuts the model; only if the slice is about to expire (SWAP_MARGIN_MS)
 *  is the swap forced, where the provider would end the socket anyway. The
 *  new socket is seeded with every turn of this talk, so nothing said before
 *  the seam is lost. A slice is only renewed while the family has at least
 *  MIN_RENEWABLE_MS left (the server treats less as spent). */
const RENEW_LEAD_MS = 30_000;
const SWAP_MARGIN_MS = 1_000;
const QUIET_INPUT_MS = 1_500;
/** Microphone level above which the parent counts as speaking right now. */
const VOICE_LEVEL = 0.02;
const MIN_RENEWABLE_MS = 30_000;
/** A budget end stops the session just before the provider's own expiry; a
 *  provider close this close to the end of a final slice is the same end. */
const ALLOWANCE_END_MARGIN_MS = 500;
const PROVIDER_CLOSE_GRACE_MS = 5_000;

export async function startGeminiLive(
  opts: LiveSessionOptions,
  handlers: LiveHandlers,
): Promise<LiveController> {
  if (opts.signal?.aborted) throw abortError();
  let stopped = false;
  let usageTimer: ReturnType<typeof setInterval> | undefined;
  let usageStarted = false;
  let usageQueue = Promise.resolve();
  // B-AIOPS-02: usage telemetry follows the CURRENT slice (each slice is its
  // own server reservation); the target is captured when the event is queued.
  let reportCurrent = opts.reportUsage;
  const reportUsage = (event: LiveUsageEvent) => {
    const target = reportCurrent;
    if (!target) return;
    usageQueue = usageQueue.then(async () => { await target(event); }).catch(() => {});
  };
  // B-AIOPS-02: the slice this session runs on, the socket generation that
  // owns the microphone and playback, and the renewal state.
  let sliceEnd = Date.parse(opts.expiresAt ?? "");
  let remainingMs = opts.remainingMs;
  let sliceTimer: ReturnType<typeof setTimeout> | undefined;
  let gen = 0;
  let renewing = false;
  let turnOpen = false;
  let lastInputAt = 0;
  // B-AIOPS-02 quiet-moment and seed state: a model turn being screened, a
  // parent turn still waiting for its reply, whether the first (short) slice
  // has been renewed, the current slice's usage id, and every screened turn
  // of this talk (re-sent to a new socket so no exchange is lost at a seam).
  let screening = false;
  let awaitingReply = false;
  let renewedOnce = false;
  let usageId = opts.usageId;
  const heard: { role: "user" | "model"; text: string }[] = [];
  let opened = false;
  let ready = false;
  let stream: MediaStream | null = null;
  let inCtx: AudioContext | null = null;
  let outCtx: AudioContext | null = null;
  let session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let rejectBeforeOpen: (error: Error) => void = () => {};
  let playHead = 0;
  const activeSources = new Set<AudioBufferSourceNode>();

  // Module-private: the guard sink remains the only playback caller.
  const playChunk = (b64: string) => {
    if (stopped || !outCtx) return;
    const samples = b64ToFloat32(b64);
    if (!samples.length) return;
    const buffer = outCtx.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const src = outCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(outCtx.destination);
    activeSources.add(src);
    src.onended = () => activeSources.delete(src);
    playHead = Math.max(playHead, outCtx.currentTime);
    src.start(playHead);
    playHead += buffer.duration;
  };

  const stopPlayback = () => {
    for (const src of activeSources) {
      try { src.stop(); } catch { /* already ended */ }
    }
    activeSources.clear();
    playHead = 0;
  };
  const stopTracks = (granted: MediaStream) => {
    for (const track of granted.getTracks()) {
      try { track.stop(); } catch { /* release the other tracks too */ }
    }
  };
  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(usageTimer);
    clearTimeout(sliceTimer);
    if (usageStarted) reportUsage("closed");
    opts.signal?.removeEventListener("abort", onAbort);
    guard.dispose();
    stopPlayback();
    try { processor?.disconnect(); } catch { /* already disconnected */ }
    try { source?.disconnect(); } catch { /* already disconnected */ }
    if (stream) stopTracks(stream);
    try { session?.close(); } catch { /* already closed */ }
    void inCtx?.close().catch(() => {});
    void outCtx?.close().catch(() => {});
    // A safety halt or close may beat the SDK's connect resolution, even
    // AFTER onopen. Startup must reject, never adopt this dead session.
    if (!ready) rejectBeforeOpen(opts.signal?.aborted ? abortError() : new Error("live-session-stopped"));
    handlers.onPhase?.("closed");
  };
  const onAbort = () => stopAll();
  const assertRunning = () => {
    if (stopped || opts.signal?.aborted) throw abortError();
  };

  const guard = createLiveTurnGuard({
    screenTurn: handlers.screenTurn,
    screenLexical: screenModelOutputLexical,
    sink: (b64) => { if (stopped) return; handlers.onPhase?.("speaking"); playChunk(b64); },
    // Stop all resources BEFORE the guard's crisis/blocked/fail-closed render.
    halt: stopAll,
    onInterrupt: stopPlayback,
    onUserTurn: (text) => { if (!stopped) { heard.push({ role: "user", text }); handlers.onUserTurn?.(text); } },
    onModelTurn: (text) => { if (!stopped) { heard.push({ role: "model", text }); handlers.onModelTurn?.(text); } },
    // stopped is expected here: guard.halt already ran. An EXTERNAL abort,
    // however, retires even these terminal notifications.
    onCrisis: (verdict) => { if (!opts.signal?.aborted) handlers.onCrisis?.(verdict); },
    onBlocked: (verdict) => { if (!opts.signal?.aborted) handlers.onBlocked?.(verdict); },
    onFailClosed: (reason) => { if (!opts.signal?.aborted) handlers.onFailClosed?.(reason); },
  });

  // One handler for every socket generation; a retired socket (after a
  // B-AIOPS-02 renewal swap) is ignored, so its late frames never play.
  const onServerMessage = (msg: any, from: number) => {
    if (stopped || from !== gen) return;
    // ALL audio remains buffered behind the lexical + server screens.
    if (msg?.data) { turnOpen = true; guard.pushAudio(msg.data); }
    if (stopped) return;
    const sc = msg?.serverContent;
    if (sc?.inputTranscription?.text) {
      lastInputAt = Date.now();
      awaitingReply = true;
      guard.pushInputTranscription(sc.inputTranscription.text);
      handlers.onUserInterim?.(sc.inputTranscription.text);
    }
    if (stopped) return;
    if (sc?.outputTranscription?.text) { turnOpen = true; guard.pushOutputTranscription(sc.outputTranscription.text); }
    if (sc?.interrupted) {
      turnOpen = false;
      guard.interrupt();
      if (!stopped && !guard.halted) handlers.onPhase?.("listening");
    }
    if (sc?.turnComplete) {
      turnOpen = false;
      awaitingReply = false;
      screening = true;
      void guard.endModelTurn().then(() => {
        screening = false;
        if (!stopped && !guard.halted) handlers.onPhase?.("listening");
      });
      // The first completed exchange proves the talk works: renew the short
      // first slice with a long one now (B-AIOPS-02).
      if (!renewedOnce && ready) void renewSlice();
    }
  };

  // The listener exists before requesting the microphone. X can release an
  // already granted stream while the SDK's connect promise is still pending.
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    assertRunning();
    handlers.onPhase?.("connecting");
    assertRunning();
    const ai = new GoogleGenAI({ apiKey: opts.token, httpOptions: { apiVersion: "v1beta" } });
    // B-AIOPS-02: the caller normally opened the microphone before the mint
    // and hands it over; the session owns (and releases) it from here.
    if (opts.stream) {
      stream = opts.stream;
    } else {
      const micRequest = navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      // Own the grant as soon as it arrives. A grant after cancellation/deadline
      // releases itself; no AudioContext or socket is created for that grant.
      void micRequest.then((granted) => {
        if (stopped) stopTracks(granted);
        else stream = granted;
      }).catch(() => {});
      stream = await withDeadline(micRequest, MIC_TIMEOUT_MS, "live-mic-timeout", opts.signal);
    }
    assertRunning();
    inCtx = new AudioContext({ sampleRate: 16000 });
    outCtx = new AudioContext({ sampleRate: 24000 });
    await withDeadline(Promise.all([inCtx, outCtx].map((context) => context.state === "suspended" ? context.resume() : Promise.resolve())), CONNECT_TIMEOUT_MS, "live-audio-timeout", opts.signal);
    assertRunning();

    const failedBeforeOpen = new Promise<never>((_, reject) => { rejectBeforeOpen = reject; });
    // connect() may throw synchronously before Promise.race attaches below.
    // Mark this deferred handled while retaining its rejection for the race.
    void failedBeforeOpen.catch(() => {});
    let resolveSetup: () => void = () => {};
    const configured = new Promise<void>((resolve) => { resolveSetup = resolve; });
    const connecting = ai.live.connect({
      model: opts.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: opts.systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        ...(opts.speechConfig ? { speechConfig: opts.speechConfig as never } : {}),
      },
      callbacks: {
        onopen: () => {
          if (stopped) return;
          opened = true; // WebSocket open is not model acceptance.
        },
        onmessage: (msg: any) => {
          if (stopped) return;
          if (msg?.setupComplete) resolveSetup();
          onServerMessage(msg, 0);
        },
        onerror: (error: any) => {
          if (stopped || gen !== 0) return;
          const failure = new Error(error?.message || "Gemini Live error");
          if (!ready) { rejectBeforeOpen(failure); stopAll(); return; }
          stopAll();
          handlers.onError?.(failure.message);
        },
        onclose: () => {
          if (stopped || gen !== 0) return;
          if (!ready) {
            rejectBeforeOpen(new Error(opened ? "live-closed-during-start" : "live-closed-before-open"));
            stopAll();
            return;
          }
          currentClosed();
        },
      },
    });
    // A resolution after stop/timeout owns only this socket, never a later
    // attempt's controller. The side branch also handles late SDK rejection.
    void connecting.then((connected) => {
      if (stopped) { try { connected.close(); } catch { /* already closed */ } }
      else session = connected;
    }).catch(() => {});
    // The SDK resolves when the socket opens. Wait for provider setup approval
    // too: retired/unsupported models can close immediately after onopen.
    const prepared = Promise.all([connecting, configured]).then(([socket]) => socket);
    const connected = await withConnectDeadline(Promise.race([prepared, failedBeforeOpen]), opts.signal);
    assertRunning();
    session = connected;
    source = inCtx.createMediaStreamSource(stream);
    processor = inCtx.createScriptProcessor(4096, 1, 1);
    source.connect(processor);
    processor.connect(inCtx.destination);
    processor.onaudioprocess = (event) => {
      if (stopped) return;
      const samples = event.inputBuffer.getChannelData(0);
      // B-AIOPS-02: the parent speaking right now is never a quiet moment.
      for (let i = 0; i < samples.length; i += 64) { if (Math.abs(samples[i]) > VOICE_LEVEL) { lastInputAt = Date.now(); break; } }
      const data = floatTo16BitB64(samples);
      try { session?.sendRealtimeInput({ media: { data, mimeType: "audio/pcm;rate=16000" } }); } catch { /* closed */ }
    };
    ready = true;
    usageStarted = true;
    reportUsage("opened");
    if (opts.reportUsage || opts.renew) usageTimer = setInterval(() => reportUsage("heartbeat"), 15_000);
    handlers.onPhase?.("listening");
    assertRunning();
    armSlice();
    return { stop: stopAll };
  } catch (err) {
    // Covers mic, both AudioContext constructors, SDK connect AND graph setup.
    // In particular, partial construction never strands a granted microphone.
    stopAll();
    throw err;
  }

  // ── B-AIOPS-02: slices, renewal and the calm end ─────────────────────────
  // (function declarations: hoisted, called only after readiness)

  /** Schedule what happens at the end of the current slice: mint the next one
   *  while the family has time left, otherwise end calmly at the slice end. */
  function armSlice() {
    clearTimeout(sliceTimer);
    if (stopped || !Number.isFinite(sliceEnd)) return;
    if (opts.renew && (remainingMs ?? 0) >= MIN_RENEWABLE_MS) {
      // (the first slice may also renew earlier, at its first completed exchange)
      sliceTimer = setTimeout(() => { void renewSlice(); }, Math.max(0, sliceEnd - RENEW_LEAD_MS - Date.now()));
    } else {
      sliceTimer = setTimeout(endForAllowance, Math.max(0, sliceEnd - ALLOWANCE_END_MARGIN_MS - Date.now()));
    }
  }

  /** The family's voice time ended the conversation: a resting state. */
  function endForAllowance() {
    if (stopped) return;
    stopAll();
    handlers.onAllowanceEnd?.();
  }

  /** The current socket closed after readiness. Near the end of a final slice
   *  that is the allowance, not a failure; otherwise it is a remote close. */
  function currentClosed() {
    const finalSlice = !opts.renew || (remainingMs ?? 0) < MIN_RENEWABLE_MS;
    if (Number.isFinite(sliceEnd) && finalSlice && Date.now() >= sliceEnd - PROVIDER_CLOSE_GRACE_MS) {
      endForAllowance();
      return;
    }
    stopAll();
    handlers.onRemoteClose?.();
  }

  /** A renewal that could not be minted or connected: the conversation runs
   *  to the end of the slice it has, then ends as a connection end. */
  function renewalFailed() {
    renewing = false;
    clearTimeout(sliceTimer);
    sliceTimer = setTimeout(() => { if (!stopped) { stopAll(); handlers.onRemoteClose?.(); } }, Math.max(0, sliceEnd - ALLOWANCE_END_MARGIN_MS - Date.now()));
  }

  /** Quiet = no model turn open, screening or playing, no parent turn still
   *  waiting for its reply, and the parent silent for a moment. */
  function quiet() {
    return !turnOpen && !screening && !awaitingReply && activeSources.size === 0 && Date.now() - lastInputAt >= QUIET_INPUT_MS;
  }

  async function renewSlice() {
    if (stopped || renewing || !opts.renew || !Number.isFinite(sliceEnd) || (remainingMs ?? 0) < MIN_RENEWABLE_MS) return;
    renewing = true;
    clearTimeout(sliceTimer);
    let next: LiveSlice | null;
    try {
      // The server chains a long slice only onto a session it knows opened.
      await usageQueue;
      next = await opts.renew(usageId);
    } catch {
      if (!stopped) renewalFailed();
      return;
    }
    if (stopped) return;
    if (next === null) {
      // The family's time is spent: end calmly when this slice ends.
      renewing = false;
      remainingMs = 0;
      armSlice();
      return;
    }
    const slice = next;
    const myGen = gen + 1;
    let resolveReady: () => void = () => {};
    let rejectReady: (error: Error) => void = () => {};
    const readyNext = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    void readyNext.catch(() => {});
    let nextSession: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
    let connectedNext: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
    let abandonedNext = false;
    try {
      // Same config as the first socket; the new token's constraints pin it,
      // including the conversation so far in its system instruction.
      const nextAi = new GoogleGenAI({ apiKey: slice.token, httpOptions: { apiVersion: "v1beta" } });
      const nextConnecting = nextAi.live.connect({
        model: slice.model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: slice.systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          ...(slice.speechConfig ? { speechConfig: slice.speechConfig as never } : {}),
        },
        callbacks: {
          onopen: () => {},
          onmessage: (msg: any) => {
            if (stopped) return;
            if (msg?.setupComplete) resolveReady();
            onServerMessage(msg, myGen);
          },
          onerror: (error: any) => {
            if (stopped) return;
            if (gen !== myGen) { rejectReady(new Error(error?.message || "live-renew-error")); return; }
            stopAll();
            handlers.onError?.(error?.message || "Gemini Live error");
          },
          onclose: () => {
            if (stopped) return;
            if (gen !== myGen) { rejectReady(new Error("live-renew-closed")); return; }
            currentClosed();
          },
        },
      });
      void nextConnecting.then((connected) => {
        connectedNext = connected;
        if (stopped || abandonedNext) { try { connected.close(); } catch { /* closed */ } }
      }).catch(() => {});
      const budget = Math.max(1_000, Math.min(CONNECT_TIMEOUT_MS, sliceEnd - Date.now()));
      nextSession = await withDeadline(Promise.all([nextConnecting, readyNext]).then(([connected]) => connected), budget, "live-renew-timeout");
    } catch {
      abandonedNext = true;
      try { connectedNext?.close(); } catch { /* closed */ }
      if (slice.reportUsage) void slice.reportUsage("failed").catch(() => {});
      if (!stopped) renewalFailed();
      return;
    }
    // Swap at a quiet moment, or at the latest just before the slice ends.
    while (!stopped && !quiet() && Date.now() < sliceEnd - SWAP_MARGIN_MS) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (stopped) { try { nextSession.close(); } catch { /* closed */ } return; }
    const forced = !quiet();
    const previous = session;
    gen = myGen;
    session = nextSession;
    if (forced) { turnOpen = false; screening = false; awaitingReply = false; guard.interrupt(); stopPlayback(); }
    // Seed the new socket with this whole talk (its token's context was built
    // at the start of the talk), as history only: it does not answer it.
    if (heard.length) {
      try {
        nextSession.sendClientContent({ turns: heard.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })), turnComplete: false });
      } catch { /* a seed that cannot be sent leaves the pinned context */ }
    }
    reportUsage("closed");
    reportCurrent = slice.reportUsage;
    usageId = slice.usageId;
    reportUsage("opened");
    sliceEnd = Date.parse(slice.expiresAt ?? "");
    remainingMs = slice.remainingMs;
    renewedOnce = true;
    renewing = false;
    try { previous?.close(); } catch { /* already closed */ }
    if (!stopped && !guard.halted) handlers.onPhase?.("listening");
    armSlice();
  }
}
