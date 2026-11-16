import { describe, expect, it } from 'vitest';
import { STRIDE, pepPose, type PuppetInput } from './pepPuppet';
import { COURSE, FLOWER_XS, LAMP_XS, PEP_SIDE, PLATES, STATIONS, pepParts } from './foxKit';
import { BOUNCERS, LOGS, MAX_X, MIN_X, STONES, STREAM, TUNNEL } from './foxTrailRules';

const still: PuppetInput = { phase: 0, speed: 0, accel: 0, air: false, vy: 0, tuck: 0, spin: 0, squash: 0, stretch: 0, sit: 0, shake: 0, t: 1, reduced: false };

describe('Pep the puppet', () => {
  it('stands square when still, and breathes only a little', () => {
    const p = pepPose(still);
    for (const leg of [p.fore, p.foreFar, p.hind, p.hindFar]) expect(Math.abs(leg)).toBeLessThan(0.01);
    expect(Math.abs(p.sy - 1)).toBeLessThan(0.02); expect(p.spin).toBe(0);
    expect(pepPose({ ...still, reduced: true }).sy).toBe(1);
  });
  it('trots in diagonal pairs, with the legs tied to the distance run', () => {
    const p = pepPose({ ...still, speed: 0.5, phase: Math.PI / 2 });
    expect(p.fore).toBeGreaterThan(0.3); expect(p.foreFar).toBeLessThan(-0.3);
    expect(p.hind).toBeLessThan(-0.3); expect(p.hindFar).toBeGreaterThan(0.3);
    expect(p.lift).toBeGreaterThan(1);
    // a whole stride later the pose is the same again: paws never slide
    const again = pepPose({ ...still, speed: 0.5, phase: Math.PI / 2 + (STRIDE / STRIDE) * 2 * Math.PI });
    expect(again.fore).toBeCloseTo(p.fore, 6); expect(again.hind).toBeCloseTo(p.hind, 6);
    // faster swings wider
    expect(pepPose({ ...still, speed: 1, phase: Math.PI / 2 }).fore).toBeGreaterThan(p.fore);
  });
  it('stretches into a jump, squashes on landing, and tucks into a roll', () => {
    const up = pepPose({ ...still, air: true, vy: 400, stretch: 1 });
    expect(up.fore).toBeGreaterThan(0.5); expect(up.hind).toBeLessThan(-0.5); expect(up.sy).toBeGreaterThan(1.05); expect(up.pitch).toBeLessThan(0);
    const down = pepPose({ ...still, air: true, vy: -400 });
    expect(down.pitch).toBeGreaterThan(0);
    const landed = pepPose({ ...still, squash: 1 });
    expect(landed.sy).toBeLessThan(0.9); expect(landed.sx).toBeGreaterThan(1.05);
    const roll = pepPose({ ...still, speed: 1, tuck: 1, spin: 2 });
    expect(roll.fore).toBeLessThan(-1.2); expect(roll.hind).toBeGreaterThan(1.2); expect(roll.sx).toBeLessThan(0.9); expect(roll.spin).toBe(2);
  });
  it('settles on his haunches, and shakes dry without leaving the spot', () => {
    const sat = pepPose({ ...still, sit: 1 });
    expect(sat.hind).toBeGreaterThan(0.8); expect(sat.pitch).toBeLessThan(-0.1); expect(sat.lift).toBeLessThan(0);
    const a = pepPose({ ...still, shake: 1, t: 0.01 }), b = pepPose({ ...still, shake: 1, t: 0.05 });
    expect(a.pitch).not.toBeCloseTo(b.pitch, 3);
    expect(pepPose({ ...still, shake: 1, reduced: true }).pitch).toBeCloseTo(0, 6);
  });
});

describe('the trail’s kit pictures', () => {
  it('cuts the puppet from the shared library figure, inside its picture', () => {
    expect(PEP_SIDE.src).toContain('/makers/kit-pep-');
    const parts = pepParts();
    for (const clip of [parts.body, parts.fore, parts.hind]) {
      expect(clip.startsWith('polygon(')).toBe(true);
      const ys = [...clip.matchAll(/ (-?[\d.]+)%/g)].map(m => Number(m[1]));
      expect(Math.max(...ys)).toBeLessThanOrEqual(112); expect(Math.min(...ys)).toBeGreaterThanOrEqual(-120);
    }
    expect(parts.foot[0]).toBeGreaterThan(0.4); expect(parts.foot[1]).toBeGreaterThan(0.95);
    expect(parts.h).toBeGreaterThan(80); expect(parts.h).toBeLessThan(120);
  });
  it('names a dusk and a night picture for every plate, all of them the trail’s own files', () => {
    for (const plate of Object.values(PLATES)) for (const tone of ['dusk', 'night'] as const) {
      expect(plate[tone].src).toMatch(/\/makers\/fox-trail-[a-z-]+\.webp$/);
      expect(plate[tone].w * plate[tone].h).toBeGreaterThan(0); expect(plate[tone].from.length).toBeGreaterThan(8);
    }
  });
  it('stands every prop and friend on the trail, clear of each other and of the low planter', () => {
    const xs = [...LAMP_XS, ...FLOWER_XS, ...STATIONS.map(st => st.x)];
    for (const x of xs) { expect(x).toBeGreaterThan(MIN_X); expect(x).toBeLessThan(MAX_X + 40); expect(x < TUNNEL.from - 40 || x > TUNNEL.to + 40).toBe(true); expect(x < STREAM.from - 10 || x > STREAM.to + 10).toBe(true); }
    const sorted = [...xs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThan(38);
    expect(COURSE).toHaveLength(LOGS.length + BOUNCERS.length + STONES.length);
    expect(STATIONS.map(st => st.id)).toEqual(['aya', 'bebe', 'chock', 'gobgob']);
    // any picture that shows one of the two children says so in its file name
    for (const st of STATIONS) if (st.id === 'bebe' || st.id === 'gobgob') expect(st.art.src).toContain(st.id);
  });
});
