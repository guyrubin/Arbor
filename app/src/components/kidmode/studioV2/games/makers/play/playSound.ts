import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** The makers' shared sound: a small synth on Arbor's one kid audio bus. No
 * files, no network. The child's Sound switch, the hidden-tab hush and leaving
 * Kid Mode silence it (`kidAudioAllowed`, `onKidHush`); nothing plays before a
 * gesture because the shared context only starts inside one. Sound is always
 * an extra: every call returns at once and play never waits on it.
 *
 * One major pentatonic scale per activity (`key`), so any overlap is
 * consonant. Soft attacks (8 ms or more), modest peaks: the loudest single
 * voice is `PLAY_PEAK` of full scale and the ambience bed sits near 0.012. */
export type PlayKey = 'C' | 'D' | 'F' | 'G' | 'A';
export type PlayAmbience = 'room' | 'garden' | 'water' | 'wind' | 'night' | 'hall';
export const PLAY_ROOTS: Readonly<Record<PlayKey, number>> = { C: 261.63, D: 293.66, F: 349.23, G: 392, A: 220 };
const PENTATONIC = [0, 2, 4, 7, 9] as const;
export const PLAY_STEPS = 20;
export const PLAY_PEAK = 0.07;
export const PLAY_BED_PEAK = 0.014;
/** Step 0 is the root; five steps to the octave; clamped to four octaves. */
export function playNote(key: PlayKey, step: number): number {
  const s = Math.max(0, Math.min(PLAY_STEPS - 1, Math.round(Number.isFinite(step) ? step : 0)));
  return PLAY_ROOTS[key] * 2 ** (Math.floor(s / 5) + PENTATONIC[s % 5] / 12);
}
/** A chain of successes climbs the scale and stays inside it. */
export function chainStep(step: number | undefined, base = 5, span = 10): number {
  const n = Math.max(0, Math.floor(Number.isFinite(step) ? (step as number) : 0));
  return base + (n % span);
}
const CENTS = [0, 4, -3, 6, -5, 2] as const;

export interface PlaySound {
  /** Any touch: one small tick. */
  tap(): boolean;
  /** A thing picked up. */
  pick(): boolean;
  /** A thing placed; `step` climbs through a chain of successes. */
  place(step?: number): boolean;
  /** A miss: the soft return. Never a buzzer. */
  back(): boolean;
  /** A chapter ends. */
  chapter(): boolean;
  /** The set-piece. */
  setPiece(): boolean;
  /** Starts (or changes) the quiet bed for the place. Needs a prior gesture. */
  ambience(kind: PlayAmbience): boolean;
  /** One note of the activity's scale, for anything the fixed set lacks. */
  note(step: number, options?: { gain?: number; length?: number; attack?: number; at?: number }): boolean;
  /** A breath of filtered noise (dust, a pour, a rustle). */
  breath(options?: { tone?: number; gain?: number; length?: number; at?: number }): boolean;
  /** Silences everything now, the bed included. The instance stays usable. */
  stop(): void;
  /** Stops and detaches from the seams. Call on unmount. */
  dispose(): void;
}

interface BedPlan { centre: number; q: number; gain: number; drone: readonly number[]; droneGain: number; swell: number }
const BEDS: Readonly<Record<PlayAmbience, BedPlan>> = {
  room: { centre: 420, q: 0.6, gain: 0.5, drone: [0], droneGain: 0.35, swell: 0.07 },
  garden: { centre: 2600, q: 0.8, gain: 0.55, drone: [5, 7], droneGain: 0.22, swell: 0.11 },
  water: { centre: 900, q: 0.9, gain: 0.8, drone: [0, 3], droneGain: 0.25, swell: 0.19 },
  wind: { centre: 620, q: 1.4, gain: 0.9, drone: [3], droneGain: 0.18, swell: 0.13 },
  night: { centre: 3400, q: 2.2, gain: 0.35, drone: [0, 2], droneGain: 0.4, swell: 0.05 },
  hall: { centre: 300, q: 0.5, gain: 0.6, drone: [0, 3, 5], droneGain: 0.3, swell: 0.06 },
};

