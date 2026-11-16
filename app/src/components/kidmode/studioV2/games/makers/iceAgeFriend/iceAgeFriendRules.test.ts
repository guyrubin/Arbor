import { describe, expect, it } from 'vitest';
import {
  DISCOVERIES, PARTS, SPRING_OMEGA, TIER_STRANDS, allFound, binFor, capOffset, chooseTier, discover,
  flowAngle, generateStrands, gustAt, isDiscovery, mixCamera, pointInPolygon, seeded, springStep, strokeWeight, trunkAngle, trunkHalfWidth, windStrength,
  type FlowKind,
} from './iceAgeFriendRules';
import { mammothView, strokePoint, toyAt, turnPoint, unturnPoint } from './mammothShape';


describe('seeded coat', () => {
  it('the generator is deterministic and in 0..1', () => {
    const a = seeded(7), b = seeded(7);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  });
  it('the same seed grows the same coat, and each tier has about its number of strands', () => {
    const view = mammothView('side');
    for (const tier of ['full', 'light'] as const) {
      const one = generateStrands(view.regions, tier, 42, { bounds: view.furBounds });
      const two = generateStrands(view.regions, tier, 42, { bounds: view.furBounds });
      expect(Array.from(one.rx)).toEqual(Array.from(two.rx));
      expect(Array.from(one.bin)).toEqual(Array.from(two.bin));
      expect(one.count).toBeGreaterThan(TIER_STRANDS[tier] * 0.85);
      expect(one.count).toBeLessThan(TIER_STRANDS[tier] * 1.1);
    }
    const full = generateStrands(view.regions, 'full', 1, { bounds: view.furBounds }).count;
    expect(full).toBeGreaterThanOrEqual(9000);
    const light = generateStrands(view.regions, 'light', 1, { bounds: view.furBounds }).count;
    expect(light).toBeGreaterThanOrEqual(3000); expect(light).toBeLessThanOrEqual(4000);
  });
  it('strands are sorted back to front: parts in order, undercoat before guard hair, lower rows first, and every part has hair', () => {
    const view = mammothView('side');
    const set = generateStrands(view.regions, 'full', 3, { bounds: view.furBounds });
    const order = set.parts.map(p => PARTS.indexOf(p.part));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const id of ['body', 'head', 'trunk', 'ear', 'legFront', 'legHind', 'tail'] as const) expect(set.parts.some(p => p.part === id && p.end > p.start)).toBe(true);
    for (const part of set.parts) {
      let seenGuard = false;
      for (const row of part.rows) { if (row.cls === 1) seenGuard = true; else expect(seenGuard).toBe(false); }
      if (part.part === 'trunk') continue;
      const guardRows = part.rows.filter(r => r.cls === 1).map(r => set.ry[r.start]);
      for (let i = 1; i < guardRows.length; i++) expect(Math.floor(guardRows[i] / 26)).toBeLessThanOrEqual(Math.floor(guardRows[i - 1] / 26));
    }
    // Roots of the body coat sit inside the body (or its fringe), never out on the snow.
    const body = set.parts.find(p => p.part === 'body')!;
    let inside = 0;
    for (let i = body.start; i < body.end; i++) if (pointInPolygon(set.rx[i], set.ry[i], view.shapes.body)) inside++;
    expect(inside / (body.end - body.start)).toBeGreaterThan(0.93);
  });
  it('the guard hair of the skirt is long and the head hair is short', () => {
    const view = mammothView('side');
    const set = generateStrands(view.regions, 'full', 5, { bounds: view.furBounds });
    const head = set.parts.find(p => p.part === 'head')!, body = set.parts.find(p => p.part === 'body')!;
    const max = (p: typeof head) => Math.max(...Array.from(set.len.slice(p.start, p.end)));
    expect(max(body)).toBeGreaterThan(70);
    expect(max(head)).toBeLessThan(40);
  });
  it('colour bins stay in range', () => {
    expect(binFor(-3)).toBe(0); expect(binFor(9)).toBe(6); expect(binFor(0.5)).toBe(3);
  });
});

describe('the flow field', () => {
  const down = Math.PI / 2;
  it('flank hair falls down and back; the skirt hangs; the crown tuft stands up', () => {
    for (const v of [0, 0.5, 1]) { const a = flowAngle('flank', 0.5, v); expect(Math.sin(a)).toBeGreaterThan(0.4); expect(Math.cos(a)).toBeGreaterThan(-0.05); }
    expect(Math.abs(flowAngle('skirt', 0.5, 0.5) - down)).toBeLessThan(0.15);
    expect(Math.sin(flowAngle('crownTuft', 0.5, 0.5))).toBeLessThan(0);
    expect(Math.cos(flowAngle('ridge', 0.5, 0))).toBeGreaterThan(0.6);
  });
  it('every kind gives a finite angle', () => {
    for (const kind of ['flank', 'ridge', 'skirt', 'head', 'crownTuft', 'ear', 'leg', 'tail', 'sheath'] as FlowKind[]) expect(Number.isFinite(flowAngle(kind, 0.3, 0.7))).toBe(true);
  });
});

