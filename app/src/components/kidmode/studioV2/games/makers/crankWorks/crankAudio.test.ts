import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ allowed: true, context: null as any, hush: null as null | (() => void), release: vi.fn() }));
vi.mock('../../../../audio/kidAudio', () => ({ kidAudioAllowed: () => h.allowed, kidAudioContext: () => h.context, onKidHush: (fn: () => void) => { h.hush = fn; return h.release; } }));
import { createCrankSound } from './crankAudio';
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
  it('stops every sound on hush and retires once on unmount', () => {
    const sources = fakeContext(); const sound = createCrankSound();
    sound.tick(0.2); sound.bell(); h.hush!();
    for (const source of sources) { expect(source.stop).toHaveBeenCalledTimes(2); expect(source.disconnect).toHaveBeenCalled(); }
    sound.dispose(); sound.dispose();
    expect(sound.tick(0)).toBe(false); expect(h.release).toHaveBeenCalledOnce();
  });
});
