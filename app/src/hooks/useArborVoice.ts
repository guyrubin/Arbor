import { useCallback, useEffect, useRef, useState } from "react";
import {
  isActive,
  speakText,
  stopVoice,
  subscribeVoice,
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

  const toggle = useCallback((text: string) => {
    if (isActive(idRef.current)) {
      stopVoice();
      idRef.current = 0;
      return;
    }
    idRef.current = speakText(text, {
      onEnd: () => {
        idRef.current = 0;
      },
    });
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
