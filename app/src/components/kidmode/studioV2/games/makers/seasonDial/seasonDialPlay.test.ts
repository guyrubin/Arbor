import { describe, expect, it } from 'vitest';
import { SEASONS, SEASON_CENTERS, labLevel, seasonAt, wrapYear } from './seasonDialRules';
import {
  ASKS, ASK_HOLD_MS, FREEZE, GOLDEN_HOUR, LAPSE_DAYS, MARKS_MAX, RAIN_ASKS, RAIN_FROM, VIEW_LINES, addMark, askAnswer, askMet, askNudge, baseWet, conductProgress, conductQuarters, coverAt, fallAt,
  floorPoint, hourAt, labRead, lapseAt, lapseStills, puddleFill, rainbowAt, roundAsks, roundPlan, seededPlay, shadowOf, skyBlow, skyStart, skyStep, skyTap, stageLayout, sunArc, warmthAt,
  type Ask, type SkyState,
} from './seasonDialPlay';
import { SEASON_DIAL_COPY } from './seasonDialCopy';

const run = (sky: SkyState, year: number, seconds: number) => { let s = sky; for (let i = 0; i < Math.round(seconds * 10); i++) s = skyStep(s, year, 0.1); return s; };
const SIZES = [[390, 768], [844, 314], [1024, 692], [1280, 724], [820, 1104], [360, 640]] as const;

describe('the full-bleed stage', () => {
  it('fills every size with the picture: no letterbox, the floor under everything that stands', () => {
    for (const [w, h] of SIZES) {
      const L = stageLayout(w, h);
      expect(L.view.top).toBeLessThanOrEqual(0);
      expect(L.view.top + L.view.size).toBeGreaterThanOrEqual(h - 0.5);
      // The picture and its two mirrored copies reach both edges.
      expect(L.view.left - L.view.size).toBeLessThanOrEqual(0);
      expect(L.view.left + 2 * L.view.size).toBeGreaterThanOrEqual(w);
      expect(L.horizon).toBeLessThan(L.wallTop); expect(L.wallTop).toBeLessThan(L.floorTop); expect(L.floorTop).toBeLessThan(h);
      for (const spot of [L.tree, ...Object.values(L.spots)]) { expect(spot.y).toBeGreaterThanOrEqual(L.floorTop); expect(spot.y).toBeLessThanOrEqual(h); expect(spot.x).toBeGreaterThan(0); expect(spot.x).toBeLessThan(w); }
      for (const p of L.puddles) expect(p.y - p.ry).toBeGreaterThanOrEqual(L.floorTop - 1);
    }
  });
  it('keeps the tree whole under the HUD and big on the stage', () => {
    for (const [w, h] of SIZES) {
      const L = stageLayout(w, h);
      expect(L.tree.y - L.tree.h).toBeGreaterThanOrEqual(0);
      expect(L.tree.h).toBeGreaterThanOrEqual(h * 0.42);
    }
  });
  it('sets the dial wholly on screen in the picture\'s right corner, at a thumb\'s size', () => {
    for (const [w, h] of SIZES) {
      const { dial } = stageLayout(w, h);
      expect(dial.r * 2).toBeGreaterThanOrEqual(124);
      expect(dial.cx + dial.r).toBeLessThanOrEqual(w); expect(dial.cy + dial.r).toBeLessThanOrEqual(h); expect(dial.cx - dial.r).toBeGreaterThan(w * 0.4);
    }
  });
  it('recomposes for landscape instead of centring a phone column', () => {
    const tall = stageLayout(390, 768), wide = stageLayout(1280, 724);
    expect(tall.portrait).toBe(true); expect(wide.portrait).toBe(false);
    expect(wide.view.size).toBeLessThan(wide.w); // the mirrored copies are in use
    expect(wide.spots.a.x - wide.tree.x).toBeGreaterThan(wide.w * 0.1);
  });
  it('draws nearer things larger, as the floor\'s perspective does', () => {
    const L = stageLayout(1280, 724);
    expect(floorPoint(L, 1).scale).toBeGreaterThan(floorPoint(L, 0).scale);
    expect(floorPoint(L, 0).y).toBe(L.floorTop); expect(floorPoint(L, 1).y).toBe(L.h);
    expect(VIEW_LINES.horizon).toBeLessThan(VIEW_LINES.floorTop);
  });
});

