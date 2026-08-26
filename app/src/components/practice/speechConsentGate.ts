/**
 * speechConsentGate — the `voice_processing` gate in front of Speech Coach's
 * PLATFORM speech recognizer (STORE-K2 / WS-4.0 SDK audit, finding 2).
 *
 * WHY: the browser `SpeechRecognition` API is NOT on-device. On Android WebView
 * it hands the utterance to Google's platform speech service, so a child's audio
 * can leave the device — exactly the egress the cloud scoring endpoint already
 * refuses without an active grant (`/api/score-utterance` fails closed with 451
 * under `requireConsent(..., "voice_processing")`). Before this module the
 * platform path started on `autoVerdictOk` alone, outside that gate.
 *
 * The rules here mirror the server ledger (`src/sharing/consent.ts`): the LATEST
 * grant for the purpose wins, and it counts only while granted, unrevoked and
 * unexpired. The client copy is a gate on *starting* the recognizer, never a
 * substitute for the server's enforcement — the server stays the authority.
 *
 * FAIL-CLOSED: the state starts "unknown" (grants not read yet, or the read
 * failed) and "unknown" never allows a start. The parent-scoring floor in
 * SpeechCoachTab carries the session with no recognizer at all.
 */

import type { ConsentGrant, ConsentPurpose } from "../../types";

/** What the client knows about the child's voice_processing grant. */
export type VoiceConsentState = "unknown" | "granted" | "absent";

export const VOICE_CONSENT_PURPOSE: ConsentPurpose = "voice_processing";

/** Active only while granted, unrevoked, and unexpired (server rule, mirrored). */
export function isGrantActive(
  g: Pick<ConsentGrant, "granted" | "expiresAt" | "revokedAt"> | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!g || !g.granted) return false;
  if (g.revokedAt) return false;
  if (g.expiresAt && new Date(g.expiresAt).getTime() <= now) return false;
  return true;
}

/**
 * Reduces a child's consent ledger to the voice state. `null`/`undefined`
 * grants (not read yet, or the read failed) stay "unknown" — never "granted".
 */
export function voiceConsentState(
  grants: ConsentGrant[] | null | undefined,
  now: number = Date.now(),
): VoiceConsentState {
  if (!grants) return "unknown";
  const latest = grants
    .filter((g) => g.purpose === VOICE_CONSENT_PURPOSE)
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))[0];
  return isGrantActive(latest, now) ? "granted" : "absent";
}

/**
 * THE GATE: may the platform recognizer start? Only under an active grant —
 * "unknown" and "absent" both mean no recognizer is constructed at all.
 */
export function platformAsrAllowed(state: VoiceConsentState): boolean {
  return state === "granted";
}
