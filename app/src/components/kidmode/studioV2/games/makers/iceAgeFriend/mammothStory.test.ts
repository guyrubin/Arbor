import { describe, expect, it } from 'vitest';
import { DISCOVERIES } from './iceAgeFriendRules';
import {
  AURORAS, CHAPTERS, CHAPTER_STEPS, CONSTELLATIONS, FACT_TOOL, FROST, HERD_FAR, HERD_NEAR, HINT, PATIENCE_SECONDS, SCOUT, SET_PIECE, SKIES, STEPS, STEP_FACT, TRACE, WALK_SECONDS,
  auroraAt, chapterOf, constellation, endsChapter, eyeHeight, finishStep, fitShot, frostLeft, herdPlace, hintPlan, hourFor, makeFrost, meltFrost, nextStep, patienceStep, planRound,
  questFor, scoutNear, scoutStep, secretStar, starsRisen, traceStep, walkStep, wipeFrost, type StepId,
} from './mammothStory';

describe('three chapters of three steps', () => {
  it('every step belongs to one chapter, in the order the story tells them', () => {
    expect(CHAPTERS).toEqual(['meet', 'care', 'walk']);
    expect(CHAPTERS.flatMap(chapter => CHAPTER_STEPS[chapter])).toEqual([...STEPS]);
    for (const chapter of CHAPTERS) { expect(CHAPTER_STEPS[chapter]).toHaveLength(3); for (const step of CHAPTER_STEPS[chapter]) expect(chapterOf(step)).toBe(chapter); }
  });
  it('each chapter adds a way of playing: wipe, hold, trace; brush, wait, part; search, walk, look up', () => {
    // No two steps of a chapter end in the same tool, and every chapter finds at least one picture.
    for (const chapter of CHAPTERS) {
      const tools = CHAPTER_STEPS[chapter].map(step => STEP_FACT[step]).filter(Boolean).map(id => FACT_TOOL[id!]);
      expect(tools.length).toBeGreaterThanOrEqual(1); expect(new Set(tools).size).toBe(tools.length);
    }
  });
  it('the five pictures are found by doing five different steps, each with its own tool', () => {
    const facts = STEPS.map(step => STEP_FACT[step]).filter(Boolean);
    expect(facts).toEqual([...DISCOVERIES]);
    expect(new Set(DISCOVERIES.map(id => FACT_TOOL[id])).size).toBe(5);
    expect(FACT_TOOL).toMatchObject({ tusks: 'routeScope', coats: 'proofLens', herd: 'scoutCam', hump: 'viewCheck' });
  });
  it('the story walks every step once and ends after the last', () => {
    const walked: StepId[] = [];
    for (let step: StepId | null = STEPS[0]; step; step = nextStep(step)) walked.push(step);
    expect(walked).toEqual([...STEPS]);
    expect(nextStep('low')).toBeNull();
    expect(STEPS.filter(endsChapter)).toEqual(['trace', 'part', 'low']);
  });
  it('the quest strip shows the chapter in play: what is done, what is now, never a count', () => {
    let done: StepId[] = [];
    expect(questFor('frost', done)).toEqual({ chapter: 'meet', current: 0, steps: [{ id: 'frost', done: false }, { id: 'hello', done: false }, { id: 'trace', done: false }] });
    done = finishStep(done, 'frost'); done = finishStep(done, 'frost');
    expect(done).toEqual(['frost']);
    expect(questFor('hello', done).steps.map(s => s.done)).toEqual([true, false, false]);
    expect(questFor('hello', done).current).toBe(1);
    // Finished out of order (it cannot happen, but the strip must not care), the list keeps the story's order.
    expect(finishStep(finishStep([], 'part'), 'brush')).toEqual(['brush', 'part']);
    expect(questFor('feed', ['frost', 'hello', 'trace', 'brush']).chapter).toBe('care');
    // After the last step there is no step in play: every pip of the last chapter is simply done.
    const end = questFor(null, [...STEPS]);
    expect(end.chapter).toBe('walk'); expect(end.current).toBe(3); expect(end.steps.every(s => s.done)).toBe(true);
  });
});

