import { describe, expect, it } from 'vitest';
import {
  ARRIVE, BOOK_TILT_MIN, GRAB_MIN, HINT_PLAY, HINT_REST, HOME_MS, PAGE_W, PEEK_RISE, RIVER_COURSES, SETTLE_SPAN, SETTLE_STAGGER,
  fitBook, grabRadius, hintPose, hopArc, leafFraction, peek, riverCourse, riverGates, settleRise, settleSeconds, shake, stageBox, stepped, turnRelease, unprojectBookPoint,
  BOOK_TILT, END_MS, GATE_HOLD, GUST_EVERY, GUST_PUSH, HARBOUR_LAMPS, LANE_Y, LAUNCH_DRAG, PAGE_D, QUAY_HOLD, QUAY_LANE, QUAY_X, RIVER_BOAT_X, RIVER_COURSE, RIVER_END, RIVER_GATES,
  SPREAD_W, STAND_MAX, STORM_BAND, STORM_NEED, WHEEL_LIMIT, WHEEL_STEP,
  angleDelta, angleForLane, bookScene, boatYaw, canFinish, canTurn, clampWheel, createBook, createHarbour, createRiver, createStorm, dragFraction, edgeProgress, foldAngles,
  harbourStep, keyIntent, lampsLit, laneForAngle, launchFromDrag, layerAngle, pageOrder, pointerAngle, projectBookPoint, riverDone, riverItemX, riverStep, setWheel, spreadDone,
  stormCalm, stormStep, swipeIntent, turned, visibleLeafAngle, wheelDetents, wheelDrag, type BookState, type Lane, type RiverState, type StormState,
} from './paperBoatRules';

/** Runs the river for `seconds` with the wheel steering to `lane`. */
function sail(river: RiverState, lane: Lane, seconds: number) {
  const events: string[] = [];
  for (let t = 0; t < seconds; t += 0.05) { const step = riverStep(river, 0.05, lane); river = step.river; events.push(...step.events); }
  return { river, events };
}
function weather(storm: StormState, seconds: number, angle: (t: number, s: StormState) => number, held = false) {
  let wheel = 0, gusts = 0;
  for (let t = 0; t < seconds; t += 0.05) {
    wheel = angle(t, storm);
    const step = stormStep(storm, 0.05, wheel, held); storm = step.storm; if (step.gust) gusts++;
  }
  return { storm, gusts, wheel };
}
const done = (patch: Partial<BookState> = {}): BookState => ({ ...createBook(), launched: true, river: { ...createRiver(), gates: 3 }, storm: { ...createStorm(), calmed: true }, harbour: { ...createHarbour(), docked: true, lamps: HARBOUR_LAMPS }, ...patch });

describe('fold geometry: every layer angle is a function of one progress number', () => {
  it('flat at 0, standing just short of upright at 1, monotonic between', () => {
    expect(foldAngles(0).stand).toBe(0);
    expect(foldAngles(1).stand).toBe(STAND_MAX);
    expect(STAND_MAX).toBeGreaterThanOrEqual(80); expect(STAND_MAX).toBeLessThanOrEqual(90);
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) { const a = foldAngles(p).stand; expect(a).toBeGreaterThanOrEqual(last); last = a; }
    expect(foldAngles(0.5).stand).toBeCloseTo(STAND_MAX / 2);
  });
  it('a V-fold rises with the page and its wings open from closed to a shallow V', () => {
    expect(foldAngles(0).vfold.yaw).toBeGreaterThan(foldAngles(1).vfold.yaw);
    expect(foldAngles(1).vfold.yaw).toBeGreaterThan(0);
    expect(foldAngles(1).vfold.rise).toBe(STAND_MAX);
  });
  it('a stalk stands first and lifts its piece only once the page is mostly open', () => {
    expect(foldAngles(0.3).stalk.lift).toBe(0);
    expect(foldAngles(0.7).stalk.lift).toBeGreaterThan(0);
    expect(foldAngles(1).stalk.lift).toBe(1);
  });
  it('the shadow grows with the fold and odd input is clamped', () => {
    expect(foldAngles(0).shadow).toBe(0);
    expect(foldAngles(1).shadow).toBeGreaterThan(foldAngles(0.4).shadow);
    expect(foldAngles(Number.NaN).stand).toBe(0); expect(foldAngles(7).stand).toBe(STAND_MAX);
    expect(layerAngle('vfold', 1)).toBe(STAND_MAX); expect(layerAngle('stalk', 0.5)).toBeCloseTo(STAND_MAX / 2);
  });
});

