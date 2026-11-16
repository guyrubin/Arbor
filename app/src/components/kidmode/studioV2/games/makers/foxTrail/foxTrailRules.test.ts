import { describe, expect, it } from 'vitest';
import {
  LOGS, MAX_X, MIN_X, OFFER_RANGE, RUN_MAX, SEEDS, STONES, STONE_X, STREAM, TUNNEL, WAKE_T, WORLD_W,
  allCarried, bladeBend, bladeFlatten, cameraFollow, canOffer, carriedCount, groundAt, inTunnel, initialFoxState, nightness,
  resetFoxState, run, springBlade, step, surfaceAt, wakeRadius, waterLevel, type FoxState,
} from './foxTrailRules';

const at = (x: number, extra: Partial<FoxState> = {}): FoxState => ({ ...initialFoxState(), x, y: surfaceAt(x), ...extra });
/** Hold a direction until the fox reaches `x` (or the time runs out). */
function runTo(s: FoxState, x: number, limit = 40): FoxState {
  const dir = x > s.x ? 1 : -1;
  for (let t = 0; t < limit * 120 && (dir > 0 ? s.x < x : s.x > x); t++) s = step(s, { dir });
  return s;
}

describe('the trail', () => {
  it('is continuous, with logs and stones as heights along it and a shallow stream', () => {
    const nearLog = (x: number) => LOGS.some(log => Math.abs(x - log.x) < log.r + 6);
    for (let x = 0; x < WORLD_W; x += 5) if (!nearLog(x)) expect(Math.abs(surfaceAt(x + 5) - surfaceAt(x)), `x=${x}`).toBeLessThan(30);
    for (const log of LOGS) expect(surfaceAt(log.x) - groundAt(log.x)).toBeCloseTo(log.r * 2, 0);
    expect(groundAt((STREAM.from + STREAM.to) / 2)).toBeLessThan(groundAt(STREAM.from) - 10);
    expect(waterLevel()).toBeGreaterThan(groundAt((STREAM.from + STREAM.to) / 2));
    for (const stone of STONES) expect(surfaceAt(stone.x)).toBeGreaterThan(waterLevel());
  });
});

describe('movement', () => {
  it('accelerates, eases out and leans on a fixed step', () => {
    let s = initialFoxState();
    s = step(s, { dir: 1 }); expect(s.vx).toBeGreaterThan(0); expect(s.vx).toBeLessThan(RUN_MAX / 10);
    s = run(s, { dir: 1 }, 1); expect(s.vx).toBeCloseTo(RUN_MAX, 0); expect(s.dist).toBeGreaterThan(200);
    s = run(s, { dir: 0 }, 0.1); expect(s.vx).toBeGreaterThan(0); expect(s.vx).toBeLessThan(RUN_MAX);
    s = run(s, { dir: 0 }, 1); expect(s.vx).toBe(0);
  });
  it('never leaves the trail', () => {
    let s = run(initialFoxState(), { dir: -1 }, 3); expect(s.x).toBe(MIN_X);
    s = run(at(MAX_X - 20), { dir: 1 }, 2); expect(s.x).toBe(MAX_X);
  });
  it('hops a log by itself when running into it, and a Jump works too', () => {
    const log = LOGS[0];
    let s = runTo(at(log.x - 200), log.x + 120, 5);
    expect(s.x).toBeGreaterThan(log.x + 100);
    const hopped = run(at(log.x - 200), { dir: 1 }, 1.5);
    expect(hopped.events).toContain('hop');
    s = step(at(1500), { dir: 0, jump: true }); expect(s.onGround).toBe(false); expect(s.events).toContain('jump');
    s = run(s, { dir: 0 }, 1.2); expect(s.onGround).toBe(true);
  });
  it('the stream is ankle deep: walking through splashes and slows', () => {
    let s = at(STREAM.from + 30, { vx: 0 });
    s = run(s, { dir: 1 }, 0.25);
    expect(s.x).toBeLessThan(STONES[0].x - STONES[0].w / 2);
    expect(Math.abs(s.vx)).toBeLessThan(RUN_MAX * 0.6);
    const through = run(at(STREAM.from - 100), { dir: 1 }, 4);
    expect(through.events).toContain('splash');
    expect(through.x).toBeGreaterThan(STREAM.to);
  });
  it('a tap on the trail sends the fox trotting there, and it stops', () => {
    let s = step(initialFoxState(), { dir: 0, target: 500 });
    s = run(s, { dir: 0 }, 4);
    expect(Math.abs(s.x - 500)).toBeLessThan(12); expect(s.target).toBeNull();
  });
  it('sits after standing still for three seconds', () => {
    const s = run(initialFoxState(), { dir: 0 }, 3.2);
    expect(s.still).toBeGreaterThan(3);
  });
});

