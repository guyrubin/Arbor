import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_SHOWN, BUILD_MODES, CHAPTERS, DIVE_QUEST, FEEL_RANGE, GRIP_Y, HEAD_CONE, LAND_QUEST, LEGS_CONE, LOCK_RADIUS, NONE_SHOWN, PAD_RADIUS, PAINTS, PIECES, PULL_RADIUS, REST, SPIN_FRICTION, SPIN_GOAL, SPIN_MAX,
  attitude, benchLayout, catchOrder, coast, complete, dragDegrees, dropLands, landStart, magnetAt, modeForChallenge, nextLandStep, normRoll, pairSlot, paintForRound, partCentre, partsOf, placeOn, placementCount,
  pushFor, questKeys, seamOf, selfRight, sheathFor, shownParts, squeezeBy, tinyLine, touchHeight, validMode, type BuildMode, type LandStep, type Placed,
} from './tinyBuildersRules';
import {
  DIVE_STOPS, DIVE_THINGS, FRAME_SHARE, LAST_DEPTH, REAL_MICROMETRES, RECORD_REACH, ROD, TOTAL_MAGNIFICATION, canRecord, clampDepth, decade, depthForZoom, depthLimit, diveCamera, diveStep, magnification, pondFor, timesLonger, toScreen,
} from './tinyDive';
import { FIBRE_COUNT, HEAD_FACES, LEG_LOWER, LEG_UPPER, PHAGE, SHEATH_MIN, dnaCoil, fibreAngle, headVertices, legPoints, len, poseAbout, poseMatrix, apply, project, sub, unproject, type View } from './tinyMesh';
import { TINY_BUILDERS_COPY } from './tinyBuildersCopy';
import { TINY_KIT_ART } from './tinyKitArt';
import { COACH_HEADS } from '../play';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = (file: string) => readFileSync(path.join(here, file), 'utf8');
const all = (mode: BuildMode): Placed => PIECES[mode].reduce<Placed>((placed, piece) => placeOn(mode, placed, piece.id)!, []);

describe('Tiny Structures: the parts make the intended structure', () => {
  it('the younger mode has 4 parts and the full mode 7; the age default picks one', () => {
    expect(placementCount('assisted')).toBe(4);
    expect(placementCount('full')).toBe(7);
    expect(modeForChallenge('gentle')).toBe('assisted');
    expect(modeForChallenge('explore')).toBe('full');
    expect(BUILD_MODES.every(validMode)).toBe(true);
    expect(validMode('easy')).toBe(false);
  });
  it.each(BUILD_MODES)('%s: any order builds the whole phage, and a part goes on only once', (mode) => {
    const ids = PIECES[mode].map(p => p.id);
    for (const order of [ids, [...ids].reverse()]) {
      let placed: Placed = [];
      for (const id of order) { expect(complete(mode, placed)).toBe(false); placed = placeOn(mode, placed, id)!; expect(placeOn(mode, placed, id)).toBeNull(); }
      expect(complete(mode, placed)).toBe(true);
      expect(shownParts(mode, placed)).toEqual(ALL_SHOWN);
    }
    expect(placeOn(mode, [], 'wing')).toBeNull();
    expect(shownParts(mode, [])).toEqual(NONE_SHOWN);
  });
  it('a pair is two opposite legs, and the three pairs fill the six places in the order they come', () => {
    expect(partsOf('fibrePair', 1).fibres).toEqual([false, true, false, false, true, false]);
    expect(partsOf('fibres').fibres.every(Boolean)).toBe(true);
    let placed: Placed = [];
    for (const [n, id] of ['pair-2', 'pair-0', 'pair-1'].entries()) { expect(pairSlot('full', placed, id)).toBe(n); placed = placeOn('full', placed, id)!; expect(pairSlot('full', placed, id)).toBe(n); }
    expect(shownParts('full', placed).fibres.every(Boolean)).toBe(true);
    expect(shownParts('full', ['pair-1']).fibres).toEqual([true, false, false, true, false, false]);
  });
  it('the tail-and-collar part is both; every part has a middle on the axis and a seam at its joint', () => {
    expect(partsOf('tailCollar')).toMatchObject({ tail: true, collar: true, head: false, baseplate: false });
    for (const kind of Object.keys(REST) as (keyof typeof REST)[]) {
      const c = partCentre(kind), seam = seamOf(kind);
      expect(c[0]).toBe(0); expect(c[2]).toBe(0); expect(c[1]).toBeGreaterThan(0); expect(c[1]).toBeLessThan(PHAGE.height);
      expect(seam.r).toBeGreaterThan(0); expect(seam.y).toBeGreaterThanOrEqual(0); expect(seam.y).toBeLessThan(PHAGE.height);
    }
    expect(seamOf('head').y).toBe(PHAGE.head.y0);
  });
});

