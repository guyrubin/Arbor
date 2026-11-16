import { describe, expect, it } from 'vitest';
import {
  CHAPTERS, CLICKS_PER_TURN, CLICK_ENERGY, DAYLIGHTS, MAX_CLICKS, MAX_RUN_SECONDS, ROLLING, ROVER_HALF, STEP,
  buildCourse, buildPlay, daylight, dragKey, groundAt, gustAt, keyGain, minimumClicks, nextChapter, placeReached, rollOut, springEnergy, startRun, steadyPilot, stepRun,
  tension, turnsLeft, wheelAngle, wind, zoneAt, type Course, type RunEvent, type RunState,
} from './windupRaceRules';

const SEEDS = [1, 2, 3, 7, 11, 42, 99, 2026, 77777, 123456];
const ALL = Array.from({ length: MAX_CLICKS + 1 }, (_, clicks) => clicks);
const [straight, gustAlley, longCourse, sunArches] = buildPlay(7);
const kinds = (events: RunEvent[]) => events.map(event => event.kind);
const flat: Course = { ...straight, goal: 400, cushion: 420, length: 440, blooms: [], balls: [], places: [{ at: 0, id: 'startLine' }] };

describe('the spring', () => {
  it('each click stores the same energy, up to the last click', () => {
    expect(springEnergy(0)).toBe(0);
    for (const c of ALL.slice(1)) expect(springEnergy(c)).toBeCloseTo(CLICK_ENERGY * c);
    expect(springEnergy(40)).toBe(springEnergy(MAX_CLICKS));
    expect(wind(0)).toBe(1); expect(wind(MAX_CLICKS - 1)).toBe(MAX_CLICKS); expect(wind(MAX_CLICKS)).toBe(MAX_CLICKS); expect(wind(Number.NaN)).toBe(1);
  });
  it('the key gets stiffer: a click takes a longer swirl as the spring tightens', () => {
    for (const c of ALL.slice(1)) expect(keyGain(c)).toBeLessThan(keyGain(c - 1));
    // One finger turn on a loose spring makes two clicks; on a tight spring it does not.
    expect(dragKey(0, 0, 1 / CLICKS_PER_TURN).made).toBe(1);
    expect(dragKey(8, 0, 1 / CLICKS_PER_TURN).made).toBe(0);
    expect(dragKey(8, 0, 1 / (keyGain(8) * CLICKS_PER_TURN)).made).toBe(1);
  });
  it('the ratchet holds: turning back does nothing, and the key stops at full', () => {
    expect(dragKey(3, 0.4, -2)).toEqual({ clicks: 3, turn: 0.4, made: 0 });
    expect(dragKey(MAX_CLICKS - 1, 0, 50)).toEqual({ clicks: MAX_CLICKS, turn: 0, made: 1 });
    expect(dragKey(MAX_CLICKS, 0, 3).made).toBe(0);
    const swirl = dragKey(0, 0, 1.2);
    expect(swirl.clicks).toBe(2); expect(swirl.turn).toBeGreaterThan(0);
    // A whole wind is a handful of swirls, not a chore.
    expect(dragKey(0, 0, 8).clicks).toBe(MAX_CLICKS); expect(dragKey(0, 0, 5).clicks).toBeLessThan(MAX_CLICKS);
  });
  it('tension words never show a number', () => {
    expect(ALL.map(tension)).toEqual(['loose', 'little', 'little', 'little', 'half', 'half', 'half', 'tight', 'tight', 'tight', 'full']);
  });
});

