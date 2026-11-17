/** Rover Delivery rules, proved by running every setting of every floor: no
 * floor is solved before the child changes something, each has exactly one
 * answer, and no setting of the signs can keep the rover driving for ever. */
import { describe, expect, it } from 'vitest';
import { ARRIVED_MS, HEADINGS, HINT_AFTER, OOPS_MS, PRESS_MS, RETURN_MS, ROVER_ROUNDS, ROVER_SPINS, STEP_MS, cellColumn, cellRow, faceToward, fixSigns, headingOf, initialSigns, initialTurns, isHeading, levelFor, quarterTurn, roverAtStart, roverHint, roverStep, roverTone, runRover, spinLevel, turnsOf, type Heading, type RoverEnd, type RoverLevel } from './roverDeliveryRules';

const CHALLENGES = ['gentle', 'explore'] as const;
const ROUNDS = [0, 1, 2] as const;
const FLOORS = CHALLENGES.flatMap(challenge => ROUNDS.map(round => ({ name: `${challenge} ${round + 1}`, challenge, round, level: levelFor(challenge, round) })));
const ENDS: readonly RoverEnd[] = ['goal', 'edge', 'planter', 'bloom', 'loop'];

/** Every way the signs of a floor can be set: four to the power of its signs. */
function settings(level: RoverLevel): Heading[][] {
  return level.signs.reduce<Heading[][]>((all) => all.flatMap(set => HEADINGS.map(heading => [...set, heading])), [[]]);
}
/** Every setting of a floor with its flower open and folded. */
function everyPlan(level: RoverLevel): { dirs: Heading[]; folded: boolean }[] {
  return settings(level).flatMap(dirs => [false, true].map(folded => ({ dirs, folded })));
}
/** The same run worked out a second way, by row and column, as a check on the rules. */
function walk(level: RoverLevel, dirs: readonly Heading[], folded: boolean): { path: number[]; end: RoverEnd; at: number } {
  const delta: Record<Heading, readonly [number, number]> = { n: [-1, 0], e: [0, 1], s: [1, 0], w: [0, -1] };
  let row = Math.floor(level.start / level.size), column = level.start % level.size, heading = level.heading;
  const path = [level.start], seen = new Set<string>([`${row},${column},${heading}`]);
  for (let steps = 0; steps < 10_000; steps++) {
    const toRow = row + delta[heading][0], toColumn = column + delta[heading][1], here = row * level.size + column;
    if (toRow < 0 || toColumn < 0 || toRow >= level.size || toColumn >= level.size) return { path, end: 'edge', at: here };
    const next = toRow * level.size + toColumn;
    if (level.planters.includes(next)) return { path, end: 'planter', at: here };
    if (level.bloom === next && !folded) return { path, end: 'bloom', at: here };
    row = toRow; column = toColumn; path.push(next);
    const sign = level.signs.findIndex(item => item.cell === next);
    if (sign >= 0) heading = dirs[sign];
    if (next === level.goal) return { path, end: 'goal', at: next };
    const state = `${row},${column},${heading}`;
    if (seen.has(state)) return { path, end: 'loop', at: next };
    seen.add(state);
  }
  throw new Error('the check walk ran on');
}
/** Taps from the first setting to the answer: quarter turns clockwise, and one for the flower. */
function tapsToFix(level: RoverLevel): number {
  return level.signs.reduce((sum, sign) => sum + (turnsOf(sign.fix) - turnsOf(sign.initial) + 4) % 4, 0) + (level.bloom === undefined ? 0 : 1);
}
/** How many things on the floor are not yet as the answer needs them. */
function thingsToChange(level: RoverLevel): number {
  return level.signs.filter(sign => sign.initial !== sign.fix).length + (level.bloom === undefined ? 0 : 1);
}
function make(level: Partial<RoverLevel> & Pick<RoverLevel, 'size' | 'start' | 'heading' | 'goal'>): RoverLevel {
  return { signs: [], planters: [], ...level };
}

