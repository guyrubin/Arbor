import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';
import { gains, wrapYear, type Gains } from './seasonDialRules';

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
  /** A soft click for a detent. */
  click(): void;
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

  const keep = <T extends AudioNode>(node: T): T => { nodes.push(node); return node; };
  const release = () => {
    if (timer) clearInterval(timer);
    timer = null;
    for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } }
    for (const n of nodes) { try { n.disconnect(); } catch { /* already released */ } }
    sources = []; nodes = []; bus = {}; master = null; ac = null;
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
    const pulse = context.createOscillator(); pulse.type = 'square'; pulse.frequency.value = 15; sources.push(pulse); nodes.push(pulse);
    const pulseDepth = keep(context.createGain()); pulseDepth.gain.value = 0.012;
    pulse.connect(pulseDepth); pulseDepth.connect(gate.gain);
    cricket.connect(gate); gate.connect(bus.insects!);

    const start = context.currentTime + 0.02;
    for (const s of sources) s.start(start);
    timer = setInterval(tick, 140);
    apply();
  };

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
    click() {
      if (!ac || !master || !kidAudioAllowed()) return;
      try {
        const at = ac.currentTime, osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(1500, at); osc.frequency.exponentialRampToValueAtTime(900, at + 0.03);
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.07, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        osc.connect(g); g.connect(master);
        osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch { /* released */ } };
        osc.start(at); osc.stop(at + 0.06);
      } catch { /* a click is never load-bearing */ }
    },
    running: () => !!ac,
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
