import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Each thread has its own tiny voice: the tick is pitched by thread. */
export const TICK_PITCH: readonly number[] = [1568, 1760, 1976, 2349, 2637];
export interface StitchSounds {
  /** A very quiet needle tick. False when sound is off or unavailable. */
  tick(thread: number): boolean;
  /** A soft pull of thread coming back out. */
  pull(): boolean;
  stop(): void;
  dispose(): void;
}

/** Local synthesis on Arbor's one kid audio bus: the child's Sound switch, the
 * hidden-tab hush and leaving Kid Mode all silence it. No file, no network.
 * Sound is an extra; the stitching never waits for it. */
export function createStitchSounds(): StitchSounds {
  const sources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  let disposed = false, epoch = 0;
  const release = (source: AudioScheduledSourceNode) => {
    const nodes = sources.get(source) ?? [];
    sources.delete(source);
    for (const node of [source, ...nodes]) { try { node.disconnect(); } catch { /* Already released. */ } }
  };
  const stop = () => {
    epoch++;
    for (const source of [...sources.keys()]) {
      try { source.stop(); } catch { /* An ended source must still disconnect. */ }
      release(source);
    }
  };
  const unhush = onKidHush(stop);
  const context = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext(); if (!ac) return null;
    const current = epoch;
    void ac.resume?.().catch(() => { if (current === epoch) stop(); });
    return ac;
  };
  const tone = (ac: AudioContext, type: OscillatorType, from: number, to: number, length: number, level: number) => {
    const when = ac.currentTime;
    const source = ac.createOscillator();
    let gain: GainNode;
    try { gain = ac.createGain(); } catch (error) { source.disconnect(); throw error; }
    sources.set(source, [gain]);
    source.type = type;
    source.frequency.setValueAtTime(from, when);
    source.frequency.exponentialRampToValueAtTime(to, when + length);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(gain); gain.connect(ac.destination);
    source.onended = () => release(source);
    source.start(when); source.stop(when + length + 0.02);
  };
  return {
    tick(thread) {
      if (!Number.isInteger(thread) || thread < 0 || thread >= TICK_PITCH.length) return false;
      try {
        const ac = context(); if (!ac) return false;
        tone(ac, 'triangle', TICK_PITCH[thread], TICK_PITCH[thread] * 0.82, 0.045, 0.018);
        return true;
      } catch { stop(); return false; }
    },
    pull() {
      try {
        const ac = context(); if (!ac) return false;
        tone(ac, 'sine', 520, 210, 0.22, 0.035);
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
