/**
 * B-GAME-06 — the design space and the courtyard's anchors, measured.
 */
import { describe, expect, it } from "vitest";
import { COVER_FRACTIONS } from "../games/sneakFreeze/rules";
import { DESIGN, PLATE_BLEED, fitField, insideSafe, mirrorX, orientationFor, pointOnPath, sneakField, sneakLayout, toPx } from "./fieldLayout";

/** The four acceptance sizes, as the whole window and as the field under the
 *  kid top bar (~64 px). */
const SIZES: [number, number][] = [[375, 667], [375, 812], [1280, 720], [1920, 1080]];
const FIELDS: [number, number][] = [...SIZES, ...SIZES.map(([w, h]) => [w, h - 64] as [number, number])];

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

  it("phone: the hero is ~90 px at the back gate and >= 160 px (about 55-60 % of the field) at the tag at 375x812", () => {
    for (const [w, h] of [[375, 812], [375, 748]] as [number, number][]) {
      const { fit, layout } = sneakField(w, h);
      const back = layout.heroPath[0].h * fit.scale;
      const tag = layout.heroPath[layout.heroPath.length - 1].h * fit.scale;
      expect(back).toBeGreaterThanOrEqual(80);
      expect(back).toBeLessThanOrEqual(110);
      expect(tag).toBeGreaterThanOrEqual(160);
      expect(tag / h).toBeGreaterThanOrEqual(0.5);
      expect(tag / h).toBeLessThanOrEqual(0.62);
    }
    // 375x667 too.
    const { fit, layout } = sneakField(375, 667);
    expect(layout.heroPath[layout.heroPath.length - 1].h * fit.scale).toBeGreaterThanOrEqual(160);
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
