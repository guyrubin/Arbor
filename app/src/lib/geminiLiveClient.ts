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
const withConnectDeadline = <T,>(p: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("live-connect-timeout")), CONNECT_TIMEOUT_MS);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });

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
  handlers.onPhase?.("connecting");
  const ai = new GoogleGenAI({ apiKey: opts.token, httpOptions: { apiVersion: "v1alpha" } });

  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const inCtx = new AudioContext({ sampleRate: 16000 });
  const outCtx = new AudioContext({ sampleRate: 24000 });
  let playHead = 0;

  // AI-V2(b): every scheduled source is RETAINED so a server-VAD barge-in
  // (serverContent.interrupted) can stop already-released audio instantly
  // instead of letting it play on top of the parent's new words.
  const activeSources = new Set<AudioBufferSourceNode>();

  // Module-PRIVATE playback (VC-1 condition 2): the only reference to this
  // function is the guard's sink below — no socket message can reach it.
  const playChunk = (b64: string) => {
    const samples = b64ToFloat32(b64);
    if (!samples.length) return;
    const buffer = outCtx.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const src = outCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(outCtx.destination);
    activeSources.add(src);
    src.onended = () => activeSources.delete(src);
    const now = outCtx.currentTime;
    playHead = Math.max(playHead, now);
    src.start(playHead);
    playHead += buffer.duration;
  };

  // AI-V2(b): the guard's onInterrupt sink — stop every retained source and
  // reset the schedule head so the next released turn starts immediately.
  // Reachable ONLY through guard.interrupt() (playChunk stays module-private
  // and this never plays anything — it only silences).
  const stopPlayback = () => {
    for (const src of activeSources) {
      try { src.stop(); } catch { /* already ended */ }
    }
    activeSources.clear();
    playHead = 0;
  };

  // F-01: declared nullable so stopAll is safe to run when the connect itself
  // fails — the mic and both audio contexts must release even though the
  // session/processor graph never came up.
  let session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;

  let stopped = false;
  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    guard.dispose();
    try { processor?.disconnect(); source?.disconnect(); } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop());
    try { session?.close(); } catch { /* ignore */ }
    void inCtx.close().catch(() => {});
    void outCtx.close().catch(() => {});
    handlers.onPhase?.("closed");
  };

  const guard = createLiveTurnGuard({
    screenTurn: handlers.screenTurn,
    screenLexical: screenModelOutputLexical,
    sink: (b64) => { handlers.onPhase?.("speaking"); playChunk(b64); },
    // The guard halts the WHOLE session (socket, mic, audio) before any
    // crisis/blocked/degrade callback renders — stop() before render (VC-2).
    halt: stopAll,
    onInterrupt: stopPlayback,
    onUserTurn: handlers.onUserTurn,
    onModelTurn: handlers.onModelTurn,
    onCrisis: handlers.onCrisis,
    onBlocked: handlers.onBlocked,
    onFailClosed: handlers.onFailClosed,
  });

  // F-01 (deferred pattern): the SDK's connect promise can hang, or resolve a
  // session whose socket already died. Track whether onopen ever fired; when
  // onerror/onclose beats it, reject startGeminiLive deterministically so the
  // caller's catch (not a wedged ref) owns the failure.
  let opened = false;
  let rejectBeforeOpen: (e: Error) => void = () => {};
  const failedBeforeOpen = new Promise<never>((_, reject) => { rejectBeforeOpen = reject; });

  const connecting = ai.live.connect({
    model: opts.model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: opts.systemInstruction,
      // VC-1: transcription is ALWAYS on (and server-pinned in the token
      // constraints) — without it there is nothing to screen, and the guard
      // treats transcription absence as flagged.
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      ...(opts.speechConfig ? { speechConfig: opts.speechConfig as never } : {}),
    },
    callbacks: {
      onopen: () => { opened = true; handlers.onPhase?.("listening"); },
      onmessage: (msg: any) => {
        // ALL playback routes through the guard — buffered, screened, released.
        if (msg?.data) guard.pushAudio(msg.data);
        const sc = msg?.serverContent;
        if (sc?.inputTranscription?.text) {
          guard.pushInputTranscription(sc.inputTranscription.text);
          // Caption of the parent's own words (AI-V7) — not model output.
          handlers.onUserInterim?.(sc.inputTranscription.text);
        }
        if (sc?.outputTranscription?.text) guard.pushOutputTranscription(sc.outputTranscription.text);
        // AI-V2(b): the parent spoke over the model — Gemini's server VAD
        // reports the barge-in. ALL interruption handling routes through the
        // guard: it drops the in-flight turn's unreleased buffer and drives
        // the retained-source stop via its onInterrupt sink (playChunk keeps
        // exactly one caller — the guard's release sink).
        if (sc?.interrupted) {
          guard.interrupt();
          if (!guard.halted) handlers.onPhase?.("listening");
        }
        if (sc?.turnComplete) {
          void guard.endModelTurn().then(() => {
            if (!guard.halted) handlers.onPhase?.("listening");
          });
        }
      },
      // F-01: before open, error/close reject the start promise (the caller
      // surfaces it); after open, they report through the live handlers.
      onerror: (e: any) => {
        if (!opened) { rejectBeforeOpen(new Error(e?.message || "Gemini Live error")); return; }
        handlers.onError?.(e?.message || "Gemini Live error");
      },
      onclose: () => {
        if (!opened) { rejectBeforeOpen(new Error("live-closed-before-open")); return; }
        handlers.onPhase?.("closed");
      },
    },
  });

  try {
    session = await withConnectDeadline(Promise.race([connecting, failedBeforeOpen]));
    // A resolved connect counts as opened even if the SDK never fires onopen —
    // from here error/close must report through the live handlers, not reject.
    opened = true;
  } catch (err) {
    // F-01: a failed connect must not leave the mic or audio contexts held —
    // release everything, then let the caller's catch decide the fallback.
    stopAll();
    // A late SDK resolution after the race lost still gets its socket closed.
    void connecting.then((s) => { try { s.close(); } catch { /* ignore */ } }).catch(() => {});
    throw err;
  }

  source = inCtx.createMediaStreamSource(stream);
  processor = inCtx.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(inCtx.destination);
  processor.onaudioprocess = (e) => {
    const data = floatTo16BitB64(e.inputBuffer.getChannelData(0));
    try { session?.sendRealtimeInput({ media: { data, mimeType: "audio/pcm;rate=16000" } }); } catch { /* closed */ }
  };

  return { stop: stopAll };
}
