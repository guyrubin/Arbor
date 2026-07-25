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
    const now = outCtx.currentTime;
    playHead = Math.max(playHead, now);
    src.start(playHead);
    playHead += buffer.duration;
  };

  let stopped = false;
  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    guard.dispose();
    try { processor.disconnect(); source.disconnect(); } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop());
    try { session.close(); } catch { /* ignore */ }
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
    onUserTurn: handlers.onUserTurn,
    onModelTurn: handlers.onModelTurn,
    onCrisis: handlers.onCrisis,
    onBlocked: handlers.onBlocked,
    onFailClosed: handlers.onFailClosed,
  });

  const session = await ai.live.connect({
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
      onopen: () => handlers.onPhase?.("listening"),
      onmessage: (msg: any) => {
        // ALL playback routes through the guard — buffered, screened, released.
        if (msg?.data) guard.pushAudio(msg.data);
        const sc = msg?.serverContent;
        if (sc?.inputTranscription?.text) guard.pushInputTranscription(sc.inputTranscription.text);
        if (sc?.outputTranscription?.text) guard.pushOutputTranscription(sc.outputTranscription.text);
        if (sc?.turnComplete) {
          void guard.endModelTurn().then(() => {
            if (!guard.halted) handlers.onPhase?.("listening");
          });
        }
      },
      onerror: (e: any) => handlers.onError?.(e?.message || "Gemini Live error"),
      onclose: () => handlers.onPhase?.("closed"),
    },
  });

  const source = inCtx.createMediaStreamSource(stream);
  const processor = inCtx.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(inCtx.destination);
  processor.onaudioprocess = (e) => {
    const data = floatTo16BitB64(e.inputBuffer.getChannelData(0));
    try { session.sendRealtimeInput({ media: { data, mimeType: "audio/pcm;rate=16000" } }); } catch { /* closed */ }
  };

  return { stop: stopAll };
}
