import { describe, expect, it } from 'vitest';
import {
  ASSIST_DEG, ASSIST_DIST, BOWL_GLAZES, BOWL_SEAM_COUNTS, HOME, ROTATE_STEP, SEAM_COVER, SNAP_DEG, SNAP_DIST,
  allPlaced, allTraced, assist, coverage, coverageDash, distanceToSegment, fits, flowFrom, markCoverage, normalizeDeg, pickPattern,
  pointInPolygon, polylineLength, poseAt, posePoint, rotate, samplePolyline, seamCovered, seamNear, slotAt, tapPose, tipPose, traceSeam, validBowl,
  type BowlPattern, type Point,
} from './mendBowlRules';
import { BOWL_CENTRE, BOWL_PATTERNS, BOWL_R, LINEN_R, OUTLINE_AREA, OUTLINE_POINTS, STAGE, outlineAt } from './mendBowlPatterns';

const area = (poly: readonly Point[]) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2);
const near = (a: Point, b: Point, eps = 1e-6) => Math.hypot(a.x - b.x, a.y - b.y) <= eps;

describe('mend-bowl: the creation contract', () => {
  it('accepts every glaze and pattern with a full permutation of seams', () => {
    for (const glaze of BOWL_GLAZES) for (const pattern of [0, 1, 2] as const) {
      const n = BOWL_SEAM_COUNTS[pattern];
      expect(validBowl({ kind: 'bowl', glaze, pattern, seams: Array.from({ length: n }, (_, i) => n - 1 - i) })).toBe(true);
    }
  });
  it('refuses repeats, gaps, wrong lengths, unknown glazes and patterns', () => {
    expect(validBowl({ kind: 'bowl', glaze: 'rose', pattern: 0, seams: [0, 1, 2, 2] })).toBe(false);
    expect(validBowl({ kind: 'bowl', glaze: 'rose', pattern: 0, seams: [0, 1, 2] })).toBe(false);
    expect(validBowl({ kind: 'bowl', glaze: 'rose', pattern: 0, seams: [0, 1, 2, 4] })).toBe(false);
    expect(validBowl({ kind: 'bowl', glaze: 'gold', pattern: 0, seams: [0, 1, 2, 3] })).toBe(false);
    expect(validBowl({ kind: 'bowl', glaze: 'rose', pattern: 3, seams: [0, 1, 2, 3] })).toBe(false);
    expect(validBowl({ kind: 'bowl', glaze: 'rose', pattern: 0, seams: [0, 1, 2, 1.5] })).toBe(false);
    expect(validBowl(null)).toBe(false);
  });
});

