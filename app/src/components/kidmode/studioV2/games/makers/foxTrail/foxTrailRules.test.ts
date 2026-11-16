import { describe, expect, it } from 'vitest';
import {
  BOUNCERS, COYOTE_T, JUMP_BUFFER, LOGS, MAX_X, MIN_X, NOOK_X, OFFER_RANGE, OFFER_T, POD_REACH, ROOF, RUN_MAX, SEEDS, STEP_DT, STONES, STONE_X, STREAM, TUNNEL, WAKE_T, WORLD_W,
  allCarried, bladeBend, bladeFlatten, bouncerAt, cameraFollow, canOffer, carriedCount, groundAt, inTunnel, initialFoxState, nightness,
  resetFoxState, roofTop, run, springBlade, step, surfaceAt, upOnRoof, wakeRadius, waterLevel, type FoxInput, type FoxState,
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
    const nearLog = (x: number) => LOGS.some(log => Math.abs(x - log.x) < log.r + 6) || BOUNCERS.some(cap => Math.abs(x - cap.x) < cap.w / 2 + 6);
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

describe('forgiveness', () => {
  const steps = (s: FoxState, input: FoxInput, n: number) => { for (let i = 0; i < n; i++) s = step(s, i === 0 ? input : { dir: input.dir }); return s; };
  it('coyote time: a jump still works a moment after running off an edge', () => {
    // run right off the last stepping stone
    let s = at(STONES[2].x, { vx: RUN_MAX });
    while (s.onGround) s = step(s, { dir: 1 });
    expect(s.coyote).toBeCloseTo(COYOTE_T, 5);
    const late = steps(s, { dir: 1, jump: true }, 1);
    expect(late.events).toContain('jump'); expect(late.vy).toBeGreaterThan(0);
    // … but not long after
    let gone = s; for (let i = 0; i < Math.ceil((COYOTE_T + 0.05) / STEP_DT); i++) gone = step(gone, { dir: 1 });
    if (!gone.onGround) expect(step(gone, { dir: 1, jump: true }).events).not.toContain('jump');
  });
  it('a jump pressed just before landing happens on landing', () => {
    let s = step(at(1500), { dir: 0, jump: true });
    while (!(s.vy < 0 && s.y - surfaceAt(s.x) < 8)) s = step(s, { dir: 0 });
    expect(s.onGround).toBe(false);
    s = step(s, { dir: 0, jump: true }); expect(s.events).not.toContain('jump');
    let jumped = false;
    for (let i = 0; i < Math.ceil(JUMP_BUFFER / STEP_DT) && !jumped; i++) { s = step(s, { dir: 0 }); jumped = s.events.includes('jump'); }
    expect(jumped).toBe(true);
  });
  it('the top of a jump hangs a moment and the way down is quicker than the way up', () => {
    let s = step(at(1500), { dir: 0, jump: true }), up = 1, down = 0, top = 0;
    while (!s.onGround) { s = step(s, { dir: 0 }); top = Math.max(top, s.y - surfaceAt(1500)); if (s.vy > 0) up++; else down++; }
    expect(top).toBeGreaterThan(80); expect(top).toBeLessThan(ROOF.h - 10);
    expect(down).toBeLessThan(up);
  });
  it('a fox standing right against a log still gets over it', () => {
    const log = LOGS[0];
    const s = run(at(log.x - log.r - 1), { dir: 1 }, 1.2);
    expect(s.x).toBeGreaterThan(log.x + log.r);
  });
  it('turning round at a run skids once, and a roll works in the air (a somersault)', () => {
    let s = run(at(1500), { dir: 1 }, 1);
    s = run(s, { dir: -1 }, 0.6);
    expect(s.events.filter(e => e === 'skid')).toHaveLength(1); expect(s.vx).toBeLessThan(0);
    let air = step(at(1500), { dir: 0, jump: true }); air = run(air, { dir: 0 }, 0.1);
    air = step(air, { dir: 0, roll: true });
    expect(air.onGround).toBe(false); expect(air.roll).toBeGreaterThan(0); expect(air.events).toContain('roll');
  });
  it('leaving the stream wet ends in one happy shake on the bank', () => {
    const s = run(at(STREAM.from - 100), { dir: 1 }, 5);
    expect(s.x).toBeGreaterThan(STREAM.to + 24);
    expect(s.events.filter(e => e === 'shakeDry')).toHaveLength(1); expect(s.wet).toBe(0);
  });
});

describe('toadstools and the hidden nook', () => {
  const cap = BOUNCERS[1];
  it('running into a toadstool springs the fox up and over, no aim needed', () => {
    const first = BOUNCERS[0];
    const s = run(at(first.x - 200), { dir: 1 }, 1.6);
    expect(s.events).toContain('bounce'); expect(s.x).toBeGreaterThan(first.x + first.w / 2);
    expect(bouncerAt(first.x)).toBe(0); expect(bouncerAt(first.x + 200)).toBe(-1);
  });
  it('landing on a cap bounces higher each time, up to a limit, for as long as nothing is pressed', () => {
    let s = step(at(cap.x - cap.w / 2 - 20), { dir: 0, target: cap.x });
    const tops: number[] = []; let top = 0;
    for (let i = 0; i < 120 * 9; i++) {
      s = step(s, { dir: 0 });
      top = Math.max(top, s.y - groundAt(cap.x));
      if (s.events.includes('bounce')) { if (top > 0) tops.push(top); top = 0; }
    }
    expect(tops.length).toBeGreaterThan(5);
    expect(tops[2]).toBeGreaterThan(tops[1] + 10); expect(tops[3]).toBeGreaterThan(tops[2] + 10);
    expect(Math.max(...tops)).toBeLessThan(300);
    expect(Math.abs(tops[tops.length - 1] - tops[tops.length - 2])).toBeLessThan(4);
    expect(s.onGround).toBe(false);
  });
  it('the oak\'s top is out of reach of a jump and of simply running into the toadstool', () => {
    let s = run(at(TUNNEL.from - 0.5), { dir: 1, jump: true }, 1.2);
    expect(upOnRoof(s.x, s.y)).toBe(false); expect(s.x).toBeLessThan(TUNNEL.from);
    s = run(at(cap.x - 400), { dir: 1 }, 3);
    expect(s.x).toBeLessThan(TUNNEL.from); expect(s.blocked).toBe(true); expect(s.star).toBe('asleep');
  });
  it('a few bounces on the cap carry Pep up onto the planter, where a fallen star wakes; the light underneath still needs a roll', () => {
    let s = step(at(cap.x - cap.w / 2 - 20), { dir: 0, target: cap.x });
    for (let i = 0; i < 120 * 8 && s.bounces < 3; i++) s = step(s, { dir: 0 });
    expect(s.bounces).toBe(3);
    for (let i = 0; i < 120 * 4 && !(s.onGround && upOnRoof(s.x, s.y)); i++) s = step(s, { dir: 1 });
    expect(upOnRoof(s.x, s.y)).toBe(true); expect(s.y).toBeCloseTo(roofTop(), 5);
    s = runTo(s, NOOK_X, 4);
    expect(s.star).toBe('awake');
    s = run(s, { dir: 1 }, 3);
    expect(s.x).toBeGreaterThan(TUNNEL.to); expect(s.onGround).toBe(true);
    expect(s.seeds.hollow).toBe('resting');
    expect(resetFoxState(s).star).toBe('asleep');
  });
  it('a jump that comes down on the cap is enough too', () => {
    const reached = [150, 160, 170, 180, 190, 200, 210].filter(d => {
      let s = step(at(cap.x - d, { vx: RUN_MAX }), { dir: 1, jump: true });
      for (let i = 0; i < 120 * 3 && !s.onGround; i++) s = step(s, { dir: 1 });
      return upOnRoof(s.x, s.y);
    });
    expect(reached.length).toBeGreaterThanOrEqual(2);
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
  it('the pod over the stepping stone hangs out of a hop\'s reach: running across leaves it, a jump takes it', () => {
    const across = runTo(at(STREAM.from - 120), STONES[2].x + 60, 6);
    expect(across.seeds.stone).toBe('resting');
    let s = runTo(at(STREAM.from - 120), SEEDS.stone.x - 6, 6);
    s = run(s, { dir: 0 }, 0.6); expect(s.seeds.stone).toBe('resting');
    s = run(s, { dir: 0, jump: true }, 0.5);
    expect(s.seeds.stone).toBe('carried'); expect(carriedCount(s)).toBe(1);
    // … and from the water beside the stone too: no aim needed.
    let wading = at(SEEDS.stone.x + 44); wading = run(wading, { dir: 0, jump: true }, 0.5);
    expect(wading.seeds.stone).toBe('carried');
    expect(POD_REACH).toBeLessThan(SEEDS.stone.lift);
  });
  it('play again hangs the pod over another stone, and everything else is the same', () => {
    const xs = [0, 1, 2].map(v => initialFoxState(v).seedX.stone);
    expect(new Set(xs).size).toBe(3);
    for (const x of xs) expect(STONES.some(stone => stone.x === x)).toBe(true);
    expect(initialFoxState(3)).toEqual(initialFoxState(0));
    let s = runTo(initialFoxState(2), initialFoxState(2).seedX.stone - 4, 20);
    s = run(s, { dir: 0, jump: true }, 0.6);
    expect(s.seeds.stone).toBe('carried');
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
    // the lights fly to the mirror first; only then does the ring start out
    expect(wakeRadius('waking', OFFER_T)).toBe(0); expect(wakeRadius('waking', OFFER_T + 0.5)).toBeGreaterThan(0);
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
    s = runTo(s, SEEDS.stone.x - 4, 30); s = run(s, { dir: 0, jump: true }, 0.6); expect(s.seeds.stone).toBe('carried');
    s = runTo(s, TUNNEL.from - 20, 30); expect(s.x).toBeLessThan(TUNNEL.from);
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
