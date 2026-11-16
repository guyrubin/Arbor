import { describe, expect, it } from 'vitest';
import { BASE_Y, PROFILES, radiusAt, topY } from './bottleGeometry';
import { BOTTLE_SHAPES, LAMP_START, MAX_BUBBLES, bestViewRotation, bubbleInside, riseBubble, spawnBubble } from './bottleLabRules';
import { refractedPoint } from './bottleRefraction';
import {
  AYA, GLASS_SCALE, KEEP_GLINTS, SLOSH_MAX, TILT_MAX, WATER_HOME, WATER_LEVELS, ayaAfterLamp, ayaSide, ayaX, clampLevel, hootNote, keepPose, knock, nextHint, nextLevel,
  pourPose, ringNote, stepAya, stepSway, stickerShade, stillSway, swayStill, tiltFor, waterLine, waterRadius, waterY, windowNote,
} from './bottleToys';

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

describe('water level: Aya fills the bottle a step at a time', () => {
  it.each(BOTTLE_SHAPES)('%s: the home level is the still bottle\'s own, every level stays inside the glass', (shape) => {
    expect(waterY(shape, WATER_HOME)).toBe(PROFILES[shape].water);
    for (let level = 0; level < WATER_LEVELS; level++) {
      const y = waterY(shape, level);
      expect(y).toBeGreaterThan(topY(shape) + 20); expect(y).toBeLessThan(BASE_Y - 40);
      expect(waterRadius(shape, y)).toBeGreaterThan(20);
      if (level) expect(y).toBeLessThan(waterY(shape, level - 1));
    }
  });
  it('a pour is one step up; a full bottle is tipped back to nearly empty; odd input is the home level', () => {
    expect([0, 1, 2, 3, 4, 5].map(nextLevel)).toEqual([1, 2, 3, 4, 5, 0]);
    expect(clampLevel(99)).toBe(WATER_LEVELS - 1); expect(clampLevel(-3)).toBe(0); expect(clampLevel(NaN)).toBe(WATER_HOME);
  });
  it.each(BOTTLE_SHAPES)('%s: bubbles stay under whatever level the water is at', (shape) => {
    for (const level of [0, WATER_LEVELS - 1]) {
      const top = waterY(shape, level), roll = seeded(level * 7 + shape.length);
      let alive = Array.from({ length: MAX_BUBBLES }, (_, id) => spawnBubble(shape, id, roll, 180, id % 2 === 0, top));
      for (const b of alive) expect(bubbleInside(shape, b, 180, top)).toBe(true);
      for (let step = 0, t = 0; step < 900 && alive.length; step++) {
        t += 1 / 60;
        alive = alive.map(b => riseBubble(shape, b, t, 1 / 60, 180, top)).filter((b): b is NonNullable<typeof b> => b !== null);
        for (const b of alive) expect(bubbleInside(shape, b, 180, top)).toBe(true);
      }
      expect(alive).toHaveLength(0);
    }
  });
});

describe('notes: one scale, and the glass tells how full it is', () => {
  it.each(BOTTLE_SHAPES)('%s: a tapped glass rings lower as it fills; blown across the top it hoots higher', (shape) => {
    const rings = Array.from({ length: WATER_LEVELS }, (_, level) => ringNote(shape, level)), hoots = Array.from({ length: WATER_LEVELS }, (_, level) => hootNote(shape, level));
    for (let i = 1; i < WATER_LEVELS; i++) { expect(rings[i]).toBeLessThan(rings[i - 1]); expect(hoots[i]).toBeGreaterThan(hoots[i - 1]); }
    for (const f of [...rings, ...hoots]) expect(GLASS_SCALE).toContain(f);
    // An empty bottle rings high and hoots low; the two meet as it fills.
    expect(hoots[0]).toBeLessThan(rings[0] / 2);
  });
  it('the three windows ping three different notes of the same scale', () => {
    const notes = [40, 180, 320].map(windowNote);
    expect(new Set(notes).size).toBe(3);
    for (const f of notes) expect(GLASS_SCALE).toContain(f);
  });
});

describe('tilt and slosh', () => {
  const run = (s: ReturnType<typeof stillSway>, hold: number | null, seconds: number) => { let sway = s; for (let i = 0; i < seconds * 60; i++) sway = stepSway(sway, hold, 1 / 60); return sway; };
  it('held by the neck the bottle follows the finger and the water stays level in the room', () => {
    const held = run(stillSway(), 10, 2.5);
    expect(held.tilt).toBeCloseTo(10, 1);
    expect(Math.abs(held.slosh)).toBeLessThan(0.5);
    // Drawn on the leaning bottle, the water line leans the other way by the same angle.
    expect(waterLine(held)).toBeCloseTo(-10, 0);
  });
  it('let go, it rocks back upright and comes to a full stop', () => {
    let sway = run(stillSway(), -12, 1), swung = 0;
    for (let i = 0; i < 60; i++) { sway = stepSway(sway, null, 1 / 60); swung = Math.max(swung, Math.abs(sway.slosh)); }
    expect(swung).toBeGreaterThan(1);
    expect(swayStill(run(sway, null, 8))).toBe(true);
  });
  it('never leans or sloshes past its limits, whatever it is asked', () => {
    let sway = knock(knock(stillSway(), 1, 40), 1, 40);
    for (let i = 0; i < 600; i++) { sway = stepSway(sway, i < 200 ? 90 : null, i % 7 ? 1 / 60 : 0.5); expect(Math.abs(sway.tilt)).toBeLessThanOrEqual(TILT_MAX + 1e-9); expect(Math.abs(sway.slosh)).toBeLessThanOrEqual(SLOSH_MAX + 1e-9); }
    expect(stepSway(stillSway(), null, NaN)).toEqual(stillSway());
  });
  it('a knock rocks the bottle one way and the water the other', () => {
    const after = stepSway(knock(stillSway(), 1), null, 1 / 60);
    expect(after.tilt).toBeGreaterThan(0); expect(after.slosh).toBeLessThan(0);
  });
  it('a drag on the neck asks for a lean toward the finger, within the limit', () => {
    expect(tiltFor(0, 200)).toBe(0); expect(tiltFor(20, 200)).toBeGreaterThan(0); expect(tiltFor(-20, 200)).toBeLessThan(0);
    expect(tiltFor(9999, 100)).toBe(TILT_MAX); expect(tiltFor(NaN, 100)).toBe(0);
  });
});