describe('the page turn', () => {
  it('a settled book shows one spread fully open and nothing in the air', () => {
    const scene = bookScene(2);
    expect(scene).toMatchObject({ settled: true, from: 2, staticLeft: 2, staticRight: 2, leafFront: null, leafAngle: 0 });
    expect(scene.progress).toEqual([0, 0, 1, 0]);
  });
  it('mid-turn: the old spread folds as the new one rises, and the leaf is upright', () => {
    const scene = bookScene(0.5);
    expect(scene).toMatchObject({ settled: false, staticLeft: 0, staticRight: 1, leafFront: 0, leafBack: 1, leafAngle: -90 });
    expect(scene.progress[0]).toBeCloseTo(0.5); expect(scene.progress[1]).toBeCloseTo(0.5);
    const late = bookScene(2.8);
    expect(late.progress[2]).toBeCloseTo(0.2); expect(late.progress[3]).toBeCloseTo(0.8); expect(late.leafAngle).toBeCloseTo(-144);
  });
  it('positions outside the book are clamped', () => {
    expect(bookScene(-1).from).toBe(0); expect(bookScene(9).from).toBe(3); expect(bookScene(3).settled).toBe(true);
  });
  it('Hebrew mirrors the spine order and the turn direction, not the story', () => {
    expect(pageOrder('ltr')).toEqual({ mirror: false, nextCorner: 'right', backCorner: 'left', turnsToward: 'left' });
    expect(pageOrder('rtl')).toEqual({ mirror: true, nextCorner: 'left', backCorner: 'right', turnsToward: 'right' });
    expect(visibleLeafAngle(0.5, 'ltr')).toBe(-90); expect(visibleLeafAngle(0.5, 'rtl')).toBe(90);
    // the same position shows the same spreads in both languages
    expect(bookScene(1.25)).toEqual(bookScene(1.25));
  });
  it('swipes, drags and arrow keys follow the reading direction', () => {
    expect(swipeIntent(-80, 'ltr')).toBe('next'); expect(swipeIntent(80, 'ltr')).toBe('back');
    expect(swipeIntent(80, 'rtl')).toBe('next'); expect(swipeIntent(-80, 'rtl')).toBe('back');
    expect(swipeIntent(10, 'ltr')).toBeNull();
    expect(dragFraction(-100, 200, 'ltr', 'next')).toBe(0.5); expect(dragFraction(100, 200, 'rtl', 'next')).toBe(0.5);
    expect(dragFraction(100, 200, 'ltr', 'back')).toBe(0.5); expect(dragFraction(100, 200, 'ltr', 'next')).toBe(0);
    expect(keyIntent('ArrowRight', 'ltr')).toBe('next'); expect(keyIntent('ArrowLeft', 'rtl')).toBe('next');
    expect(keyIntent('ArrowRight', 'rtl')).toBe('back'); expect(keyIntent('PageDown', 'rtl')).toBe('next'); expect(keyIntent('Enter', 'ltr')).toBeNull();
  });
  it('the front corners of the book project wider than the back (perspective) and mirror in Hebrew', () => {
    const front = projectBookPoint(SPREAD_W, PAGE_D), back = projectBookPoint(SPREAD_W, 0);
    expect(front.x).toBeGreaterThan(back.x); expect(front.y).toBeGreaterThan(0); expect(back.y).toBeLessThan(0);
    expect(projectBookPoint(SPREAD_W, PAGE_D, true).x).toBeCloseTo(-front.x);
    expect(BOOK_TILT).toBeGreaterThan(30); expect(BOOK_TILT).toBeLessThan(60);
  });
});

