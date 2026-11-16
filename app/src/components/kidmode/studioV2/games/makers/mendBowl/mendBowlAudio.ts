import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Mend the Bowl's sounds, synthesised on Arbor's one kid audio bus: the
 * child's Sound switch, the hidden-tab hush and leaving Kid Mode silence
 * them. No files, no network. Sound is always an extra; play never waits.
 *
 * One scale for the whole activity (D major pentatonic), so sounds that
 * overlap are always consonant. Every voice has a soft attack (8 ms or more)
 * and a modest peak: the loudest single voice is 0.06 of full scale and the
 * busiest moment (the bowl singing whole) sums to about 0.11. Repeats never
 * sound identical: each voice is detuned by a few cents from a fixed cycle. */
const SEMITONES = [0, 2, 4, 7, 9] as const;
export const MEND_ROOT = 293.66;
export const MEND_STEPS = 20;
/** The scale: step 0 is D4, five steps to the octave, clamped to four octaves. */
export function mendNote(step: number): number {
  const s = Math.max(0, Math.min(MEND_STEPS - 1, Math.round(step)));
  return MEND_ROOT * 2 ** (Math.floor(s / 5) + SEMITONES[s % 5] / 12);
}
/** The loudest any one voice may be asked to play. */
export const MEND_PEAK = 0.06;
const CENTS = [0, 4, -3, 6, -5, 2] as const;
/** A falling pitch lands on a note of the scale too: D falls to B, E falls to D. */
const DOWN_A_THIRD = 2 ** (-3 / 12), DOWN_A_TONE = 2 ** (-2 / 12);
export type BowlToy = 'chockPat' | 'lampOn' | 'lampOff' | 'fernRustle' | 'bloomOpen' | 'bloomFold' | 'goldDip';

export interface BowlSounds {
  /** A finger on a piece or a dish: one soft ceramic tick. */
  press(): boolean;
  /** A glaze dish: each glaze has its own note. */
  dish(index: number): boolean;
  /** The bowl rung with a fingertip: a small bell, pitched by its glaze. */
  ring(index: number): boolean;
  /** The bowl is picked up. */
  lift(): boolean;
  /** It slips: one soft low tok, then the pieces settling. Never sharp. */
  slip(): boolean;
  /** A turn button. */
  turn(direction: number): boolean;
  /** A piece clicks home: one step up the scale for each piece placed. */
  place(count: number): boolean;
  /** Every piece is home. */
  whole(): boolean;
  /** The finger moving along a crack: a rising run, one pluck per step. */
  trace(step: number): boolean;
  /** Gold running along a seam for `ms`; `count` seams were gold before it. */
  pour(ms: number, count: number): boolean;
  /** The seam is closed. */
  seal(count: number): boolean;
  /** The last seam closed: the bowl rings whole. */
  sing(): boolean;
  /** Light running along one seam at the end. */
  glint(index: number): boolean;
  toy(kind: BowlToy, turn?: number): boolean;
  stop(): void;
  dispose(): void;
}

