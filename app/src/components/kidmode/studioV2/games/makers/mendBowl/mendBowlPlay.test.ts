import { describe, expect, it } from 'vitest';
import { BOWL_GLAZES, ROTATE_STEP, SEAM_COVER, SNAP_DEG, assist, fits, posePoint, samplePolyline } from './mendBowlRules';
import { BOWL_CENTRE, BOWL_PATTERNS, BOWL_R, LINEN_R } from './mendBowlPatterns';
import {
  GLAZE_SPOTS, NEAR_DIST, SEAM_LIFT_COVER, SWIRLS, TABLE_SPOTS, TRACE_STEPS, VIEW_BASE, VIEW_CENTRE, VIEW_MAX, VIEW_TOP,
  FRIEND_TALL, arrange, easeFlow, easiestPiece, liftCompletes, mostTurned, nearestSample, pointAlong, stageView, standingSpot, toUnits, traceStep, turnToward, unitsPerPixel, waitsForTurn,
} from './mendBowlPlay';
import { TABLE_BOX } from './BowlArt';
import { KIT_BEBE, KIT_TABLE, MEND_BOWL_ART } from './mendKit';

describe('mend-bowl: the table, framed for the screen', () => {
  it('keeps the bowl in the middle and shows more table on a tall or a wide stage', () => {
    expect(stageView(440, 470)).toEqual({ x: 0, y: -15, w: 440, h: 470 });
    expect(stageView(0, 0)).toEqual({ x: 0, y: -15, w: VIEW_BASE.w, h: VIEW_BASE.h });
    const phone = stageView(348, 427), wide = stageView(700, 600), tall = stageView(348, 526);
    expect(phone.w).toBe(440); expect(phone.h).toBe(540); expect(phone.y + phone.h / 2).toBe(VIEW_CENTRE.y);
    expect(wide.h).toBe(470); expect(wide.w).toBeGreaterThan(500); expect(wide.x + wide.w / 2).toBe(VIEW_CENTRE.x);
    // Past the top of the picture, a taller stage shows the floor in front of the table instead.
    expect(tall.y).toBe(VIEW_TOP); expect(tall.h).toBe(665);
    expect(stageView(300, 900).h).toBe(VIEW_MAX.h); expect(stageView(2000, 400).w).toBe(VIEW_MAX.w);
  });
  it('never looks past the edge of the table picture', () => {
    for (const [w, h] of [[348, 427], [348, 526], [700, 600], [300, 900], [2000, 400], [440, 470]] as const) {
      const v = stageView(w, h);
      expect(v.x).toBeGreaterThanOrEqual(TABLE_BOX.x); expect(v.x + v.w).toBeLessThanOrEqual(TABLE_BOX.x + TABLE_BOX.w);
      expect(v.y).toBeGreaterThanOrEqual(TABLE_BOX.y); expect(v.y + v.h).toBeLessThanOrEqual(TABLE_BOX.y + TABLE_BOX.h);
    }
    // The picture is placed so the table's linen top is centred on the bowl.
    const scale = TABLE_BOX.w / KIT_TABLE.w;
    expect(TABLE_BOX.x + KIT_TABLE.centre.x * scale).toBeCloseTo(BOWL_CENTRE.x, 6); expect(TABLE_BOX.y + KIT_TABLE.centre.y * scale).toBeCloseTo(BOWL_CENTRE.y, 6);
    expect(KIT_TABLE.linen * scale).toBeCloseTo(LINEN_R, 6);
  });
  it('maps a pointer to stage units and back, whatever the stage shape', () => {
    for (const [w, h] of [[348, 427], [348, 526], [660, 600]] as const) {
      const v = stageView(w, h);
      const mid = toUnits(v, w, h, w / 2, h / 2);
      expect(mid.x).toBeCloseTo(v.x + v.w / 2, 6); expect(mid.y).toBeCloseTo(v.y + v.h / 2, 6);
      const corner = toUnits(v, w, h, 0, 0);
      expect(corner.x).toBeCloseTo(v.x, 0); expect(corner.y).toBeCloseTo(v.y, 0);
      expect(unitsPerPixel(v, w, h)).toBeCloseTo(v.w / w, 1);
    }
    // A stage wider than the picture allows is letterboxed: the middle is still the middle.
    const capped = stageView(2000, 400), middle = toUnits(capped, 2000, 400, 1000, 200);
    expect(middle.x).toBeCloseTo(VIEW_CENTRE.x, 6); expect(middle.y).toBeCloseTo(capped.y + capped.h / 2, 6);
    expect(toUnits(stageView(0, 0), 0, 0, 5, 5)).toEqual(VIEW_CENTRE);
  });
  it('stands everything on the table inside the smallest view, clear of the bowl and of each other', () => {
    const small = stageView(440, 470), spots = [...Object.values(TABLE_SPOTS), ...GLAZE_SPOTS];
    for (const s of spots) {
      expect(s.x - s.size / 2).toBeGreaterThanOrEqual(small.x); expect(s.x + s.size / 2).toBeLessThanOrEqual(small.x + small.w);
      expect(s.y - s.size / 2).toBeGreaterThanOrEqual(small.y); expect(s.y + s.size / 2).toBeLessThanOrEqual(small.y + small.h);
      expect(Math.hypot(s.x - BOWL_CENTRE.x, s.y - BOWL_CENTRE.y) - s.size / 2).toBeGreaterThan(BOWL_R + 4);
    }
    expect(GLAZE_SPOTS).toHaveLength(BOWL_GLAZES.length);
    // Glaze dishes are tap targets: far enough apart that two never share a fingertip.
    GLAZE_SPOTS.forEach((a, i) => GLAZE_SPOTS.forEach((b, j) => { if (i < j) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(66); }));
    for (let i = 1; i < GLAZE_SPOTS.length; i++) expect(GLAZE_SPOTS[i].x).toBeGreaterThan(GLAZE_SPOTS[i - 1].x);
  });
  it('stands a friend on the floor of a tall stage or beside the table on a wide one, never over the tools', () => {
    const tall = standingSpot(stageView(348, 526))!, wide = standingSpot(stageView(686, 608))!;
    expect(tall.feet).toBeLessThanOrEqual(-50 + 665); expect(tall.tall).toBeGreaterThan(150); expect(tall.tall).toBeLessThanOrEqual(FRIEND_TALL);
    for (const h of [500, 510, 526]) { const spot = standingSpot(stageView(348, h))!; expect(spot.feet - spot.tall).toBeGreaterThan(TABLE_SPOTS.gold.y + TABLE_SPOTS.gold.size / 2); }
    // On a tall stage the figure's head stays below the gold dish and the roller.
    expect(tall.feet - tall.tall).toBeGreaterThan(TABLE_SPOTS.gold.y + TABLE_SPOTS.gold.size / 2);
    // On a wide stage it stands left of them.
    expect(wide.x + FRIEND_TALL * 285 / 768).toBeLessThanOrEqual(TABLE_SPOTS.gold.x - TABLE_SPOTS.gold.size / 2);
    // A squarish stage shows neither floor nor room at the side: no figure, rather than one on top of the tools.
    expect(standingSpot(stageView(440, 470))).toBeNull(); expect(standingSpot(stageView(348, 427))).toBeNull();
  });
  it('lists every picture with its size and where it came from', () => {
    for (const art of MEND_BOWL_ART) { expect(art.src).toMatch(/^\/visuals\/studio-v2\/(bop|makers)\/[a-z0-9-]+\.webp$/); expect(art.w).toBeGreaterThan(0); expect(art.h).toBeGreaterThan(0); expect(art.from.length).toBeGreaterThan(10); }
    // Our own cut pictures carry the activity's name and none of them shows a child. A child only ever
    // comes from the shared kit library, in a file whose name says so (the likeness register goes by name).
    for (const art of MEND_BOWL_ART) if (art.src.includes('/makers/')) {
      expect(art.src).toMatch(/\/makers\/(mend-bowl|kit)-/);
      if (art.src.includes('/makers/mend-bowl-')) expect(art.src).not.toMatch(/bebe|gobgob|crew/);
    }
    expect(KIT_BEBE.src).toMatch(/\/makers\/kit-bebe-[a-z-]+\.webp$/);
    expect(MEND_BOWL_ART.filter(art => /bebe|gobgob|crew/.test(art.src))).toEqual([KIT_BEBE]);
  });
});