describe('the sun the dial moves', () => {
  it('crosses the sky as the year turns: morning in spring, noon in summer, afternoon in autumn', () => {
    const [spring, summer, autumn, winter] = SEASON_CENTERS.map(y => sunArc(y));
    expect(spring.x).toBeLessThan(0.35); expect(autumn.x).toBeGreaterThan(0.65);
    expect(Math.abs(summer.x - 0.5)).toBeLessThan(0.03); expect(Math.abs(winter.x - 0.5)).toBeLessThan(0.03);
    expect(summer.elevation).toBeGreaterThan(spring.elevation); expect(spring.elevation).toBeGreaterThan(winter.elevation);
    expect(winter.elevation).toBeGreaterThan(0.2); // low over the mountain, never set
  });
  it('is continuous round the whole year, wrap included', () => {
    for (let i = 0; i < 400; i++) {
      const a = sunArc(i / 400), b = sunArc(wrapYear((i + 1) / 400));
      expect(Math.abs(a.x - b.x)).toBeLessThan(0.01); expect(Math.abs(a.lift - b.lift)).toBeLessThan(0.01);
      expect(hourAt(i / 400)).toBeGreaterThan(0.2); expect(hourAt(i / 400)).toBeLessThan(0.8);
    }
  });
  it('throws long shadows from a low sun and short ones from a high sun, away from the sun\'s side', () => {
    const summer = shadowOf(sunArc(SEASON_CENTERS[1]), 0.37), winter = shadowOf(sunArc(SEASON_CENTERS[3]), 0.37), spring = shadowOf(sunArc(SEASON_CENTERS[0]), 0.6), autumn = shadowOf(sunArc(SEASON_CENTERS[2]), 0.3);
    expect(winter.dy).toBeGreaterThan(summer.dy * 1.8);
    expect(spring.dx).toBeGreaterThan(0); expect(autumn.dx).toBeLessThan(0);
    expect(sunArc(0.5, 0).day).toBe(0); expect(sunArc(0.5, GOLDEN_HOUR).gold).toBeGreaterThan(0.4);
  });
});

