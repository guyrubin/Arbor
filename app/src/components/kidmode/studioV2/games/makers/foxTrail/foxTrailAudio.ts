import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Pep's Trail in sound: small local synthesis on Arbor's one kid audio bus,
 * so the child's Sound switch, a hidden tab and leaving Kid Mode silence it.
 * No file, no network. Sound is always an extra: play never waits for it.
 *
 * Everything pitched is drawn from one scale (D major pentatonic: D E F♯ A B),
 * so sounds that overlap are consonant. Attacks are soft (6 ms or more), a
 * repeated sound never comes back at exactly the same pitch or brightness,
 * single voices peak at or under 0.08 and the two looping beds under 0.05,
 * and one master gain (0.8) carries it all to the bus. */
export interface FoxSounds {
  footfall(wet: boolean, soft: number): void;
  hop(): void;
  land(wet: boolean): void;
  roll(): void;
  shake(): void;
  /** A turn-round skid, and the happy shake after the pool. */
  skid(): void;
  dry(): void;
  /** A springy pad: higher with every bounce in a row. */
  bounce(count: number): void;
  /** A singing stepping tile (0, 1, 2), a knit flower opening, a tap on the path. */
  tile(index: number): void;
  flower(index: number): void;
  tick(): void;
  /** A friend answering a tap: Aya is a high pair, Chock a low one. */
  friend(low: boolean): void;
  /** The fallen star waking; a petal going home (0, 1, 2); the last celebration. */
  starlet(): void;
  petalHome(index: number): void;
  finale(): void;
  chime(index: number): void;
  hum(): void;
  wake(): void;
  cricket(): void;
  /** Called every frame: the grass swish and the stream babble follow these levels (0..1). */
  beds(swish: number, stream: number, night: boolean): void;
  stop(): void;
  dispose(): void;
}

/** D major pentatonic from D4: petals chime up it, the pads and tiles play it, the Dome's chord is built on it. */
const NOTES = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98, 1760];
const note = (i: number) => NOTES[Math.max(0, Math.min(NOTES.length - 1, Math.round(i)))];
/** A few cents either way, so the same sound twice is never quite the same. */
const vary = (cents = 9) => 2 ** ((Math.random() * 2 - 1) * cents / 1200);

