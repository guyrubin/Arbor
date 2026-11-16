import { kidAudioAllowed, kidAudioContext, kidSfx, onKidHush } from '../../../../audio/kidAudio';

/** The Paper Boat's sounds, synthesised on Arbor's one kid audio bus: the
 * child's Sound switch, the hidden-tab hush and leaving Kid Mode silence them.
 * No files, no network. One scale for the whole book, C major pentatonic, so
 * any two sounds that overlap are consonant; repeats step through it and are
 * detuned a hair, so no two taps are quite the same. Everything is soft: a
 * 10 ms attack at the least, no single voice above 0.06, and the rain, the
 * only loop, is a whisper (0.02). A game step never waits for a sound. */
export type ToySound = 'aya' | 'pep' | 'chock' | 'bebe' | 'gobgob' | 'dome' | 'bell' | 'fountain' | 'bridge' | 'cascade' | 'echo' | 'boat'
  | 'knitArch' | 'stone' | 'lily' | 'skybridge' | 'glasshouse' | 'lamp' | 'cloud' | 'lantern' | 'buggy' | 'moored';
export interface BoatAudio {
  /** A page lifted. */
  swish(): void;
  /** A page landed. */
  thup(): void;
  /** The pieces of a spread standing up, one after another. */
  pops(count: number): void;
  /** A wooden tick of the wheel. */
  tick(): void;
  lap(): void;
  /** A gate passed: two soft rising notes. */
  chime(step: number): void;
  bump(): void;
  gust(): void;
  rumble(): void;
  bell(): void;
  lamp(index: number): void;
  /** A tap on the bare page: a paper tap and one note, higher towards the far edge. */
  poke(step: number): void;
  toy(kind: ToySound, turn: number): void;
  /** The homecoming: a rising run, then home. */
  home(): void;
  /** The book closing. */
  close(): void;
  /** The rain's loudness, 0 … 1 (0 stops it). */
  rain(level: number): void;
  stopAll(): void;
  dispose(): void;
}

type Voice = { stop(): void };
/** C major pentatonic, C4 … A6. */
export const BOAT_SCALE: readonly number[] = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
const note = (step: number) => BOAT_SCALE[((Math.round(step) % BOAT_SCALE.length) + BOAT_SCALE.length) % BOAT_SCALE.length];

