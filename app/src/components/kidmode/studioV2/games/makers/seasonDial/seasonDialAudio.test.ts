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
import { LAYER_PEAK, createSeasonAudio } from './seasonDialAudio';
import { gains } from './seasonDialRules';

type Param = { value: number; target: number | null; setValueAtTime: (v: number) => void; setTargetAtTime: (v: number) => void; exponentialRampToValueAtTime: () => void };
type Node = { kind: string; gain?: Param; frequency?: Param; Q?: Param; type?: string; connected: unknown[]; disconnected: boolean; started: boolean; stopped: boolean; connect: (n: unknown) => void; disconnect: () => void; start: () => void; stop: () => void; onended: null | (() => void); buffer?: unknown; loop?: boolean };
function fakeContext() {
  const made: Node[] = [];
  const param = (): Param => { const p: Param = { value: 0, target: null, setValueAtTime: v => { p.value = v; }, setTargetAtTime: v => { p.target = v; }, exponentialRampToValueAtTime: () => {} }; return p; };
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
});
