import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';
import type { Cue } from './clayTheatreRules';
import type { ToyKind } from './clayHands';

/** The little projector's sounds, synthesised on Arbor's one audio bus: no
 * files, no network, the same mute and hidden-tab gate as every kid sound.
 * Sound is an extra; the film never waits for it.
 *
 * Everything pitched is drawn from ONE scale, C major pentatonic
 * (C D E G A), so any two sounds that overlap are consonant, and the shell's
 * own tap (E5) sits inside it. Repeats step through the scale instead of
 * sounding the same note twice. Attacks are 12 ms or slower, no single voice
 * peaks above 0.11, and the only loop (the projector's purr) sits at 0.028. */
export const CLAY_SCALE: readonly number[] = [
  130.81, 146.83, 164.81, 196, 220,             // C3 D3 E3 G3 A3
  261.63, 293.66, 329.63, 392, 440,             // C4 D4 E4 G4 A4
  523.25, 587.33, 659.25, 783.99, 880,          // C5 D5 E5 G5 A5
  1046.5, 1174.66, 1318.51,                     // C6 D6 E6
];
const note = (step: number) => CLAY_SCALE[Math.max(0, Math.min(CLAY_SCALE.length - 1, Math.round(step)))];
/** The quietest peak and the loudest any one voice may reach (the test reads them). */
export const CLAY_PEAK = 0.11, CLAY_PURR = 0.028;

export interface ClayAudio {
  /** The quiet projector purr: on while the film plays, off otherwise. */
  purr(on: boolean): void;
  cue(cue: Cue): void;
  /** A soft film tick for a scrubbed frame (spaced, so a fast drag cannot rattle); `beat` marks a whole second. */
  tick(beat?: boolean): void;
  /** A toy answering a touch; `index` picks its note. */
  toy(kind: ToyKind, index?: number): void;
  /** A lump of clay picked up, a reel chosen, a reel finished, the curtain call. */
  lump(index: number): void;
  reel(index: number): void;
  reelDone(): void;
  curtainCall(): void;
  stop(): void;
  dispose(): void;
  /** How many sources are sounding now (the leak check reads it). */
  live(): number;
}
type Voice = { stop(): void };