describe('a run on a bare floor', () => {
  it('more wind always goes further, by about the same stretch for every click', () => {
    const reach = ALL.map(c => rollOut(flat, flat.start, c).run.reach);
    expect(reach[0]).toBeCloseTo(flat.start + ROVER_HALF);
    for (let c = 1; c < reach.length; c++) {
      expect(reach[c], `${c} clicks`).toBeGreaterThan(reach[c - 1] + 2);
      // Past the first clicks (where the spring barely beats the floor's grip) every click adds E / friction.
      if (c >= 3) expect(Math.abs(reach[c] - reach[c - 1] - CLICK_ENERGY / ROLLING), `${c} clicks`).toBeLessThan(0.6);
    }
  });
  it('is deterministic: the same wind and the same touches end in the same place', () => {
    for (const course of buildPlay(42)) for (const c of [3, 7, MAX_CLICKS]) {
      const a = rollOut(course, course.start, c, steadyPilot), b = rollOut(course, course.start, c, steadyPilot);
      expect(a.run).toEqual(b.run); expect(a.events).toEqual(b.events);
    }
  });
  it('the spring drives first and Rover coasts after: fastest early, and the key spins back to loose', () => {
    const run = startRun(flat, flat.start, MAX_CLICKS); let top = 0, topAt = 0, turnsAtTop = 0;
    expect(turnsLeft(run)).toBe(MAX_CLICKS);
    while (!run.done) { stepRun(flat, run, { lean: false, line: 'low' }); if (run.v > top) { top = run.v; topAt = run.t; turnsAtTop = turnsLeft(run); } }
    expect(top).toBeGreaterThan(9); expect(top).toBeLessThan(16);
    expect(topAt).toBeLessThan(run.t * 0.35); expect(turnsAtTop).toBeLessThan(1.5);
    expect(turnsLeft(run)).toBe(0); expect(run.v).toBe(0);
    expect(run.t).toBeGreaterThan(5); expect(run.t).toBeLessThan(14);
  });
  it('a loose spring goes nowhere, and a run is over when Rover is at rest', () => {
    const { run, events } = rollOut(flat, flat.start, 0);
    expect(run.x).toBe(flat.start); expect(run.t).toBeLessThan(0.5); expect(kinds(events)).toEqual(['stop']);
    expect(stepRun(flat, run, { lean: true, line: 'high' }).t).toBe(run.t);
  });
  it('wheels turn by the distance rolled', () => { expect(wheelAngle(0)).toBe(0); expect(wheelAngle(2)).toBeCloseTo(2 * wheelAngle(1)); });
});

