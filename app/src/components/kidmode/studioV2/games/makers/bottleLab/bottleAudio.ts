import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Bottle Lab's three small sounds, made on the spot on Arbor's one kid audio
 * bus (the child's Sound switch, hidden-tab hush and leaving Kid Mode all
 * silence them): a glass tink, a soft fizz of bubbles, a vinyl thup. No file,
 * no network. Play never waits for a sound. */
export type BottleSound = 'tink' | 'fizz' | 'thup';
export interface BottleAudio { play(sound: BottleSound, strength?: number): boolean; stop(): void; dispose(): void }

export function createBottleAudio(): BottleAudio {
  const nodes = new Set<AudioScheduledSourceNode>();
  let disposed = false, noise: AudioBuffer | null = null;
  const stop = () => {
    for (const node of nodes) { try { node.stop(); } catch { /* already ended */ } try { node.disconnect(); } catch { /* released */ } }
    nodes.clear();
  };
  const unhush = onKidHush(stop);
  const track = (node: AudioScheduledSourceNode, out: AudioNode[]) => {
    nodes.add(node);
    node.onended = () => { nodes.delete(node); for (const n of [node, ...out]) { try { n.disconnect(); } catch { /* released */ } } };
  };
  const noiseBuffer = (ac: AudioContext) => {
    if (noise && noise.sampleRate === ac.sampleRate) return noise;
    const length = Math.floor(ac.sampleRate * 0.6), buffer = ac.createBuffer(1, length, ac.sampleRate), data = buffer.getChannelData(0);
    // A fixed pseudo-random hiss, so the fizz sounds the same every time.
    let s = 12345;
    for (let i = 0; i < length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; data[i] = (s / 0x3fffffff - 1); }
    noise = buffer; return buffer;
  };
  const tone = (ac: AudioContext, type: OscillatorType, from: number, to: number, when: number, length: number, level: number) => {
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, when); osc.frequency.exponentialRampToValueAtTime(to, when + length);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(level, when + 0.004); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(gain); gain.connect(ac.destination); track(osc, [gain]);
    osc.start(when); osc.stop(when + length + 0.02);
  };
  const hiss = (ac: AudioContext, when: number, length: number, level: number, centre: number, q: number) => {
    const src = ac.createBufferSource(), band = ac.createBiquadFilter(), gain = ac.createGain();
    src.buffer = noiseBuffer(ac); band.type = 'bandpass'; band.frequency.setValueAtTime(centre, when); band.Q.setValueAtTime(q, when);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(level, when + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    src.connect(band); band.connect(gain); gain.connect(ac.destination); track(src, [band, gain]);
    src.start(when, Math.random() * 0.2); src.stop(when + length + 0.02);
  };
  return {
    play(sound, strength = 1) {
      if (disposed || !kidAudioAllowed()) return false;
      try {
        const ac = kidAudioContext(); if (!ac) return false;
        void ac.resume?.().catch(() => stop());
        const now = ac.currentTime, k = Math.max(0.2, Math.min(1, strength));
        if (sound === 'tink') {
          // Two inharmonic partials, like a fingernail on a glass.
          const base = 2350 + Math.random() * 260;
          tone(ac, 'sine', base, base * 0.995, now, 0.7, 0.07 * k);
          tone(ac, 'sine', base * 2.76, base * 2.74, now, 0.32, 0.025 * k);
          tone(ac, 'triangle', base / 2.1, base / 2.12, now, 0.18, 0.02 * k);
        } else if (sound === 'fizz') {
          hiss(ac, now, 0.55, 0.05 * k, 5200, 0.9);
          for (let i = 0; i < 5; i++) { const t = now + 0.04 + Math.random() * 0.4; tone(ac, 'sine', 1400 + Math.random() * 1600, 2600 + Math.random() * 1400, t, 0.05, 0.018 * k); }
        } else {
          tone(ac, 'sine', 190, 80, now, 0.13, 0.12 * k);
          hiss(ac, now, 0.05, 0.05 * k, 900, 0.7);
        }
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
