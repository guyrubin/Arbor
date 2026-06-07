/**
 * Gemini Live browser client (RT-1). Opens a true bidirectional audio session
 * directly from the browser using a short-lived ephemeral token (the server key
 * is never exposed): mic → 16 kHz PCM → Live, and Live's 24 kHz PCM → speakers.
 *
 * This module is **dynamically imported only when the server reports Live is
 * available**, so the @google/genai SDK and audio code never weigh down the main
 * bundle, and the working browser-speech voice loop remains the guaranteed
 * fallback when Live is not provisioned.
 */
import { GoogleGenAI, Modality } from "@google/genai";

export type LivePhase = "connecting" | "listening" | "speaking" | "closed";
export type LiveHandlers = {
  onPhase?: (p: LivePhase) => void;
  onText?: (t: string) => void;
  onError?: (msg: string) => void;
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
  token: string,
  model: string,
  systemInstruction: string,
  handlers: LiveHandlers,
): Promise<LiveController> {
  handlers.onPhase?.("connecting");
  const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });

  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const inCtx = new AudioContext({ sampleRate: 16000 });
  const outCtx = new AudioContext({ sampleRate: 24000 });
  let playHead = 0;

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

  const session = await ai.live.connect({
    model,
    config: { responseModalities: [Modality.AUDIO], systemInstruction },
    callbacks: {
      onopen: () => handlers.onPhase?.("listening"),
      onmessage: (msg: any) => {
        if (msg?.data) { handlers.onPhase?.("speaking"); playChunk(msg.data); }
        const parts = msg?.serverContent?.modelTurn?.parts || [];
        for (const p of parts) if (p.text) handlers.onText?.(p.text);
        if (msg?.serverContent?.turnComplete) handlers.onPhase?.("listening");
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

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try { processor.disconnect(); source.disconnect(); } catch { /* ignore */ }
      stream.getTracks().forEach((t) => t.stop());
      try { session.close(); } catch { /* ignore */ }
      void inCtx.close().catch(() => {});
      void outCtx.close().catch(() => {});
      handlers.onPhase?.("closed");
    },
  };
}