describe('the roll and the hollow oak', () => {
  it('a roll lasts about 0.6 s and travels farther and faster than running', () => {
    const start = at(1500);
    const rolled = run(start, { dir: 0, roll: true }, 0.6);
    const ran = run(start, { dir: 1 }, 0.6);
    expect(rolled.events).toContain('roll');
    expect(rolled.x - start.x).toBeGreaterThan(ran.x - start.x);
    expect(run(rolled, { dir: 0 }, 0.05).roll).toBe(0);
  });
  it('cannot pass the tunnel without rolling, from either side', () => {
    let s = run(at(TUNNEL.from - 150), { dir: 1 }, 3);
    expect(s.x).toBeLessThan(TUNNEL.from); expect(s.blocked).toBe(true); expect(s.events).toContain('blocked');
    s = run(s, { dir: 0, jump: true }, 1); s = run(s, { dir: 1 }, 2);
    expect(inTunnel(s.x)).toBe(false); expect(s.x).toBeLessThan(TUNNEL.from);
    s = run(at(TUNNEL.to + 150, { facing: -1 }), { dir: -1 }, 3);
    expect(s.x).toBeGreaterThan(TUNNEL.to);
  });
  it('a roll tumbles right through, and the roll lasts until the fox is out', () => {
    let s = run(at(TUNNEL.from - 30), { dir: 1 }, 0.1);
    s = run(s, { dir: 0, roll: true }, 1.2);
    expect(s.x).toBeGreaterThan(TUNNEL.to);
    expect(s.seeds.hollow).toBe('carried');
  });
});

describe('lantern-seeds', () => {
  it('the seed in tall grass only comes out for a roll; then it can be picked up', () => {
    let s = runTo(at(SEEDS.tallGrass.x - 200), SEEDS.tallGrass.x + 220, 5);
    expect(s.seeds.tallGrass).toBe('hidden');
    s = run(at(SEEDS.tallGrass.x - 90), { dir: 0, roll: true }, 0.4);
    expect(['popping', 'resting', 'carried']).toContain(s.seeds.tallGrass);
    s = run(s, { dir: 0 }, 0.8);
    s = runTo(s, s.seedX.tallGrass + 10, 3);
    expect(s.seeds.tallGrass).toBe('carried');
  });
  it('the seed on the stepping stone is reached by running across the stream', () => {
    const s = runTo(at(STREAM.from - 120), STONES[2].x + 60, 6);
    expect(s.seeds.stone).toBe('carried');
    expect(carriedCount(s)).toBe(1);
  });
});

