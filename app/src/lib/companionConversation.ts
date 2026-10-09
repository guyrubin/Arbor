/** One parent conversation door. Opening it never sends a message or starts a microphone. */
export const COMPANION_CONVERSATION_EVENT = "arbor:open-conversation";
export type CompanionConversationRequest = { prompt?: string; source?: string };
export function requestCompanionConversation(detail: CompanionConversationRequest = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COMPANION_CONVERSATION_EVENT, { detail }));
}