describe('camera', () => {
  it('mixCamera starts and ends exactly, and zooms evenly', () => {
    const a = { x: 0, y: 0, zoom: 1 }, b = { x: 100, y: 50, zoom: 4 };
    expect(mixCamera(a, b, 0)).toEqual(a); expect(mixCamera(a, b, 1)).toEqual(b);
    expect(mixCamera(a, b, 0.5).zoom).toBeCloseTo(2);
    expect(mixCamera(a, b, -3)).toEqual(a); expect(mixCamera(a, b, 9)).toEqual(b);
  });
});

describe('springs, strokes and wind', () => {
  it('a combed strand is back at rest within about a second and a half', () => {
    let o = 30, v = 0, t = 0;
    while (t < 1.6) { [o, v] = springStep(o, v, 1 / 60); t += 1 / 60; }
    expect(Math.abs(o)).toBeLessThan(1.5);
    let o2 = 30, v2 = 0;
    for (let i = 0; i < 15; i++) [o2, v2] = springStep(o2, v2, 1 / 60);
    expect(o2).toBeGreaterThan(20); // still visibly combed a quarter second later
    expect(SPRING_OMEGA).toBeGreaterThan(0);
  });
  it('a long frame cannot blow the spring up', () => {
    let o = 30, v = 0;
    for (let i = 0; i < 20; i++) [o, v] = springStep(o, v, 2);
    expect(Math.abs(o)).toBeLessThan(30);
  });
  it('the stroke pushes most at the finger and nothing beyond its reach', () => {
    expect(strokeWeight(0, 30)).toBe(1); expect(strokeWeight(30, 30)).toBe(0); expect(strokeWeight(15, 30)).toBeCloseTo(0.25);
  });
  it('hair bends but does not stretch', () => {
    const [x, y] = capOffset(300, 400, 40);
    expect(Math.hypot(x, y)).toBeCloseTo(34); expect(capOffset(3, 4, 40)).toEqual([3, 4]);
  });
  it('the gust travels with the wind and stays in 0..strength', () => {
    const at = (x: number, t: number) => gustAt(x, t, 1);
    // A crest at x moves to larger x later.
    const xs = Array.from({ length: 400 }, (_, i) => i * 2);
    const crest = (t: number) => xs.reduce((best, x) => (at(x, t) > at(best, t) ? x : best), 0);
    const c0 = crest(0), c1 = crest(0.2);
    expect(c1).toBeGreaterThan(c0);
    for (const t of [0, 1.3, 7]) for (const x of [0, 300, 800]) { const g = gustAt(x, t, windStrength(t)); expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(1); }
  });
});

describe('quality tier', () => {
  it('drops to light when frames average over ~24 ms, and never climbs back', () => {
    expect(chooseTier(Array(30).fill(16))).toBe('full');
    expect(chooseTier(Array(30).fill(33))).toBe('light');
    expect(chooseTier(Array(3).fill(80))).toBe('full');
    expect(chooseTier(Array(30).fill(10), 'light')).toBe('light');
  });
});

describe('the five pictures', () => {
  it('finding adds once, keeps the story order, and all five finish', () => {
    let found = discover([], 'hump');
    found = discover(found, 'coats'); found = discover(found, 'hump'); found = discover(found, 'nonsense');
    expect(found).toEqual(['coats', 'hump']);
    expect(allFound(found)).toBe(false);
    for (const id of DISCOVERIES) found = discover(found, id);
    expect(found).toEqual([...DISCOVERIES]); expect(allFound(found)).toBe(true);
    expect(DISCOVERIES).toHaveLength(5);
    // The small ears are the visit's secret, not one of the five; the herd is.
    expect(isDiscovery('herd')).toBe(true); expect(isDiscovery('ears')).toBe(false); expect(isDiscovery('wings')).toBe(false);
  });
});

