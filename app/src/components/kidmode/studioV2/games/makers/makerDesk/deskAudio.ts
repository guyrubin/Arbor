import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** The Maker Desk's small sounds, synthesised on Arbor's one kid audio bus:
 * the child's Sound switch, the hidden-tab hush and leaving Kid Mode all
 * silence them. No files, no network. Sound is always an extra: play never
 * waits for a tone, and every call returns false when nothing sounded.
 *
 * One scale for the whole activity, C major pentatonic (C D E G A), so any
 * two sounds that overlap are consonant. Every note has a soft attack
 * (15 to 30 ms), a conservative peak (0.02 to 0.08; chords stay under 0.2
 * in sum) and a few cents of detune, so repeats never sound identical. */
export interface DeskAudio {
  /** A soft key click (terminal typing, desktop icons). */
  key(): boolean;
  /** The ball meets a wall, or the paddle (`lean` is -1 to 1 across it). */
  tok(high?: boolean, lean?: number): boolean;
  /** A lantern lights: each one a step higher on the ladder. */
  chime(step: number): boolean;
  /** A whole row of lanterns glows: a three-note chord, higher each row. */
  chord(row: number): boolean;
  /** The ball sinks into the cloud and floats back. */
  boop(): boolean;
  /** The screen wakes. */
  power(): boolean;
  /** The terminal's `beep`. */
  beep(): boolean;
  /** The terminal does not know a word: one low, soft note. */
  hm(): boolean;
  /** All lanterns, or all three stickers. */
  fanfare(): boolean;
  /** One note of the scale, by step: tools, music pads, the show steps. */
  note(step: number, soft?: boolean): boolean;
  /** A short rising run: the show steps say hello, a sticker is won. */
  run(count: number, from?: number): boolean;
  /** Water drops on the flower; `bloom` adds the opening chord. */
  drops(bloom?: boolean): boolean;
  /** Chock: a low, soft double huff. Aya: two quick high chirps. */
  woof(): boolean;
  chirp(): boolean;
  /** The lamp's switch. The windows frosting. The ProofLens shutter. */
  click(): boolean;
  glass(up: boolean): boolean;
  /** The terminal sings; the magic word. */
  song(): boolean;
  magic(): boolean;
  /** The finish: an arpeggio that opens into a held chord. */
  finale(): boolean;
  /** The very quiet hum, while the child is inside the screen. */
  hum(on: boolean): void;
  stop(): void;
  dispose(): void;
}

/** C D E G A from middle C, climbing by octaves. */
const SCALE = [261.63, 293.66, 329.63, 392, 440];
export const scaleHz = (step: number) => { const s = Math.max(0, Math.trunc(Number.isFinite(step) ? step : 0)); return SCALE[s % SCALE.length] * 2 ** Math.floor(s / SCALE.length); };
/** Fifteen lanterns climb three octaves of the scale, from middle C. */
export const chimeHz = (step: number) => scaleHz(Math.min(14, Math.max(0, Math.trunc(step))));

