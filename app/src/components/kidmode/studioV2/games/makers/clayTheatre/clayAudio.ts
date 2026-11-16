import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';
import type { CueKind } from './clayTheatreRules';

/** The little projector's sounds, synthesised on Arbor's one audio bus: no
 * files, no network, the same mute and hidden-tab gate as every kid sound.
 * Sound is an extra; the film never waits for it. */
export interface ClayAudio {
  /** The quiet projector purr: on while the film plays, off otherwise. */
  purr(on: boolean): void;
  cue(kind: CueKind): void;
  /** A soft film tick for a scrubbed frame (spaced, so a fast drag cannot rattle). */
  tick(): void;
  stop(): void;
  dispose(): void;
  /** How many sources are sounding now (the leak check reads it). */
  live(): number;
}
type Voice = { stop(): void };

export function createClayAudio(): ClayAudio {
  const voices = new Set<Voice>();
  let purring: Voice | null = null, disposed = false, lastTick = 0, noise: AudioBuffer | null = null;
  const ctx = () => (disposed || !kidAudioAllowed() ? null : kidAudioContext());
  const noiseBuffer = (ac: AudioContext) => {
    if (noise && noise.sampleRate === ac.sampleRate) return noise;
    const len = ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), data = buf.getChannelData(0);
    // A fixed pseudo-random fill, so the purr sounds the same every time.
    let seed = 22695477;
    for (let i = 0; i < len; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = (seed / 4294967296) * 2 - 1; }
    return (noise = buf);
  };
  /** One short sound: nodes in, a gain envelope, released when it ends. */
  const voice = (ac: AudioContext, build: (out: GainNode, t0: number) => AudioScheduledSourceNode[], length: number) => {
    const out = ac.createGain(), t0 = ac.currentTime;
    out.connect(ac.destination);
    const sources = build(out, t0);
    const v: Voice = { stop() { voices.delete(v); for (const s of sources) { try { s.stop(); } catch { /* ended */ } try { s.disconnect(); } catch { /* released */ } } try { out.disconnect(); } catch { /* released */ } } };
    voices.add(v);
    sources[0].onended = () => v.stop();
    for (const s of sources) { s.start(t0); s.stop(t0 + length); }
    void ac.resume?.().catch(() => v.stop());
  };
  const env = (g: GainNode, t0: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  };
  const tone = (type: OscillatorType, from: number, to: number, peak: number, length: number) => {
    const ac = ctx(); if (!ac) return;
    try {
      voice(ac, (out, t0) => {
        const o = ac.createOscillator(); o.type = type;
        o.frequency.setValueAtTime(from, t0); o.frequency.exponentialRampToValueAtTime(to, t0 + length * 0.8);
        env(out, t0, peak, 0.012, length); o.connect(out); return [o];
      }, length + 0.05);
    } catch { /* sound is never load-bearing */ }
  };
  const hiss = (filter: BiquadFilterType, from: number, to: number, peak: number, attack: number, length: number) => {
    const ac = ctx(); if (!ac) return;
    try {
      voice(ac, (out, t0) => {
        const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
        const f = ac.createBiquadFilter(); f.type = filter; f.Q.value = 1.2;
        f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + attack + length);
        env(out, t0, peak, attack, length); src.connect(f); f.connect(out); return [src];
      }, attack + length + 0.05);
    } catch { /* sound is never load-bearing */ }
  };
  const stopAll = () => { for (const v of [...voices]) v.stop(); purring = null; };
  const unhush = onKidHush(stopAll);
  return {
    purr(on) {
      if (!on) { purring?.stop(); purring = null; return; }
      if (purring) return;
      const ac = ctx(); if (!ac) return;
      try {
        const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
        const low = ac.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 340;
        const flutter = ac.createGain(); flutter.gain.value = 0.6;
        const lfo = ac.createOscillator(); lfo.frequency.value = 18; const depth = ac.createGain(); depth.gain.value = 0.4;
        const out = ac.createGain(); const t0 = ac.currentTime;
        out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(0.03, t0 + 0.25);
        lfo.connect(depth); depth.connect(flutter.gain); src.connect(low); low.connect(flutter); flutter.connect(out); out.connect(ac.destination);
        src.start(t0); lfo.start(t0);
        const v: Voice = { stop() {
          voices.delete(v);
          for (const s of [src, lfo]) { try { s.stop(); } catch { /* ended */ } try { s.disconnect(); } catch { /* released */ } }
          for (const n of [low, flutter, depth, out]) { try { n.disconnect(); } catch { /* released */ } }
        } };
        voices.add(v); purring = v;
        void ac.resume?.().catch(() => v.stop());
      } catch { /* sound is never load-bearing */ }
    },
    cue(kind) {
      switch (kind) {
        case 'bloop': tone('sine', 330, 120, 0.12, 0.22); break;
        case 'puff': hiss('lowpass', 900, 260, 0.08, 0.02, 0.24); break;
        case 'whoosh': hiss('bandpass', 380, 2600, 0.09, 0.25, 0.8); break;
        case 'plop': tone('sine', 520, 160, 0.08, 0.16); hiss('highpass', 1400, 900, 0.03, 0.01, 0.18); break;
        case 'splash': hiss('highpass', 1200, 700, 0.1, 0.02, 0.55); tone('sine', 140, 60, 0.1, 0.3); break;
        case 'boing': tone('triangle', 210, 560, 0.08, 0.26); break;
        case 'stretch': tone('triangle', 260, 700, 0.05, 0.9); break;
        case 'chime': tone('sine', 784, 784, 0.06, 0.5); tone('sine', 1175, 1175, 0.04, 0.6); break;
      }
    },
    tick() {
      const now = Date.now(); if (now - lastTick < 45) return; lastTick = now;
      hiss('bandpass', 3200, 3000, 0.035, 0.002, 0.018);
    },
    stop: stopAll,
    dispose() { if (disposed) return; stopAll(); disposed = true; unhush(); },
    live: () => voices.size,
  };
}