describe('the sky the child can change', () => {
  it('reads the four seasons apart on LeafLab when left alone', () => {
    const levels = SEASON_CENTERS.map(y => { const lab = labRead(y, skyStart(y)); return [labLevel(lab.moisture), labLevel(lab.light), labLevel(lab.warmth)]; });
    expect(levels[0]).toEqual([1, 1, 1]); expect(levels[1]).toEqual([0, 2, 2]); expect(levels[2]).toEqual([1, 1, 1]); expect(levels[3][1]).toBe(0); expect(levels[3][2]).toBe(0);
  });
  it('rains after two taps on a summer sky, and the rain soaks the bed', () => {
    const y = SEASON_CENTERS[1];
    let sky = skyStart(y);
    expect(fallAt(y, sky).rain).toBe(0);
    sky = skyTap(skyTap(sky));
    expect(coverAt(y, sky)).toBeGreaterThan(RAIN_FROM); expect(fallAt(y, sky).rain).toBeGreaterThan(0.1);
    sky = skyTap(sky);
    const soaked = run(sky, y, 4);
    expect(soaked.wet).toBeGreaterThan(0.85); expect(soaked.mist).toBeGreaterThan(0.6);
  });
  it('snows instead where it is cold', () => {
    const y = SEASON_CENTERS[3], sky = skyTap(skyTap(skyStart(y)));
    expect(warmthAt(y)).toBeLessThan(FREEZE);
    expect(fallAt(y, sky).rain).toBe(0); expect(fallAt(y, sky).snow).toBeGreaterThan(0.5);
    expect(run(sky, y, 4).wet).toBeCloseTo(baseWet(y), 1);
  });
  it('lets a swipe blow the clouds off, and a rainbow stand where the sun meets wet air', () => {
    const y = SEASON_CENTERS[1];
    let sky = run(skyTap(skyTap(skyTap(skyStart(y)))), y, 4);
    expect(rainbowAt(y, sky)).toBeLessThan(0.05);
    sky = skyBlow(skyBlow(skyBlow(sky)));
    expect(fallAt(y, sky).rain).toBe(0);
    expect(rainbowAt(y, run(sky, y, 0.5))).toBeGreaterThan(0.6);
    expect(rainbowAt(y, run(sky, y, 60))).toBe(0); // the mist clears
    expect(rainbowAt(SEASON_CENTERS[3], { clouds: -0.5, wet: 1, mist: 1 })).toBe(0); // no rainbow in the snow
  });
  it('gives the sky back to the year when left alone, from any state', () => {
    for (const y of SEASON_CENTERS) for (const start of [{ clouds: 1, wet: 1, mist: 1 }, { clouds: -1, wet: 0, mist: 0 }]) {
      const settled = run(start, y, 240);
      expect(Math.abs(settled.clouds)).toBeLessThan(0.02); expect(settled.mist).toBeLessThan(0.02);
      expect(settled.wet).toBeGreaterThanOrEqual(0); expect(settled.wet).toBeLessThanOrEqual(1);
    }
    const y = SEASON_CENTERS[2], dry = run({ clouds: 0, wet: 0, mist: 0 }, y, 120);
    expect(dry.wet).toBeCloseTo(baseWet(y), 1);
  });
  it('stays in bounds and takes any step size without blowing up', () => {
    let sky: SkyState = { clouds: 0, wet: 0.5, mist: 0 };
    for (let i = 0; i < 40; i++) sky = skyTap(sky);
    expect(sky.clouds).toBe(1);
    for (let i = 0; i < 40; i++) sky = skyBlow(sky);
    expect(sky.clouds).toBe(-1);
    for (const dt of [0, -1, NaN, 5, 0.016]) { const next = skyStep(sky, 0.3, dt); for (const v of Object.values(next)) expect(Number.isFinite(v)).toBe(true); }
  });
  it('fills the puddles with rain and with the thaw, and freezes them small in winter', () => {
    expect(puddleFill(SEASON_CENTERS[1], skyStart(SEASON_CENTERS[1]))).toBe(0);
    expect(puddleFill(SEASON_CENTERS[1], { clouds: 0.9, wet: 1, mist: 1 })).toBeGreaterThan(0.9);
    expect(puddleFill(0.97, skyStart(0.97))).toBeGreaterThan(0.5);
    expect(puddleFill(SEASON_CENTERS[3], { clouds: 0, wet: 1, mist: 0 })).toBeLessThan(0.3);
  });
});

