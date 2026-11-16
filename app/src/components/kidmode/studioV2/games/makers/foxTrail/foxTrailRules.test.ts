import { describe, expect, it } from 'vitest';
import {
  BOUNCE_V, GAP_DEPTH, LESSON_SLOW, LIFT_CEIL, PEP_HALF, SPEEDS, STEP_DT, STRETCH_IDS,
  buildCourse, cameraX, chainNote, cleanPilot, duskDepth, floorAt, hurdleAt, idlePilot, initialRun, run, step, suggest, sweepX, updraftAt, warmth,
  type Course, type Hurdle, type HurdleKind, type RunEvent, type RunInput, type RunState,
} from './foxTrailRules';

const SEEDS = [1, 2, 3, 77, 999, 12345, 20261116];
const course = buildCourse(77);
const kinds = (events: readonly RunEvent[]) => events.map(e => e.kind);
/** Pep already running at full pace in the stretch that holds `x`, with every lesson learned and everything behind him settled. */
function runningAt(c: Course, x: number, extra: Partial<RunState> = {}): RunState {
  const s = initialRun(c);
  let stretch = 0; c.stretches.forEach((st, i) => { if (x >= st.from) stretch = i; });
  const nextHurdle = c.hurdles.findIndex(h => h.x + h.w / 2 + PEP_HALF > x);
  const nextLamp = c.lamps.findIndex(l => l.x + 80 > x);
  return { ...s, mode: 'onTheRun', stretch, x, vx: c.stretches[stretch].speed, learned: { jumpNow: true, holdNow: true, rollNow: true },
    hurdles: c.hurdles.map((_h, i) => (nextHurdle >= 0 && i < nextHurdle ? 1 : 0)), lamps: c.lamps.map((_l, i) => (nextLamp >= 0 && i < nextLamp ? 1 : 0)),
    nextHurdle: nextHurdle < 0 ? c.hurdles.length : nextHurdle, nextLamp: nextLamp < 0 ? c.lamps.length : nextLamp, ...extra };
}
const first = (c: Course, kind: HurdleKind, big = false): Hurdle => c.hurdles.find(h => h.kind === kind && h.big === big)!;
/** Steps until `stop` is true (or `seconds` pass), feeding `pilot`; returns the last state and every event. */
function until(c: Course, s: RunState, pilot: (s: RunState) => RunInput, stop: (s: RunState) => boolean, seconds = 12): { s: RunState; events: RunEvent[] } {
  const events: RunEvent[] = [];
  for (let i = 0; i < seconds / STEP_DT && !stop(s); i++) { s = step(c, s, pilot(s)); events.push(...s.events); }
  return { s, events };
}
const hands = (): RunInput => ({});

