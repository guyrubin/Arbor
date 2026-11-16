import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ allowed: true, context: null as any, hush: null as null | (() => void), release: vi.fn() }));
vi.mock('../../../../audio/kidAudio', () => ({ kidAudioAllowed: () => h.allowed, kidAudioContext: () => h.context, onKidHush: (fn: () => void) => { h.hush = fn; return h.release; } }));
import { MEND_PEAK, MEND_ROOT, MEND_STEPS, createBowlSounds, mendNote, type BowlSounds } from './mendBowlAudio';

interface Ramp { value: number; at: number }
interface Voice { kind: 'osc' | 'noise'; start: number; freqs: number[]; gain: Ramp[]; stopped: boolean; disconnected: boolean }
function fakeContext() {
  const voices: Voice[] = [];
  const param = (list: Ramp[] | number[], numeric = false) => ({
    setValueAtTime: (value: number, at: number) => { numeric ? (list as number[]).push(value) : (list as Ramp[]).push({ value, at }); },
    exponentialRampToValueAtTime: (value: number, at: number) => { numeric ? (list as number[]).push(value) : (list as Ramp[]).push({ value, at }); },
  });
  /** A source and the gain it is connected to share one record, joined at connect(). */
  const source = (kind: Voice['kind']) => {
    const voice: Voice = { kind, start: -1, freqs: [], gain: [], stopped: false, disconnected: false }; voices.push(voice);
    const node: any = { type: '', frequency: param(voice.freqs, true), voice, connect: (to: any) => { if (to.adopt) to.adopt(voice); }, disconnect: () => { voice.disconnected = true; }, start: (at: number) => { voice.start = at; }, stop: (at?: number) => { if (at === undefined) voice.stopped = true; }, onended: null as null | (() => void) };
    return node;
  };
  h.context = { currentTime: 2, sampleRate: 8000, destination: {}, resume: vi.fn(async () => {}),
    createOscillator: () => source('osc'), createBufferSource: () => source('noise'),
    createBuffer: (_c: number, length: number) => ({ sampleRate: 8000, getChannelData: () => new Float32Array(length) }),
    createBiquadFilter: () => { let owner: Voice | null = null; return { type: '', frequency: { setValueAtTime: () => {} }, Q: { setValueAtTime: () => {} }, adopt: (v: Voice) => { owner = v; }, connect: (to: any) => { if (owner && to.adopt) to.adopt(owner); }, disconnect: () => {} }; },
    createGain: () => { let owner: Voice | null = null; const ramps: Ramp[] = []; return { gain: param(ramps), adopt: (v: Voice) => { owner = v; v.gain = ramps; }, connect: () => {}, disconnect: () => { if (owner) owner.disconnected = true; } }; },
  };
  return voices;
}
const cents = (a: number, b: number) => Math.abs(1200 * Math.log2(a / b));
/** True when a frequency is a note of the activity's scale (in any octave), give or take the small fixed detune. */
function onScale(freq: number): boolean {
  for (let step = 0; step < 5; step++) for (let octave = -2; octave <= 5; octave++) if (cents(freq, mendNote(step) * 2 ** octave) <= 8) return true;
  return false;
}
const EVERY: [string, (s: BowlSounds) => boolean][] = [
  ['press', s => s.press()], ['dish', s => s.dish(2)], ['ring', s => s.ring(3)], ['lift', s => s.lift()], ['slip', s => s.slip()], ['turn', s => s.turn(-15)],
  ['place', s => s.place(4)], ['whole', s => s.whole()], ['trace', s => s.trace(6)], ['pour', s => s.pour(900, 5)], ['seal', s => s.seal(5)], ['sing', s => s.sing()], ['glint', s => s.glint(5)],
  ['chockPat', s => s.toy('chockPat')], ['lampOn', s => s.toy('lampOn')], ['lampOff', s => s.toy('lampOff')], ['fernRustle', s => s.toy('fernRustle', 2)], ['bloomOpen', s => s.toy('bloomOpen')], ['bloomFold', s => s.toy('bloomFold')], ['goldDip', s => s.toy('goldDip', 3)],
];
beforeEach(() => { h.allowed = true; h.context = null; h.hush = null; h.release.mockReset(); });

