import { GoogleAuth } from "google-auth-library";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Neural text-to-speech seam (Epic A) — synthesizes ALREADY-SCREENED, already-
 * rendered app text (story / coach narration) into natural speech. A pluggable
 * provider seam mirroring `server/childAsr.ts`, default-OFF so the browser
 * `SpeechSynthesis` floor (lib/voice.ts) remains the shipped default until this is
 * deliberately enabled:
 *   - "google": Google Cloud Text-to-Speech on the SAME GCP project via ADC — no
 *               new vendor, secret, or DPA (reuses google-auth-library + the
 *               cloud-platform scope the runtime already has).
 *   - "none":   not configured → callers use the on-device browser voice.
 *
 * NOT a safety boundary. Callers must only ever pass text that has already passed
 * the server-side output screen (`screenModelOutput`). This route does not — and
 * cannot — re-verify that; the guarantee lives UPSTREAM, where the text was
 * produced and screened before res.json.
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

/** Synthesize already-screened text. Throws NotConfiguredError when disabled/off. */
export async function synthesizeSpeech(config: ArborConfig, input: TtsInput): Promise<TtsResult> {
  if (!ttsConfigured(config)) throw new NotConfiguredError();
  switch (config.ttsProvider) {
    case "google":
      return synthesizeGoogle(config, input);
    default:
      throw new NotConfiguredError();
  }
}
