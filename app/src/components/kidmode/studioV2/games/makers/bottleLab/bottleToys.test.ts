import { describe, expect, it } from 'vitest';
import { PROFILES, radiusAt } from './bottleGeometry';
import { BOTTLE_SHAPES } from './bottleLabRules';
import { refractedPoint } from './bottleRefraction';
import { AYA, stickerShade } from './bottleToys';

/** The still picture (cover and kept-bottle preview): its own small rules. */
describe('the room through the glass, in the still picture', () => {
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

describe('the still life', () => {
  it('a sticker\'s shadow sits inside the bottle\'s own shadow', () => {
    for (const shape of BOTTLE_SHAPES) for (let slot = 0; slot < 12; slot++) {
      const v = stickerShade(shape, { art: 'sun', slot }, 45, -48);
      expect(Math.abs(v.u)).toBeLessThanOrEqual(1); expect(v.t).toBeGreaterThan(0); expect(v.t).toBeLessThan(1); expect(v.wide).toBeGreaterThan(0);
    }
  });
  it('Aya stands clear of the widest bottle and on the table', () => {
    expect(AYA.reach).toBeGreaterThan(Math.max(...BOTTLE_SHAPES.map(s => Math.max(...PROFILES[s].knots.map(([, r]) => r)))));
    expect(AYA.far).toBeLessThan(AYA.feet);
  });
});