describe('turn permissions and restoring each spread', () => {
  it('Next appears only once the spread’s small action is done; Back is always there after the first', () => {
    const book = createBook();
    expect(canTurn(book, 'next')).toBe(false); expect(canTurn(book, 'back')).toBe(false);
    expect(turned(book, 'next')).toBe(book);
    const launched = { ...book, launched: true };
    expect(canTurn(launched, 'next')).toBe(true);
    const second = turned(launched, 'next');
    expect(second.spread).toBe(1); expect(canTurn(second, 'back')).toBe(true); expect(canTurn(second, 'next')).toBe(false);
    expect(canTurn({ ...second, river: { ...second.river, gates: 3 } }, 'next')).toBe(true);
    expect(spreadDone({ ...book, storm: { ...createStorm(), calmed: true } }, 2)).toBe(true);
  });
  it('going back and forward keeps what each spread was left with', () => {
    let book = done({ spread: 2 });
    book = setWheel(book, 2, 33);
    const back = turned(turned(book, 'back'), 'back');
    expect(back.spread).toBe(0);
    const forward = turned(turned(back, 'next'), 'next');
    expect(forward).toEqual(book);
    expect(forward.wheel[2]).toBe(33);
  });
  it('the book finishes only from the harbour with the boat moored and the lamps lit', () => {
    expect(canFinish(done({ spread: 3 }))).toBe(true);
    expect(canFinish(done({ spread: 2 }))).toBe(false);
    expect(canFinish(done({ spread: 3, harbour: { ...createHarbour(), docked: true, lamps: 2 } }))).toBe(false);
    expect(canTurn(done({ spread: 3 }), 'next')).toBe(false);
  });
});

describe('the paper wheel', () => {
  it('follows the finger the short way round and stops at its limits', () => {
    expect(angleDelta(170, -170)).toBe(20); expect(angleDelta(-170, 170)).toBe(-20); expect(angleDelta(0, 90)).toBe(90);
    expect(wheelDrag(80, 0, 40)).toBe(WHEEL_LIMIT); expect(wheelDrag(0, 10, -20)).toBe(-30);
    expect(clampWheel(Number.NaN)).toBe(0);
    expect(pointerAngle(0, -1)).toBeCloseTo(0); expect(pointerAngle(1, 0)).toBeCloseTo(90); expect(pointerAngle(-1, 0)).toBeCloseTo(-90);
  });
  it('ticks once per detent crossed', () => {
    expect(wheelDetents(0, 14)).toBe(0); expect(wheelDetents(0, 16)).toBe(1); expect(wheelDetents(-31, 31)).toBe(5);
  });
  it('maps the angle to a channel; clockwise brings the bow round clockwise in both languages', () => {
    expect(laneForAngle(0, 'ltr')).toBe(1); expect(laneForAngle(WHEEL_STEP, 'ltr')).toBe(2); expect(laneForAngle(-WHEEL_STEP, 'ltr')).toBe(0);
    expect(laneForAngle(WHEEL_STEP, 'rtl')).toBe(0); expect(laneForAngle(-WHEEL_STEP, 'rtl')).toBe(2);
    for (const lane of [0, 1, 2] as const) for (const dir of ['ltr', 'rtl'] as const) expect(laneForAngle(angleForLane(lane, dir), dir)).toBe(lane);
  });
  it('the bow swings towards where the boat is going', () => {
    expect(boatYaw(1, 2)).toBeLessThan(0); expect(boatYaw(1, 0)).toBeGreaterThan(0); expect(boatYaw(1, 1)).toBe(0);
    expect(Math.abs(boatYaw(0, 2))).toBeLessThanOrEqual(28);
  });
});

describe('spread 1: launching the boat', () => {
  it('a tap or a drag towards the water launches it; a tiny nudge drifts back', () => {
    expect(launchFromDrag(10, 30)).toBe(true); expect(launchFromDrag(3, 4)).toBe(false);
    expect(launchFromDrag(0, -LAUNCH_DRAG * 2)).toBe(false);
  });
});

