/**
 * B-VOICE-02 — a card's own words, said BEFORE the microphone opens.
 *
 * "Talk it through" on a hard-moment or practice card runs ONE opening: the
 * card's words play by text-to-speech, and only once they have finished (or
 * failed to play, or the parent tapped to skip them) does the conversation
 * start its one Talk path — on the browser loop and on Live alike. So the
 * card's words can never be heard by the microphone and sent as the parent's
 * turn. A stop (X, the panel hiding, a new thread) cancels the opening and
 * nothing starts after it.
 *
 * Pure: the speaker, the stop and the start are injected (CoachTab passes
 * lib/voice speakText/stopVoice and its own toggle); `onDone` runs at most once.
 */
export type OpeningSpeaker = (text: string, handlers: { onEnd: () => void; onError: () => void }) => void;
export type OpeningState = "speaking" | "done" | "skipped" | "cancelled";

export interface OpeningRun {
  readonly line: string;
  state(): OpeningState;
  /** The parent tapped to skip: cut the words and start now. True when it skipped. */
  skip(): boolean;
  /** A stop: cut the words; nothing starts. */
  cancel(): void;
}

export function runOpening(line: string, deps: { speak: OpeningSpeaker; stopSpeaking: () => void; onDone: () => void }): OpeningRun {
  let state: OpeningState = "speaking";
  const finish = (next: "done" | "skipped") => {
    if (state !== "speaking") return;
    state = next;
    deps.onDone();
  };
  const run: OpeningRun = {
    line,
    state: () => state,
    skip() {
      if (state !== "speaking") return false;
      deps.stopSpeaking();
      finish("skipped");
      return true;
    },
    cancel() {
      if (state !== "speaking") return;
      state = "cancelled";
      deps.stopSpeaking();
    },
  };
  // A line that cannot play (no voice, an error) does not hold the talk back.
  deps.speak(line, { onEnd: () => finish("done"), onError: () => finish("done") });
  return run;
}