export function createBoatAudio(): BoatAudio {
  const voices = new Set<Voice>();
  let disposed = false, noise: AudioBuffer | null = null;
  let rainVoice: { gain: GainNode; voice: Voice } | null = null;
  let lastTick = 0, ticks = 0;

  const ready = (): AudioContext | null => {
    if (disposed || !kidAudioAllowed()) return null;
    const context = kidAudioContext(); if (!context) return null;
    void context.resume?.().catch(() => undefined);
    return context;
  };
  const noiseBuffer = (context: AudioContext) => {
    if (noise && noise.sampleRate === context.sampleRate) return noise;
    const length = Math.floor(context.sampleRate * 2);
    noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    // A fixed-seed generator, so the texture is the same every time.
    let seed = 7;
    for (let i = 0; i < length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
    return noise;
  };
  /** Keeps a node chain until it ends, so stopAll can silence it. */
  const keep = (sources: AudioScheduledSourceNode[], nodes: AudioNode[], until: number): Voice => {
    let done = false;
    const voice: Voice = {
      stop() {
        if (done) return; done = true; voices.delete(voice);
        for (const source of sources) { try { source.stop(); } catch { /* already stopped */ } }
        for (const node of [...sources, ...nodes]) { try { node.disconnect(); } catch { /* already released */ } }
      },
    };
    voices.add(voice);
    sources[0].onended = () => voice.stop();
    for (const source of sources) source.stop(until);
    return voice;
  };
  const envelope = (context: AudioContext, peak: number, attack: number, length: number, at: number) => {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Math.min(0.06, peak)), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    return gain;
  };
  /** A hair of detune: within a sixth of a semitone, so the scale still holds. */
  const wander = () => 1 + (Math.random() - 0.5) * 0.008;
  const tone = (context: AudioContext, type: OscillatorType, from: number, to: number | null, peak: number, length: number, delay = 0, attack = 0.012) => {
    const at = context.currentTime + delay, bend = wander();
    const source = context.createOscillator();
    source.type = type; source.frequency.setValueAtTime(from * bend, at);
    if (to !== null) source.frequency.exponentialRampToValueAtTime(to * bend, at + length);
    const gain = envelope(context, peak, attack, length, at);
    source.connect(gain); gain.connect(context.destination);
    source.start(at); keep([source], [gain], at + length + 0.03);
  };
  /** A soft mallet note: a triangle with a quiet octave above it. */
  const pluck = (context: AudioContext, step: number, peak = 0.05, length = 0.34, delay = 0) => {
    tone(context, 'triangle', note(step), null, peak, length, delay);
    tone(context, 'sine', note(step) * 2, null, peak * 0.28, length * 0.6, delay);
  };
  /** A glass note: a sine with a faint bright partial. */
  const glass = (context: AudioContext, step: number, peak = 0.04, length = 0.6, delay = 0) => {
    tone(context, 'sine', note(step), null, peak, length, delay);
    tone(context, 'sine', note(step) * 3.01, null, peak * 0.14, length * 0.4, delay);
  };
  const hiss = (context: AudioContext, filter: BiquadFilterType, from: number, to: number, q: number, peak: number, attack: number, length: number, delay = 0) => {
    const at = context.currentTime + delay;
    const source = context.createBufferSource(); source.buffer = noiseBuffer(context);
    const shape = context.createBiquadFilter(); shape.type = filter; shape.Q.value = q;
    shape.frequency.setValueAtTime(from, at); shape.frequency.exponentialRampToValueAtTime(to, at + length);
    const gain = envelope(context, peak, attack, length, at);
    source.connect(shape); shape.connect(gain); gain.connect(context.destination);
    source.start(at, Math.random() * 1.5); keep([source], [shape, gain], at + length + 0.03);
  };
  const safely = (run: (context: AudioContext) => void) => () => {
    const context = ready(); if (!context) return;
    try { run(context); } catch { /* sound is never load-bearing */ }
  };

  const stopAll = () => {
    for (const voice of [...voices]) voice.stop();
    rainVoice = null;
  };
  const unhush = onKidHush(stopAll);

  const TOYS: Record<ToySound, (context: AudioContext, turn: number) => void> = {
    // the crew: each has two notes of its own, a third up or down
    aya: (c, n) => { tone(c, 'sine', note(12), note(13), 0.035, 0.09); tone(c, 'sine', note(n % 2 ? 14 : 13), note(12), 0.03, 0.12, 0.11); },
    pep: (c, n) => { tone(c, 'triangle', note(8), note(10), 0.045, 0.07); tone(c, 'triangle', note(n % 2 ? 10 : 9), note(11), 0.04, 0.08, 0.1); },
    chock: (c, n) => { tone(c, 'triangle', note(3), note(2), 0.055, 0.14, 0, 0.02); tone(c, 'triangle', note(n % 2 ? 2 : 3), note(1), 0.05, 0.18, 0.2, 0.02); },
    bebe: (c, n) => { pluck(c, 5 + (n % 3), 0.045, 0.2); pluck(c, 8 + (n % 2), 0.04, 0.3, 0.12); },
    gobgob: (c, n) => { pluck(c, 9, 0.04, 0.16); pluck(c, 10 + (n % 2), 0.04, 0.16, 0.1); pluck(c, 12, 0.035, 0.26, 0.2); },
    dome: (c, n) => { for (let i = 0; i < 4; i++) glass(c, 10 + ((n + i * 2) % 5), 0.03, 0.5, i * 0.07); },
    bell: (c, n) => { for (const [ratio, peak] of [[1, 0.05], [2.01, 0.022], [2.76, 0.014]] as const) tone(c, 'sine', note(5 + (n % 3) * 2) * ratio, null, peak, 1.4); },
    fountain: (c) => { hiss(c, 'bandpass', 1500, 2600, 0.8, 0.035, 0.12, 0.7); glass(c, 13, 0.02, 0.3, 0.1); },
    bridge: (c, n) => { const up = n % 2 === 0; for (let i = 0; i < 5; i++) pluck(c, 5 + (up ? i : 4 - i), 0.045, 0.28, i * 0.075); },
    cascade: (c) => { hiss(c, 'bandpass', 2200, 900, 0.7, 0.04, 0.05, 0.5); tone(c, 'sine', note(9), note(5), 0.025, 0.2); },
    echo: (c, n) => { const a = 7 + (n % 3), b = a - 2; pluck(c, a, 0.045, 0.3); pluck(c, b, 0.045, 0.34, 0.16); pluck(c, a, 0.02, 0.3, 0.62); pluck(c, b, 0.016, 0.34, 0.78); pluck(c, a, 0.008, 0.3, 1.2); },
    boat: (c, n) => { hiss(c, 'bandpass', 2400, 1700, 2, 0.03, 0.01, 0.07); pluck(c, 7 + (n % 3), 0.035, 0.2, 0.02); },
    knitArch: (c, n) => { glass(c, 5 + (n % 5), 0.045, 0.5); glass(c, 7 + (n % 5), 0.03, 0.5, 0.09); },
    stone: (c, n) => { tone(c, 'sine', note(n % 2 ? 1 : 0), note(0) * 0.7, 0.055, 0.12, 0, 0.01); hiss(c, 'lowpass', 500, 220, 0.7, 0.03, 0.01, 0.16); },
    lily: (c, n) => { glass(c, 10 + (n % 5), 0.04, 0.55); },
    skybridge: (c, n) => { const up = n % 2 === 0; for (let i = 0; i < 6; i++) glass(c, 8 + (up ? i : 5 - i), 0.03, 0.45, i * 0.06); },
    glasshouse: (c, n) => { glass(c, 10 + (n % 3), 0.035, 0.7); glass(c, 12 + (n % 3), 0.03, 0.7, 0.05); glass(c, 14, 0.02, 0.8, 0.12); },
    lamp: (c) => { tone(c, 'sine', note(3) / 2, null, 0.045, 0.5, 0, 0.08); tone(c, 'triangle', note(3), null, 0.014, 0.5, 0, 0.08); tone(c, 'sine', note(2) / 2, null, 0.045, 0.7, 0.46, 0.08); },
    cloud: (c, n) => { hiss(c, 'lowpass', 700, 300, 0.7, 0.04, 0.05, 0.32); for (let i = 0; i < 4; i++) tone(c, 'sine', note(12 - i - (n % 3)), null, 0.018, 0.07, 0.1 + i * 0.07); },
    lantern: (c, n) => { for (let i = 0; i < 3; i++) glass(c, 9 + ((n + i) % 3) * 2, 0.03, 0.9, i * 0.14); },
    buggy: (c, n) => { tone(c, 'triangle', note(4), null, 0.045, 0.12, 0, 0.02); tone(c, 'triangle', note(n % 2 ? 5 : 4), null, 0.045, 0.2, 0.16, 0.02); },
    moored: (c, n) => { hiss(c, 'lowpass', 600, 240, 0.8, 0.035, 0.06, 0.4); glass(c, 8 + (n % 5), 0.03, 0.9, 0.05); },
  };

  return {
    swish() { if (!disposed) kidSfx('pageTurn', 0.8); },
    thup: safely(context => { hiss(context, 'lowpass', 420, 150, 0.7, 0.05, 0.012, 0.15); tone(context, 'sine', 110, 82, 0.03, 0.13, 0, 0.012); }),
    pops(count) { safely(context => { for (let i = 0; i < Math.min(4, Math.max(1, count)); i++) hiss(context, 'bandpass', 900 + i * 260, 700 + i * 260, 4, 0.028, 0.01, 0.05, 0.1 + i * 0.12); })(); },
    tick: () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastTick < 45) return; lastTick = now; ticks += 1;
      const wood = [950, 1010, 900][ticks % 3];
      safely(context => { hiss(context, 'bandpass', 2600, 1800, 6, 0.045, 0.004, 0.03); tone(context, 'triangle', wood, wood * 0.66, 0.03, 0.035, 0, 0.004); })();
    },
    lap: safely(context => { hiss(context, 'lowpass', 900, 260, 0.8, 0.05, 0.08, 0.55); }),
    chime(step) { safely(context => { glass(context, 5 + step, 0.055, 0.3); glass(context, 7 + step, 0.05, 0.46, 0.11); })(); },
    bump: safely(context => { tone(context, 'sine', 196, 131, 0.055, 0.24); hiss(context, 'lowpass', 500, 200, 0.7, 0.03, 0.01, 0.3); }),
    gust: safely(context => { hiss(context, 'bandpass', 380, 900, 0.9, 0.035, 0.35, 1.1); }),
    rumble: safely(context => { hiss(context, 'lowpass', 160, 70, 0.7, 0.05, 0.45, 1.8); tone(context, 'sine', 65.4, 49, 0.03, 1.6, 0, 0.3); }),
    bell: safely(context => {
      // A small quay bell: a few inharmonic partials over G, a long soft decay.
      for (const [ratio, peak] of [[1, 0.055], [2.01, 0.028], [2.76, 0.02], [5.4, 0.008]] as const) tone(context, 'sine', 392 * ratio, null, peak, 2.4);
    }),
    lamp(index) { safely(context => { glass(context, 10 + index, 0.035, 0.5); })(); },
    poke(step) { safely(context => { hiss(context, 'bandpass', 1800, 1300, 2, 0.02, 0.01, 0.05); tone(context, 'sine', note(5 + step), null, 0.026, 0.18); })(); },
    toy(kind, turn) { safely(context => TOYS[kind]?.(context, Math.max(0, Math.round(turn))))(); },
    home: safely(context => {
      for (let i = 0; i < 6; i++) pluck(context, [5, 7, 8, 9, 10, 12][i], 0.045, 0.4, i * 0.13);
      for (const [step, peak] of [[5, 0.04], [7, 0.035], [8, 0.035], [10, 0.03]] as const) tone(context, 'sine', note(step), null, peak, 1.8, 1.5, 0.05);
    }),
    close: safely(context => { hiss(context, 'lowpass', 360, 120, 0.7, 0.055, 0.02, 0.22, 0.55); tone(context, 'sine', 98, 73, 0.035, 0.2, 0.55, 0.015); pluck(context, 8, 0.04, 0.5, 0.7); pluck(context, 5, 0.045, 0.9, 0.9); }),
    rain(level) {
      const amount = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
      if (amount <= 0.02) { rainVoice?.voice.stop(); rainVoice = null; return; }
      const context = ready(); if (!context) { rainVoice?.voice.stop(); rainVoice = null; return; }
      try {
        if (rainVoice) { rainVoice.gain.gain.setTargetAtTime(0.02 * amount, context.currentTime, 0.4); return; }
        const source = context.createBufferSource(); source.buffer = noiseBuffer(context); source.loop = true;
        const high = context.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 900;
        const soft = context.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 5200;
        const gain = context.createGain(); gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.setTargetAtTime(0.02 * amount, context.currentTime, 0.6);
        source.connect(high); high.connect(soft); soft.connect(gain); gain.connect(context.destination);
        source.start();
        let done = false;
        const voice: Voice = { stop() { if (done) return; done = true; voices.delete(voice); try { source.stop(); } catch { /* stopped */ } for (const node of [source, high, soft, gain]) { try { node.disconnect(); } catch { /* released */ } } } };
        voices.add(voice); rainVoice = { gain, voice };
      } catch { rainVoice = null; }
    },
    stopAll,
    dispose() { if (disposed) return; stopAll(); disposed = true; unhush(); },
  };
}
