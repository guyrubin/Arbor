import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

export interface CrankSound {
  /** A soft mechanical tick at top dead centre; pace (0..1) lifts the pitch. */
  tick(pace: number): boolean;
  /** The toy's little brass bell, struck once by the bird's beak. */
  bell(): boolean;
  stop(): void;
  dispose(): void;
}
/** Partials of a small brass bell: a fundamental and three inharmonic overtones. */
const BELL: readonly { ratio: number; level: number; length: number }[] = [
  { ratio: 1, level: 0.06, length: 1.3 },
  { ratio: 2.32, level: 0.028, length: 0.9 },
  { ratio: 3.76, level: 0.018, length: 0.55 },
  { ratio: 5.4, level: 0.01, length: 0.3 },
];
const BELL_ROOT = 1046.5;
/** Ticks closer together than this merge into one (a fast fling). */
const MIN_GAP = 0.07;

/** Local synthesis on Arbor's one kid audio bus: the child's Sound switch,
 * the hidden-tab hush and leaving Kid Mode all silence it. No network, no
 * file, and the machine never waits for a sound. */
export function createCrankSound(): CrankSound {
  const sources = new Map<OscillatorNode, GainNode>();
  let disposed = false, epoch = 0, lastTick = -1, lastBell = -1;
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
  const context = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext();
    if (!ac) return null;
    const current = epoch;
    void ac.resume?.().catch(() => { if (current === epoch) stop(); });
    return ac;
  };
  const voice = (ac: AudioContext, type: OscillatorType, from: number, to: number | null, when: number, length: number, level: number) => {
    const source = ac.createOscillator();
    let gain: GainNode;
    try { gain = ac.createGain(); } catch (error) { source.disconnect(); throw error; }
    sources.set(source, gain);
    source.type = type;
    source.frequency.setValueAtTime(from, when);
    if (to) source.frequency.exponentialRampToValueAtTime(to, when + length * 0.8);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(gain); gain.connect(ac.destination);
    source.onended = () => release(source, gain);
    source.start(when); source.stop(when + length + 0.02);
  };
  return {
    tick(pace) {
      try {
        const ac = context(); if (!ac) return false;
        const when = ac.currentTime;
        if (when - lastTick < MIN_GAP) return true;
        lastTick = when;
        const p = Math.max(0, Math.min(1, Number.isFinite(pace) ? pace : 0));
        // A wooden "tock" under a small metal click, both a touch higher when faster.
        voice(ac, 'sine', 190 + 70 * p, 120, when, 0.07, 0.07);
        voice(ac, 'triangle', 1500 + 600 * p, 900 + 300 * p, when, 0.035, 0.035);
        return true;
      } catch { stop(); return false; }
    },
    bell() {
      try {
        const ac = context(); if (!ac) return false;
        const when = ac.currentTime;
        if (when - lastBell < MIN_GAP * 2) return true;
        lastBell = when;
        for (const part of BELL) voice(ac, 'sine', BELL_ROOT * part.ratio, null, when, part.length, part.level);
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
