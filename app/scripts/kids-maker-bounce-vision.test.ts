import { describe, expect, it } from 'vitest';
import { bounceDragOffset, readPaintedBounceBall } from './kids-maker-bounce-vision.mjs';
import { advance, LAYOUTS, newBounce, type LanternLayout } from '../src/components/kidmode/studioV2/games/makers/makerDesk/makerDeskRules';

const palette = { slate: [75, 88, 116], white: [255, 253, 248], butter: [246, 236, 211] };
// The solid edge and warm cross are visible in the original c7 failed frame;
// stars, lantern highlights and the wide paddle must not become a ball.
const ballPixels = ['ssssss', 'sswwss', 'swbwws', 'swwwws', 'sswwss', 'ssssss'];
function canvasFixture(points: Array<[number, number]>, damage = false) {
  const width = 40, height = 28, pixels = new Uint8ClampedArray(width * height * 4);
  for (let at = 0; at < pixels.length; at += 4) pixels.set([243, 246, 252, 255], at);
  const colors = { s: palette.slate, w: palette.white, b: palette.butter };
  for (const [x, y] of points) ballPixels.forEach((row, dy) => [...row].forEach((ink, dx) => {
    if (x + dx < width && y + dy < height) pixels.set([...colors[ink as keyof typeof colors], 255], ((y + dy) * width + x + dx) * 4);
  }));
  if (damage && points.length) pixels[((points[0][1] + 2) * width + points[0][0] + 2) * 4] = 0;
  return { width, height, ownerDocument: { createElement: () => ({ getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data: pixels }) }) }) },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 140 }) };
}

describe('visible Bounce ball observations', () => {
  it('finds the complete painted ball and preserves backing/display coordinates', () => {
    expect(readPaintedBounceBall(canvasFixture([[11, 9]]), palette)).toEqual({ balls: [{ x: 14, y: 12 }], width: 40, height: 28, box: { left: 10, top: 20, width: 200, height: 140 } });
  });
  it('does not invent a ball when the picture is absent, damaged or clipped', () => {
    for (const canvas of [canvasFixture([]), canvasFixture([[11, 9]], true), canvasFixture([[38, 25]])]) {
      expect(readPaintedBounceBall(canvas, palette).balls).toEqual([]);
    }
  });
  it('reports ambiguous pictures so the browser driver can reject them', () => {
    expect(readPaintedBounceBall(canvasFixture([[3, 3], [20, 15]]), palette).balls).toHaveLength(2);
  });
});

function playVisibleDrag(height: number, layout: LanternLayout, initialMs: number) {
  let state = newBounce(() => 0, layout, height), carry = 0, elapsed = 0, target: number | null = null;
  const tick = (ms: number, target: number | null) => {
    for (let left = ms; left > 0; left -= 16) {
      const frame = advance(state, { dir: 0, target }, carry, Math.min(16, left) / 1000);
      state = frame.state; carry = frame.carry;
    }
  };
  tick(initialMs, null);
  while (elapsed < 306600 && !state.done) {
    // The browser supplies only a complete painted ball. At a narrow field's
    // edge its outer pixel can be clipped, so the last real drag is held while
    // the next frame is observed; no hidden coordinate is used to steer it.
    const x = Math.round(state.ball.x);
    if (x > 2 && x < 158) target = x + bounceDragOffset(elapsed);
    tick(100, target); elapsed += 100;
  }
  return { lit: state.lit.filter(Boolean).length, elapsed };
}

describe('visible-drag strategy against the shipped Bounce physics', () => {
  for (const height of [120, 160, 200]) for (const layout of LAYOUTS) {
    it(`lights every lantern in ${layout} at field height ${height} from different entry frames`, () => {
      for (const initialMs of [0, 16, 32, 64, 96, 132, 200, 500, 1000]) {
        const played = playVisibleDrag(height, layout, initialMs);
        expect(played.lit, `entry frame ${initialMs}ms`).toBe(15);
        expect(played.elapsed).toBeLessThanOrEqual(306600);
      }
    });
  }
});
