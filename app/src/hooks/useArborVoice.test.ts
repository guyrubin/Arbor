/**
 * F-03 (read-aloud) — the hook-level toggle transition, tested via the pure
 * `toggleSpeech` seam the hook binds to.
 *
 * The pinned contract:
 *   - `speaking` is true IMMEDIATELY after toggle() starts an utterance. The
 *     controller emits its synchronous speaking=true BEFORE the caller learns
 *     the utterance id, so a subscription keyed on the id misses that emit —
 *     without the post-speak re-sync the button never flipped to Stop at
 *     click time (and never flipped at all when no engine event followed).
 *   - toggling the active utterance stops it (id released, speaking false).
 *   - failures reach the caller's onError (threaded to the SpeakButton toast)
 *     instead of being swallowed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { toggleSpeech } from "./useArborVoice";
import { isActive, setNaturalSynth, setVoiceEngine, stopVoice, voiceState } from "../lib/voice";

afterEach(() => {
  stopVoice();
  setNaturalSynth(null);
  setVoiceEngine("basic");
  vi.useRealTimers();
});

describe("toggleSpeech — F-03 immediate Stop state", () => {
  it("speaking === true immediately after toggle() starts an utterance (before any engine onStart)", () => {
    vi.useFakeTimers(); // keep the TTFB watchdog inert
    const stop = vi.fn();
    setNaturalSynth(() => ({ stop })); // engine accepted; onStart has NOT fired yet
    setVoiceEngine("natural");

    const result = toggleSpeech(0, "Read this aloud.");
    expect(result.id).not.toBe(0);
    expect(result.speaking).toBe(true); // the button shows Stop at click time
    expect(isActive(result.id)).toBe(true);
  });

  it("toggling the active utterance stops it: id released, speaking false", () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    setNaturalSynth(() => ({ stop }));
    setVoiceEngine("natural");

    const started = toggleSpeech(0, "Read this aloud.");
    const stopped = toggleSpeech(started.id, "Read this aloud.");
    expect(stop).toHaveBeenCalled();
    expect(stopped.id).toBe(0);
    expect(stopped.speaking).toBe(false);
    expect(voiceState().speaking).toBe(false);
  });

  it("a failed start reaches onError and reports speaking=false (no silent no-op button)", () => {
    // No natural engine, no window.speechSynthesis (node env) → cannot start.
    const onError = vi.fn();
    const result = toggleSpeech(0, "Read this aloud.", { onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(0);
    expect(result.speaking).toBe(false);
  });
});