describe('the course', () => {
  it('is the same for the same seed and different for another', () => {
    expect(buildCourse(42)).toEqual(buildCourse(42));
    const a = buildCourse(1), b = buildCourse(2);
    expect(a.hurdles.map(h => `${h.kind}${h.x}`)).not.toEqual(b.hurdles.map(h => `${h.kind}${h.x}`));
    const stars = new Set(SEEDS.map(seed => Math.round(buildCourse(seed).star.x - buildCourse(seed).stretches[1].from)));
    const tunes = new Set(SEEDS.map(seed => buildCourse(seed).tune.join(',')));
    expect(stars.size).toBeGreaterThan(1); expect(tunes.size).toBeGreaterThan(SEEDS.length - 2);
  });
  it('runs three stretches in order, each a little faster, with a station at the end of each', () => {
    for (const seed of SEEDS) {
      const c = buildCourse(seed);
      expect(c.stretches.map(st => st.id)).toEqual(STRETCH_IDS);
      for (let i = 0; i < 3; i++) {
        const st = c.stretches[i];
        expect(st.speed).toBe(SPEEDS[st.id]); expect(st.station).toBeGreaterThan(st.from + 5000); expect(st.to).toBeGreaterThan(st.station);
        if (i) { expect(st.speed).toBeGreaterThan(c.stretches[i - 1].speed); expect(st.from).toBeGreaterThan(c.stretches[i - 1].station); }
      }
      expect(c.length).toBe(c.stretches[2].station);
    }
  });
  it('grows the play: planters in the gardens, bunting and updrafts on the bridge, gaps in the basin', () => {
    for (const seed of SEEDS) {
      const c = buildCourse(seed);
      const in0 = c.hurdles.filter(h => h.stretch === 0), in1 = c.hurdles.filter(h => h.stretch === 1), in2 = c.hurdles.filter(h => h.stretch === 2);
      expect(new Set(in0.map(h => h.kind))).toEqual(new Set(['planterBox']));
      expect(in0.some(h => h.big)).toBe(true);
      expect(in1.some(h => h.kind === 'buntingLine')).toBe(true); expect(in1.some(h => h.kind === 'padGap')).toBe(false);
      expect(c.updrafts.some(u => u.stretch === 1)).toBe(true); expect(c.updrafts.some(u => u.stretch === 0)).toBe(false);
      expect(in2.some(h => h.kind === 'padGap' && !h.big)).toBe(true); expect(in2.some(h => h.kind === 'padGap' && h.big)).toBe(true);
      expect(in2.some(h => h.kind === 'buntingLine')).toBe(true);
      // the first hurdle of each stretch is its lesson
      expect(in0[0].kind).toBe('planterBox'); expect(in1[0].kind).toBe('buntingLine'); expect(in2[0].kind).toBe('padGap');
    }
  });
  it('leaves room to react: hurdles in order, well apart, and none near a station', () => {
    for (const seed of SEEDS) {
      const c = buildCourse(seed);
      for (let i = 1; i < c.hurdles.length; i++) {
        expect(c.hurdles[i].id).toBe(i);
        expect(c.hurdles[i].x - c.hurdles[i].w / 2 - (c.hurdles[i - 1].x + c.hurdles[i - 1].w / 2), `seed ${seed} hurdle ${i}`).toBeGreaterThan(180);
      }
      expect(c.hurdles[0].x).toBeGreaterThan(c.start + 700);
      for (const st of c.stretches) for (const h of c.hurdles) expect(Math.abs(h.x - st.station)).toBeGreaterThan(300);
      // a line of bunting never hangs over an updraft or a gap
      for (const h of c.hurdles) if (h.kind === 'buntingLine') { expect(updraftAt(c, h.x)).toBe(-1); expect(hurdleAt(c, h.x, 'padGap', 60)).toBe(-1); }
    }
  });
  it('lays lamps in order, each path lamp behind its hurdle, and hides the star over a skybridge updraft', () => {
    for (const seed of SEEDS) {
      const c = buildCourse(seed);
      c.lamps.forEach((l, i) => { expect(l.id).toBe(i); if (i) expect(l.x).toBeGreaterThanOrEqual(c.lamps[i - 1].x); });
      for (const l of c.lamps) if (l.after >= 0) { expect(l.tier).toBe('pathLamp'); expect(l.x).toBeGreaterThan(c.hurdles[l.after].x + c.hurdles[l.after].w / 2); expect(l.x - c.hurdles[l.after].x).toBeLessThan(420); }
      // the first two lamps are free: they teach that a lamp wakes when Pep passes
      expect(c.lamps[0].after).toBe(-1); expect(c.lamps[1].after).toBe(-1); expect(c.lamps[1].x).toBeLessThan(c.hurdles[0].x);
      const home = updraftAt(c, c.star.x);
      expect(home).toBeGreaterThanOrEqual(0); expect(c.updrafts[home].stretch).toBe(1); expect(c.star.y).toBeGreaterThan(LIFT_CEIL + 100);
      for (const note of c.tune) { expect(note).toBeGreaterThanOrEqual(5); expect(note).toBeLessThanOrEqual(19); }
      expect(c.tune[c.tune.length - 1]).toBeGreaterThan(c.tune[0]);
    }
  });
  it('has water only between the float pads', () => {
    const g = first(course, 'padGap');
    expect(floorAt(course, g.x)).toBe(-GAP_DEPTH); expect(floorAt(course, g.x - g.w / 2 - 2)).toBe(0); expect(floorAt(course, g.x + g.w / 2 + 2)).toBe(0);
    expect(floorAt(course, course.start)).toBe(0); expect(floorAt(course, first(course, 'planterBox').x)).toBe(0);
  });
});