describe('Rover Delivery floors', () => {
  it('has three floors in each adventure: 3 by 3 with 1, 1 and 2 signs, then 4 by 4 with 2, 2 and 3', () => {
    expect(ROVER_ROUNDS).toBe(3); expect(FLOORS).toHaveLength(6);
    expect(ROUNDS.map(round => levelFor('gentle', round).size)).toEqual([3, 3, 3]);
    expect(ROUNDS.map(round => levelFor('explore', round).size)).toEqual([4, 4, 4]);
    expect(ROUNDS.map(round => levelFor('gentle', round).signs.length)).toEqual([1, 1, 2]);
    expect(ROUNDS.map(round => levelFor('explore', round).signs.length)).toEqual([2, 2, 3]);
    // One flower in the whole game, on the last floor of the bigger adventure.
    expect(FLOORS.filter(floor => floor.level.bloom !== undefined).map(floor => floor.name)).toEqual(['explore 3']);
    expect(levelFor('explore', 1).planters.length).toBeGreaterThanOrEqual(2);
    expect(new Set(FLOORS.map(floor => JSON.stringify(floor.level))).size).toBe(6);
  });

  it('clamps a round that is not one of the three', () => {
    for (const challenge of CHALLENGES) {
      expect(levelFor(challenge, -1)).toBe(levelFor(challenge, 0)); expect(levelFor(challenge, 3)).toBe(levelFor(challenge, 2));
      expect(levelFor(challenge, 99)).toBe(levelFor(challenge, 2)); expect(levelFor(challenge, 1.5)).toBe(levelFor(challenge, 0));
      expect(levelFor(challenge, Number.NaN)).toBe(levelFor(challenge, 0)); expect(levelFor(challenge, 1)).toBe(levelFor(challenge, 1));
    }
  });

  it.each(FLOORS)('$name is well formed: every toy on its own cell of the floor', ({ level }) => {
    const cells = level.size * level.size;
    const things = [level.start, level.goal, ...level.signs.map(sign => sign.cell), ...level.planters, ...(level.bloom === undefined ? [] : [level.bloom])];
    for (const cell of things) { expect(Number.isInteger(cell)).toBe(true); expect(cell).toBeGreaterThanOrEqual(0); expect(cell).toBeLessThan(cells); }
    expect(new Set(things).size).toBe(things.length);
    expect(isHeading(level.heading)).toBe(true);
    for (const sign of level.signs) { expect(isHeading(sign.initial)).toBe(true); expect(isHeading(sign.fix)).toBe(true); }
    // The rover can always leave its start: a first press is never a dead stop.
    const first = roverStep(level.start, level.heading, level.size);
    expect(first).toBeGreaterThanOrEqual(0); expect(level.planters).not.toContain(first); expect(first).not.toBe(level.bloom);
  });

  it.each(FLOORS)('$name: the first setting does not reach the rug, and the fix does', ({ level }) => {
    for (const folded of [false, true]) {
      const first = runRover(level, initialSigns(level), folded);
      expect(first.end).not.toBe('goal'); expect(first.at).not.toBe(level.goal); expect(first.path).not.toContain(level.goal);
    }
    const fixed = runRover(level, fixSigns(level), true);
    expect(fixed.end).toBe('goal'); expect(fixed.at).toBe(level.goal); expect(fixed.path[0]).toBe(level.start); expect(fixed.path.at(-1)).toBe(level.goal);
    // The finished route is one clean line: no cell twice, every sign and the flower on it, in order.
    expect(new Set(fixed.path).size).toBe(fixed.path.length);
    const met = fixed.path.filter(cell => level.signs.some(sign => sign.cell === cell));
    expect(met).toEqual(level.signs.map(sign => sign.cell));
    if (level.bloom !== undefined) expect(fixed.path).toContain(level.bloom);
    for (const planter of level.planters) expect(fixed.path).not.toContain(planter);
    // Without a flower, folding changes nothing.
    if (level.bloom === undefined) expect(runRover(level, fixSigns(level), false)).toEqual(fixed);
  });

  it.each(FLOORS)('$name has exactly one setting that reaches the rug', ({ level }) => {
    const winners = everyPlan(level).filter(plan => runRover(level, plan.dirs, plan.folded).end === 'goal');
    const answers = [...new Set(winners.map(plan => plan.dirs.join('')))];
    expect(answers).toEqual([fixSigns(level).join('')]);
    expect(winners.map(plan => plan.folded)).toEqual(level.bloom === undefined ? [false, true] : [true]);
    expect(settings(level)).toHaveLength(4 ** level.signs.length);
  });

  it.each(FLOORS)('$name: no setting of the signs can run for ever, flower open or folded', ({ level }) => {
    const limit = level.size * level.size * 4, seenEnds = new Set<RoverEnd>();
    for (const { dirs, folded } of everyPlan(level)) {
      const run = runRover(level, dirs, folded), label = `${dirs.join('')} ${folded}`;
      expect(ENDS, label).toContain(run.end); seenEnds.add(run.end);
      expect(run.path.length - 1, label).toBeLessThanOrEqual(limit);
      expect(run.headings, label).toHaveLength(run.path.length); expect(run.path[0]).toBe(level.start); expect(run.at).toBe(run.path.at(-1));
      // Each step is one cell along the heading the rover had on the cell before.
      for (let move = 1; move < run.path.length; move++) expect(run.path[move], label).toBe(roverStep(run.path[move - 1], run.headings[move - 1], level.size));
      const states = run.path.map((cell, index) => `${cell}:${run.headings[index]}`);
      if (run.end === 'loop') {
        // A circle is called the first time a cell is met again facing the same way.
        expect(states.indexOf(states.at(-1)!), label).toBeLessThan(states.length - 1);
        expect(new Set(states.slice(0, -1)).size, label).toBe(states.length - 1);
      } else expect(new Set(states).size, label).toBe(states.length);
      if (run.end === 'goal') expect(run.at).toBe(level.goal); else expect(run.path).not.toContain(level.goal);
      // The same answer from a second way of working it out.
      const check = walk(level, dirs, folded);
      expect({ path: run.path, end: run.end, at: run.at }, label).toEqual(check);
    }
    expect(seenEnds.has('goal')).toBe(true); expect(seenEnds.has('edge')).toBe(true);
  });

  it('with the flower open, the rug cannot be reached under any setting of the signs', () => {
    const level = levelFor('explore', 2);
    expect(level.bloom).toBe(11); expect(settings(level)).toHaveLength(64);
    for (const dirs of settings(level)) {
      const run = runRover(level, dirs, false);
      expect(run.end, dirs.join('')).not.toBe('goal'); expect(run.path, dirs.join('')).not.toContain(level.bloom);
    }
    // The answer for the signs, with the flower still open, parks right before it.
    expect(runRover(level, fixSigns(level), false)).toMatchObject({ end: 'bloom', at: 7 });
    expect(runRover(level, fixSigns(level), true).end).toBe('goal');
  });

  it('climbs gently: one thing to change on each little floor, then one, two and three', () => {
    expect(ROUNDS.map(round => thingsToChange(levelFor('gentle', round)))).toEqual([1, 1, 1]);
    expect(ROUNDS.map(round => thingsToChange(levelFor('explore', round)))).toEqual([1, 2, 3]);
    expect(ROUNDS.map(round => tapsToFix(levelFor('gentle', round)))).toEqual([1, 2, 1]);
    expect(ROUNDS.map(round => tapsToFix(levelFor('explore', round)))).toEqual([1, 2, 3]);
    // The finished routes, in cells driven.
    expect(FLOORS.map(floor => runRover(floor.level, fixSigns(floor.level), true).path.length - 1)).toEqual([4, 2, 6, 5, 5, 10]);
    // A floor with two signs before the last one always has one sign that is already right.
    expect(levelFor('gentle', 2).signs.filter(sign => sign.initial === sign.fix)).toHaveLength(1);
    expect(levelFor('explore', 0).signs.filter(sign => sign.initial === sign.fix)).toHaveLength(1);
  });

  it('shows each floor as written: where the first run parks, and what each change does', () => {
    expect(runRover(levelFor('gentle', 0), ['n'], false)).toEqual({ path: [6, 3, 0], headings: ['n', 'n', 'n'], end: 'edge', at: 0 });
    expect(runRover(levelFor('gentle', 0), ['e'], false)).toEqual({ path: [6, 3, 0, 1, 2], headings: ['n', 'n', 'e', 'e', 'e'], end: 'goal', at: 2 });
    expect(runRover(levelFor('gentle', 0), ['s'], false)).toMatchObject({ path: [6, 3, 0, 3, 6], end: 'edge', at: 6 });
    // One tap on the second floor meets the planter; the second tap is the answer.
    expect(runRover(levelFor('gentle', 1), ['n'], false)).toMatchObject({ path: [3, 4, 1], end: 'edge', at: 1 });
    expect(runRover(levelFor('gentle', 1), ['e'], false)).toMatchObject({ path: [3, 4], end: 'planter', at: 4 });
    expect(runRover(levelFor('gentle', 1), ['s'], false)).toMatchObject({ path: [3, 4, 7], end: 'goal', at: 7 });
    expect(runRover(levelFor('gentle', 2), ['e', 'e'], false)).toMatchObject({ path: [6, 3, 0, 1, 2], end: 'edge', at: 2 });
    expect(runRover(levelFor('gentle', 2), ['e', 's'], false)).toMatchObject({ path: [6, 3, 0, 1, 2, 5, 8], end: 'goal', at: 8 });
    expect(runRover(levelFor('gentle', 2), ['e', 'w'], false)).toMatchObject({ path: [6, 3, 0, 1, 2, 1, 0], end: 'loop', at: 0 });
    expect(runRover(levelFor('explore', 0), ['n', 'n'], false)).toMatchObject({ path: [12, 13, 9, 5, 1], end: 'edge', at: 1 });
    expect(runRover(levelFor('explore', 0), ['n', 'e'], false)).toMatchObject({ path: [12, 13, 9, 5, 6, 7], end: 'goal', at: 7 });
    // The wall of planters: straight on parks at it, one turn makes a circle, the second turn is the answer.
    expect(runRover(levelFor('explore', 1), ['e', 'n'], false)).toMatchObject({ path: [4, 5], end: 'planter', at: 5 });
    expect(runRover(levelFor('explore', 1), ['s', 'n'], false)).toMatchObject({ path: [4, 5, 9, 13, 9, 5], end: 'loop', at: 5 });
    expect(runRover(levelFor('explore', 1), ['s', 'e'], false)).toMatchObject({ path: [4, 5, 9, 13, 14, 15], end: 'goal', at: 15 });
    // The last floor: a sign, then the flower, then one more sign.
    const last = levelFor('explore', 2);
    expect(runRover(last, ['e', 'e', 's'], false)).toMatchObject({ path: [12, 8, 4, 0, 1, 2, 3], end: 'edge', at: 3 });
    expect(runRover(last, ['e', 's', 's'], false)).toMatchObject({ path: [12, 8, 4, 0, 1, 2, 3, 7], end: 'bloom', at: 7 });
    expect(runRover(last, ['e', 's', 's'], true)).toMatchObject({ path: [12, 8, 4, 0, 1, 2, 3, 7, 11, 15], end: 'edge', at: 15 });
    expect(runRover(last, ['e', 's', 'w'], true)).toMatchObject({ path: [12, 8, 4, 0, 1, 2, 3, 7, 11, 15, 14], end: 'goal', at: 14 });
  });
});

