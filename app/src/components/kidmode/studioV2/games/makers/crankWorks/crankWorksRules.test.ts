import { describe, expect, it } from 'vitest';
import {
  ALL_PARTS, BEAT_ANGLES, BLOOMS, BOTTOM_DEAD_CENTRE, CALM_PUSH, CAM, CAM_LAG, CHAPTERS, CHAPTER_STEPS, DETENTS, ENAMELS, FLOW_START, HAND_TURN_GOAL, KEY_STEP, LENS_PARTS, LINKAGE, LOAD, MAX_HAND_OMEGA,
  PUSH_OMEGA, SHOW_START_GOAL, SPEED_OMEGA, TAU, TOP_DEAD_CENTRE, TUNES, WAVE_LAG, WAVE_LINK, WAVE_RODS, WAVE_STEP,
  advance, angleDelta, beatsCrossed, bloomOpen, builtOf, camAngle, camCentre, camContact, camLift, chaptersDone, clampOmega, crankPin, detentSteps, detentsCrossed, easeMotor, flowReduce, follow, liftSlope, loadTurn,
  nearestPart, partsLeft, pistonLift, planOf, pointerAngle, push, releaseSpeed, rodLean, rodLength, spinEnergy, stepOf, strokeFraction, strokeOf, strokePlace, swing, topCentresCrossed,
  waveAngle, waveFraction, waveLift, wrapAngle, wristPin,
  type Flow, type FlowEvent, type Linkage, type Spin,
} from './crankWorksRules';

const FULL_CYCLE = Array.from({ length: 3601 }, (_, i) => i / 3600 * TAU);
const LINKS: Linkage[] = [LINKAGE, { r: 1, l: 3 }, { r: 20, l: 50 }, { r: 5, l: 40 }];

describe('the slider-crank is exact', () => {
  it('the rod is three cranks long in the drawing', () => {
    expect(LINKAGE.l).toBe(3 * LINKAGE.r);
  });
  it.each(LINKS)('the rod never stretches through a full cycle (r=$r, l=$l)', link => {
    for (const theta of FULL_CYCLE) expect(rodLength(theta, link)).toBeCloseTo(link.l, 9);
  });
  it('the crank pin stays on its circle and the wrist pin on its line', () => {
    for (const theta of FULL_CYCLE) {
      const pin = crankPin(theta);
      expect(Math.hypot(pin.x, pin.y)).toBeCloseTo(LINKAGE.r, 9);
      expect(wristPin(theta).x).toBe(0);
    }
  });
  it('matches the formula: lift = r cos θ + √(l² − r² sin² θ)', () => {
    const { r, l } = LINKAGE;
    for (const theta of [0.3, 1.1, 2.5, 4, 5.9]) expect(pistonLift(theta)).toBeCloseTo(r * Math.cos(theta) + Math.sqrt(l * l - (r * Math.sin(theta)) ** 2), 12);
    expect(crankPin(Math.PI / 2)).toEqual({ x: r, y: -r * Math.cos(Math.PI / 2) });
  });
  it('top dead centre is the highest point, bottom dead centre the lowest', () => {
    const { r, l } = LINKAGE;
    expect(pistonLift(TOP_DEAD_CENTRE)).toBeCloseTo(l + r, 12);
    expect(pistonLift(BOTTOM_DEAD_CENTRE)).toBeCloseTo(l - r, 12);
    const lifts = FULL_CYCLE.map(t => pistonLift(t));
    expect(Math.max(...lifts)).toBeCloseTo(l + r, 9);
    expect(Math.min(...lifts)).toBeCloseTo(l - r, 9);
    expect(strokeOf()).toBe(2 * r);
    expect(strokeFraction(TOP_DEAD_CENTRE)).toBeCloseTo(1, 12);
    expect(strokeFraction(BOTTOM_DEAD_CENTRE)).toBeCloseTo(0, 12);
    // At both dead centres the pin, the shaft and the wrist are in one line.
    expect(rodLean(TOP_DEAD_CENTRE)).toBeCloseTo(0, 12);
    expect(Math.abs(rodLean(BOTTOM_DEAD_CENTRE))).toBeCloseTo(0, 9);
  });
  it('the piston position is periodic: one turn of the crank, one up and one down', () => {
    for (const theta of FULL_CYCLE.slice(0, 400)) for (const k of [-2, 1, 3, 50]) expect(pistonLift(theta + k * TAU)).toBeCloseTo(pistonLift(theta), 9);
    // It is also symmetric: the way down mirrors the way up.
    for (const theta of [0.4, 1.3, 2.9]) expect(pistonLift(theta)).toBeCloseTo(pistonLift(TAU - theta), 12);
    // Exactly one top and one bottom per turn.
    let turns = 0;
    for (let i = 1; i < FULL_CYCLE.length - 1; i++) {
      const [a, b, c] = [pistonLift(FULL_CYCLE[i - 1]), pistonLift(FULL_CYCLE[i]), pistonLift(FULL_CYCLE[i + 1])];
      if ((b > a && b > c) || (b < a && b < c)) turns++;
    }
    expect(turns).toBe(1); // the bottom; the top is the cycle's two ends
  });
  it('a rod drawn upright from the pin and leant by rodLean ends on the wrist pin', () => {
    for (const theta of FULL_CYCLE.filter((_, i) => i % 37 === 0)) {
      const pin = crankPin(theta), lean = rodLean(theta) * Math.PI / 180;
      const end = { x: pin.x + LINKAGE.l * Math.sin(lean), y: pin.y - LINKAGE.l * Math.cos(lean) };
      const wrist = wristPin(theta);
      expect(end.x).toBeCloseTo(wrist.x, 9); expect(end.y).toBeCloseTo(wrist.y, 9);
    }
  });
  it('names the place in the stroke', () => {
    expect(strokePlace(0)).toBe('top'); expect(strokePlace(TAU * 3)).toBe('top');
    expect(strokePlace(1)).toBe('down'); expect(strokePlace(Math.PI)).toBe('bottom'); expect(strokePlace(4.5)).toBe('up');
  });
});

