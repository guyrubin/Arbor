import { describe, expect, it } from 'vitest';
import { CAM, LINKAGE, TAU, WAVE_LINK, WAVE_RODS, camAngle, camLift, pistonLift, waveLift } from './crankWorksRules';
import {
  BELL, BENCH, BOARD, CRATE_SLOT, GROUND, HORIZON, PART_KINDS, PUCK, ROD_LENGTH, S1, S2, S3, SHOTS, SOCKET, SOCKET_REACH, UNIT, WHEEL,
  anchorsAt, beadAt, easeView, frameView, handleAt, hitAt, jointAt, knobAt, pinAt, rodX, roomRect, shotFor, stemTop, toScreen, toWorld, wristAt,
  type Shot, type View,
} from './crankGeometry';

const ANGLES = Array.from({ length: 73 }, (_, i) => i / 72 * TAU);
const STAGES: readonly (readonly [number, number])[] = [[390, 768], [844, 314], [1024, 692], [1280, 724], [1920, 1004], [320, 492]];

describe('the machine stands on the bench, drawn to one scale', () => {
  it('the rod is the same length on the screen at every angle', () => {
    for (const a of ANGLES) {
      const pin = pinAt(a), wrist = wristAt(a);
      expect(Math.hypot(wrist.x - pin.x, wrist.y - pin.y)).toBeCloseTo(ROD_LENGTH, 9);
      expect(wrist.x).toBe(S1.x);
      expect(Math.hypot(pin.x - S1.x, pin.y - S1.y)).toBeCloseTo(LINKAGE.r * UNIT, 9);
    }
    expect(ROD_LENGTH).toBeCloseTo(LINKAGE.l * UNIT, 12);
  });
  it('the knob, the flower and the beads ride exactly on their slides', () => {
    for (const a of ANGLES) {
      expect(knobAt(a).y - wristAt(a).y).toBeCloseTo(knobAt(0).y - wristAt(0).y, 9);
      expect(S1.y - wristAt(a).y).toBeCloseTo(pistonLift(a) * UNIT, 9);
      expect(S2.y - stemTop(a).y - (S2.y - stemTop(0).y)).toBeCloseTo((camLift(camAngle(a)) - camLift(camAngle(0))) * UNIT, 9);
      for (let i = 0; i < WAVE_RODS; i++) { expect(beadAt(i, a).x).toBe(rodX(i)); expect(beadAt(i, 0).y - beadAt(i, a).y).toBeCloseTo((waveLift(i, a) - waveLift(i, 0)) * UNIT, 9); }
    }
  });
  it('the handle goes round with the crank pin, further out', () => {
    for (const a of ANGLES) {
      const pin = pinAt(a), grip = handleAt(a);
      expect(Math.atan2(grip.x - WHEEL.x, WHEEL.y - grip.y)).toBeCloseTo(Math.atan2(pin.x - S1.x, S1.y - pin.y), 9);
      expect(Math.hypot(grip.x - WHEEL.x, grip.y - WHEEL.y)).toBeCloseTo(WHEEL.grip, 9);
    }
    expect(WHEEL.grip).toBeLessThan(WHEEL.r); expect(WHEEL.grab).toBeGreaterThan(WHEEL.r);
  });
  it('everything stands on the board, the board on the deck, and nothing collides', () => {
    for (const shaft of [S1, S2, S3]) { expect(shaft.y).toBeLessThan(GROUND); expect(shaft.x).toBeGreaterThan(BOARD.backL); expect(shaft.x).toBeLessThan(BOARD.backR); }
    expect(GROUND).toBeGreaterThan(BOARD.back); expect(GROUND).toBeLessThan(BOARD.front);
    expect(WHEEL.y + WHEEL.r).toBeLessThan(GROUND + 1);
    // The wheel clears the cam housing, the cam housing the first bead rod, and the last rod the crate.
    expect(WHEEL.x + WHEEL.r).toBeLessThan(S2.x - 37 * UNIT);
    expect(S2.x + 37 * UNIT).toBeLessThan(rodX(0) - 20 * UNIT + 1);
    expect(rodX(WAVE_RODS - 1) + 34 * UNIT).toBeLessThan(CRATE_SLOT.flowerPart.x - 14);
    // The bead at the top of its stroke just reaches the bell's lip; at the bottom it is well clear.
    const last = WAVE_RODS - 1, topAngle = ANGLES.reduce((best, a) => (beadAt(last, a).y < beadAt(last, best).y ? a : best), 0);
    expect(beadAt(last, topAngle).y - (BELL.y + 25 * UNIT)).toBeLessThan(9 * UNIT + 1.5);
    expect(beadAt(last, topAngle).y).toBeGreaterThan(BELL.y + 20 * UNIT);
    expect(BENCH.h).toBeGreaterThan(BOARD.front);
    // The cam never lets go of its follower's housing: the stem's cup stays above the bush.
    expect((CAM.R - CAM.e) * UNIT).toBeGreaterThan(0); expect(WAVE_LINK.l - WAVE_LINK.r).toBeGreaterThan(WAVE_LINK.r);
  });
});

