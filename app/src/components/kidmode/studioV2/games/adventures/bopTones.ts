import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../audio/kidAudio';

/** A soft six-note toy scale (G A C D E G). Every Bop game plays from it, so
 * any order of taps sounds like one family of toys. */
export const BOP_SCALE: readonly number[] = [392, 440, 523.25, 587.33, 659.25, 783.99];
export interface BopTones {
  /** Plays one step of the scale now. False when sound is off or unavailable. */
  play(step: number): boolean;
  stop(): void;
  dispose(): void;
}
/** Local synthesis on Arbor's existing audio bus: no network, no second mute.
 * Sound is always an extra; a game never waits for a tone. */
export function createBopTones(): BopTones {
  const sources = new Map<OscillatorNode, GainNode>();
  let disposed = false, epoch = 0;
  const release = (source: OscillatorNode, gain: GainNode) => {
    sources.delete(source);
    try { source.disconnect(); } catch { /* Already released. */ }
    try { gain.disconnect(); } catch { /* Already released. */ }
  };
  const stop = () => {
    epoch++;
    for (const [source, gain] of sources) {
      try { source.stop(); } catch { /* An ended source must still disconnect. */ }
      release(source, gain);
    }
  };
  const unhush = onKidHush(stop);
  return {
    play(step) {
      if (disposed || !Number.isInteger(step) || step < 0 || step >= BOP_SCALE.length || !kidAudioAllowed()) return false;
      try {
        const context = kidAudioContext(); if (!context) return false;
        const current = epoch;
        void context.resume?.().catch(() => { if (current === epoch) stop(); });
        const when = context.currentTime;
        const source = context.createOscillator();
        let gain: GainNode;
        try { gain = context.createGain(); } catch (error) { source.disconnect(); throw error; }
        sources.set(source, gain);
        source.type = 'triangle';
        source.frequency.setValueAtTime(BOP_SCALE[step], when);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(0.09, when + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
        source.connect(gain); gain.connect(context.destination);
        source.onended = () => release(source, gain);
        source.start(when); source.stop(when + 0.36);
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