describe('setting off', () => {
  it('waits at the start until Go, or a tap after a breath', () => {
    let s = initialRun(course);
    s = run(course, s, hands, 2); expect(s.mode).toBe('atStart'); expect(s.x).toBe(course.start);
    expect(step(course, initialRun(course), { jump: true }).mode).toBe('atStart');
    expect(step(course, s, { jump: true }).mode).toBe('onTheRun');
    const off = step(course, initialRun(course), { go: true });
    expect(off.mode).toBe('onTheRun'); expect(kinds(off.events)).toEqual(['setOff']);
  });
  it('runs by itself and eases up to the stretch’s pace', () => {
    let s = step(course, initialRun(course), { go: true });
    s = run(course, s, hands, 0.1); expect(s.vx).toBeGreaterThan(0); expect(s.vx).toBeLessThan(SPEEDS.skyGardens);
    s = run(course, s, hands, 1); expect(s.vx).toBeCloseTo(SPEEDS.skyGardens, 0); expect(s.dist).toBeGreaterThan(150);
  });
  it('never changes the state it was given', () => {
    const h = first(course, 'planterBox');
    const before = runningAt(course, h.x - h.w / 2 - PEP_HALF - 1);
    const copy = JSON.parse(JSON.stringify(before));
    const after = step(course, step(course, before, {}), {});
    expect(after.hurdles[h.id]).toBe(2); expect(after.bumps).toBe(1);
    expect(before).toEqual(copy);
  });
});

describe('the jump', () => {
  const flat = course.start + 60;
  const apex = (input: (s: RunState, i: number) => RunInput) => { let s = runningAt(course, flat), top = 0, i = 0; do { s = step(course, s, input(s, i++)); top = Math.max(top, s.y); } while (!s.onGround && i < 400); return { top, far: s.x - flat, steps: i }; };
  it('is a real hop on the quickest tap, and higher and longer when the tap is held', () => {
    const tap = apex((_s, i) => ({ jump: i === 0, hold: i < 3 }));
    const held = apex((_s, i) => ({ jump: i === 0, hold: true }));
    expect(tap.top).toBeGreaterThan(95); expect(tap.top).toBeLessThan(130);
    expect(held.top).toBeGreaterThan(tap.top + 40); expect(held.far).toBeGreaterThan(tap.far + 60);
  });
  it('forgives a tap a moment early (buffer) and a moment late off an edge (coyote)', () => {
    // pressed in the air just before landing: it happens on landing
    let s = runningAt(course, flat, { onGround: false, y: 6, vy: -200, airT: 0.4 });
    s = step(course, s, { jump: true }); expect(s.onGround).toBe(false);
    const out = until(course, s, hands, t => t.vy > 300, 0.3); expect(kinds(out.events)).toContain('jumpUp');
    // run off a float pad, then tap: still a jump, not a splash
    const g = first(course, 'padGap');
    let off = runningAt(course, g.x - g.w / 2 - 1);
    for (let i = 0; i < 8; i++) off = step(course, off, {});
    expect(off.onGround).toBe(false);
    off = step(course, off, { jump: true, hold: true }); expect(kinds(off.events)).toContain('jumpUp');
  });
});

