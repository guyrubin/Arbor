import { useCallback, useEffect, useRef, useState } from "react";
import {
  isActive,
  speakText,
  stopVoice,
  subscribeVoice,
  voiceState,
  voiceSupported,
  type VoiceEngine,
} from "../lib/voice";

/**
 * React binding for the central voice controller. Each instance tracks whether
 * IT owns the current utterance, so only the control the parent tapped shows the
 * "speaking" state even though all controls share one engine. Auto-stops on
 * unmount if this instance is still speaking. The neural engine swaps in behind
 * the controller, so this hook needs no change when voice goes "natural".
 */

export type VoiceToggleHandlers = { onEnd?: () => void; onError?: () => void };
export type VoiceToggleResult = { id: number; speaking: boolean };

/**
 * Pure toggle transition (exported for tests — the hook is a thin binding).
 *
 * F-03: `speakText` emits its synchronous `speaking=true` BEFORE the caller
 * learns the new utterance id, so a subscription keyed on that id misses the
 * emit — the button never flipped to Stop at click time when no later engine
 * event arrived. The returned `speaking` re-reads the controller state AFTER
 * the id is known, so the caller can reflect Stop immediately.
 */
export function toggleSpeech(currentId: number, text: string, handlers: VoiceToggleHandlers = {}): VoiceToggleResult {
  if (isActive(currentId)) {
    stopVoice();
    return { id: 0, speaking: false };
  }
  const id = speakText(text, handlers);
  return { id, speaking: voiceState().speaking && isActive(id) };
}

export function useArborVoice() {
  const idRef = useRef(0);
  const [engine, setEngine] = useState<VoiceEngine>("basic");
  const [speaking, setSpeaking] = useState(false);

  useEffect(
    () =>
      subscribeVoice((state) => {
        setEngine(state.engine);
        // "speaking" is true only while THIS instance owns playback.
        setSpeaking(state.speaking && isActive(idRef.current));
      }),
    [],
  );

  // Stop our own playback if we unmount mid-utterance (e.g. navigation).
  useEffect(
    () => () => {
      if (isActive(idRef.current)) stopVoice();
    },
    [],
  );

  const toggle = useCallback((text: string, opts?: { onError?: () => void }) => {
    const result = toggleSpeech(idRef.current, text, {
      onEnd: () => {
        idRef.current = 0;
      },
      // F-03: failures were swallowed here (only onEnd was wired) — thread
      // them out so the UI can tell the parent instead of failing silently.
      // Release the id only when it no longer owns playback (a late error from
      // a superseded utterance must not orphan a newer one from this instance).
      onError: () => {
        if (!isActive(idRef.current)) idRef.current = 0;
        opts?.onError?.();
      },
    });
    idRef.current = result.id;
    // F-03: re-sync so the synchronous speaking=true emitted inside speakText
    // (missed by the subscription — idRef was not yet set) is visible NOW and
    // the button flips to Stop at click time.
    setSpeaking(result.speaking);
  }, []);

  const stop = useCallback(() => {
    if (isActive(idRef.current)) {
      stopVoice();
      idRef.current = 0;
    }
  }, []);

  return { supported: voiceSupported(), speaking, engine, toggle, stop };
}

export default useArborVoice;