/** What a child would do for each ask, in order: the season to turn to, then the sky. */
const RECIPES: Record<string, { season: 0 | 1 | 2 | 3; taps: number; rainFor: number; blows: number; waitUpTo: number }> = {
  springShower: { season: 0, taps: 2, rainFor: 5, blows: 0, waitUpTo: 0 }, summerSun: { season: 1, taps: 3, rainFor: 3, blows: 3, waitUpTo: 12 }, mildDay: { season: 2, taps: 0, rainFor: 0, blows: 0, waitUpTo: 0 },
  winterRest: { season: 3, taps: 0, rainFor: 0, blows: 0, waitUpTo: 0 }, warmDrink: { season: 1, taps: 3, rainFor: 4, blows: 0, waitUpTo: 0 }, dryBask: { season: 1, taps: 0, rainFor: 0, blows: 0, waitUpTo: 0 },
};
/** Plays a recipe from a starting sky; true when the ask is held for the hold time. */
function playRecipe(ask: Ask, from: SkyState): boolean {
  const r = RECIPES[ask.id], y = SEASON_CENTERS[r.season];
  let sky = from, held = 0;
  const tick = () => { sky = skyStep(sky, y, 0.1); held = askMet(ask, labRead(y, sky)).all ? held + 100 : 0; return held >= ASK_HOLD_MS; };
  for (let i = 0; i < r.taps; i++) sky = skyTap(sky);
  for (let i = 0; i < r.rainFor * 10; i++) if (tick()) return true;
  for (let i = 0; i < r.blows; i++) sky = skyBlow(sky);
  for (let i = 0; i < (r.waitUpTo + 3) * 10; i++) if (tick()) return true;
  return false;
}
describe('chapter two: what the seedling asks for', () => {
  it('has a recipe a child can play for every ask, from a quiet sky and after a wet one', () => {
    for (const ask of ASKS) {
      expect(RECIPES[ask.id], ask.id).toBeTruthy();
      const y = SEASON_CENTERS[RECIPES[ask.id].season];
      expect(playRecipe(ask, skyStart(y)), `${ask.id} from a quiet sky`).toBe(true);
      expect(askAnswer(ask), ask.id).not.toBeNull();
    }
    // After a soaking (the last ask left the bed wet and clouded), the dry asks are still reachable by blowing and waiting.
    const wet: SkyState = { clouds: 0.6, wet: 1, mist: 1 };
    const dryBask = ASKS.find(a => a.id === 'dryBask')!, y = SEASON_CENTERS[1];
    let sky = skyBlow(skyBlow(wet)), held = 0, met = false;
    for (let i = 0; i < 400 && !met; i++) { sky = skyStep(sky, y, 0.1); held = askMet(dryBask, labRead(y, sky)).all ? held + 100 : 0; met = held >= ASK_HOLD_MS; }
    expect(met).toBe(true);
  });
  it('is not answered by the wrong season', () => {
    const winterRest = ASKS.find(a => a.id === 'winterRest')!, warmDrink = ASKS.find(a => a.id === 'warmDrink')!;
    expect(askMet(winterRest, labRead(SEASON_CENTERS[1], skyStart(SEASON_CENTERS[1]))).all).toBe(false);
    expect(askMet(warmDrink, labRead(SEASON_CENTERS[3], { clouds: 1, wet: 1, mist: 0 })).all).toBe(false);
    expect(askMet(warmDrink, labRead(SEASON_CENTERS[1], skyStart(SEASON_CENTERS[1]))).moisture).toBe(false);
  });
  it('nudges toward the gauge that is off, warmth first (the dial before the sky)', () => {
    const summerSun = ASKS.find(a => a.id === 'summerSun')!;
    expect(askNudge(summerSun, labRead(SEASON_CENTERS[3], skyStart(SEASON_CENTERS[3])))).toEqual({ gauge: 'warmth', way: 1 });
    expect(askNudge(summerSun, labRead(SEASON_CENTERS[1], skyStart(SEASON_CENTERS[1])))).toEqual({ gauge: 'moisture', way: 1 });
    expect(askNudge(summerSun, labRead(SEASON_CENTERS[1], { clouds: 0.9, wet: 1, mist: 1 }))).toEqual({ gauge: 'moisture', way: -1 });
    expect(askNudge(summerSun, { moisture: 0.5, light: 0.3, warmth: 0.9 })).toEqual({ gauge: 'light', way: 1 });
    expect(askNudge(summerSun, { moisture: 0.5, light: 0.9, warmth: 0.9 })).toBeNull();
  });
  it('deals three different asks a round: the dial turns between them, rain is made at least once, and rounds differ', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const asks = roundAsks(seed);
      expect(asks).toHaveLength(3); expect(new Set(asks.map(a => a.id)).size).toBe(3);
      expect(asks[0].warmth).not.toBe(asks[1].warmth); expect(asks[1].warmth).not.toBe(asks[2].warmth);
      expect(asks.some(a => RAIN_ASKS.includes(a.id))).toBe(true);
      expect(roundAsks(seed).map(a => a.id)).toEqual(asks.map(a => a.id));
      seen.add(asks.map(a => a.id).join());
    }
    expect(seen.size).toBeGreaterThan(12);
  });
  it('has words for every ask and every nudge in both languages', () => {
    for (const lang of ['en', 'he'] as const) {
      const w = SEASON_DIAL_COPY[lang];
      for (const ask of ASKS) expect((w.asks as Record<string, string>)[ask.id], `${lang} ${ask.id}`).toBeTruthy();
      for (const gauge of ['moisture', 'light', 'warmth']) for (const way of ['Up', 'Down']) expect((w.nudges as Record<string, string>)[`${gauge}${way}`]).toBeTruthy();
      expect(w.chapters).toHaveLength(3); expect(w.quarters).toHaveLength(4); expect(w.steps).toHaveLength(3); expect(w.meet).toHaveLength(4);
      // Aya's lines are short enough to read at a glance.
      for (const line of [w.hello, ...w.meet, w.keepTurning, w.metAll, w.seedling, ...Object.values(w.asks), ...Object.values(w.nudges), w.hold, w.grew, w.bloomed, w.conduct, w.conducting, w.rest, w.rainbow, w.echo])
        expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(9);
    }
    expect(/[A-Za-z]/.test(SEASON_DIAL_COPY.he.title)).toBe(false);
  });
});