describe('a planter', () => {
  const h = first(course, 'planterBox');
  const lampAfter = course.lamps.find(l => l.after === h.id)!;
  it('is cleared by a tap at the cue, and the lamp behind it wakes', () => {
    const pilot = cleanPilot();
    const out = until(course, runningAt(course, h.x - 300), s => pilot(s, course), s => s.x > lampAfter.x + 20);
    expect(out.s.hurdles[h.id]).toBe(1); expect(out.s.lamps[lampAfter.id]).toBe(1); expect(out.s.bumps).toBe(0);
    expect(kinds(out.events)).toContain('cleanPass'); expect(out.events.find(e => e.kind === 'lampLit' && e.id === lampAfter.id)).toBeTruthy();
  });
  it('is a soft bounce over the top when it is not jumped: Pep keeps going, the lamp waits, the chain starts again', () => {
    const out = until(course, runningAt(course, h.x - 200, { chain: 5 }), hands, s => s.x > lampAfter.x + 20);
    const bump = out.events.find(e => e.kind === 'softBump');
    expect(bump?.id).toBe(h.id); expect(out.s.hurdles[h.id]).toBe(2); expect(out.s.bumps).toBe(1); expect(out.s.chain).toBeLessThanOrEqual(1);
    expect(out.s.lamps[lampAfter.id]).toBe(2); expect(kinds(out.events)).toContain('lampWaits');
    // he went up and over, never stopped, and is back at full pace soon after
    expect(out.s.x).toBeGreaterThan(h.x + h.w); expect(Math.min(...[out.s.vx])).toBeGreaterThan(SPEEDS.skyGardens * 0.5);
    const bounced = step(course, runningAt(course, h.x - h.w / 2 - PEP_HALF + 1), {});
    expect(bounced.vy).toBe(BOUNCE_V); expect(bounced.onGround).toBe(false);
    expect(out.s.pace).toBeGreaterThan(0.8); expect(out.s.vx).toBeGreaterThan(SPEEDS.skyGardens * 0.75);
  });
});

describe('a line of bunting', () => {
  const h = first(course, 'buntingLine');
  const lampAfter = course.lamps.find(l => l.after === h.id)!;
  it('is passed by a roll, which lasts until Pep is out from under it', () => {
    const start = runningAt(course, h.x - h.w / 2 - PEP_HALF - 150);
    let rolled = false;
    const out = until(course, start, () => (rolled ? {} : (rolled = true, { roll: true })), s => s.x > lampAfter.x + 20);
    expect(out.s.hurdles[h.id]).toBe(1); expect(out.s.lamps[lampAfter.id]).toBe(1); expect(kinds(out.events)).toContain('rollIn');
    // still rolling in the middle, even though the roll's own time would have run out
    const mid = until(course, step(course, runningAt(course, h.x - h.w / 2 - PEP_HALF - 4), { roll: true }), hands, s => s.x > h.x + h.w / 2).s;
    expect(mid.roll).toBeGreaterThan(0);
  });
  it('flops over him when he does not roll: he tumbles through underneath all the same', () => {
    const out = until(course, runningAt(course, h.x - 300), hands, s => s.x > lampAfter.x + 20);
    expect(out.events.find(e => e.kind === 'softBump')?.id).toBe(h.id); expect(out.s.hurdles[h.id]).toBe(2); expect(out.s.lamps[lampAfter.id]).toBe(2);
    expect(out.s.x).toBeGreaterThan(lampAfter.x);
  });
  it('does not let him jump up into the cloth', () => {
    const under = step(course, runningAt(course, h.x, { roll: 0.3 }), { jump: true, hold: true });
    expect(under.onGround).toBe(true); expect(kinds(under.events)).not.toContain('jumpUp');
  });
  it('turns a swipe just after take-off into a roll, and a swipe higher up into a dive that lands rolling', () => {
    const flat = course.start + 60;
    let s = step(course, runningAt(course, flat), { jump: true, hold: true });
    for (let i = 0; i < 6; i++) s = step(course, s, { hold: true });
    const cancelled = step(course, s, { roll: true });
    expect(cancelled.onGround).toBe(true); expect(cancelled.y).toBe(0); expect(cancelled.roll).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) s = step(course, s, { hold: true });
    const dive = step(course, s, { roll: true });
    expect(dive.dive).toBe(true); expect(dive.vy).toBeLessThan(0);
    const landed = until(course, dive, hands, t => t.onGround, 1);
    expect(landed.s.roll).toBeGreaterThan(0); expect(kinds(landed.events)).toEqual(expect.arrayContaining(['rollIn', 'touchDown']));
  });
});