describe('spread 2: the river and its three reed arches', () => {
  it('lays three arches with lanes that need the wheel turned both ways', () => {
    expect(RIVER_GATES.map(g => g.lane)).toEqual([2, 0, 1]);
    expect(RIVER_COURSE.every((item, i, all) => i === 0 || item.at > all[i - 1].at)).toBe(true);
    expect(RIVER_END).toBeGreaterThan(RIVER_GATES[2].at);
  });
  it('an arch waits for the boat: without steering the river stops short of it, and nothing is lost', () => {
    const { river, events } = sail(createRiver(), 1, 20);
    expect(river.gates).toBe(0); expect(river.d).toBeCloseTo(RIVER_GATES[0].at - GATE_HOLD); expect(events).toContain('held');
  });
  it('steering into each arch’s channel passes all three, and then the river is done', () => {
    let river = createRiver(), events: string[] = [];
    for (const gate of RIVER_GATES) { const leg = sail(river, gate.lane, 12); river = leg.river; events.push(...leg.events); }
    expect(river.gates).toBe(3); expect(riverDone(river)).toBe(true);
    expect(events.filter(e => e === 'reedGate')).toHaveLength(3);
  });
  it('a rock nudges the boat softly back into the channel; it is never a failure', () => {
    // sit in the near channel after the first arch: the rock there nudges the boat towards the middle
    let river: RiverState = { ...createRiver(), d: 530, pos: 2, gates: 1 };
    const step = sail(river, 2, 1.5); river = step.river;
    expect(step.events).toContain('bump');
    expect(river.nudges).toBe(1); expect(river.gates).toBe(1);
    expect(river.pos).toBeLessThan(2);
    // once past the rock, the wheel steers again
    river = sail(river, 2, 3).river; expect(river.pos).toBe(2);
  });
  it('items rise from the page edge and fold flat as they leave', () => {
    expect(edgeProgress(SPREAD_W)).toBe(0); expect(edgeProgress(SPREAD_W / 2)).toBe(1); expect(edgeProgress(0)).toBe(0);
    expect(riverItemX(RIVER_GATES[0], RIVER_GATES[0].at)).toBe(RIVER_BOAT_X);
    expect(LANE_Y).toHaveLength(3); expect(LANE_Y[0]).toBeLessThan(LANE_Y[2]);
  });
});

describe('spread 3: the storm calms when the wheel is held steady', () => {
  it('three seconds of steadiness (cumulative) calm it for good', () => {
    const { storm } = weather(createStorm(), STORM_NEED + 0.2, () => 0, true);
    expect(storm.calmed).toBe(true); expect(stormCalm(storm)).toBe(1);
    const after = weather(storm, 4, () => 60).storm; expect(after.calmed).toBe(true);
  });
  it('steady means within the band; outside it the calm fades slowly, not all at once', () => {
    const half = weather(createStorm(), 1.5, () => STORM_BAND - 1, true).storm;
    expect(half.steady).toBeCloseTo(1.5, 1);
    const off = weather(half, 1, () => STORM_BAND + 10, true).storm;
    expect(off.steady).toBeGreaterThan(1); expect(off.steady).toBeLessThan(1.5);
    expect(stormCalm(off)).toBeGreaterThan(0); expect(off.calmed).toBe(false);
  });
  it('gusts swing an unheld wheel away from straight ahead; a held wheel does not move', () => {
    const first = stormStep({ ...createStorm(), elapsed: 0.89 }, 0.05, 0, false);
    expect(first.gust).toBe(true); expect(Math.abs(first.push)).toBeCloseTo(GUST_PUSH, 0);
    const held = stormStep({ ...createStorm(), elapsed: 0.89 }, 0.05, 0, true);
    expect(held.gust).toBe(true); expect(held.push).toBe(0);
    const away = stormStep({ ...createStorm(), elapsed: 0.89 }, 0.05, -20, false);
    expect(away.push).toBeLessThan(0);
  });
  it('left alone the storm does not calm itself: the child’s steadiness changes the weather', () => {
    let wheel = 0;
    let storm = createStorm();
    for (let t = 0; t < 20; t += 0.05) { const step = stormStep(storm, 0.05, wheel, false); storm = step.storm; wheel = clampWheel(wheel + step.push); }
    expect(storm.calmed).toBe(false);
    expect(GUST_EVERY).toBeGreaterThan(STORM_NEED);
  });
});