describe('the animal', () => {
  it('is anatomically a woolly mammoth: a high domed crown, a dip at the neck, a hump, a back sloping to low hips', () => {
    const v = mammothView('side');
    const top = (poly: readonly (readonly [number, number])[], x0: number, x1: number) => Math.min(...poly.filter(([x]) => x >= x0 && x <= x1).map(([, y]) => y));
    const crown = top(v.shapes.head, 330, 400), neck = top(v.shapes.body, 430, 455), hump = top(v.shapes.body, 500, 560), hips = top(v.shapes.body, 780, 840);
    expect(crown).toBeLessThan(neck); expect(hump).toBeLessThan(neck); expect(hips).toBeGreaterThan(hump + 100);
    // Small ears: the ear is a small fraction of the head.
    const area = (p: readonly (readonly [number, number])[]) => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(s / 2); };
    expect(area(v.shapes.ear) / area(v.shapes.head)).toBeLessThan(0.1);
    // Long tusks reach well in front of the face.
    const tuskX = Math.min(...v.tusks.near.flat().map(([x]) => x));
    expect(tuskX).toBeLessThan(Math.min(...v.shapes.head.map(([x]) => x)) - 120);
  });
  it('the trunk hangs at rest, points up at the end of the lift, and curls back to the mouth with a tuft', () => {
    expect(Math.sin(trunkAngle(0.3, 0, 0))).toBeGreaterThan(0.9);
    expect(Math.sin(trunkAngle(1, 1, 0))).toBeLessThan(-0.5);
    // Curled, the tip ends up beside the mouth: behind the trunk's root and not far below it.
    let x = 300, y = 294;
    const n = 28, step = 300 / (n - 1);
    for (let i = 0; i < n - 1; i++) { const a = (trunkAngle(i / (n - 1), 0, 0, 1) + trunkAngle((i + 1) / (n - 1), 0, 0, 1)) / 2; x += Math.cos(a) * step; y += Math.sin(a) * step; }
    const mouth = mammothView('side').mouth;
    expect(Math.hypot(x - mouth[0], y - mouth[1])).toBeLessThan(40);
    expect(trunkAngle(0.5, 0, 0, 0)).toBe(trunkAngle(0.5, 0, 0));
  });
  it('the trunk tapers: broad where it leaves the face, slim at the tip, narrowing all the way', () => {
    expect(trunkHalfWidth(0)).toBeGreaterThan(30); expect(trunkHalfWidth(1)).toBeLessThan(12); expect(trunkHalfWidth(1)).toBeGreaterThan(8);
    for (let s = 0.05; s <= 1; s += 0.05) expect(trunkHalfWidth(s)).toBeLessThan(trunkHalfWidth(s - 0.05));
  });
  it('turned about, it is the same animal facing the other way: an honest mirror, the same size, and the turn can be undone', () => {
    const side = mammothView('side'), turned = mammothView('turned');
    expect(side.hotspots.tusks[0]).toBeLessThan(side.hotspots.coats[0]);
    expect(turned.hotspots.tusks[0]).toBeGreaterThan(turned.hotspots.coats[0]);
    for (const p of [[300, 300], [600, 500], [120, 450]] as const) {
      const [x, y] = unturnPoint(turnPoint(p));
      expect(x).toBeCloseTo(p[0], 2); expect(y).toBeCloseTo(p[1], 2);
      // No part grows or shrinks on the way round: heights are untouched.
      expect(turnPoint(p)[1]).toBe(p[1]);
    }
    const w = (v: typeof side) => v.bounds.maxX - v.bounds.minX, h = (v: typeof side) => v.bounds.maxY - v.bounds.minY;
    expect(w(turned)).toBeCloseTo(w(side), 3); expect(h(turned)).toBeCloseTo(h(side), 3);
    // Both sides fill the same frame, so turning never slides the animal across the stage.
    expect(Math.abs((turned.bounds.minX + turned.bounds.maxX) / 2 - (side.bounds.minX + side.bounds.maxX) / 2)).toBeLessThan(4);
    expect(turned.groundY).toBe(side.groundY);
  });
  it('snow lies along the top of the animal, the hint stroke runs down the back, and the face has an eye above a mouth', () => {
    for (const id of ['side', 'turned'] as const) {
      const v = mammothView(id);
      expect(v.snow.length).toBeGreaterThanOrEqual(10);
      for (const spot of v.snow) {
        const shape = spot.part === 'head' ? v.shapes.head : v.shapes.body;
        const top = Math.min(...shape.filter(([x]) => Math.abs(x - spot.at[0]) < 24).map(([, y]) => y));
        expect(Math.abs(spot.at[1] - top), `${id} ${spot.at}`).toBeLessThan(40);
      }
      const from = strokePoint(v, 0), to = strokePoint(v, 1);
      expect(pointInPolygon(from[0], from[1], v.shapes.body)).toBe(true); expect(pointInPolygon(to[0], to[1], v.shapes.body)).toBe(true);
      expect(to[1]).toBeGreaterThan(from[1]);
      expect(v.eye[1]).toBeLessThan(v.mouth[1]);
      expect(pointInPolygon(v.eye[0], v.eye[1], v.shapes.head)).toBe(true);
    }
  });
  it('a tap finds the toy under it: trunk tip, tusk, the spot behind the ear, tail, a foot, the coat, or nothing', () => {
    const v = mammothView('side'), tip: [number, number] = [262, 596];
    const hit = (x: number, y: number) => toyAt(v, x, y, tip, pointInPolygon);
    expect(hit(tip[0] + 6, tip[1] - 4)?.toy).toBe('trunkTip');
    expect(hit(120, 454)?.toy).toBe('tuskNear');
    expect(hit(v.tickle[0], v.tickle[1])?.toy).toBe('earSpot');
    expect(hit(880, 430)?.toy).toBe('tailTip');
    expect(hit(750, 600)).toEqual({ toy: 'footNear', leg: 'legHind' });
    expect(hit(600, 400)?.toy).toBe('coat');
    expect(hit(40, 100)).toBeNull();
  });
});
