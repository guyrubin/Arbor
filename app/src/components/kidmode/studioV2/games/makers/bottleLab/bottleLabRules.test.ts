import { describe, expect, it } from 'vitest';
import { AXIS_X, BASE_Y, PROFILES, bandPath, radiusAt, silhouettePath, surfacePoint, topY, waterPath } from './bottleGeometry';
import {
  BOTTLE_MAX_STICKERS, BOTTLE_SHAPES, BOTTLE_SLOTS, LAMP_MAX, LAMP_MIN, bestViewRotation, bubbleHalfWidth, bubbleTop, clampLamp, dragTurn, freshBottle, lampEffects, lampPosition, peelSticker,
  placeSticker, slotView, snapRotation, spawnBubble, validBottle, type BottleStickerPlacement,
} from './bottleLabRules';

/** A small seeded roll, so every bubble test is repeatable. */
function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

describe('stickers: place and peel', () => {
  it('places on a free slot and refuses a taken one, an unknown art or a slot outside the twelve', () => {
    const one = placeSticker([], 'star', 3);
    expect(one).toEqual([{ art: 'star', slot: 3 }]);
    expect(placeSticker(one, 'leaf', 3)).toBe(one);
    expect(placeSticker(one, 'photo', 4)).toBe(one);
    for (const slot of [-1, 12, 1.5, NaN]) expect(placeSticker(one, 'leaf', slot)).toBe(one);
  });
  it('holds at most six, and a peel frees a place again', () => {
    let list: readonly BottleStickerPlacement[] = [];
    for (let slot = 0; slot < BOTTLE_SLOTS; slot++) list = placeSticker(list, 'heart', slot);
    expect(list).toHaveLength(BOTTLE_MAX_STICKERS);
    expect(new Set(list.map(s => s.slot)).size).toBe(BOTTLE_MAX_STICKERS);
    const peeled = peelSticker(list, 2);
    expect(peeled).toHaveLength(5);
    expect(placeSticker(peeled, 'moon', 11)).toHaveLength(6);
    expect(peelSticker(peeled, 2)).toBe(peeled);
  });
  it('every list the two moves can build is a valid saved bottle', () => {
    const roll = seeded(7);
    let list: readonly BottleStickerPlacement[] = [];
    for (let i = 0; i < 400; i++) {
      const slot = Math.floor(roll() * 14) - 1;
      list = roll() < 0.6 ? placeSticker(list, ['star', 'leaf', 'wave', 'sun', 'moon', 'heart'][Math.floor(roll() * 6)], slot) : peelSticker(list, slot);
      expect(validBottle({ ...freshBottle(), stickers: list })).toBe(true);
    }
  });
});

describe('turning: stickers follow the surface and pass behind', () => {
  it('unturned, column 0 faces the child and column 2 is behind', () => {
    expect(slotView(0, 0)).toMatchObject({ x: 0, scaleX: 1, front: true, column: 0, row: 0 });
    expect(slotView(6, 0)).toMatchObject({ scaleX: 1, front: false, column: 2, row: 1 });
    expect(slotView(1, 0)).toMatchObject({ x: 1, scaleX: 0, front: false });
  });
  it('x and foreshortening follow the sine and cosine of the angle as it turns', () => {
    for (let turn = -360; turn <= 360; turn += 15) {
      const v = slotView(4, turn), rad = turn * Math.PI / 180;
      expect(v.x).toBeCloseTo(Math.sin(rad), 9);
      expect(v.scaleX).toBeCloseTo(Math.abs(Math.cos(rad)), 9);
      expect(v.front).toBe(Math.cos(rad) > 1e-9);
    }
  });
  it('a sticker goes round behind and comes back after a full turn', () => {
    const seen = [0, 90, 135, 180, 225, 270, 360].map(turn => slotView(0, turn).front);
    expect(seen).toEqual([true, false, false, false, false, false, true]);
    expect(slotView(5, 360)).toEqual(slotView(5, 0));
  });
  it('drags settle on the nearest eighth turn; a drag across one width is half a turn', () => {
    expect(snapRotation(20)).toBe(0); expect(snapRotation(23)).toBe(45); expect(snapRotation(-100)).toBe(-90); expect(snapRotation(NaN)).toBe(0);
    expect(dragTurn(120, 120)).toBe(180); expect(dragTurn(10, 0)).toBe(0);
  });
  it('a kept bottle reopens at the same three-quarter view, the one that shows most stickers', () => {
    const back: BottleStickerPlacement[] = [{ art: 'star', slot: 2 }, { art: 'moon', slot: 6 }, { art: 'sun', slot: 3 }];
    const view = bestViewRotation(back);
    expect(view).toBe(bestViewRotation([...back]));
    expect(back.every(s => slotView(s.slot, view).front)).toBe(true);
    expect(bestViewRotation([])).toBe(-45);
  });
});

