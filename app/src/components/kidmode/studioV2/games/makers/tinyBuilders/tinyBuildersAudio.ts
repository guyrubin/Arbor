import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Tiny Structures sounds, synthesised on Arbor's one kid audio bus (the
 * child's Sound switch, hidden-tab hush and leaving Kid Mode all silence it).
 * No files, no network. Sound is an extra: play never waits for a sound.
 *
 * One scale for everything: C major pentatonic (C D E G A), so any two sounds
 * that overlap are consonant. Every voice has a soft attack (3 ms or more), a
 * quiet peak (the loudest single voice is 0.12; a whole cue sums below 0.3 of
 * full scale) and a small random detune, so a repeated sound is never the
 * same twice. Nothing loops. */
export type TinySound =
  | 'pickUp' | 'snapOn' | 'noFit' | 'whole' | 'glassNote' | 'turnTick' | 'turnPush' | 'cutOpen' | 'cutClose' | 'rePaint'
  | 'stageTap' | 'tailSpring' | 'legDance' | 'friendHop' | 'zoomDive' | 'zoomRise' | 'arrive'
  | 'feetTouch' | 'whumph' | 'squeeze' | 'threadSlide' | 'threadIn' | 'cheerUp';
export interface TinyTones {
  /** Plays a sound now. `step` picks its note on the scale (a label, a placement, a stop). */
  play(sound: TinySound, step?: number): boolean;
  stop(): void;
  dispose(): void;
}

/** C major pentatonic from C4 up: the only pitches the activity uses. */
export const TINY_SCALE: readonly number[] = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
/** The note for a step on the scale, from C5; steps wrap inside the scale. */
export function tinyNote(step: number, from = 5): number {
  const n = TINY_SCALE.length, i = ((Math.trunc(Number.isFinite(step) ? step : 0) + from) % n + n) % n;
  return TINY_SCALE[i];
}
/** The loudest any one voice may be. */
export const TINY_PEAK = 0.12;

