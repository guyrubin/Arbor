import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STRIDE, pepPose, type PuppetInput } from './pepPuppet';
import { BLOOMS, DOME_SUN, FERNS, FRIENDS, GATHER, LAYERS, PEP_COVER, PEP_SIDE, PLATES, SPRITES, STATION_CREW, pepParts } from './foxKit';

const still: PuppetInput = { phase: 0, speed: 0, accel: 0, air: false, vy: 0, tuck: 0, spin: 0, squash: 0, stretch: 0, sit: 0, shake: 0, t: 1, reduced: false };

describe('Pep the puppet', () => {
  it('stands square when still, and breathes only a little', () => {
    const p = pepPose(still);
    for (const leg of [p.fore, p.foreFar, p.hind, p.hindFar]) expect(Math.abs(leg)).toBeLessThan(0.01);
    expect(Math.abs(p.sy - 1)).toBeLessThan(0.02); expect(p.spin).toBe(0); expect(Math.abs(p.head)).toBeLessThan(0.01);
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
    expect(pepPose({ ...still, speed: 1, phase: Math.PI / 2 }).fore).toBeGreaterThan(p.fore);
  });
  it('lets the head follow a beat behind the body and lean against a hard start or stop', () => {
    const nods = [0, 1, 2, 3, 4, 5].map(i => pepPose({ ...still, speed: 0.9, phase: i }).head);
    expect(Math.max(...nods) - Math.min(...nods)).toBeGreaterThan(0.04);
    for (const nod of nods) expect(Math.abs(nod)).toBeLessThan(0.2);
    // a skid (hard braking) throws the nose down; a push off the mark lifts it
    expect(pepPose({ ...still, speed: 0.5, accel: -1600 }).head).toBeGreaterThan(pepPose({ ...still, speed: 0.5, accel: 1600 }).head);
  });
  it('stretches into a jump, squashes on landing, and tucks into a roll', () => {
    const up = pepPose({ ...still, air: true, vy: 400, stretch: 1 });
    expect(up.fore).toBeGreaterThan(0.5); expect(up.hind).toBeLessThan(-0.5); expect(up.sy).toBeGreaterThan(1.05); expect(up.pitch).toBeLessThan(0);
    const down = pepPose({ ...still, air: true, vy: -400 });
    expect(down.pitch).toBeGreaterThan(0); expect(down.head).toBeGreaterThan(up.head);
    const landed = pepPose({ ...still, squash: 1 });
    expect(landed.sy).toBeLessThan(0.9); expect(landed.sx).toBeGreaterThan(1.05);
    const roll = pepPose({ ...still, speed: 1, tuck: 1, spin: 2 });
    expect(roll.fore).toBeLessThan(-1.2); expect(roll.hind).toBeGreaterThan(1.2); expect(roll.sx).toBeLessThan(0.9); expect(roll.sy).toBeLessThan(0.9); expect(roll.spin).toBe(2); expect(roll.head).toBeGreaterThan(0.2);
  });
  it('settles on his haunches, and shakes without leaving the spot', () => {
    const sat = pepPose({ ...still, sit: 1 });
    expect(sat.hind).toBeGreaterThan(0.8); expect(sat.pitch).toBeLessThan(-0.1); expect(sat.lift).toBeLessThan(0);
    const a = pepPose({ ...still, shake: 1, t: 0.01 }), b = pepPose({ ...still, shake: 1, t: 0.05 });
    expect(a.pitch).not.toBeCloseTo(b.pitch, 3); expect(a.head).not.toBeCloseTo(b.head, 3);
    expect(pepPose({ ...still, shake: 1, reduced: true }).pitch).toBeCloseTo(0, 6);
  });
});

