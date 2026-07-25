import type { ChatMessage, ChatResponsePayload } from "../context/ArborContext";

/**
 * ASK-1 + AIR-1 (ask-cadence, 2026-07-25) — pure reducers for the Ask Arbor
 * streaming bubble, mirroring lib/voiceTranscript for the voice loop.
 *
 * State machine per turn:
 *   send            → appendChatAck: one locally-rendered acknowledgment
 *                     bubble appears immediately (chatLive + chatAck flags);
 *   `delta` events  → applyChatDelta: the FIRST screened sentence replaces the
 *                     ack copy, later sentences append into the same bubble;
 *   `done` (clean)  → settleChatTurn: the live bubble is replaced by the final
 *                     payload (full rendered text + structured contract);
 *   `done` (flag)   → settleChatTurn RETRACTS the streamed text and replaces
 *                     the bubble with the blocked/crisis markdown — the
 *                     firewall condition: streamed text is retractable when
 *                     the done-time classifier flags (payload.outputBlocked);
 *   abort/error/402 → abortChatStream: screened partial prose is KEPT as a
 *                     settled turn (parity with the voice loop); an ack-only
 *                     or empty bubble is dropped so no placeholder persists.
 *
 * CLINICAL FIREWALL: delta text reaching these reducers is already screened
 * server-side (cumulative alias-restored lexical screen per sentence in
 * /api/chat); the reducers add no unscreened render path.
 */

/** Append the immediate local acknowledgment bubble for a fresh ask turn. */
export const appendChatAck = (prev: ChatMessage[], ackText: string, lens?: string): ChatMessage[] => [
  ...prev,
  { sender: "ai", text: ackText, lens, chatLive: true, chatAck: true },
];

/** Fold a streamed, server-screened sentence delta into the live bubble. */
export const applyChatDelta = (prev: ChatMessage[], delta: string, lens?: string): ChatMessage[] => {
  if (!delta) return prev;
  const last = prev[prev.length - 1];
  if (last && last.sender === "ai" && last.chatLive) {
    // The first real delta REPLACES the local ack copy (never model output).
    const text = last.chatAck ? delta : last.text + delta;
    return [...prev.slice(0, -1), { ...last, text, chatAck: undefined }];
  }
  return [...prev, { sender: "ai", text: delta, lens, chatLive: true }];
};

/**
 * Settle the turn with the final `done` payload. Replaces the live bubble
 * when one exists (appends otherwise — e.g. the non-SSE fallback path).
 * On `payload.outputBlocked` the streamed prose is DISCARDED — retract and
 * replace with the blocked/crisis markdown, never a merge of both.
 */
export const settleChatTurn = (prev: ChatMessage[], payload: ChatResponsePayload, lens?: string): ChatMessage[] => {
  const settled: ChatMessage = (payload as { outputBlocked?: boolean }).outputBlocked
    ? { sender: "ai", text: payload.text, lens }
    : { sender: "ai", text: payload.text, lens, contract: payload.contract, council: payload.council };
  const last = prev[prev.length - 1];
  if (last && last.sender === "ai" && last.chatLive) {
    return [...prev.slice(0, -1), settled];
  }
  return [...prev, settled];
};

/** Abort/error/paywall: keep screened partial prose, drop ack-only bubbles. */
export const abortChatStream = (prev: ChatMessage[]): ChatMessage[] => {
  const last = prev[prev.length - 1];
  if (!last || last.sender !== "ai" || !last.chatLive) return prev;
  if (last.chatAck || !last.text.trim()) return prev.slice(0, -1);
  const { chatLive: _live, chatAck: _ack, ...rest } = last;
  return [...prev.slice(0, -1), rest];
};