describe('the four courses', () => {
  it('every course of every seed is well formed', () => {
    for (const seed of SEEDS) {
      const play = buildPlay(seed);
      expect(play.map(course => course.id)).toEqual([...CHAPTERS]);
      for (const course of play) {
        const where = `${course.id} seed ${seed}`;
        expect(course.start, where).toBeGreaterThanOrEqual(ROVER_HALF);
        expect(course.goal, where).toBeGreaterThan(course.start + 25);
        expect(course.cushion, where).toBeGreaterThan(course.goal + 2);
        expect(course.length, where).toBeGreaterThan(course.cushion + 3);
        expect(course.zones[0].from, where).toBeLessThan(0);
        expect(course.zones[course.zones.length - 1].to, where).toBeGreaterThanOrEqual(course.length);
        for (let i = 1; i < course.zones.length; i++) expect(course.zones[i].from, where).toBe(course.zones[i - 1].to);
        expect([...course.blooms], where).toEqual([...course.blooms].sort((a, b) => a - b));
        expect(new Set(course.blooms).size, where).toBe(course.blooms.length);
        for (const bloom of course.blooms) { expect(bloom, where).toBeGreaterThan(course.start + 1); expect(bloom, where).toBeLessThan(course.goal); }
        for (let i = 1; i < course.places.length; i++) expect(course.places[i].at, where).toBeGreaterThan(course.places[i - 1].at);
        expect(course.places[0].id, where).toBe('startLine'); expect(course.places[course.places.length - 1], where).toEqual({ at: course.goal, id: 'flower' });
        for (const gust of course.gusts) { expect(gust.to - gust.from, where).toBeGreaterThanOrEqual(6); expect(gust.from, where).toBeGreaterThan(course.start + 3); expect(gust.to, where).toBeLessThan(course.goal); expect(gust.push, where).not.toBe(0); }
        const sorted = [...course.gusts].sort((a, b) => a.from - b.from);
        for (let i = 1; i < sorted.length; i++) expect(sorted[i].from, where).toBeGreaterThan(sorted[i - 1].to + 1.5);
        for (const hill of course.hills) {
          expect(hill.from, where).toBeGreaterThan(course.start + 4);
          // Room to land and roll before the flower, and no flower or ball standing where Rover comes down.
          expect(hill.from + hill.up + hill.flat + 9, where).toBeLessThan(course.goal);
          for (const bloom of course.blooms) expect(bloom > hill.from - 1.5 && bloom < hill.from + hill.up + hill.flat + 5, where).toBe(false);
        }
      }
    }
  });
  it('chapters grow: each course is longer than the last, and the set-piece has the tallest ramp', () => {
    expect(gustAlley.goal).toBeGreaterThan(straight.goal + 15); expect(longCourse.goal).toBeGreaterThan(gustAlley.goal + 15);
    expect(straight.gusts).toHaveLength(0); expect(straight.hills).toHaveLength(0); expect(straight.fork).toBeNull();
    expect(gustAlley.gusts.length).toBeGreaterThanOrEqual(3); expect(gustAlley.hills).toHaveLength(1); expect(gustAlley.fork).toBeNull();
    expect(longCourse.fork).not.toBeNull(); expect(longCourse.hills.some(hill => hill.line === 'high')).toBe(true); expect(longCourse.rugs.some(rug => rug.line === 'low')).toBe(true);
    const tallest = (course: Course) => Math.max(0, ...course.hills.map(hill => hill.height));
    expect(tallest(sunArches)).toBeGreaterThan(Math.max(tallest(gustAlley), tallest(longCourse)));
    expect(new Set(zoneAt(longCourse, 5) + zoneAt(longCourse, 60)).size).toBeGreaterThan(1);
    expect(zoneAt(straight, 10)).toBe('arcade'); expect(zoneAt(gustAlley, 30)).toBe('terrace'); expect(zoneAt(sunArches, 999)).toBe('arcade');
  });
  it('a seed always lays the same course, and different seeds lay different ones', () => {
    for (const id of CHAPTERS) expect(buildCourse(id, 31)).toEqual(buildCourse(id, 31));
    for (const id of CHAPTERS) expect(new Set(SEEDS.map(seed => JSON.stringify({ ...buildCourse(id, seed), seed: 0 }))).size, id).toBeGreaterThan(SEEDS.length / 2);
    // The gust alley is never three of a kind, and across seeds it is not always the same order.
    const orders = new Set(SEEDS.map(seed => buildCourse('gustAlley', seed).gusts.map(gust => Math.sign(gust.push)).join()));
    expect(orders.size).toBeGreaterThan(1);
    for (const order of orders) expect(new Set(order.split(',')).size).toBe(2);
    expect(DAYLIGHTS).toContain(daylight(5)); expect(new Set([0, 1, 2].map(daylight)).size).toBe(3); expect(daylight(Number.NaN)).toBe(DAYLIGHTS[0]);
  });
  it('the straight asks for most of a wind; a full wind always carries Rover to the flower there', () => {
    for (const seed of SEEDS) {
      const course = buildCourse('straight', seed), least = minimumClicks(course)!;
      expect(least, `seed ${seed}`).toBeGreaterThanOrEqual(5); expect(least, `seed ${seed}`).toBeLessThanOrEqual(7);
      // Overshoot is fine: the cushion catches it and never throws it back.
      const { run, events } = rollOut(course, course.start, MAX_CLICKS);
      expect(kinds(events)).toContain('cushion'); expect(run.x + ROVER_HALF).toBeLessThan(course.length); expect(run.x + ROVER_HALF).toBeGreaterThan(course.cushion - 0.01);
      expect(events.filter(event => event.kind === 'rollback')).toHaveLength(0);
    }
  });
  it('the set-piece: a full wind flies the big ramp and reaches the last flower, on every seed', () => {
    for (const seed of SEEDS) {
      const course = buildCourse('sunArches', seed);
      for (const pilot of [steadyPilot, () => ({}), () => ({ lean: true })]) {
        const { run, events } = rollOut(course, course.start, MAX_CLICKS, pilot);
        expect(run.goal, `seed ${seed}`).toBe(true);
        const air = events.find(event => event.kind === 'air')!, land = events.find(event => event.kind === 'land')!;
        expect(land.t - air.t, `seed ${seed}`).toBeGreaterThan(0.7); expect(land.x - air.x, `seed ${seed}`).toBeGreaterThan(5);
        expect(kinds(events).filter(kind => kind === 'bloom').length, `seed ${seed}`).toBe(course.blooms.length);
      }
    }
  });
});