describe('Rover Delivery runs', () => {
  it('drives straight to the rug, or parks on the last cell of the floor', () => {
    expect(runRover(make({ size: 3, start: 0, heading: 'e', goal: 2 }), [], false)).toEqual({ path: [0, 1, 2], headings: ['e', 'e', 'e'], end: 'goal', at: 2 });
    expect(runRover(make({ size: 3, start: 3, heading: 'e', goal: 8 }), [], false)).toEqual({ path: [3, 4, 5], headings: ['e', 'e', 'e'], end: 'edge', at: 5 });
    // Already against the wall: it parks where it stands.
    expect(runRover(make({ size: 3, start: 0, heading: 'n', goal: 8 }), [], false)).toEqual({ path: [0], headings: ['n'], end: 'edge', at: 0 });
    expect(runRover(make({ size: 4, start: 15, heading: 'w', goal: 0 }), [], false)).toMatchObject({ path: [15, 14, 13, 12], end: 'edge', at: 12 });
  });

  it('parks on the cell before a planter and before an open flower, and rolls over a folded one', () => {
    const planter = make({ size: 3, start: 0, heading: 'e', goal: 2, planters: [1] });
    expect(runRover(planter, [], false)).toEqual({ path: [0], headings: ['e'], end: 'planter', at: 0 });
    expect(runRover(planter, [], true).end).toBe('planter');
    const bloom = make({ size: 3, start: 0, heading: 'e', goal: 2, bloom: 1 });
    expect(runRover(bloom, [], false)).toEqual({ path: [0], headings: ['e'], end: 'bloom', at: 0 });
    expect(runRover(bloom, [], true)).toEqual({ path: [0, 1, 2], headings: ['e', 'e', 'e'], end: 'goal', at: 2 });
  });

  it('turns on a sign cell, and a sign on the start cell sets the first heading', () => {
    const level = make({ size: 3, start: 0, heading: 'e', goal: 8, signs: [{ cell: 2, initial: 'e', fix: 's' }] });
    expect(runRover(level, ['s'], false)).toEqual({ path: [0, 1, 2, 5, 8], headings: ['e', 'e', 's', 's', 's'], end: 'goal', at: 8 });
    expect(runRover(level, ['w'], false)).toMatchObject({ path: [0, 1, 2, 1, 0], end: 'edge', at: 0 });
    const onStart = make({ size: 3, start: 0, heading: 'n', goal: 6, signs: [{ cell: 0, initial: 'n', fix: 's' }] });
    expect(runRover(onStart, ['s'], false)).toEqual({ path: [0, 3, 6], headings: ['s', 's', 's'], end: 'goal', at: 6 });
    expect(runRover(onStart, ['n'], false).end).toBe('edge');
  });

  it('calls a circle and stops: two signs facing each other, and four signs in a ring', () => {
    const facing = make({ size: 3, start: 3, heading: 'e', goal: 8, signs: [{ cell: 5, initial: 'w', fix: 's' }, { cell: 4, initial: 'e', fix: 'e' }] });
    expect(runRover(facing, ['w', 'e'], false)).toEqual({ path: [3, 4, 5, 4], headings: ['e', 'e', 'w', 'e'], end: 'loop', at: 4 });
    const ring = make({ size: 3, start: 3, heading: 'n', goal: 8, signs: [{ cell: 0, initial: 'e', fix: 'e' }, { cell: 1, initial: 's', fix: 's' }, { cell: 4, initial: 'w', fix: 'w' }, { cell: 3, initial: 'n', fix: 'n' }] });
    expect(runRover(ring, ['e', 's', 'w', 'n'], false)).toMatchObject({ path: [3, 0, 1, 4, 3], end: 'loop', at: 3 });
    // Crossing a cell again facing another way is not a circle.
    const cross = make({ size: 3, start: 3, heading: 'e', goal: 7, signs: [{ cell: 5, initial: 'n', fix: 'n' }, { cell: 2, initial: 'w', fix: 'w' }, { cell: 1, initial: 's', fix: 's' }] });
    expect(runRover(cross, ['n', 'w', 's'], false)).toMatchObject({ path: [3, 4, 5, 2, 1, 4, 7], end: 'goal', at: 7 });
  });

  it('keeps a sign as first set when no valid direction is given for it', () => {
    const level = levelFor('gentle', 2);
    expect(runRover(level, [], false)).toEqual(runRover(level, initialSigns(level), false));
    expect(runRover(level, ['e'], false)).toEqual(runRover(level, ['e', 'e'], false));
    expect(runRover(level, ['x', 7, null] as unknown as Heading[], false)).toEqual(runRover(level, initialSigns(level), false));
    expect(runRover(level, ['e', 's', 'w', 'n'], false)).toEqual(runRover(level, ['e', 's'], false));
  });

  it('gives the same run every time and never changes what it is given', () => {
    for (const { level } of FLOORS) {
      const frozen = Object.freeze({ ...level, signs: Object.freeze(level.signs.map(sign => Object.freeze({ ...sign }))), planters: Object.freeze([...level.planters]) }) as RoverLevel;
      for (const { dirs, folded } of everyPlan(level)) {
        const given = Object.freeze([...dirs]) as readonly Heading[];
        const once = runRover(frozen, given, folded), twice = runRover(frozen, given, folded);
        expect(twice).toEqual(once); expect(twice.path).not.toBe(once.path); expect(given).toEqual(dirs);
        expect(runRover(level, dirs, folded)).toEqual(once);
      }
    }
  });
});

