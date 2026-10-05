/**
 * B-GAME-06 — the design space and the courtyard's anchors, measured.
 */
import { describe, expect, it } from "vitest";
import { COVER_FRACTIONS } from "../games/sneakFreeze/rules";
import { COVER_ASPECT, DESIGN, GATE, HERO_EXTENT, PLATE_BLEED, WATCHER_EXTENT, fitField, insideSafe, mirrorX, orientationFor, pointOnPath, sneakField, sneakLayout, toPx, type FieldOrientation } from "./fieldLayout";

/** The four acceptance sizes, as the whole window and as the field under the
 *  kid top bar (~64 px; 97 px measured by the B-GAME-12a proof run). */
const SIZES: [number, number][] = [[375, 667], [375, 812], [1280, 720], [1920, 1080]];
const FIELDS: [number, number][] = [...SIZES, ...SIZES.map(([w, h]) => [w, h - 64] as [number, number]), ...SIZES.map(([w, h]) => [w, h - 97] as [number, number])];

describe("fieldLayout — design space", () => {
  it("picks landscape 1600x900 for wide fields and portrait 900x1600 for tall ones", () => {
    expect(orientationFor(1920, 1080)).toBe("landscape");
    expect(orientationFor(1280, 720)).toBe("landscape");
    expect(orientationFor(375, 812)).toBe("portrait");
    expect(orientationFor(375, 667)).toBe("portrait");
    expect(DESIGN.landscape).toEqual({ w: 1600, h: 900 });
    expect(DESIGN.portrait).toEqual({ w: 900, h: 1600 });
  });

  it("scales uniformly to cover the field: no empty band at the four sizes", () => {
    for (const [w, h] of FIELDS) {
      const { fit } = sneakField(w, h);
      expect(fit.design.w * fit.scale).toBeGreaterThanOrEqual(w - 0.5);
      expect(fit.design.h * fit.scale).toBeGreaterThanOrEqual(h - 0.5);
    }
    // 1920x1080 = exactly 1.2 x the landscape design.
    expect(sneakField(1920, 1080).fit.scale).toBeCloseTo(1.2, 5);
  });

  it("where cover would crop an anchor (a squarish screen) the scale caps and the plate's bleed covers the band", () => {
    for (const [w, h] of [[1000, 1000], [768, 1024], [812, 375]] as [number, number][]) {
      const { fit, layout } = sneakField(w, h);
      for (const a of layout.anchors) expect(insideSafe(fit, a.p), `${w}x${h} ${a.id}`).toBe(true);
      const plateW = fit.design.w * (1 + 2 * PLATE_BLEED) * fit.scale;
      const plateH = fit.design.h * (1 + 2 * PLATE_BLEED) * fit.scale;
      expect(plateW).toBeGreaterThanOrEqual(w);
      expect(plateH).toBeGreaterThanOrEqual(h);
    }
  });
});