describe('the hint hand', () => {
  it('waits for a quiet spell, shows the gesture twice, then helps a child who is only watching', () => {
    expect(hintPlan(HINT.first - 0.1, 0, false)).toBe('wait');
    expect(hintPlan(HINT.first + 0.1, 0, false)).toBe('show');
    expect(hintPlan(HINT.again - 0.1, 1, false)).toBe('wait');
    expect(hintPlan(HINT.again + 0.1, 1, false)).toBe('show');
    expect(hintPlan(HINT.again + 0.1, 2, false)).toBe('help');
    expect(HINT.again).toBeGreaterThanOrEqual(5); expect(HINT.again).toBeLessThanOrEqual(7);
  });
  it('leaves a child who knows the gesture alone much longer, and still never lets the story stall', () => {
    expect(hintPlan(HINT.again + 0.1, 0, true)).toBe('wait');
    expect(hintPlan(HINT.again * 1.6 + 0.1, 0, true)).toBe('show');
    expect(hintPlan(HINT.again * 1.6 + 0.1, 1, true)).toBe('help');
    expect(hintPlan(Number.NaN, 0, false)).toBe('wait');
  });
});

describe('frost on the glass', () => {
  it('starts frosted all over; a wipe clears a round patch and nothing beyond it', () => {
    const grid = makeFrost();
    expect(frostLeft(grid)).toBe(1);
    const shed = wipeFrost(grid, 0.5, 0.5, 0.1);
    expect(shed).toBeGreaterThan(0);
    expect(frostLeft(grid, { u: 0.5, v: 0.5, r: 0.04 })).toBeLessThan(0.1);
    expect(frostLeft(grid, { u: 0.1, v: 0.1, r: 0.06 })).toBe(1);
    expect(frostLeft(grid)).toBeLessThan(1); expect(frostLeft(grid)).toBeGreaterThan(0.9);
    // Wiping clear glass takes nothing more off.
    wipeFrost(grid, 0.5, 0.5, 0.1);
    expect(wipeFrost(grid, 0.5, 0.5, 0.05)).toBe(0);
  });
  it('the eye shows as soon as its own patch is clear, long before the whole pane is', () => {
    const grid = makeFrost(), eye = { u: 0.42, v: 0.36, r: 0.07, aspect: 1.4 };
    expect(frostLeft(grid, eye)).toBeGreaterThan(FROST.eyeAt);
    wipeFrost(grid, eye.u, eye.v, 0.1, 1.4);
    expect(frostLeft(grid, eye)).toBeLessThan(FROST.eyeAt);
    expect(frostLeft(grid)).toBeGreaterThan(FROST.meltAt);
  });
  it('a few good sweeps are enough: the rest melts by itself, all the way', () => {
    const grid = makeFrost();
    let strokes = 0;
    for (let v = 0.15; v < 1 && frostLeft(grid) >= FROST.meltAt; v += 0.2) for (let u = 0.05; u <= 0.95; u += 0.05) { wipeFrost(grid, u, v, 0.1, 1.5); strokes++; }
    expect(frostLeft(grid)).toBeLessThan(FROST.meltAt);
    expect(strokes).toBeLessThan(120);
    let left = frostLeft(grid), seconds = 0;
    while (left > 0 && seconds < 5) { const next = meltFrost(grid, 1 / 60); expect(next).toBeLessThanOrEqual(left); left = next; seconds += 1 / 60; }
    expect(left).toBe(0); expect(seconds).toBeLessThan(1.5);
  });
  it('a wipe off the edge of the glass is harmless', () => {
    const grid = makeFrost();
    expect(wipeFrost(grid, -2, 5, 0.1)).toBe(0); expect(frostLeft(grid)).toBe(1);
    expect(wipeFrost(grid, 0, 0, 0.1)).toBeGreaterThan(0);
  });
});

