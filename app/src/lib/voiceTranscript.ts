import type { ChatMessage } from "../context/ArborContext";

/**
 * COACH-2 — browser voice loop transcript helpers.
 *
 * The hands-free voice coach (listen → ask → speak) previously spoke its answer
 * and threw both turns away: nothing was captioned, nothing survived the
 * session. These pure reducers append the dictated user turn and accumulate the
 * streamed AI reply into ONE live bubble on the SAME chatMessages array that
 * typed chat uses — so the standard conversation persistence effect in
 * ArborContext (conversationsCol.upsert) writes them with no new capture path.
 *
 * CLINICAL FIREWALL: the AI text these reducers receive is the already
 * SAFE-V1-screened /api/voice output (the server buffers, screens with
 * screenModelOutput, and only then streams) — captioning persists exactly what
 * the voice pipeline was already allowed to speak, nothing else.
 */

/** Append the dictated parent turn (no-op on blank dictation). */
export const appendVoiceUser = (prev: ChatMessage[], text: string, lens?: string): ChatMessage[] => {
  const value = text.trim();
  if (!value) return prev;
  return [...prev, { sender: "user", text: value, lens }];
};

/** Accumulate a streamed voice delta into the live AI caption bubble
 *  (creating it on the first delta). */
export const applyVoiceDelta = (prev: ChatMessage[], delta: string, lens?: string): ChatMessage[] => {
  if (!delta) return prev;
  const last = prev[prev.length - 1];
  if (last && last.sender === "ai" && last.voiceLive) {
    return [...prev.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...prev, { sender: "ai", text: delta, lens, voiceLive: true }];
};

/** Settle the live bubble when the stream ends OR is aborted: partial text is
 *  KEPT (abort mid-answer preserves what was said), an empty bubble is dropped,
 *  and the voiceLive flag is stripped so the message persists as a normal turn. */
export const settleVoiceTurn = (prev: ChatMessage[]): ChatMessage[] => {
  const last = prev[prev.length - 1];
  if (!last || last.sender !== "ai" || !last.voiceLive) return prev;
  if (!last.text.trim()) return prev.slice(0, -1);
  const { voiceLive: _settled, ...rest } = last;
  return [...prev.slice(0, -1), rest];
};