describe('spread 4: the harbour', () => {
  it('the boat waits off the quay until it is steered alongside, then moors', () => {
    let harbour = createHarbour(), docked = false;
    for (let t = 0; t < 20; t += 0.05) harbour = harbourStep(harbour, 0.05, 1).harbour;
    expect(harbour.docked).toBe(false); expect(harbour.x).toBeCloseTo(QUAY_X - QUAY_HOLD);
    for (let t = 0; t < 10 && !docked; t += 0.05) { const step = harbourStep(harbour, 0.05, QUAY_LANE); harbour = step.harbour; docked = step.docked; }
    expect(docked).toBe(true); expect(harbour).toMatchObject({ x: QUAY_X, pos: QUAY_LANE, docked: true });
    expect(harbourStep(harbour, 0.05, 2).harbour).toBe(harbour);
  });
  it('the lamps come on one by one after the rope drops, then the end', () => {
    expect(lampsLit(0)).toBe(0); expect(lampsLit(700)).toBe(1); expect(lampsLit(700 + 420)).toBe(2);
    expect(lampsLit(END_MS)).toBe(HARBOUR_LAMPS); expect(lampsLit(Number.NaN)).toBe(0);
  });
});

describe('the book on the screen', () => {
  it('a point of the page projects to the screen and back, at any tilt, in both reading directions', () => {
    for (const tilt of [BOOK_TILT_MIN, BOOK_TILT]) for (const mirror of [false, true]) for (const [x, y] of [[0, 0], [130, 250], [SPREAD_W, PAGE_D], [296, 262]]) {
      const p = projectBookPoint(x, y, mirror, 0, tilt), back = unprojectBookPoint(p.x, p.y, mirror, tilt);
      expect(back.x).toBeCloseTo(x, 4); expect(back.y).toBeCloseTo(y, 4);
    }
  });
  it('a piece standing off the page is drawn above its foot, more so the flatter the book is seen', () => {
    const foot = projectBookPoint(250, 100), top = projectBookPoint(250, 100, false, 120);
    expect(top.y).toBeLessThan(foot.y); expect(top.x).toBeCloseTo(foot.x);
    const rise = (tilt: number) => projectBookPoint(250, 100, false, 0, tilt).y - projectBookPoint(250, 100, false, 120, tilt).y;
    expect(rise(BOOK_TILT)).toBeGreaterThan(rise(BOOK_TILT_MIN));
  });
  it('the stage holds the whole book: its near corners, and the tallest piece on the far edge', () => {
    for (const tilt of [BOOK_TILT_MIN, BOOK_TILT]) {
      const box = stageBox(tilt), corner = projectBookPoint(SPREAD_W, PAGE_D, false, 0, tilt), tall = projectBookPoint(250, 30, false, 179, tilt);
      expect(box.cx + corner.x).toBeLessThan(box.w); expect(box.cy + corner.y).toBeLessThan(box.h);
      expect(box.cy + tall.y).toBeGreaterThan(0); expect(box.cx).toBeCloseTo(box.w / 2);
    }
  });
  it('a tall phone gets the widest book and a view from higher up; a wide screen keeps the low view', () => {
    const phone = fitBook(386, 420), wide = fitBook(900, 380);
    expect(phone.tilt).toBe(BOOK_TILT_MIN); expect(phone.scale).toBeCloseTo(386 / phone.box.w, 5);
    expect(wide.tilt).toBe(BOOK_TILT); expect(wide.scale).toBeCloseTo(380 / wide.box.h, 5);
    expect(phone.box.h * phone.scale).toBeLessThanOrEqual(420); expect(wide.box.w * wide.scale).toBeLessThanOrEqual(900);
    expect(fitBook(Number.NaN, 0).scale).toBeGreaterThan(0);
    expect(BOOK_TILT_MIN).toBeLessThan(BOOK_TILT);
  });
});

