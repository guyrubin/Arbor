/** One parent conversation door. Opening it never sends a message. It starts
 *  the microphone only for `voice: true`, which only the parent's own tap on
 *  "Talk it through" sends (B-VOICE-06, the capture bar's Voice choice) — and
 *  then through the conversation's ONE Talk path (CoachTab toggleVoice), never
 *  a second voice path. */
export const COMPANION_CONVERSATION_EVENT = "arbor:open-conversation";
export const COMPANION_CLOSE_EVENT = "arbor:close-conversation";
/** FEAT-01: the conversation header's menu reaches controls the conversation
 *  itself owns, through this same door — "history" brings the history row into
 *  view, "tone" opens the ONE ToneSheet. Neither sends a message. Like a voice
 *  request it is held until claimed, so a choice made while the conversation is
 *  still loading is answered when it mounts, not dropped. */
export type CompanionPanelRequest = "history" | "tone";
export type CompanionConversationRequest = { prompt?: string; source?: string; voice?: boolean; panel?: CompanionPanelRequest };

/** How long a spoken-conversation request stays claimable. The panel may still
 *  be loading when the tap lands; past this window the request is dropped, so
 *  a microphone can never open long after the tap that asked for it. */
export const CONVERSATION_VOICE_REQUEST_TTL_MS = 15_000;
let voiceRequestedAt: number | null = null;
let panelRequest: { panel: CompanionPanelRequest; at: number } | null = null;

export function requestCompanionConversation(detail: CompanionConversationRequest = {}, now: number = Date.now()) {
  if (detail.voice) voiceRequestedAt = now;
  if (detail.panel) panelRequest = { panel: detail.panel, at: now };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COMPANION_CONVERSATION_EVENT, { detail }));
}

/** A page handoff steps the panel aside; its mounted thread and draft remain. */
export function requestCompanionClose(): void {
  voiceRequestedAt = null;
  panelRequest = null;
  queuedDoor = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(COMPANION_CLOSE_EVENT));
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

/** The latest menu request ("history" / "tone"), once, and only while fresh
 *  (the same window as a voice request). Always clears it, fresh or not. */
export function consumeConversationPanelRequest(now: number = Date.now()): CompanionPanelRequest | null {
  const request = panelRequest;
  panelRequest = null;
  return request && now - request.at >= 0 && now - request.at <= CONVERSATION_VOICE_REQUEST_TTL_MS ? request.panel : null;
}

/** B-VOICE-08 / B-VOICE-02 — a voice door outside the conversation (Now's
 *  Talk button, a card's "Talk it through") starts the ONE Talk path inside
 *  its own tap. The mounted conversation registers its start here once it
 *  knows which route a tap would take (the Live probe answered). `opening` is
 *  the card's own words: spoken first by text-to-speech, never sent to the
 *  model and never written into the thread. The start answers true only when
 *  a voice session began inside the call. */
export type ConversationVoiceStart = (opening?: string) => boolean;
let voiceStarter: ConversationVoiceStart | null = null;
/** A door tapped before the conversation could start (still loading, or the
 *  Live probe not answered yet): held, and run once the start registers —
 *  only while fresh, so a talk never begins long after its tap. */
let queuedDoor: { opening?: string; at: number } | null = null;

export function registerConversationVoiceStarter(start: ConversationVoiceStart, now: number = Date.now()): () => void {
  voiceStarter = start;
  const queued = queuedDoor;
  queuedDoor = null;
  if (queued && now - queued.at >= 0 && now - queued.at <= CONVERSATION_VOICE_REQUEST_TTL_MS) start(queued.opening);
  return () => { if (voiceStarter === start) voiceStarter = null; };
}

/** A door tap is waiting for the conversation (does not consume it). */
export function conversationDoorQueued(): boolean {
  return queuedDoor !== null;
}

/** True while a mounted conversation can start talking inside a tap. */
export function conversationVoiceReady(): boolean {
  return voiceStarter !== null;
}

/** One tap → a spoken conversation. Call it INSIDE the parent's tap: the
 *  panel opens and Talk starts in the same call stack (the iOS microphone
 *  rule), through the conversation's own toggle (its notice, review and stop
 *  rules unchanged). Before the conversation can start (it is still loading,
 *  or its Live probe has not answered), the panel opens and the tap is queued:
 *  the start runs once the conversation registers, so one tap is enough.
 *  Returns true when the voice session began inside this tap. */
export function startConversationVoice(detail: { source: string; opening?: string }, now: number = Date.now()): boolean {
  const start = voiceStarter;
  if (!start) {
    queuedDoor = { ...(detail.opening ? { opening: detail.opening } : {}), at: now };
    requestCompanionConversation({ source: detail.source });
    return false;
  }
  requestCompanionConversation({ source: detail.source });
  return start(detail.opening);
}
