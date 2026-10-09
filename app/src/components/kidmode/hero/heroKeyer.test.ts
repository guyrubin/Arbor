/**
 * B-GAME-13a — the ported keyer + QA gate (key.py --selftest cases) and the
 * head-width normalisation (normalise.py), on synthetic pixels.
 */
import { describe, expect, it } from "vitest";
import { basicAnchors, handAnchors, keySprite, measureHead, normalisePoses, sampleHeadTopColour, sampleKey, type RgbaImage } from "./heroKeyer";

type RGB = [number, number, number];
const SAGE: RGB = [130, 169, 77]; // the Vertex renders' sampled key
const CHROMA: RGB = [0, 177, 64]; // #00B140, what the prompt asks for
const SKIN: RGB = [225, 160, 120];
const SUIT: RGB = [40, 60, 150];

function canvas(W: number, H: number, bg: RGB): RgbaImage {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < W * H; p++) { data[p * 4] = bg[0]; data[p * 4 + 1] = bg[1]; data[p * 4 + 2] = bg[2]; data[p * 4 + 3] = 255; }
  return { width: W, height: H, data };
}
function paint(img: RgbaImage, inside: (x: number, y: number) => boolean, c: RGB) {
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (!inside(x, y)) continue;
    const i = (y * img.width + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2];
  }
}
/** key.py selftest figure: a head circle on a body block. */
function fig({ W = 600, H = 800, top = 120, bottom = 680, cx = 300, headR = 70, key = SAGE } = {}): RgbaImage {
  const img = canvas(W, H, key);
  paint(img, (x, y) => (y - (top + headR)) ** 2 + (x - cx) ** 2 < headR ** 2, SKIN);
  paint(img, (x, y) => y > top + 120 && y < bottom && Math.abs(x - cx) < 90, SUIT);
  return img;
}
const alphaAt = (img: RgbaImage, x: number, y: number) => img.data[(Math.round(y) * img.width + Math.round(x)) * 4 + 3];

describe("B-GAME-13a keyer — the QA gate rejects each defect class", () => {
  it("a clean figure on a uniform border passes (sage and chroma green)", () => {
    for (const key of [SAGE, CHROMA]) {
      const k = keySprite(fig({ key }));
      expect(k.qa.fails, k.qa.fails.join("; ")).toEqual([]);
      expect(k.ok).toBe(true);
      expect(k.qa.figures).toBe(1);
      expect(k.qa.borderDeltaE).toBeLessThan(1);
      expect(sampleKey(fig({ key }))).toEqual(key);
    }
  });

  it("a gradient / floor at the bottom is rejected (border not uniform)", () => {
    const img = fig();
    for (let y = 0; y < img.height; y++) {
      const f = 1 - 0.35 * (y / (img.height - 1)) ** 3;
      for (let x = 0; x < img.width; x++) for (let c = 0; c < 3; c++) { const i = (y * img.width + x) * 4 + c; img.data[i] = Math.floor(img.data[i] * f); }
    }
    const k = keySprite(img);
    expect(k.ok).toBe(false);
    expect(k.qa.fails.join()).toMatch(/border not uniform/);
  });

  it("cut feet are rejected (margin under 6 %)", () => {
    const k = keySprite(fig({ bottom: 800 }));
    expect(k.ok).toBe(false);
    expect(k.qa.fails.join()).toMatch(/margin under 6 %: .*bottom/);
  });

  it("green tint left on the skin is rejected (key-hue residue)", () => {
    const img = fig();
    paint(img, (x, y) => (y - 190) ** 2 + (x - 300) ** 2 < 40 ** 2, [150, 165, 140]);
    const k = keySprite(img);
    expect(k.ok).toBe(false);
    expect(k.qa.fails.join()).toMatch(/key-hue residue/);
  });

  it("a figure colour keyed away is rejected (a hole inside the figure)", () => {
    const img = fig();
    paint(img, (x, y) => y > 400 && y < 460 && Math.abs(x - 300) < 30, [100, 180, 100]);
    const k = keySprite(img);
    expect(k.ok).toBe(false);
    expect(k.qa.fails.join()).toMatch(/holes inside the figure/);
  });

  it("a second figure is rejected", () => {
    const img = fig();
    paint(img, (x, y) => y > 300 && y < 600 && x > 480 && x < 560, [200, 40, 40]);
    const k = keySprite(img);
    expect(k.ok).toBe(false);
    expect(k.qa.figures).toBe(2);
    expect(k.qa.fails.join()).toMatch(/2 figures found/);
  });

  it("an empty frame is rejected, never thrown", () => {
    const k = keySprite(canvas(200, 300, SAGE));
    expect(k.ok).toBe(false);
    expect(k.sprite).toBeNull();
    expect(k.qa.fails.join()).toMatch(/no figure/);
  });
});

