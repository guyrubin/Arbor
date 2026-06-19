import type { ArborConfig } from "../config/env.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { matchResult } from "../practice/signals.js";

/**
 * Child-articulation ASR — the CHILD's voice only (parent voice stays on Gemini
 * Live). A pluggable provider seam so the scorer can be swapped by config with no
 * app-code change:
 *   - "gemini":  Vertex Gemini multimodal audio — reuses Arbor's existing model
 *                stack (no vendor, no secrets); encouraging got/almost/missed. DEFAULT cloud scorer.
 *   - "soapbox": SoapBox Labs kid-tuned, phoneme-level (primary when licensed).
 *   - "whisper": hosted, OpenAI-compatible Whisper transcription (self-host upgrade).
 *   - "none":   not configured → callers fall back to the on-device Web Speech scorer.
 *
 * COPPA-2026: a child voiceprint is biometric PII. Audio is forwarded for scoring
 * only and never persisted by Arbor; gate behind parental consent at the app layer.
 */

export type SpeechResult = "got" | "almost" | "missed";

export interface ChildScoreInput {
  target: string;
  sound: string;
  level: string;
  audio: { data: string; mimeType: string }; // base64 (no data: prefix)
}

export interface ChildScoreResult {
  result: SpeechResult;
  heard?: string;
  confidence?: number;
  provider: ArborConfig["childAsrProvider"];
}

export class NotConfiguredError extends Error {
  constructor(message = "Child ASR provider is not configured") {
    super(message);
    this.name = "NotConfiguredError";
  }
}

export const childAsrConfigured = (config: ArborConfig): boolean => {
  if (config.childAsrProvider === "gemini") return true; // always available — uses the Vertex stack
  if (config.childAsrProvider === "whisper") return !!config.whisperApiUrl;
  if (config.childAsrProvider === "soapbox") return !!config.soapboxApiUrl && !!config.soapboxApiKey;
  return false;
};

const b64ToBlob = (data: string, mimeType: string): Blob => {
  const buf = Buffer.from(data, "base64");
  // Uint8Array view keeps Node's global Blob happy across versions.
  return new Blob([new Uint8Array(buf)], { type: mimeType || "audio/webm" });
};

const extFor = (mimeType: string): string =>
  mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") || mimeType.includes("mpeg") ? "mp3" : mimeType.includes("ogg") ? "ogg" : "webm";

/** Hosted Whisper (OpenAI-compatible /audio/transcriptions). Transcribes, then maps
 *  the transcript to a target-word result with the shared, lenient matcher. */
async function scoreWhisper(config: ArborConfig, input: ChildScoreInput): Promise<ChildScoreResult> {
  if (!config.whisperApiUrl) throw new NotConfiguredError("WHISPER_API_URL is not set");
  const form = new FormData();
  form.append("model", config.whisperModel);
  form.append("response_format", "json");
  form.append("language", "en");
  // Bias the decoder toward the expected word — improves child-word recognition.
  form.append("prompt", input.target);
  form.append("file", b64ToBlob(input.audio.data, input.audio.mimeType), `utterance.${extFor(input.audio.mimeType)}`);

  const res = await fetch(config.whisperApiUrl, {
    method: "POST",
    headers: config.whisperApiKey ? { Authorization: `Bearer ${config.whisperApiKey}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper transcription failed (${res.status})`);
  const json: any = await res.json();
  const heard = String(json.text ?? "").trim();
  const m = matchResult(input.target, heard);
  return { result: m.result, heard, provider: "whisper" };
}

/** SoapBox Labs — phoneme-level kid ASR. Scaffolded HTTP integration: the request
 *  shape is generic and the response mapping MUST be adapted to SoapBox's actual
 *  schema once licensed (it returns per-phoneme correctness, not a transcript). */
async function scoreSoapbox(config: ArborConfig, input: ChildScoreInput): Promise<ChildScoreResult> {
  if (!config.soapboxApiUrl || !config.soapboxApiKey) throw new NotConfiguredError("SOAPBOX_API_URL/KEY not set");
  const res = await fetch(config.soapboxApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.soapboxApiKey}` },
    body: JSON.stringify({ targetWord: input.target, sound: input.sound, audio: input.audio.data, mimeType: input.audio.mimeType }),
  });
  if (!res.ok) throw new Error(`SoapBox scoring failed (${res.status})`);
  const json: any = await res.json();
  // ADAPT-TO-VENDOR: map SoapBox's phoneme/word result to our 3-level scale.
  // Expected (placeholder) shape: { score: 0..1, recognized: boolean, transcript?: string }.
  const score: number = typeof json.score === "number" ? json.score : json.recognized ? 1 : 0;
  const result: SpeechResult = score >= 0.8 ? "got" : score >= 0.5 ? "almost" : "missed";
  return { result, heard: json.transcript, confidence: score, provider: "soapbox" };
}

/** Gemini audio (Vertex) — reuses Arbor's existing model stack: no vendor, no
 *  secrets. Sends the child's utterance to Gemini and asks for an encouraging,
 *  lenient got/almost/missed judgment of the target + a best-effort transcript.
 *  The audio rides as an inline `images` part (the provider sends it as inlineData;
 *  Gemini accepts audio mime types) and routes to the Gemini analysis model. */
async function scoreGemini(modelProvider: ModelProvider, input: ChildScoreInput): Promise<ChildScoreResult> {
  const prompt = `You are scoring a young child's pronunciation in a gentle speech-practice game. Be ENCOURAGING and lenient — this is play, not a clinical assessment.
The child was asked to say the target: "${input.target}" (focus sound: ${input.sound || "n/a"}, level: ${input.level}).
Listen to the attached audio and judge whether the child said the target:
- "got": clearly recognizable as the target.
- "almost": a close, partial, or mildly distorted attempt at the target.
- "missed": silent, unintelligible, or unrelated.
Reply with ONLY compact JSON: {"result":"got"|"almost"|"missed","heard":"<best transcription of what was said, or empty string>"}`;
  const raw = (await modelProvider.generateJson({
    route: "analysis_structured",
    prompt,
    temperature: 0,
    images: [{ data: input.audio.data, mimeType: input.audio.mimeType }],
  })) as { result?: unknown; heard?: unknown };
  const result: SpeechResult = raw?.result === "got" || raw?.result === "missed" ? raw.result : "almost";
  return { result, heard: typeof raw?.heard === "string" ? raw.heard : undefined, provider: "gemini" };
}

export async function scoreChildUtterance(config: ArborConfig, modelProvider: ModelProvider, input: ChildScoreInput): Promise<ChildScoreResult> {
  switch (config.childAsrProvider) {
    case "gemini": return scoreGemini(modelProvider, input);
    case "whisper": return scoreWhisper(config, input);
    case "soapbox": return scoreSoapbox(config, input);
    default: throw new NotConfiguredError();
  }
}
