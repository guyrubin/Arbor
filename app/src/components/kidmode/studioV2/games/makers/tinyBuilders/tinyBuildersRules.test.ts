import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_SHOWN, BUILD_MODES, LABELS, LAND_KEYFRAMES, LAND_KEYFRAME_MS, PIECES, SNAP_RADIUS, SOCKETS,
  canName, complete, convertPlaced, fibreView, fits, fitsAt, homeFor, landFrame, landKeyframe, modeForChallenge,
  placeOn, placementCount, shownParts, tinyLine, turnBy, unvisited, validMode, visit, type BuildMode, type Placed,
} from './tinyBuildersRules';
import { FIBRE, FIBRE_L1, FIBRE_L2, HEAD_FACES, SHEATH_MIN, dnaCoil, headFacets, hull, kneeFor, normDeg } from './phageGeometry';
import { TINY_BUILDERS_COPY } from './tinyBuildersCopy';

const here = path.dirname(fileURLToPath(import.meta.url));
function fillAll(mode: BuildMode): Placed {
  const out: Record<string, string> = {}, used = new Set<string>();
  for (const socket of SOCKETS[mode]) { const piece = PIECES[mode].find(p => fits(p, socket) && !used.has(p.id))!; used.add(piece.id); out[socket.id] = piece.id; }
  return out;
}