describe('the lens finds only what is built', () => {
  it('names the three parts of the piston at first, the cam and the small cranks once they are joined', () => {
    const parts = (flower: boolean, beads: boolean) => [...new Set(anchorsAt(1, { flower, beads }).map(a => a.part))];
    expect(parts(false, false)).toEqual(['crankArm', 'rodBar', 'pistonHead']);
    expect(parts(true, false)).toEqual(['crankArm', 'rodBar', 'pistonHead', 'camDisc', 'follower']);
    expect(parts(true, true)).toContain('smallCranks');
    expect(anchorsAt(1, { flower: true, beads: true }).filter(a => a.part === 'smallCranks').length).toBe(WAVE_RODS);
  });
  it('each anchor is on its moving part', () => {
    for (const a of ANGLES) {
      const pin = pinAt(a), wrist = wristAt(a), by = Object.fromEntries(anchorsAt(a, { flower: false, beads: false }).map(x => [x.part, x]));
      expect(by.rodBar.x).toBeCloseTo((pin.x + wrist.x) / 2, 9); expect(by.rodBar.y).toBeCloseTo((pin.y + wrist.y) / 2, 9);
      expect(Math.hypot(by.pistonHead.x - wrist.x, by.pistonHead.y - wrist.y)).toBeLessThan(10);
      expect(Math.hypot(by.crankArm.x - S1.x, by.crankArm.y - S1.y)).toBeLessThan(LINKAGE.r * UNIT);
      expect(jointAt(a)).toEqual(pin);
    }
  });
});

