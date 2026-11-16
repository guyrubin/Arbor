import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Stitch Garden's sound, as numbers. Everything is a note of ONE scale, C
 * major pentatonic (C D E G A), so the needle, a chosen thread, a tapped
 * flower and the finish can overlap and stay in tune (the shared tap sound,
 * E5, is in it too). Soft attacks (5 ms or more), short decays, peak gain
 * 0.045 at most per voice, and never a loop: silence between touches. */
export const SCALE: readonly number[] = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];
export const degree = (i: number) => SCALE[Math.max(0, Math.min(SCALE.length - 1, Math.round(i)))];
/** Each thread has its own voice: its tunes start on its own note (C5 up to A5). */
export const threadRoot = (thread: number) => 5 + Math.max(0, Math.min(4, Math.round(thread)));
/** The needle's tune climbs as the flower does: low for the stem, higher for
 * the leaves and petals, highest for the knots at its heart. */
const CONTOUR = { stem: [-5, -3, -5, -2], leaf: [-3, -2, 0, -2], petal: [0, 2, 1, 3, 2, 4], centre: [4, 5, 7] } as const;
export type StitchPartName = keyof typeof CONTOUR;
export const stitchNote = (thread: number, beat: number, part: StitchPartName) => { const line = CONTOUR[part]; return degree(threadRoot(thread) + line[((beat % line.length) + line.length) % line.length]); };
/** What a flower sings when it is tapped: three notes, one shape per flower. */
const SONGS: readonly (readonly number[])[] = [[0, 2, 4], [0, 1, 2], [4, 2, 0], [0, 3, 5], [0, 2, 3]];
export type ToySound = 'aya' | 'visitor' | 'ladybird' | 'needle' | 'screw' | 'water' | 'sunbeam' | 'breeze';

export interface StitchSounds {
  /** One pluck of the needle's tune. False when sound is off or unavailable. */
  stitch(thread: number, beat: number, part: StitchPartName): boolean;
  /** The flower is whole: two rising notes. */
  bloom(thread: number): boolean;
  /** A thread, a pattern card, a cloth chosen. */
  pick(thread: number): boolean;
  card(index: number): boolean;
  cloth(index: number): boolean;
  /** A soft pull of thread coming back out. */
  pull(): boolean;
  /** A cross that is taken: one low, soft knock. */
  nudge(): boolean;
  sing(thread: number, flower: number): boolean;
  toy(kind: ToySound): boolean;
  /** The finished hoop held up: one note per flower, then the chord. */
  finish(count: number, everyMs: number, chordAtMs: number): boolean;
  stop(): void;
  dispose(): void;
}

interface Voice { type: OscillatorType; from: number; to?: number; at?: number; length: number; level: number; attack?: number }
const MAX_VOICES = 28;

/** Local synthesis on Arbor's one kid audio bus: the child's Sound switch, the
 * hidden-tab hush and leaving Kid Mode all silence it. No file, no network.
 * Sound is an extra; the stitching never waits for it. */