describe("B-GAME-13a keyer — cut-out and anchors", () => {
  it("specks are removed, the background is transparent, the figure opaque, and no key colour is left", () => {
    const img = fig();
    paint(img, (x, y) => x >= 240 && x < 245 && y >= 693 && y < 698, [200, 40, 40]); // a speck under the body, inside the crop
    paint(img, (x, y) => x >= 20 && x < 24 && y >= 20 && y < 24, [200, 40, 40]);
    const k = keySprite(img);
    expect(k.ok, k.qa.fails.join("; ")).toBe(true);
    const s = k.sprite!;
    // Trimmed to the figure + 4 % padding.
    expect(s.width).toBeGreaterThan(178);
    expect(s.width).toBeLessThan(240);
    expect(s.height).toBeGreaterThan(556);
    expect(s.height).toBeLessThan(620);
    // Corners transparent; the body centre opaque and still the suit colour.
    expect(alphaAt(s, 0, 0)).toBe(0);
    expect(alphaAt(s, s.width - 1, s.height - 1)).toBe(0);
    const cx = Math.round(s.width / 2), cy = Math.round(s.height * 0.6);
    expect(alphaAt(s, cx, cy)).toBe(255);
    // The speck below the body is gone.
    for (let y = Math.round(k.foot.y) + 2; y < s.height; y++) for (let x = 0; x < s.width; x++) expect(alphaAt(s, x, y)).toBe(0);
  });

  it("foot = centre of the lowest opaque rows; head = the top band's widest run", () => {
    const k = keySprite(fig());
    const s = k.sprite!;
    expect(Math.abs(k.foot.x - s.width / 2)).toBeLessThan(3);
    expect(alphaAt(s, k.foot.x, k.foot.y)).toBeGreaterThanOrEqual(128);
    expect(alphaAt(s, k.foot.x, Math.min(s.height - 1, k.foot.y + 2))).toBeLessThan(128);
    expect(Math.abs(k.head.x - s.width / 2)).toBeLessThan(3);
    expect(k.head.y).toBeLessThan(s.height * 0.35);
    expect(basicAnchors(s)).toEqual({ foot: k.foot, head: k.head });
  });
});

describe("B-GAME-13a normalisation — one pixels-per-head scale for the sheet", () => {
  /** A pose drawn with its own head radius; `armsUp` adds two raised arms. */
  function pose(headR: number, armsUp = false, W = 700, H = 1000): RgbaImage {
    const img = canvas(W, H, SAGE);
    const top = 260, cx = 350;
    paint(img, (x, y) => (y - (top + headR)) ** 2 + (x - cx) ** 2 < headR ** 2, [70, 40, 20]); // hair = head top colour
    paint(img, (x, y) => (y - (top + headR * 1.4)) ** 2 + (x - cx) ** 2 < (headR * 0.9) ** 2, SKIN);
    const bodyTop = top + Math.round(headR * 2.1);
    paint(img, (x, y) => y > bodyTop - 10 && y < 880 && Math.abs(x - cx) < headR * 1.2, SUIT);
    if (armsUp) {
      paint(img, (x, y) => y > 120 && y < bodyTop + 40 && x > cx - headR * 2.6 && x < cx - headR * 1.9, SUIT);
      paint(img, (x, y) => y > 120 && y < bodyTop + 40 && x > cx + headR * 1.9 && x < cx + headR * 2.6, SUIT);
      paint(img, (x, y) => y > bodyTop && y < bodyTop + 40 && Math.abs(x - cx) < headR * 2.6, SUIT);
    }
    return keySprite(img).sprite!;
  }

  it("measures the head through the hair column; raised arms do not change it", () => {
    const a = pose(70);
    const top = sampleHeadTopColour(a)!;
    expect(top[0]).toBeGreaterThan(top[2]); // the dark-brown top, not skin or suit
    const m = measureHead(a, top, null);
    expect(m.run).toBeGreaterThan(125);
    expect(m.run).toBeLessThan(150);
    const up = pose(70, true);
    const k = m.mop > 0 ? m.run / m.mop : null;
    expect(Math.abs(measureHead(up, top, k).w - measureHead(a, top, k).w)).toBeLessThan(6);
  });

  it("a pose drawn with a smaller head is scaled up to the idle's head width (within 3 %)", () => {
    const idle = pose(70);
    const cheer = pose(50, true);
    const n = normalisePoses({ idle, cheer }, "idle");
    expect(n.idle!.h).toBe(960);
    expect(n.idle!.scale).toBeCloseTo(1, 3);
    const drawn = (p: "idle" | "cheer") => n[p]!.headW * n[p]!.resize * n[p]!.scale;
    expect(Math.abs(drawn("cheer") / drawn("idle") - 1)).toBeLessThan(0.03);
    // Anchors are in output px and inside the sprite.
    for (const p of ["idle", "cheer"] as const) {
      const v = n[p]!;
      expect(v.foot.y).toBeGreaterThan(v.h * 0.8);
      expect(v.foot.y).toBeLessThanOrEqual(v.h);
      expect(v.head.y).toBeLessThan(v.foot.y);
      expect(v.head.r).toBeGreaterThan(0);
    }
  });

  it("hold-up gets two hand anchors, left and right of the head, above it", () => {
    const s = pose(60, true);
    const top = sampleHeadTopColour(s);
    const m = measureHead(s, top, null);
    const hand = handAnchors(s, { x: m.x, y: m.hairTop, r: m.w / 2 })!;
    expect(hand.l && hand.r).toBeTruthy();
    expect(hand.l![0]).toBeLessThan(m.x);
    expect(hand.r![0]).toBeGreaterThan(m.x);
    expect(hand.l![1]).toBeLessThan(m.hairTop + 5);
    const n = normalisePoses({ idle: pose(60), "hold-up": s }, "idle");
    expect(n["hold-up"]!.hand?.l).toBeTruthy();
  });
});
