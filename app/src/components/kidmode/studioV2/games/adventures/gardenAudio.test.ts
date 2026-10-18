import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ allowed: true, context: null as any, hush: null as null | (() => void), release: vi.fn() }));
vi.mock('../../../audio/kidAudio', () => ({ kidAudioAllowed: () => h.allowed, kidAudioContext: () => h.context, onKidHush: (fn: () => void) => { h.hush = fn; return h.release; } }));
import { createGardenAudio } from './gardenAudio';
beforeEach(() => { h.allowed = true; h.context = null; h.hush = null; h.release.mockReset(); });
function fakeContext() {
  const sources: any[] = [];
  const parameter = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  h.context = { currentTime: 0, destination: {}, resume: vi.fn(async () => {}),
    createOscillator: vi.fn(() => { const source = { frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; }),
    createGain: vi.fn(() => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() })),
  };
  return sources;
}
describe('Rhythm Garden uses the child audio lifecycle', () => {
  it('never creates a voice while muted, hidden or outside the active child audio scope', () => {
    fakeContext(); h.allowed = false; const audio = createGardenAudio();
    expect(audio.play(0)).toBe(false); expect(h.context.createOscillator).not.toHaveBeenCalled(); audio.dispose();
  });
  it('fails quietly if audio is unavailable', () => { const audio = createGardenAudio(); expect(audio.play(1)).toBe(false); audio.dispose(); });
  it('stops every active oscillator on mute/navigation and retires on unmount', () => {
    const sources = fakeContext(); const audio = createGardenAudio();
    expect(audio.play(0)).toBe(true); expect(audio.play(2)).toBe(true); h.hush!();
    for (const source of sources) { expect(source.stop).toHaveBeenCalledTimes(2); expect(source.disconnect).toHaveBeenCalled(); }
    expect(audio.play(1)).toBe(true); audio.dispose(); expect(audio.play(0)).toBe(false); expect(h.release).toHaveBeenCalledOnce();
  });
});

describe('bounded audio-clock sequences', () => {
  it('schedules a phrase on one absolute timeline before UI timers run', () => {
    const sources = fakeContext(); h.context.currentTime = 12.5;
    const audio = createGardenAudio(); expect(audio.sequence([0, 1, 2], 760)).toBe(true);
    expect(sources.map(source => source.start.mock.calls[0][0])).toEqual([12.5, 13.26, 14.02]);
    expect(h.context.resume).toHaveBeenCalledOnce(); audio.dispose();
  });
  it('cancels future scheduled notes as well as the current note', () => {
    const sources = fakeContext(); const audio = createGardenAudio(); audio.sequence([0, 1, 2], 1000);
    audio.stop(); expect(sources.every(source => source.stop.mock.calls.length === 2)).toBe(true);
    audio.dispose(); audio.dispose(); expect(h.release).toHaveBeenCalledOnce();
  });
  it('rejects invalid phrases before allocating audio nodes', () => {
    fakeContext(); const audio = createGardenAudio();
    expect(audio.sequence([], 760)).toBe(false);
    expect(audio.sequence(Array(9).fill(0), 760)).toBe(false);
    expect(audio.sequence([3 as any], 760)).toBe(false);
    expect(audio.sequence([0], NaN)).toBe(false);
    h.allowed = false; expect(audio.sequence([0], 760)).toBe(false);
    expect(h.context.createOscillator).not.toHaveBeenCalled(); audio.dispose();
  });
});
