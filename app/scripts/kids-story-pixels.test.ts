import { describe, expect, it } from 'vitest';
import { PNG } from 'playwright-core/lib/utilsBundle';
import { inspectPlanFixturePng, observePlanFixturePaint } from './kids-story-pixels.mjs';

const WALL = [237, 241, 238, 255], FLOOR = [213, 225, 223, 255], GRAY = [229, 234, 236, 255];
const bounds = { roi: { x: 20, y: 20, width: 240, height: 160 }, viewport: { width: 300, height: 200 } };
function picture(paint: (x: number, y: number) => number[], scale = 1) {
  const png = new PNG({ width: 300 * scale, height: 200 * scale });
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const colour = paint(x / scale, y / scale), at = (y * png.width + x) * 4;
    colour.forEach((channel, index) => { png.data[at + index] = channel; });
  }
  return PNG.sync.write(png);
}
const inPicture = (x: number, y: number) => x >= 20 && x < 260 && y >= 20 && y < 180;
const fixture = (x: number, y: number) => inPicture(x, y) ? y < 128 ? WALL : FLOOR : GRAY;

describe('original plan-fixture screenshot pixels', () => {
  it('accepts painted fixture regions at actual viewport and retina scale without requiring gridlines', () => {
    for (const scale of [1, 2]) expect(inspectPlanFixturePng(picture(fixture, scale), bounds).painted).toBe(true);
  });
  it('keeps the approved geometric identity as an allowed occlusion of the fixture', () => {
    const png = picture((x, y) => inPicture(x, y) && x > 110 && x < 155 && y > 95 ? [49, 92, 130, 255] : fixture(x, y));
    expect(inspectPlanFixturePng(png, bounds).painted).toBe(true);
  });
  it('rejects the observed gray and hero-only panels', () => {
    for (const png of [picture(() => GRAY), picture((x, y) => x > 110 && x < 155 && y > 95 && y < 170 ? [49, 92, 130, 255] : GRAY)]) {
      const result = inspectPlanFixturePng(png, bounds); expect(result.painted).toBe(false); expect(result.wall).toBe(0); expect(result.floor).toBe(0);
    }
  });
  it('rejects unrelated, single-fill, transparent and only partly painted pictures', () => {
    const wrong = [picture(() => [90, 130, 160, 255]), picture(() => WALL), picture(() => FLOOR),
      picture((x, y) => [...fixture(x, y).slice(0, 3), 0]),
      picture((x, y) => x < 115 ? fixture(x, y) : GRAY)];
    for (const png of wrong) expect(inspectPlanFixturePng(png, bounds).painted).toBe(false);
  });
  it('rejects tiny colour flecks and matches located outside the actual art', () => {
    const flecks = picture((x, y) => x > 25 && x < 35 && y > 25 && y < 35 ? WALL : x > 40 && x < 50 && y > 40 && y < 50 ? FLOOR : GRAY);
    const outside = picture((x, y) => inPicture(x, y) ? GRAY : y < 100 ? WALL : FLOOR);
    expect(inspectPlanFixturePng(flecks, bounds).painted).toBe(false);
    expect(inspectPlanFixturePng(outside, bounds).painted).toBe(false);
  });
  it('does not count a narrower floor patch as a complete floor region', () => {
    const png = picture((x, y) => inPicture(x, y) ? y < 110 ? WALL : x < 120 ? FLOOR : GRAY : GRAY);
    const result = inspectPlanFixturePng(png, bounds); expect(result.floorFraction).toBeGreaterThan(.1); expect(result.painted).toBe(false);
  });
  it('rejects invalid, empty, tiny and off-viewport geometry and a full-page-sized capture', () => {
    const png = picture(fixture);
    for (const roi of [{ x: NaN, y: 0, width: 240, height: 160 }, { x: 20, y: 20, width: 0, height: 160 },
      { x: 20, y: 20, width: 2, height: 2 }, { x: 400, y: 20, width: 240, height: 160 }]) {
      expect(inspectPlanFixturePng(png, { ...bounds, roi }).painted).toBe(false);
    }
    expect(inspectPlanFixturePng(png, { ...bounds, viewport: { width: 300, height: 150 } }).painted).toBe(false);
    expect(inspectPlanFixturePng(Buffer.from('not a PNG'), bounds).painted).toBe(false);
  });
});

