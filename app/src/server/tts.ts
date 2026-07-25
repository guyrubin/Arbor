import { GoogleAuth } from "google-auth-library";
import type { ArborConfig } from "../config/env.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { providerRegion, routePolicyFor, selectProvider, type ProviderCandidate } from "../ai/capabilities/policy.js";
import type { CapabilityRequest } from "../ai/capabilities/contracts.js";
import { screenModelOutput, type OutputScreenVerdict } from "../safety/outputScreen.js";
import { logger } from "./logger.js";

/**
 * Neural text-to-speech seam (Epic A) — synthesizes screened app text (story /
 * coach narration) into natural speech. A pluggable
 * provider seam mirroring `server/childAsr.ts`, default-OFF so the browser
 * `SpeechSynthesis` floor (lib/voice.ts) remains the shipped default until this is
 * deliberately enabled:
 *   - "google": Google Cloud Text-to-Speech on the SAME GCP project via ADC — no
 *               new vendor, secret, or DPA (reuses google-auth-library + the
 *               cloud-platform scope the runtime already has).
 *   - "none":   not configured → callers use the on-device browser voice.
 *
 * `synthesizeSpeech` is the provider-only primitive. The public API is a safety
 * boundary because authenticated clients can submit arbitrary text, so callers
 * must use `screenAndSynthesizeSpeech` to screen immediately before synthesis.
 *
 * COPPA: TTS is OUTPUT-only and transient — no audio is persisted and no child PII
 * is involved (the input is app-rendered, screened output), so it adds no new
 * consent purpose. `voice_processing` continues to gate inbound CHILD voice only.
 */

export type TtsLang = "en" | "he";
export interface TtsInput {
  text: string;
  lang: TtsLang;
}
export interface TtsResult {
  audio: string; // base64, no `data:` prefix
  mimeType: string;
}

export class NotConfiguredError extends Error {
  constructor(message = "Neural TTS provider is not configured") {
    super(message);
    this.name = "NotConfiguredError";
  }
}

export class UnsafeTtsOutputError extends Error {
  constructor(public readonly verdict: OutputScreenVerdict) { super("Text-to-speech output was blocked by Arbor's safety policy."); this.name = "UnsafeTtsOutputError"; }
}

/** True when neural TTS is enabled (and not hard-killed). */
export const ttsConfigured = (config: ArborConfig): boolean =>
  !config.ttsDisabled && config.ttsProvider === "google";

const LANGUAGE_CODE: Record<TtsLang, string> = { en: "en-US", he: "he-IL" };

// Cached ADC client; google-auth-library refreshes the access token internally.
let auth: GoogleAuth | null = null;
const getAuth = (): GoogleAuth => {
  if (!auth) auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  return auth;
};

/** Google Cloud Text-to-Speech `text:synthesize` (stable v1). Returns base64 MP3. */
async function synthesizeGoogle(config: ArborConfig, input: TtsInput): Promise<TtsResult> {
  const client = await getAuth().getClient();
  const accessToken = await client.getAccessToken();
  const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
  if (!token) throw new Error("Could not obtain an ADC access token for Cloud Text-to-Speech.");

  const languageCode = LANGUAGE_CODE[input.lang] ?? LANGUAGE_CODE.en;
  const voiceName = input.lang === "he" ? config.ttsVoiceHe : config.ttsVoiceEn;

  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: input.text },
      voice: { languageCode, ...(voiceName ? { name: voiceName } : {}) },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Cloud TTS synthesize failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const json = (await res.json()) as { audioContent?: string };
  const audio = String(json.audioContent ?? "");
  if (!audio) throw new Error("Cloud TTS returned no audioContent.");

  // Char-metered usage signal (Cloud TTS bills per character). Never throws.
  try {
    logger.info("tts.synthesis", { provider: "google", lang: input.lang, voice: voiceName || languageCode, chars: input.text.length });
  } catch {
    /* telemetry must never break synthesis */
  }
  return { audio, mimeType: "audio/mpeg" };
}

/** COACH-3: the speech_synthesis provider candidate the current config yields.
 *  Cloud TTS runs on the app's own GCP project, so its declared residency
 *  follows the configured Vertex location. */
export const ttsCandidateFor = (config: ArborConfig): ProviderCandidate => ({
  ref: { provider: "google", model: "cloud-tts-v1", region: providerRegion(config.vertexLocation) },
  capabilities: ["speech_synthesis"],
  audiences: ["parent", "child"],
  // TTS input is app-rendered, already-screened output text — never raw child data.
  dataClasses: ["public", "account"],
  trainsOnCustomerData: false,
  retentionDays: 0,
  score: { quality: 3, safety: 3, reliability: 3, latencyFitness: 3, costFitness: 3 },
});

/** Synthesize already-screened text. Throws NotConfiguredError when disabled/off,
 *  and AiProviderError("policy_denied") when the configured provider violates
 *  the route policy (COACH-3 — fail closed, e.g. a non-EU region in prod). */
export async function synthesizeSpeech(config: ArborConfig, input: TtsInput): Promise<TtsResult> {
  if (!ttsConfigured(config)) throw new NotConfiguredError();
  const request: CapabilityRequest<"speech_synthesis"> = {
    capability: "speech_synthesis",
    route: "creative_low_risk",
    audience: "parent",
    locale: input.lang,
    dataClasses: ["public"],
    risk: "low",
  };
  const decision = selectProvider(request, routePolicyFor(config), [ttsCandidateFor(config)]);
  switch (decision.selected.ref.provider) {
    case "google":
      return synthesizeGoogle(config, input);
    default:
      throw new NotConfiguredError();
  }
}

/** Public TTS trust boundary: caller-provided text is screened immediately before synthesis. */
export async function screenAndSynthesizeSpeech(config: ArborConfig, modelProvider: ModelProvider, input: TtsInput): Promise<TtsResult> {
  const verdict = await screenModelOutput(modelProvider, input.text);
  if (verdict.flagged) throw new UnsafeTtsOutputError(verdict);
  return synthesizeSpeech(config, input);
}