describe('chapter three and the film', () => {
  it('counts only the furthest the year has been carried forward', () => {
    expect(conductProgress(2.3, 2.3)).toBe(0); expect(conductProgress(2.3, 2.8)).toBeCloseTo(0.5); expect(conductProgress(2.3, 4)).toBe(1); expect(conductProgress(2.3, 1)).toBe(0);
    expect([0, 0.24, 0.25, 0.5, 0.76, 1].map(conductQuarters)).toEqual([0, 0, 1, 2, 3, 4]);
  });
  it('keeps the child\'s touches for the film, the newest when there are many', () => {
    let marks = addMark([], { year: 0.1, x: 1, y: 2, kind: 'tapTree' });
    for (let i = 0; i < MARKS_MAX + 5; i++) marks = addMark(marks, { year: i / 100, x: i, y: 0, kind: 'blow' });
    expect(marks).toHaveLength(MARKS_MAX); expect(marks[marks.length - 1].x).toBe(MARKS_MAX + 4); expect(marks[0].kind).toBe('blow');
  });
  it('runs the whole year once from where the child began and comes to rest on the chosen season at golden hour', () => {
    for (const from of [0.075, 3.4, 7.99]) for (const rest of SEASONS) {
      const start = lapseAt(0, from, rest), end = lapseAt(1, from, rest);
      expect(start.turns).toBeCloseTo(from, 6); expect(start.zoom).toBeGreaterThan(1.3); expect(start.gold).toBe(0);
      expect(end.turns - from).toBeGreaterThanOrEqual(1 - 1e-9); expect(end.turns - from).toBeLessThan(2);
      expect(seasonAt(wrapYear(end.turns))).toBe(rest); expect(wrapYear(end.turns)).toBeCloseTo(SEASON_CENTERS[rest], 6);
      expect(end.hour).toBeCloseTo(GOLDEN_HOUR, 6); expect(end.gold).toBe(1); expect(end.zoom).toBe(1); expect(end.done).toBe(true);
      let last = start.turns, sunrises = 0, lastHour = start.hour;
      for (let i = 1; i <= 600; i++) {
        const f = lapseAt(i / 600, from, rest);
        expect(f.turns).toBeGreaterThanOrEqual(last - 1e-9); last = f.turns; // the film never runs backwards
        if (f.hour < lastHour - 0.5) sunrises++; lastHour = f.hour;
        expect(f.zoom).toBeGreaterThanOrEqual(1); expect(f.zoom).toBeLessThanOrEqual(1.5);
      }
      expect(sunrises).toBeGreaterThanOrEqual(LAPSE_DAYS - 2); // the light races across the valley, day after day
    }
  });
  it('tells the same film in five still pictures when motion is reduced', () => {
    const stills = lapseStills(0.6, 1);
    expect(stills).toHaveLength(5);
    expect(new Set(stills.slice(0, 4).map(s => seasonAt(s.year))).size).toBe(4);
    expect(seasonAt(stills[0].year)).toBe(seasonAt(0.6));
    expect(stills[4]).toEqual({ year: SEASON_CENTERS[1], gold: 1 });
  });
});

describe('replay variety', () => {
  it('plans a round from its seed alone, and different seeds make different rounds', () => {
    expect(roundPlan(42)).toEqual(roundPlan(42));
    const plans = Array.from({ length: 60 }, (_, i) => roundPlan(i + 1));
    expect(new Set(plans.map(p => p.asks.map(a => a.id).join())).size).toBeGreaterThan(8);
    expect(new Set(plans.map(p => p.drift)).size).toBe(2); expect(new Set(plans.map(p => p.tune)).size).toBe(3); expect(new Set(plans.map(p => p.cloudSeed)).size).toBeGreaterThan(50);
    const a = seededPlay(9), b = seededPlay(9);
    for (let i = 0; i < 20; i++) { const v = a(); expect(v).toBe(b()); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});