describe('Tiny Structures: the magnet', () => {
  it.each(BUILD_MODES)('%s: no pull far away, more as the part nears, held fast inside the lock', (mode) => {
    expect(magnetAt(mode, PULL_RADIUS[mode] + 1)).toEqual({ pull: 0, lock: false });
    let last = 0;
    for (let d = PULL_RADIUS[mode]; d >= 0; d -= 0.2) { const m = magnetAt(mode, d); expect(m.pull).toBeGreaterThanOrEqual(last); last = m.pull; }
    expect(magnetAt(mode, LOCK_RADIUS[mode]).lock).toBe(true);
    expect(magnetAt(mode, 0).pull).toBe(1);
    expect(magnetAt(mode, Number.NaN).pull).toBe(0);
  });
  it('the younger mode is easier: its magnet reaches further and takes the part sooner', () => {
    expect(PULL_RADIUS.assisted).toBeGreaterThan(PULL_RADIUS.full);
    expect(LOCK_RADIUS.assisted).toBeGreaterThan(LOCK_RADIUS.full);
    expect(dropLands('assisted', 7)).toBe(true);
    expect(dropLands('full', 7)).toBe(false);
    expect(dropLands('full', 3)).toBe(true);
  });
});

describe('Tiny Structures: the parts on the bench', () => {
  it.each(BUILD_MODES)('%s: every part lies clear of the turntable and of every other part, both ways round the screen', (mode) => {
    for (const orient of ['portrait', 'landscape'] as const) for (const seed of [1, 7, 4242, 99991]) {
      const spots = Object.values(benchLayout(mode, orient, seed));
      expect(spots).toHaveLength(placementCount(mode));
      for (const s of spots) expect(Math.hypot(s.x, s.z), `${orient} ${seed}`).toBeGreaterThan(PAD_RADIUS + 1);
      for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThan(1.6);
      if (orient === 'portrait') for (const s of spots) expect(Math.abs(s.x)).toBeLessThan(8.4);
    }
  });
  it('the same seed lays the bench the same way; another seed lays it afresh', () => {
    expect(benchLayout('full', 'portrait', 12)).toEqual(benchLayout('full', 'portrait', 12));
    const layouts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(seed => JSON.stringify(benchLayout('assisted', 'landscape', seed))));
    expect(layouts.size).toBe(8);
    const sides = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(seed => Math.sign(benchLayout('assisted', 'landscape', seed).head.x)));
    expect(sides.size).toBe(2);
  });
  it('a part rests on the bench, never in it: its middle is as high as it is thick', () => {
    for (const rest of Object.values(REST)) expect(rest.height).toBeGreaterThan(0.2);
    // A lying head: its axis is level once tipped.
    const m = poseMatrix({ x: 0, y: 0, z: 0, yaw: 0, tipZ: REST.head.tipZ, tipX: 0, spin: 0 });
    expect(Math.abs(apply(m, [0, 1, 0])[1])).toBeLessThan(1e-9);
    const pose = poseAbout(partCentre('head'), [3, REST.head.height, 9], { yaw: 20, tipZ: 90, tipX: 0, spin: 0 });
    const centre = apply(poseMatrix(pose), partCentre('head'));
    expect(centre[0] + pose.x).toBeCloseTo(3); expect(centre[1] + pose.y).toBeCloseTo(REST.head.height); expect(centre[2] + pose.z).toBeCloseTo(9);
  });
});

