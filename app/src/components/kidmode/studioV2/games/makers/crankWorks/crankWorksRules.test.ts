import { describe, expect, it } from 'vitest';
import {
  BOTTOM_DEAD_CENTRE, DETENTS, FEED, HAND_TURN_GOAL, KEY_STEP, LINKAGE, LOAD, MACHINES, MACHINE_PARTS, MAX_HAND_OMEGA, PUSH_OMEGA, SPEED_OMEGA, START, TAU, TOP_DEAD_CENTRE, TRACE_BINS, WAVE_LENGTH,
  advance, angleDelta, badgesOf, canFinish, canSelect, carrySelection, clampOmega, crankPin, cueFor, detentSteps, detentsCrossed, easeMotor, follow, hiddenByCase, liftSlope, loadTurn, lookedInside, metPart,
  partsMet, pistonLift, pointerAngle, push, releaseSpeed, rodLean, rodLength, sawMachine, spinEnergy, startOn, strokeFraction, strokeOf, strokePlace, sweepBins, swing, topCentresCrossed,
  traceBin, turnedByHand, waveReach, wrapAngle, wristPin, writeInk, type Linkage, type Spin,
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

describe('the parts and the case', () => {
  it('the case hides the inside and leaves the wheel and the top of the stroke in sight', () => {
    expect(MACHINE_PARTS.engine.filter(p => hiddenByCase('engine', p))).toEqual(['crank', 'rod', 'piston', 'cylinder']);
    expect(MACHINE_PARTS.toy.filter(p => hiddenByCase('toy', p))).toEqual(['crank', 'rod']);
    expect(MACHINE_PARTS.writer.filter(p => hiddenByCase('writer', p))).toEqual(['crank', 'rod']);
    expect(hiddenByCase('engine', 'wheel')).toBe(false); expect(hiddenByCase('toy', 'bloom')).toBe(false); expect(hiddenByCase('toy', 'handle')).toBe(false); expect(hiddenByCase('writer', 'tracer')).toBe(false);
    // Every machine is the same idea: each has the crank and the rod.
    for (const m of MACHINES) { expect(MACHINE_PARTS[m]).toContain('crank'); expect(MACHINE_PARTS[m]).toContain('rod'); }
  });
  it('parts are met only with the case open, and only parts of the machine in view', () => {
    expect(canSelect('engine', 'piston', false)).toBe(false);
    expect(canSelect('engine', 'piston', true)).toBe(true);
    expect(canSelect('engine', 'bloom', true)).toBe(false); expect(canSelect('writer', 'tracer', true)).toBe(true);
    expect(canSelect('toy', 'handle', true)).toBe(true);
    expect(canSelect('toy', null, true)).toBe(false);
  });
  it('switching machine keeps the crank or rod selected and lets go of the rest', () => {
    expect(carrySelection('crank', 'toy')).toBe('crank'); expect(carrySelection('rod', 'engine')).toBe('rod');
    expect(carrySelection('piston', 'toy')).toBeNull(); expect(carrySelection('bloom', 'engine')).toBeNull(); expect(carrySelection(null, 'toy')).toBeNull();
    expect(carrySelection('wheel', 'writer')).toBe('wheel'); expect(carrySelection('rod', 'writer')).toBe('rod');
  });
});

describe('the gentle arc to Done', () => {
  it('lights three badges, then needs both machines', () => {
    let e = START;
    expect(badgesOf(e)).toEqual({ turned: false, inside: false, parts: false });
    expect(cueFor(e, false, 'engine')).toBe('turn');
    e = turnedByHand(e, HAND_TURN_GOAL / 2); expect(badgesOf(e).turned).toBe(false);
    e = turnedByHand(e, -HAND_TURN_GOAL / 2); expect(badgesOf(e).turned).toBe(true);
    expect(cueFor(e, false, 'engine')).toBe('look');
    e = lookedInside(e); expect(cueFor(e, true, 'engine')).toBe('meet');
    for (const p of MACHINE_PARTS.engine.slice(0, 4)) e = metPart(e, p);
    expect(cueFor(e, true, 'engine')).toBe('more');
    e = metPart(metPart(e, 'cylinder'), 'cylinder');
    expect(e.met.filter(p => p === 'cylinder')).toHaveLength(1);
    expect(badgesOf(e)).toEqual({ turned: true, inside: true, parts: true });
    expect(canFinish(e)).toBe(false);
    expect(cueFor(e, true, 'engine')).toBe('other');
    e = sawMachine(e, 'toy'); expect(canFinish(e)).toBe(true); expect(cueFor(e, true, 'toy')).toBe('ready');
  });
  it('the crank and rod met in one machine count in the other', () => {
    expect(partsMet(['handle', 'bloom'])).toBe(false);
    expect(partsMet(['crank', 'rod', 'handle', 'bloom'])).toBe(true);
    expect(partsMet(['crank', 'rod', 'wheel', 'tracer'])).toBe(true);
    expect(partsMet(['crank', 'rod', 'wheel', 'piston'])).toBe(false);
  });
  it('seeing both machines without the badges is not enough', () => {
    expect(canFinish(sawMachine(START, 'toy'))).toBe(false);
    expect(canFinish(sawMachine(sawMachine(START, 'toy'), 'writer'))).toBe(false);
  });
  it('any two of the three machines show the idea twice, wherever the visit began', () => {
    let e = startOn('writer');
    expect(e.seen).toEqual(['writer']); expect(cueFor(e, false, 'writer')).toBe('turn');
    e = lookedInside(turnedByHand(e, HAND_TURN_GOAL));
    for (const p of MACHINE_PARTS.writer) e = metPart(e, p);
    expect(canFinish(e)).toBe(false); expect(cueFor(e, true, 'writer')).toBe('other');
    e = sawMachine(e, 'engine');
    expect(canFinish(e)).toBe(true); expect(cueFor(e, true, 'engine')).toBe('ready');
    expect(START.seen).toEqual(['engine']);
  });
});

describe('the motion traces', () => {
  it('marks the slices of the circle the crank pin swept', () => {
    expect(traceBin(0)).toBe(0); expect(traceBin(TAU - 1e-9)).toBe(TRACE_BINS - 1); expect(traceBin(-0.01)).toBe(TRACE_BINS - 1);
    const quarter = sweepBins([], 0, TAU / 4);
    expect(quarter.filter(Boolean).length).toBeGreaterThanOrEqual(TRACE_BINS / 4);
    expect(quarter.filter(Boolean).length).toBeLessThanOrEqual(TRACE_BINS / 4 + 1);
    expect(sweepBins([], 1, 1 + 10 * TAU).every(Boolean)).toBe(true);
    expect(sweepBins([], 0.5, 0.2).filter(Boolean).length).toBeGreaterThan(1);
  });
});

describe('the wave writer', () => {
  it('the glass slides one wave for every turn, however fast the wheel goes', () => {
    expect(FEED * TAU).toBeCloseTo(WAVE_LENGTH, 12);
    expect(waveReach(2, 2)).toBe(0);
    expect(waveReach(2, 2 + TAU)).toBeCloseTo(WAVE_LENGTH, 12);
    expect(waveReach(2 + TAU, 2)).toBeCloseTo(-WAVE_LENGTH, 12); // turned back, the line is on the other side of the pen
    // The line is the lift written against the angle: one wave on, the same height again.
    for (const at of [0.4, 2.2, 5]) expect(pistonLift(at + TAU)).toBeCloseTo(pistonLift(at), 9);
  });
  it('the pen paints its ink over the stretch it passes, joining and covering', () => {
    let marks = writeInk([], 0, 1, 0);
    expect(marks).toEqual([{ from: 0, to: 1, ink: 0 }]);
    marks = writeInk(marks, 1, 2.5, 0);
    expect(marks).toEqual([{ from: 0, to: 2.5, ink: 0 }]);
    marks = writeInk(marks, 2.5, 4, 1);
    expect(marks).toEqual([{ from: 0, to: 2.5, ink: 0 }, { from: 2.5, to: 4, ink: 1 }]);
    // Turning back in a new ink repaints the middle and leaves both ends.
    marks = writeInk(marks, 3, 1, 2);
    expect(marks).toEqual([{ from: 0, to: 1, ink: 0 }, { from: 1, to: 3, ink: 2 }, { from: 3, to: 4, ink: 1 }]);
    // Going over a stretch again in its own ink changes nothing.
    expect(writeInk(marks, 1.2, 2.8, 2)).toEqual(marks);
    expect(writeInk(marks, 2, 2, 1)).toEqual(marks);
    for (let i = 1; i < marks.length; i++) expect(marks[i].from).toBeGreaterThanOrEqual(marks[i - 1].to);
  });
  it('remembers only the line near the pen', () => {
    let marks = writeInk([], 0, 1, 0, 10);
    marks = writeInk(marks, 1, 30, 0, 10);
    expect(marks).toEqual([{ from: 20, to: 30, ink: 0 }]);
  });
});