describe('the camera', () => {
  const corners = (shot: Shot) => { const r = SHOTS[shot]; return [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y1 }]; };
  it('shows the whole of every shot, clear of the HUD, on every stage', () => {
    for (const [w, h] of STAGES) for (const shot of Object.keys(SHOTS) as Shot[]) {
      const view = frameView(SHOTS[shot], w, h), [a, b] = corners(shot).map(p => toScreen(view, p));
      expect(a.x).toBeGreaterThanOrEqual(-0.5); expect(b.x).toBeLessThanOrEqual(w + 0.5);
      expect(a.y).toBeGreaterThanOrEqual(-0.5); expect(b.y).toBeLessThanOrEqual(h - Math.min(104, h * 0.24) + 0.5);
      expect(view.s).toBeGreaterThan(0.3); expect(view.s).toBeLessThanOrEqual(2.2);
    }
  });
  it('the wheel is always large enough to take hold of', () => {
    for (const [w, h] of STAGES) for (const shot of ['pistonShot', 'flowerShot', 'waveShot', 'buildShot'] as Shot[]) expect(WHEEL.grab * 2 * frameView(SHOTS[shot], w, h).s).toBeGreaterThanOrEqual(56);
  });
  it('the opening lifts the bench clear of the title', () => {
    const plain = frameView(SHOTS.wideShot, 390, 768), lifted = frameView(SHOTS.wideShot, 390, 768, 0.34);
    expect(toScreen(lifted, { x: 0, y: SHOTS.wideShot.y1 }).y).toBeLessThanOrEqual(768 * 0.66 + 0.5);
    expect(lifted.oy).toBeLessThan(plain.oy);
  });
  it('a wide stage keeps the whole machine in view; a tall one cuts in on the machine in play', () => {
    expect(shotFor('pistonCh', 'turnIt', true)).toBe('buildShot');
    expect(shotFor('pistonCh', 'turnIt')).toBe('pistonShot'); expect(shotFor('flowerCh', 'lookIn')).toBe('flowerShot'); expect(shotFor('waveCh', 'turnIt')).toBe('waveShot');
    expect(shotFor('flowerCh', 'pickUp')).toBe('buildShot'); expect(shotFor('finaleCh', 'bigShow')).toBe('buildShot');
    // Every shot that asks for a turn has the wheel in it; every pick-up shows the crate and the part's place.
    for (const shot of ['pistonShot', 'flowerShot', 'waveShot', 'buildShot'] as Shot[]) { expect(SHOTS[shot].x0).toBeLessThan(WHEEL.x - WHEEL.r); expect(SHOTS[shot].y1).toBeGreaterThan(WHEEL.y + WHEEL.r); }
    for (const kind of PART_KINDS) for (const p of [CRATE_SLOT[kind], SOCKET[kind]]) { expect(p.x).toBeGreaterThan(SHOTS.buildShot.x0); expect(p.x).toBeLessThan(SHOTS.buildShot.x1); expect(p.y).toBeGreaterThan(SHOTS.buildShot.y0); }
  });
  it('the pavilion always fills the stage above its floor line, and the floor line sits at the deck', () => {
    for (const [w, h] of STAGES) for (const shot of Object.keys(SHOTS) as Shot[]) {
      const view = frameView(SHOTS[shot], w, h), room = roomRect(view, w, h), a = toWorld(view, 0, 0), b = toWorld(view, w, h);
      expect(room.x).toBeLessThanOrEqual(a.x); expect(room.x + room.size).toBeGreaterThanOrEqual(b.x); expect(room.y).toBeLessThanOrEqual(a.y);
      expect(room.y + room.size * 0.69).toBeCloseTo(HORIZON, 6);
    }
    expect(HORIZON).toBeGreaterThan(BOARD.back); expect(HORIZON).toBeLessThan(BOARD.front);
  });
  it('eases toward a shot and lands on it', () => {
    const from: View = frameView(SHOTS.pistonShot, 390, 768), to = frameView(SHOTS.buildShot, 390, 768);
    expect(easeView(from, to, 1)).toEqual(to);
    const half = easeView(from, to, 0.5);
    expect(half.s).toBeLessThan(from.s); expect(half.s).toBeGreaterThan(to.s);
    expect(easeView(from, from, 0.3).s).toBeCloseTo(from.s, 12);
  });
  it('screen and world are inverse', () => {
    const view = frameView(SHOTS.flowerShot, 844, 314), p = toWorld(view, 123, 45), q = toScreen(view, p);
    expect(q.x).toBeCloseTo(123, 9); expect(q.y).toBeCloseTo(45, 9);
  });
});

describe('what a finger is on', () => {
  const all = PART_KINDS, none: typeof PART_KINDS = [];
  it('the handle, the hub and the rim all take hold of the wheel; far from it does not', () => {
    for (const a of ANGLES) expect(hitAt(handleAt(a), a, none, { flower: false, bell: false })).toBe('wheelHit');
    expect(hitAt({ x: WHEEL.x, y: WHEEL.y }, 0, none, { flower: false, bell: false })).toBe('wheelHit');
    expect(hitAt({ x: WHEEL.x + WHEEL.grab + 30, y: WHEEL.y + 40 }, 0, none, { flower: false, bell: false })).toBeNull();
  });
  it('a part waits in the crate until it is built, then its place is free', () => {
    for (const kind of all) { expect(hitAt(CRATE_SLOT[kind], 0, all, { flower: false, bell: false })).toBe(kind); expect(hitAt(CRATE_SLOT[kind], 0, none, { flower: false, bell: false })).toBeNull(); }
    for (const kind of all) expect(Math.hypot(SOCKET[kind].x - CRATE_SLOT[kind].x, SOCKET[kind].y - CRATE_SLOT[kind].y)).toBeGreaterThan(SOCKET_REACH);
  });
  it('the toys answer: the knob, the flower once planted, the bell once hung, the lens puck and the PulsePod', () => {
    expect(hitAt(knobAt(0), 0, none, { flower: false, bell: false })).toBe('knobHit');
    const top = stemTop(0), bloom = { x: top.x, y: top.y - 12 };
    expect(hitAt(bloom, 0, none, { flower: true, bell: false })).toBe('bloomHit'); expect(hitAt(bloom, 0, none, { flower: false, bell: false })).toBeNull();
    expect(hitAt({ x: BELL.x, y: BELL.y + 12 }, 0, none, { flower: false, bell: true })).toBe('bellHit');
    expect(hitAt(PUCK, 0, none, { flower: false, bell: false })).toBe('puckHit');
  });
});