describe('a finger on the page', () => {
  it('the grabbed point stays under the finger: flat at the grab, upright over the spine, flat again on the far side', () => {
    expect(leafFraction(200, 200)).toBe(0); expect(leafFraction(0, 200)).toBeCloseTo(0.5); expect(leafFraction(-200, 200)).toBe(1);
    expect(leafFraction(100, 200)).toBeCloseTo(1 / 3); expect(leafFraction(999, 200)).toBe(0); expect(leafFraction(-999, 200)).toBe(1);
    let last = -1;
    for (let offset = 200; offset >= -200; offset -= 20) { const f = leafFraction(offset, 200); expect(f).toBeGreaterThanOrEqual(last); last = f; }
  });
  it('the radius is where the page was grabbed, never so near the spine that the page whips over', () => {
    expect(grabRadius(180, 250, 'next')).toBe(180); expect(grabRadius(20, 250, 'next')).toBe(GRAB_MIN * 250);
    expect(grabRadius(-180, 250, 'back')).toBe(180); expect(grabRadius(400, 250, 'next')).toBe(250);
    // a swipe that starts on the other page takes the page by its edge
    expect(grabRadius(-120, 250, 'next')).toBe(250); expect(grabRadius(120, 250, 'back')).toBe(250);
    expect(PAGE_W * GRAB_MIN).toBeGreaterThan(80);
  });
  it('letting go: a flick carries the page over or back, a still page falls to its nearer side', () => {
    expect(turnRelease(0.3, 0)).toBe(0); expect(turnRelease(0.6, 0)).toBe(1);
    expect(turnRelease(0.2, 2)).toBe(1); expect(turnRelease(0.8, -2)).toBe(0);
    expect(turnRelease(0.02, 5)).toBe(0); expect(turnRelease(0.99, -5)).toBe(1);
    expect(turnRelease(Number.NaN, Number.NaN)).toBe(0);
  });
  it('follow-through: the pieces rise the last of the way a beat after the page lands, far ones first, and then are still', () => {
    expect(settleRise(0, 0)).toEqual({ p: ARRIVE, lean: 0 });
    expect(ARRIVE).toBeGreaterThan(0.7); expect(ARRIVE).toBeLessThan(1);
    const early = 0.05 + SETTLE_SPAN * 0.2;
    expect(settleRise(early, 0).p).toBeGreaterThan(ARRIVE); expect(settleRise(early, 6).p).toBe(ARRIVE);
    expect(Math.abs(settleRise(0.05 + SETTLE_SPAN * 0.5, 0).lean)).toBeGreaterThan(0.5);
    const done = settleSeconds(8);
    for (let order = 0; order <= 8; order++) expect(settleRise(done, order)).toEqual({ p: 1, lean: 0 });
    let last = 0;
    for (let t = 0; t < done; t += 0.02) { const p = settleRise(t, 3).p; expect(p).toBeGreaterThanOrEqual(last); expect(p).toBeLessThanOrEqual(1); last = p; }
    expect(SETTLE_STAGGER).toBeGreaterThan(0); expect(settleRise(Number.NaN, 0)).toEqual({ p: 1, lean: 0 });
  });
});

describe('things that answer a poke', () => {
  it('a wobble dies away and is over within a few seconds', () => {
    expect(shake(-1)).toBe(0); expect(shake(0)).toBe(0); expect(shake(3)).toBe(0);
    expect(Math.abs(shake(0.1, 8))).toBeGreaterThan(Math.abs(shake(1.4, 8)));
    for (let s = 0; s < 2.4; s += 0.05) expect(Math.abs(shake(s, 8))).toBeLessThanOrEqual(8);
  });
  it('a hop goes up and comes down; a pop-up piece overshoots a little, stays, and folds away', () => {
    expect(hopArc(0)).toBe(0); expect(hopArc(0.25, 0.5)).toBeCloseTo(1); expect(hopArc(0.5, 0.5)).toBe(0); expect(hopArc(-1)).toBe(0);
    expect(peek(0)).toBe(0); expect(peek(-2)).toBe(0);
    let top = 0; for (let s = 0; s < PEEK_RISE; s += 0.01) top = Math.max(top, peek(s));
    expect(top).toBeGreaterThan(1); expect(top).toBeLessThan(1.3);
    expect(peek(PEEK_RISE + 0.5)).toBe(1); expect(peek(PEEK_RISE + 1.5 + 0.16)).toBeLessThan(1); expect(peek(9)).toBe(0);
  });
  it('things that happen one after another are counted by the clock', () => {
    expect(stepped(-5, 0, 100, 4)).toBe(0); expect(stepped(0, 0, 100, 4)).toBe(1); expect(stepped(250, 0, 100, 4)).toBe(3); expect(stepped(9999, 0, 100, 4)).toBe(4);
    expect(stepped(Number.NaN, 0, 100, 4)).toBe(0);
  });
  it('the hand that shows a first move fades in, presses, travels, holds and lets go; it never lingers', () => {
    expect(hintPose(0)).toEqual({ show: 0, press: 0, travel: 0 });
    const mid = hintPose(0.45); expect(mid.show).toBe(1); expect(mid.press).toBe(1); expect(mid.travel).toBeGreaterThan(0); expect(mid.travel).toBeLessThan(1);
    const hold = hintPose(0.75); expect(hold.travel).toBe(1); expect(hold.press).toBe(1);
    expect(hintPose(1).show).toBe(0); expect(hintPose(1).press).toBe(0);
    expect(HINT_REST).toBeGreaterThanOrEqual(5); expect(HINT_PLAY).toBeLessThan(HINT_REST);
  });
});