describe('the lamp: shine and shadow follow its angle', () => {
  it('clamps to its arc', () => {
    expect(clampLamp(200)).toBe(LAMP_MAX); expect(clampLamp(-200)).toBe(LAMP_MIN); expect(clampLamp(NaN)).toBeGreaterThanOrEqual(LAMP_MIN);
  });
  it('the streak moves toward the lamp, the rim and the shadow away from it', () => {
    const left = lampEffects(-50), right = lampEffects(50), top = lampEffects(0);
    expect(left.streakU).toBeLessThan(0); expect(right.streakU).toBeGreaterThan(0); expect(top.streakU).toBeCloseTo(0, 9);
    expect(left.rimU).toBeGreaterThan(0); expect(right.rimU).toBeLessThan(0);
    // The shadow points right (angle near 0) for a lamp on the left, and left (near ±180) for a lamp on the right.
    expect(Math.cos(left.shadowAngle * Math.PI / 180)).toBeGreaterThan(0.8);
    expect(Math.cos(right.shadowAngle * Math.PI / 180)).toBeLessThan(-0.8);
  });
  it('a lower lamp throws a longer shadow and a bigger caustic', () => {
    const lengths = [0, 20, 40, 60].map(a => lampEffects(a).shadowLength);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(lampEffects(60).causticSize).toBeGreaterThan(lampEffects(0).causticSize);
    expect(lampEffects(-30)).toEqual({ ...lampEffects(30), streakU: -lampEffects(30).streakU, rimU: -lampEffects(30).rimU, shadowAngle: lampEffects(-30).shadowAngle });
  });
  it('room light: no caustic, a faint shine and a short soft shadow', () => {
    const off = lampEffects(40, false);
    expect(off.causticOpacity).toBe(0);
    expect(off.streakOpacity).toBeLessThan(lampEffects(40).streakOpacity);
    expect(off.shadowLength).toBeLessThan(lampEffects(0).shadowLength);
  });
  it('the lamp stands on its track and always leans toward the bottle', () => {
    expect(lampPosition(0).x).toBeCloseTo(180, 6);
    // The head always leans toward the bottle: right from the left side, left from the right.
    expect(lampPosition(-40).face).toBe(1); expect(lampPosition(40).face).toBe(-1); expect(lampPosition(0).face).toBeCloseTo(0, 9);
    expect(lampPosition(-60).x).toBeLessThan(lampPosition(60).x);
  });
});

describe('bubbles in the still picture', () => {
  it.each(BOTTLE_SHAPES)('%s: every bubble is born inside the water', (shape) => {
    const roll = seeded(shape.length * 31), top = bubbleTop(shape);
    for (let id = 0; id < 24; id++) {
      const b = spawnBubble(shape, id, roll, AXIS_X, id % 2 === 0);
      expect(Math.abs(b.x - AXIS_X)).toBeLessThanOrEqual(bubbleHalfWidth(shape, b.y, b.r) + 1e-6);
      expect(b.y - b.r).toBeGreaterThanOrEqual(top - 1e-6); expect(b.y).toBeLessThanOrEqual(BASE_Y);
    }
  });
  it('no room above the water or below the base', () => {
    expect(bubbleHalfWidth('round', PROFILES.round.water - 1, 2)).toBe(0);
    expect(bubbleHalfWidth('tall', BASE_Y + 1, 2)).toBe(0);
  });
});

describe('geometry: one profile for every layer', () => {
  it.each(BOTTLE_SHAPES)('%s: a closed outline, zero outside the bottle, widest in the body', (shape) => {
    expect(radiusAt(shape, topY(shape) - 1)).toBe(0);
    expect(radiusAt(shape, BASE_Y + 1)).toBe(0);
    expect(radiusAt(shape, PROFILES[shape].rows[1])).toBeGreaterThan(radiusAt(shape, topY(shape)) * 2);
    for (const path of [silhouettePath(shape), waterPath(shape), bandPath(shape, 0.8, 1)]) { expect(path).toMatch(/^M[\d. LA]+Z$/); expect(path).not.toMatch(/NaN/); }
  });
  it('the near side of a ring sits lower than the far side', () => {
    expect(surfacePoint('tall', 280, 0, 1).y).toBeGreaterThan(surfacePoint('tall', 280, 0, -1).y);
  });
});

describe('validBottle', () => {
  it('accepts a fresh bottle and refuses an unknown shape', () => {
    expect(validBottle(freshBottle())).toBe(true);
    expect(validBottle({ ...freshBottle(), shape: 'cube' })).toBe(false);
  });
});
