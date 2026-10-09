import { buildVoiceContext, type ThreadTurnLike } from "../ai/chatContext";

/** A report's More action belongs to that report, even after newer questions. */
export function councilConversation(input: {
  thread: readonly ThreadTurnLike[];
  childId: string;
  draft: string;
  customPrompt?: string;
  answerIndex?: number;
}) {
  const anchored = input.answerIndex !== undefined;
  if (anchored && (!Number.isInteger(input.answerIndex) || input.answerIndex! < 0
    || input.thread[input.answerIndex!]?.sender !== "ai"
    || input.thread[input.answerIndex!]?.chatLive || input.thread[input.answerIndex!]?.voiceLive
    || input.thread[input.answerIndex!]?.chatAck)) return null;
  const thread = anchored ? input.thread.slice(0, input.answerIndex! + 1) : input.thread;
  const parent = [...thread].reverse().find(turn => turn.sender === "user");
  const message = anchored ? parent?.text : input.customPrompt || input.draft.trim() || parent?.text;
  if (!message?.trim()) return null;
  return {
    message,
    consumesDraft: !anchored && !input.customPrompt && !!input.draft.trim(),
    ...buildVoiceContext(thread, input.childId),
  };
}
