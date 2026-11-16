import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';
import { gains, wrapYear, type Gains, type Season } from './seasonDialRules';
import type { Toy } from './seasonDialToys';

/** The Weather Maker's sound: ONE small graph on Arbor's kid audio bus.
 * Five layers (birdsong, summer insects, autumn wind, spring rain, winter
 * chimes) each feed their own gain, and those gains are set from `year` and
 * nothing else, so turning back and forth can never stack sounds. Local
 * synthesis only: no files, no network. The child's Sound switch, a hidden
 * tab and leaving Kid Mode all silence it. */
export interface SeasonAudio {
  /** Start (inside a gesture) or keep running. False = silent (sound off or unavailable). */
  wake(): boolean;
  setYear(year: number): void;
  /** The heavy click of a season's detent, with that season's own note under it. */
  click(season?: Season): void;
  /** The fine tick of an engraved mark going under the pointer. */
  tick(): void;
  /** A season's badge lights: its note and the fifth above, like a small bell. */
  badge(season: Season): void;
  /** A toy in the scene answers a touch. `mood` picks the season's flavour (0 spring … 3 winter). */
  toy(toy: Toy, mood: Season, detail?: number): void;
  /** LeafLab reads out: three notes, each higher the fuller its gauge (0..1 each). */
  lab(moisture: number, light: number, warmth: number): void;
  /** One step of the lap's music box (0 … 15) in this year's tune. */
  lapNote(step: number, kind: number): void;
  /** The whole year done: a rising spread chord. */
  fanfare(): void;
  running(): boolean;
  stop(): void;
  dispose(): void;
}

