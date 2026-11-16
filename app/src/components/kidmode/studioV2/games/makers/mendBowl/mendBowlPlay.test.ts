import { describe, expect, it } from 'vitest';
import { BOWL_GLAZES, ROTATE_STEP, SEAM_COVER, SNAP_DEG, assist, fits, posePoint, samplePolyline } from './mendBowlRules';
import { BOWL_CENTRE, BOWL_PATTERNS, BOWL_R, LINEN_R } from './mendBowlPatterns';
import {
  FIELD, FIELD_WIDE, GLAZE_SPOTS, LIGHTS, NEAR_DIST, SEAM_LIFT_COVER, SHORT_STAGE, SWIRLS, TABLE_LAYOUTS, TABLE_SPOTS, TEAS, TRACE_STEPS, VIEW_BASE, VIEW_CENTRE,
  arrange, easeFlow, easiestPiece, hudBands, liftCompletes, mostTurned, nearestSample, pointAlong, stageView, tableLayout, toUnits, traceStep, turnToward, unitsPerPixel, waitsForTurn,
} from './mendBowlPlay';
import { TABLE_BOX } from './BowlArt';
import { TABLETOP_BOX } from './MendScene';
import { KIT_TABLE, KIT_TABLETOP, MEND_BOWL_ART } from './mendKit';

/** Phone, phone on its side, tablet, desktop: the stage under the Studio's top bar. */
const STAGES = [[390, 768], [844, 314], [1024, 692], [1280, 724], [820, 1104], [320, 492]] as const;

