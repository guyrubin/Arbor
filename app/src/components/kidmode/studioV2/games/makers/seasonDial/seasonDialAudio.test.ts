/** The Weather Maker's one audio graph, on a fake AudioContext: levels come
 * from the year alone, reversals never stack sound, and everything is
 * released on stop, hush and dispose. Real audibility is a rendered check. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ allowed: true, hush: [] as (() => void)[], ctx: null as unknown }));
vi.mock('../../../../audio/kidAudio', () => ({
  kidAudioAllowed: () => h.allowed,
  kidAudioContext: () => h.ctx,
  onKidHush: (fn: () => void) => { h.hush.push(fn); return () => { h.hush = h.hush.filter(f => f !== fn); }; },
}));
import { LAP_TUNES, LAYER_PEAK, ONE_SHOT_PEAK, SCALE_HZ, SEASON_DEGREE, createSeasonAudio, scaleNote, TOYS } from './seasonDialAudio';
import { gains } from './seasonDialRules';

type Param = { value: number; target: number | null; peak: number; setValueAtTime: (v: number) => void; setTargetAtTime: (v: number) => void; exponentialRampToValueAtTime: (v: number) => void };
type Node = { kind: string; gain?: Param; frequency?: Param; Q?: Param; type?: string; connected: unknown[]; disconnected: boolean; started: boolean; stopped: boolean; connect: (n: unknown) => void; disconnect: () => void; start: () => void; stop: () => void; onended: null | (() => void); buffer?: unknown; loop?: boolean };
function fakeContext() {
  const made: Node[] = [];
  const param = (): Param => { const p: Param = { value: 0, target: null, peak: 0, setValueAtTime: v => { p.value = v; }, setTargetAtTime: v => { p.target = v; }, exponentialRampToValueAtTime: v => { p.peak = Math.max(p.peak, v); } }; return p; };
  const node = (kind: string, extra: Partial<Node> = {}): Node => {
    const n: Node = { kind, connected: [], disconnected: false, started: false, stopped: false, onended: null,
      connect: t => { n.connected.push(t); }, disconnect: () => { n.disconnected = true; }, start: () => { n.started = true; }, stop: () => { n.stopped = true; }, ...extra };
    made.push(n); return n;
  };
  const ctx = {
    currentTime: 0, sampleRate: 800, destination: { kind: 'destination' },
    resume: () => Promise.resolve(),
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () => node('osc', { frequency: param() }),
    createBiquadFilter: () => node('filter', { frequency: param(), Q: param() }),
    createBufferSource: () => node('noise'),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
  };
  return { ctx, made };
}

let fake: ReturnType<typeof fakeContext>;
beforeEach(() => { vi.useFakeTimers(); h.allowed = true; h.hush = []; fake = fakeContext(); h.ctx = fake.ctx; });
afterEach(() => { vi.useRealTimers(); });

/** The five layer buses: the gains wired straight into the master gain. */
function buses() {
  const master = fake.made.find(n => n.kind === 'gain' && n.connected.includes(fake.ctx.destination))!;
  return fake.made.filter(n => n.kind === 'gain' && n.connected.includes(master));
}
const LAYERS = ['birds', 'insects', 'wind', 'rain', 'chimes'] as const;