export function createFoxSounds(): FoxSounds {
  const live = new Set<AudioScheduledSourceNode>();
  let disposed = false, noise: AudioBuffer | null = null, noiseFor: AudioContext | null = null;
  let master: GainNode | null = null, masterFor: AudioContext | null = null, lastFlower = -1;
  const out = (ac: AudioContext): AudioNode => {
    if (master && masterFor === ac) return master;
    try { master?.disconnect(); } catch { /* released */ }
    master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination); masterFor = ac;
    return master;
  };
  let swish: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  let brook: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; lfo: OscillatorNode } | null = null;

  const ctx = (): AudioContext | null => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext();
    if (!ac) return null;
    void ac.resume?.().catch(() => undefined);
    return ac;
  };
  const noiseBuffer = (ac: AudioContext) => {
    if (noise && noiseFor === ac) return noise;
    const length = Math.floor(ac.sampleRate * 1.5);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown-ish noise: soft and woody rather than hissy (a fixed LCG, not Math.random, so it is the same each time).
    let seed = 1234567, last = 0;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const white = seed / 0x7fffffff * 2 - 1;
      last = (last + 0.06 * white) / 1.06;
      data[i] = last * 3.2 + white * 0.12;
    }
    noise = buffer; noiseFor = ac;
    return buffer;
  };
  const track = (node: AudioScheduledSourceNode, ...chain: AudioNode[]) => {
    live.add(node);
    node.onended = () => { live.delete(node); for (const n of [node, ...chain]) { try { n.disconnect(); } catch { /* released */ } } };
  };
  /** A short filtered noise burst: footfalls, splashes, the roll's whoosh. */
  const burst = (type: BiquadFilterType, from: number, to: number, length: number, level: number, q = 1, delay = 0) => {
    try {
      const ac = ctx(); if (!ac) return;
      const when = ac.currentTime + delay;
      const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac);
      const filter = ac.createBiquadFilter(); filter.type = type; filter.Q.value = q;
      const v = vary(140); filter.frequency.setValueAtTime(from * v, when); filter.frequency.exponentialRampToValueAtTime(Math.max(40, to * v), when + length);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(level, when + Math.max(0.006, Math.min(0.02, length / 4))); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
      src.connect(filter); filter.connect(gain); gain.connect(out(ac));
      track(src, filter, gain);
      src.start(when, Math.random() * 1.2); src.stop(when + length + 0.05);
    } catch { /* sound is an extra */ }
  };
  const tone = (freq: number, type: OscillatorType, when: number, attack: number, length: number, level: number, ac: AudioContext, glide?: number) => {
    const osc = ac.createOscillator(); osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, when + length);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(level, when + attack); gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(gain); gain.connect(out(ac));
    track(osc, gain);
    osc.start(when); osc.stop(when + length + 0.05);
  };
  /** One or more notes, guarded: sound never throws into play. */
  const play = (fn: (ac: AudioContext, t: number) => void) => { try { const ac = ctx(); if (ac) fn(ac, ac.currentTime); } catch { /* sound is an extra */ } };
  const bed = (ac: AudioContext, type: BiquadFilterType, freq: number, q: number) => {
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
    const filter = ac.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ac.createGain(); gain.gain.value = 0.0001;
    src.connect(filter); filter.connect(gain); gain.connect(out(ac));
    track(src, filter, gain);
    src.start();
    return { src, filter, gain };
  };
  const stopBeds = () => {
    for (const b of [swish, brook]) {
      if (!b) continue;
      try { b.src.stop(); } catch { /* ended */ }
      if ('lfo' in b) { try { (b as { lfo: OscillatorNode }).lfo.stop(); } catch { /* ended */ } }
    }
    swish = null; brook = null;
  };
  const stop = () => {
    stopBeds();
    for (const node of [...live]) { try { node.stop(); } catch { /* ended */ } try { node.disconnect(); } catch { /* released */ } }
    live.clear();
    try { master?.disconnect(); } catch { /* released */ }
    master = null; masterFor = null;
  };
  const unhush = onKidHush(stop);

  return {
    footfall(wet, soft) {
      if (wet) burst('bandpass', 1800, 700, 0.16, 0.05 * soft, 1.2);
      else burst('lowpass', 520, 160, 0.09, 0.07 * soft, 0.8);
    },
    hop() { burst('bandpass', 900, 2400, 0.14, 0.03, 0.9); play((ac, t) => tone(note(3) * vary(), 'sine', t, 0.012, 0.16, 0.022, ac, note(5))); },
    skid() { burst('bandpass', 1500, 500, 0.2, 0.04, 1.1); },
    dry() { for (let i = 0; i < 5; i++) burst('bandpass', 2600 + i * 220, 1500, 0.09, 0.03, 1.3, i * 0.055); play((ac, t) => { tone(note(8) * vary(), 'sine', t + 0.1, 0.01, 0.2, 0.02, ac); tone(note(10) * vary(), 'sine', t + 0.2, 0.01, 0.28, 0.02, ac); }); },
    bounce(count) {
      // A soft "boing": a sine that dips and springs back, a step up the scale for each bounce in a row.
      play((ac, t) => { const f = note(Math.min(7, count - 1)) * vary(6); tone(f * 0.82, 'sine', t, 0.008, 0.34, 0.07, ac, f * 1.06); tone(f * 2, 'triangle', t + 0.01, 0.01, 0.16, 0.014, ac); });
      burst('lowpass', 380, 140, 0.1, 0.05, 0.7);
    },
    tile(index) { play((ac, t) => { const f = note([5, 7, 8][index % 3]) * vary(5); tone(f, 'triangle', t, 0.008, 0.7, 0.05, ac); tone(f * 2, 'sine', t + 0.012, 0.01, 0.5, 0.016, ac); }); },
    flower(index) {
      // Neighbouring flowers never repeat a note: each opens on the next step of the scale.
      lastFlower = (index === lastFlower ? index + 1 : index); const i = 5 + (((lastFlower * 3) % 7) + 7) % 7;
      play((ac, t) => { tone(note(i) * vary(), 'sine', t, 0.02, 0.5, 0.03, ac); tone(note(i + 2) * vary(), 'sine', t + 0.07, 0.02, 0.5, 0.02, ac); });
    },
    tick() { play((ac, t) => tone(note(8) * vary(20), 'sine', t, 0.006, 0.09, 0.02, ac)); },
    friend(low) { play((ac, t) => { const base = low ? 0 : 7; tone(note(base) * vary(), low ? 'triangle' : 'sine', t, 0.02, 0.32, low ? 0.05 : 0.035, ac, note(base + 2)); tone(note(base + 3) * vary(), low ? 'triangle' : 'sine', t + 0.16, 0.02, 0.4, low ? 0.045 : 0.03, ac); }); },
    starlet() { play((ac, t) => { [8, 10, 12, 13].forEach((n, i) => tone(note(n), 'sine', t + i * 0.11, 0.012, 1.3 - i * 0.12, 0.03, ac)); tone(note(5), 'triangle', t, 0.3, 1.6, 0.02, ac); }); },
    petalHome(index) { play((ac, t) => { const f = note([5, 7, 8][Math.max(0, Math.min(2, index))]); tone(f, 'triangle', t, 0.01, 1.1, 0.055, ac); tone(f * 2, 'sine', t + 0.02, 0.012, 0.9, 0.02, ac); }); },
    finale() { play((ac, t) => { [5, 7, 8, 9, 10, 12].forEach((n, i) => tone(note(n), 'triangle', t + i * 0.13, 0.012, 1.4, 0.04, ac)); [0, 3, 5, 7].forEach((n, i) => tone(note(n), 'sine', t + 0.8 + i * 0.03, 0.25, 2.2, 0.03, ac)); }); },
    land(wet) { if (wet) { burst('bandpass', 2200, 600, 0.3, 0.07, 1.4); burst('highpass', 3000, 2000, 0.18, 0.02, 0.7, 0.05); } else burst('lowpass', 420, 120, 0.14, 0.11, 0.7); },
    roll() { burst('bandpass', 400, 1600, 0.5, 0.05, 0.8); burst('lowpass', 300, 120, 0.4, 0.05, 0.7, 0.1); },
    shake() { for (let i = 0; i < 4; i++) burst('bandpass', 3200 - i * 300, 1800, 0.2, 0.03, 1.2, i * 0.07); },
    chime(index) {
      try {
        const ac = ctx(); if (!ac) return;
        const t = ac.currentTime, base = 5 + Math.max(0, Math.min(2, index));
        [0, 2, 4].forEach((step, i) => tone(note(base + step), 'triangle', t + i * 0.09, 0.01, 0.9, 0.055, ac));
        tone(note(base) * 2, 'sine', t + 0.27, 0.012, 1.2, 0.022, ac);
      } catch { /* sound is an extra */ }
    },
    hum() {
      try {
        const ac = ctx(); if (!ac) return;
        const t = ac.currentTime;
        tone(110, 'sine', t, 0.25, 1.5, 0.08, ac); tone(164.81, 'sine', t + 0.05, 0.3, 1.4, 0.04, ac); tone(220, 'triangle', t + 0.1, 0.35, 1.1, 0.015, ac);
      } catch { /* sound is an extra */ }
    },
    wake() {
      try {
        const ac = ctx(); if (!ac) return;
        const t = ac.currentTime;
        // A slow swelling chord (D, A, D, F♯, A, D, E) rising as the Dome's sun wakes.
        [146.83, 220, 293.66, 369.99, 440, 587.33, 659.25].forEach((f, i) => tone(f, i < 2 ? 'sine' : 'triangle', t + i * 0.22, 1.6, 6 - i * 0.2, i < 2 ? 0.06 : 0.022, ac));
        [1174.66, 1479.98, 1760].forEach((f, i) => tone(f, 'sine', t + 1.6 + i * 0.35, 0.02, 2.2, 0.018, ac));
      } catch { /* sound is an extra */ }
    },
    cricket() {
      try {
        const ac = ctx(); if (!ac) return;
        // Crickets sing on the scale too, three octaves up, at a whisper.
        const t = ac.currentTime, f = [2959.96, 3520, 3951.07, 4698.63][Math.floor(Math.random() * 4)];
        for (let i = 0; i < 3; i++) tone(f, 'sine', t + i * 0.055, 0.006, 0.04, 0.009, ac);
      } catch { /* sound is an extra */ }
    },
    beds(swishLevel, streamLevel, night) {
      const ac = ctx();
      if (!ac) { if (swish || brook) stopBeds(); return; }
      try {
        if (!swish && swishLevel > 0.02) swish = bed(ac, 'bandpass', 2600, 0.7);
        if (!brook && streamLevel > 0.02) {
          const b = bed(ac, 'bandpass', 1100, 2.2);
          const lfo = ac.createOscillator(), depth = ac.createGain();
          lfo.frequency.value = 3.1; depth.gain.value = 420;
          lfo.connect(depth); depth.connect(b.filter.frequency);
          track(lfo, depth); lfo.start();
          brook = { ...b, lfo };
        }
        const t = ac.currentTime;
        swish?.gain.gain.setTargetAtTime(0.0001 + swishLevel * 0.05, t, 0.06);
        swish?.filter.frequency.setTargetAtTime(1800 + swishLevel * 2200, t, 0.08);
        brook?.gain.gain.setTargetAtTime(0.0001 + streamLevel * (night ? 0.03 : 0.04), t, 0.25);
      } catch { stopBeds(); }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
