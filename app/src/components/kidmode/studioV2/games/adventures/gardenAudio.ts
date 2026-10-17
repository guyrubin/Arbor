import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../audio/kidAudio';
import type { NoteId } from './adventureRules';
export interface GardenAudio {
  play(note: NoteId): boolean;
  /** Schedule one bounded phrase on the audio clock, not timer arrival time. */
  sequence(notes: readonly NoteId[], tempo: number): boolean;
  stop(): void;
  dispose(): void;
}
/** Local synthesis on Arbor's existing audio bus. No network or second mute. */
export function createGardenAudio(): GardenAudio {
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
  const validNote = (note: NoteId) => note === 0 || note === 1 || note === 2;
  const contextForGesture = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const context = kidAudioContext();
    if (!context) return null;
    const current = epoch;
    void context.resume?.().catch(() => { if (current === epoch) stop(); });
    return context;
  };
  const scheduleNote = (context: AudioContext, note: NoteId, when: number) => {
    const source = context.createOscillator();
    let gain: GainNode;
    try { gain = context.createGain(); } catch (error) { source.disconnect(); throw error; }
    sources.set(source, gain);
    source.type = note === 2 ? 'sine' : 'triangle';
    source.frequency.setValueAtTime([523.25, 659.25, 196][note], when);
    if (note === 2) source.frequency.exponentialRampToValueAtTime(98, when + 0.16);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.1, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.32);
    source.connect(gain); gain.connect(context.destination);
    source.onended = () => release(source, gain);
    source.start(when); source.stop(when + 0.35);
  };
  return {
    play(note) {
      if (!validNote(note)) return false;
      try {
        const context = contextForGesture(); if (!context) return false;
        scheduleNote(context, note, context.currentTime); return true;
      } catch { stop(); return false; }
    },
    sequence(notes, tempo) {
      if (!notes.length || notes.length > 8 || !notes.every(validNote) || ![500, 760, 1000].includes(tempo)) return false;
      stop();
      try {
        const context = contextForGesture(); if (!context) return false;
        const start = context.currentTime;
        notes.forEach((note, index) => scheduleNote(context, note, start + index * tempo / 1000));
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