describe('mend-bowl: one scale', () => {
  it('is D major pentatonic, five steps to the octave, clamped', () => {
    expect(mendNote(0)).toBeCloseTo(MEND_ROOT, 2); expect(mendNote(5)).toBeCloseTo(MEND_ROOT * 2, 2); expect(mendNote(3)).toBeCloseTo(440, 0);
    expect(mendNote(-4)).toBe(mendNote(0)); expect(mendNote(99)).toBe(mendNote(MEND_STEPS - 1));
    for (let s = 1; s < MEND_STEPS; s++) expect(mendNote(s)).toBeGreaterThan(mendNote(s - 1));
  });
});

describe('mend-bowl: sounds', () => {
  it.each(EVERY)('%s: every pitch is on the scale, soft in, and modest', (_name, play) => {
    const voices = fakeContext(), sounds = createBowlSounds();
    expect(play(sounds)).toBe(true);
    expect(voices.length).toBeGreaterThan(0);
    for (const v of voices) {
      expect(v.start).toBeGreaterThanOrEqual(2);
      if (v.kind === 'osc') for (const f of v.freqs) expect(onScale(f), `${f.toFixed(1)} Hz`).toBe(true);
      const peak = Math.max(...v.gain.map(r => r.value)), first = v.gain[0], top = v.gain.find(r => r.value === peak)!;
      expect(peak).toBeLessThanOrEqual(MEND_PEAK + 1e-9);
      // Starts from silence and takes at least 8 ms to reach its peak: nothing clicks, nothing startles.
      expect(first.value).toBeLessThanOrEqual(0.0002); expect(top.at - first.at).toBeGreaterThanOrEqual(0.008 - 1e-9);
      expect(v.gain[v.gain.length - 1].value).toBeLessThanOrEqual(0.0002);
    }
    sounds.dispose();
  });
  it('the busiest moments stay well under full scale even if every voice peaked together', () => {
    for (const [name, play] of EVERY) {
      const voices = fakeContext(), sounds = createBowlSounds(); play(sounds);
      const sum = voices.reduce((total, v) => total + Math.max(...v.gain.map(r => r.value)), 0);
      expect(sum, name).toBeLessThan(0.2); sounds.dispose();
    }
  });
  it('a repeated sound is never identical: its pitch drifts a few cents', () => {
    const voices = fakeContext(), sounds = createBowlSounds();
    const notes = () => voices.filter(v => v.kind === 'osc').map(v => v.freqs[0]);
    sounds.place(1); const first = notes()[0]; voices.length = 0; sounds.place(1); const second = notes()[0];
    expect(second).not.toBe(first); expect(cents(first, second)).toBeLessThan(12); sounds.dispose();
  });
  it('gold rises: each seam starts higher than the last, and tracing climbs with the finger', () => {
    const voices = fakeContext(), sounds = createBowlSounds();
    sounds.pour(900, 0); const low = Math.min(...voices.filter(v => v.kind === 'osc').map(v => v.freqs[0])); voices.length = 0;
    sounds.pour(900, 3); const high = Math.min(...voices.filter(v => v.kind === 'osc').map(v => v.freqs[0]));
    expect(high).toBeGreaterThan(low);
    voices.length = 0; sounds.trace(1); const a = voices[0].freqs[0]; voices.length = 0; sounds.trace(5); expect(voices[0].freqs[0]).toBeGreaterThan(a);
    sounds.dispose();
  });
  it('makes no sound while the child has sound off, or with no audio at all', () => {
    const voices = fakeContext(); h.allowed = false; const quiet = createBowlSounds();
    for (const [, play] of EVERY) expect(play(quiet)).toBe(false);
    expect(voices).toHaveLength(0); quiet.dispose();
    h.allowed = true; h.context = null; const none = createBowlSounds(); expect(none.sing()).toBe(false); none.dispose();
  });
  it('stops everything on hush, and on dispose releases the hush seam and stays silent', () => {
    const voices = fakeContext(), sounds = createBowlSounds();
    sounds.sing(); sounds.pour(900, 1); expect(voices.every(v => !v.stopped)).toBe(true);
    h.hush?.(); expect(voices.every(v => v.stopped && v.disconnected)).toBe(true);
    sounds.dispose(); expect(h.release).toHaveBeenCalledOnce();
    const before = voices.length; expect(sounds.place(1)).toBe(false); expect(voices).toHaveLength(before);
  });
});