describe('mend-bowl: a replay is a different puzzle', () => {
  it.each([0, 1, 2] as const)('pattern %i: every arrangement stays on the linen, turned, apart, and away from home', (k) => {
    const pat = BOWL_PATTERNS[k];
    expect(arrange(pat, 0, BOWL_CENTRE)).toEqual(pat.pieces.map(p => p.start));
    expect(arrange(pat, SWIRLS.length, BOWL_CENTRE)).toEqual(arrange(pat, 0, BOWL_CENTRE));
    for (let variant = 0; variant < SWIRLS.length; variant++) {
      const poses = arrange(pat, variant, BOWL_CENTRE);
      expect(poses).toHaveLength(pat.pieces.length);
      pat.pieces.forEach((piece, i) => {
        for (const v of piece.polygon) { const p = posePoint(piece, poses[i], v); expect(Math.hypot(p.x - BOWL_CENTRE.x, p.y - BOWL_CENTRE.y)).toBeLessThan(LINEN_R); }
        expect(fits(piece, assist(poses[i]))).toBe(false);
        expect(Math.abs(poses[i].r) % ROTATE_STEP).toBe(0); expect(Math.abs(poses[i].r)).toBeGreaterThan(SNAP_DEG);
      });
      const at = pat.pieces.map((p, i) => ({ x: p.centroid.x + poses[i].x, y: p.centroid.y + poses[i].y }));
      at.forEach((a, i) => at.forEach((b, j) => { if (i < j) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(50); }));
    }
    expect(arrange(pat, 1, BOWL_CENTRE)).not.toEqual(arrange(pat, 0, BOWL_CENTRE));
    expect(arrange(pat, 2, BOWL_CENTRE)).not.toEqual(arrange(pat, 1, BOWL_CENTRE));
  });
});