export function createDeskAudio(): DeskAudio {
  const sources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  let disposed = false, epoch = 0;
  let humNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  const release = (source: AudioScheduledSourceNode) => {
    for (const node of sources.get(source) ?? []) { try { node.disconnect(); } catch { /* Already released. */ } }
    try { source.disconnect(); } catch { /* Already released. */ }
    sources.delete(source);
  };
  const stopHum = () => {
    const nodes = humNodes; humNodes = null;
    if (!nodes) return;
    for (const osc of nodes.osc) { try { osc.stop(); } catch { /* Ended. */ } try { osc.disconnect(); } catch { /* Released. */ } }
    try { nodes.gain.disconnect(); } catch { /* Released. */ }
  };
  const stop = () => {
    epoch++;
    for (const source of [...sources.keys()]) { try { source.stop(); } catch { /* An ended source must still disconnect. */ } release(source); }
    stopHum();
  };
  const unhush = onKidHush(stop);
  const context = (): AudioContext | null => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext(); if (!ac) return null;
    const current = epoch;
    void ac.resume?.().catch(() => { if (current === epoch) stop(); });
    return ac;
  };
  /** A few cents either way, so the same note never sounds twice the same. */
  const near = (hz: number) => hz * (1 + (Math.random() - 0.5) * 0.012);
  /** One enveloped oscillator note: soft attack, exponential fall. */
  const tone = (ac: AudioContext, type: OscillatorType, from: number, to: number | null, at: number, length: number, level: number, attack = 0.015) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    sources.set(osc, [gain]);
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.8);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + Math.min(attack, length * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain); gain.connect(ac.destination);
    osc.onended = () => release(osc);
    osc.start(at); osc.stop(at + length + 0.03);
  };
  /** A bell: the note and a quiet octave above it. */
  const bell = (ac: AudioContext, hz: number, at: number, length: number, level: number) => {
    tone(ac, 'triangle', near(hz), null, at, length, level, 0.018); tone(ac, 'sine', hz * 2, null, at + 0.008, length * 0.7, level * 0.3, 0.02);
  };
  const play = (draw: (ac: AudioContext, now: number) => void) => {
    try { const ac = context(); if (!ac) return false; draw(ac, ac.currentTime); return true; } catch { stop(); return false; }
  };
  return {
    key: () => play((ac, t) => tone(ac, 'triangle', 2100 + Math.random() * 500, 900, t, 0.03, 0.016, 0.004)),
    tok: (high = false, lean = 0) => play((ac, t) => {
      // The wall is a soft high E or G; the paddle a G or A below, brighter toward its ends.
      const hz = high ? scaleHz(Math.random() < 0.5 ? 7 : 8) : scaleHz(Math.abs(lean) > 0.5 ? 4 : 3) * 0.5 * (1 + Math.abs(lean) * 0.02);
      tone(ac, 'triangle', near(hz), hz * 0.82, t, high ? 0.06 : 0.09, high ? 0.04 : 0.065, 0.006);
    }),
    chime: step => play((ac, t) => bell(ac, chimeHz(step), t, 0.46, 0.07)),
    chord: row => play((ac, t) => { const base = Math.max(0, Math.min(2, Math.trunc(row))) * 5; [0, 2, 3].forEach((step, i) => bell(ac, scaleHz(base + step), t + 0.05 + i * 0.045, 0.9, 0.045)); }),
    boop: () => play((ac, t) => { tone(ac, 'sine', 329.63, 196, t, 0.22, 0.07, 0.02); tone(ac, 'sine', 261.63, 392, t + 0.24, 0.3, 0.06, 0.03); }),
    power: () => play((ac, t) => { tone(ac, 'sine', 130.81, 523.25, t, 0.5, 0.045, 0.05); bell(ac, 783.99, t + 0.42, 0.5, 0.05); bell(ac, 1046.5, t + 0.56, 0.7, 0.045); }),
    beep: () => play((ac, t) => { tone(ac, 'triangle', 880, null, t, 0.12, 0.05, 0.01); tone(ac, 'triangle', 659.25, null, t + 0.16, 0.16, 0.05, 0.01); }),
    hm: () => play((ac, t) => tone(ac, 'sine', 329.63, 261.63, t, 0.26, 0.045, 0.03)),
    fanfare: () => play((ac, t) => { [5, 7, 8, 10].forEach((step, i) => bell(ac, scaleHz(step), t + i * 0.12, 0.4 + (i === 3 ? 0.5 : 0), 0.06)); }),
    note: (step, soft = false) => play((ac, t) => bell(ac, scaleHz(step), t, soft ? 0.3 : 0.5, soft ? 0.04 : 0.065)),
    run: (count, from = 5) => play((ac, t) => { for (let i = 0; i < Math.max(1, Math.min(6, Math.trunc(count))); i++) bell(ac, scaleHz(from + i), t + i * 0.09, 0.34, 0.045); }),
    drops: (bloom = false) => play((ac, t) => {
      [12, 14, 13].forEach((step, i) => tone(ac, 'sine', near(scaleHz(step)), scaleHz(step) * 0.7, t + 0.25 + i * 0.13, 0.09, 0.035, 0.008));
      if (bloom) [5, 7, 8].forEach((step, i) => bell(ac, scaleHz(step), t + 0.75 + i * 0.07, 0.9, 0.045));
    }),
    woof: () => play((ac, t) => { tone(ac, 'triangle', 196, 130.81, t, 0.13, 0.06, 0.02); tone(ac, 'triangle', 220, 146.83, t + 0.19, 0.16, 0.055, 0.02); }),
    chirp: () => play((ac, t) => { tone(ac, 'sine', 1568, 2093, t, 0.08, 0.03, 0.012); tone(ac, 'sine', 1760, 2637, t + 0.12, 0.1, 0.03, 0.012); }),
    click: () => play((ac, t) => { tone(ac, 'triangle', 1318.5, 880, t, 0.035, 0.03, 0.004); tone(ac, 'triangle', 880, 659.25, t + 0.06, 0.04, 0.025, 0.004); }),
    glass: up => play((ac, t) => { const steps = up ? [10, 12, 14] : [14, 12, 10]; steps.forEach((step, i) => tone(ac, 'sine', near(scaleHz(step)), null, t + i * 0.06, 0.4, 0.028, 0.03)); }),
    song: () => play((ac, t) => { [5, 7, 8, 7, 9, 8, 5].forEach((step, i) => bell(ac, scaleHz(step), t + i * 0.19, i === 6 ? 0.7 : 0.26, 0.055)); }),
    magic: () => play((ac, t) => { [5, 7, 8, 10, 12, 13, 15].forEach((step, i) => bell(ac, scaleHz(step), t + i * 0.07, 0.6, 0.035)); }),
    finale: () => play((ac, t) => {
      [5, 7, 8, 10, 12].forEach((step, i) => bell(ac, scaleHz(step), t + i * 0.13, 0.42, 0.05));
      [5, 7, 8, 10].forEach(step => tone(ac, 'triangle', scaleHz(step), null, t + 0.85, 1.5, 0.038, 0.03));
    }),
    hum(on) {
      if (!on) { stopHum(); return; }
      if (humNodes) return;
      try {
        const ac = context(); if (!ac) return;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.0001, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.003, ac.currentTime + 0.8);
        // A low C and the G above it: the hum belongs to the scale too.
        const osc = [65.41, 98.2].map(hz => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.connect(gain); o.start(); return o; });
        gain.connect(ac.destination);
        humNodes = { osc, gain };
      } catch { stopHum(); }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