describe('play again is another river', () => {
  it('every course has three arches that need the wheel turned both ways, in a different order from the first', () => {
    expect(RIVER_COURSES.length).toBeGreaterThanOrEqual(3);
    expect(RIVER_COURSES[0]).toBe(RIVER_COURSE);
    const orders = RIVER_COURSES.map((_, i) => riverGates(i).map(gate => gate.lane).join(''));
    expect(new Set(orders).size).toBe(RIVER_COURSES.length);
    for (let i = 0; i < RIVER_COURSES.length; i++) {
      const lanes = riverGates(i).map(gate => gate.lane);
      expect(lanes).toHaveLength(3); expect(lanes).toContain(0); expect(lanes).toContain(2);
      expect(lanes[0]).not.toBe(1); // the first arch always asks for a turn of the wheel
      expect(riverCourse(i).every((item, n, all) => n === 0 || item.at > all[n - 1].at)).toBe(true);
    }
    expect(riverCourse(RIVER_COURSES.length)).toBe(RIVER_COURSES[0]); expect(riverCourse(-1)).toBe(RIVER_COURSES[RIVER_COURSES.length - 1]);
  });
  it('every course can be sailed, a stone only ever nudges, and nothing is lost on any of them', () => {
    for (let i = 0; i < RIVER_COURSES.length; i++) {
      let river = createRiver(i); const events: string[] = [];
      for (const gate of riverGates(i)) { const leg = sail(river, gate.lane, 12); river = leg.river; events.push(...leg.events); }
      expect(river.gates).toBe(3); expect(river.course).toBe(i); expect(events.filter(e => e === 'reedGate')).toHaveLength(3);
      // never steering at all: the river waits at the first arch
      const idle = sail(createRiver(i), 1, 20).river;
      expect(idle.gates).toBe(0); expect(idle.d).toBeCloseTo(riverGates(i)[0].at - GATE_HOLD);
    }
  });
  it('a stone waits in the lane of the arch just passed and nudges the boat on towards the next one', () => {
    for (let i = 0; i < RIVER_COURSES.length; i++) {
      const gates = riverGates(i), stones = riverCourse(i).filter(item => item.kind === 'rock');
      stones.forEach((stone, n) => {
        expect(stone.lane).toBe(gates[n].lane);
        const step = sail({ ...createRiver(i), d: stone.at - 30, pos: stone.lane, gates: n + 1 }, stone.lane, 0.6);
        expect(step.events).toContain('bump');
        expect(Math.abs(step.river.pos - gates[n + 1].lane)).toBeLessThan(Math.abs(stone.lane - gates[n + 1].lane));
      });
    }
  });
  it('a reading picks its river and which way the first gust blows; the first reading is always the same', () => {
    expect(createBook()).toEqual(createBook(0));
    expect(createBook(1).river.course).toBe(1); expect(createBook(1).storm.gustSign).toBe(-1); expect(createBook(2).storm.gustSign).toBe(1);
    expect(createBook(RIVER_COURSES.length).river.course).toBe(0); expect(createBook(Number.NaN).river.course).toBe(0);
  });
  it('the homecoming is a celebration of about two seconds before the end is offered', () => {
    expect(HOME_MS).toBeGreaterThanOrEqual(1500); expect(HOME_MS).toBeLessThanOrEqual(2500);
  });
});