describe('angles and turning by hand', () => {
  it('wraps and finds the shortest turn', () => {
    expect(wrapAngle(-0.5)).toBeCloseTo(TAU - 0.5, 12); expect(wrapAngle(TAU * 2 + 1)).toBeCloseTo(1, 12);
    expect(angleDelta(TAU - 0.1, 0.1)).toBeCloseTo(0.2, 12); expect(angleDelta(0.1, TAU - 0.1)).toBeCloseTo(-0.2, 12);
  });
  it('a finger above the shaft is angle 0; to its right, a quarter turn clockwise', () => {
    expect(pointerAngle(0, -10)).toBeCloseTo(0, 12);
    expect(pointerAngle(10, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(pointerAngle(0, 10)).toBeCloseTo(Math.PI, 12);
    expect(pointerAngle(-10, 0)).toBeCloseTo(3 * Math.PI / 2, 12);
    // The same measure as θ: the crank pin sits under a finger at its own angle.
    for (const theta of [0.2, 2, 4]) { const p = crankPin(theta); expect(pointerAngle(p.x, p.y)).toBeCloseTo(theta, 9); }
  });
  it('counts top dead centre passes either way round', () => {
    expect(topCentresCrossed(1, 2)).toBe(0);
    expect(topCentresCrossed(TAU - 0.1, TAU + 0.1)).toBe(1);
    expect(topCentresCrossed(TAU + 0.1, TAU - 0.1)).toBe(1);
    expect(topCentresCrossed(0.5, 3 * TAU + 0.5)).toBe(3);
  });
  it('speed changes never move the angle; pause leaves it where it is', () => {
    let theta = 1.234;
    const before = theta;
    theta = advance(theta, SPEED_OMEGA.quick, 0); expect(theta).toBe(before);
    theta = advance(theta, SPEED_OMEGA.slow, 0.5); expect(theta).toBeCloseTo(before + SPEED_OMEGA.slow * 0.5, 12);
    expect(advance(theta, 0, 3)).toBe(theta);
    expect(SPEED_OMEGA.slow).toBeLessThan(SPEED_OMEGA.steady); expect(SPEED_OMEGA.steady).toBeLessThan(SPEED_OMEGA.quick);
  });
  it('the motor eases to a new speed', () => {
    let w = SPEED_OMEGA.slow;
    for (let i = 0; i < 120; i++) w = easeMotor(w, SPEED_OMEGA.quick, 1 / 60);
    expect(w).toBe(SPEED_OMEGA.quick);
    expect(easeMotor(1, 5, 0)).toBe(1);
  });
  it('the load turns the crank by the slope of the lift, and not at all on a dead centre', () => {
    for (const theta of [0.2, 1, 1.9, 3.3, 4.4, 6]) {
      const h = 1e-6;
      expect(liftSlope(theta)).toBeCloseTo((pistonLift(theta + h) - pistonLift(theta - h)) / (2 * h), 5);
      expect(loadTurn(theta)).toBeCloseTo(-LOAD * liftSlope(theta), 12);
    }
    expect(liftSlope(TOP_DEAD_CENTRE)).toBeCloseTo(0, 12); expect(liftSlope(BOTTOM_DEAD_CENTRE)).toBeCloseTo(0, 9);
    // Past the top the load falls on round the way it is going; before the bottom it is still falling.
    expect(loadTurn(0.4)).toBeGreaterThan(0); expect(loadTurn(-0.4)).toBeLessThan(0);
    expect(loadTurn(Math.PI - 0.4)).toBeGreaterThan(0); expect(loadTurn(Math.PI + 0.4)).toBeLessThan(0);
  });
  it('a let-go wheel never gains energy, rocks to rest with the load at the bottom, and stays there', () => {
    for (const start of [{ theta: 0.3, omega: 0 }, { theta: 2, omega: MAX_HAND_OMEGA }, { theta: 5, omega: -6 }, { theta: 1.2, omega: 2 }] as Spin[]) {
      let spin = start, frames = 0; const most = spinEnergy(start);
      while (spin.omega !== 0 || frames === 0) {
        spin = swing(spin, 1 / 60); frames++;
        expect(spinEnergy(spin)).toBeLessThanOrEqual(most + 0.02);
        if (frames > 1800) break;
      }
      expect(spin.omega).toBe(0); expect(frames).toBeLessThan(1500);
      expect(Math.abs(angleDelta(spin.theta, BOTTOM_DEAD_CENTRE))).toBeLessThan(0.12);
      expect(swing(spin, 1)).toEqual(spin);
    }
    // Balanced dead still on the top dead centre, it stays (a dead centre).
    expect(swing({ theta: 0, omega: 0 }, 0.5)).toEqual({ theta: 0, omega: 0 });
    expect(swing({ theta: 1, omega: 2 }, 0)).toEqual({ theta: 1, omega: 2 });
  });
  it('one push from rest at the bottom carries the load once over the top, and no further', () => {
    let spin: Spin = { theta: BOTTOM_DEAD_CENTRE, omega: push(0) }, tops = 0, frames = 0;
    while (spin.omega !== 0 && frames < 3000) { const next = swing(spin, 1 / 60); tops += topCentresCrossed(spin.theta, next.theta); spin = next; frames++; }
    expect(tops).toBe(1);
    expect(spin.theta).toBeGreaterThan(TAU); expect(spin.theta).toBeLessThan(TAU * 2);
  });
  it('a held wheel follows the finger with weight: it settles just behind a still finger and sags under the load', () => {
    let spin: Spin = { theta: 0, omega: 0 };
    for (let i = 0; i < 6; i++) spin = follow(spin, 1, 1 / 60);
    expect(spin.theta).toBeGreaterThan(0.2); expect(spin.theta).toBeLessThan(1); // on its way, not there yet
    for (let i = 0; i < 240; i++) spin = follow(spin, 1, 1 / 60);
    expect(Math.abs(spin.omega)).toBeLessThan(1e-3);
    // The load at θ = 1 pulls the crank on, so the wheel rests a touch ahead of the finger.
    expect(spin.theta - 1).toBeGreaterThan(0); expect(spin.theta - 1).toBeLessThan(0.1);
    let lift: Spin = { theta: 5, omega: 0 };
    for (let i = 0; i < 240; i++) lift = follow(lift, 5, 1 / 60);
    expect(lift.theta).toBeLessThan(5); // lifting the load, the wheel sags behind
    expect(follow(spin, 3, 0)).toEqual(spin);
  });
  it('the wheel clicks past twelve soft stops a turn, and their notes rise and fall with the load', () => {
    expect(detentsCrossed(0.01, TAU + 0.01)).toBe(DETENTS); expect(detentsCrossed(1, 1.01)).toBe(0); expect(detentsCrossed(0.01, -0.01)).toBe(1);
    const step = TAU / DETENTS;
    // One whole turn from the top, a stop at a time: down to the bottom note and back up.
    const notes: number[] = [];
    for (let k = 0; k < DETENTS; k++) notes.push(...detentSteps(k * step + 0.01, (k + 1) * step + 0.01));
    expect(notes).toHaveLength(DETENTS);
    expect(notes[DETENTS / 2 - 1]).toBe(0); expect(notes[DETENTS - 1]).toBe(4);
    for (let i = 1; i < DETENTS / 2; i++) expect(notes[i]).toBeLessThanOrEqual(notes[i - 1]);
    for (let i = DETENTS / 2 + 1; i < DETENTS; i++) expect(notes[i]).toBeGreaterThanOrEqual(notes[i - 1]);
    // Backwards plays the same stops in the other order; a fling keeps only the latest few.
    expect(detentSteps(step + 0.01, 0.01)).toEqual([Math.round(strokeFraction(step) * 4)]);
    expect(detentSteps(0, TAU * 3)).toHaveLength(3); expect(detentSteps(2, 2.001)).toEqual([]);
  });
  it('a push turns clockwise and is capped', () => {
    expect(push(0)).toBe(PUSH_OMEGA); expect(push(-5)).toBe(PUSH_OMEGA);
    let w = 0; for (let i = 0; i < 20; i++) w = push(w);
    expect(w).toBe(MAX_HAND_OMEGA); expect(clampOmega(-99)).toBe(-MAX_HAND_OMEGA);
    expect(KEY_STEP * 24).toBeCloseTo(TAU, 12);
  });
  it('a flick leaves the wheel spinning; a still finger leaves it still', () => {
    const samples = [{ t: 0, theta: 0 }, { t: 40, theta: 0.2 }, { t: 80, theta: 0.4 }];
    expect(releaseSpeed(samples, 85)).toBeCloseTo(5, 6);
    expect(releaseSpeed(samples, 400)).toBe(0);
    expect(releaseSpeed([{ t: 0, theta: 0 }, { t: 50, theta: 30 }], 55)).toBe(MAX_HAND_OMEGA);
    expect(releaseSpeed([{ t: 0, theta: 0 }], 1)).toBe(0);
  });
});

describe('the cam lifts the flower exactly', () => {
  it('the disc goes round its shaft at the set distance and always touches the flat follower', () => {
    for (const a of FULL_CYCLE) {
      const c = camCentre(a), touch = camContact(a);
      expect(Math.hypot(c.x, c.y)).toBeCloseTo(CAM.e, 9);
      // The follower's face is level: the disc's top is one radius above its centre, straight up.
      expect(touch.x).toBeCloseTo(c.x, 9);
      expect(c.y - touch.y).toBeCloseTo(CAM.R, 9);
      expect(camLift(a)).toBeCloseTo(-touch.y, 9);
    }
  });
  it('lifts by twice the offset each turn and opens the flower with the lift', () => {
    expect(camLift(0)).toBeCloseTo(CAM.R + CAM.e, 9);
    expect(camLift(Math.PI)).toBeCloseTo(CAM.R - CAM.e, 9);
    expect(bloomOpen(0)).toBeCloseTo(1, 9); expect(bloomOpen(Math.PI)).toBeCloseTo(0, 9);
    for (const a of FULL_CYCLE) { expect(bloomOpen(a)).toBeGreaterThanOrEqual(-1e-9); expect(bloomOpen(a)).toBeLessThanOrEqual(1 + 1e-9); expect(camLift(a + TAU)).toBeCloseTo(camLift(a), 9); }
    expect(CAM.R).toBeGreaterThan(CAM.e); // a real disc: the shaft is inside it
  });
});

describe('one wheel, everything in its turn', () => {
  it('the flower tops out a set part of a turn after the piston, and the beads one after another', () => {
    expect(bloomOpen(camAngle(CAM_LAG))).toBeCloseTo(1, 9);
    for (let i = 0; i < WAVE_RODS; i++) {
      const top = WAVE_LAG + i * WAVE_STEP;
      expect(wrapAngle(waveAngle(i, top))).toBeCloseTo(0, 9);
      expect(waveFraction(i, top)).toBeCloseTo(1, 9);
      expect(waveLift(i, top)).toBeCloseTo(WAVE_LINK.l + WAVE_LINK.r, 9);
      expect(waveFraction(i, top + Math.PI)).toBeCloseTo(0, 9);
    }
    // The order in one turn: piston, flower, the six beads, and the bell with the last bead.
    const angles = BEAT_ANGLES.map(b => b.at);
    expect([...angles].sort((a, b) => a - b)).toEqual(angles);
    expect(Math.max(...angles)).toBeLessThan(TAU);
    expect(CAM_LAG).toBeLessThan(WAVE_LAG);
  });
  it('every bead rod is a true slider-crank: its rod never stretches', () => {
    for (let i = 0; i < WAVE_RODS; i++) for (const a of FULL_CYCLE.filter((_, k) => k % 60 === 0)) expect(rodLength(waveAngle(i, a), WAVE_LINK)).toBeCloseTo(WAVE_LINK.l, 9);
    expect(WAVE_LINK.l).toBeGreaterThan(WAVE_LINK.r * 2);
  });
  it('one whole turn passes every beat once, in order, whichever way it goes', () => {
    const forward = beatsCrossed(-0.01, TAU - 0.01);
    expect(forward.map(b => b.kind)).toEqual(['pistonTop', 'bloomTop', 'beadTop', 'beadTop', 'beadTop', 'beadTop', 'beadTop', 'beadTop', 'bellRing']);
    expect(forward.filter(b => b.kind === 'beadTop').map(b => b.index)).toEqual([0, 1, 2, 3, 4, 5]);
    const back = beatsCrossed(TAU - 0.01, -0.01);
    expect(back.map(b => b.kind)).toEqual([...forward.map(b => b.kind)].reverse());
    expect(beatsCrossed(1, 1)).toEqual([]);
    expect(beatsCrossed(0.01, 0.02)).toEqual([]);
    expect(beatsCrossed(7 * TAU - 0.1, 7 * TAU + 0.1).map(b => b.kind)).toEqual(['pistonTop']);
    // A fling of many turns in one frame never piles up more than one turn of sound.
    expect(beatsCrossed(0.5, 0.5 + TAU * 5).length).toBe(BEAT_ANGLES.length);
  });
});

const play = (flow: Flow, ...events: FlowEvent[]) => events.reduce(flowReduce, flow);
const turn: FlowEvent = { type: 'turned', amount: TAU };
describe('the arc: three chapters that grow, then the whole machine', () => {
  it('walks the whole arc one small step at a time', () => {
    let flow = FLOW_START;
    const seen: string[] = [];
    const say = () => seen.push(`${flow.chapter}:${stepOf(flow)}`);
    say(); flow = play(flow, turn); say();
    for (const part of LENS_PARTS.pistonCh) flow = play(flow, { type: 'met', part });
    say(); flow = play(flow, { type: 'tested' }); say();
    expect(builtOf(flow)).toEqual({ flower: false, beads: false, bell: false });
    flow = play(flow, { type: 'placed' }); say(); expect(builtOf(flow).flower).toBe(true);
    flow = play(flow, turn); say();
    for (const part of LENS_PARTS.flowerCh) flow = play(flow, { type: 'met', part });
    say(); flow = play(flow, { type: 'placed' }, turn); say(); expect(builtOf(flow)).toEqual({ flower: true, beads: true, bell: false });
    flow = play(flow, { type: 'met', part: 'smallCranks' }); say();
    flow = play(flow, { type: 'placed' }); say(); expect(builtOf(flow).bell).toBe(true);
    flow = play(flow, { type: 'turned', amount: SHOW_START_GOAL }); say();
    expect(flow.over).toBe(false);
    flow = play(flow, { type: 'shown' });
    expect(flow.over).toBe(true);
    expect(seen).toEqual([
      'pistonCh:turnIt', 'pistonCh:lookIn', 'pistonCh:testJoint', 'flowerCh:pickUp', 'flowerCh:turnIt', 'flowerCh:lookIn',
      'waveCh:pickUp', 'waveCh:lookIn', 'finaleCh:pickUp', 'finaleCh:turnIt', 'finaleCh:bigShow',
    ]);
    expect(chaptersDone(flow)).toEqual({ pistonCh: true, flowerCh: true, waveCh: true, finaleCh: true });
    expect(flowReduce(flow, turn)).toBe(flow);
  });
  it('only what the step asks for moves it on; nothing else is ever a miss', () => {
    const start = FLOW_START;
    for (const event of [{ type: 'tested' }, { type: 'placed' }, { type: 'shown' }, { type: 'turned', amount: 0 }] as FlowEvent[]) expect(flowReduce(start, event)).toBe(start);
    const looking = play(start, turn);
    expect(flowReduce(looking, turn)).toBe(looking);
    expect(flowReduce(looking, { type: 'tested' })).toBe(looking);
    // The same part twice is one part; the look ends only when every part of this machine is named.
    const one = play(looking, { type: 'met', part: 'rodBar' }, { type: 'met', part: 'rodBar' });
    expect(one.met).toEqual(['rodBar']); expect(stepOf(one)).toBe('lookIn'); expect(partsLeft(one)).toEqual(['crankArm', 'pistonHead']);
  });
  it('a whole turn may be made of small pieces, either way round', () => {
    let flow = FLOW_START;
    for (let i = 0; i < 23; i++) flow = flowReduce(flow, { type: 'turned', amount: i % 2 ? -KEY_STEP : KEY_STEP });
    expect(stepOf(flow)).toBe('turnIt'); expect(flow.hand).toBeCloseTo(23 * KEY_STEP, 9);
    flow = flowReduce(flow, { type: 'turned', amount: KEY_STEP });
    expect(stepOf(flow)).toBe('lookIn'); expect(flow.hand).toBe(0);
    expect(HAND_TURN_GOAL).toBeCloseTo(TAU, 12);
    // With motion reduced, four gentle pushes are one whole turn.
    expect(play(FLOW_START, ...Array.from({ length: 4 }, (): FlowEvent => ({ type: 'turned', amount: CALM_PUSH }))).step).toBe(1);
  });
  it('a part of an earlier machine can be named later without disturbing the step in play', () => {
    const picking = play(FLOW_START, turn, { type: 'met', part: 'crankArm' }, { type: 'met', part: 'rodBar' }, { type: 'met', part: 'pistonHead' }, { type: 'tested' });
    expect(stepOf(picking)).toBe('pickUp');
    const early = flowReduce(picking, { type: 'met', part: 'camDisc' });
    expect(stepOf(early)).toBe('pickUp'); expect(early.met).toContain('camDisc');
    // The cam was already named: the flower's look then needs only the follower.
    const looking = play(early, { type: 'placed' }, turn);
    expect(partsLeft(looking)).toEqual(['follower']);
    expect(play(looking, { type: 'met', part: 'follower' }).chapter).toBe('waveCh');
  });
  it('every chapter has steps, and every hidden part belongs to one chapter', () => {
    for (const chapter of CHAPTERS) expect(CHAPTER_STEPS[chapter].length).toBe(3);
    expect(new Set(ALL_PARTS).size).toBe(ALL_PARTS.length);
    expect(ALL_PARTS.length).toBe(6);
    expect(chaptersDone(FLOW_START)).toEqual({ pistonCh: false, flowerCh: false, waveCh: false, finaleCh: false });
  });
});

describe('the lens names the part it rests on', () => {
  const anchors = [{ part: 'crankArm', x: 0, y: 0 }, { part: 'rodBar', x: 0, y: -40 }, { part: 'pistonHead', x: 0, y: -90 }] as const;
  it('picks the nearest part within reach, or none', () => {
    expect(nearestPart({ x: 3, y: -4 }, anchors, 20)).toBe('crankArm');
    expect(nearestPart({ x: 2, y: -30 }, anchors, 20)).toBe('rodBar');
    expect(nearestPart({ x: 60, y: -90 }, anchors, 20)).toBeNull();
    expect(nearestPart({ x: 0, y: -90 }, [], 20)).toBeNull();
  });
});

describe('play again is not the same again', () => {
  it('a seed always gives the same visit, and visits differ', () => {
    expect(planOf(7)).toEqual(planOf(7));
    const plans = Array.from({ length: 40 }, (_, i) => planOf(i + 1));
    expect(new Set(plans.map(p => p.enamel)).size).toBe(ENAMELS);
    expect(new Set(plans.map(p => p.bloom)).size).toBe(BLOOMS);
    expect(new Set(plans.map(p => p.beads.join(''))).size).toBeGreaterThan(10);
    expect(new Set(plans.map(p => p.tune.join(''))).size).toBe(TUNES.length);
    for (const p of plans) {
      expect([...p.beads].sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(p.tune.length).toBe(WAVE_RODS);
      // The wheel rests with the piston low, so the first turn lifts it.
      expect(strokeFraction(p.rest)).toBeLessThan(0.3);
    }
    for (const tune of TUNES) expect(tune.length).toBe(WAVE_RODS);
  });
});
