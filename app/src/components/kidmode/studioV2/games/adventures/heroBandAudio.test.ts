import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ allowed: true, context: null as any, hush: null as null | (() => void), release: vi.fn() }));
vi.mock('../../../audio/kidAudio', () => ({ kidAudioAllowed: () => h.allowed, kidAudioContext: () => h.context, onKidHush: (fn: () => void) => { h.hush = fn; return h.release; } }));
import { createBandEngine } from './heroBandAudio';
import { emptyLoop, placeMove } from './heroBandRules';

let clock = 0;
let audio: any = null;
function fakeContext() {
  const sources: any[] = [];
  const parameter = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  audio = h.context = { currentTime: 0, destination: {}, resume: vi.fn(async () => {}),
    createOscillator: vi.fn(() => { const source = { type: '', frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; }),
    createGain: vi.fn(() => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() })),
  };
  return sources;
}
/** Wall clock and audio clock advance together, as on a real device. */
function advance(ms: number, audioRuns = true) { for (let t = 0; t < ms; t += 25) { clock += 25; if (audio && audioRuns) audio.currentTime = clock / 1000; vi.advanceTimersByTime(25); } }
beforeEach(() => { vi.useFakeTimers(); clock = 0; audio = null; h.allowed = true; h.context = null; h.hush = null; h.release.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('Hero Band beat engine', () => {
  it('plays the whole dance by sight when sound is off or unavailable', () => {
    const steps: number[] = []; const engine = createBandEngine(() => clock);
    expect(engine.hit(0)).toBe(false);
    expect(engine.start({ tempo: 500, loop: () => placeMove(emptyLoop(), 1, 2), onStep: step => steps.push(step) })).toBe(false);
    expect(steps).toEqual([0]); advance(4100);
    expect(steps).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]); expect(engine.audible()).toBe(false);
    engine.dispose(); advance(1000); expect(steps).toHaveLength(9);
  });
  it('never makes a sound while the child has sound off', () => {
    fakeContext(); h.allowed = false; const engine = createBandEngine(() => clock);
    expect(engine.hit(1)).toBe(false); engine.start({ tempo: 500, loop: emptyLoop, onStep: () => {} }); advance(1200);
    expect(audio.createOscillator).not.toHaveBeenCalled(); engine.dispose();
  });
  it('schedules the band and each placed move ahead on the audio clock', () => {
    const sources = fakeContext(); const engine = createBandEngine(() => clock);
    expect(engine.start({ tempo: 500, loop: () => placeMove(emptyLoop(), 1, 0), onStep: () => {} })).toBe(true);
    advance(1000);
    const starts = sources.map(source => source.start.mock.calls[0][0] as number);
    // Steps 0, 1, 2 have sounded or are queued: three band hits and one move.
    expect(sources).toHaveLength(4);
    expect(starts.filter(at => Math.abs(at - 0.53) < 0.001)).toHaveLength(2);
    expect(Math.max(...starts)).toBeCloseTo(1.03, 3);
    engine.dispose();
  });
  it('does not sound a step twice when the child just played it by hand', () => {
    const sources = fakeContext(); const quiet: boolean[] = []; const engine = createBandEngine(() => clock);
    engine.start({ tempo: 500, loop: () => placeMove(emptyLoop(), 1, 0), onStep: (_step, _absolute, q) => quiet.push(q) });
    advance(275); expect(engine.hit(0)).toBe(true); engine.played(1); advance(400);
    expect(quiet).toEqual([false, true]);
    // One hand hit plus two band hits; the loop's own copy of the move stayed silent.
    expect(sources).toHaveLength(3); engine.dispose();
  });
  it('ends a shown phrase by itself and reports it once', () => {
    const steps: number[] = []; const end = vi.fn(); const engine = createBandEngine(() => clock);
    engine.start({ tempo: 640, loop: () => [0, 1, null, null, null, null, null, null], onStep: step => steps.push(step), steps: 2, onEnd: end });
    advance(2000); expect(steps).toEqual([0, 1]); expect(end).toHaveBeenCalledOnce(); expect(engine.running()).toBe(false);
  });
  it('carries on silently by the wall clock when the audio clock never starts', () => {
    fakeContext(); const steps: number[] = []; const engine = createBandEngine(() => clock);
    expect(engine.start({ tempo: 500, loop: emptyLoop, onStep: step => steps.push(step) })).toBe(true);
    advance(1700, false); expect(steps.length).toBeGreaterThanOrEqual(3); expect(engine.audible()).toBe(false); engine.dispose();
  });
  it('stops the beat and every voice on hush, refuses a bad tempo, and retires on unmount', () => {
    const sources = fakeContext(); const steps: number[] = []; const engine = createBandEngine(() => clock);
    expect(engine.start({ tempo: 123, loop: emptyLoop, onStep: () => {} })).toBe(false); expect(engine.running()).toBe(false);
    engine.start({ tempo: 500, loop: emptyLoop, onStep: step => steps.push(step) }); advance(600); h.hush!();
    for (const source of sources) expect(source.disconnect).toHaveBeenCalled();
    const seen = steps.length; advance(1500); expect(steps).toHaveLength(seen); expect(engine.running()).toBe(false);
    engine.dispose(); expect(engine.hit(0)).toBe(false); expect(h.release).toHaveBeenCalledOnce();
  });
});
