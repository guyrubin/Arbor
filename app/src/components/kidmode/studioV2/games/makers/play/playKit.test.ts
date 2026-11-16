/** The makers' play kit, its pure parts: the camera's arithmetic, seeded
 * variety, the particle rules, the scale, and the synth's promise to be
 * silent whenever Arbor's audio seams say so. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const seams = vi.hoisted(() => ({ allowed: true, context: null as unknown, hush: [] as (() => void)[] }));
vi.mock('../../../../audio/kidAudio', () => ({
  kidAudioAllowed: () => seams.allowed, kidAudioContext: () => seams.context,
  onKidHush: (fn: () => void) => { seams.hush.push(fn); return () => { seams.hush = seams.hush.filter(f => f !== fn); }; },
}));
import { CAMERA_HOME, cameraTransform, clamp, lerp, pick, seededRandom, shuffled, spring, springFor } from './playJuice';
import { FX_BURST_MAX, FX_MAX, FX_PLANS, fxSpawn, fxStep, type FxKind } from './playFxMath';
import { PLAY_AMBIENCE, PLAY_BED_PEAK, PLAY_PEAK, PLAY_ROOTS, PLAY_STEPS, chainStep, createPlaySound, playNote, type PlayKey } from './playSound';
import { COACH_HEADS, coachHead } from './PlayHud';
import * as kit from './index';

describe('play kit: the camera', () => {
  it('home shows the whole stage, untouched', () => {
    expect(cameraTransform(undefined)).toEqual({ x: 0, y: 0, scale: 1 });
    expect(cameraTransform(CAMERA_HOME)).toEqual({ x: 0, y: 0, scale: 1 });
    // With no zoom there is nowhere to pan: a focus off-centre changes nothing.
    expect(cameraTransform({ x: 0.9, y: 0.1, zoom: 1 })).toEqual({ x: 0, y: 0, scale: 1 });
  });
  it('a zoom brings the focus point toward the centre and never shows past the world’s edge', () => {
    const mid = cameraTransform({ x: 0.5, y: 0.5, zoom: 1.5 });
    expect(mid).toEqual({ x: 0, y: 0, scale: 1.5 });
    const right = cameraTransform({ x: 0.7, y: 0.5, zoom: 2 });
    expect(right.x).toBeLessThan(0); expect(right.y).toBe(0);
    for (const zoom of [1.2, 1.5, 2, 3]) for (const x of [0, 0.25, 0.5, 0.75, 1]) for (const y of [0, 0.5, 1]) {
      const t = cameraTransform({ x, y, zoom });
      // The scaled world may slide by half of its overhang, and no further.
      expect(Math.abs(t.x)).toBeLessThanOrEqual((zoom - 1) * 50 + 1e-9); expect(Math.abs(t.y)).toBeLessThanOrEqual((zoom - 1) * 50 + 1e-9);
    }
    expect(cameraTransform({ x: 0.5, y: 0.5, zoom: 9 }).scale).toBe(3); expect(cameraTransform({ x: 0.5, y: 0.5, zoom: 0.2 }).scale).toBe(1);
  });
});

describe('play kit: seeded variety and small sums', () => {
  it('the same seed always lays a round out the same way; another seed, another way', () => {
    const a = seededRandom(42), b = seededRandom(42), c = seededRandom(43);
    const run = (r: () => number) => Array.from({ length: 12 }, r);
    const first = run(a);
    expect(run(b)).toEqual(first); expect(run(c)).not.toEqual(first);
    for (const v of first) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    expect(new Set(first).size).toBeGreaterThan(10);
  });
  it('picks and shuffles without touching the list', () => {
    const list = ['a', 'b', 'c', 'd', 'e'] as const, r = seededRandom(7);
    const mixed = shuffled(r, list);
    expect([...mixed].sort()).toEqual([...list]); expect(list).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(list).toContain(pick(seededRandom(3), list)); expect(pick(() => 0.9999, list)).toBe('e'); expect(pick(() => 0, list)).toBe('a');
    expect(clamp(5, 0, 3)).toBe(3); expect(clamp(-1, 0, 3)).toBe(0); expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
  it('one family of springs, and a cut when motion is reduced', () => {
    for (const name of ['pop', 'land', 'settle', 'snap', 'camera', 'drift'] as const) { expect(spring[name].type).toBe('spring'); expect(springFor(name, false)).toBe(spring[name]); expect(springFor(name, true)).toBe(spring.cut); }
    expect(spring.cut.duration).toBeLessThanOrEqual(0.15);
  });
});

describe('play kit: particles', () => {
  const kinds = Object.keys(FX_PLANS) as FxKind[];
  it('knows the eight kinds the brief names', () => {
    expect(kinds.sort()).toEqual(['chip', 'confetti', 'drop', 'dust', 'glint', 'petal', 'ring', 'sparkle']);
  });
  it('a burst is capped, starts where it was asked and wears only the tones it was given', () => {
    for (const kind of kinds) {
      const born = fxSpawn(0.3, 0.6, kind, { seed: 5, tones: ['gold-light', 'white'], count: 500 });
      expect(born.length).toBeLessThanOrEqual(FX_BURST_MAX); expect(born.length).toBeGreaterThan(0);
      for (const p of born) { expect(p.x).toBe(0.3); expect(p.y).toBe(0.6); expect(['gold-light', 'white']).toContain(p.tone); expect(p.life).toBeGreaterThan(0); expect(p.size).toBeGreaterThan(0); }
    }
    expect(FX_BURST_MAX).toBeLessThan(FX_MAX);
    // The same seed, the same burst.
    expect(fxSpawn(0.5, 0.5, 'sparkle', { seed: 9 })).toEqual(fxSpawn(0.5, 0.5, 'sparkle', { seed: 9 }));
    // Without tones a kind wears its own, by palette token name: never a colour literal.
    for (const kind of kinds) for (const t of FX_PLANS[kind].tones) expect(t).toMatch(/^[a-z][a-z-]*$/);
  });
  it('an aimed burst leaves in the direction it was aimed', () => {
    const right = fxSpawn(0.5, 0.5, 'drop', { seed: 2, angle: 0, arc: 20 }), down = fxSpawn(0.5, 0.5, 'drop', { seed: 2, angle: 90, arc: 20 });
    for (const p of right) expect(p.vx).toBeGreaterThan(Math.abs(p.vy));
    for (const p of down) expect(p.vy).toBeGreaterThan(Math.abs(p.vx));
  });
  it('a trail is one or two small particles; under reduced motion a burst is one still flash and a trail is nothing', () => {
    expect(fxSpawn(0.5, 0.5, 'sparkle', { seed: 1, trail: true }).length).toBeLessThanOrEqual(2);
    const still = fxSpawn(0.5, 0.5, 'confetti', { seed: 1, reduced: true });
    expect(still).toHaveLength(1); expect(still[0].vx).toBe(0); expect(still[0].vy).toBe(0); expect(still[0].gravity).toBe(0);
    expect(fxSpawn(0.5, 0.5, 'sparkle', { reduced: true, trail: true })).toEqual([]);
  });
  it('particles move, age and are gone when their life is spent', () => {
    let live = fxSpawn(0.5, 0.5, 'chip', { seed: 4 });
    const start = live.length, first = live[0];
    live = fxStep(live, 0.016);
    expect(live).toHaveLength(start); expect(live[0].age).toBeCloseTo(0.016, 6); expect(live[0].x).not.toBe(first.x);
    // Gravity: chips fall.
    expect(live[0].vy).toBeGreaterThan(first.vy);
    for (let i = 0; i < 400; i++) live = fxStep(live, 0.016);
    expect(live).toEqual([]);
    // A long frame is clamped: nothing teleports.
    const jump = fxStep(fxSpawn(0.5, 0.5, 'sparkle', { seed: 4 }), 5);
    for (const p of jump) { expect(Math.abs(p.x - 0.5)).toBeLessThan(0.2); expect(Math.abs(p.y - 0.5)).toBeLessThan(0.2); }
  });
});

describe('play kit: the scale', () => {
  it('each key is a major pentatonic from its root, five steps to the octave, clamped to four octaves', () => {
    for (const key of Object.keys(PLAY_ROOTS) as PlayKey[]) {
      expect(playNote(key, 0)).toBeCloseTo(PLAY_ROOTS[key], 6); expect(playNote(key, 5)).toBeCloseTo(PLAY_ROOTS[key] * 2, 6);
      for (let s = 1; s < PLAY_STEPS; s++) expect(playNote(key, s)).toBeGreaterThan(playNote(key, s - 1));
      // A fifth above the root is three steps up.
      expect(playNote(key, 3) / playNote(key, 0)).toBeCloseTo(2 ** (7 / 12), 6);
      expect(playNote(key, 999)).toBe(playNote(key, PLAY_STEPS - 1)); expect(playNote(key, -3)).toBe(playNote(key, 0)); expect(playNote(key, NaN)).toBe(playNote(key, 0));
    }
    expect(Object.keys(PLAY_ROOTS).sort()).toEqual(['A', 'C', 'D', 'F', 'G']);
  });
  it('a chain of successes climbs and stays inside the scale', () => {
    expect(chainStep(undefined)).toBe(5); expect(chainStep(0)).toBe(5); expect(chainStep(3)).toBe(8);
    for (let n = 0; n < 40; n++) { expect(chainStep(n)).toBeGreaterThanOrEqual(5); expect(chainStep(n)).toBeLessThan(PLAY_STEPS); }
    expect(PLAY_PEAK).toBeLessThanOrEqual(0.08); expect(PLAY_BED_PEAK).toBeLessThan(PLAY_PEAK / 3);
  });
  it('names the six places a bed can be, as constants a game can pass without quoting them', () => {
    // (Written as one phrase: a quoted single word that is also an icon name would trip the icon-font guard, here as anywhere.)
    expect(Object.keys(PLAY_AMBIENCE).sort().join(' ')).toBe('garden hall night room water wind');
    for (const [name, value] of Object.entries(PLAY_AMBIENCE)) expect(value).toBe(name);
  });
});

/** A counting stand-in for the Web Audio graph. */
function fakeContext() {
  const made = { sources: [] as { started: number; stopped: number; loop?: boolean; onended?: () => void }[], peaks: [] as number[] };
  const param = (loud = false) => ({ setValueAtTime() {}, exponentialRampToValueAtTime(v: number) { if (loud) made.peaks.push(v); }, value: 0 });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(true), frequency: param(), Q: param(), type: '' });
  const source = () => { const s = { ...node(), started: 0, stopped: 0, loop: false, buffer: null as unknown, onended: undefined as undefined | (() => void), start() { s.started++; }, stop() { s.stopped++; } }; made.sources.push(s); return s; };
  return { made, context: { currentTime: 0, sampleRate: 8000, destination: {}, resume: () => Promise.resolve(), createOscillator: source, createBufferSource: source, createGain: node, createBiquadFilter: node, createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length), sampleRate: 8000 }) } };
}
describe('play kit: the synth keeps Arbor’s audio promises', () => {
  beforeEach(() => { seams.allowed = true; seams.hush = []; seams.context = null; });
  afterEach(() => { vi.restoreAllMocks(); });
  it('is silent, and says so, when sound is off or there is no audio', () => {
    const sound = createPlaySound({ key: 'D' });
    for (const play of [sound.tap, sound.pick, sound.back, sound.chapter, sound.setPiece]) expect(play()).toBe(false);
    expect(sound.place(2)).toBe(false); expect(sound.ambience(PLAY_AMBIENCE.garden)).toBe(false); expect(sound.note(3)).toBe(false);
    const { context } = fakeContext(); seams.context = context; seams.allowed = false;
    expect(sound.tap()).toBe(false); expect(sound.ambience(PLAY_AMBIENCE.water)).toBe(false);
    sound.dispose();
  });
  it('plays every voice softly: no peak above the kit’s ceiling', () => {
    const { made, context } = fakeContext(); seams.context = context;
    const sound = createPlaySound({ key: 'G' });
    expect(sound.tap()).toBe(true); expect(sound.pick()).toBe(true); expect(sound.back()).toBe(true); expect(sound.chapter()).toBe(true); expect(sound.setPiece()).toBe(true);
    for (let step = 0; step < 14; step++) expect(sound.place(step)).toBe(true);
    expect(sound.note(4, { gain: 5 })).toBe(true); expect(sound.breath({ gain: 5 })).toBe(true);
    expect(made.sources.length).toBeGreaterThan(20);
    expect(Math.max(...made.peaks)).toBeLessThanOrEqual(PLAY_PEAK + 1e-9);
    sound.dispose();
  });
  it('the bed is one quiet loop per place; a hush stops everything and the next sound brings the bed back', () => {
    const { made, context } = fakeContext(); seams.context = context;
    const sound = createPlaySound({ key: 'C' });
    expect(sound.ambience(PLAY_AMBIENCE.room)).toBe(true);
    const bed = made.sources.length;
    expect(made.sources.some(s => s.loop)).toBe(true);
    // Asking again for the same place adds nothing.
    sound.ambience(PLAY_AMBIENCE.room); expect(made.sources).toHaveLength(bed);
    sound.tap();
    expect(seams.hush).toHaveLength(1); seams.hush[0]();
    expect(made.sources.every(s => s.stopped >= 1)).toBe(true);
    const after = made.sources.length;
    sound.tap();
    // The tick, and the bed with it.
    expect(made.sources.length).toBeGreaterThan(after + 2); expect(made.sources.slice(after).some(s => s.loop)).toBe(true);
    // stop() is the game's own: the bed is forgotten, not paused.
    sound.stop(); const quiet = made.sources.length; sound.tap();
    expect(made.sources.slice(quiet).some(s => s.loop)).toBe(false);
    sound.dispose();
  });
  it('dispose stops every voice, lets go of the hush seam and plays nothing afterwards', () => {
    const { made, context } = fakeContext(); seams.context = context;
    const sound = createPlaySound({ key: 'F' });
    sound.ambience(PLAY_AMBIENCE.wind); sound.chapter();
    sound.dispose(); sound.dispose();
    expect(made.sources.every(s => s.stopped >= 1)).toBe(true); expect(seams.hush).toHaveLength(0);
    const count = made.sources.length;
    expect(sound.tap()).toBe(false); expect(sound.ambience(PLAY_AMBIENCE.night)).toBe(false); expect(made.sources).toHaveLength(count);
  });
});

describe('play kit: the coach’s heads and the public surface', () => {
  const art = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../../public/visuals/studio-v2/makers');
  it('every mood of every host resolves to a shared kit head that ships, with its small twin', () => {
    for (const who of Object.keys(COACH_HEADS) as (keyof typeof COACH_HEADS)[]) for (const mood of ['idle', 'happy', 'curious', 'wow'] as const) {
      const stem = coachHead(who, mood);
      expect(stem.startsWith(`kit-${who}-`), stem).toBe(true);
      expect(existsSync(path.join(art, `${stem}.webp`)), stem).toBe(true); expect(existsSync(path.join(art, `${stem}-480.webp`)), `${stem}-480`).toBe(true);
    }
  });
  it('exports everything the Game Cut brief promises', () => {
    for (const name of ['PlayStage', 'PlayFx', 'HudCoach', 'HudQuest', 'HudDock', 'HudButton', 'HudChip', 'HudToast', 'PlayOpening', 'PlaySetPiece', 'useShake', 'usePointerParallax', 'useReducedMotion', 'hitPause', 'spring', 'createPlaySound'])
      expect(kit, name).toHaveProperty(name);
  });
});
