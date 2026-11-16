import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';
import { foundNotes, nextStep, scaleNote } from './mammothPlayRules';

/** The mammoth's sounds, synthesised on Arbor's one kid audio bus (so the
 * child's Sound switch, a hidden tab and leaving Kid Mode silence them). No
 * files, no network. Sound is always an extra: nothing in the game waits for it.
 *
 * One scale for everything pitched: D major pentatonic (D E F♯ A B, from D3),
 * so a chime, a knock, a snort and the call can overlap and stay consonant.
 * Repeats never sound identical: every pitched toy steps to a different note
 * of the scale each time, and each note is detuned a few cents at random.
 * Attacks are soft (8 ms or longer), peaks are conservative (the loudest
 * single voice, the call, peaks at 0.07 of full scale) and the two beds (wind,
 * the rumble) stay at a whisper: wind 0.006..0.03, rumble at most 0.05. */
export interface MammothSound {
  /** Starts the wind and rumble beds; call inside a gesture. False when sound is off or unavailable. */
  start(): boolean;
  /** Wind strength 0..1, followed smoothly. */
  wind(level: number): void;
  /** Stroke speed 0..1; the rustle fades by itself when strokes stop. */
  rustle(level: number): void;
  /** How content the mammoth is, 0..1: a low rumble, like a purr. */
  rumble(level: number): void;
  /** Snow brushed off, or a secret found again: one soft bell, never the same note twice running. */
  chime(): void;
  /** A finger (or the trunk tip) on the glass. */
  glass(): void;
  /** A tusk, tapped: ivory, like a wood block. */
  knock(): void;
  /** A heavy foot on the floor. */
  thump(): void;
  /** A happy breath out of the trunk: tickled, booped, pleased. */
  snort(): void;
  /** Grass between big teeth. */
  crunch(): void;
  /** A friend says hello: two quick notes; `high` for the small dog. */
  hello(high: boolean): void;
  /** The n-th discovery (0..4): two rising notes, each find a step higher. */
  found(index: number): void;
  /** The ProofLens takes its photo: a soft two-part click. */
  shutter(): void;
  /** The mammoth's call. `far` is the herd answering from the steppe: quieter, duller, later. */
  trumpet(far?: boolean, delay?: number): boolean;
  stop(): void;
  dispose(): void;
}