describe('Tiny Structures: turning the model', () => {
  it('let go, the turntable coasts, slows and rests; it never speeds up or turns back', () => {
    let v = 600, total = 0;
    for (let i = 0; i < 600 && v !== 0; i++) { const c = coast(v, 1 / 60); expect(Math.abs(c.velocity)).toBeLessThanOrEqual(Math.abs(v)); expect(c.turn).toBeGreaterThanOrEqual(0); v = c.velocity; total += c.turn; }
    expect(v).toBe(0);
    expect(total).toBeGreaterThan(600 / SPIN_FRICTION * 0.95);
  });
  it('a push for a whole turn coasts about one whole turn, either way; speed is capped and bad numbers stop it', () => {
    for (const dir of [1, -1]) { let v = pushFor(360 * dir), total = 0; for (let i = 0; i < 900 && v !== 0; i++) { const c = coast(v, 1 / 60); v = c.velocity; total += c.turn; } expect(Math.abs(total)).toBeGreaterThan(340); expect(Math.abs(total)).toBeLessThan(365); }
    expect(Math.abs(coast(1e9, 0.016).velocity)).toBeLessThanOrEqual(SPIN_MAX);
    expect(coast(Number.NaN, 0.016)).toEqual({ velocity: 0, turn: 0 });
    expect(coast(100, -1)).toEqual({ velocity: 0, turn: 0 });
  });
  it('a drag across the model is about one good turn: the chapter asks for no more', () => {
    const ppu = 22, across = 11.2 * ppu;
    expect(dragDegrees(across, ppu)).toBeGreaterThan(90);
    expect(dragDegrees(across * 2, ppu)).toBeGreaterThanOrEqual(SPIN_GOAL);
    expect(dragDegrees(-across, ppu)).toBe(-dragDegrees(across, ppu));
  });
  it('each round wears the next colours; the three chapters each ask for things to do', () => {
    expect([0, 1, 2, 3, 4, 5].map(paintForRound)).toEqual([...PAINTS, PAINTS[0]]);
    expect(paintForRound(Number.NaN)).toBe(PAINTS[0]);
    expect(CHAPTERS).toEqual(['build', 'dive', 'land']);
    expect(questKeys('build', 'assisted')).toEqual(['head', 'tailCollar', 'baseplate', 'fibres', 'spin']);
    expect(questKeys('build', 'full')).toHaveLength(8);
    expect(questKeys('dive', 'full')).toEqual(DIVE_QUEST);
    expect(questKeys('land', 'assisted')).toEqual(LAND_QUEST);
  });
});

