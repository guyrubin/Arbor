import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Mend the Bowl's small sounds, synthesised on Arbor's one kid audio bus:
 * the child's Sound switch, the hidden-tab hush and leaving Kid Mode silence
 * them. No files, no network. Sound is always an extra; play never waits. */
export interface BowlSounds {
  /** A soft ceramic tap: a short filtered noise tick and a sine ping. */
  tap(pitch?: number, level?: number): boolean;
  /** The bowl meeting the cloth: one low tok, then pieces settling. */
  tok(): boolean;
  /** A quiet rising shimmer while gold flows, `ms` long. */
  shimmer(ms: number): boolean;
  stop(): void;
  dispose(): void;
}

export function createBowlSounds(): BowlSounds {
  const live = new Set<AudioScheduledSourceNode>();
  const nodes = new Set<AudioNode>();
  let disposed = false, noise: AudioBuffer | null = null;
  const stop = () => {
    for (const source of live) { try { source.stop(); } catch { /* Already ended. */ } }
    live.clear();
    for (const node of nodes) { try { node.disconnect(); } catch { /* Already released. */ } }
    nodes.clear();
  };
  const unhush = onKidHush(stop);
  const context = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext(); if (!ac) return null;
    void ac.resume?.().catch(() => stop());
    return ac;
  };
  const track = <T extends AudioScheduledSourceNode>(source: T, ...extra: AudioNode[]) => {
    live.add(source); extra.forEach(n => nodes.add(n));
    source.onended = () => { live.delete(source); for (const n of [source, ...extra]) { nodes.delete(n); try { n.disconnect(); } catch { /* Already released. */ } } };
    return source;
  };
  const noiseBuffer = (ac: AudioContext) => {
    if (noise && noise.sampleRate === ac.sampleRate) return noise;
    const length = Math.floor(ac.sampleRate * 0.08), buffer = ac.createBuffer(1, length, ac.sampleRate), data = buffer.getChannelData(0);
    // A fixed pseudo-random hiss (no Math.random): the tick sounds the same every time.
    let seed = 7; for (let i = 0; i < length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
    noise = buffer; return buffer;
  };
  const ping = (ac: AudioContext, when: number, freq: number, level: number, length: number) => {
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(level, when + 0.004); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(gain); gain.connect(ac.destination); track(osc, gain);
    osc.start(when); osc.stop(when + length + 0.02);
  };
  const tick = (ac: AudioContext, when: number, centre: number, level: number) => {
    const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
    src.buffer = noiseBuffer(ac); filter.type = 'bandpass'; filter.frequency.setValueAtTime(centre, when); filter.Q.setValueAtTime(2.2, when);
    gain.gain.setValueAtTime(level, when); gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination); track(src, filter, gain);
    src.start(when); src.stop(when + 0.06);
  };
  const safely = (run: (ac: AudioContext) => void) => {
    const ac = context(); if (!ac) return false;
    try { run(ac); return true; } catch { stop(); return false; }
  };
  return {
    tap: (pitch = 1, level = 1) => safely(ac => {
      const now = ac.currentTime;
      tick(ac, now, 3200 * pitch, 0.07 * level);
      ping(ac, now, 2093 * pitch, 0.05 * level, 0.16); ping(ac, now, 3136 * pitch, 0.018 * level, 0.09);
    }),
    tok: () => safely(ac => {
      const now = ac.currentTime;
      tick(ac, now, 1400, 0.1); ping(ac, now, 880, 0.06, 0.22); ping(ac, now, 1318.5, 0.025, 0.14);
      [0.13, 0.21, 0.3, 0.37].forEach((at, i) => { tick(ac, now + at, 2600 + i * 380, 0.035); ping(ac, now + at, 1760 + i * 210, 0.018, 0.08); });
    }),
    shimmer: (ms) => safely(ac => {
      const now = ac.currentTime, length = Math.max(0.3, Math.min(2, ms / 1000));
      [1318.5, 1760, 2637].forEach((freq, i) => {
        const osc = ac.createOscillator(), gain = ac.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(freq * 1.26, now + length);
        gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.014 / (i + 1), now + 0.08 + i * 0.05); gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
        osc.connect(gain); gain.connect(ac.destination); track(osc, gain);
        osc.start(now + i * 0.04); osc.stop(now + length + 0.05);
      });
    }),
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