describe('mend-bowl: the authored break patterns', () => {
  it('have 4, 5 and 6 pieces and BOWL_SEAM_COUNTS matches the seam data', () => {
    expect(BOWL_PATTERNS.map(p => p.pieces.length)).toEqual([4, 5, 6]);
    expect(BOWL_PATTERNS.map(p => p.seams.length)).toEqual([...BOWL_SEAM_COUNTS]);
  });
  it.each([0, 1, 2] as const)('pattern %i: the pieces tile the bowl exactly, with no overlap', (k) => {
    const pat = BOWL_PATTERNS[k];
    const total = pat.pieces.reduce((s, p) => s + area(p.polygon), 0);
    expect(Math.abs(total - OUTLINE_AREA) / OUTLINE_AREA).toBeLessThan(1e-3);
    // Every piece's centre lies in that piece and in no other.
    pat.pieces.forEach((p, i) => pat.pieces.forEach((q, j) => {
      const inside = pointInPolygon(p.centroid, q.polygon);
      if (i === j) expect(inside || slotAt(pat, p.centroid) === -1).toBe(true); else expect(inside).toBe(false);
    }));
    for (const p of pat.pieces) expect(area(p.polygon)).toBeGreaterThan(2500);
  });
  it.each([0, 1, 2] as const)('pattern %i: each seam lies exactly on the shared edge of the two pieces it joins', (k) => {
    const pat = BOWL_PATTERNS[k];
    pat.seams.forEach((seam, s) => {
      const [a, b] = seam.between;
      expect(a).not.toBe(b);
      expect(pat.pieces[a].seams).toContain(s); expect(pat.pieces[b].seams).toContain(s);
      expect(pat.pieces.filter(p => p.seams.includes(s))).toHaveLength(2);
      // Every point of the seam is a vertex of both pieces' outlines.
      for (const point of seam.points) for (const owner of [a, b]) expect(pat.pieces[owner].polygon.some(v => near(v, point))).toBe(true);
      expect(seam.length).toBeCloseTo(polylineLength(seam.points), 6);
    });
  });
  it.each([0, 1, 2] as const)('pattern %i: scattered pieces stay on the stage, start turned, and do not pile up', (k) => {
    const pat = BOWL_PATTERNS[k];
    for (const piece of pat.pieces) {
      for (const v of piece.polygon) {
        const p = posePoint(piece, piece.start, v);
        expect(p.x).toBeGreaterThan(4); expect(p.x).toBeLessThan(STAGE.w - 4);
        expect(p.y).toBeGreaterThan(4); expect(p.y).toBeLessThan(STAGE.h - 4);
      }
      // …and on the table's linen top, which is all the smallest stage is sure to show.
      for (const v of piece.polygon) { const p = posePoint(piece, piece.start, v); expect(Math.hypot(p.x - BOWL_CENTRE.x, p.y - BOWL_CENTRE.y)).toBeLessThan(LINEN_R); }
      expect(fits(piece, piece.start)).toBe(false);
      expect(Math.abs(piece.start.r) % ROTATE_STEP).toBe(0);
      expect(Math.abs(piece.start.r)).toBeGreaterThan(SNAP_DEG);
    }
    const starts = pat.pieces.map(p => ({ x: p.centroid.x + p.start.x, y: p.centroid.y + p.start.y }));
    starts.forEach((a, i) => starts.forEach((b, j) => { if (i < j) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(50); }));
  });
  it('the keyboard seam spots are far enough apart to tell apart', () => {
    for (const pat of BOWL_PATTERNS) {
      const mids = pat.seams.map(s => { const pts = samplePolyline(s.points); return pts[Math.floor(pts.length / 2)]; });
      mids.forEach((a, i) => mids.forEach((b, j) => { if (i < j) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(30); }));
    }
  });
  it('the outline is the round rim, seen from above, centred on the table', () => {
    for (const t of [0, 0.37, 1, 2.5, 3.99]) expect(Math.hypot(outlineAt(t).x - BOWL_CENTRE.x, outlineAt(t).y - BOWL_CENTRE.y)).toBeCloseTo(BOWL_R, 6);
    expect(near(outlineAt(0), { x: BOWL_CENTRE.x - BOWL_R, y: BOWL_CENTRE.y })).toBe(true);
    expect(near(outlineAt(1), { x: BOWL_CENTRE.x, y: BOWL_CENTRE.y - BOWL_R })).toBe(true);
    expect(OUTLINE_AREA / (Math.PI * BOWL_R * BOWL_R)).toBeGreaterThan(0.998);
    expect(BOWL_CENTRE).toEqual({ x: STAGE.w / 2, y: STAGE.h / 2 });
    for (const pat of BOWL_PATTERNS) for (const seam of pat.seams) for (const p of seam.points) expect(Math.hypot(p.x - BOWL_CENTRE.x, p.y - BOWL_CENTRE.y)).toBeLessThan(BOWL_R + 1e-6);
  });
  it('the outline is closed and the same every time', () => {
    expect(OUTLINE_POINTS.length).toBeGreaterThan(100);
    expect(JSON.stringify(BOWL_PATTERNS)).toBe(JSON.stringify(BOWL_PATTERNS));
  });
});