describe('the mirror stone', () => {
  const ready = (x: number) => at(x, { seeds: { tallGrass: 'carried', stone: 'carried', hollow: 'carried' } });
  it('activation needs all three seeds and the fox in range', () => {
    expect(canOffer(ready(STONE_X - 40))).toBe(true);
    expect(canOffer(ready(STONE_X - OFFER_RANGE - 60))).toBe(false);
    expect(canOffer(at(STONE_X - 40, { seeds: { tallGrass: 'carried', stone: 'carried', hollow: 'resting' } }))).toBe(false);
    const few = step(at(STONE_X - 40, { seeds: { tallGrass: 'carried', stone: 'resting', hollow: 'resting' } }), { dir: 0, offer: true });
    expect(few.phase).toBe('dusk');
  });
  it('with fewer seeds the stone hums once as the fox arrives (no words, no failure)', () => {
    const s = runTo(at(STONE_X - OFFER_RANGE - 80), STONE_X - 60, 3);
    expect(s.phase).toBe('dusk');
    const arrived = run(at(STONE_X - OFFER_RANGE - 80), { dir: 1 }, 1.5);
    expect(arrived.events.filter(e => e === 'hum')).toHaveLength(1);
  });
  it('offering the light wakes the mirror, the world goes dusk → waking → night for good', () => {
    let s = step(ready(STONE_X - 40), { dir: 0, offer: true });
    expect(s.phase).toBe('waking'); expect(s.events).toContain('wake');
    expect(nightness(s.phase, 0.5, 3000)).toBe(0);
    s = run(s, { dir: 1 }, WAKE_T / 2); expect(s.phase).toBe('waking'); expect(Math.abs(s.vx)).toBeLessThan(5);
    s = run(s, { dir: 0 }, WAKE_T / 2 + 0.1); expect(s.phase).toBe('night'); expect(s.events).toContain('night');
    s = run(s, { dir: -1 }, 3); expect(s.phase).toBe('night'); expect(s.x).toBeLessThan(STONE_X - 500);
    expect(nightness('night', 0, 6000)).toBe(1);
    expect(wakeRadius('waking', WAKE_T)).toBeGreaterThan(STONE_X);
    expect(wakeRadius('dusk', 3)).toBe(0);
  });
  it('the whole trail can be played from the start with the real inputs', () => {
    let s = initialFoxState();
    s = runTo(s, SEEDS.tallGrass.x - 100); s = run(s, { dir: 1, roll: true }, 0.7); s = run(s, { dir: 0 }, 0.6);
    s = runTo(s, s.seedX.tallGrass + 5); expect(s.seeds.tallGrass).toBe('carried');
    s = runTo(s, TUNNEL.from - 20, 30); expect(s.seeds.stone).toBe('carried'); expect(s.x).toBeLessThan(TUNNEL.from);
    s = run(s, { dir: 1, roll: true }, 1.4); expect(allCarried(s)).toBe(true);
    s = runTo(s, STONE_X - 30, 30); s = run(s, { dir: 0 }, 0.5);
    expect(canOffer(s)).toBe(true);
    s = run(s, { dir: 0, offer: true }, WAKE_T + 0.2); expect(s.phase).toBe('night');
  });
  it('replay state equals the initial state', () => {
    const played = run(at(STONE_X - 30, { seeds: { tallGrass: 'carried', stone: 'carried', hollow: 'carried' } }), { dir: 0, offer: true }, 6);
    expect(resetFoxState(played)).toEqual(initialFoxState());
    expect(initialFoxState().phase).toBe('dusk');
    expect(initialFoxState().seeds).toEqual({ tallGrass: 'hidden', stone: 'resting', hollow: 'resting' });
  });
});

describe('tallGrass', () => {
  const fox = { x: 1000, vx: RUN_MAX, lift: 0, rolling: false };
  it('bends away from the fox, more when close and fast, not at all far away or when it leaps clear', () => {
    expect(bladeBend(1030, fox)).toBeGreaterThan(0);
    expect(bladeBend(970, fox)).toBeLessThan(0);
    expect(Math.abs(bladeBend(1010, fox))).toBeGreaterThan(Math.abs(bladeBend(1070, fox)));
    expect(Math.abs(bladeBend(1030, fox))).toBeGreaterThan(Math.abs(bladeBend(1030, { ...fox, vx: 0 })));
    expect(bladeBend(1400, fox)).toBe(0);
    expect(bladeBend(1020, { ...fox, lift: 120 })).toBe(0);
    expect(bladeFlatten(1010, { ...fox, rolling: true })).toBeGreaterThan(0.5);
    expect(bladeFlatten(1010, fox)).toBe(0);
  });
  it('springs back with a little overshoot, and none with reduced motion', () => {
    const settle = (reduced: boolean) => {
      let a = 1, v = 0, min = 1;
      for (let i = 0; i < 240; i++) { [a, v] = springBlade(a, v, 0, 1 / 120, reduced); min = Math.min(min, a); }
      return { a, min };
    };
    const lively = settle(false), calm = settle(true);
    expect(lively.min).toBeLessThan(-0.05); expect(Math.abs(lively.a)).toBeLessThan(0.1);
    expect(calm.min).toBeGreaterThanOrEqual(-1e-6); expect(Math.abs(calm.a)).toBeLessThan(0.05);
  });
});

describe('camera', () => {
  it('follows the fox and never shows past either end', () => {
    expect(cameraFollow(0, 100, 1, 800, 1 / 60, true)).toBe(0);
    expect(cameraFollow(0, WORLD_W, 1, 800, 1 / 60, true)).toBe(WORLD_W - 800);
    const c = cameraFollow(0, 3000, 1, 800, 1 / 60);
    expect(c).toBeGreaterThan(0); expect(c).toBeLessThan(3000);
    expect(cameraFollow(0, 3000, 1, 9000, 1 / 60, true)).toBe(0);
  });
});