describe("fieldLayout — Sneak & Freeze anchors", () => {
  it("every anchor is inside the safe area at 375x667, 375x812, 1280x720, 1920x1080 (and under the top bar)", () => {
    for (const [w, h] of FIELDS) {
      const { fit, layout } = sneakField(w, h);
      expect(layout.anchors.length).toBeGreaterThan(10);
      for (const a of layout.anchors) expect(insideSafe(fit, a.p), `${w}x${h} ${a.id} (${a.p.x},${a.p.y})`).toBe(true);
      // And on screen, inside the field.
      for (const a of layout.anchors) {
        const px = toPx(fit, a.p);
        expect(px.x).toBeGreaterThanOrEqual(0);
        expect(px.x).toBeLessThanOrEqual(w);
        expect(px.y).toBeGreaterThanOrEqual(0);
        expect(px.y).toBeLessThanOrEqual(h);
      }
    }
  });

  it("the run comes toward the camera: feet move down and the hero grows along the path", () => {
    for (const o of ["portrait", "landscape"] as const) {
      const { heroPath } = sneakLayout(o);
      for (let i = 1; i < heroPath.length; i++) {
        expect(heroPath[i].y).toBeGreaterThan(heroPath[i - 1].y);
        expect(heroPath[i].h).toBeGreaterThan(heroPath[i - 1].h);
      }
      const mid = pointOnPath(heroPath, 0.5);
      expect(mid.h).toBeGreaterThan(heroPath[0].h);
      expect(mid.h).toBeLessThan(heroPath[heroPath.length - 1].h);
      expect(pointOnPath(heroPath, 0)).toEqual(heroPath[0]);
      expect(pointOnPath(heroPath, 1)).toEqual(heroPath[heroPath.length - 1]);
    }
  });

  it("B-GAME-07d: the hero is a child at the back gate (>= 110 px at 375x812, >= 150 px at 1920x1080) and the star at the tag (>= 50 % / >= 55 % of the field)", () => {
    // The field = the window under the measured 97 px kid top bar.
    for (const [w, h] of [[375, 715], [375, 812]] as [number, number][]) {
      const { fit, layout } = sneakField(w, h);
      const back = layout.heroPath[0].h * fit.scale;
      const tag = layout.heroPath[layout.heroPath.length - 1].h * fit.scale;
      expect(back, `${w}x${h} back`).toBeGreaterThanOrEqual(110);
      expect(tag / h, `${w}x${h} tag`).toBeGreaterThanOrEqual(0.5);
      expect(tag / h).toBeLessThanOrEqual(0.62);
    }
    for (const [w, h] of [[1920, 983]] as [number, number][]) {
      const { fit, layout } = sneakField(w, h);
      expect(layout.heroPath[0].h * fit.scale, `${w}x${h} back`).toBeGreaterThanOrEqual(150);
      expect(layout.heroPath[layout.heroPath.length - 1].h * fit.scale / h, `${w}x${h} tag`).toBeGreaterThanOrEqual(0.55);
    }
    // Smooth growth (no pop): the hero grows on every step, never by more than 7 % of its tag height.
    for (const o of ["portrait", "landscape"] as const) {
      const { heroPath } = sneakLayout(o);
      const tagH = heroPath[heroPath.length - 1].h;
      for (let i = 1; i <= 26; i++) {
        const dh = pointOnPath(heroPath, i / 26).h - pointOnPath(heroPath, (i - 1) / 26).h;
        expect(dh).toBeGreaterThan(0);
        expect(dh).toBeLessThanOrEqual(tagH * 0.07);
      }
    }
    // 375x667 too: the tag still fills half the field.
    const { fit, layout } = sneakField(375, 570);
    expect(layout.heroPath[layout.heroPath.length - 1].h * fit.scale / 570).toBeGreaterThanOrEqual(0.5);
  });

  it("B-GAME-07d: the cat is a foreground character, never the star, and whole inside the safe area", () => {
    for (const [w, h] of FIELDS) {
      const { fit, layout } = sneakField(w, h);
      const tag = layout.heroPath[layout.heroPath.length - 1];
      expect(layout.watcher.h).toBeLessThan(tag.h * 0.7);
      const box = { x0: layout.watcher.feet.x - layout.watcher.h * WATCHER_EXTENT.left, x1: layout.watcher.feet.x + layout.watcher.h * WATCHER_EXTENT.right, y0: layout.watcher.feet.y - layout.watcher.h };
      expect(insideSafe(fit, { x: box.x0, y: box.y0 }), `${w}x${h} cat top-left`).toBe(true);
      expect(insideSafe(fit, { x: box.x1, y: layout.watcher.feet.y }), `${w}x${h} cat bottom-right`).toBe(true);
      // The cat is right of the tag's hero (lower right).
      expect(layout.watcher.feet.x).toBeGreaterThan(tag.x);
    }
  });

  it("B-GAME-07d: covers stand beside the run, alternate sides, on the floor at their stop, clear of each other, the cat, the gate and the run's line", () => {
    type Box = { x0: number; x1: number; y0: number; y1: number };
    const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    for (const o of ["portrait", "landscape"] as FieldOrientation[]) {
      const lay = sneakLayout(o);
      const boxes = lay.covers.map((c) => {
        const half = (c.h * COVER_ASPECT[c.id]) / 2;
        return { id: c.id, box: { x0: c.feet.x - half, x1: c.feet.x + half, y0: c.feet.y - c.h, y1: c.feet.y } as Box };
      });
      const cat: Box = { x0: lay.watcher.feet.x - lay.watcher.h * WATCHER_EXTENT.left, x1: lay.watcher.feet.x + lay.watcher.h * WATCHER_EXTENT.right, y0: lay.watcher.feet.y - lay.watcher.h * 0.96, y1: lay.watcher.feet.y };
      const gate: Box = { x0: GATE[o].x0, x1: GATE[o].x1, y0: 0, y1: GATE[o].y1 };
      let lastSide = 0;
      lay.covers.forEach((c, i) => {
        const stop = pointOnPath(lay.heroPath, c.at);
        // On the floor at the hero's depth: same base line as the stop.
        expect(c.feet.y, `${o} ${c.id} base`).toBeCloseTo(stop.y, 6);
        // Beside: on one side of the hero, alternating; the gap from the hero's body small.
        const side = Math.sign(c.feet.x - stop.x);
        expect(side, `${o} ${c.id} side`).not.toBe(0);
        if (i > 0) expect(side, `${o} ${c.id} alternates`).toBe(-lastSide);
        lastSide = side;
        const b = boxes[i].box;
        const gap = side < 0 ? stop.x - stop.h * HERO_EXTENT.left - b.x1 : b.x0 - (stop.x + stop.h * HERO_EXTENT.right);
        expect(gap, `${o} ${c.id} gap`).toBeGreaterThanOrEqual(-0.1 * stop.h);
        expect(gap, `${o} ${c.id} gap`).toBeLessThanOrEqual(0.15 * stop.h);
        // Larger toward the camera: each cover's floor scale (height per relH) grows.
        if (i > 0) expect(c.feet.y).toBeGreaterThan(lay.covers[i - 1].feet.y);
        expect(hit(b, cat), `${o} ${c.id} vs cat`).toBe(false);
        expect(hit(b, gate), `${o} ${c.id} vs gate`).toBe(false);
        for (let j = i + 1; j < boxes.length; j++) expect(hit(b, boxes[j].box), `${o} ${c.id} vs ${boxes[j].id}`).toBe(false);
        // The run's line never passes through a cover (sampled).
        for (let t = 0; t <= 1; t += 0.005) {
          const p = pointOnPath(lay.heroPath, t);
          expect(p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1, `${o} run crosses ${c.id} at ${t.toFixed(3)}`).toBe(false);
        }
      });
    }
  });

  it("right-to-left mirrors x only", () => {
    for (const [w, h] of FIELDS) {
      const { fit, layout } = sneakField(w, h);
      for (const a of layout.anchors) {
        const ltr = toPx(fit, a.p, false);
        const rtl = toPx(fit, a.p, true);
        expect(rtl.y).toBeCloseTo(ltr.y, 6);
        // Mirrored about the field's centre line.
        expect(rtl.x).toBeCloseTo(w - ltr.x, 6);
        const back = mirrorX(mirrorX(a.p, fit.design, true), fit.design, true);
        expect(back.x).toBeCloseTo(a.p.x, 6);
        expect(back.y).toBe(a.p.y);
      }
    }
    expect(mirrorX({ x: 100, y: 7 }, DESIGN.landscape, false)).toEqual({ x: 100, y: 7 });
    expect(mirrorX({ x: 100, y: 7 }, DESIGN.landscape, true)).toEqual({ x: 1500, y: 7 });
  });

  it("cover objects sit at the rules' cover fractions, and plain cover-fit without a need is plain cover", () => {
    for (const o of ["portrait", "landscape"] as const) expect(sneakLayout(o).covers.map((c) => c.at)).toEqual([...COVER_FRACTIONS]);
    const plain = fitField(375, 812, undefined, "portrait");
    expect(plain.scale).toBeCloseTo(Math.max(375 / 900, 812 / 1600), 6);
  });
});