describe('Aya makes room for the lamp', () => {
  it('stands on the side the lamp is not on', () => {
    expect(ayaSide(LAMP_START)).toBe('right'); expect(ayaSide(40)).toBe('left');
    expect(ayaX('left')).toBeLessThan(ayaX('behind')); expect(ayaX('right')).toBeGreaterThan(ayaX('behind'));
  });
  it('crosses only when the lamp has come well over to her side', () => {
    expect(ayaAfterLamp('right', 10)).toBe('right'); expect(ayaAfterLamp('right', 20)).toBe('left');
    expect(ayaAfterLamp('left', -10)).toBe('left'); expect(ayaAfterLamp('left', -20)).toBe('right');
  });
  it('hops to where she is going and stands still there, further back while behind the bottle', () => {
    let x = ayaX('right'), hopped = 0, far: number = AYA.feet;
    for (let i = 0; i < 400; i++) { const step = stepAya(x, ayaX('left'), 1 / 60); x = step.x; hopped = Math.max(hopped, step.lift); far = Math.min(far, step.y); }
    expect(x).toBe(ayaX('left')); expect(hopped).toBeGreaterThan(3); expect(far).toBeCloseTo(AYA.far, 0);
    expect(stepAya(x, x, 1 / 60)).toMatchObject({ x, lift: 0, moving: false, y: AYA.feet });
  });
  it('the pour reaches the mouth, tips, pours, and is put away', () => {
    expect(pourPose(0)).toMatchObject({ reach: 0, tip: 0, flow: false, shown: true });
    expect(pourPose(0.5)).toMatchObject({ reach: 1, tip: 1, flow: true });
    expect(pourPose(1)).toMatchObject({ reach: 0, flow: false, shown: false });
    expect(pourPose(NaN).shown).toBe(false);
  });
});

describe('the room through the glass', () => {
  it.each(BOTTLE_SHAPES)('%s: through water the view swaps sides; through air it does not', (shape) => {
    const y = PROFILES[shape].rows[1], r = radiusAt(shape, y), x = 180 + r * 0.3;
    expect(refractedPoint(shape, x, y, false, 'wet')!.x).toBeLessThan(180);
    expect(refractedPoint(shape, x, y, false, 'air')!.x).toBeGreaterThanOrEqual(x);
    // The still picture is the two joined at the water line.
    expect(refractedPoint(shape, x, y)).toEqual(refractedPoint(shape, x, y, false, 'wet'));
    const above = PROFILES[shape].water - 12;
    expect(refractedPoint(shape, 181, above)).toEqual(refractedPoint(shape, 181, above, false, 'air'));
    expect(refractedPoint(shape, 180 + r * 3, y, false, 'wet')).toBeNull();
  });
});

describe('hints and the keeping turn', () => {
  it('first a tap, then (once a sticker is on) a turn, then nothing', () => {
    expect(nextHint({ ring: false, turn: false }, 0)).toBe('ring');
    expect(nextHint({ ring: true, turn: false }, 0)).toBeNull();
    expect(nextHint({ ring: true, turn: false }, 2)).toBe('turn');
    expect(nextHint({ ring: true, turn: true }, 2)).toBeNull();
  });
  it('the keeping turn goes at least two thirds round and ends exactly on the view a kept bottle is shown at', () => {
    for (const from of [-20, 0, 45, 190, -400]) for (const stickers of [[], [{ art: 'star' as const, slot: 2 }, { art: 'moon' as const, slot: 6 }]]) {
      const to = bestViewRotation(stickers), end = keepPose(1, from, to, 30);
      expect(((end.rotation - to) % 360 + 360) % 360).toBeCloseTo(0, 6);
      expect(end.rotation - from).toBeGreaterThanOrEqual(240);
      expect(end.lamp).toBeCloseTo(LAMP_START, 6); expect(end.dip).toBe(0);
      expect(keepPose(0, from, to, 30)).toMatchObject({ rotation: from, lamp: 30 });
      let last = from;
      for (let t = 0; t <= 1; t += 0.02) { const pose = keepPose(t, from, to, 30); expect(pose.rotation).toBeGreaterThanOrEqual(last - 1e-9); last = pose.rotation; }
    }
  });
  it('the lamp crosses to the far side on the way', () => {
    expect(keepPose(0.5, 0, -45, -48).lamp).toBeGreaterThan(40); expect(keepPose(0.5, 0, -45, 50).lamp).toBeLessThan(-40);
    expect(KEEP_GLINTS).toEqual([...KEEP_GLINTS].sort((a, b) => a - b));
  });
  it('a sticker\'s shadow sits inside the bottle\'s own shadow', () => {
    for (const shape of BOTTLE_SHAPES) for (let slot = 0; slot < 12; slot++) {
      const v = stickerShade(shape, { art: 'sun', slot }, 45, -48);
      expect(Math.abs(v.u)).toBeLessThanOrEqual(1); expect(v.t).toBeGreaterThan(0); expect(v.t).toBeLessThan(1); expect(v.wide).toBeGreaterThan(0);
    }
  });
});