describe('Tiny Structures: the parts fit the intended structure', () => {
  it('assisted mode has 4 placements and full mode has 7', () => {
    expect(placementCount('assisted')).toBe(4);
    expect(placementCount('full')).toBe(7);
    expect(PIECES.assisted).toHaveLength(4);
    expect(PIECES.full).toHaveLength(7);
  });
  it.each(BUILD_MODES)('%s: each piece fits only sockets of its own kind', (mode) => {
    for (const piece of PIECES[mode]) for (const socket of SOCKETS[mode]) expect(fits(piece, socket), `${piece.id} → ${socket.id}`).toBe(piece.kind === socket.kind);
    // Every piece has somewhere to go, and every socket a piece.
    for (const piece of PIECES[mode]) expect(SOCKETS[mode].some(s => fits(piece, s)), piece.id).toBe(true);
    const kinds = (list: readonly { kind: string }[]) => list.map(i => i.kind).sort();
    expect(kinds(PIECES[mode])).toEqual(kinds(SOCKETS[mode]));
  });
  it.each(BUILD_MODES)('%s: dropping a piece on its own place snaps it; on another part it drifts back', (mode) => {
    for (const piece of PIECES[mode]) {
      const own = SOCKETS[mode].find(s => fits(piece, s))!;
      expect(fitsAt(mode, piece, own.at, {}), `${piece.id} on its place`).not.toBeNull();
      expect(fits(piece, SOCKETS[mode].find(s => s.id === fitsAt(mode, piece, own.at, {}))!)).toBe(true);
    }
    // Far outside the blueprint nothing fits.
    expect(fitsAt(mode, PIECES[mode][0], { x: -400, y: -400 }, {})).toBeNull();
  });
  it('full mode: a head let go on the tail does not jump to its own place', () => {
    const head = PIECES.full.find(p => p.kind === 'head')!, tail = SOCKETS.full.find(s => s.id === 'tail')!;
    expect(fitsAt('full', head, tail.at, {})).toBeNull();
    const base = PIECES.full.find(p => p.kind === 'baseplate')!, headSocket = SOCKETS.full.find(s => s.id === 'head')!;
    expect(fitsAt('full', base, headSocket.at, {})).toBeNull();
  });
  it('assisted mode is easier: a far bigger snap radius, and a drop anywhere on the blueprint goes home', () => {
    expect(SNAP_RADIUS.assisted).toBeGreaterThan(SNAP_RADIUS.full * 2);
    const head = PIECES.assisted.find(p => p.kind === 'head')!;
    expect(fitsAt('assisted', head, { x: 200, y: 300 }, {})).toBe('head');
    expect(fitsAt('full', PIECES.full.find(p => p.kind === 'head')!, { x: 200, y: 300 }, {})).toBeNull();
  });
  it('the three fibre pairs are alike: any pair fits any free fibre place, and a full place passes to a free one', () => {
    const pair = PIECES.full.find(p => p.id === 'pair-2')!, first = SOCKETS.full.find(s => s.id === 'fibres-0')!;
    expect(fitsAt('full', pair, first.at, {})).toBe('fibres-0');
    expect(fitsAt('full', pair, first.at, { 'fibres-0': 'pair-0' })).toMatch(/^fibres-[12]$/);
    expect(fitsAt('full', pair, first.at, { 'fibres-0': 'pair-0', 'fibres-1': 'pair-1', 'fibres-2': 'pair-2' })).toBeNull();
  });
  it('placing directly (keyboard) checks the kind, the free socket and the free piece', () => {
    expect(placeOn('full', {}, 'head', 'head')).toEqual({ head: 'head' });
    expect(placeOn('full', {}, 'head', 'tail')).toBeNull();
    expect(placeOn('full', { head: 'head' }, 'head', 'head')).toBeNull();
    expect(placeOn('full', { 'fibres-0': 'pair-0' }, 'pair-0', 'fibres-1')).toBeNull();
    expect(placeOn('full', {}, 'nope', 'head')).toBeNull();
  });
  it.each(BUILD_MODES)('%s: any order completes the model, and every part is then drawn', (mode) => {
    const order = [...SOCKETS[mode]].reverse();
    let placed: Placed = {};
    const free = [...PIECES[mode]];
    for (const socket of order) {
      expect(complete(mode, placed)).toBe(false);
      const piece = free.find(p => fits(p, socket))!;
      free.splice(free.indexOf(piece), 1);
      placed = placeOn(mode, placed, piece.id, socket.id)!;
      expect(placed).not.toBeNull();
    }
    expect(complete(mode, placed)).toBe(true);
    expect(shownParts(mode, placed)).toEqual(ALL_SHOWN);
  });
  it('the glow points at the picked piece’s own free place', () => {
    expect(homeFor('assisted', 'tailCollar', {})).toBe('tailCollar');
    expect(homeFor('full', 'pair-1', { 'fibres-0': 'pair-0' })).toBe('fibres-1');
    expect(homeFor('full', 'head', { head: 'head' })).toBeNull();
  });
  it('a fibre pair is two opposite legs; assisted fibres are all six', () => {
    expect(shownParts('full', { 'fibres-1': 'pair-1' }).fibres).toEqual([false, true, false, false, true, false]);
    expect(shownParts('assisted', { fibres: 'fibres' }).fibres.every(Boolean)).toBe(true);
    expect(shownParts('assisted', { tailCollar: 'tailCollar' })).toMatchObject({ collar: true, tail: true, head: false });
  });
  it('switching modes keeps what is already built', () => {
    expect(convertPlaced('assisted', 'full', { tailCollar: 'tailCollar', fibres: 'fibres' })).toEqual({ collar: 'collar', tail: 'tail', 'fibres-0': 'pair-0', 'fibres-1': 'pair-1', 'fibres-2': 'pair-2' });
    expect(convertPlaced('full', 'assisted', { collar: 'collar', head: 'head', 'fibres-0': 'pair-0' })).toEqual({ head: 'head' });
    const full = fillAll('full');
    expect(complete('assisted', convertPlaced('full', 'assisted', full))).toBe(true);
  });
  it('validMode and the age default', () => {
    expect(validMode('assisted')).toBe(true); expect(validMode('full')).toBe(true); expect(validMode('easy')).toBe(false); expect(validMode(undefined)).toBe(false);
    expect(modeForChallenge('gentle')).toBe('assisted'); expect(modeForChallenge('explore')).toBe('full');
  });
});