describe('the trail’s kit pictures', () => {
  const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..', '..', 'public');
  it('cuts the puppet from the shared library figure, inside its picture', () => {
    expect(PEP_SIDE.src).toContain('/makers/kit-pep-');
    const parts = pepParts();
    for (const clip of [parts.body, parts.head, parts.fore, parts.hind]) {
      expect(clip.startsWith('polygon(')).toBe(true);
      const ys = [...clip.matchAll(/ (-?[\d.]+)%/g)].map(m => Number(m[1]));
      expect(Math.max(...ys)).toBeLessThanOrEqual(112); expect(Math.min(...ys)).toBeGreaterThanOrEqual(-120);
    }
    expect(parts.foot[0]).toBeGreaterThan(0.4); expect(parts.foot[1]).toBeGreaterThan(0.95);
    // Pep is the hero: taller than a planter, a quarter of a narrow view
    expect(parts.h).toBeGreaterThan(110); expect(parts.h).toBeLessThan(150);
    for (const spot of parts.cam) { expect(spot).toBeGreaterThan(0); expect(spot).toBeLessThan(100); }
  });
  it('names a dusk and a lit picture for every plate, all of them the trail’s own files, each with its 480 twin on disk', () => {
    for (const plate of Object.values(PLATES)) for (const tone of ['dusk', 'night'] as const) {
      expect(plate[tone].src).toMatch(/\/makers\/fox-trail-[a-z-]+\.webp$/);
      expect(plate[tone].w * plate[tone].h).toBeGreaterThan(0); expect(plate[tone].from.length).toBeGreaterThan(8);
      expect(existsSync(path.join(PUBLIC, plate[tone].src)), plate[tone].src).toBe(true);
      expect(existsSync(path.join(PUBLIC, plate[tone].src.replace('.webp', '-480.webp'))), `${plate[tone].src} twin`).toBe(true);
    }
  });
  it('ships every sprite and friend it shows', () => {
    for (const art of [...Object.values(SPRITES), ...Object.values(FRIENDS).map(f => f.art), PEP_SIDE, PEP_COVER]) expect(existsSync(path.join(PUBLIC, art.src)), art.src).toBe(true);
  });
  it('stacks the valley far to near: each layer nearer, bigger and faster than the one behind', () => {
    for (let i = 1; i < LAYERS.length; i++) {
      expect(LAYERS[i].f).toBeGreaterThan(LAYERS[i - 1].f); expect(LAYERS[i].k).toBeGreaterThan(LAYERS[i - 1].k);
      expect(LAYERS[i].foot).toBeGreaterThan(LAYERS[i - 1].foot); expect(LAYERS[i].sink).toBeGreaterThan(LAYERS[i - 1].sink);
    }
    expect(LAYERS[LAYERS.length - 1].f).toBeLessThan(1);
    expect(BLOOMS.f).toBeGreaterThan(1); expect(FERNS.f).toBeGreaterThan(BLOOMS.f);
  });
  it('puts a friend at every station, and names the two children in any file that shows them', () => {
    expect(STATION_CREW).toHaveLength(3);
    expect(STATION_CREW.flat().sort()).toEqual(['aya', 'bebe', 'chock', 'gobgob']);
    for (const friend of Object.values(FRIENDS)) {
      expect(friend.art.src).toContain(`/makers/kit-${friend.id}-`);
      expect(friend.h).toBeGreaterThan(60);
    }
    // at the Dome the two who waited back along the trail join the two who wait there: the whole crew, nobody twice
    expect([...GATHER.map(g => g.who), ...STATION_CREW[2]].sort()).toEqual(['aya', 'bebe', 'chock', 'gobgob']);
    // nobody stands on Pep, on each other's feet, or behind the Dome's sun
    const feet = [...GATHER.map(g => g.dx), ...STATION_CREW[2].map(who => FRIENDS[who].dx)].sort((a, b) => a - b);
    for (let i = 1; i < feet.length; i++) expect(feet[i] - feet[i - 1]).toBeGreaterThan(70);
    // the Dome's sun stands tall behind them, its head clear of the tallest of the crew
    expect(DOME_SUN.y - DOME_SUN.size / 2).toBeGreaterThan(FRIENDS.gobgob.h); expect(DOME_SUN.y + DOME_SUN.size / 2).toBeGreaterThan(FRIENDS.bebe.h + 40);
    for (const g of GATHER) expect(Math.abs(g.dx)).toBeGreaterThan(80);
    // the trail's own plates are character-free
    for (const plate of Object.values(PLATES)) for (const tone of ['dusk', 'night'] as const) expect(plate[tone].src).not.toMatch(/bebe|gobgob|crew/);
  });
});