describe('the RouteScope measures along the curve', () => {
  it('the line follows a finger that stays on the tusk, a little at a time', () => {
    let k = 0;
    for (let i = 1; i <= 20; i++) k = traceStep(k, i / 20, 10);
    expect(k).toBeCloseTo(1);
  });
  it('it cannot jump to the tip, cannot go backward, and ignores a finger off the tusk', () => {
    expect(traceStep(0.2, 0.9, 5)).toBe(0.2);
    expect(traceStep(0.5, 0.3, 5)).toBe(0.5);
    expect(traceStep(0.5, 0.6, TRACE.reach + 1)).toBe(0.5);
    expect(traceStep(0.5, 0.5 + TRACE.lead, 5)).toBeCloseTo(0.5 + TRACE.lead);
    // Lifting the finger keeps what is measured.
    expect(traceStep(0.5, 0.55, Infinity)).toBe(0.5);
  });
});

describe('an offered tuft', () => {
  it('held still, the WaitRing fills in about two seconds', () => {
    let ring = 0, seconds = 0;
    while (ring < 1 && seconds < 10) { ring = patienceStep(ring, true, 1 / 60); seconds += 1 / 60; }
    expect(seconds).toBeGreaterThan(PATIENCE_SECONDS - 0.1); expect(seconds).toBeLessThan(PATIENCE_SECONDS + 0.1);
  });
  it('waved about, it only eases back: slowly, never below nothing, never as a penalty', () => {
    const half = 0.5, after = patienceStep(half, false, 1);
    expect(after).toBeLessThan(half); expect(after).toBeGreaterThan(half - 0.05);
    expect(patienceStep(0, false, 1)).toBe(0);
    // Easing back is slower than filling, so a wriggly child still gets there.
    expect(half - patienceStep(half, false, 0.1)).toBeLessThan(patienceStep(half, true, 0.1) - half);
  });
});

describe('the ScoutCam finds the herd', () => {
  it('the lock closes while the finder is on the herd, and opens when it drifts off', () => {
    let lock = 0, seconds = 0;
    while (lock < 1 && seconds < 5) { lock = scoutStep(lock, 0.3, 0.3 + SCOUT.tolerance * 0.9, 1 / 60); seconds += 1 / 60; }
    expect(seconds).toBeCloseTo(SCOUT.lockSeconds, 0);
    expect(scoutStep(0.5, 0.3, 0.3 + SCOUT.tolerance * 1.5, 1 / 60)).toBeLessThan(0.5);
    expect(scoutStep(0, 0.9, 0.2, 1)).toBe(0);
  });
  it('the ping quickens as the finder nears', () => {
    expect(scoutNear(0.3, 0.3)).toBe(1); expect(scoutNear(0, 1)).toBe(0);
    expect(scoutNear(0.4, 0.3)).toBeGreaterThan(scoutNear(0.6, 0.3));
  });
});