describe('mend-bowl: the table, framed for the screen', () => {
  it('the world is the screen: the view always has exactly the stage’s own shape', () => {
    for (const [w, h] of STAGES) {
      const v = stageView(w, h);
      // Nothing is letterboxed and nothing is stretched: one scale both ways.
      expect(v.w / w).toBeCloseTo(v.h / h, 9);
      // The bowl is in the middle, left to right.
      expect(v.x + v.w / 2).toBeCloseTo(VIEW_CENTRE.x, 6);
    }
    expect(stageView(0, 0)).toEqual({ x: 0, y: 0, w: VIEW_BASE.w, h: VIEW_BASE.h });
  });
  it('fits the whole play field into the room the HUD leaves, and centres the bowl in that room', () => {
    for (const [w, h] of STAGES) {
      const v = stageView(w, h), scale = w / v.w, { top, bottom } = hudBands(w, h), room = h - top - bottom;
      // A wide stage with height to spare shows the whole round table; the rest show its linen edge to edge.
      const field = w > h && h >= SHORT_STAGE ? FIELD_WIDE : FIELD;
      expect(field * scale).toBeLessThanOrEqual(Math.min(w, room) + 1e-6);
      // One side of the field touches the room: the table is as large as it can be.
      expect(Math.min(w, room) - field * scale).toBeLessThan(1e-6);
      if (field === FIELD_WIDE) expect(FIELD_WIDE).toBeGreaterThan(TABLETOP_BOX.r * 2);
      const bowlY = (VIEW_CENTRE.y - v.y) * scale;
      expect(bowlY).toBeCloseTo(top + room / 2, 6);
      // The bowl is big enough to work on with a finger.
      expect(BOWL_R * 2 * scale).toBeGreaterThan(110);
    }
  });
  it('keeps the coach and the dock clear on a tall stage, the top row on a wide one, and gives a phone on its side the whole height', () => {
    expect(hudBands(390, 768)).toEqual({ top: 84, bottom: 92 });
    expect(hudBands(1280, 724).top).toBeGreaterThan(50); expect(hudBands(1280, 724).bottom).toBeLessThan(30);
    expect(hudBands(844, 314)).toEqual({ top: 0, bottom: 0 }); expect(314).toBeLessThan(SHORT_STAGE);
    const tall = stageView(390, 768), wide = stageView(1280, 724), short = stageView(844, 314);
    // A tall stage shows the floor past the table's far and near edges; a wide one to each side.
    expect(tall.h).toBeGreaterThan(tall.w); expect(tall.y).toBeLessThan(BOWL_CENTRE.y - TABLETOP_BOX.r);
    expect(wide.w).toBeGreaterThan(TABLETOP_BOX.r * 2 + 100); expect(short.h).toBeCloseTo(FIELD, 6);
  });
  it('places the table picture so its linen is centred on the bowl', () => {
    const scale = TABLE_BOX.w / KIT_TABLE.w;
    expect(TABLE_BOX.x + KIT_TABLE.centre.x * scale).toBeCloseTo(BOWL_CENTRE.x, 6); expect(TABLE_BOX.y + KIT_TABLE.centre.y * scale).toBeCloseTo(BOWL_CENTRE.y, 6);
    expect(KIT_TABLE.linen * scale).toBeCloseTo(LINEN_R, 6);
    // The cut-out tabletop the play stands on: the same table, centred the same way.
    const top = TABLETOP_BOX.w / KIT_TABLETOP.w;
    expect(TABLETOP_BOX.x + KIT_TABLETOP.centre.x * top).toBeCloseTo(BOWL_CENTRE.x, 6); expect(TABLETOP_BOX.y + KIT_TABLETOP.centre.y * top).toBeCloseTo(BOWL_CENTRE.y, 6);
    expect(KIT_TABLETOP.linen * top).toBeCloseTo(LINEN_R, 6); expect(KIT_TABLETOP.linenUnits).toBe(LINEN_R);
    expect(TABLETOP_BOX.r).toBeGreaterThan(LINEN_R); expect(TABLETOP_BOX.r).toBeLessThan(TABLETOP_BOX.w / 2);
  });
  it('maps a pointer to stage units and back, whatever the stage shape', () => {
    for (const [w, h] of STAGES) {
      const v = stageView(w, h);
      const mid = toUnits(v, w, h, w / 2, h / 2);
      expect(mid.x).toBeCloseTo(v.x + v.w / 2, 6); expect(mid.y).toBeCloseTo(v.y + v.h / 2, 6);
      const corner = toUnits(v, w, h, 0, 0);
      expect(corner.x).toBeCloseTo(v.x, 6); expect(corner.y).toBeCloseTo(v.y, 6);
      expect(unitsPerPixel(v, w, h)).toBeCloseTo(v.w / w, 9);
      // The camera only scales the world's box: the same point under a 1.4 zoom maps to the same units.
      const zoomed = toUnits(v, w * 1.4, h * 1.4, w * 0.7, h * 0.7);
      expect(zoomed.x).toBeCloseTo(mid.x, 6); expect(zoomed.y).toBeCloseTo(mid.y, 6);
    }
    expect(toUnits(stageView(0, 0), 0, 0, 5, 5)).toEqual(VIEW_CENTRE);
  });
  it('lays the table three ways, each with everything inside the play field, clear of the bowl and of each other', () => {
    expect(TABLE_LAYOUTS.length).toBeGreaterThanOrEqual(3); expect(TABLE_SPOTS).toBe(TABLE_LAYOUTS[0]);
    const field = { x: VIEW_CENTRE.x - FIELD / 2, y: VIEW_CENTRE.y - FIELD / 2 };
    for (const layout of TABLE_LAYOUTS) {
      const spots = [...Object.values(layout), ...GLAZE_SPOTS];
      for (const s of spots) {
        expect(s.x - s.size / 2).toBeGreaterThanOrEqual(field.x); expect(s.x + s.size / 2).toBeLessThanOrEqual(field.x + FIELD);
        expect(s.y - s.size / 2).toBeGreaterThanOrEqual(field.y); expect(s.y + s.size / 2).toBeLessThanOrEqual(field.y + FIELD);
        expect(Math.hypot(s.x - BOWL_CENTRE.x, s.y - BOWL_CENTRE.y) - s.size / 2).toBeGreaterThan(BOWL_R + 4);
        // On the table, never on the floor: a thing seen from above lies on the surface that is seen from above.
        expect(Math.hypot(s.x - BOWL_CENTRE.x, s.y - BOWL_CENTRE.y)).toBeLessThan(TABLETOP_BOX.r);
      }
      // The toys that stay out all game never share a fingertip.
      const toys = [layout.lamp, layout.fern, layout.bloom];
      toys.forEach((a, i) => toys.forEach((b, j) => { if (i < j) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(60); }));
    }
    // A new sitting finds the table changed, and the cycle comes round.
    expect(tableLayout(0)).not.toEqual(tableLayout(1)); expect(tableLayout(1)).not.toEqual(tableLayout(2)); expect(tableLayout(TABLE_LAYOUTS.length)).toBe(tableLayout(0)); expect(tableLayout(-1)).toBe(tableLayout(TABLE_LAYOUTS.length - 1));
    expect(GLAZE_SPOTS).toHaveLength(BOWL_GLAZES.length);
    // Glaze dishes are tap targets: far enough apart that two never share a fingertip.
    GLAZE_SPOTS.forEach((a, i) => GLAZE_SPOTS.forEach((b, j) => { if (i < j) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(66); }));
    for (let i = 1; i < GLAZE_SPOTS.length; i++) expect(GLAZE_SPOTS[i].x).toBeGreaterThan(GLAZE_SPOTS[i - 1].x);
  });
  it('a replay changes the tea and the light as well as the table', () => {
    expect(new Set(TEAS.map(t => t.key)).size).toBe(TEAS.length); expect(TEAS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(LIGHTS).size).toBe(LIGHTS.length); expect(LIGHTS[0]).toBe('day');
  });
  it('lists every picture with its size and where it came from', () => {
    for (const art of MEND_BOWL_ART) { expect(art.src).toMatch(/^\/visuals\/studio-v2\/(bop|makers)\/[a-z0-9-]+\.webp$/); expect(art.w).toBeGreaterThan(0); expect(art.h).toBeGreaterThan(0); expect(art.from.length).toBeGreaterThan(10); }
    // Our own cut pictures carry the activity's name and none of them shows a child: Bebe and Chock host from the
    // HUD, through the shared kit heads, never as a figure standing on a table that is seen from above.
    for (const art of MEND_BOWL_ART) if (art.src.includes('/makers/')) expect(art.src).toMatch(/\/makers\/mend-bowl-/);
    expect(MEND_BOWL_ART.filter(art => /bebe|gobgob|crew/.test(art.src))).toEqual([]);
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