export function createMammothSound(random: () => number = Math.random): MammothSound {
  let context: AudioContext | null = null;
  let windGain: GainNode | null = null, windFilter: BiquadFilterNode | null = null, rustleGain: GainNode | null = null, rumbleGain: GainNode | null = null;
  const beds: AudioNode[] = [];
  const bedSources: AudioScheduledSourceNode[] = [];
  /** Short voices clean themselves up when they end; `stop` ends the ones still sounding. */
  const voices = new Map<AudioScheduledSourceNode, AudioNode[]>();
  let disposed = false, lastChime = -1, lastKnock = -1, lastSnort = -1;

  const release = (source: AudioScheduledSourceNode) => {
    const chain = voices.get(source); voices.delete(source);
    try { source.disconnect(); } catch { /* already released */ }
    for (const node of chain ?? []) { try { node.disconnect(); } catch { /* already released */ } }
  };
  const stop = () => {
    for (const source of [...voices.keys()]) { try { source.stop(); } catch { /* already stopped */ } release(source); }
    for (const source of bedSources.splice(0)) { try { source.stop(); } catch { /* already stopped */ } }
    for (const node of beds.splice(0)) { try { node.disconnect(); } catch { /* already released */ } }
    windGain = null; windFilter = null; rustleGain = null; rumbleGain = null; context = null;
  };
  const unhush = onKidHush(stop);
  const noise = (ac: AudioContext, seconds: number) => {
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const data = buffer.getChannelData(0);
    // Brownish noise: softer than white, closer to moving air.
    let last = 0;
    for (let i = 0; i < data.length; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.2; }
    const source = ac.createBufferSource(); source.buffer = buffer; source.loop = true;
    return source;
  };
  const ready = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext();
    if (!ac) return null;
    void ac.resume?.().catch(() => stop());
    return ac;
  };
  const cents = () => (random() - 0.5) * 14;
  /** One enveloped oscillator: soft attack, exponential fall. */
  const tone = (ac: AudioContext, at: number, hz: number, peak: number, attack: number, fall: number, kind: OscillatorType = 'sine', glideTo?: number, lowpass?: number) => {
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.type = kind; osc.frequency.setValueAtTime(hz, at); osc.detune.setValueAtTime(cents(), at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + attack + fall * 0.7);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + Math.max(0.008, attack));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + fall);
    const chain: AudioNode[] = [gain];
    if (lowpass) { const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(lowpass, at); osc.connect(filter); filter.connect(gain); chain.push(filter); } else osc.connect(gain);
    gain.connect(ac.destination);
    voices.set(osc, chain); osc.onended = () => release(osc);
    osc.start(at); osc.stop(at + attack + fall + 0.05);
  };
  /** A short breath of filtered noise. */
  const hiss = (ac: AudioContext, at: number, centre: number, q: number, peak: number, attack: number, fall: number) => {
    const source = noise(ac, 0.6), band = ac.createBiquadFilter(), gain = ac.createGain();
    source.loop = false;
    band.type = 'bandpass'; band.frequency.setValueAtTime(centre, at); band.Q.setValueAtTime(q, at);
    gain.gain.setValueAtTime(0.0001, at); gain.gain.linearRampToValueAtTime(peak, at + Math.max(0.008, attack)); gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + fall);
    source.connect(band); band.connect(gain); gain.connect(ac.destination);
    voices.set(source, [band, gain]); source.onended = () => release(source);
    source.start(at); source.stop(at + attack + fall + 0.05);
  };
  const safely = (play: (ac: AudioContext, now: number) => void) => {
    try { const ac = ready(); if (!ac) return false; play(ac, ac.currentTime + 0.005); return true; } catch { return false; }
  };

  return {
    start() {
      if (context) return true;
      try {
        const ac = ready(); if (!ac) return false;
        context = ac;
        const now = ac.currentTime;
        const air = noise(ac, 3);
        windFilter = ac.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.setValueAtTime(420, now); windFilter.Q.setValueAtTime(0.6, now);
        const soften = ac.createBiquadFilter(); soften.type = 'lowpass'; soften.frequency.setValueAtTime(1300, now);
        windGain = ac.createGain(); windGain.gain.setValueAtTime(0.0001, now); windGain.gain.linearRampToValueAtTime(0.014, now + 1.2);
        air.connect(windFilter); windFilter.connect(soften); soften.connect(windGain); windGain.connect(ac.destination);
        const brush = noise(ac, 2);
        const high = ac.createBiquadFilter(); high.type = 'highpass'; high.frequency.setValueAtTime(1600, now);
        const band = ac.createBiquadFilter(); band.type = 'bandpass'; band.frequency.setValueAtTime(3400, now); band.Q.setValueAtTime(0.7, now);
        rustleGain = ac.createGain(); rustleGain.gain.setValueAtTime(0.0001, now);
        brush.connect(high); high.connect(band); band.connect(rustleGain); rustleGain.connect(ac.destination);
        // The rumble: the scale's root two octaves down (D1 is felt more than heard) with its
        // octave and fifth above for small speakers, beating slowly like a purr.
        rumbleGain = ac.createGain(); rumbleGain.gain.setValueAtTime(0.0001, now);
        const purr = ac.createGain(); purr.gain.setValueAtTime(0.72, now);
        const beat = ac.createOscillator(); beat.frequency.setValueAtTime(17, now);
        const depth = ac.createGain(); depth.gain.setValueAtTime(0.28, now);
        beat.connect(depth); depth.connect(purr.gain);
        const tame = ac.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.setValueAtTime(420, now);
        const partials = ([[scaleNote(-5), 1], [scaleNote(0), 0.5], [scaleNote(3), 0.16]] as const).map(([hz, level]) => {
          const osc = ac.createOscillator(), mix = ac.createGain();
          osc.type = 'triangle'; osc.frequency.setValueAtTime(hz, now); mix.gain.setValueAtTime(level, now);
          osc.connect(mix); mix.connect(purr);
          beds.push(mix);
          return osc;
        });
        purr.connect(tame); tame.connect(rumbleGain); rumbleGain.connect(ac.destination);
        air.start(now); brush.start(now, 0.7); beat.start(now); for (const osc of partials) osc.start(now);
        bedSources.push(air, brush, beat, ...partials);
        beds.push(air, windFilter, soften, windGain, brush, high, band, rustleGain, rumbleGain, purr, beat, depth, tame, ...partials);
        return true;
      } catch { stop(); return false; }
    },
    wind(level) {
      if (!context || !windGain || !windFilter) return;
      const now = context.currentTime, on = kidAudioAllowed();
      const k = Math.max(0, Math.min(1, level));
      windGain.gain.setTargetAtTime(on ? 0.006 + 0.024 * k : 0.0001, now, 0.4);
      windFilter.frequency.setTargetAtTime(320 + 620 * k, now, 0.5);
    },
    rustle(level) {
      if (!context || !rustleGain) return;
      const now = context.currentTime, on = kidAudioAllowed();
      const k = Math.max(0, Math.min(1, level));
      rustleGain.gain.cancelScheduledValues(now);
      rustleGain.gain.setTargetAtTime(on ? 0.045 * k : 0.0001, now, 0.03);
      rustleGain.gain.setTargetAtTime(0.0001, now + 0.12, 0.16);
    },
    rumble(level) {
      if (!context || !rumbleGain) return;
      const k = Math.max(0, Math.min(1, level));
      rumbleGain.gain.setTargetAtTime(kidAudioAllowed() ? 0.0001 + 0.05 * k : 0.0001, context.currentTime, 0.35);
    },
    chime() {
      lastChime = nextStep(lastChime, 10, 16, random);
      safely((ac, now) => {
        const hz = scaleNote(lastChime);
        tone(ac, now, hz, 0.04, 0.01, 0.7);
        tone(ac, now, hz * 2, 0.012, 0.012, 0.4);
      });
    },
    glass() {
      lastChime = nextStep(lastChime, 12, 17, random);
      safely((ac, now) => {
        tone(ac, now, scaleNote(lastChime), 0.035, 0.008, 0.28, 'triangle');
        hiss(ac, now, 2400, 1.4, 0.018, 0.008, 0.06);
      });
    },
    knock() {
      lastKnock = nextStep(lastKnock, 5, 9, random);
      safely((ac, now) => {
        tone(ac, now, scaleNote(lastKnock), 0.06, 0.008, 0.13, 'triangle');
        tone(ac, now, scaleNote(lastKnock + 5) * 1.5, 0.014, 0.008, 0.06);
      });
    },
    thump() {
      safely((ac, now) => {
        tone(ac, now, scaleNote(-2), 0.075, 0.012, 0.24, 'sine', scaleNote(-5));
        hiss(ac, now, 240, 0.8, 0.03, 0.012, 0.16);
      });
    },
    snort() {
      lastSnort = nextStep(lastSnort, 2, 5, random);
      safely((ac, now) => {
        hiss(ac, now, 700, 1.1, 0.04, 0.02, 0.22);
        tone(ac, now, scaleNote(lastSnort), 0.035, 0.03, 0.26, 'triangle', scaleNote(lastSnort + 2), 900);
      });
    },
    crunch() {
      safely((ac, now) => {
        hiss(ac, now, 1500 + random() * 500, 2.2, 0.03, 0.008, 0.07);
        hiss(ac, now + 0.07, 1100 + random() * 400, 2.2, 0.022, 0.008, 0.06);
      });
    },
    hello(high) {
      const base = high ? 11 : 6;
      safely((ac, now) => {
        tone(ac, now, scaleNote(base), 0.04, 0.012, 0.14, 'triangle');
        tone(ac, now + 0.12, scaleNote(base + 2), 0.04, 0.012, 0.2, 'triangle');
      });
    },
    found(index) {
      const [first, second] = foundNotes(index);
      safely((ac, now) => {
        tone(ac, now, scaleNote(first), 0.05, 0.012, 0.42, 'triangle');
        tone(ac, now + 0.14, scaleNote(second), 0.05, 0.012, 0.7, 'triangle');
        tone(ac, now + 0.14, scaleNote(second + 5), 0.012, 0.02, 0.5);
      });
    },
    shutter() {
      safely((ac, now) => {
        hiss(ac, now, 3200, 2.4, 0.03, 0.008, 0.035);
        hiss(ac, now + 0.09, 2100, 2, 0.026, 0.008, 0.06);
        tone(ac, now + 0.09, scaleNote(13), 0.018, 0.01, 0.3);
      });
    },
    trumpet(far = false, delay = 0) {
      try {
        const ac = ready(); if (!ac) return false;
        const now = ac.currentTime + 0.02 + Math.max(0, delay), length = far ? 1.2 : 1.9, end = now + length, peak = far ? 0.022 : 0.07;
        const out = ac.createGain();
        out.gain.setValueAtTime(0.0001, now);
        out.gain.linearRampToValueAtTime(peak, now + 0.16);
        out.gain.setValueAtTime(peak, now + length * 0.64);
        out.gain.exponentialRampToValueAtTime(0.0001, end);
        // A warm, round brass: two detuned saws, gently filtered, with a slow vibrato.
        // It rises an octave through the scale (A3 → A4), leans on F♯4 and falls to D4.
        const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.setValueAtTime(far ? 1 : 3, now);
        filter.frequency.setValueAtTime(far ? 520 : 700, now); filter.frequency.linearRampToValueAtTime(far ? 800 : 1500, now + 0.35); filter.frequency.linearRampToValueAtTime(far ? 600 : 1000, end);
        const vibrato = ac.createOscillator(); vibrato.frequency.setValueAtTime(5.2, now);
        const depth = ac.createGain(); depth.gain.setValueAtTime(0, now); depth.gain.linearRampToValueAtTime(6, now + 0.6);
        vibrato.connect(depth);
        // The herd answers with its own turn of the same scale, so call and answer never clash.
        const contour = far ? (random() < 0.5 ? [2, 7, 5, 3] : [0, 5, 3, 2]) : [3, 8, 7, 5];
        const saws = [-7, 7].map(detune => {
          const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.detune.setValueAtTime(detune, now);
          osc.frequency.setValueAtTime(scaleNote(contour[0]), now);
          osc.frequency.exponentialRampToValueAtTime(scaleNote(contour[1]), now + 0.32);
          osc.frequency.exponentialRampToValueAtTime(scaleNote(contour[2]), now + length * 0.58);
          osc.frequency.exponentialRampToValueAtTime(scaleNote(contour[3]), end);
          depth.connect(osc.frequency); osc.connect(filter);
          return osc;
        });
        filter.connect(out); out.connect(ac.destination);
        const all = [...saws, vibrato];
        all.forEach((osc, i) => { voices.set(osc, i === 0 ? [out, filter, depth] : []); osc.onended = () => release(osc); osc.start(now); osc.stop(end + 0.05); });
        return true;
      } catch { return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
