/** The rendered bowl: its profile is a bowl, and the one light (the window,
 * upper left) falls on it the way it falls on the table. Pure arithmetic. */
import { describe, expect, it } from 'vitest';
import { BOWL_DEPTH, BOWL_LIGHT, BOWL_LIP, BOWL_WELL, bowlHeight, bowlLighting, bowlPixels, bowlSlope, emptyLighting, lightRows, type BowlTones } from './bowlRender';
import { GLAZE_PAINT } from './bowlTexture';
import { BOWL_GLAZES } from './mendBowlRules';

const TONES: BowlTones = { base: [159, 201, 180], deep: [95, 154, 132], light: [224, 238, 231], clay: [241, 215, 192], speck: [91, 58, 41], bounce: [232, 220, 194] };
const S = 96, at = (x: number, y: number) => Math.round((y + 1) / 2 * (S - 1)) * S + Math.round((x + 1) / 2 * (S - 1));
const light = bowlLighting(S);

describe('mend-bowl: the bowl’s shape', () => {
  it('a flat well, a wall that only rises and steepens, and a lip that turns over', () => {
    expect(bowlHeight(0)).toBe(0); expect(bowlHeight(BOWL_WELL)).toBe(0);
    let last = 0, lastSlope = 0;
    for (let r = BOWL_WELL + 0.02; r <= BOWL_LIP; r += 0.02) {
      const h = bowlHeight(r), slope = (bowlHeight(r + 0.001) - bowlHeight(r - 0.001)) / 0.002;
      expect(h).toBeGreaterThan(last); expect(slope).toBeGreaterThanOrEqual(lastSlope - 1e-6); last = h; lastSlope = slope;
    }
    expect(bowlHeight(BOWL_LIP)).toBeCloseTo(BOWL_DEPTH, 6);
    // The lip crests just outside the wall, then falls away to the outside.
    const crest = Math.max(...Array.from({ length: 30 }, (_, i) => bowlHeight(BOWL_LIP + i * (1 - BOWL_LIP) / 29)));
    expect(crest).toBeGreaterThan(BOWL_DEPTH); expect(bowlHeight(1)).toBeLessThan(crest); expect(bowlSlope(0.995)).toBeLessThan(0);
    // The join of wall and lip has no crease: the same slope on both sides.
    expect((bowlHeight(BOWL_LIP + 0.002) - bowlHeight(BOWL_LIP)) / 0.002).toBeCloseTo((bowlHeight(BOWL_LIP) - bowlHeight(BOWL_LIP - 0.002)) / 0.002, 0);
  });
});

describe('mend-bowl: one light, from the window at the upper left', () => {
  it('the light comes from up and to the left, above the table', () => {
    expect(BOWL_LIGHT[0]).toBeLessThan(0); expect(BOWL_LIGHT[1]).toBeLessThan(0); expect(BOWL_LIGHT[2]).toBeGreaterThan(0.4);
    expect(Math.hypot(...BOWL_LIGHT)).toBeCloseTo(1, 9);
  });
  it('covers the round bowl and nothing outside it', () => {
    expect(light.alpha[at(0, 0)]).toBe(1); expect(light.alpha[at(0.6, 0)]).toBe(1);
    expect(light.alpha[0]).toBe(0); expect(light.alpha[S * S - 1]).toBe(0); expect(light.alpha[at(0.75, 0.75)]).toBe(0);
  });
  it('the far wall faces the window and is bright; the near wall lies in the rim’s shadow', () => {
    // On the wall, half-way up: the lower-right faces the upper-left light; the upper-left is under the rim.
    const lit = light.lit[at(0.45, 0.45)], shaded = light.lit[at(-0.45, -0.45)], well = light.lit[at(0, 0)];
    expect(lit).toBeGreaterThan(shaded * 1.6); expect(well).toBeGreaterThan(shaded); expect(lit).toBeGreaterThan(well);
    // The shade is not black: the linen bounces light back into it.
    expect(shaded).toBeGreaterThan(0.2); expect(light.bounce[at(-0.45, -0.45)]).toBeGreaterThan(light.bounce[at(0, 0)]);
  });
  it('the window is mirrored in the glaze on the lit wall only, and never floods the bowl', () => {
    let bright = 0, sumX = 0, sumY = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) if (light.spec[j * S + i] > 0.4) { bright++; sumX += i; sumY += j; }
    expect(bright).toBeGreaterThan(3); expect(bright).toBeLessThan(S * S * 0.03);
    // Its centre is on the lower right, where the wall faces the window.
    expect(sumX / bright).toBeGreaterThan(S / 2); expect(sumY / bright).toBeGreaterThan(S / 2);
    expect(light.spec[at(0, 0)]).toBeLessThan(0.05); expect(light.spec[at(-0.5, -0.5)]).toBeLessThan(0.05);
  });
  it('glaze pools at the foot of the wall and breaks thin over the lip', () => {
    expect(light.pool[at(BOWL_WELL, 0)]).toBeGreaterThan(light.pool[at(0.62, 0)]);
    expect(light.thin[at(0.95, 0)]).toBeGreaterThan(0.5); expect(light.thin[at(0.5, 0)]).toBeLessThan(0.25);
  });
  it('working the light out in slices gives exactly the light worked out at once', () => {
    const sliced = emptyLighting(S);
    for (let row = 0; row < S; row += 7) lightRows(sliced, row, row + 7);
    expect(Array.from(sliced.lit)).toEqual(Array.from(light.lit)); expect(Array.from(sliced.spec)).toEqual(Array.from(light.spec)); expect(Array.from(sliced.alpha)).toEqual(Array.from(light.alpha));
  });
});

describe('mend-bowl: the glaze on the light', () => {
  const px = bowlPixels(light, TONES), rgb = (k: number) => [px[k * 4], px[k * 4 + 1], px[k * 4 + 2]];
  it('paints only the bowl, opaque inside and clear outside', () => {
    expect(px).toHaveLength(S * S * 4); expect(px[3]).toBe(0); expect(px[at(0, 0) * 4 + 3]).toBe(255);
  });
  it('keeps the glaze’s own hue in the light and in the shade', () => {
    for (const k of [at(0, 0), at(0.45, 0.45), at(-0.45, -0.45)]) { const [r, g, b] = rgb(k); expect(g).toBeGreaterThan(r); expect(g).toBeGreaterThan(b - 6); }
    const sum = (k: number) => rgb(k).reduce((a, v) => a + v, 0);
    expect(sum(at(0.45, 0.45))).toBeGreaterThan(sum(at(-0.45, -0.45)) + 60);
  });
  it('every glaze is a recipe of palette tokens for every tone: no colour is written down', () => {
    for (const glaze of BOWL_GLAZES) for (const key of ['base', 'deep', 'light', 'clay', 'speck', 'bounce'] as const) {
      const [token, share = 1, other] = GLAZE_PAINT[glaze][key];
      expect(token).toMatch(/^--mk-[a-z-]+$/); expect(share).toBeGreaterThan(0); expect(share).toBeLessThanOrEqual(1);
      if (other) expect(other).toMatch(/^--mk-[a-z-]+$/);
    }
  });
});