describe('mend-bowl: fitting, kindly', () => {
  it('a piece at its place but still turned waits there, and one lit turn finishes it', () => {
    expect(waitsForTurn({ x: 10, y: -8, r: 45 })).toBe(true);
    expect(waitsForTurn({ x: 10, y: -8, r: 20 })).toBe(false);
    expect(waitsForTurn({ x: NEAR_DIST + 5, y: 0, r: 45 })).toBe(false);
    expect(turnToward({ x: 0, y: 0, r: 45 })).toBe(-ROTATE_STEP); expect(turnToward({ x: 0, y: 0, r: -45 })).toBe(ROTATE_STEP);
    // Every authored turn is at most one helpful step from clicking in once the piece is parked at home.
    for (const pat of BOWL_PATTERNS) for (const piece of pat.pieces) {
      let pose = { x: 0, y: 0, r: piece.start.r };
      if (!fits(piece, assist(pose))) pose = assist({ ...pose, r: pose.r + turnToward(pose) });
      expect(fits(piece, assist(pose))).toBe(true);
    }
  });
  it('a turn button with nothing chosen picks the most turned loose piece; the hint shows the easiest', () => {
    const poses = [{ x: 0, y: 0, r: 30 }, { x: 0, y: 0, r: -45 }, { x: 0, y: 0, r: 45 }];
    expect(mostTurned(poses, [false, false, false])).toBe(1);
    expect(mostTurned(poses, [false, true, false])).toBe(2);
    expect(mostTurned(poses, [true, true, true])).toBe(-1);
    expect(easiestPiece(poses, [false, false, false])).toBe(0);
    expect(easiestPiece(poses, [true, false, false])).toBe(1);
    expect(easiestPiece(poses, [true, true, true])).toBe(-1);
    // Every break has a piece the hint can show clicking in with no turning at all.
    for (const pat of BOWL_PATTERNS) { const i = easiestPiece(pat.pieces.map(p => p.start), pat.pieces.map(() => false)); expect(fits(pat.pieces[i], assist({ x: 0, y: 0, r: pat.pieces[i].start.r }))).toBe(true); }
  });
});

describe('mend-bowl: tracing, kindly', () => {
  const line = samplePolyline(BOWL_PATTERNS[1].seams[2].points);
  it('a finger that lifts with half a crack covered has done enough', () => {
    expect(SEAM_LIFT_COVER).toBeLessThan(SEAM_COVER);
    expect(liftCompletes(0.49)).toBe(false); expect(liftCompletes(0.5)).toBe(true); expect(liftCompletes(0.79)).toBe(true);
    // At the full mark the gold is already running: lifting adds nothing.
    expect(liftCompletes(SEAM_COVER)).toBe(false);
  });
  it('finds the nearest point of a crack and walks along it', () => {
    expect(nearestSample(line, line[5])).toEqual({ index: 5, distance: 0 });
    expect(nearestSample(line, { x: line[3].x + 0.4, y: line[3].y }).index).toBe(3);
    expect(nearestSample([], { x: 0, y: 0 }).index).toBe(-1);
    expect(pointAlong(line, 0)).toEqual(line[0]); expect(pointAlong(line, 1)).toEqual(line[line.length - 1]); expect(pointAlong(line, 7)).toEqual(line[line.length - 1]);
    const half = pointAlong(line, 0.5);
    expect(Math.min(...line.map(p => Math.hypot(p.x - half.x, p.y - half.y)))).toBeLessThan(3);
    expect(pointAlong([], 0.5)).toEqual({ x: 0, y: 0 }); expect(pointAlong([line[0]], 0.5)).toEqual(line[0]);
  });
  it('tracing plays a run that only rises, and the gold eases in and out', () => {
    let last = 0;
    for (let share = 0; share <= 1.001; share += 0.02) { const step = traceStep(share); expect(step).toBeGreaterThanOrEqual(last); last = step; }
    expect(traceStep(0)).toBe(0); expect(traceStep(SEAM_COVER)).toBe(TRACE_STEPS); expect(traceStep(2)).toBe(TRACE_STEPS);
    expect(easeFlow(0)).toBe(0); expect(easeFlow(1)).toBe(1); expect(easeFlow(0.5)).toBeCloseTo(0.5, 6); expect(easeFlow(-1)).toBe(0); expect(easeFlow(3)).toBe(1);
    for (let t = 0.05; t <= 1; t += 0.05) expect(easeFlow(t)).toBeGreaterThan(easeFlow(t - 0.05));
  });
});