describe('the walk to the herd', () => {
  it('goes on only while the child holds the way ahead, and takes a few seconds', () => {
    expect(walkStep(0.3, false, 1)).toBe(0.3);
    let walked = 0, seconds = 0;
    while (walked < 1 && seconds < 30) { walked = walkStep(walked, true, 1 / 60); seconds += 1 / 60; }
    expect(seconds).toBeCloseTo(WALK_SECONDS, 0);
    expect(WALK_SECONDS).toBeGreaterThanOrEqual(5); expect(WALK_SECONDS).toBeLessThanOrEqual(9);
  });
  it('the herd comes nearer all the way, from far off to one side to close by', () => {
    const start = herdPlace(0, 2400, -600), end = herdPlace(1, 2400, -600);
    expect(start).toEqual({ depth: HERD_FAR, offset: 2400 }); expect(end.depth).toBeCloseTo(HERD_NEAR); expect(end.offset).toBe(-600);
    let last = start.depth;
    for (let k = 0.05; k <= 1; k += 0.05) { const at = herdPlace(k, 2400, -600); expect(at.depth).toBeLessThanOrEqual(last); last = at.depth; }
    expect(herdPlace(9, 0, 100)).toEqual(herdPlace(1, 0, 100));
  });
  it('the day goes on with the story: gold afternoon, sunset on the walk, night for the show', () => {
    const hours = STEPS.map(step => hourFor(step));
    for (let i = 1; i < hours.length; i++) expect(hours[i]).toBeGreaterThanOrEqual(hours[i - 1]);
    expect(hourFor('frost')).toBeLessThan(0.5);
    expect(hourFor('walk', 1)).toBeGreaterThan(hourFor('walk', 0) + 0.5); expect(hourFor('walk', 1)).toBeLessThanOrEqual(hourFor('low'));
    expect(hourFor('setPiece')).toBe(3);
  });
});

describe('the ViewCheck', () => {
  it('lowers the eye from a child height to a calf height, steadily', () => {
    expect(eyeHeight(0)).toBeGreaterThan(150); expect(eyeHeight(1)).toBeLessThan(70); expect(eyeHeight(1)).toBeGreaterThan(30);
    for (let low = 0.1; low <= 1; low += 0.1) expect(eyeHeight(low)).toBeLessThan(eyeHeight(low - 0.1));
    expect(eyeHeight(-3)).toBe(eyeHeight(0)); expect(eyeHeight(7)).toBe(eyeHeight(1));
  });
});

describe('the camera', () => {
  const box = { minX: 30, minY: 96, maxX: 940, maxY: 664 }, safe = { top: 96, bottom: 100, side: 12 };
  it('shows the whole of a shot inside the room the HUD leaves free, on a phone and on a desk', () => {
    for (const stage of [{ w: 390, h: 760 }, { w: 844, h: 330 }, { w: 1024, h: 692 }, { w: 1280, h: 724 }]) {
      const cam = fitShot(box, stage, safe);
      const sx = (x: number) => (x - cam.x) * cam.zoom + stage.w / 2, sy = (y: number) => (y - cam.y) * cam.zoom + stage.h / 2;
      expect(sx(box.minX)).toBeGreaterThanOrEqual(safe.side - 0.5); expect(sx(box.maxX)).toBeLessThanOrEqual(stage.w - safe.side + 0.5);
      expect(sy(box.minY)).toBeGreaterThanOrEqual(safe.top - 0.5); expect(sy(box.maxY)).toBeLessThanOrEqual(stage.h - safe.bottom + 0.5);
      // It is as large as that room allows: it touches it on one axis.
      const fills = Math.max((sx(box.maxX) - sx(box.minX)) / (stage.w - safe.side * 2), (sy(box.maxY) - sy(box.minY)) / (stage.h - safe.top - safe.bottom));
      expect(fills).toBeCloseTo(1, 3);
    }
  });
  it('never zooms past its limit on a tiny box, and survives a stage with no room', () => {
    expect(fitShot({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, { w: 1280, h: 720 }, safe, 4).zoom).toBe(4);
    const cramped = fitShot(box, { w: 60, h: 60 }, safe);
    expect(cramped.zoom).toBeGreaterThan(0); expect(Number.isFinite(cramped.x) && Number.isFinite(cramped.y)).toBe(true);
  });
});

describe('five pictures in the sky', () => {
  it('each shape hangs five stars inside the sky, well apart, and the secret adds a sixth off the end', () => {
    for (const id of CONSTELLATIONS) {
      const stars = constellation(id);
      expect(stars).toHaveLength(DISCOVERIES.length);
      for (const [x, y] of stars) { expect(x).toBeGreaterThan(0.05); expect(x).toBeLessThan(0.95); expect(y).toBeGreaterThan(0.05); expect(y).toBeLessThan(0.95); }
      for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) expect(Math.hypot(stars[i][0] - stars[j][0], stars[i][1] - stars[j][1])).toBeGreaterThan(0.17);
      const extra = secretStar(id);
      expect(extra[0]).toBeGreaterThan(0); expect(extra[0]).toBeLessThan(1); expect(extra[1]).toBeGreaterThan(0); expect(extra[1]).toBeLessThan(1);
      for (const [x, y] of stars) expect(Math.hypot(extra[0] - x, extra[1] - y)).toBeGreaterThan(0.05);
    }
  });
  it('the show keeps its order: the call, the answers, the aurora, then the pictures one by one, in about ten seconds', () => {
    expect(SET_PIECE.call).toBeLessThan(SET_PIECE.answers[0]);
    for (let i = 1; i < SET_PIECE.answers.length; i++) expect(SET_PIECE.answers[i]).toBeGreaterThan(SET_PIECE.answers[i - 1]);
    expect(SET_PIECE.aurora).toBeLessThan(SET_PIECE.stars);
    // The sky is named once the herd has answered, and before the first picture rises.
    expect(SET_PIECE.auroraCue).toBeGreaterThan(SET_PIECE.answers[SET_PIECE.answers.length - 1]); expect(SET_PIECE.auroraCue).toBeLessThan(SET_PIECE.stars);
    expect(auroraAt(SET_PIECE.aurora)).toBe(0); expect(auroraAt(SET_PIECE.aurora + 4)).toBe(1);
    expect(starsRisen(SET_PIECE.stars)).toBe(0); expect(starsRisen(SET_PIECE.stars + SET_PIECE.starGap * 2.5)).toBeCloseTo(2.5);
    expect(starsRisen(99)).toBe(5); expect(starsRisen(99, 6)).toBe(6);
    // The last picture is up before the child is offered the way out.
    expect(SET_PIECE.stars + SET_PIECE.starGap * 6).toBeLessThanOrEqual(SET_PIECE.hold);
    expect(SET_PIECE.hold).toBeGreaterThanOrEqual(8); expect(SET_PIECE.hold).toBeLessThanOrEqual(12);
  });
});

