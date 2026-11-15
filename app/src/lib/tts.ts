/**
 * Legacy read-aloud API, now a thin shim over the central voice controller
 * (`lib/voice.ts`). Existing callers (the coach voice pump, EarlyReadingTrack)
 * keep this exact surface, but every utterance now flows through the one
 * controller — so a new utterance cleanly interrupts the prior one and the
 * neural-TTS engine can swap in centrally. New UI should use `<SpeakButton>` /
 * `useArborVoice` instead of calling these directly.
 */
import { speakText, stopVoice, voiceSupported } from "./voice";

export function ttsSupported(): boolean {
  return voiceSupported();
}

export function speak(text: string, onend?: () => void) {
  // An utterance that could not be spoken is over too: the sentence pump moves
  // on (its words are on screen) instead of waiting for an end that never comes.
  speakText(text, { onEnd: onend, onError: onend });
}

export function stopSpeaking() {
  stopVoice();
}
