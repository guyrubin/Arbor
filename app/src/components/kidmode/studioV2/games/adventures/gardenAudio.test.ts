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