export function createBowlSounds(): BowlSounds {
  const live = new Set<AudioScheduledSourceNode>();
  const nodes = new Set<AudioNode>();
  let disposed = false, noise: AudioBuffer | null = null, voices = 0;
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
    const length = Math.floor(ac.sampleRate * 0.6), buffer = ac.createBuffer(1, length, ac.sampleRate), data = buffer.getChannelData(0);
    // A fixed pseudo-random hiss (no Math.random): the same every time.
    let seed = 7; for (let i = 0; i < length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
    noise = buffer; return buffer;
  };
  /** One bell-like note: a sine and a quiet octave above it, soft in, slow out. */
  const bell = (ac: AudioContext, when: number, freq: number, level: number, length: number, attack = 0.01, glide = 1) => {
    const detune = CENTS[voices++ % CENTS.length], peak = Math.min(MEND_PEAK, level);
    [[1, 1, length], [2, 0.22, length * 0.55]].forEach(([ratio, share, tail]) => {
      const osc = ac.createOscillator(), gain = ac.createGain(), f = freq * ratio * 2 ** (detune / 1200);
      osc.type = 'sine'; osc.frequency.setValueAtTime(f, when);
      if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(f * glide, when + tail);
      gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * share), when + attack); gain.gain.exponentialRampToValueAtTime(0.0001, when + tail);
      osc.connect(gain); gain.connect(ac.destination); track(osc, gain);
      osc.start(when); osc.stop(when + tail + 0.03);
    });
  };
  /** A short breath of filtered noise: the grain of ceramic, or of gold running. */
  const hiss = (ac: AudioContext, when: number, centre: number, level: number, length: number, attack = 0.008) => {
    const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain(), peak = Math.min(MEND_PEAK, level);
    src.buffer = noiseBuffer(ac); filter.type = 'bandpass'; filter.frequency.setValueAtTime(centre, when); filter.Q.setValueAtTime(2.2, when);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(peak, when + attack); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination); track(src, filter, gain);
    src.start(when); src.stop(when + length + 0.02);
  };
  const safely = (run: (ac: AudioContext, now: number) => void) => {
    const ac = context(); if (!ac) return false;
    try { run(ac, ac.currentTime); return true; } catch { stop(); return false; }
  };
  return {
    press: () => safely((ac, now) => { hiss(ac, now, 2900, 0.03, 0.05); bell(ac, now, mendNote(15), 0.016, 0.1); }),
    dish: (index) => safely((ac, now) => { hiss(ac, now, 2400, 0.022, 0.05); bell(ac, now, mendNote(5 + index), 0.045, 0.42); }),
    ring: (index) => safely((ac, now) => { hiss(ac, now, 3200, 0.02, 0.04); bell(ac, now, mendNote(10 + index), 0.04, 0.9); bell(ac, now + 0.012, mendNote(15 + index), 0.01, 0.4); }),
    lift: () => safely((ac, now) => { bell(ac, now, mendNote(5), 0.026, 0.22, 0.02); bell(ac, now + 0.11, mendNote(7), 0.026, 0.26, 0.02); }),
    slip: () => safely((ac, now) => {
      // A low, round tok (a bowl meeting linen) with a slow 12 ms attack, then four small settles going down the scale.
      bell(ac, now, mendNote(0), 0.05, 0.34, 0.012, DOWN_A_THIRD); hiss(ac, now, 900, 0.028, 0.09, 0.012);
      [0.16, 0.25, 0.35, 0.43].forEach((at, i) => { hiss(ac, now + at, 2200 + i * 260, 0.012, 0.05); bell(ac, now + at, mendNote(13 - i * 2), 0.012, 0.14); });
    }),
    turn: (direction) => safely((ac, now) => { hiss(ac, now, 2600, 0.022, 0.04); bell(ac, now, mendNote(direction < 0 ? 8 : 9), 0.02, 0.12); }),
    place: (count) => safely((ac, now) => { hiss(ac, now, 3000, 0.04, 0.05); bell(ac, now, mendNote(5 + count), 0.05, 0.4); bell(ac, now + 0.01, mendNote(15 + (count % 3)), 0.014, 0.12); }),
    whole: () => safely((ac, now) => { [5, 7, 8, 10].forEach((step, i) => bell(ac, now + i * 0.07, mendNote(step), 0.03, 0.75, 0.014)); }),
    trace: (step) => safely((ac, now) => { bell(ac, now, mendNote(8 + step), 0.026, 0.26, 0.008); }),
    pour: (ms, count) => safely((ac, now) => {
      const length = Math.max(0.3, Math.min(1.2, ms / 1000)), notes = length > 0.7 ? 6 : 4;
      // A whisper of grain under a rising run; each seam starts one step higher than the last.
      hiss(ac, now, 6200, 0.007, length, length * 0.4);
      for (let i = 0; i < notes; i++) bell(ac, now + length * i / notes, mendNote(5 + count + i), 0.02 + i * 0.0015, 0.3, 0.012);
    }),
    seal: (count) => safely((ac, now) => { bell(ac, now, mendNote(10 + (count % 5)), 0.042, 0.8, 0.012); bell(ac, now + 0.05, mendNote(15 + (count % 5)), 0.012, 0.5, 0.012); }),
    sing: () => safely((ac, now) => {
      // The bowl rings whole: root, fifth and octave, a slow 40 ms swell and a long tail.
      bell(ac, now, mendNote(0), 0.05, 2.2, 0.04); bell(ac, now + 0.02, mendNote(3), 0.03, 1.9, 0.04); bell(ac, now + 0.04, mendNote(5), 0.022, 1.7, 0.04);
    }),
    glint: (index) => safely((ac, now) => { bell(ac, now, mendNote(10 + index), 0.03, 0.5, 0.01); hiss(ac, now, 7200, 0.006, 0.12, 0.03); }),
    toy: (kind, turn = 0) => safely((ac, now) => {
      if (kind === 'chockPat') { bell(ac, now, mendNote(0) / 2, 0.05, 0.16, 0.014, DOWN_A_THIRD); bell(ac, now + 0.2, mendNote(1) / 2, 0.045, 0.2, 0.014, DOWN_A_TONE); }
      else if (kind === 'lampOn') { bell(ac, now, mendNote(10), 0.03, 0.5); bell(ac, now + 0.09, mendNote(13), 0.03, 0.7); }
      else if (kind === 'lampOff') { bell(ac, now, mendNote(13), 0.024, 0.3); bell(ac, now + 0.09, mendNote(10), 0.024, 0.5); }
      else if (kind === 'fernRustle') { hiss(ac, now, 4200, 0.02, 0.22, 0.05); hiss(ac, now + 0.12, 5200, 0.014, 0.2, 0.05); bell(ac, now + 0.05, mendNote(12 + (turn % 3)), 0.012, 0.3); }
      else if (kind === 'bloomOpen') { [7, 8, 10].forEach((step, i) => bell(ac, now + i * 0.06, mendNote(step), 0.026, 0.4)); }
      else if (kind === 'bloomFold') { [10, 8, 7].forEach((step, i) => bell(ac, now + i * 0.06, mendNote(step), 0.022, 0.3)); }
      else { hiss(ac, now, 5200, 0.012, 0.16, 0.03); bell(ac, now, mendNote(12 + (turn % 4)), 0.034, 0.7); }
    }),
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