describe('Tiny Structures: turning', () => {
  it('six fibres sit 60 degrees apart and swap front and back as the model turns', () => {
    const views = Array.from({ length: 6 }, (_, i) => fibreView(i, 0));
    for (let i = 0; i < 6; i++) expect(normDeg(views[(i + 1) % 6].angle - views[i].angle)).toBeCloseTo(60);
    expect(views.filter(v => v.front)).toHaveLength(3);
    const turned = fibreView(0, 180);
    expect(turned.front).toBe(!fibreView(0, 0).front);
    expect(turned.reach).toBeCloseTo(-fibreView(0, 0).reach);
    expect(fibreView(2, 0).reach).toBeCloseTo(Math.cos(150 * Math.PI / 180));
  });
  it('turning wraps round', () => {
    expect(turnBy(350, 30)).toBe(20); expect(turnBy(10, -30)).toBe(340); expect(turnBy(0, Number.NaN)).toBe(0);
  });
  it('the head is a 20-faced shell whose facets re-shade as it turns', () => {
    expect(HEAD_FACES).toHaveLength(20);
    const a = headFacets(0, 0.22), b = headFacets(36, 0.22);
    expect(a.filter(f => f.front).length).toBeGreaterThanOrEqual(7);
    expect(a.map(f => f.light.toFixed(3))).not.toEqual(b.map(f => f.light.toFixed(3)));
    expect(hull(a.flatMap(f => f.points)).length).toBeGreaterThanOrEqual(6);
  });
  it('fibre legs keep their two lengths when the body settles', () => {
    const rest = kneeFor(FIBRE.corner, FIBRE.tip);
    expect(rest.r).toBeCloseTo(FIBRE.knee.r, 0); expect(rest.y).toBeCloseTo(FIBRE.knee.y, 0);
    const corner = { r: FIBRE.corner.r, y: FIBRE.corner.y + 30 };
    const bent = kneeFor(corner, FIBRE.tip);
    expect(Math.hypot(bent.r - corner.r, bent.y - corner.y)).toBeCloseTo(FIBRE_L1, 3);
    expect(Math.hypot(FIBRE.tip.r - bent.r, FIBRE.tip.y - bent.y)).toBeCloseTo(FIBRE_L2, 3);
    expect(bent.r).toBeGreaterThan(corner.r);
  });
});

describe('Tiny Structures: naming the parts', () => {
  it('six labels; DNA can be named only while the model is opened up', () => {
    expect(LABELS).toEqual(['head', 'dna', 'collar', 'tail', 'baseplate', 'fibres']);
    expect(canName('dna', false)).toBe(false); expect(canName('dna', true)).toBe(true); expect(canName('head', false)).toBe(true);
    let seen = visit([], 'head', false);
    seen = visit(seen, 'dna', false); expect(seen).toEqual(['head']);
    seen = visit(seen, 'dna', true); seen = visit(seen, 'head', true); expect(seen).toEqual(['head', 'dna']);
    expect(unvisited(seen)).toEqual(['collar', 'tail', 'baseplate', 'fibres']);
  });
  it('every label has an EN and HE name and sentence, matching the visible parts', () => {
    for (const lang of ['en', 'he'] as const) for (const l of LABELS) {
      const label = TINY_BUILDERS_COPY[lang].labels[l];
      expect(label.name.trim(), `${lang}.${l}`).not.toBe(''); expect(label.text.length, `${lang}.${l}`).toBeGreaterThan(10);
    }
    expect(TINY_BUILDERS_COPY.en.labels.head.text).toBe('A shell made of many tiny flat pieces. It keeps the instructions safe inside.');
    expect(TINY_BUILDERS_COPY.en.labels.fibres.text).toBe('Long legs that feel for the right bacterium and hold on.');
  });
  it('the words keep the register: no illness, no medicine, no infection drama', () => {
    const all = JSON.stringify(TINY_BUILDERS_COPY).toLowerCase();
    for (const word of ['infect', 'ill', 'sick', 'disease', 'germ', 'kill', 'attack', 'invade', 'medic', 'doctor', 'burst', 'explode', 'destroy', 'simulation']) expect(all, word).not.toMatch(new RegExp(`\\b${word}`));
    for (const word of ['מחלה', 'מחלות', 'הדבק', 'רופא', 'תרופ', 'הורג', 'תוקף', 'מתפוצץ', 'חולה']) expect(all, word).not.toContain(word);
    // Virus and bacterium are told apart.
    expect(TINY_BUILDERS_COPY.en.cellNote).toBe('a living cell'); expect(TINY_BUILDERS_COPY.en.phageNote).toBe('a virus, not a cell');
  });
  it('Hebrew strings are Hebrew; the Hebrew title has no Latin letters', () => {
    const he = TINY_BUILDERS_COPY.he, en = TINY_BUILDERS_COPY.en;
    expect(he.title).not.toMatch(/[A-Za-z]/);
    const strings = (o: unknown): string[] => typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : [];
    expect(strings(he).length).toBe(strings(en).length);
    for (const s of strings(he)) { expect(s, s).toMatch(/[א-ת]/); expect(s, s).not.toMatch(/[A-Za-z]/); }
    expect(tinyLine(he.placed, he.pieces.head)).toBe('ראש במקום.');
  });
});