describe('one visit', () => {
  it('the same seed plans the same visit', () => {
    expect(planRound(7)).toEqual(planRound(7));
    expect(planRound(7)).not.toEqual(planRound(8));
  });
  it('playing again never brings the same weather or the same stars twice running', () => {
    let last = planRound(1);
    const skies = new Set([last.sky]), shapes = new Set([last.starShape]), auroras = new Set([last.aurora]), sizes = new Set([last.herdSize]);
    for (let seed = 2; seed < 80; seed++) {
      const next = planRound(seed, last);
      expect(next.sky).not.toBe(last.sky); expect(next.starShape).not.toBe(last.starShape);
      skies.add(next.sky); shapes.add(next.starShape); auroras.add(next.aurora); sizes.add(next.herdSize);
      last = next;
    }
    expect(skies.size).toBe(SKIES.length); expect(shapes.size).toBe(CONSTELLATIONS.length); expect(auroras.size).toBe(AURORAS.length); expect(sizes.size).toBeGreaterThanOrEqual(3);
  });
  it('the herd is always somewhere the child has to look for it, and never too many to draw', () => {
    for (let seed = 1; seed < 60; seed++) {
      const round = planRound(seed);
      // Away from the middle, where the finder starts, by more than the lock's reach; and still on the stage.
      expect(round.herdU - 0.5).toBeGreaterThan(SCOUT.tolerance * 1.5); expect(round.herdU).toBeLessThan(0.92);
      expect(round.herdSize).toBeGreaterThanOrEqual(4); expect(round.herdSize).toBeLessThanOrEqual(7);
      expect(round.flakes).toBeLessThanOrEqual(60); expect(round.cover).toBeGreaterThan(0.3); expect(Math.abs(round.wind)).toBeLessThan(0.3);
    }
  });
});