describe('the basin', () => {
  const g = first(course, 'padGap'), wide = first(course, 'padGap', true);
  it('is skipped with a tap at the edge', () => {
    const pilot = cleanPilot();
    const out = until(course, runningAt(course, g.x - 300), s => pilot(s, course), s => s.x > g.x + g.w / 2 + 120);
    expect(out.s.hurdles[g.id]).toBe(1); expect(kinds(out.events)).not.toContain('waterSplash');
  });
  it('is a splash and a paddle when it is not: slower in the water, then out by himself', () => {
    const out = until(course, runningAt(course, g.x - 120), hands, s => s.x > g.x + g.w / 2 + 140);
    expect(kinds(out.events)).toEqual(expect.arrayContaining(['waterSplash', 'climbOut', 'touchDown']));
    expect(out.s.hurdles[g.id]).toBe(2); expect(out.s.wading).toBe(false); expect(out.s.y).toBe(0); expect(out.s.onGround).toBe(true);
    const wet = run(course, until(course, runningAt(course, g.x - 120), hands, s => s.wading).s, hands, 0.12);
    expect(wet.y).toBe(-GAP_DEPTH); expect(wet.vx).toBeLessThan(SPEEDS.theBasin * 0.8);
    // a jump works from the water too
    expect(kinds(step(course, wet, { jump: true, hold: true }).events)).toContain('jumpUp');
  });
  it('needs the held jump for a wide gap: a quick tap from the cue lands in the water', () => {
    const at = runningAt(course, wide.x - wide.w / 2 - 26);
    const tap = until(course, step(course, at, { jump: true, hold: true }), hands, s => s.onGround || s.x > wide.x + wide.w, 2);
    const held = until(course, step(course, at, { jump: true, hold: true }), () => ({ hold: true }), s => s.onGround || s.x > wide.x + wide.w, 2);
    expect(kinds(tap.events)).toContain('waterSplash');
    expect(kinds(held.events)).not.toContain('waterSplash'); expect(held.s.x).toBeGreaterThan(wide.x + wide.w / 2);
    expect(suggest(course, runningAt(course, wide.x - wide.w / 2 - 12))).toBe('holdNow');
  });
});

describe('an updraft', () => {
  const lift = course.updrafts.find(u => u.stretch === 1 && updraftAt(course, course.star.x) === u.id)!;
  const ride = (hold: boolean) => until(course, step(course, runningAt(course, lift.from - 20), { jump: true, hold: true }), () => ({ hold }), s => s.x > lift.to - 30, 3);
  it('carries a jumping Pep up like a kite, and higher while the tap is held', () => {
    const tap = ride(false), held = ride(true);
    expect(kinds(tap.events)).toContain('liftOff'); expect(tap.s.lifted).toBe(true);
    expect(tap.s.y).toBeGreaterThan(LIFT_CEIL - 30); expect(tap.s.y).toBeLessThan(LIFT_CEIL + 30);
    expect(held.s.y).toBeGreaterThan(tap.s.y + 50);
    // it does nothing to a dog who stays on the path
    expect(until(course, runningAt(course, lift.from - 20), hands, s => s.x > lift.to).s.y).toBe(0);
  });
  it('hides the star where only the held jump reaches', () => {
    expect(ride(false).s.star).toBe(false);
    const found = ride(true);
    expect(found.s.star).toBe(true); expect(kinds(found.events)).toContain('starFound');
  });
  it('lets go at its far end: Pep comes down and lands running', () => {
    const down = until(course, ride(true).s, hands, s => s.onGround, 3);
    expect(down.s.y).toBe(0); expect(kinds(down.events)).toContain('touchDown'); expect(down.s.lifted).toBe(false);
  });
});

