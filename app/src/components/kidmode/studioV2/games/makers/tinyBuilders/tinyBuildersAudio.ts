import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Tiny Structures sounds, synthesised on Arbor's one kid audio bus (the
 * child's Sound switch, hidden-tab hush and leaving Kid Mode all silence it).
 * No files, no network. Sound is an extra: play never waits for a sound. */
export type TinySound = 'snap' | 'glass' | 'whole' | 'touch' | 'whumph' | 'squeeze' | 'slide';
export interface TinyTones {
  /** Plays a sound now. `step` picks the glass tone of each part label. */
  play(sound: TinySound, step?: number): boolean;
  stop(): void;
  dispose(): void;
}

/** A glass scale (C E G A C' E'), one note per part label. */
export const GLASS_NOTES: readonly number[] = [1046.5, 1318.5, 1568, 1760, 2093, 2637];

export function createTinyTones(): TinyTones {
  const live = new Set<AudioScheduledSourceNode>();
  const nodes = new Set<AudioNode>();
  let disposed = false, epoch = 0;
  let noise: AudioBuffer | null = null;
  const stop = () => {
    epoch++;
    for (const source of live) { try { source.stop(); } catch { /* Already stopped. */ } }
    live.clear();
    for (const node of nodes) { try { node.disconnect(); } catch { /* Already released. */ } }
    nodes.clear();
  };
  const unhush = onKidHush(stop);
  const keep = <T extends AudioNode>(node: T) => { nodes.add(node); return node; };
  const run = (source: AudioScheduledSourceNode, when: number, length: number, chain: AudioNode[]) => {
    live.add(source);
    source.onended = () => { live.delete(source); for (const n of chain) { try { n.disconnect(); } catch { /* Released. */ } nodes.delete(n); } };
    source.start(when); source.stop(when + length + 0.05);
  };
  const tone = (ac: AudioContext, type: OscillatorType, from: number, to: number | null, when: number, length: number, level: number, attack = 0.008) => {
    const osc = keep(ac.createOscillator()), gain = keep(ac.createGain());
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, when + length * 0.8);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(gain); gain.connect(ac.destination);
    run(osc, when, length, [osc, gain]);
  };
  const hiss = (ac: AudioContext, when: number, length: number, level: number, freq: number, q: number, sweepTo?: number) => {
    if (!noise) {
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 7;
      for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
    }
    const src = keep(ac.createBufferSource()), filter = keep(ac.createBiquadFilter()), gain = keep(ac.createGain());
    src.buffer = noise;
    filter.type = 'bandpass'; filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, when);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, when + length);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    run(src, when, length, [src, filter, gain]);
  };
  return {
    play(sound, step = 0) {
      if (disposed || !kidAudioAllowed()) return false;
      try {
        const ac = kidAudioContext(); if (!ac) return false;
        const current = epoch;
        void ac.resume?.().catch(() => { if (current === epoch) stop(); });
        const t = ac.currentTime + 0.01;
        switch (sound) {
          case 'snap': // a soft magnetic click: a short knock and a damped tick
            hiss(ac, t, 0.05, 0.16, 2400, 6);
            tone(ac, 'sine', 420, 180, t, 0.12, 0.12, 0.003);
            tone(ac, 'triangle', 1320, null, t + 0.01, 0.08, 0.025, 0.003);
            break;
          case 'glass': { // a glassy tone: a clear note with one inharmonic shimmer
            const note = GLASS_NOTES[Math.abs(Math.trunc(step)) % GLASS_NOTES.length];
            tone(ac, 'sine', note, null, t, 1.2, 0.06, 0.004);
            tone(ac, 'sine', note * 2.76, null, t, 0.5, 0.014, 0.004);
            break;
          }
          case 'whole': // the model is complete: three glass notes rising
            [0, 2, 4].forEach((n, i) => tone(ac, 'sine', GLASS_NOTES[n], null, t + i * 0.11, 1.1, 0.05, 0.004));
            break;
          case 'touch': // fibre tips meet the surface: a tiny soft tap
            tone(ac, 'sine', 880, 620, t, 0.16, 0.035, 0.004);
            break;
          case 'whumph': // the low gentle settle of the landing
            tone(ac, 'sine', 118, 52, t, 0.62, 0.22, 0.02);
            hiss(ac, t, 0.36, 0.05, 320, 0.8, 120);
            break;
          case 'squeeze': // the sheath shortens: a quick soft spring
            tone(ac, 'triangle', 300, 520, t, 0.22, 0.04, 0.01);
            break;
          case 'slide': // the thread slides down: a long soft glide
            tone(ac, 'sine', 660, 330, t, 1.6, 0.03, 0.2);
            break;
        }
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