describe('Tiny Structures: landing', () => {
  it('the landing sequence is monotonic: down, settle, squeeze, then the DNA goes in', () => {
    let prev = landFrame(0);
    expect(prev).toMatchObject({ descent: 0, settle: 0, sheath: 1, dna: 0 });
    for (let i = 1; i <= 400; i++) {
      const f = landFrame(i / 400);
      expect(f.descent).toBeGreaterThanOrEqual(prev.descent); expect(f.settle).toBeGreaterThanOrEqual(prev.settle);
      expect(f.sheath).toBeLessThanOrEqual(prev.sheath); expect(f.dna).toBeGreaterThanOrEqual(prev.dna);
      expect(f.camera).toBeGreaterThanOrEqual(prev.camera); expect(f.tilt).toBeLessThanOrEqual(prev.tilt);
      prev = f;
    }
    expect(prev.sheath).toBeCloseTo(SHEATH_MIN); expect(prev.dna).toBe(1); expect(prev.stage).toBe('inside');
  });
  it('fibres touch before the baseplate settles, which comes before the squeeze, before the DNA', () => {
    const first = (test: (t: number) => boolean) => { for (let i = 0; i <= 1000; i++) if (test(i / 1000)) return i / 1000; return 2; };
    const touch = first(t => landFrame(t).descent >= 53.9), settle = first(t => landFrame(t).settle > 0.01), squeeze = first(t => landFrame(t).sheath < 0.999), dna = first(t => landFrame(t).dna > 0.001);
    expect(touch).toBeLessThan(settle); expect(settle).toBeLessThan(squeeze); expect(squeeze).toBeLessThan(dna);
  });
  it('with motion reduced the landing is a few still frames, in order, ending inside', () => {
    const frames = Array.from({ length: 12 }, (_, i) => landKeyframe(i * LAND_KEYFRAME_MS / 2));
    for (let i = 1; i < frames.length; i++) expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
    expect(landKeyframe(LAND_KEYFRAMES.length * LAND_KEYFRAME_MS * 3)).toBe(1);
    expect(landKeyframe(-5)).toBe(0);
    expect(new Set(LAND_KEYFRAMES.map(t => landFrame(t).stage)).size).toBe(LAND_KEYFRAMES.length);
  });
  it('the DNA coil empties from the head as it moves out', () => {
    const full = dnaCoil(0, 0.22, 1), half = dnaCoil(0, 0.22, 0.5), none = dnaCoil(0, 0.22, 0);
    const count = (c: typeof full) => [...c.back, ...c.front].reduce((n, run) => n + run.length, 0);
    expect(count(full)).toBeGreaterThan(count(half)); expect(count(none)).toBe(0); expect(none.end).toBeNull();
  });
});

describe('Tiny Structures: the simplifications are written down', () => {
  it('the rules file carries the SIMPLIFICATIONS note', () => {
    const src = readFileSync(path.join(here, 'tinyBuildersRules.ts'), 'utf8');
    expect(src).toMatch(/SIMPLIFICATIONS/);
    for (const point of ['three pairs', 'invented', 'not a simulation', 'squeeze']) expect(src).toContain(point);
  });
});
