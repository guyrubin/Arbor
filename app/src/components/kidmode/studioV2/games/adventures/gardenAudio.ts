import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../audio/kidAudio';
import type { NoteId } from './adventureRules';
export interface GardenAudio { play(note: NoteId): boolean; stop(): void; dispose(): void }
/** Local synthesis on Arbor's existing audio bus. No network or second mute. */
export function createGardenAudio(): GardenAudio {
  const sources = new Map<OscillatorNode, GainNode>(); let disposed = false;
  const stop = () => {
    for (const [source, gain] of sources) { try { source.stop(); source.disconnect(); gain.disconnect(); } catch { /* released */ } }
    sources.clear();
  };
  const unhush = onKidHush(stop);
  return {
    play(note) {
      if (disposed || !kidAudioAllowed()) return false;
      const context = kidAudioContext(); if (!context) return false;
      try {
        void context.resume?.().catch(() => stop());
        const source = context.createOscillator(), gain = context.createGain(); const now = context.currentTime;
        source.type = note === 2 ? 'sine' : 'triangle';
        source.frequency.setValueAtTime([523.25, 659.25, 196][note], now);
        if (note === 2) source.frequency.exponentialRampToValueAtTime(98, now + 0.16);
        gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.1, now + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        source.connect(gain); gain.connect(context.destination); sources.set(source, gain);
        source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(now); source.stop(now + 0.35); return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { disposed = true; stop(); unhush(); },
  };
}
