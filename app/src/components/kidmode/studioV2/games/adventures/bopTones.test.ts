import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ allowed: true, context: null as any, hush: null as null | (() => void), release: vi.fn() }));
vi.mock('../../../audio/kidAudio', () => ({ kidAudioAllowed: () => h.allowed, kidAudioContext: () => h.context, onKidHush: (fn: () => void) => { h.hush = fn; return h.release; } }));
import { BOP_SCALE, createBopTones } from './bopTones';
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
describe('Bop tones follow the child audio lifecycle', () => {
  it('makes no sound while muted, hidden or outside the active child audio scope', () => {
    fakeContext(); h.allowed = false; const tones = createBopTones();
    expect(tones.play(0)).toBe(false); expect(h.context.createOscillator).not.toHaveBeenCalled(); tones.dispose();
  });
  it('fails quietly when audio is unavailable', () => { const tones = createBopTones(); expect(tones.play(1)).toBe(false); tones.dispose(); });
  it('plays each step of the scale at its own pitch, now', () => {
    const sources = fakeContext(); const tones = createBopTones();
    BOP_SCALE.forEach((_, step) => expect(tones.play(step)).toBe(true));
    expect(sources.map(source => source.frequency.setValueAtTime.mock.calls[0])).toEqual(BOP_SCALE.map(freq => [freq, 3]));
    tones.dispose();
  });
  it('rejects a step outside the scale before allocating audio nodes', () => {
    fakeContext(); const tones = createBopTones();
    for (const step of [-1, BOP_SCALE.length, 1.5, NaN]) expect(tones.play(step)).toBe(false);
    expect(h.context.createOscillator).not.toHaveBeenCalled(); tones.dispose();
  });
  it('stops every active tone on mute or navigation and retires once on unmount', () => {
    const sources = fakeContext(); const tones = createBopTones();
    expect(tones.play(0)).toBe(true); expect(tones.play(4)).toBe(true); h.hush!();
    for (const source of sources) { expect(source.stop).toHaveBeenCalledTimes(2); expect(source.disconnect).toHaveBeenCalled(); }
    expect(tones.play(2)).toBe(true); tones.dispose(); tones.dispose();
    expect(tones.play(0)).toBe(false); expect(h.release).toHaveBeenCalledOnce();
  });
});