describe('the first time', () => {
  it('meets the first hurdle of a kind in slow motion until the child makes that move', () => {
    const h = first(course, 'planterBox');
    const fresh = { learned: { jumpNow: false, holdNow: false, rollNow: false } };
    const out = until(course, runningAt(course, h.x - 200, fresh), hands, s => s.slow < 1, 2);
    expect(out.s.slow).toBe(LESSON_SLOW); expect(kinds(out.events)).toContain('lessonCue');
    expect(suggest(course, out.s)).toBe('jumpNow');
    const x0 = out.s.x, slowStep = step(course, out.s, {}), fullStep = step(course, { ...out.s, learned: { jumpNow: true, holdNow: true, rollNow: true } }, {});
    expect(slowStep.x - x0).toBeLessThan((fullStep.x - x0) * 0.5);
    // the tap ends the lesson for good
    const jumped = step(course, out.s, { jump: true, hold: true });
    expect(jumped.learned.jumpNow).toBe(true); expect(step(course, jumped, {}).slow).toBe(1);
  });
  it('teaches the roll the same way, and gives up gently if nothing happens', () => {
    const h = first(course, 'buntingLine');
    const fresh = { learned: { jumpNow: true, holdNow: true, rollNow: false } };
    const out = until(course, runningAt(course, h.x - 320, fresh), hands, s => s.slow < 1, 2);
    expect(suggest(course, out.s)).toBe('rollNow'); expect(out.events.find(e => e.kind === 'lessonCue')?.n).toBe(1);
    const waited = until(course, out.s, hands, s => s.x > h.x + h.w, 8);
    expect(waited.s.hurdles[h.id]).toBe(2); expect(waited.s.slow).toBe(1);
  });
  it('suggests nothing while Pep waits or is already in the air', () => {
    expect(suggest(course, initialRun(course))).toBe('');
    const h = first(course, 'planterBox');
    expect(suggest(course, runningAt(course, h.x - h.w / 2 - PEP_HALF - 30, { onGround: false, y: 40 }))).toBe('');
  });
});

describe('stations and home', () => {
  it('skids to a stop beside the friend, waits for Go, and sets off on the next stretch', () => {
    const st = course.stretches[0];
    const out = until(course, runningAt(course, st.station - 400), hands, s => s.mode === 'atStation', 6);
    expect(kinds(out.events)).toEqual(expect.arrayContaining(['skidIn', 'stationIn']));
    expect(out.s.vx).toBe(0); expect(Math.abs(out.s.x - st.station)).toBeLessThan(12);
    const waiting = run(course, out.s, hands, 3); expect(waiting.x).toBe(out.s.x); expect(waiting.mode).toBe('atStation');
    const off = step(course, waiting, { go: true });
    expect(off.mode).toBe('onTheRun'); expect(off.stretch).toBe(1); expect(off.events).toEqual([{ kind: 'setOff', n: 1 }]);
    expect(run(course, off, hands, 1.5).vx).toBeCloseTo(SPEEDS.skyBridge, 0);
  });
  it('ignores taps while it brakes, and comes home at the Dome', () => {
    const st = course.stretches[2];
    const out = until(course, runningAt(course, st.station - 300), () => ({ jump: true, hold: true, roll: true }), s => s.mode === 'atHome', 6);
    expect(out.s.mode).toBe('atHome'); expect(kinds(out.events)).toContain('homeIn'); expect(Math.abs(out.s.x - course.length)).toBeLessThan(12);
    expect(run(course, out.s, () => ({ go: true, jump: true }), 2).x).toBe(out.s.x);
  });
});