export function createTinyTones(): TinyTones {
  const live = new Set<AudioScheduledSourceNode>();
  const nodes = new Set<AudioNode>();
  let disposed = false, epoch = 0, lastTick = 0;
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
  /** A little human looseness: within about a sixth of a semitone. */
  const loose = (hz: number) => hz * (1 + (Math.random() - 0.5) * 0.018);
  const tone = (ac: AudioContext, type: OscillatorType, from: number, to: number | null, when: number, length: number, level: number, attack = 0.008) => {
    const osc = keep(ac.createOscillator()), gain = keep(ac.createGain());
    osc.type = type;
    osc.frequency.setValueAtTime(loose(from), when);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, when + length * 0.8);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.min(TINY_PEAK, level), when + Math.max(0.003, attack));
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
    gain.gain.exponentialRampToValueAtTime(Math.min(TINY_PEAK, level), when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    run(src, when, length, [src, filter, gain]);
  };
  /** A glassy bell: a clear note with one quiet inharmonic shimmer. */
  const bell = (ac: AudioContext, hz: number, when: number, level: number, length = 1) => {
    tone(ac, 'sine', hz, null, when, length, level, 0.005);
    tone(ac, 'sine', hz * 2.76, null, when, length * 0.4, level * 0.22, 0.005);
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
          case 'pickUp': // a piece leaves the tray: one light tick, pitched by the piece
            tone(ac, 'sine', tinyNote(step, 8), null, t, 0.09, 0.035, 0.004);
            break;
          case 'snapOn': // the magnet takes it: a soft click, a low knock, then a bell that climbs as the model grows
            hiss(ac, t, 0.045, 0.1, 2300, 5);
            tone(ac, 'sine', 196, 98, t, 0.12, 0.11, 0.004);
            bell(ac, tinyNote(step, 5), t + 0.02, 0.045, 0.7);
            break;
          case 'noFit': // it drifts back: a small soft bob, never a buzzer
            tone(ac, 'sine', TINY_SCALE[4], TINY_SCALE[2], t, 0.2, 0.03, 0.012);
            break;
          case 'whole': // the model is whole: the scale's chord, rising
            [5, 7, 8, 10].forEach((n, i) => bell(ac, TINY_SCALE[n], t + i * 0.1, 0.045, 1.1));
            break;
          case 'glassNote': // a part's name: its own note
            bell(ac, tinyNote(step, 7), t, 0.055, 1.1);
            break;
          case 'turnTick': { // the turntable's marks pass: very quiet, never faster than twenty a second
            if (t - lastTick < 0.05) return true;
            lastTick = t;
            tone(ac, 'triangle', TINY_SCALE[13 + (Math.abs(Math.trunc(step)) % 2)], null, t, 0.03, 0.012, 0.003);
            break;
          }
          case 'turnPush': // a push on the table: a soft breath
            hiss(ac, t, 0.16, 0.028, 520, 1.2, 900);
            break;
          case 'cutOpen': // the glass lifts away
            tone(ac, 'sine', TINY_SCALE[5], TINY_SCALE[8], t, 0.3, 0.035, 0.02); hiss(ac, t, 0.22, 0.018, 1800, 1.5, 3200);
            break;
          case 'cutClose':
            tone(ac, 'sine', TINY_SCALE[8], TINY_SCALE[5], t, 0.26, 0.035, 0.02);
            break;
          case 'rePaint': // new colours: three notes of the scale, a different three each time
            [0, 1, 2].forEach(i => bell(ac, tinyNote(step + i * 2 + Math.floor(Math.random() * 2), 6), t + i * 0.07, 0.035, 0.6));
            break;
          case 'stageTap': // a tap on the room: one soft drop, higher the higher the tap
            bell(ac, tinyNote(step, 4), t, 0.035, 0.5);
            break;
          case 'tailSpring': // the sleeve squeezes and springs back
            tone(ac, 'triangle', TINY_SCALE[1], TINY_SCALE[4], t, 0.14, 0.04, 0.008);
            tone(ac, 'triangle', TINY_SCALE[4], TINY_SCALE[2], t + 0.14, 0.24, 0.035, 0.008);
            break;
          case 'legDance': // six feet, six notes
            [5, 6, 7, 8, 9, 10].forEach((n, i) => tone(ac, 'sine', TINY_SCALE[n], null, t + i * 0.075, 0.2, 0.03, 0.004));
            break;
          case 'friendHop': // Aya hops: two quick notes up
            tone(ac, 'sine', TINY_SCALE[7], null, t, 0.14, 0.035, 0.005); tone(ac, 'sine', TINY_SCALE[9], null, t + 0.1, 0.22, 0.035, 0.005);
            break;
          case 'zoomDive': // into the lens: a long soft glide down, and water
            tone(ac, 'sine', TINY_SCALE[10], TINY_SCALE[5], t, 1.1, 0.03, 0.12); hiss(ac, t, 0.9, 0.02, 900, 0.8, 300);
            break;
          case 'zoomRise':
            tone(ac, 'sine', TINY_SCALE[5], TINY_SCALE[10], t, 0.9, 0.03, 0.12);
            break;
          case 'arrive': // a new picture: its own bell, lower the deeper the stop
            bell(ac, tinyNote(-Math.abs(Math.trunc(step)), 9), t, 0.05, 1.1);
            break;
          case 'feetTouch': // six feet meet the cell: three tiny taps
            [9, 8, 7].forEach((n, i) => tone(ac, 'sine', TINY_SCALE[n], null, t + i * 0.06, 0.12, 0.028, 0.004));
            break;
          case 'whumph': // the low gentle settle of the landing
            tone(ac, 'sine', 110, 55, t, 0.6, TINY_PEAK, 0.03);
            hiss(ac, t, 0.36, 0.04, 320, 0.8, 120);
            break;
          case 'squeeze': // the sheath shortens: a quick soft spring
            tone(ac, 'triangle', TINY_SCALE[1], TINY_SCALE[5], t, 0.24, 0.04, 0.01);
            break;
          case 'threadSlide': // the thread slides down: a long soft glide
            tone(ac, 'sine', TINY_SCALE[7], TINY_SCALE[2], t, 1.6, 0.028, 0.2);
            break;
          case 'threadIn': // the instructions are inside: two bells, a fifth apart
            bell(ac, TINY_SCALE[5], t, 0.045, 1.4); bell(ac, TINY_SCALE[8], t + 0.12, 0.04, 1.4);
            break;
          case 'cheerUp': // the finish: the legs' six notes, then the scale's chord held
            [5, 6, 7, 8, 9, 10].forEach((n, i) => tone(ac, 'sine', TINY_SCALE[n], null, t + 0.25 + i * 0.09, 0.22, 0.03, 0.004));
            [5, 8, 12].forEach((n, i) => bell(ac, TINY_SCALE[n], t + 1.05 + i * 0.04, 0.04, 1.5));
            break;
        }
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