describe('Weather Maker sound', () => {
  it('stays silent and builds nothing while sound is off', () => {
    h.allowed = false;
    const audio = createSeasonAudio(() => 0.5);
    expect(audio.wake()).toBe(false); expect(fake.made).toHaveLength(0); expect(audio.running()).toBe(false);
  });
  it('builds one graph once, and sets each layer from the year alone', () => {
    const audio = createSeasonAudio(() => 0.5);
    expect(audio.wake()).toBe(true);
    const count = fake.made.length;
    expect(audio.wake()).toBe(true); expect(fake.made).toHaveLength(count);
    expect(buses()).toHaveLength(5);
    for (const year of [0.36, 0.82, 0.6, 0.15]) {
      audio.setYear(year);
      const level = gains(year);
      buses().forEach((bus, i) => expect(bus.gain!.target).toBeCloseTo(level[LAYERS[i]] * LAYER_PEAK[LAYERS[i]]));
    }
    audio.dispose();
  });
  it('a fast spin back and forth leaves exactly the levels of where it stopped, with no extra sources', () => {
    const audio = createSeasonAudio(() => 0.99); audio.wake();
    const sources = fake.made.filter(n => n.kind === 'osc' || n.kind === 'noise').length;
    for (let i = 0; i < 300; i++) audio.setYear((i * 0.173) % 1);
    audio.setYear(0.82);
    expect(fake.made.filter(n => n.kind === 'osc' || n.kind === 'noise')).toHaveLength(sources);
    buses().forEach((bus, i) => expect(bus.gain!.target).toBeCloseTo(gains(0.82)[LAYERS[i]] * LAYER_PEAK[LAYERS[i]]));
    audio.dispose();
  });
  it('chirps only while birds can be heard, chimes only in winter', () => {
    const audio = createSeasonAudio(() => 0.01); audio.wake();
    const [birds, , , , chimes] = buses();
    audio.setYear(0.82); vi.advanceTimersByTime(1400);
    const into = (bus: Node) => fake.made.filter(n => n.kind === 'gain' && n.connected.includes(bus)).length;
    expect(into(birds)).toBe(0); expect(into(chimes)).toBeGreaterThan(0);
    audio.setYear(0.15); const before = into(chimes); vi.advanceTimersByTime(1400);
    expect(into(birds)).toBeGreaterThan(0); expect(into(chimes)).toBe(before);
    audio.dispose();
  });
  it('stop, a hush and dispose release every source and node', () => {
    const audio = createSeasonAudio(() => 0.5); audio.wake();
    const built = [...fake.made];
    h.hush.forEach(fn => fn());
    expect(audio.running()).toBe(false);
    for (const n of built.filter(n => n.kind === 'osc' || n.kind === 'noise')) expect(n.stopped).toBe(true);
    for (const n of built) expect(n.disconnected).toBe(true);
    // The scheduler is gone too: no new chirps after a stop.
    const made = fake.made.length; vi.advanceTimersByTime(2000); expect(fake.made).toHaveLength(made);
    // It can wake again in a later gesture, and dispose ends it for good.
    expect(audio.wake()).toBe(true); audio.dispose();
    expect(audio.running()).toBe(false); expect(h.hush).toHaveLength(0); expect(audio.wake()).toBe(false);
  });
  it('turning Sound off mid-play stops the graph at the next tick', () => {
    const audio = createSeasonAudio(() => 0.5); audio.wake();
    h.allowed = false; vi.advanceTimersByTime(300);
    expect(audio.running()).toBe(false);
    audio.dispose();
  });
  it('draws every pitched sound from one scale, so whatever overlaps is consonant', () => {
    expect(scaleNote(0)).toBeCloseTo(261.63); expect(scaleNote(5)).toBeCloseTo(523.26); expect(scaleNote(-5)).toBeCloseTo(130.815); expect(scaleNote(7)).toBeCloseTo(659.26);
    const inScale = (hz: number) => { const base = hz / 2 ** Math.floor(Math.log2(hz / SCALE_HZ[0])); return SCALE_HZ.some(n => Math.abs(base / n - 1) < 0.002); };
    for (const tune of LAP_TUNES) { expect(tune).toHaveLength(16); expect(tune[15]).toBe(5); for (const d of tune) expect(inScale(scaleNote(d))).toBe(true); }
    // The four seasons' notes are four different notes of the scale.
    expect(new Set(SEASON_DEGREE.map(d => ((d % 5) + 5) % 5)).size).toBe(4);
    const audio = createSeasonAudio(() => 0.5); audio.wake();
    const before = fake.made.length;
    audio.badge(2); audio.lapNote(3, 1); audio.fanfare();
    const voices = fake.made.slice(before).filter(n => n.kind === 'osc');
    expect(voices.length).toBeGreaterThan(8);
    // Fundamentals and their soft overtones: every fundamental is a scale note.
    expect(voices.filter(v => inScale(v.frequency!.value)).length).toBeGreaterThanOrEqual(12);
    audio.dispose();
  });
  it('every touch has a voice, none louder than a whisper, and none without the graph', () => {
    const silent = createSeasonAudio(() => 0.5);
    silent.click(1); silent.tick(); silent.badge(0); silent.lapNote(0, 0); silent.fanfare(); for (const toy of TOYS) silent.toy(toy, 0, 1);
    expect(fake.made).toHaveLength(0); // not awake: nothing is built
    const audio = createSeasonAudio(() => 0.42); audio.wake();
    const master = fake.made.find(n => n.kind === 'gain' && n.connected.includes(fake.ctx.destination))!;
    for (const toy of TOYS.filter(t => t !== 'wholeYear')) for (const mood of [0, 1, 2, 3] as const) for (const detail of [0, 1, 2, 3]) {
      const before = fake.made.length;
      audio.toy(toy, mood, detail);
      const made = fake.made.slice(before);
      expect(made.length, `${toy} ${mood}`).toBeGreaterThan(0);
      for (const g of made.filter(n => n.kind === 'gain')) { expect(g.gain!.peak).toBeGreaterThan(0); expect(g.gain!.peak).toBeLessThanOrEqual(ONE_SHOT_PEAK); expect(g.connected).toContain(master); }
      for (const src of made.filter(n => n.kind === 'osc' || n.kind === 'noise')) { expect(src.started).toBe(true); expect(src.stopped).toBe(true); } // each is scheduled to end by itself
    }
    audio.dispose();
  });
  it('a fast spin purrs: ticks closer together than a few hundredths of a second are dropped', () => {
    const audio = createSeasonAudio(() => 0.5); audio.wake();
    const before = fake.made.length;
    for (let i = 0; i < 50; i++) audio.tick();
    expect(fake.made.slice(before).filter(n => n.kind === 'osc')).toHaveLength(1);
    (fake.ctx as { currentTime: number }).currentTime = 0.05; audio.tick();
    expect(fake.made.slice(before).filter(n => n.kind === 'osc')).toHaveLength(2);
    // The season's click carries its own note under the knock.
    const at = fake.made.length; audio.click(3);
    expect(fake.made.slice(at).filter(n => n.kind === 'osc').some(o => Math.abs(o.frequency!.value - scaleNote(SEASON_DEGREE[3])) < 0.01)).toBe(true);
    audio.dispose();
  });
  it('the toys’ sounds are released with everything else when the sound is turned off', () => {
    const audio = createSeasonAudio(() => 0.5); audio.wake();
    audio.toy('appleTree', 1, 3); audio.fanfare();
    h.allowed = false;
    const made = fake.made.length;
    audio.toy('sunDisc', 1); audio.tick(); audio.click(0);
    expect(fake.made).toHaveLength(made); // nothing new once sound is off
    vi.advanceTimersByTime(300); expect(audio.running()).toBe(false);
    audio.dispose();
  });
});