describe('Tiny Structures: the model is the shape of a phage', () => {
  it('the head is a closed 20-faced shell on twelve corners', () => {
    const v = headVertices();
    expect(v).toHaveLength(12); expect(HEAD_FACES).toHaveLength(20);
    const edges = new Map<string, number>();
    for (const [a, b, c] of HEAD_FACES) for (const [p, q] of [[a, b], [b, c], [c, a]]) { const key = [p, q].sort((x, y) => x - y).join('-'); edges.set(key, (edges.get(key) ?? 0) + 1); }
    expect(edges.size).toBe(30);
    expect([...edges.values()].every(n => n === 2)).toBe(true);
    expect(Math.max(...v.map(p => p[1]))).toBe(PHAGE.head.y1); expect(Math.min(...v.map(p => p[1]))).toBe(PHAGE.head.y0);
  });
  it('six legs stand 60 degrees apart on y = 0 and keep their two lengths when the body sinks or a leg dances', () => {
    expect(Array.from({ length: FIBRE_COUNT }, (_, i) => fibreAngle(i))).toEqual([30, 90, 150, 210, 270, 330]);
    for (let i = 0; i < FIBRE_COUNT; i++) for (const [sink, flex] of [[0, 0], [1.25, 0], [0, 1], [0.6, -1], [0, 0.4]]) {
      const leg = legPoints(i, sink, flex);
      expect(len(sub(leg.knee, leg.hip))).toBeCloseTo(LEG_UPPER, 6);
      expect(len(sub(leg.foot, leg.knee))).toBeCloseTo(LEG_LOWER, 6);
      if (flex <= 0) expect(leg.foot[1]).toBeCloseTo(0);
      expect(leg.knee[1]).toBeGreaterThan(leg.foot[1]);
    }
    expect(legPoints(0, 1.25).hip[1]).toBeCloseTo(PHAGE.hip.y - 1.25);
  });
  it('the DNA coil stays inside the head and empties from the top as it slides out', () => {
    const full = dnaCoil(1), half = dnaCoil(0.5);
    for (const p of full) { expect(p[1]).toBeGreaterThan(PHAGE.head.y0); expect(p[1]).toBeLessThan(PHAGE.head.y1); expect(Math.hypot(p[0], p[2])).toBeLessThan(PHAGE.head.r); }
    expect(half.length).toBeLessThan(full.length);
    expect(Math.max(...half.map(p => p[1]))).toBeLessThan(Math.max(...full.map(p => p[1])));
    expect(dnaCoil(0)).toHaveLength(0);
  });
  it('one camera: a point on the bench under a pixel projects back to that pixel', () => {
    const view: View = { cx: 195, cy: 330, ppu: 20, dist: 150, elev: 30, target: [0, 6, 0] };
    for (const [x, y] of [[100, 500], [300, 420], [195, 700]]) { const p = unproject(view, x, y, 0, true); expect(p[1]).toBeCloseTo(0, 6); const s = project(view, p); expect(s.x).toBeCloseTo(x, 4); expect(s.y).toBeCloseTo(y, 4); }
    const carried = unproject(view, 240, 300, 4);
    expect(carried[2]).toBeCloseTo(4, 6);
    expect(project(view, [0, 0, 8]).s).toBeGreaterThan(project(view, [0, 0, -8]).s);
  });
});

