import { api } from "./api";
import { matchResult } from "../practice/signals";
import type { SpeechAttempt, SpeechLevel } from "../types";

/**
 * Child-utterance scorer (child voice only). A vendor-agnostic seam: prefers the
 * configured cloud scorer (SoapBox phoneme-level, or hosted Whisper) when audio is
 * available, and always falls back to the on-device Web Speech transcript + the
 * shared lenient matcher. Parent voice is unrelated — that's Gemini Live.
 */

export type SpeechResult = SpeechAttempt["result"];

export interface UtteranceScore {
  result: SpeechResult;
  heard?: string;
  confidence?: number;
  source: "cloud" | "on-device";
}

// Capability is fixed per deploy; cache it so we don't probe every utterance.
let cloudCap: boolean | null = null;
let capPromise: Promise<boolean> | null = null;

export async function childCloudScoringAvailable(): Promise<boolean> {
  if (cloudCap !== null) return cloudCap;
  if (!capPromise) {
    capPromise = api
      .childAsrStatus()
      .then((s) => (cloudCap = !!s.configured))
      .catch(() => (cloudCap = false));
  }
  return capPromise;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/**
 * Score a child utterance. Returns a cloud result when configured + audio present,
 * else the on-device transcript result, else null (caller uses parent self-scoring).
 */
export async function scoreUtterance(input: {
  target: string;
  sound: string;
  level: SpeechLevel;
  audioBlob?: Blob;
  transcript?: string;
}): Promise<UtteranceScore | null> {
  if (input.audioBlob && (await childCloudScoringAvailable())) {
    try {
      const dataUrl = await blobToDataUrl(input.audioBlob);
      const r = await api.scoreUtterance({
        target: input.target,
        sound: input.sound,
        level: input.level,
        audio: { dataUrl, mimeType: input.audioBlob.type },
      });
      if (r.configured && r.result) {
        return { result: r.result, heard: r.heard, confidence: r.confidence, source: "cloud" };
      }
    } catch {
      /* fall through to on-device */
    }
  }
  if (input.transcript) {
    const m = matchResult(input.target, input.transcript);
    return { result: m.result, heard: input.transcript, source: "on-device" };
  }
  return null;
}