describe('Rover Delivery helpers', () => {
  it('turns a sign a quarter clockwise each tap, and back to where it began after four', () => {
    expect(HEADINGS).toEqual(['n', 'e', 's', 'w']);
    expect(HEADINGS.map(quarterTurn)).toEqual(['e', 's', 'w', 'n']);
    for (const heading of HEADINGS) expect(quarterTurn(quarterTurn(quarterTurn(quarterTurn(heading))))).toBe(heading);
    expect(HEADINGS.map(turnsOf)).toEqual([0, 1, 2, 3]);
    for (const heading of HEADINGS) for (const laps of [-2, -1, 0, 1, 5]) expect(headingOf(turnsOf(heading) + 4 * laps)).toBe(heading);
    expect([-1, -2, -3, -4, 4, 5, 6, 7].map(headingOf)).toEqual(['w', 's', 'e', 'n', 'n', 'e', 's', 'w']);
    expect(headingOf(Number.NaN)).toBe('n'); expect(headingOf(Number.POSITIVE_INFINITY)).toBe('n');
    for (const heading of HEADINGS) expect(headingOf(turnsOf(heading) + 1)).toBe(quarterTurn(heading));
    expect(['n', 'e', 's', 'w'].every(isHeading)).toBe(true);
    expect(['N', 'x', '', 'ne', 0, null, undefined].some(isHeading)).toBe(false);
  });

  it('turns the rover the short way round to face a new heading', () => {
    for (let turns = -9; turns <= 9; turns++) for (const heading of HEADINGS) {
      const next = faceToward(turns, heading);
      expect(headingOf(next)).toBe(heading); expect(Math.abs(next - turns)).toBeLessThanOrEqual(2);
      if (headingOf(turns) === heading) expect(next).toBe(turns);
    }
    expect(faceToward(0, 'w')).toBe(-1); expect(faceToward(0, 'e')).toBe(1); expect(faceToward(0, 's')).toBe(2); expect(faceToward(3, 'n')).toBe(4);
    expect(faceToward(-1, 'n')).toBe(0); expect(faceToward(5, 'n')).toBe(4); expect(faceToward(Number.NaN, 'e')).toBe(1);
  });

  it('steps one cell along a heading and knows the edges of both floors', () => {
    expect(HEADINGS.map(heading => roverStep(4, heading, 3))).toEqual([1, 5, 7, 3]);
    expect(HEADINGS.map(heading => roverStep(0, heading, 3))).toEqual([-1, 1, 3, -1]);
    expect(HEADINGS.map(heading => roverStep(8, heading, 3))).toEqual([5, -1, -1, 7]);
    expect(HEADINGS.map(heading => roverStep(5, heading, 4))).toEqual([1, 6, 9, 4]);
    expect(HEADINGS.map(heading => roverStep(3, heading, 4))).toEqual([-1, -1, 7, 2]);
    expect(HEADINGS.map(heading => roverStep(12, heading, 4))).toEqual([8, 13, -1, -1]);
    // A row never wraps onto the next one.
    expect(roverStep(2, 'e', 3)).toBe(-1); expect(roverStep(3, 'w', 3)).toBe(-1); expect(roverStep(7, 'e', 4)).toBe(-1); expect(roverStep(8, 'w', 4)).toBe(-1);
    for (const size of [3, 4]) for (let cell = 0; cell < size * size; cell++) {
      expect(cellRow(cell, size) * size + cellColumn(cell, size)).toBe(cell);
      expect(cellColumn(cell, size)).toBeLessThan(size); expect(cellRow(cell, size)).toBeLessThan(size);
      for (const heading of HEADINGS) {
        const next = roverStep(cell, heading, size);
        if (next >= 0) expect(roverStep(next, quarterTurn(quarterTurn(heading)), size)).toBe(cell);
      }
    }
  });

  it('starts every floor from its first setting, with the rover on its start facing its heading', () => {
    for (const { level } of FLOORS) {
      expect(initialSigns(level)).toEqual(level.signs.map(sign => sign.initial)); expect(fixSigns(level)).toEqual(level.signs.map(sign => sign.fix));
      expect(initialTurns(level).map(headingOf)).toEqual(initialSigns(level)); expect(initialTurns(level).every(turns => turns >= 0 && turns <= 3)).toBe(true);
      expect(roverAtStart(level)).toEqual({ cell: level.start, turn: turnsOf(level.heading) });
    }
  });

  it('points out one thing at a time, in the order the route meets them, until the floor is solved', () => {
    for (const { level, name } of FLOORS) {
      // From every setting, changing only what is pointed out reaches the rug.
      for (const plan of everyPlan(level)) {
        const dirs = [...plan.dirs]; let folded = plan.folded, changed = 0;
        for (let hint = roverHint(level, dirs, folded); hint !== null; hint = roverHint(level, dirs, folded)) {
          if (hint === 'bloom') { expect(level.bloom).toBeDefined(); expect(folded).toBe(false); folded = true; }
          else { expect(dirs[hint], name).not.toBe(level.signs[hint].fix); dirs[hint] = level.signs[hint].fix; }
          expect(++changed).toBeLessThanOrEqual(level.signs.length + 1);
        }
        expect(dirs).toEqual(fixSigns(level));
        // A folded flower is never asked to open again, and nothing is pointed out once the signs are right.
        if (level.bloom !== undefined) expect(folded).toBe(true);
        expect(runRover(level, dirs, level.bloom === undefined ? plan.folded : folded).end).toBe('goal');
      }
      // From the first setting it takes exactly as many changes as there are things to change.
      const dirs = initialSigns(level); let folded = false, changes = 0;
      for (let hint = roverHint(level, dirs, folded); hint !== null; hint = roverHint(level, dirs, folded)) { if (hint === 'bloom') folded = true; else dirs[hint] = level.signs[hint].fix; changes++; }
      expect(changes, name).toBe(thingsToChange(level));
    }
    const last = levelFor('explore', 2);
    expect(roverHint(last, ['e', 'e', 's'], false)).toBe(1); expect(roverHint(last, ['e', 's', 's'], false)).toBe('bloom');
    expect(roverHint(last, ['e', 's', 's'], true)).toBe(2); expect(roverHint(last, ['e', 's', 'w'], true)).toBeNull();
    expect(roverHint(last, ['n', 'e', 's'], true)).toBe(0); expect(roverHint(last, ['e', 's', 'w'], false)).toBe('bloom');
    expect(roverHint(levelFor('gentle', 0), ['n'], false)).toBe(0); expect(roverHint(levelFor('gentle', 0), ['e'], false)).toBeNull();
    expect(roverHint(levelFor('gentle', 2), ['e', 'e'], false)).toBe(1); expect(roverHint(levelFor('gentle', 2), ['w', 'w'], false)).toBe(0);
    // A sign that the finished route never meets is still pointed out, last.
    const aside = make({ size: 3, start: 0, heading: 'e', goal: 2, signs: [{ cell: 8, initial: 'n', fix: 's' }] });
    expect(roverHint(aside, ['n'], false)).toBe(0); expect(roverHint(aside, ['s'], false)).toBeNull();
  });

  it('plays a soft tone for each cell, up the six tones and down again', () => {
    const tones = Array.from({ length: 40 }, (_, move) => roverTone(move));
    expect(tones.slice(0, 11)).toEqual([0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0]);
    expect(tones.every(tone => Number.isInteger(tone) && tone >= 0 && tone <= 5)).toBe(true);
    for (let move = 1; move < tones.length; move++) expect(Math.abs(tones[move] - tones[move - 1])).toBe(1);
    expect([-1, -11, 2.9, Number.NaN, Number.POSITIVE_INFINITY].map(roverTone)).toEqual([1, 1, 2, 0, 0]);
  });

  it('keeps the timings of the brief, with a longer welcome at the rug', () => {
    expect(STEP_MS).toBe(420); expect(RETURN_MS).toBe(300); expect(ARRIVED_MS).toBe(3200); expect(OOPS_MS).toBe(700); expect(HINT_AFTER).toBe(2);
    expect(PRESS_MS).toBeGreaterThan(0); expect(PRESS_MS).toBeLessThan(STEP_MS * 2);
    // The longest finished route still runs in a few seconds.
    const longest = Math.max(...FLOORS.map(floor => runRover(floor.level, fixSigns(floor.level), true).path.length));
    expect(RETURN_MS + STEP_MS * longest).toBeLessThan(6000);
  });
});

