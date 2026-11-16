import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Bottle Lab's sounds, made on the spot on Arbor's one kid audio bus (the
 * child's Sound switch, hidden-tab hush and leaving Kid Mode all silence
 * them). No file, no network, no looping bed. Every pitched sound takes its
 * note from one scale (bottleToys GLASS_SCALE), so overlapping sounds agree;
 * each has a soft attack, a few cents of drift so repeats never sound
 * identical, and a small peak (the loudest partial is 0.07 before the 0.8
 * master). Play never waits for a sound. */
export type BottleSound = 'ring' | 'chime' | 'tick' | 'hoot' | 'thup' | 'smooth' | 'peel' | 'fizz' | 'blip' | 'pour' | 'drain' | 'flip' | 'hop';
export interface BottleAudio { play(sound: BottleSound, freq?: number, strength?: number): boolean; stop(): void; dispose(): void }

const VOICES = 22;

export function createBottleAudio(): BottleAudio {
  const nodes = new Set<AudioScheduledSourceNode>();
  let disposed = false, noise: AudioBuffer | null = null, master: GainNode | null = null, masterOf: AudioContext | null = null;
  const stop = () => {
    for (const node of nodes) { try { node.stop(); } catch { /* already ended */ } try { node.disconnect(); } catch { /* released */ } }
    nodes.clear();
  };
  const unhush = onKidHush(stop);
  const out = (ac: AudioContext) => {
    if (master && masterOf === ac) return master;
    master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination); masterOf = ac;
    return master;
  };
  const track = (node: AudioScheduledSourceNode, chain: AudioNode[]) => {
    nodes.add(node);
    node.onended = () => { nodes.delete(node); for (const n of [node, ...chain]) { try { n.disconnect(); } catch { /* released */ } } };
  };
  const noiseBuffer = (ac: AudioContext) => {
    if (noise && noise.sampleRate === ac.sampleRate) return noise;
    const length = Math.floor(ac.sampleRate * 0.7), buffer = ac.createBuffer(1, length, ac.sampleRate), data = buffer.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; data[i] = (s / 0x3fffffff - 1); }
    noise = buffer; return buffer;
  };
  /** One partial: `from` gliding to `to`, a soft attack, an exponential tail. */
  const tone = (ac: AudioContext, type: OscillatorType, from: number, to: number, when: number, length: number, level: number, attack = 0.006) => {
    if (nodes.size >= VOICES) return;
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, when); osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + length);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + attack); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(gain); gain.connect(out(ac)); track(osc, [gain]);
    osc.start(when); osc.stop(when + length + 0.02);
  };
  /** Filtered hiss whose band glides from `from` to `to`. */
  const hiss = (ac: AudioContext, when: number, length: number, level: number, from: number, to: number, q: number) => {
    if (nodes.size >= VOICES) return;
    const src = ac.createBufferSource(), band = ac.createBiquadFilter(), gain = ac.createGain();
    src.buffer = noiseBuffer(ac); band.type = 'bandpass'; band.frequency.setValueAtTime(from, when); band.frequency.exponentialRampToValueAtTime(to, when + length); band.Q.setValueAtTime(q, when);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(level, when + Math.min(0.03, length / 3)); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    src.connect(band); band.connect(gain); gain.connect(out(ac)); track(src, [band, gain]);
    src.start(when, Math.random() * 0.1); src.stop(when + length + 0.02);
  };
  return {
    play(sound, freq = 880, strength = 1) {
      if (disposed || !kidAudioAllowed()) return false;
      try {
        const ac = kidAudioContext(); if (!ac) return false;
        void ac.resume?.().catch(() => stop());
        const now = ac.currentTime, k = Math.max(0.15, Math.min(1, strength));
        // A few cents either way: the same note never sounds stamped out.
        const f = freq * (1 + (Math.random() - 0.5) * 0.007), any = () => 0.8 + Math.random() * 0.4;
        switch (sound) {
          case 'ring': // a fingernail on glass: the note, two inharmonic partials above it, a short body thud
            tone(ac, 'sine', f, f * 0.997, now, 0.95, 0.07 * k);
            tone(ac, 'sine', f * 2.76, f * 2.74, now, 0.3, 0.02 * k * any());
            tone(ac, 'sine', f * 5.4, f * 5.36, now, 0.11, 0.007 * k * any());
            tone(ac, 'triangle', f / 2, f / 2.04, now, 0.1, 0.014 * k);
            break;
          case 'chime': tone(ac, 'sine', f, f, now, 0.6, 0.04 * k, 0.012); tone(ac, 'sine', f * 2, f * 2, now, 0.22, 0.01 * k, 0.012); break;
          case 'tick': tone(ac, 'sine', f, f * 0.99, now, 0.06, 0.022 * k, 0.004); break;
          case 'hoot': // breath across the open top: a round low note with air in it
            tone(ac, 'sine', f * 0.985, f, now, 0.62, 0.055 * k, 0.06);
            tone(ac, 'triangle', f * 2, f * 2, now, 0.4, 0.008 * k, 0.07);
            hiss(ac, now, 0.5, 0.02 * k, f * 2, f * 2, 5);
            break;
          case 'thup': tone(ac, 'sine', 196, 82, now, 0.13, 0.1 * k, 0.005); hiss(ac, now, 0.05, 0.04 * k, 900, 700, 0.7); break;
          case 'smooth': hiss(ac, now, 0.2, 0.022 * k, 1500, 3100, 2.4); break;
          case 'peel': hiss(ac, now, 0.17, 0.03 * k, 620, 2700, 2); break;
          case 'fizz':
            hiss(ac, now, 0.5, 0.036 * k, 5200, 4600, 0.9);
            for (let i = 0; i < 4; i++) { const t = now + 0.03 + Math.random() * 0.36, b = f * (i % 2 ? 1.5 : 1); tone(ac, 'sine', b, b * 1.5, t, 0.05, 0.014 * k, 0.005); }
            break;
          case 'blip': tone(ac, 'sine', f, f * 1.5, now, 0.055, 0.016 * k, 0.005); break;
          case 'pour': // water filling: a soft rush and a few rising glugs
            hiss(ac, now, 0.55, 0.026 * k, 1400, 2600, 1.1);
            for (let i = 0; i < 5; i++) tone(ac, 'sine', f * (1 + i * 0.06), f * (1.3 + i * 0.06), now + 0.05 + i * 0.09, 0.07, 0.026 * k, 0.008);
            break;
          case 'drain':
            for (let i = 0; i < 6; i++) tone(ac, 'sine', f * (1.5 - i * 0.07), f * (1.1 - i * 0.07), now + i * 0.1, 0.08, 0.026 * k, 0.008);
            break;
          case 'flip': hiss(ac, now, 0.03, 0.045 * k, 2300, 1800, 1.4); tone(ac, 'triangle', f, f * 0.98, now + 0.012, 0.07, 0.022 * k, 0.004); break;
          case 'hop': tone(ac, 'sine', f, f * 1.5, now, 0.09, 0.028 * k, 0.012); break;
        }
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); try { master?.disconnect(); } catch { /* released */ } master = null; },
  };
}
