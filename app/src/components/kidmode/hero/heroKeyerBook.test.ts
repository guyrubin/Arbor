/**
 * K2 4c — the keyer's BOOK mode on the synthetic book poses: the same QA gate,
 * a tight trim (no padding: the feet are the image's last opaque row) and the
 * art pipeline's alpha_meta anchors, so the reader's slot math puts the feet on
 * the slot. The game's padded trim is unchanged.
 */
import { describe, expect, it } from "vitest";
import { HERO_BOOK_POSE_IDS } from "../../../lib/heroSheetContract";
import { MOCK_POSE_W, mockHeroPoseRaster } from "../../../lib/heroPoseMockArt";
import { bookSpriteAnchor, keyBookSprite, keySprite, type RgbaImage } from "./heroKeyer";

const opaqueRows = (img: RgbaImage) => {
  const rows: number[] = [];
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 80) { rows.push(y); break; }
  return rows;
};
const opaqueCols = (img: RgbaImage) => {
  const cols = new Set<number>();
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 80) cols.add(x);
  return [...cols].sort((a, b) => a - b);
};

describe("K2 4c: the keyer's book mode", () => {
  it("every synthetic book pose passes the QA gate and is trimmed tight on all four sides", () => {
    for (const pose of HERO_BOOK_POSE_IDS) {
      const k = keyBookSprite(mockHeroPoseRaster(pose));
      expect(k.qa.fails, `${pose}: ${k.qa.fails.join("; ")}`).toEqual([]);
      const s = k.sprite!;
      const rows = opaqueRows(s);
      const cols = opaqueCols(s);
      expect(rows[0], pose).toBeLessThanOrEqual(1);
      expect(rows[rows.length - 1], pose).toBeGreaterThanOrEqual(s.height - 2);
      expect(cols[0], pose).toBeLessThanOrEqual(1);
      expect(cols[cols.length - 1], pose).toBeGreaterThanOrEqual(s.width - 2);
      const a = k.anchor!;
      expect(a.aspect, pose).toBeCloseTo(s.width / s.height, 3);
      expect(a.bottom, pose).toBeGreaterThan(0.99);
      expect(a.footX, pose).toBeGreaterThan(0);
      expect(a.footX, pose).toBeLessThan(1);
      expect(a.footW, pose).toBeGreaterThan(0);
    }
  });

  it("the anchors are alpha_meta's: the feet band is the lowest 6 % of the image (worried: both shoes, centred)", () => {
    const k = keyBookSprite(mockHeroPoseRaster("worried"));
    const s = k.sprite!;
    // the mock's shoes span cx - 40 .. cx + 40 of the 384 px canvas; the trim starts at the left arm
    const cx = MOCK_POSE_W / 2;
    const left = cx - 34 - 8 - 11; // the left hand's outer edge (sl - 8, radius 11)
    expect(k.anchor!.footX).toBeCloseTo((cx - left) / s.width, 1);
    expect(k.anchor!.footW).toBeGreaterThan(70 / s.width);
    expect(k.anchor!.footW).toBeLessThan(90 / s.width);
    // a hand-made sprite: feet 10..30 of a 40 x 100 image
    const img: RgbaImage = { width: 40, height: 100, data: new Uint8ClampedArray(40 * 100 * 4) };
    for (let y = 0; y < 100; y++) for (let x = 15; x < 25; x++) img.data[(y * 40 + x) * 4 + 3] = 255;
    for (let y = 95; y < 100; y++) for (let x = 10; x <= 30; x++) img.data[(y * 40 + x) * 4 + 3] = 255;
    expect(bookSpriteAnchor(img)).toEqual({ aspect: 0.4, footX: 0.5, footW: 0.5, bottom: 0.99 });
  });

  it("the game keeps its padded trim (4 %)", () => {
    const raster = mockHeroPoseRaster("worried");
    const game = keySprite(raster);
    const book = keyBookSprite(raster);
    expect(game.sprite!.height).toBeGreaterThan(book.sprite!.height);
    const rows = opaqueRows(game.sprite!);
    expect(rows[0]).toBeGreaterThan(5);
  });
});