describe('Tiny Structures: the dive is one honest journey', () => {
  it('five things, each about its real size, each far smaller than the last', () => {
    expect(DIVE_THINGS).toEqual(['drop', 'flea', 'cell', 'bacterium', 'phage']);
    expect(timesLonger('drop', 'flea')).toBe(5);
    expect(timesLonger('flea', 'cell')).toBe(5);
    expect(timesLonger('cell', 'bacterium')).toBe(100);
    expect(timesLonger('bacterium', 'phage')).toBeCloseTo(10);
    expect(ROD.length).toBe(REAL_MICROMETRES.bacterium);
    DIVE_STOPS.forEach((stop, i) => { expect(stop.thing).toBe(DIVE_THINGS[i]); expect(stop.field).toBeCloseTo(REAL_MICROMETRES[stop.thing] / FRAME_SHARE[stop.thing]); if (i) expect(stop.field).toBeLessThan(DIVE_STOPS[i - 1].field); });
    expect(TOTAL_MAGNIFICATION).toBeGreaterThan(10_000);
  });
  it('at each stop the camera frames that thing, and the next thing is already in the picture', () => {
    DIVE_STOPS.forEach((stop, i) => {
      const camera = diveCamera(i);
      expect(camera.field).toBeCloseTo(stop.field, 6); expect(camera.x).toBeCloseTo(stop.look.x, 6); expect(camera.y).toBeCloseTo(stop.look.y, 6);
      const next = DIVE_STOPS[i + 1];
      if (next) { const s = toScreen(camera, next.at, 390, 195, 195); expect(s.x).toBeGreaterThan(0); expect(s.x).toBeLessThan(390); expect(s.y).toBeGreaterThan(0); expect(s.y).toBeLessThan(390); }
    });
  });
  it('the fall is continuous: the field only shrinks, and the camera closes on the next thing about one fixed point', () => {
    let last = Infinity;
    for (let d = 0; d <= LAST_DEPTH; d += 0.01) { const f = diveCamera(d).field; expect(f).toBeLessThan(last + 1e-9); last = f; }
    for (let k = 0; k < LAST_DEPTH; k++) {
      const to = DIVE_STOPS[k + 1].look, spots = [0.1, 0.4, 0.7, 0.95].map(t => toScreen(diveCamera(k + t), to, 400, 200, 200));
      const anchor = toScreen(diveCamera(k + 0.999999), DIVE_STOPS[k].look, 400, 200, 200);
      expect(Number.isFinite(anchor.x)).toBe(true);
      // The point the lens is closing on drifts steadily to the middle and never jumps past it.
      const dist = spots.map(s => Math.hypot(s.x - 200, s.y - 200));
      for (let i = 1; i < dist.length; i++) expect(dist[i]).toBeLessThanOrEqual(dist[i - 1] + 1e-6);
    }
    expect(diveCamera(-3)).toEqual(diveCamera(0)); expect(diveCamera(99)).toEqual(diveCamera(LAST_DEPTH)); expect(clampDepth(Number.NaN)).toBe(0);
  });
  it('the powers of ten count up as the dive goes down', () => {
    expect(magnification(0)).toBeCloseTo(1, 9); expect(decade(0)).toBe(0);
    expect(decade(LAST_DEPTH)).toBe(4);
    let last = 0;
    for (let d = 0; d <= LAST_DEPTH; d += 0.05) { expect(decade(d)).toBeGreaterThanOrEqual(last); last = decade(d); }
  });
  it('the child drives it: holding dives to the next thing and waits there until it is recorded', () => {
    expect(depthLimit(0)).toBe(1); expect(depthLimit(2)).toBe(3); expect(depthLimit(9)).toBe(LAST_DEPTH);
    let depth = 0;
    for (let i = 0; i < 60 * 30; i++) { const next = diveStep(depth, 1, 1 / 60, depthLimit(0)); expect(next).toBeGreaterThanOrEqual(depth); depth = next; }
    expect(depth).toBeCloseTo(1, 2); expect(depth).toBeLessThanOrEqual(1);
    expect(canRecord(depth, 0)).toBe(true);
    expect(canRecord(1 - RECORD_REACH - 0.05, 0)).toBe(false);
    expect(canRecord(LAST_DEPTH, LAST_DEPTH)).toBe(false);
    expect(diveStep(0.5, -1, 1, 1)).toBeLessThan(0.5);
    expect(diveStep(0.5, 1, Number.NaN, 1)).toBe(0.5);
  });
  it('a pinch or a wheel moves the same depth: closing the field by a stop is one stop down, and back again', () => {
    const ratio = DIVE_STOPS[1].field / DIVE_STOPS[2].field;
    expect(depthForZoom(1, ratio, 4)).toBeCloseTo(2, 6);
    expect(depthForZoom(1.5, 1 / Math.sqrt(ratio), 4)).toBeCloseTo(1, 6);
    expect(depthForZoom(0.9, 1000, depthLimit(0))).toBe(1);
    expect(depthForZoom(1, -2, 4)).toBe(1);
  });
  it('the pond changes with the round, but the four things to find and one secret are always there', () => {
    expect(pondFor(5)).toEqual(pondFor(5));
    const secrets = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const life = pondFor(seed);
      for (const [i, thing] of DIVE_THINGS.entries()) { if (!i) continue; const one = life.filter(l => l.role === thing); expect(one).toHaveLength(1); expect(one[0]).toMatchObject({ x: DIVE_STOPS[i].at.x, y: DIVE_STOPS[i].at.y, size: REAL_MICROMETRES[thing] }); }
      const secret = life.filter(l => l.role === 'secret'); expect(secret).toHaveLength(1); secrets.add(secret[0].kind);
      // Nothing extra sits on one of the four, or on the way down to the next.
      const four = life.filter(l => l.role && l.role !== 'secret');
      for (const extra of life.filter(l => !l.role)) for (const main of four) expect(Math.hypot(extra.x - main.x, extra.y - main.y)).toBeGreaterThan(main.size * 0.6);
      expect(life.length).toBeGreaterThan(30);
    }
    expect(secrets.size).toBe(2);
    expect(JSON.stringify(pondFor(1))).not.toBe(JSON.stringify(pondFor(2)));
  });
});