const LAYERS = ['birds', 'insects', 'wind', 'rain', 'chimes'] as const;
type Layer = typeof LAYERS[number];
/** Peak level of each layer: all soft, under the Studio's effects. */
export const LAYER_PEAK: Readonly<Record<Layer, number>> = { birds: 0.5, insects: 0.32, wind: 0.42, rain: 0.3, chimes: 0.4 };
/** High, soft pentatonic bells for winter. */
const CHIME_NOTES = [1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
/** The one scale every pitched sound is drawn from: C major pentatonic, so
 * whatever overlaps is consonant. Degrees run upward from C4. */
export const SCALE_HZ = [261.63, 293.66, 329.63, 392, 440] as const;
export function scaleNote(degree: number): number {
  const d = Math.round(degree), n = SCALE_HZ.length, octave = Math.floor(d / n);
  return SCALE_HZ[((d % n) + n) % n] * 2 ** octave;
}
/** Each season's own note (spring E5, summer G5, autumn D5, winter C5): together, one open chord. */
export const SEASON_DEGREE = [7, 8, 6, 5] as const;
/** The lap's tune, as scale degrees, one for each year kind: sixteen steps that rise through the year and come home. */
export const LAP_TUNES = [
  [5, 7, 8, 7, 8, 9, 10, 9, 8, 10, 9, 8, 7, 6, 7, 5],
  [5, 6, 7, 8, 10, 8, 7, 8, 9, 10, 12, 10, 9, 8, 6, 5],
  [7, 5, 7, 8, 9, 8, 10, 9, 12, 10, 9, 8, 9, 7, 6, 5],
] as const;
/** No one-shot is louder than this at its peak (the master then takes it down again). */
export const ONE_SHOT_PEAK = 0.09;

export function createSeasonAudio(random: () => number = Math.random): SeasonAudio {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let bus: Partial<Record<Layer, GainNode>> = {};
  let level: Gains = gains(0);
  let year = 0;
  let sources: AudioScheduledSourceNode[] = [];
  let nodes: AudioNode[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;
  let noiseData: AudioBuffer | null = null;
  let lastTick = -1;

  const keep = <T extends AudioNode>(node: T): T => { nodes.push(node); return node; };
  const release = () => {
    if (timer) clearInterval(timer);
    timer = null;
    for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } }
    for (const n of nodes) { try { n.disconnect(); } catch { /* already released */ } }
    sources = []; nodes = []; bus = {}; master = null; ac = null; noiseData = null; lastTick = -1;
  };
  const stop = () => {
    const live = ac, m = master;
    if (live && m) {
      // A short fade, then everything is released; the shared context stays (Kid Mode owns it).
      try { m.gain.setTargetAtTime(0, live.currentTime, 0.04); } catch { /* fail quiet */ }
    }
    release();
  };
  const unhush = onKidHush(stop);

  const apply = () => {
    if (!ac) return;
    level = gains(year);
    const now = ac.currentTime;
    for (const layer of LAYERS) bus[layer]?.gain.setTargetAtTime(level[layer] * LAYER_PEAK[layer], now, 0.25);
  };

  /** One chirp: a quick rising-falling whistle, sometimes a pair. */
  const chirp = (when: number) => {
    const out = bus.birds; if (!ac || !out) return;
    const notes = random() < 0.5 ? 2 : random() < 0.5 ? 3 : 1;
    const base = 2600 + random() * 1300;
    for (let i = 0; i < notes; i++) {
      const at = when + i * (0.11 + random() * 0.05);
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * (0.9 + random() * 0.2), at);
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, at + 0.045);
      osc.frequency.exponentialRampToValueAtTime(base * 0.95, at + 0.09);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.09, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
      osc.connect(g); g.connect(out);
      osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch { /* released */ } };
      osc.start(at); osc.stop(at + 0.12);
    }
  };
  /** One bell: a sine with a soft overtone and a long tail. */
  const chime = (when: number) => {
    const out = bus.chimes; if (!ac || !out) return;
    const f = CHIME_NOTES[Math.floor(random() * CHIME_NOTES.length)];
    for (const [mult, peak] of [[1, 0.08], [2.76, 0.018]] as const) {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(f * mult, when);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 2.2);
      osc.connect(g); g.connect(out);
      osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch { /* released */ } };
      osc.start(when); osc.stop(when + 2.3);
    }
  };
  /** The scheduler: chirps and chimes only while their layer can be heard. */
  const tick = () => {
    if (!ac) return;
    if (!kidAudioAllowed()) { stop(); return; }
    const now = ac.currentTime;
    if (level.birds > 0.04 && random() < 0.16 + 0.22 * level.birds) chirp(now + random() * 0.12);
    if (level.chimes > 0.04 && random() < 0.08 + 0.1 * level.chimes) chime(now + random() * 0.15);
  };

  const build = (context: AudioContext) => {
    ac = context;
    master = keep(context.createGain());
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.setTargetAtTime(0.85, context.currentTime, 0.12);
    master.connect(context.destination);
    for (const layer of LAYERS) { const g = keep(context.createGain()); g.gain.setValueAtTime(0, context.currentTime); g.connect(master); bus[layer] = g; }

    // Noise for wind and rain: two seconds, looped.
    const length = Math.floor(context.sampleRate * 2);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i++) { const white = random() * 2 - 1; brown = (brown + 0.02 * white) / 1.02; data[i] = white * 0.35 + brown * 2.4; }
    noiseData = buffer;
    const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true; sources.push(noise); nodes.push(noise);

    // Wind: band-passed noise whose centre drifts slowly, like gusts.
    const windBand = keep(context.createBiquadFilter()); windBand.type = 'bandpass'; windBand.frequency.value = 420; windBand.Q.value = 0.9;
    const gust = context.createOscillator(); gust.frequency.value = 0.11; sources.push(gust); nodes.push(gust);
    const gustDepth = keep(context.createGain()); gustDepth.gain.value = 260;
    gust.connect(gustDepth); gustDepth.connect(windBand.frequency);
    noise.connect(windBand); windBand.connect(bus.wind!);

    // Rain: the same noise, high and airy.
    const rainHigh = keep(context.createBiquadFilter()); rainHigh.type = 'highpass'; rainHigh.frequency.value = 2200;
    const rainLow = keep(context.createBiquadFilter()); rainLow.type = 'lowpass'; rainLow.frequency.value = 7000;
    noise.connect(rainHigh); rainHigh.connect(rainLow); rainLow.connect(bus.rain!);

    // Summer: a warm low hum of insects and a far-off cricket.
    const humFilter = keep(context.createBiquadFilter()); humFilter.type = 'lowpass'; humFilter.frequency.value = 700;
    const tremolo = keep(context.createGain()); tremolo.gain.value = 0.05;
    const tremoloLfo = context.createOscillator(); tremoloLfo.frequency.value = 6.5; sources.push(tremoloLfo); nodes.push(tremoloLfo);
    const tremoloDepth = keep(context.createGain()); tremoloDepth.gain.value = 0.03;
    tremoloLfo.connect(tremoloDepth); tremoloDepth.connect(tremolo.gain);
    for (const f of [196, 198.6, 294.2]) {
      const hum = context.createOscillator(); hum.type = 'triangle'; hum.frequency.value = f; sources.push(hum); nodes.push(hum);
      hum.connect(humFilter);
    }
    humFilter.connect(tremolo); tremolo.connect(bus.insects!);
    const cricket = context.createOscillator(); cricket.type = 'sine'; cricket.frequency.value = 4300; sources.push(cricket); nodes.push(cricket);
    const gate = keep(context.createGain()); gate.gain.value = 0.012;
    const pulse = context.createOscillator(); pulse.type = 'sawtooth'; pulse.frequency.value = 15; sources.push(pulse); nodes.push(pulse);
    const pulseDepth = keep(context.createGain()); pulseDepth.gain.value = 0.012;
    pulse.connect(pulseDepth); pulseDepth.connect(gate.gain);
    cricket.connect(gate); gate.connect(bus.insects!);

    const start = context.currentTime + 0.02;
    for (const s of sources) s.start(start);
    timer = setInterval(tick, 140);
    apply();
  };

  /** One soft pitched note into the master: a gentle attack, an even decay, gone and released by itself. */
  const note = (hz: number, peak: number, seconds: number, opts: { delay?: number; shape?: OscillatorType; attack?: number; glide?: number; overtone?: number } = {}) => {
    if (!ac || !master || !kidAudioAllowed()) return;
    try {
      const at = ac.currentTime + (opts.delay ?? 0), level = Math.min(ONE_SHOT_PEAK, peak);
      const voices: (readonly [number, number])[] = opts.overtone ? [[1, level], [opts.overtone, level * 0.22]] : [[1, level]];
      for (const [mult, top] of voices) {
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = opts.shape ?? 'sine';
        osc.frequency.setValueAtTime(hz * mult, at);
        if (opts.glide) osc.frequency.exponentialRampToValueAtTime(hz * mult * opts.glide, at + seconds);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(top, at + (opts.attack ?? 0.012));
        g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
        osc.connect(g); g.connect(master);
        osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch { /* released */ } };
        osc.start(at); osc.stop(at + seconds + 0.05);
      }
    } catch { /* a toy's sound is never load-bearing */ }
  };
  /** A short breath of filtered noise: a rustle, a splash, a puff. */
  const hiss = (centre: number, peak: number, seconds: number, opts: { delay?: number; band?: BiquadFilterType; attack?: number } = {}) => {
    if (!ac || !master || !noiseData || !kidAudioAllowed()) return;
    try {
      const at = ac.currentTime + (opts.delay ?? 0);
      const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = noiseData; filter.type = opts.band ?? 'bandpass'; filter.frequency.setValueAtTime(centre, at); filter.Q.setValueAtTime(0.8, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.min(ONE_SHOT_PEAK, peak), at + (opts.attack ?? 0.03));
      g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
      src.connect(filter); filter.connect(g); g.connect(master);
      src.onended = () => { try { src.disconnect(); filter.disconnect(); g.disconnect(); } catch { /* released */ } };
      src.start(at); src.stop(at + seconds + 0.05);
    } catch { /* fail quiet */ }
  };
  /** A small pitch wander, so the same touch never sounds quite the same twice. */
  const near = (hz: number, cents = 14) => hz * 2 ** (((random() - 0.5) * 2 * cents) / 1200);
  const pick = (degrees: readonly number[]) => scaleNote(degrees[Math.floor(random() * degrees.length) % degrees.length]);

  return {
    wake() {
      if (disposed || !kidAudioAllowed()) { if (ac) stop(); return false; }
      if (ac) { void ac.resume?.().catch(() => stop()); return true; }
      try {
        const context = kidAudioContext(); if (!context) return false;
        void context.resume?.().catch(() => stop());
        build(context);
        return true;
      } catch { release(); return false; }
    },
    setYear(next) {
      year = wrapYear(next);
      try { apply(); } catch { stop(); }
    },
    click(season) {
      // The detent: a dry tick, a low wooden knock, and the season's own note ringing under them.
      note(near(1700, 30), 0.05, 0.035, { shape: 'triangle', attack: 0.003, glide: 0.55 });
      note(near(196, 20), 0.07, 0.09, { attack: 0.004, glide: 0.7 });
      if (season !== undefined) note(scaleNote(SEASON_DEGREE[season]), 0.045, 0.5, { overtone: 2, attack: 0.008 });
    },
    tick() {
      // Rate-limited: a fast spin purrs instead of buzzing.
      if (!ac) return;
      if (ac.currentTime - lastTick < 0.028) return;
      lastTick = ac.currentTime;
      note(near(2300, 60), 0.022, 0.022, { shape: 'triangle', attack: 0.002, glide: 0.7 });
    },
    badge(season) {
      const d = SEASON_DEGREE[season];
      note(scaleNote(d), 0.07, 0.9, { overtone: 2.76, attack: 0.01 });
      note(scaleNote(d + 3), 0.05, 1.1, { overtone: 2, attack: 0.012, delay: 0.11 });
      note(scaleNote(d + 5), 0.04, 1.3, { attack: 0.012, delay: 0.22 });
    },
    toy(toy, mood, detail = 0) {
      if (toy === 'appleTree') {
        // A rustle of the crown, then what comes down: plips for light things, soft thumps for apples.
        hiss(mood === 3 ? 1400 : 2600, 0.055, 0.42, { attack: 0.05 });
        for (let i = 0; i < 3; i++) note(near(pick([10, 12, 13, 15]), 10), 0.028, 0.16, { delay: 0.2 + i * (0.09 + random() * 0.06), attack: 0.006 });
        for (let i = 0; i < Math.min(3, detail); i++) note(near(98 + 12 * i, 25), 0.08, 0.14, { delay: 0.5 + i * 0.13 + random() * 0.05, attack: 0.005, glide: 0.6 });
      } else if (toy === 'terraceFloor') {
        if (detail === 0) { hiss(3200, 0.06, 0.22, { band: 'highpass', attack: 0.008 }); note(near(scaleNote(10), 20), 0.04, 0.2, { glide: 0.45, attack: 0.006 }); }
        else if (detail === 1) hiss(900, 0.06, 0.3, { band: 'lowpass', attack: 0.02 });
        else if (detail === 2) hiss(2200, 0.05, 0.34, { attack: 0.03 });
        else { note(near(pick([7, 8, 10])), 0.05, 0.4, { overtone: 2, attack: 0.02, glide: 1.06 }); note(near(pick([12, 13])), 0.03, 0.5, { delay: 0.12, attack: 0.02 }); }
      } else if (toy === 'openSky') {
        if (mood === 3) hiss(700, 0.045, 0.7, { band: 'lowpass', attack: 0.16 });
        else { hiss(1800, 0.04, 0.6, { attack: 0.18 }); note(near(pick([12, 13, 15])), 0.02, 0.5, { delay: 0.1, attack: 0.05 }); }
      } else if (toy === 'sunDisc') {
        // A warm chord that swells and goes: the scale's own bright triad.
        [5, 7, 8].forEach((d, i) => note(near(scaleNote(d), 6), 0.04, 0.95, { attack: 0.09 + i * 0.03, overtone: 2 }));
      } else if (toy === 'cloudPuff') {
        hiss(600, 0.05, 0.3, { band: 'lowpass', attack: 0.04 });
        for (let i = 0; i < 4; i++) note(near(pick([13, 15, 17, 18]), 12), 0.022, 0.09, { delay: 0.18 + i * 0.1 + random() * 0.05, attack: 0.004, glide: 0.8 });
      } else if (toy === 'perchBirds') {
        for (let i = 0; i < 4; i++) note(2700 + random() * 1200, 0.05, 0.085, { delay: i * 0.085 + random() * 0.03, attack: 0.01, glide: 1.3 });
        hiss(3000, 0.03, 0.25, { attack: 0.04 });
      } else if (toy === 'valleyFriend') {
        // Three quick steps up: a glad little hop.
        [5, 7, 8].forEach((d, i) => note(near(scaleNote(d + (mood === 2 ? 2 : 0)), 8), 0.05, 0.16, { delay: i * 0.075, shape: 'triangle', attack: 0.008 }));
      } else if (toy === 'snowFriend') {
        hiss(500, 0.06, 0.16, { band: 'lowpass', attack: 0.01 });
        note(near(pick([8, 10, 12]), 8), 0.045, 0.7, { delay: 0.05, overtone: 2.76, attack: 0.008 });
      } else if (toy === 'knotHole') {
        // Somebody in the hole: two low, round calls, a minor third apart, both in the scale.
        note(scaleNote(3), 0.06, 0.3, { attack: 0.05, glide: 0.97 });
        note(scaleNote(2), 0.06, 0.42, { delay: 0.36, attack: 0.05, glide: 0.96 });
      }
    },
    lab(moisture, light, warmth) {
      [moisture, light, warmth].forEach((v, i) => note(scaleNote(5 + i * 2 + Math.round(Math.min(1, Math.max(0, v)) * 4)), 0.05, 0.5, { delay: i * 0.13, overtone: 2, attack: 0.01 }));
    },
    lapNote(step, kind) {
      const tune = LAP_TUNES[((Math.floor(kind) % LAP_TUNES.length) + LAP_TUNES.length) % LAP_TUNES.length];
      const i = Math.floor(step);
      if (i < 0 || i >= tune.length) return;
      note(scaleNote(tune[i]), 0.06, 0.75, { overtone: 3, attack: 0.006 });
    },
    fanfare() {
      [0, 3, 5, 7, 8, 10, 12, 15].forEach((d, i) => note(scaleNote(d), 0.05, 1.5 - i * 0.08, { delay: i * 0.085, overtone: 2, attack: 0.012 }));
    },
    running: () => !!ac,
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