describe('native plan paint observation deadline and identity', () => {
  const state = { sameNode: true, source: 'blob:synthetic-plate', page: 'p2' };
  const shot = (painted: boolean, before = state, after = state) => ({ pixels: { painted }, before, after, captureMs: 20, file: 'original.png' });
  it('accepts a correct first capture even if its encoding was slow', async () => {
    const result = await observePlanFixturePaint({ first: { ...shot(true), captureMs: 12000 }, now: () => 12000,
      wait: async () => { throw new Error('must not wait'); }, capture: async () => { throw new Error('must not recapture'); } });
    expect(result.painted).toBe(true); expect(result.attempts).toHaveLength(1); expect(result.firstMiss).toBe(false);
  });
  it('retains the initial miss and accepts actual same-picture paint within the native deadline', async () => {
    let time = 0; const retained: unknown[] = [];
    const result = await observePlanFixturePaint({ first: shot(false), now: () => time,
      wait: async () => { time += 100; return true; }, capture: async () => { time += 150; return shot(true); }, onSample: async sample => { retained.push(sample); } });
    expect(result.painted).toBe(true); expect(result.firstMiss).toBe(true); expect(result.elapsedMs).toBe(250);
    expect(result.attempts.map(a => a.pixels.painted)).toEqual([false, true]); expect(retained).toHaveLength(2);
  });
  it('rejects a painted retry returned after the deadline and retains that late evidence', async () => {
    let time = 0;
    const result = await observePlanFixturePaint({ first: shot(false), now: () => time,
      wait: async () => { time += 100; return true; }, capture: async () => { time += 4000; return shot(true); } });
    expect(result.painted).toBe(false); expect(result.reason).toBe('deadline-exceeded'); expect(result.elapsedMs).toBe(4100);
    expect(result.attempts[1].pixels.painted).toBe(true); expect(result.attempts[1].withinDeadline).toBe(false);
  });
  it('never captures beyond an exhausted native wait and rejects persistent gray', async () => {
    let time = 0, captures = 0;
    const result = await observePlanFixturePaint({ first: shot(false), now: () => time,
      wait: async remaining => { time += Math.min(1000, remaining); return true; }, capture: async () => { captures++; return shot(false); } });
    expect(result.painted).toBe(false); expect(result.reason).toBe('deadline-exceeded'); expect(time).toBe(4000); expect(captures).toBe(3);
  });
  it('rejects node, source or page replacement during the first otherwise-correct capture', async () => {
    for (const after of [{ ...state, sameNode: false }, { ...state, source: 'blob:replacement' }, { ...state, page: 'p3' }]) {
      const result = await observePlanFixturePaint({ first: shot(true, state, after), now: () => 0,
        wait: async () => { throw new Error('must not wait'); }, capture: async () => { throw new Error('must not recapture'); } });
      expect(result.painted).toBe(false); expect(result.reason).toBe('picture-changed');
    }
  });
  it('rejects asynchronous identity replacement during a retry despite painted pixels', async () => {
    for (const after of [{ ...state, sameNode: false }, { ...state, source: 'blob:replacement' }, { ...state, page: 'p3' }]) {
      let time = 0;
      const result = await observePlanFixturePaint({ first: shot(false), now: () => time,
        wait: async () => { time += 100; return true; }, capture: async () => shot(true, state, after) });
      expect(result.painted).toBe(false); expect(result.reason).toBe('picture-changed'); expect(result.attempts).toHaveLength(2);
    }
  });
});
