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
};
export type LiveSessionOptions = {
  /** Cancels pending microphone/socket startup as well as an adopted session. */
  signal?: AbortSignal;
  token: string;
  model: string;
  /** The server-pinned instruction returned by /live/token (cosmetic here —
   *  the token's liveConnectConstraints are authoritative). */
  systemInstruction: string;
  /** The server-pinned per-language speechConfig returned by /live/token. */
  speechConfig?: unknown;
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

export async function startGeminiLive(
  opts: LiveSessionOptions,
  handlers: LiveHandlers,
): Promise<LiveController> {
  if (opts.signal?.aborted) throw abortError();
  let stopped = false;
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
    onUserTurn: (text) => { if (!stopped) handlers.onUserTurn?.(text); },
    onModelTurn: (text) => { if (!stopped) handlers.onModelTurn?.(text); },
    // stopped is expected here: guard.halt already ran. An EXTERNAL abort,
    // however, retires even these terminal notifications.
    onCrisis: (verdict) => { if (!opts.signal?.aborted) handlers.onCrisis?.(verdict); },
    onBlocked: (verdict) => { if (!opts.signal?.aborted) handlers.onBlocked?.(verdict); },
    onFailClosed: (reason) => { if (!opts.signal?.aborted) handlers.onFailClosed?.(reason); },
  });

  // The listener exists before requesting the microphone. X can release an
  // already granted stream while the SDK's connect promise is still pending.
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    assertRunning();
    handlers.onPhase?.("connecting");
    assertRunning();
    const ai = new GoogleGenAI({ apiKey: opts.token, httpOptions: { apiVersion: "v1alpha" } });
    const micRequest = navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    // Own the grant as soon as it arrives. A grant after cancellation/deadline
    // releases itself; no AudioContext or socket is created for that grant.
    void micRequest.then((granted) => {
      if (stopped) stopTracks(granted);
      else stream = granted;
    }).catch(() => {});
    stream = await withDeadline(micRequest, MIC_TIMEOUT_MS, "live-mic-timeout", opts.signal);
    assertRunning();
    inCtx = new AudioContext({ sampleRate: 16000 });
    outCtx = new AudioContext({ sampleRate: 24000 });
    assertRunning();

    const failedBeforeOpen = new Promise<never>((_, reject) => { rejectBeforeOpen = reject; });
    // connect() may throw synchronously before Promise.race attaches below.
    // Mark this deferred handled while retaining its rejection for the race.
    void failedBeforeOpen.catch(() => {});
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
          opened = true;
          handlers.onPhase?.("listening");
        },
        onmessage: (msg: any) => {
          if (stopped) return;
          // ALL audio remains buffered behind the lexical + server screens.
          if (msg?.data) guard.pushAudio(msg.data);
          if (stopped) return;
          const sc = msg?.serverContent;
          if (sc?.inputTranscription?.text) {
            guard.pushInputTranscription(sc.inputTranscription.text);
            handlers.onUserInterim?.(sc.inputTranscription.text);
          }
          if (stopped) return;
          if (sc?.outputTranscription?.text) guard.pushOutputTranscription(sc.outputTranscription.text);
          if (sc?.interrupted) {
            guard.interrupt();
            if (!stopped && !guard.halted) handlers.onPhase?.("listening");
          }
          if (sc?.turnComplete) {
            void guard.endModelTurn().then(() => {
              if (!stopped && !guard.halted) handlers.onPhase?.("listening");
            });
          }
        },
        onerror: (error: any) => {
          if (stopped) return;
          const failure = new Error(error?.message || "Gemini Live error");
          if (!ready) { rejectBeforeOpen(failure); stopAll(); return; }
          stopAll();
          handlers.onError?.(failure.message);
        },
        onclose: () => {
          if (stopped) return;
          if (!ready) {
            rejectBeforeOpen(new Error(opened ? "live-closed-during-start" : "live-closed-before-open"));
            stopAll();
            return;
          }
          stopAll();
          handlers.onRemoteClose?.();
        },
      },
    });
    // A resolution after stop/timeout owns only this socket, never a later
    // attempt's controller. The side branch also handles late SDK rejection.
    void connecting.then((connected) => {
      if (stopped) { try { connected.close(); } catch { /* already closed */ } }
      else session = connected;
    }).catch(() => {});
    const connected = await withConnectDeadline(Promise.race([connecting, failedBeforeOpen]), opts.signal);
    assertRunning();
    session = connected;
    source = inCtx.createMediaStreamSource(stream);
    processor = inCtx.createScriptProcessor(4096, 1, 1);
    source.connect(processor);
    processor.connect(inCtx.destination);
    processor.onaudioprocess = (event) => {
      if (stopped) return;
      const data = floatTo16BitB64(event.inputBuffer.getChannelData(0));
      try { session?.sendRealtimeInput({ media: { data, mimeType: "audio/pcm;rate=16000" } }); } catch { /* closed */ }
    };
    ready = true;
    if (!opened) { opened = true; handlers.onPhase?.("listening"); }
    assertRunning();
    return { stop: stopAll };
  } catch (err) {
    // Covers mic, both AudioContext constructors, SDK connect AND graph setup.
    // In particular, partial construction never strands a granted microphone.
    stopAll();
    throw err;
  }
}