export function createStitchSounds(random: () => number = Math.random): StitchSounds {
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
  const voice = (ac: AudioContext, v: Voice) => {
    if (sources.size >= MAX_VOICES) return;
    const when = ac.currentTime + (v.at ?? 0), attack = Math.max(0.005, v.attack ?? 0.006);
    const source = ac.createOscillator();
    let gain: GainNode;
    try { gain = ac.createGain(); } catch (error) { source.disconnect(); throw error; }
    sources.set(source, [gain]);
    source.type = v.type;
    source.frequency.setValueAtTime(v.from, when);
    if (v.to !== undefined && v.to !== v.from) source.frequency.exponentialRampToValueAtTime(v.to, when + v.length);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.045, v.level), when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + v.length);
    source.connect(gain); gain.connect(ac.destination);
    source.onended = () => release(source);
    source.start(when); source.stop(when + v.length + 0.02);
  };
  const play = (voices: () => Voice[]): boolean => {
    try {
      const ac = context(); if (!ac) return false;
      for (const v of voices()) voice(ac, v);
      return true;
    } catch { stop(); return false; }
  };
  /** No two plucks are quite alike: a few cents off, a little louder or softer. */
  const human = (f: number) => f * (1 + (random() * 2 - 1) * 0.003);
  const touch = (level: number) => level * (0.85 + random() * 0.3);
  const pluck = (f: number, level: number, length: number, at = 0): Voice[] => [
    { type: 'triangle', from: human(f), at, length, level: touch(level) },
    { type: 'sine', from: human(f * 2), at, length: length * 0.55, level: touch(level * 0.3) },
  ];
  return {
    stitch: (thread, beat, part) => play(() => pluck(stitchNote(thread, beat, part), 0.022, 0.12)),
    bloom: thread => play(() => [...pluck(degree(threadRoot(thread) + 2), 0.032, 0.26), ...pluck(degree(threadRoot(thread) + 4), 0.036, 0.36, 0.09)]),
    pick: thread => play(() => pluck(degree(threadRoot(thread)), 0.034, 0.2)),
    card: index => play(() => [{ type: 'sine', from: human(degree(index)), to: degree(index) * 0.94, length: 0.1, level: touch(0.032) }]),
    cloth: index => play(() => [{ type: 'sine', from: human(degree(2 + index)), length: 0.14, level: touch(0.024), attack: 0.012 }, { type: 'sine', from: human(degree(4 + index)), at: 0.07, length: 0.16, level: touch(0.02), attack: 0.012 }]),
    pull: () => play(() => [{ type: 'sine', from: degree(5), to: degree(0), length: 0.24, level: 0.034, attack: 0.01 }]),
    nudge: () => play(() => [{ type: 'sine', from: degree(0) * 0.75, to: degree(0) * 0.63, length: 0.09, level: 0.03, attack: 0.008 }]),
    sing: (thread, flower) => play(() => (SONGS[flower] ?? SONGS[0]).flatMap((step, i) => pluck(degree(threadRoot(thread) + step), 0.03, 0.24, i * 0.085))),
    toy: kind => play(() => {
      switch (kind) {
        case 'aya': return [{ type: 'sine', from: degree(7), to: degree(8), length: 0.13, level: touch(0.034), attack: 0.012 }, { type: 'sine', from: degree(9), to: degree(10), at: 0.12, length: 0.18, level: touch(0.034), attack: 0.012 }];
        case 'visitor': return [{ type: 'triangle', from: degree(4) / 2, to: degree(0), length: 0.16, level: 0.02, attack: 0.02 }, { type: 'triangle', from: degree(0), to: degree(4) / 2, at: 0.15, length: 0.2, level: 0.02, attack: 0.02 }];
        case 'ladybird': return [...pluck(degree(10), 0.02, 0.06), ...pluck(degree(12), 0.02, 0.07, 0.07)];
        case 'needle': return [{ type: 'sine', from: human(degree(13)), length: 0.38, level: 0.028 }, { type: 'sine', from: human(degree(13) * 2), length: 0.2, level: 0.008 }];
        case 'screw': return [0, 1, 2].map(i => ({ type: 'triangle' as const, from: human(degree(9)), to: degree(8), at: i * 0.05, length: 0.035, level: 0.02 }));
        case 'water': return [13, 11, 12, 10, 9].map((d, i) => ({ type: 'sine' as const, from: human(degree(d)), to: degree(d) * 0.9, at: i * 0.075 + random() * 0.02, length: 0.09, level: touch(0.02) }));
        case 'sunbeam': return [5, 7, 9, 10].flatMap((d, i) => pluck(degree(d), 0.024, 0.3, i * 0.11));
        case 'breeze': return [{ type: 'sine', from: degree(3), to: degree(5), length: 0.45, level: 0.012, attack: 0.15 }, { type: 'sine', from: degree(5), to: degree(3), at: 0.42, length: 0.5, level: 0.012, attack: 0.08 }];
      }
    }),
    finish: (count, everyMs, chordAtMs) => play(() => [
      ...Array.from({ length: Math.max(0, Math.min(8, count)) }, (_, i) => pluck(degree(5 + i), 0.03, 0.3, i * everyMs / 1000)).flat(),
      ...[5, 7, 8, 10].map((d, i) => ({ type: 'sine' as const, from: degree(d), at: chordAtMs / 1000 + i * 0.04, length: 0.7, level: 0.026, attack: 0.03 })),
    ]),
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
