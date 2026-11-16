import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ allowed: true, context: null as any, hush: null as null | (() => void), release: vi.fn() }));
vi.mock('../../../../audio/kidAudio', () => ({ kidAudioAllowed: () => h.allowed, kidAudioContext: () => h.context, onKidHush: (fn: () => void) => { h.hush = fn; return h.release; } }));
import { createCrankSound, degreeHz } from './crankAudio';
beforeEach(() => { h.allowed = true; h.context = null; h.hush = null; h.release.mockReset(); });
function fakeContext() {
  const sources: any[] = [];
  const parameter = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  h.context = { currentTime: 3, destination: {}, resume: vi.fn(async () => {}),
    createOscillator: vi.fn(() => { const source = { frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; }),
    createGain: vi.fn(() => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() })),
  };
  return sources;
}
describe('the machine sounds follow the child audio lifecycle', () => {
  it('is silent while sound is off, hidden or unavailable', () => {
    fakeContext(); h.allowed = false; const sound = createCrankSound();
    expect(sound.tick(0.5)).toBe(false); expect(sound.bell()).toBe(false);
    expect(h.context.createOscillator).not.toHaveBeenCalled(); sound.dispose();
    h.allowed = true; h.context = null; const quiet = createCrankSound();
    expect(quiet.tick(0)).toBe(false); quiet.dispose();
  });
  it('ticks a little higher when the machine runs faster', () => {
    const sources = fakeContext(); const sound = createCrankSound();
    expect(sound.tick(0)).toBe(true);
    h.context.currentTime = 4; expect(sound.tick(1)).toBe(true);
    const pitch = (i: number) => sources[i].frequency.setValueAtTime.mock.calls[0][0];
    expect(pitch(2)).toBeGreaterThan(pitch(0)); expect(pitch(3)).toBeGreaterThan(pitch(1));
    sound.dispose();
  });
  it('merges ticks that come too close together (a fast fling) instead of piling up', () => {
    fakeContext(); const sound = createCrankSound();
    sound.tick(1); sound.tick(1); sound.tick(1);
    expect(h.context.createOscillator).toHaveBeenCalledTimes(2);
    sound.dispose();
  });
  it('rings the bell as a few bright partials', () => {
    const sources = fakeContext(); const sound = createCrankSound();
    expect(sound.bell()).toBe(true);
    expect(sources.length).toBe(4);
    sound.dispose();
  });
  it('draws every pitched sound from one pentatonic scale', () => {
    expect(degreeHz(0)).toBeCloseTo(261.63, 2); expect(degreeHz(5)).toBeCloseTo(523.26, 1); expect(degreeHz(-5)).toBeCloseTo(130.815, 2);
    expect(degreeHz(3) / degreeHz(0)).toBeCloseTo(2 ** (7 / 12), 9); // a fifth: C to G
    for (let d = -6; d < 16; d++) expect(degreeHz(d + 1)).toBeGreaterThan(degreeHz(d));
    // Only the five notes: no semitone (a clash) between any two degrees.
    for (let d = -5; d < 15; d++) expect(degreeHz(d + 1) / degreeHz(d)).toBeGreaterThan(2 ** (1.9 / 12));
  });
  it('a hand-turned wheel plays its stops higher as the load rises', () => {
    const sources = fakeContext(); const sound = createCrankSound();
    expect(sound.step(0)).toBe(true); h.context.currentTime = 4; expect(sound.step(4)).toBe(true);
    const pitch = (i: number) => sources[i].frequency.setValueAtTime.mock.calls[0][0];
    expect(pitch(2)).toBeGreaterThan(pitch(0) * 1.5);
    // Stops that come too fast thin out instead of smearing.
    sound.step(2); sound.step(3);
    expect(sources.length).toBe(4);
    sound.dispose();
  });
  it('answers the tick at the top with a lower tock at the bottom', () => {
    const sources = fakeContext(); const sound = createCrankSound();
    sound.tick(0.5); sound.tock(0.5);
    const pitch = (i: number) => sources[i].frequency.setValueAtTime.mock.calls[0][0];
    expect(pitch(2)).toBeLessThan(pitch(0));
    sound.dispose();
  });
  it('repeats never sound quite identical, and no voice is loud or instant', () => {
    const sources = fakeContext(); const gains: any[] = [];
    const make = h.context.createGain; h.context.createGain = vi.fn(() => { const g = make(); gains.push(g); return g; });
    const sound = createCrankSound();
    for (let i = 0; i < 3; i++) { h.context.currentTime = 3 + i; sound.note(2); }
    const pitch = (i: number) => sources[i].frequency.setValueAtTime.mock.calls[0][0];
    expect(new Set([pitch(0), pitch(2), pitch(4)]).size).toBe(3);
    expect(Math.abs(pitch(2) / pitch(0) - 1)).toBeLessThan(0.012);
    for (const kind of ['earned', 'aha', 'open', 'shut', 'swap', 'finish'] as const) { h.context.currentTime += 2; expect(sound.chime(kind)).toBe(true); }
    for (const kind of ['boing', 'peek', 'woof', 'giggle', 'pod', 'ink', 'knock'] as const) { h.context.currentTime += 2; expect(sound.toy(kind)).toBe(true); h.hush!(); }
    for (const g of gains) {
      const ramps = g.gain.exponentialRampToValueAtTime.mock.calls;
      expect(ramps[0][0]).toBeLessThanOrEqual(0.07);                                   // the peak
      expect(ramps[0][1] - g.gain.setValueAtTime.mock.calls[0][1]).toBeGreaterThanOrEqual(0.004); // a soft attack
      expect(ramps[1][0]).toBeLessThan(0.001);                                        // and it dies away
    }
    sound.dispose();
  });
  it('never piles up more than a handful of voices', () => {
    const sources = fakeContext(); const sound = createCrankSound();
    for (let i = 0; i < 12; i++) { h.context.currentTime = 3 + i * 0.4; sound.chime('finish'); sound.chime('aha'); }
    expect(sources.length).toBeLessThanOrEqual(18);
    sound.dispose();
  });
  it('stops every sound on hush and retires once on unmount', () => {
    const sources = fakeContext(); const sound = createCrankSound();
    sound.tick(0.2); sound.bell(); h.hush!();
    for (const source of sources) { expect(source.stop).toHaveBeenCalledTimes(2); expect(source.disconnect).toHaveBeenCalled(); }
    sound.dispose(); sound.dispose();
    expect(sound.tick(0)).toBe(false); expect(h.release).toHaveBeenCalledOnce();
  });
});