describe('nobody is sent back', () => {
  const windAgain = (course: Course, clicks: number, pilot = steadyPilot) => {
    let x = course.start, runs = 0, line: 'high' | 'low' = 'low', balls: RunState['balls'] | undefined;
    const stops: number[] = [];
    while (runs < 30) {
      const run = startRun(course, x, clicks, line, balls);
      while (!run.done) stepRun(course, run, { lean: !!pilot(run).lean, line });
      runs++; x = run.x; line = run.line; balls = run.balls; stops.push(x);
      if (run.goal) return { runs, stops };
    }
    return { runs: Infinity, stops };
  };
  it('winding again from where Rover stopped always reaches the flower, with any wind of three clicks or more', () => {
    for (const seed of SEEDS) for (const course of buildPlay(seed)) for (const clicks of [3, 5, 8, MAX_CLICKS]) {
      const { runs } = windAgain(course, clicks);
      expect(runs, `${course.id} seed ${seed} with ${clicks}`).toBeLessThan(30);
    }
  });
  it('even without ever leaning, a full wind gets through every course in a few goes', () => {
    for (const seed of SEEDS) for (const course of buildPlay(seed)) {
      const { runs } = windAgain(course, MAX_CLICKS, () => ({}));
      expect(runs, `${course.id} seed ${seed}`).toBeLessThanOrEqual(course.id === 'longCourse' ? 4 : 3);
    }
  });
  it('more wind means fewer goes', () => {
    for (const course of [gustAlley, longCourse]) {
      const goes = [3, 6, MAX_CLICKS].map(clicks => windAgain(course, clicks).runs);
      expect(goes[0]).toBeGreaterThan(goes[1]); expect(goes[1]).toBeGreaterThanOrEqual(goes[2]); expect(goes[0]).toBeGreaterThan(goes[2]);
    }
  });
  it('a stop has a name: the last place the nose passed', () => {
    expect(placeReached(straight, straight.start)).toBe('startLine');
    expect(placeReached(straight, 10)).toBe('firstArch');
    expect(placeReached(straight, straight.goal)).toBe('flower');
    expect(placeReached(longCourse, 13.2)).toBe('signpost');
    for (const course of buildPlay(3)) for (const place of course.places) expect(placeReached(course, place.at)).toBe(place.id);
  });
  it('a run never ends before the start line or past the far end of the floor', () => {
    for (const seed of SEEDS.slice(0, 4)) for (const course of buildPlay(seed)) for (const c of ALL) {
      const { run } = rollOut(course, course.start, c, steadyPilot, c % 2 ? 'high' : 'low');
      expect(run.x).toBeGreaterThanOrEqual(ROVER_HALF); expect(run.x + ROVER_HALF).toBeLessThan(course.length);
      expect(run.t).toBeLessThan(MAX_RUN_SECONDS); expect(run.done).toBe(true); expect(run.v).toBe(0); expect(run.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the wind decides', () => {
  const headFirst = SEEDS.map(seed => buildCourse('gustAlley', seed)).find(course => course.gusts[0].push < 0)!;
  const tailFirst = SEEDS.map(seed => buildCourse('gustAlley', seed)).find(course => course.gusts[0].push > 0)!;
  const calm = (course: Course): Course => ({ ...course, gusts: [] });
  const until = (course: Course, clicks: number, pilot: (run: RunState) => { lean?: boolean }, x: number) => {
    const run = startRun(course, course.start, clicks);
    while (!run.done && run.x < x) stepRun(course, run, { lean: !!pilot(run).lean, line: 'low' });
    return run;
  };
  it('a gust is a stretch of the course: it blows there and nowhere else', () => {
    const gust = headFirst.gusts[0];
    expect(gustAt(headFirst, gust.from - 0.1)).toEqual({ push: 0, index: -1 });
    expect(gustAt(headFirst, (gust.from + gust.to) / 2)).toEqual({ push: gust.push, index: 0 });
    const { events } = rollOut(headFirst, headFirst.start, MAX_CLICKS);
    const gusts = events.filter(event => event.kind === 'gust');
    expect(gusts[0].value).toBe(gust.push); expect(gusts[0].x).toBeGreaterThanOrEqual(gust.from - 0.2);
    expect(events.findIndex(event => event.kind === 'calm')).toBeGreaterThan(events.findIndex(event => event.kind === 'gust'));
  });
  it('a headwind slows Rover; leaning in keeps most of its speed', () => {
    const past = headFirst.gusts[0].to + 0.5;
    const still = until(calm(headFirst), 8, () => ({}), past).v, upright = until(headFirst, 8, () => ({}), past).v, leaning = until(headFirst, 8, () => ({ lean: true }), past).v;
    expect(upright).toBeLessThan(still - 1.5); expect(leaning).toBeGreaterThan(upright + 1); expect(leaning).toBeLessThan(still);
  });
  it('a tailwind carries Rover; leaning wastes most of it', () => {
    const past = tailFirst.gusts[0].to + 0.5;
    const still = until(calm(tailFirst), 8, () => ({}), past).v, upright = until(tailFirst, 8, () => ({}), past).v, leaning = until(tailFirst, 8, () => ({ lean: true }), past).v;
    expect(upright).toBeGreaterThan(still + 1); expect(leaning).toBeLessThan(upright - 0.7); expect(leaning).toBeGreaterThan(still);
  });
  it('reading the wind pays: the steady pilot goes further than one who never leans or always leans', () => {
    for (const seed of SEEDS) {
      const course = { ...buildCourse('gustAlley', seed), goal: 400, cushion: 420, length: 440 };
      const steady = rollOut(course, course.start, MAX_CLICKS, steadyPilot).run.reach;
      expect(steady, `seed ${seed}`).toBeGreaterThan(rollOut(course, course.start, MAX_CLICKS, () => ({})).run.reach + 1);
      expect(steady, `seed ${seed}`).toBeGreaterThan(rollOut(course, course.start, MAX_CLICKS, () => ({ lean: true })).run.reach + 1);
    }
  });
  it('a headwind never blows Rover backwards', () => {
    const { run, events } = rollOut(headFirst, headFirst.start, 3);
    expect(kinds(events)).not.toContain('rollback'); expect(run.x).toBeGreaterThan(headFirst.start);
  });
});

describe('ramps, the plank and the rug', () => {
  const ramp = gustAlley.hills[0];
  it('the floor rises to the lip and drops away', () => {
    expect(groundAt(gustAlley, ramp.from - 0.01, 'low')).toEqual({ h: 0, slope: 0, hill: -1 });
    expect(groundAt(gustAlley, ramp.from + ramp.up / 2, 'low').h).toBeCloseTo(ramp.height / 2);
    expect(groundAt(gustAlley, ramp.from + ramp.up + 0.01, 'low').h).toBe(0);
    const plank = longCourse.hills.find(hill => hill.line === 'high')!;
    expect(groundAt(longCourse, plank.from + plank.up + 1, 'high').h).toBe(plank.height);
    expect(groundAt(longCourse, plank.from + plank.up + 1, 'low').h).toBe(0);
  });
  it('enough speed flies: air, the top of the arc, then the landing, in that order, and faster flies further', () => {
    const bare: Course = { ...gustAlley, gusts: [], blooms: [], goal: 400, cushion: 420, length: 440 };
    const flight = (clicks: number) => {
      const { events } = rollOut(bare, ramp.from - 9, clicks);
      const order = kinds(events).filter(kind => ['ramp', 'air', 'apex', 'land'].includes(kind));
      const air = events.find(event => event.kind === 'air'), land = events.find(event => event.kind === 'land');
      return { order, far: air && land ? land.x - air.x : 0, hard: land?.value ?? 0 };
    };
    const slow = flight(5), fast = flight(MAX_CLICKS);
    expect(fast.order).toEqual(['ramp', 'air', 'apex', 'land']); expect(slow.order.slice(0, 2)).toEqual(['ramp', 'air']);
    expect(fast.far).toBeGreaterThan(slow.far + 1); expect(fast.far).toBeGreaterThan(3); expect(fast.hard).toBeGreaterThan(slow.hard);
  });
  it('too little wind at the foot of a ramp: Rover climbs part way, rolls gently back and rests at the foot', () => {
    const { run, events } = rollOut(gustAlley, ramp.from - 1.2, 1);
    expect(kinds(events)).toContain('rollback'); expect(kinds(events)).not.toContain('air');
    expect(run.x).toBeLessThan(ramp.from + 0.3); expect(run.x).toBeGreaterThan(ramp.from - 6); expect(run.y).toBeCloseTo(0, 5);
    // And a full wind from that very spot clears it.
    expect(kinds(rollOut(gustAlley, run.x, MAX_CLICKS).events)).toContain('air');
  });
  it('the signpost: the line is chosen until the nose reaches the fork, then it holds to the far end of the plank', () => {
    const fork = longCourse.fork!, plank = longCourse.hills.find(hill => hill.line === 'high')!;
    const high = rollOut(longCourse, longCourse.start, MAX_CLICKS, run => ({ line: run.x < fork.at - 2 ? 'low' : 'high' }), 'low');
    // The pilot asked for the plank only after the last moment: the choice at the fork was made in time.
    expect(high.events.find(event => event.kind === 'fork')?.value).toBe(1);
    const late = rollOut(longCourse, longCourse.start, MAX_CLICKS, run => ({ line: run.x + ROVER_HALF < fork.at + 0.5 ? 'low' : 'high' }), 'low');
    expect(late.events.find(event => event.kind === 'fork')?.value).toBe(0); expect(kinds(late.events)).toContain('rug');
    const top = startRun(longCourse, longCourse.start, MAX_CLICKS, 'high'); let peak = 0;
    while (!top.done && top.x < fork.rejoin) { stepRun(longCourse, top, { lean: false, line: top.x > fork.at + 3 ? 'low' : 'high' }); peak = Math.max(peak, top.y); expect(top.x < fork.at || top.x >= fork.rejoin || top.line === 'high' || !top.lineLocked).toBe(true); }
    expect(peak).toBeGreaterThanOrEqual(plank.height);
  });
  it('both lines get there: the plank flies, the rug drags and bumps the wool ball', () => {
    const fork = longCourse.fork!;
    const high = rollOut(longCourse, longCourse.start, MAX_CLICKS, steadyPilot, 'high'), low = rollOut(longCourse, longCourse.start, MAX_CLICKS, steadyPilot, 'low');
    expect(kinds(high.events)).toEqual(expect.arrayContaining(['fork', 'ramp', 'air', 'land'])); expect(kinds(high.events)).not.toContain('rug'); expect(kinds(high.events)).not.toContain('ball');
    expect(kinds(low.events)).toEqual(expect.arrayContaining(['fork', 'rug', 'ball']));
    expect(high.run.x).toBeGreaterThan(fork.rejoin); expect(low.run.x).toBeGreaterThan(fork.rejoin);
    expect(low.run.balls[0].x).toBeGreaterThan(longCourse.balls[0].at + 1);
    // Starting again in the middle of a line keeps Rover on it.
    const mid = startRun(longCourse, 20, 4, 'high'); expect(mid.lineLocked).toBe(true); expect(mid.y).toBeGreaterThan(0.5);
    stepRun(longCourse, mid, { lean: false, line: 'low' }); expect(mid.line).toBe('high');
  });
  it('flowers open in order as the nose passes each one, once', () => {
    const { events } = rollOut(straight, straight.start, MAX_CLICKS);
    const blooms = events.filter(event => event.kind === 'bloom');
    expect(blooms.map(event => event.value)).toEqual(straight.blooms.map((_, i) => i));
    blooms.forEach((event, i) => expect(event.x + ROVER_HALF).toBeGreaterThanOrEqual(straight.blooms[i] - 0.2));
    // A second go from a stop does not open the ones already passed.
    expect(startRun(straight, straight.blooms[2] + 1, 3).nextBloom).toBe(3);
    expect(events.filter(event => event.kind === 'goal')).toHaveLength(1); expect(events[events.length - 1].kind).toBe('stop');
  });
  it('the play is three chapters and a set-piece', () => {
    expect(CHAPTERS).toHaveLength(4); expect([0, 1, 2, 3].map(nextChapter)).toEqual([1, 2, 3, null]); expect(nextChapter(Number.NaN)).toBe(1);
    expect(STEP).toBeLessThanOrEqual(1 / 100);
  });
});