describe('a whole run', () => {
  it('can be played clean on every course: every lamp lit, no bump, the star found', () => {
    for (const seed of SEEDS) {
      const c = buildCourse(seed);
      const s = run(c, initialRun(c), cleanPilot(), 130);
      expect(s.mode, `seed ${seed}`).toBe('atHome');
      expect(s.bumps, `seed ${seed}`).toBe(0); expect(s.lit, `seed ${seed}`).toBe(c.lamps.length); expect(s.star).toBe(true);
      expect(s.hurdles.every(v => v === 1)).toBe(true);
      // the chain of notes never broke: the last lamp played the longest chain
      const lamps = s.events.filter(e => e.kind === 'lampLit');
      expect(lamps[lamps.length - 1].n).toBe(c.lamps.length);
    }
  });
  it('cannot be failed: a child who never touches the screen still brings Pep home, by soft bumps, with fewer lamps', () => {
    for (const seed of SEEDS) {
      const c = buildCourse(seed);
      const s = run(c, initialRun(c), idlePilot, 170);
      expect(s.mode, `seed ${seed}`).toBe('atHome');
      // (the one kindness: an updraft over a gap catches a dog who runs off the edge and carries him across)
      for (const h of c.hurdles) expect(s.hurdles[h.id], `seed ${seed} hurdle ${h.id}`).toBe(h.kind === 'padGap' && updraftAt(c, h.x) >= 0 ? 1 : 2);
      expect(s.lit).toBeGreaterThan(0); expect(s.lit).toBeLessThan(c.lamps.length / 2); expect(s.star).toBe(false);
    }
  });
  it('takes about a minute and a half of running', () => {
    let s = initialRun(course); const pilot = cleanPilot(); let steps = 0;
    while (s.mode !== 'atHome' && steps < 200 / STEP_DT) { s = step(course, s, pilot(s, course)); steps++; }
    expect(s.t).toBeGreaterThan(75); expect(s.t).toBeLessThan(115);
  });
});

describe('light and camera', () => {
  it('deepens the dusk along the run and warms it with every lamp', () => {
    expect(duskDepth(course, course.start)).toBe(0); expect(duskDepth(course, course.length)).toBe(1);
    expect(duskDepth(course, course.length / 2)).toBeGreaterThan(0.3); expect(duskDepth(course, -50)).toBe(0);
    expect(warmth(course, { lit: 0 })).toBe(0); expect(warmth(course, { lit: course.lamps.length })).toBe(1);
    expect(warmth(course, { lit: 10 })).toBeGreaterThan(warmth(course, { lit: 9 }));
  });
  it('keeps Pep at his place in the view, and sweeps from the Dome back to the start for the finale', () => {
    expect(cameraX(1000, 800, 0.25)).toBe(800); expect(cameraX(100, 800, 0.25)).toBe(0);
    const from = sweepX(course, 800, 0.25, 0), to = sweepX(course, 800, 0.25, 1);
    expect(from).toBe(cameraX(course.length, 800, 0.25)); expect(to).toBe(cameraX(course.start, 800, 0.25));
    let last = from; for (let p = 0.1; p <= 1; p += 0.1) { const x = sweepX(course, 800, 0.25, p); expect(x).toBeLessThanOrEqual(last); last = x; }
    expect(sweepX(course, 800, 0.25, 2)).toBe(to);
  });
  it('plays the sitting’s tune up the chain', () => {
    expect(chainNote(course, 1)).toBe(course.tune[0]); expect(chainNote(course, 2)).toBe(course.tune[1]);
    expect(chainNote(course, course.tune.length + 1)).toBe(course.tune[0]); expect(chainNote(course, 0)).toBe(course.tune[0]);
  });
});
