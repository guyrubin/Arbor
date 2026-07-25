/**
 * sentenceStream (EVAL-2, 2026-07-25 AI-excellence Wave 1) — the ONE sentence
 * splitter for the streaming voice loop, extracted from CoachTab's inline
 * split/enqueue logic so the cadence contract ("first sentence speakable
 * before the stream is done") is unit-testable as a pure function.
 *
 * Semantics are byte-identical to the original CoachTab code:
 *   const parts = buf.split(/(?<=[.!?])\s+/);
 *   while (parts.length > 1) enqueueSpeak(parts.shift());
 *   buf = parts[0] || "";
 * i.e. a sentence is COMPLETE only when its terminal punctuation is followed
 * by whitespace — the trailing fragment (no boundary yet) stays buffered.
 * Works unchanged for Hebrew, which uses the same . ! ? terminators.
 *
 * Consumers: CoachTab's streamVoiceTurn (browser fallback path) and the
 * voice-loop-v1 eval's deterministic cadence tier (voiceLoopEval.test.ts).
 * The upcoming voice-cadence entry (AI-V1+AIR-2) reuses this SAME function
 * server-side to pick screening boundaries, so client and server always
 * agree on what "a sentence" is.
 */

/** Boundary: terminal punctuation immediately followed by whitespace. */
export const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

export type SentenceSplit = {
  /** Sentences whose boundary has been seen — safe to enqueue for speech. */
  complete: string[];
  /** Trailing fragment still waiting for its boundary — keep buffering. */
  rest: string;
};

/**
 * Split an accumulating stream buffer into complete sentences + the trailing
 * fragment. Pure and stateless: callers own the buffer (`rest` feeds back in
 * as the prefix of the next call's input).
 */
export function splitCompleteSentences(buffer: string): SentenceSplit {
  const parts = buffer.split(SENTENCE_BOUNDARY);
  const rest = parts.pop() ?? "";
  return { complete: parts, rest };
}