describe('Tiny Structures: the landing, legs first', () => {
  it('only an upright phage holds on: sideways and head first it drifts off', () => {
    expect(attitude(0)).toBe('legs'); expect(attitude(LEGS_CONE)).toBe('legs'); expect(attitude(-LEGS_CONE)).toBe('legs');
    expect(attitude(LEGS_CONE + 1)).toBe('side'); expect(attitude(-90)).toBe('side');
    expect(attitude(180)).toBe('head'); expect(attitude(HEAD_CONE)).toBe('head'); expect(attitude(-170)).toBe('head');
    expect(normRoll(190)).toBe(-170); expect(normRoll(-180)).toBe(180); expect(normRoll(720)).toBe(0);
  });
  it('what touches first is what the shape says: the feet when upright, the head when upside down', () => {
    expect(touchHeight(0)).toMatchObject({ foot: true }); expect(touchHeight(0).height).toBeCloseTo(GRIP_Y);
    expect(touchHeight(180).foot).toBe(false); expect(touchHeight(180).height).toBeCloseTo(PHAGE.head.y1 - GRIP_Y);
    expect(touchHeight(20).foot).toBe(true);
    // The wide legs reach the cell before the body does at any lean a landing allows.
    for (let roll = -LEGS_CONE; roll <= LEGS_CONE; roll += 2) expect(touchHeight(roll).foot).toBe(true);
    expect(touchHeight(25).x).toBeLessThan(0); expect(touchHeight(-25).x).toBeGreaterThan(0);
  });
  it('the six feet take hold one after another, the low side first', () => {
    for (const roll of [-30, -5, 0, 12, 30]) expect([...catchOrder(roll)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    const reach = (i: number) => Math.cos(fibreAngle(i) * Math.PI / 180);
    expect(reach(catchOrder(25)[0])).toBeLessThan(0); expect(reach(catchOrder(25)[5])).toBeGreaterThan(0);
    expect(reach(catchOrder(-25)[0])).toBeGreaterThan(0);
  });
  it('near the cell the legs feel for it: the phage rights itself, strongly for the youngest, and not at all far away', () => {
    expect(selfRight(60, FEEL_RANGE + 1, 'assisted', 0.1)).toBe(60);
    const easy = selfRight(60, 1, 'assisted', 0.1), hard = selfRight(60, 1, 'full', 0.1);
    expect(easy).toBeLessThan(hard); expect(hard).toBeLessThan(60); expect(easy).toBeGreaterThanOrEqual(0);
    expect(selfRight(-60, 1, 'assisted', 0.1)).toBe(-easy);
    expect(selfRight(0.5, 0, 'assisted', 1)).toBe(0);
    expect(selfRight(40, 2, 'full', Number.NaN)).toBe(40);
  });
  it('each round the water tips the phage a new way, always past where it could simply land', () => {
    expect(landStart(9, 'full')).toEqual(landStart(9, 'full'));
    const rolls = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) for (const mode of BUILD_MODES) {
      const start = landStart(seed, mode);
      expect(attitude(start.roll)).not.toBe('legs');
      expect(start.height).toBeGreaterThan(touchHeight(start.roll).height + 4);
      expect(Math.sign(start.x)).toBe(-Math.sign(start.roll));
      rolls.add(Math.round(start.roll));
    }
    expect(rolls.size).toBeGreaterThan(12);
    expect(Math.abs(landStart(3, 'assisted').roll)).toBeLessThan(Math.abs(landStart(3, 'full').roll));
  });
  it('the squeeze follows the press, the sleeve only shortens, and the four steps come in order', () => {
    expect(squeezeBy(0.9, 0.5)).toBe(1); expect(squeezeBy(0.1, -0.5)).toBe(0); expect(squeezeBy(Number.NaN, 0.3)).toBe(0.3);
    expect(sheathFor(0)).toBe(1); expect(sheathFor(1)).toBeCloseTo(SHEATH_MIN);
    let last = 1;
    for (let s = 0; s <= 1.0001; s += 0.05) { expect(sheathFor(s)).toBeLessThanOrEqual(last); last = sheathFor(s); }
    expect(sheathFor(0.5)).toBeLessThan((1 + SHEATH_MIN) / 2);
    const done: LandStep[] = [];
    for (const step of LAND_QUEST) { expect(nextLandStep(done)).toBe(step); done.push(step); }
    expect(nextLandStep(done)).toBeNull();
    expect(LAND_QUEST).toEqual(['legs', 'pad', 'squeeze', 'thread']);
  });
});

describe('Tiny Structures: the words', () => {
  const flat = (value: unknown, at = ''): [string, string][] => typeof value === 'string' ? [[at, value]] : Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => flat(v, at ? `${at}.${k}` : k));
  const en = flat(TINY_BUILDERS_COPY.en), he = flat(TINY_BUILDERS_COPY.he);
  it('English and Hebrew say the same things; Hebrew strings are Hebrew and the Hebrew title has no Latin letters', () => {
    expect(he.map(([k]) => k)).toEqual(en.map(([k]) => k));
    for (const [key, text] of he) expect(/[֐-׿]/.test(text), key).toBe(true);
    for (const [key, text] of he) expect(/[A-Za-z]/.test(text), `${key}: ${text}`).toBe(false);
    for (const [, text] of en) expect(/[֐-׿]/.test(text)).toBe(false);
  });
  it('the register holds: wonder, no illness, no medicine, no attack', () => {
    for (const [key, text] of en) expect(/\b(ill|sick|disease|germ|infect|medicine|cure|kill|attack|invade|enemy|dead|die)/i.test(text), `${key}: ${text}`).toBe(false);
    for (const [key, text] of he) expect(/מחלה|מחלות|חולה|חולים|זיהו|תרופ|להרוג|הורג|תוקפ|לתקוף|אויב/.test(text), `${key}: ${text}`).toBe(false);
    expect(TINY_BUILDERS_COPY.en.toast.only).toMatch(/only on bacteria, never on people/);
    expect(TINY_BUILDERS_COPY.en.toast.beyond).toMatch(/No glass lens/);
    expect(TINY_BUILDERS_COPY.en.say['fact-cell']).toMatch(/living cell/);
    expect(TINY_BUILDERS_COPY.en.say['fact-flea']).toMatch(/millimetre/);
  });
  it('a cue is eight words at most, and no coach line is long', () => {
    for (const words of [TINY_BUILDERS_COPY.en, TINY_BUILDERS_COPY.he]) {
      for (const key of ['buildCue', 'standing', 'diveCue', 'landCue', 'squeezeCue'] as const) expect(words.say[key].split(/\s+/).length, key).toBeLessThanOrEqual(8);
      for (const [key, text] of flat({ say: words.say, picked: words.picked, clicked: words.clicked, captions: words.captions })) expect(text.split(/\s+/).length, key).toBeLessThanOrEqual(9);
    }
  });
  it('every line the game says is written, in both languages', () => {
    const engine = source('tinyEngine.ts');
    const keys = new Set([...engine.matchAll(/say\('(?:aya|bebe)', '\w+', '([\w-]+)'/g)].map(m => m[1]));
    expect(keys.size).toBeGreaterThan(18);
    for (const key of keys) if (key !== 'picked' && key !== 'clicked') expect(Object.keys(TINY_BUILDERS_COPY.en.say), key).toContain(key);
    for (const thing of DIVE_QUEST) { expect(TINY_BUILDERS_COPY.he.say).toHaveProperty(`spot-${thing}`); expect(TINY_BUILDERS_COPY.he.say).toHaveProperty(`fact-${thing}`); }
    for (const key of [...engine.matchAll(/hooks\.notice\('(\w+)'/g)].map(m => m[1])) expect(Object.keys(TINY_BUILDERS_COPY.he.toast), key).toContain(key);
    for (const piece of [...PIECES.assisted, ...PIECES.full]) { expect(TINY_BUILDERS_COPY.he.picked[piece.kind]).toBeTruthy(); expect(TINY_BUILDERS_COPY.en.clicked[piece.kind]).toBeTruthy(); expect(TINY_BUILDERS_COPY.he.pieces[piece.kind]).toBeTruthy(); }
    for (const key of [...DIVE_QUEST, ...LAND_QUEST, 'spin'] as const) expect(TINY_BUILDERS_COPY.he.steps[key]).toBeTruthy();
    expect(TINY_BUILDERS_COPY.en.captions).toHaveLength(5); expect(TINY_BUILDERS_COPY.he.captions).toHaveLength(5);
    expect(tinyLine(TINY_BUILDERS_COPY.en.toast.closer, '1,000')).toBe('1,000 times closer');
  });
});

describe('Tiny Structures: the kit pictures and the notes', () => {
  it('every picture is a kit file with a recorded source, and none of this activity’s own shows a child', () => {
    expect(TINY_KIT_ART.length).toBeGreaterThanOrEqual(5);
    for (const art of TINY_KIT_ART) {
      expect(art.src).toMatch(/^\/visuals\/studio-v2\/(bop|makers)\/[a-z0-9-]+\.webp$/);
      expect(art.src480).toBe(art.src.replace(/\.webp$/, '-480.webp'));
      expect(art.source.length).toBeGreaterThan(10); expect(art.width).toBeGreaterThan(0); expect(art.height).toBeGreaterThan(0);
      if (/tiny-builders-/.test(art.src)) expect(/bebe|gobgob|crew/.test(art.src)).toBe(false);
    }
    // Bebe appears only as the shared HUD's coach head, from the shared library's named files.
    for (const stem of Object.values(COACH_HEADS.bebe)) expect(stem).toMatch(/^kit-bebe-/);
    for (const file of ['tinyEngine.ts', 'tinyBench.ts', 'tinyPond.ts', 'tinyRender.ts', 'TinyBuilders.tsx']) expect(/kit-bebe|kit-gobgob/.test(source(file)), file).toBe(false);
  });
  it('the rules file carries the SIMPLIFICATIONS note, and the canvas files carry no colour literal', () => {
    const rules = source('tinyBuildersRules.ts');
    expect(rules).toMatch(/SIMPLIFICATIONS/); expect(rules).toMatch(/Colours are invented/); expect(rules).toMatch(/not a simulation of real molecules/); expect(rules).toMatch(/meets a bacterium by chance/);
    for (const file of ['tinyEngine.ts', 'tinyBench.ts', 'tinyPond.ts', 'tinyRender.ts', 'TinyBuilders.tsx', 'tinyBuilders.css']) expect((source(file).match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []), file).toEqual([]);
  });
});
