import { describe, expect, it } from 'vitest';
import {
  DISCOVERIES, PARTS, SPRING_OMEGA, TIER_STRANDS, ZOOM_MAX, ZOOM_MIN, allFound, binFor, capOffset, chooseTier, clampCamera, clampZoom, discover,
  flowAngle, focusTarget, generateStrands, gustAt, isDiscovery, mixCamera, pointInPolygon, seeded, springStep, strokeWeight, trunkAngle, windStrength, zoomAbout,
  type Bounds, type FlowKind,
} from './iceAgeFriendRules';
import { mammothView, turnPoint, unturnPoint } from './mammothShape';

const BOUNDS: Bounds = { minX: 70, minY: 150, maxX: 910, maxY: 640 };
const HALF = { w: 600, h: 300 };

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
  it('zoom is held between 1 and 4', () => {
    expect(clampZoom(0.2)).toBe(ZOOM_MIN); expect(clampZoom(9)).toBe(ZOOM_MAX); expect(clampZoom(Number.NaN)).toBe(ZOOM_MIN);
  });
  it('clampCamera never lets the view leave the animal by more than the margin, at any zoom', () => {
    const margin = 70;
    for (const zoom of [1, 1.5, 2.5, 4]) for (const [x, y] of [[-5000, -5000], [5000, 5000], [490, 395], [0, 900], [Number.NaN, 300]]) {
      const c = clampCamera({ x, y }, zoom, BOUNDS, HALF, margin);
      const hw = HALF.w / zoom, hh = HALF.h / zoom;
      const wide = BOUNDS.maxX - BOUNDS.minX + 2 * margin < 2 * hw, tall = BOUNDS.maxY - BOUNDS.minY + 2 * margin < 2 * hh;
      if (wide) expect(c.x).toBeCloseTo((BOUNDS.minX + BOUNDS.maxX) / 2);
      else { expect(c.x - hw).toBeGreaterThanOrEqual(BOUNDS.minX - margin - 1e-6); expect(c.x + hw).toBeLessThanOrEqual(BOUNDS.maxX + margin + 1e-6); }
      if (tall) expect(c.y).toBeCloseTo((BOUNDS.minY + BOUNDS.maxY) / 2);
      else { expect(c.y - hh).toBeGreaterThanOrEqual(BOUNDS.minY - margin - 1e-6); expect(c.y + hh).toBeLessThanOrEqual(BOUNDS.maxY + margin + 1e-6); }
    }
  });
  it('zoomAbout keeps the focus point fixed on screen', () => {
    const cam = { x: 400, y: 380, zoom: 1.5 }, focus = { x: 520, y: 300 };
    const next = zoomAbout(cam, 2, focus);
    expect(next.zoom).toBe(3);
    expect((focus.x - next.x) * next.zoom).toBeCloseTo((focus.x - cam.x) * cam.zoom);
    expect((focus.y - next.y) * next.zoom).toBeCloseTo((focus.y - cam.y) * cam.zoom);
    expect(zoomAbout(cam, 100, focus).zoom).toBe(ZOOM_MAX);
  });
  it('each discovery has a focus target close up, inside bounds, near its ring', () => {
    for (const view of ['side', 'turned'] as const) {
      const v = mammothView(view);
      for (const [id, [x, y]] of Object.entries(v.hotspots)) {
        const t = focusTarget({ x, y }, v.bounds, HALF, 70);
        expect(t.zoom, id).toBeGreaterThan(2);
        const clamped = clampCamera(t, t.zoom, v.bounds, HALF, 70);
        expect(clamped.x).toBeCloseTo(t.x); expect(clamped.y).toBeCloseTo(t.y);
        // The ring stays on screen at the target.
        expect(Math.abs(x - t.x)).toBeLessThan(HALF.w / t.zoom); expect(Math.abs(y - t.y)).toBeLessThan(HALF.h / t.zoom);
      }
    }
  });
  it('mixCamera starts and ends exactly', () => {
    const a = { x: 0, y: 0, zoom: 1 }, b = { x: 100, y: 50, zoom: 4 };
    expect(mixCamera(a, b, 0)).toEqual(a); expect(mixCamera(a, b, 1)).toEqual(b);
    expect(mixCamera(a, b, 0.5).zoom).toBeCloseTo(2);
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

describe('the five discoveries', () => {
  it('finding adds once, keeps order, and all five finish', () => {
    let found = discover([], 'hump');
    found = discover(found, 'coats'); found = discover(found, 'hump'); found = discover(found, 'nonsense');
    expect(found).toEqual(['coats', 'hump']);
    expect(allFound(found)).toBe(false);
    for (const id of DISCOVERIES) found = discover(found, id);
    expect(found).toEqual([...DISCOVERIES]); expect(allFound(found)).toBe(true);
    expect(isDiscovery('ears')).toBe(true); expect(isDiscovery('wings')).toBe(false);
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
  it('the trunk hangs at rest and points up at the end of the lift', () => {
    expect(Math.sin(trunkAngle(0.3, 0, 0))).toBeGreaterThan(0.9);
    expect(Math.sin(trunkAngle(1, 1, 0))).toBeLessThan(-0.5);
  });
  it('the turned view faces the other way, and the warp can be undone', () => {
    const side = mammothView('side'), turned = mammothView('turned');
    expect(side.hotspots.tusks[0]).toBeLessThan(side.hotspots.coats[0]);
    expect(turned.hotspots.tusks[0]).toBeGreaterThan(turned.hotspots.coats[0]);
    for (const p of [[300, 300], [600, 500], [120, 450]] as const) {
      const [x, y] = unturnPoint(turnPoint(p));
      expect(x).toBeCloseTo(p[0], 2); expect(y).toBeCloseTo(p[1], 2);
    }
  });
});