export function createPlaySound({ key }: { key: PlayKey }): PlaySound {
  const live = new Set<AudioScheduledSourceNode>();
  const nodes = new Set<AudioNode>();
  let disposed = false, noise: AudioBuffer | null = null, voices = 0;
  let bed: { kind: PlayAmbience; sources: AudioScheduledSourceNode[]; nodes: AudioNode[] } | null = null;
  let wanted: PlayAmbience | null = null;

  const stopBed = () => {
    if (!bed) return;
    for (const source of bed.sources) { try { source.stop(); } catch { /* Already ended. */ } try { source.disconnect(); } catch { /* Released. */ } }
    for (const node of bed.nodes) { try { node.disconnect(); } catch { /* Released. */ } }
    bed = null;
  };
  const stopVoices = () => {
    for (const source of live) { try { source.stop(); } catch { /* Already ended. */ } }
    live.clear();
    for (const node of nodes) { try { node.disconnect(); } catch { /* Already released. */ } }
    nodes.clear();
  };
  /** Everything off now. The bed is remembered: after a hush or a hidden tab it
   * returns with the next sound the child makes. */
  const silence = () => { stopVoices(); stopBed(); };
  /** The public stop: silence, and forget the bed. */
  const stop = () => { wanted = null; silence(); };
  const unhush = onKidHush(silence);
  const onVisibility = () => { if (typeof document !== 'undefined' && document.visibilityState === 'hidden') silence(); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  const context = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext(); if (!ac) return null;
    void ac.resume?.().catch(() => silence());
    return ac;
  };
  const track = <T extends AudioScheduledSourceNode>(source: T, ...extra: AudioNode[]) => {
    live.add(source); extra.forEach(n => nodes.add(n));
    source.onended = () => { live.delete(source); for (const n of [source, ...extra]) { nodes.delete(n); try { n.disconnect(); } catch { /* Already released. */ } } };
    return source;
  };
  const noiseBuffer = (ac: AudioContext) => {
    if (noise && noise.sampleRate === ac.sampleRate) return noise;
    const length = Math.floor(ac.sampleRate * 2), buffer = ac.createBuffer(1, length, ac.sampleRate), data = buffer.getChannelData(0);
    // A fixed pseudo-random hiss: the same every time, and it loops without a seam worth hearing.
    let seed = 11; for (let i = 0; i < length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
    noise = buffer; return buffer;
  };
  /** One bell-like note: a sine and a quiet octave above it, soft in, slow out. */
  const bell = (ac: AudioContext, when: number, freq: number, level: number, length: number, attack = 0.01, glide = 1, shape: OscillatorType = 'sine') => {
    const detune = CENTS[voices++ % CENTS.length], peak = Math.min(PLAY_PEAK, Math.max(0.0002, level));
    const partials: readonly (readonly [number, number, number])[] = [[1, 1, length], [2, 0.2, length * 0.55]];
    for (const [ratio, share, tail] of partials) {
      const osc = ac.createOscillator(), gain = ac.createGain(), f = freq * ratio * 2 ** (detune / 1200);
      osc.type = shape; osc.frequency.setValueAtTime(f, when);
      if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(f * glide, when + tail);
      gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * share), when + attack); gain.gain.exponentialRampToValueAtTime(0.0001, when + tail);
      osc.connect(gain); gain.connect(ac.destination); track(osc, gain);
      osc.start(when); osc.stop(when + tail + 0.03);
    }
  };
  const hiss = (ac: AudioContext, when: number, centre: number, level: number, length: number, attack = 0.008) => {
    const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain(), peak = Math.min(PLAY_PEAK, Math.max(0.0002, level));
    src.buffer = noiseBuffer(ac); filter.type = 'bandpass'; filter.frequency.setValueAtTime(centre, when); filter.Q.setValueAtTime(2.2, when);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(peak, when + Math.min(attack, length * 0.5)); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination); track(src, filter, gain);
    src.start(when); src.stop(when + length + 0.02);
  };
  const startBed = (ac: AudioContext, kind: PlayAmbience) => {
    if (bed?.kind === kind) return;
    stopBed();
    const plan = BEDS[kind], now = ac.currentTime, sources: AudioScheduledSourceNode[] = [], held: AudioNode[] = [];
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(PLAY_BED_PEAK, now + 1.6);
    master.connect(ac.destination); held.push(master);
    // Air: looped noise through a wide band-pass, breathing slowly.
    const air = ac.createBufferSource(), band = ac.createBiquadFilter(), airGain = ac.createGain();
    air.buffer = noiseBuffer(ac); air.loop = true;
    band.type = 'bandpass'; band.frequency.setValueAtTime(plan.centre, now); band.Q.setValueAtTime(plan.q, now);
    airGain.gain.setValueAtTime(plan.gain, now);
    const swell = ac.createOscillator(), swellDepth = ac.createGain();
    swell.type = 'sine'; swell.frequency.setValueAtTime(plan.swell, now); swellDepth.gain.setValueAtTime(plan.gain * 0.45, now);
    swell.connect(swellDepth); swellDepth.connect(airGain.gain);
    air.connect(band); band.connect(airGain); airGain.connect(master);
    air.start(now); swell.start(now);
    sources.push(air, swell); held.push(band, airGain, swellDepth);
    // A held note or two of the activity's own scale, two octaves down, barely there.
    plan.drone.forEach((step, i) => {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(playNote(key, step) / 2 * 2 ** ((i % 2 ? 3 : -3) / 1200), now);
      gain.gain.setValueAtTime(plan.droneGain / (i + 1), now);
      osc.connect(gain); gain.connect(master); osc.start(now);
      sources.push(osc); held.push(gain);
    });
    bed = { kind, sources, nodes: held };
  };
  const safely = (run: (ac: AudioContext, now: number) => void) => {
    const ac = context(); if (!ac) return false;
    try {
      // The bed comes back by itself after a hush or a hidden tab.
      if (wanted && !bed) startBed(ac, wanted);
      run(ac, ac.currentTime); return true;
    } catch { silence(); return false; }
  };
  const n = (step: number) => playNote(key, step);

  return {
    tap: () => safely((ac, now) => { hiss(ac, now, 3000, 0.02, 0.04); bell(ac, now, n(15), 0.018, 0.09); }),
    pick: () => safely((ac, now) => { bell(ac, now, n(7), 0.03, 0.2, 0.012); bell(ac, now + 0.07, n(9), 0.03, 0.24, 0.012); }),
    place: (step) => safely((ac, now) => { const s = chainStep(step); hiss(ac, now, 2800, 0.03, 0.05); bell(ac, now, n(s), 0.052, 0.42); bell(ac, now + 0.012, n(s + 5), 0.014, 0.16); }),
    back: () => safely((ac, now) => { bell(ac, now, n(4), 0.03, 0.2, 0.014, 2 ** (-2 / 12)); bell(ac, now + 0.11, n(2), 0.024, 0.26, 0.014); }),
    chapter: () => safely((ac, now) => { [5, 7, 8, 10].forEach((step, i) => bell(ac, now + i * 0.08, n(step), 0.034, 0.7, 0.014)); bell(ac, now + 0.34, n(15), 0.014, 0.5, 0.02); }),
    setPiece: () => safely((ac, now) => {
      // Root, fifth and octave swell under a slow rising run: about four seconds, never loud.
      bell(ac, now, n(0), 0.05, 3.4, 0.06); bell(ac, now + 0.03, n(3), 0.03, 3, 0.06); bell(ac, now + 0.06, n(5), 0.024, 2.6, 0.06);
      [5, 7, 8, 10, 12, 13, 15].forEach((step, i) => bell(ac, now + 0.3 + i * 0.16, n(step), 0.026, 0.9, 0.016));
      hiss(ac, now + 0.2, 6400, 0.006, 1.6, 0.6);
    }),
    ambience: (kind) => { wanted = kind; const ac = context(); if (!ac) return false; try { startBed(ac, kind); return true; } catch { stopBed(); return false; } },
    note: (step, options = {}) => safely((ac, now) => bell(ac, now + Math.max(0, options.at ?? 0), n(step), options.gain ?? 0.04, options.length ?? 0.4, options.attack ?? 0.01)),
    breath: (options = {}) => safely((ac, now) => hiss(ac, now + Math.max(0, options.at ?? 0), options.tone ?? 2400, options.gain ?? 0.02, options.length ?? 0.2, 0.03)),
    stop,
    dispose() {
      if (disposed) return;
      disposed = true; stop(); unhush();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