export function createClayAudio(): ClayAudio {
  const voices = new Set<Voice>();
  let purring: Voice | null = null, disposed = false, lastTick = 0, noise: AudioBuffer | null = null, turn = 0;
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
  const voice = (ac: AudioContext, delay: number, build: (out: GainNode, t0: number) => AudioScheduledSourceNode[], length: number) => {
    const out = ac.createGain(), t0 = ac.currentTime + delay;
    out.connect(ac.destination);
    const sources = build(out, t0);
    const v: Voice = { stop() { voices.delete(v); for (const s of sources) { try { s.stop(); } catch { /* ended */ } try { s.disconnect(); } catch { /* released */ } } try { out.disconnect(); } catch { /* released */ } } };
    voices.add(v);
    sources[0].onended = () => v.stop();
    for (const s of sources) { s.start(t0); s.stop(t0 + length); }
    void ac.resume?.().catch(() => v.stop());
  };
  const env = (g: GainNode, t0: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.min(CLAY_PEAK, peak), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  };
  /** A pitched voice gliding from one frequency to another (or holding one). */
  const tone = (type: OscillatorType, from: number, to: number, peak: number, length: number, delay = 0, attack = 0.014) => {
    const ac = ctx(); if (!ac) return;
    try {
      voice(ac, delay, (out, t0) => {
        const o = ac.createOscillator(); o.type = type;
        o.frequency.setValueAtTime(from, t0); if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t0 + length * 0.8);
        env(out, t0, peak, attack, length); o.connect(out); return [o];
      }, attack + length + 0.05);
    } catch { /* sound is never load-bearing */ }
  };
  /** A soft bell: the note and a quiet octave above it. */
  const bell = (step: number, peak: number, length: number, delay = 0) => { tone('sine', note(step), note(step), peak, length, delay); tone('sine', note(step) * 2, note(step) * 2, peak * 0.3, length * 0.6, delay); };
  const hiss = (filter: BiquadFilterType, from: number, to: number, peak: number, attack: number, length: number, delay = 0) => {
    const ac = ctx(); if (!ac) return;
    try {
      voice(ac, delay, (out, t0) => {
        const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
        const f = ac.createBiquadFilter(); f.type = filter; f.Q.value = 1.2;
        f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + attack + length);
        env(out, t0, peak, attack, length); src.connect(f); f.connect(out); return [src];
      }, attack + length + 0.05);
    } catch { /* sound is never load-bearing */ }
  };
  const stopAll = () => { for (const v of [...voices]) v.stop(); purring = null; };
  const unhush = onKidHush(stopAll);
  /** The next of a few notes, so the same touch twice is never the same sound twice. */
  const around = (steps: readonly number[]) => steps[turn++ % steps.length];
  return {
    purr(on) {
      if (!on) { purring?.stop(); purring = null; return; }
      if (purring) return;
      const ac = ctx(); if (!ac) return;
      try {
        const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
        const low = ac.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 340;
        const flutter = ac.createGain(); flutter.gain.value = 0.6;
        const lfo = ac.createOscillator(); lfo.frequency.value = 12; const depth = ac.createGain(); depth.gain.value = 0.4;
        const out = ac.createGain(); const t0 = ac.currentTime;
        out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(CLAY_PURR, t0 + 0.3);
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
    cue({ kind, step = 0 }) {
      switch (kind) {
        case 'bloop': tone('sine', note(7), note(2), 0.1, 0.24); break;                                   // E4 down to E3
        case 'puff': hiss('lowpass', 900 + 90 * step, 260, 0.07, 0.02, 0.24); break;
        case 'whoosh': hiss('bandpass', 380, 2600, 0.085, 0.25, 0.8); tone('sine', note(3), note(13), 0.035, 0.9, 0, 0.2); break;
        case 'plop': tone('sine', note(10), note(5), 0.075, 0.16); hiss('highpass', 1400, 900, 0.028, 0.012, 0.18); break;
        case 'splash': hiss('highpass', 1200, 700, 0.095, 0.02, 0.55); tone('sine', note(0), note(0) / 2, 0.09, 0.3); break;
        // Each hop climbs one step of the scale and springs up an octave: closer, and closer.
        case 'boing': tone('triangle', note(3 + step), note(3 + step) * 2, 0.07, 0.26); break;
        case 'stretch': tone('triangle', note(5), note(13), 0.045, 0.9, 0, 0.05); break;
        case 'chime': bell(13, 0.06, 0.55); bell(16, 0.045, 0.7, 0.07); break;                            // G5, then D6: an open fifth
      }
    },
    tick(beat = false) {
      const now = Date.now(); if (now - lastTick < 45) return; lastTick = now;
      hiss('bandpass', turn++ % 2 ? 3400 : 3000, 2900, 0.034, 0.003, 0.018);
      if (beat) tone('sine', note(10), note(8), 0.03, 0.05);
    },
    toy(kind, index = 0) {
      switch (kind) {
        case 'clayHero': tone('sine', note(around([7, 8, 9])), note(around([2, 3, 4])), 0.095, 0.22); break;
        case 'wireStar': bell(12 + (index % 5), 0.055, 0.9); break;                                        // E5 G5 A5 C6 D6: a wind chime
        case 'nightMoon': bell(10, 0.05, 0.6); bell(13, 0.04, 0.7, 0.09); break;
        case 'daySun': bell(9, 0.05, 0.5); bell(12, 0.04, 0.6, 0.08); break;
        case 'seaSkin': tone('sine', note(10), note(6), 0.07, 0.14); tone('sine', note(around([12, 13, 14])), note(15), 0.04, 0.16, 0.16); break;
        case 'padLeaf': tone('sine', note(8 + (index % 3)), note(5), 0.065, 0.16); break;
        case 'puffCloud': hiss('lowpass', 700, 300, 0.05, 0.03, 0.2); tone('sine', note(around([10, 11])), note(8), 0.035, 0.16); break;
        case 'lotusBloom': case 'gardenBloom': bell(around([12, 14, 15]), 0.05, 0.5); break;
        case 'openAir': bell(around([15, 16, 17]), 0.034, 0.28); break;
        case 'deepWater': [0, 1, 2].forEach(i => tone('sine', note(11 + i), note(12 + i), 0.034, 0.09, i * 0.07)); break;
        case 'feltDrape': tone('sine', note(1), note(0), 0.06, 0.12); hiss('lowpass', 500, 220, 0.03, 0.01, 0.1); break;
        case 'cometWish': [10, 11, 12, 13, 14, 15].forEach((s, i) => bell(s, 0.04, 0.5, i * 0.07)); break;
        case 'kitFriend': tone('triangle', note(6 + (index % 5)), note(8 + (index % 5)), 0.055, 0.14); tone('triangle', note(9 + (index % 5)), note(9 + (index % 5)), 0.04, 0.16, 0.12); break;
        case 'proofLens': tone('sine', note(15), note(15), 0.04, 0.07); hiss('highpass', 4200, 3600, 0.03, 0.003, 0.03, 0.05); break;
        case 'wallPoster': bell(10 + (index % 2) * 2, 0.045, 0.5); break;
        case 'reelDone': break;
      }
    },
    lump(index) { tone('sine', note(5 + (index % 6)), note(index % 6), 0.085, 0.2); },
    reel(index) { hiss('bandpass', 2200, 1500, 0.035, 0.004, 0.04); tone('triangle', note(8 + (index % 5)), note(8 + (index % 5)), 0.05, 0.2, 0.03); },
    reelDone() { [10, 12, 13].forEach((s, i) => bell(s, 0.055, 0.5, i * 0.1)); },
    curtainCall() {
      hiss('lowpass', 520, 240, 0.05, 0.12, 0.34);                                                         // the curtain draws
      hiss('lowpass', 240, 560, 0.045, 0.12, 0.34, 0.66);                                                  // and opens
      [8, 10, 12, 13].forEach((s, i) => tone('triangle', note(s), note(s), 0.05, 0.3, 1.12 + i * 0.14));   // the bows, in turn
      [10, 11, 12, 13, 14].forEach((s, i) => bell(s, 0.036, 0.4, 1.25 + i * 0.085));                       // roses landing
      [10, 12, 13].forEach(s => bell(s, 0.045, 0.7, 1.98));                                                // the last bow: C E G
    },
    stop: stopAll,
    dispose() { if (disposed) return; stopAll(); disposed = true; unhush(); },
    live: () => voices.size,
  };
}
