import type { ChatMessage } from "../context/ArborContext";
import { PROGRAMS } from "../content/programs";
import { resolveHebrewSlash } from "./hebrewSlashGender";

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

/** Append the dictated parent turn (no-op on blank dictation). F-TALK-2:
 *  `at`, when given, stamps when the parent spoke (the thread's date line). */
export const appendVoiceUser = (prev: ChatMessage[], text: string, lens?: string, at?: string): ChatMessage[] => {
  const value = text.trim();
  if (!value) return prev;
  return [...prev, at ? { sender: "user", text: value, lens, at } : { sender: "user", text: value, lens }];
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

/**
 * B-VOICE-04 — the next-action synthesis for the closing review: the ONE
 * concrete step Arbor said in this voice session, offered for the parent to
 * keep as today's step (never kept on its own).
 *
 * Deterministic, no model call. The voice reply contract (voice_reply,
 * ai/prompts.ts) is "Sentence 1 acknowledges; Sentence 2 gives ONE concrete
 * next step, or asks one short clarifying question". So the step is the
 * SECOND sentence of the last settled Arbor turn since the session began —
 * only when it is a whole sentence (ends . or !), not a question, and short
 * enough to be a step. Anything else → null: the review shows no step rather
 * than a guessed one. The text is the already-screened spoken reply; it is
 * the parent's tap that keeps it.
 */
export const VOICE_NEXT_STEP_MAX = 220;
/** B-PROG-04 (round 2): the authored program coach scripts. With
 *  ARBOR_PROGRAM_SCRIPT_IN_COACH on, /voice opens an on-shelf answer with the
 *  week's script verbatim, so the model's own reply starts AFTER it — the
 *  step is read from the model's reply, never shifted onto its acknowledgement. */
const AUTHORED_SCRIPTS: readonly string[] = PROGRAMS
  // Hebrew as authored (gender unknown) and resolved for a boy and a girl (the route genders it when it can).
  .flatMap((p) => p.weeks.flatMap((w) => w.coachScripts.flatMap((s) => [s.text.en.trim(), s.text.he.trim(), resolveHebrewSlash(s.text.he.trim(), "boy"), resolveHebrewSlash(s.text.he.trim(), "girl")])))
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);
const withoutLeadingScript = (text: string): string => {
  const t = text.trim();
  const script = AUTHORED_SCRIPTS.find((s) => t.startsWith(s));
  return script ? t.slice(script.length).trim() : t;
};
export const voiceNextStep = (messages: readonly ChatMessage[], fromIndex = 0): string | null => {
  const turns = messages.slice(Math.max(0, fromIndex));
  let last: ChatMessage | undefined;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].sender === "ai") { last = turns[i]; break; }
  }
  if (!last || last.voiceLive) return null;
  const sentences = withoutLeadingScript(last.text).replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  const step = sentences[1];
  if (!step || !/[.!]$/.test(step) || /[?？]/.test(step)) return null;
  if (step.length > VOICE_NEXT_STEP_MAX || step.split(" ").length < 3) return null;
  return step;
};