describe('Rover Delivery replays (B-GAME-46)', () => {
  it('turns every floor a quarter clockwise per play again, and back after four', () => {
    expect(ROVER_SPINS).toBe(4);
    const first = levelFor('gentle', 0);
    expect(levelFor('gentle', 0, 0)).toBe(first);
    expect(levelFor('gentle', 0, 1)).toEqual({ size: 3, start: 0, heading: 'e', goal: 8, signs: [{ cell: 2, initial: 'e', fix: 's' }], planters: [] });
    expect(spinLevel(first, 4)).toEqual(first);
    for (const { level } of FLOORS) expect(spinLevel(spinLevel(level, 1), 3)).toEqual(level);
  });

  it('keeps each turned floor as written: same end for every setting, one answer, unsolved at first, same presses per sign', () => {
    for (const { name, challenge, round, level } of FLOORS) {
      for (let spin = 1; spin < ROVER_SPINS; spin++) {
        const turned = levelFor(challenge, round, spin);
        let answers = 0;
        for (const set of settings(level)) {
          const spun = set.map(heading => { let next = heading; for (let at = 0; at < spin; at++) next = quarterTurn(next); return next; });
          for (const folded of [false, true]) {
            const plain = runRover(level, set, folded), moved = runRover(turned, spun, folded);
            expect(moved.end, `${name} spin ${spin}`).toBe(plain.end);
            expect(moved.path.length, `${name} spin ${spin}`).toBe(plain.path.length);
            if (moved.end === 'goal' && folded) answers += 1;
          }
        }
        expect(answers, `${name} spin ${spin}`).toBeGreaterThan(0);
        expect(runRover(turned, fixSigns(turned), true).end, `${name} spin ${spin}`).toBe('goal');
        expect(runRover(turned, initialSigns(turned), false).end, `${name} spin ${spin}`).not.toBe('goal');
        expect(turned.signs.map(sign => (turnsOf(sign.fix) - turnsOf(sign.initial) + 4) % 4)).toEqual(level.signs.map(sign => (turnsOf(sign.fix) - turnsOf(sign.initial) + 4) % 4));
        expect(roverHint(turned, initialSigns(turned), false)).toEqual(roverHint(level, initialSigns(level), false));
      }
    }
  });
});