describe('mend-bowl: fitting', () => {
  const pat = BOWL_PATTERNS[1], piece = pat.pieces[0];
  it('a piece fits only near its own home and nearly upright', () => {
    expect(fits(piece, HOME)).toBe(true);
    expect(fits(piece, { x: SNAP_DIST - 1, y: 0, r: SNAP_DEG - 1 })).toBe(true);
    expect(fits(piece, { x: SNAP_DIST + 1, y: 0, r: 0 })).toBe(false);
    expect(fits(piece, { x: 0, y: 0, r: SNAP_DEG + 1 })).toBe(false);
    expect(fits(piece, { x: 0, y: 0, r: 360 })).toBe(true);
  });
  it('each piece fits only its own place: put at another piece’s home, it does not fit', () => {
    for (const p of BOWL_PATTERNS) p.pieces.forEach((a, i) => p.pieces.forEach((b, j) => {
      if (i !== j) expect(fits(a, assist(poseAt(a, b.centroid, 0)))).toBe(false);
    }));
  });
  it('turning goes in 15° steps and wraps', () => {
    expect(rotate({ x: 1, y: 2, r: 170 }, ROTATE_STEP)).toEqual({ x: 1, y: 2, r: -175 });
    expect(rotate({ x: 0, y: 0, r: -45 }, ROTATE_STEP).r).toBe(-30);
    expect(normalizeDeg(-190)).toBe(170); expect(normalizeDeg(540)).toBe(180);
  });
  it('near home the last few degrees ease in; far away or very turned they do not', () => {
    expect(assist({ x: 0, y: 0, r: 30 }).r).toBe(0);
    expect(fits(piece, assist({ x: 20, y: 0, r: ASSIST_DEG }))).toBe(true);
    expect(assist({ x: ASSIST_DIST, y: 0, r: 30 }).r).toBe(30);
    expect(assist({ x: 0, y: 0, r: ASSIST_DEG + 5 }).r).toBe(ASSIST_DEG + 5);
    expect(fits(piece, assist({ x: 0, y: 0, r: 45 }))).toBe(false);
  });
  it('a tap inside a piece’s own place sends it home; anywhere else it goes to the tapped point', () => {
    expect(slotAt(pat, piece.centroid)).toBe(0);
    expect(tapPose(pat, 0, piece.centroid, 10)).toEqual({ x: 0, y: 0, r: 10 });
    const other = pat.pieces[2].centroid;
    expect(tapPose(pat, 0, other, 10)).toEqual(poseAt(piece, other, 10));
    expect(fits(piece, assist(tapPose(pat, 0, other, 0)))).toBe(false);
  });
  it('the tip carries every piece the same way, as one bowl', () => {
    const pivot = { x: 272, y: 268 };
    const posed = pat.pieces.map(p => posePoint(p, tipPose(p, pivot, 9, { x: 0, y: 0 }), pivot));
    for (const p of posed) expect(near(p, pivot, 1e-6)).toBe(true);
  });
  it('all placed / all traced', () => {
    expect(allPlaced([true, true, true, true, true], pat)).toBe(true);
    expect(allPlaced([true, true, false, true, true], pat)).toBe(false);
    expect(allTraced([4, 2, 0, 1, 3], pat)).toBe(true);
    expect(allTraced([4, 2, 0, 1], pat)).toBe(false);
    expect(allTraced([4, 2, 0, 1, 1], pat)).toBe(false);
    expect(traceSeam(traceSeam([], 3), 3)).toEqual([3]);
  });
  it('a replay never repeats the last pattern and covers the others', () => {
    for (const last of [0, 1, 2] as BowlPattern[]) {
      const seen = new Set([0, 0.3, 0.49, 0.5, 0.75, 0.999999].map(r => pickPattern(r, last)));
      expect(seen.has(last)).toBe(false); expect(seen.size).toBe(2);
    }
    expect(new Set([0, 0.4, 0.9].map(r => pickPattern(r, null))).size).toBe(3);
  });
});

describe('mend-bowl: tracing gold', () => {
  const seam = BOWL_PATTERNS[2].seams[1];
  const along = (from: number, to: number) => { const s = samplePolyline(seam.points); return s.slice(Math.floor(s.length * from), Math.ceil(s.length * to)); };
  it('needs most of the seam, with a generous tolerance', () => {
    expect(seamCovered(seam, along(0, 1), 1)).toBe(true);
    expect(seamCovered(seam, along(0, 0.9), 2)).toBe(true);
    expect(seamCovered(seam, along(0, 0.6), 2)).toBe(false);
    // A path drawn 20 units to the side of the line (this crack runs up the bowl) still counts at 28; not at 10.
    const shifted = along(0, 1).map(p => ({ x: p.x + 20, y: p.y }));
    expect(seamCovered(seam, shifted, 28)).toBe(true);
    expect(seamCovered(seam, shifted, 10)).toBe(false);
    expect(SEAM_COVER).toBe(0.8);
  });
  it('coverage builds up stroke by stroke, and the dash paints exactly the covered runs', () => {
    const samples = samplePolyline(seam.points);
    let covered = samples.map(() => false);
    expect(coverageDash(covered)).toBe('0 1');
    const pts = along(0, 0.5);
    for (let i = 1; i < pts.length; i++) covered = markCoverage(samples, covered, pts[i - 1], pts[i], 3);
    expect(coverage(covered)).toBeGreaterThan(0.4); expect(coverage(covered)).toBeLessThan(0.65);
    const dash = coverageDash(covered).split(' ').map(Number);
    expect(dash[0]).toBe(0); expect(dash.length % 2).toBe(0);
    expect(dash[1]).toBe(0); expect(dash[2]).toBeGreaterThan(0.4);
  });
  it('a tap finds the nearest seam still waiting, and gold flows from the nearer end', () => {
    const pat = BOWL_PATTERNS[2], mid = samplePolyline(seam.points)[10];
    expect(seamNear(pat, mid, 10)).toBe(1);
    expect(seamNear(pat, mid, 10, [1])).not.toBe(1);
    expect(seamNear(pat, { x: 5, y: 5 }, 10)).toBe(-1);
    expect(flowFrom(seam, seam.points[0])).toBe(0);
    expect(flowFrom(seam, seam.points[seam.points.length - 1])).toBe(1);
    expect(distanceToSegment({ x: 0, y: 5 }, { x: -1, y: 0 }, { x: 1, y: 0 })).toBe(5);
  });
});
