import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ allowed: true, context: null as any, hush: null as null | (() => void), release: vi.fn() }));
vi.mock('../../../../audio/kidAudio', () => ({ kidAudioAllowed: () => h.allowed, kidAudioContext: () => h.context, onKidHush: (fn: () => void) => { h.hush = fn; return h.release; } }));
import { HORN_VOICINGS, RACER_SCALE, clickStep, createRacerSound, noteHz } from './windupRaceAudio';

beforeEach(() => { h.allowed = true; h.context = null; h.hush = null; h.release.mockReset(); });
function fakeContext() {
  const made = { oscillators: [] as any[], gains: [] as any[] };
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const node = (extra: object) => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), ...extra });
  h.context = { currentTime: 3, sampleRate: 8000, destination: {}, resume: vi.fn(async () => {}),
    createOscillator: vi.fn(() => { const o = node({ frequency: parameter(), type: 'sine' }); made.oscillators.push(o); return o; }),
    createGain: vi.fn(() => { const g = node({ gain: parameter(), context: h.context }); made.gains.push(g); return g; }),
    createBiquadFilter: vi.fn(() => node({ frequency: parameter(), Q: parameter(), type: 'lowpass' })),
    createBufferSource: vi.fn(() => node({ buffer: null })),
    createBuffer: vi.fn((_c: number, length: number, sampleRate: number) => ({ sampleRate, getChannelData: () => new Float32Array(length) })),
  };
  return made;
}
/** How far a pitch is from the nearest note of the scale, in cents. */
const offScale = (hz: number) => {
  const semis = 12 * Math.log2(hz / noteHz(0)), within = ((semis % 12) + 12) % 12;
  return Math.min(...[...RACER_SCALE, 12].map(s => Math.abs(within - s))) * 100;
};
const peak = (gain: any) => Math.max(...gain.gain.exponentialRampToValueAtTime.mock.calls.map((call: number[]) => call[0]), ...gain.gain.setTargetAtTime.mock.calls.map((call: number[]) => call[0]), 0);

describe('one scale for the whole toy box', () => {
  it('noteHz walks D major pentatonic, octave by octave', () => {
    expect(noteHz(0)).toBeCloseTo(293.665, 2); expect(noteHz(5)).toBeCloseTo(noteHz(0) * 2, 6); expect(noteHz(-5)).toBeCloseTo(noteHz(0) / 2, 6);
    for (let step = -10; step <= 16; step++) { expect(offScale(noteHz(step))).toBeLessThan(.001); expect(noteHz(step + 1)).toBeGreaterThan(noteHz(step)); }
    expect(noteHz(Number.NaN)).toBe(noteHz(0));
  });
  it('the ratchet climbs one step each click, twelve clicks, and stops at the top', () => {
    expect(Array.from({ length: 12 }, (_, i) => clickStep(i + 1))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(clickStep(40)).toBe(11); expect(clickStep(0)).toBe(0);
  });
  it('the horn sounds a consonant pair, never the same pair twice running', () => {
    for (const [low, high] of HORN_VOICINGS) { const ratio = noteHz(high) / noteHz(low); expect([4 / 3, 3 / 2].some(pure => Math.abs(ratio - pure) < .02)).toBe(true); }
    expect(new Set(HORN_VOICINGS.map(pair => pair.join())).size).toBe(HORN_VOICINGS.length);
  });
});

describe('the sounds follow the child audio lifecycle', () => {
  it('is silent while sound is off, hidden or unavailable', () => {
    fakeContext(); h.allowed = false; const sound = createRacerSound();
    sound.tick(3); sound.bell(); sound.horn(); sound.whirr(.6, .5); sound.fanfare();
    expect(h.context.createOscillator).not.toHaveBeenCalled(); sound.dispose();
    h.allowed = true; h.context = null; const none = createRacerSound();
    expect(() => { none.tick(1); none.horn(true); none.whirr(1, 1); }).not.toThrow(); none.dispose();
  });
  it('each click sings a higher note, close to the scale, softly', () => {
    const made = fakeContext(), sound = createRacerSound(), notes: number[] = [];
    for (let click = 1; click <= 12; click++) { const from = made.oscillators.length; sound.tick(click); notes.push(made.oscillators[from].frequency.setValueAtTime.mock.calls[0][0]); }
    for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1]);
    for (const hz of notes) expect(offScale(hz)).toBeLessThan(8); // a few cents of drift, never a wrong note
    for (const gain of made.gains) expect(peak(gain)).toBeLessThanOrEqual(.16);
    sound.dispose();
  });
  it('every voice has a soft attack and a modest peak', () => {
    const made = fakeContext(), sound = createRacerSound();
    sound.tooth(); sound.stop(); sound.crouch(); sound.sproing(); sound.knock(); sound.clack(2); sound.thump(); sound.bell(); sound.horn(true);
    sound.plink(3); sound.ring(); sound.rattle(); sound.rustle(); sound.boing(6); sound.squeak(); sound.chalk(); sound.fanfare();
    expect(made.gains.length).toBeGreaterThan(30);
    for (const gain of made.gains) {
      expect(peak(gain)).toBeLessThanOrEqual(.16);
      const [, start] = gain.gain.setValueAtTime.mock.calls[0], [, rise] = gain.gain.exponentialRampToValueAtTime.mock.calls[0];
      expect(rise - start).toBeGreaterThanOrEqual(.006 - 1e-9);
    }
    sound.dispose();
  });
  it('the whirr follows speed, stays a whisper, and stops with the car', () => {
    const made = fakeContext(), sound = createRacerSound();
    sound.whirr(.2, 1); const motorGain = made.gains[made.gains.length - 1], [slow] = made.oscillators.slice(-2);
    const first = slow.frequency.setTargetAtTime.mock.calls[0][0];
    sound.whirr(1, 0);
    expect(slow.frequency.setTargetAtTime.mock.calls[1][0]).toBeGreaterThan(first);
    for (const call of motorGain.gain.setTargetAtTime.mock.calls) expect(call[0]).toBeLessThanOrEqual(.04);
    expect(made.oscillators.length).toBe(2); // one motor, re-pitched, never a second
    sound.whirr(0, 0);
    expect(slow.stop).toHaveBeenCalled();
    sound.dispose();
  });
  it('hush and dispose stop everything and release the hush listener once', () => {
    const made = fakeContext(), sound = createRacerSound();
    sound.bell(); sound.whirr(.5, .5);
    h.hush?.();
    for (const osc of made.oscillators) expect(osc.stop).toHaveBeenCalled();
    sound.dispose(); sound.dispose();
    expect(h.release).toHaveBeenCalledTimes(1);
    const before = made.oscillators.length; sound.tick(1);
    expect(made.oscillators.length).toBe(before);
  });
});
