/** One parent conversation door. Opening it never sends a message. It starts
 *  the microphone only for `voice: true`, which only the parent's own tap on
 *  "Talk it through" sends (B-VOICE-06, the capture bar's Voice choice) — and
 *  then through the conversation's ONE Talk path (CoachTab toggleVoice), never
 *  a second voice path. */
export const COMPANION_CONVERSATION_EVENT = "arbor:open-conversation";
export type CompanionConversationRequest = { prompt?: string; source?: string; voice?: boolean };

/** How long a spoken-conversation request stays claimable. The panel may still
 *  be loading when the tap lands; past this window the request is dropped, so
 *  a microphone can never open long after the tap that asked for it. */
export const CONVERSATION_VOICE_REQUEST_TTL_MS = 15_000;
let voiceRequestedAt: number | null = null;

export function requestCompanionConversation(detail: CompanionConversationRequest = {}, now: number = Date.now()) {
  if (detail.voice) voiceRequestedAt = now;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COMPANION_CONVERSATION_EVENT, { detail }));
}

/** True once per "Talk it through" tap, and only while the tap is fresh.
 *  Always clears the request, fresh or not. */
export function consumeConversationVoiceRequest(now: number = Date.now()): boolean {
  const at = voiceRequestedAt;
  voiceRequestedAt = null;
  return at !== null && now - at >= 0 && now - at <= CONVERSATION_VOICE_REQUEST_TTL_MS;
}

/** A request is waiting (does not consume it). */
export function conversationVoiceRequestPending(): boolean {
  return voiceRequestedAt !== null;
}
