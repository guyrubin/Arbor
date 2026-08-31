/**
 * AI-V2(a) — the voice chip/orb tap contract, as a pure decision function so
 * the barge-in state machine is unit-testable without React.
 *
 * Contract (audit acceptance, verbatim intent):
 *  - phase "off"      → START voice (the chip stays the ONLY entry point);
 *  - phase "speaking" on the BROWSER fallback loop → INTERRUPT, not off:
 *    flush the TTS queue, cut the utterance, abort a still-open stream, keep
 *    the partial caption, and go straight back to listening;
 *  - phase "speaking" on a Gemini LIVE session → STOP (Live barge-in is
 *    voice-driven — the server VAD interrupts when the parent talks over the
 *    model; a tap remains the hard off switch);
 *  - any other phase ("connecting", "listening", "thinking") → STOP — which
 *    covers both the "second tap during listening turns voice off" double-tap
 *    parity AND cancelling a still-connecting Live start (S5: the connecting
 *    state is painted synchronously, so the tap-to-cancel affordance is real).
 */

export type VoicePhase = "off" | "connecting" | "listening" | "thinking" | "speaking";

export type VoiceChipAction = "start" | "interrupt" | "stop";

export function voiceChipAction(phase: VoicePhase, liveSessionActive: boolean): VoiceChipAction {
  if (phase === "off") return "start";
  if (phase === "speaking" && !liveSessionActive) return "interrupt";
  return "stop";
}
