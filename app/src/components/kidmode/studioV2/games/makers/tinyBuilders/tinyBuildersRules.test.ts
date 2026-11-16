import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_SHOWN, BUILD_MODES, LABELS, LAND_KEYFRAMES, LAND_KEYFRAME_MS, LAND_TILT, LOCK_RADIUS, PAINTS, PIECES, PULL_RADIUS, SNAP_RADIUS, SOCKETS, SPIN_FRICTION, SPIN_MAX,
  canName, coast, complete, convertPlaced, dropAt, fibreView, fits, fitsAt, homeFor, landFrame, landKeyframe, modeForChallenge, nextPaint, paintForRound, pieceHome,
  placeOn, placementCount, pulled, pushFor, shownParts, tinyLine, trayOrder, turnBy, unvisited, validMode, visit, type BuildMode, type Placed,
} from './tinyBuildersRules';
import { FIBRE, FIBRE_L1, FIBRE_L2, HEAD_FACES, PIECE_BOX, SHEATH_MIN, VIEW_TILT, dnaCoil, headFacets, hull, kneeFor, normDeg } from './phageGeometry';
import { TINY_BUILDERS_COPY } from './tinyBuildersCopy';
import { LAST_STOP, REAL_MICROMETRES, SCALE_STOPS, clampStop, timesLonger, zoomFactor, zoomMs } from './tinyScale';
import { MONITOR_SCREEN, TINY_KIT_ART } from './tinyKitArt';

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

describe('Tiny Structures: a piece in the hand (the magnet)', () => {
  it.each(BUILD_MODES)('%s: every piece let go on its own place snaps there, held fast', (mode) => {
    for (const piece of PIECES[mode]) {
      const drop = dropAt(mode, piece, pieceHome(piece.kind), {});
      expect(drop, piece.id).not.toBeNull();
      expect(fits(piece, SOCKETS[mode].find(s => s.id === drop!.socket)!)).toBe(true);
      expect(drop!.pull).toBe(1);
      expect(pulled(pieceHome(piece.kind), drop)).toEqual(pieceHome(piece.kind));
    }
  });
  it('the pull grows as the piece nears: nothing far away, all of it inside the lock', () => {
    const head = PIECES.full[0], home = pieceHome('head');
    let last = -1;
    for (let d = PULL_RADIUS + 20; d >= 0; d -= 2) {
      const drop = dropAt('assisted', PIECES.assisted[0], { x: home.x + d, y: home.y }, {});
      const pull = drop ? drop.pull : 0;
      expect(pull).toBeGreaterThanOrEqual(last); expect(pull).toBeGreaterThanOrEqual(0); expect(pull).toBeLessThanOrEqual(1);
      last = pull;
    }
    expect(dropAt('assisted', PIECES.assisted[0], { x: home.x + PULL_RADIUS + 4, y: home.y }, {})!.pull).toBe(0);
    expect(dropAt('full', head, { x: home.x + LOCK_RADIUS - 1, y: home.y }, {})!.pull).toBe(1);
    // A piece part-way is drawn part-way towards its place, never past it.
    const mid = dropAt('full', head, { x: home.x + 50, y: home.y }, {})!;
    expect(pulled({ x: home.x + 50, y: home.y }, mid).x).toBeGreaterThan(home.x); expect(pulled({ x: home.x + 50, y: home.y }, mid).x).toBeLessThan(home.x + 50);
  });
  it('full mode: a head let go on the tail drifts back; assisted mode takes it home from anywhere over the model', () => {
    const head = PIECES.full[0];
    expect(dropAt('full', head, pieceHome('tail'), {})).toBeNull();
    expect(dropAt('full', PIECES.full.find(p => p.kind === 'baseplate')!, pieceHome('head'), {})).toBeNull();
    expect(dropAt('assisted', PIECES.assisted[0], pieceHome('fibres'), {})!.socket).toBe('head');
    expect(dropAt('assisted', PIECES.assisted[0], { x: -400, y: -400 }, {})).toBeNull();
    expect(SNAP_RADIUS.assisted).toBeGreaterThan(SNAP_RADIUS.full * 2);
  });
  it('a placed piece cannot be dropped again, and fibre pairs fill the free places in turn', () => {
    expect(dropAt('full', PIECES.full[0], pieceHome('head'), { head: 'head' })).toBeNull();
    const pair = PIECES.full.find(p => p.id === 'pair-2')!;
    expect(dropAt('full', pair, pieceHome('fibrePair'), {})!.socket).toBe('fibres-0');
    expect(dropAt('full', pair, pieceHome('fibrePair'), { 'fibres-0': 'pair-0' })!.socket).toBe('fibres-1');
  });
  it('every piece has a box of its own, and its home is the middle of it', () => {
    for (const mode of BUILD_MODES) for (const piece of PIECES[mode]) {
      const [x, y, w, h] = PIECE_BOX[piece.kind];
      expect(pieceHome(piece.kind)).toEqual({ x: x + w / 2, y: y + h / 2 });
    }
  });
});

describe('Tiny Structures: the turntable has weight', () => {
  it('let go, it coasts, slows and comes to rest; it never speeds up or turns back', () => {
    let v = 300, turned = 0, steps = 0;
    while (v !== 0 && steps < 2000) { const next = coast(v, 1 / 60); expect(Math.abs(next.velocity)).toBeLessThan(Math.abs(v)); expect(next.turn).toBeGreaterThan(0); turned += next.turn; v = next.velocity; steps++; }
    expect(v).toBe(0);
    expect(turned).toBeGreaterThan(300 / SPIN_FRICTION * 0.95); expect(turned).toBeLessThanOrEqual(300 / SPIN_FRICTION + 0.01);
  });
  it('a push for 360 degrees coasts about one whole turn, either way', () => {
    for (const sign of [1, -1]) {
      let v = sign * pushFor(360), turned = 0;
      for (let i = 0; i < 4000 && v !== 0; i++) { const next = coast(v, 1 / 60); turned += next.turn; v = next.velocity; }
      expect(Math.abs(turned)).toBeGreaterThan(350); expect(Math.abs(turned)).toBeLessThanOrEqual(360.01); expect(Math.sign(turned)).toBe(sign);
    }
  });
  it('speed is capped and bad numbers stop the table', () => {
    expect(Math.abs(coast(1e6, 0.016).velocity)).toBeLessThanOrEqual(SPIN_MAX);
    expect(coast(Number.NaN, 0.016)).toEqual({ velocity: 0, turn: 0 }); expect(coast(100, 0)).toEqual({ velocity: 0, turn: 0 });
  });
});

describe('Tiny Structures: play again is not the same again', () => {
  it('each round starts in the next colours; the first is the cover’s', () => {
    expect(paintForRound(0)).toBe('lagoon');
    expect(new Set(PAINTS.map((_, i) => paintForRound(i))).size).toBe(PAINTS.length);
    expect(paintForRound(PAINTS.length)).toBe('lagoon'); expect(paintForRound(Number.NaN)).toBe('lagoon');
    let paint: (typeof PAINTS)[number] = PAINTS[0]; const seen = new Set<string>([paint]);
    for (let i = 1; i < PAINTS.length; i++) { paint = nextPaint(paint); seen.add(paint); }
    expect(seen.size).toBe(PAINTS.length); expect(nextPaint(paint)).toBe(PAINTS[0]);
  });
  it.each(BUILD_MODES)('%s: the tray is laid out afresh each round, always with every piece once', (mode) => {
    expect(trayOrder(mode, 0)).toEqual(PIECES[mode]);
    const orders = new Set<string>();
    for (let round = 0; round < 6; round++) {
      const order = trayOrder(mode, round);
      expect([...order].map(p => p.id).sort()).toEqual(PIECES[mode].map(p => p.id).sort());
      orders.add(order.map(p => p.id).join());
    }
    expect(orders.size).toBeGreaterThanOrEqual(3);
  });
});

describe('Tiny Structures: the zoom is honest about size', () => {
  it('four stops, from a drop of pond water down to a phage', () => {
    expect(SCALE_STOPS.map(s => s.id)).toEqual(['leaf', 'swimmer', 'cell', 'phage']);
    expect(LAST_STOP).toBe(3); expect(clampStop(9)).toBe(3); expect(clampStop(-2)).toBe(0); expect(clampStop(Number.NaN)).toBe(0);
    for (let i = 0; i < LAST_STOP; i++) expect(SCALE_STOPS[i].ring, SCALE_STOPS[i].id).not.toBeNull();
    for (let i = 1; i <= LAST_STOP; i++) if (SCALE_STOPS[i - 1].small) expect(SCALE_STOPS[i].big).toBe(SCALE_STOPS[i - 1].small);
  });
  it('the words agree with the round figures: about fifteen, about a hundred, about ten', () => {
    expect(timesLonger('drop', 'swimmer')).toBeCloseTo(15); expect(timesLonger('swimmer', 'cell')).toBeCloseTo(100); expect(timesLonger('cell', 'phage')).toBeCloseTo(10);
    const en = TINY_BUILDERS_COPY.en.stopText;
    expect(en.swimmer).toMatch(/About fifteen/); expect(en.cell).toMatch(/About a hundred/); expect(en.phage).toMatch(/About ten/);
    const he = TINY_BUILDERS_COPY.he.stopText;
    expect(he.swimmer).toContain('בערך חמש־עשרה'); expect(he.cell).toContain('בערך מאה'); expect(he.phage).toContain('בערך עשרה');
    // Every size sentence says "about", and the pictures past the camera say they are drawn.
    expect(TINY_BUILDERS_COPY.en.approx).toMatch(/drawn/); expect(TINY_BUILDERS_COPY.en.beyond).toMatch(/electron microscopes/);
    expect(REAL_MICROMETRES.phage).toBeLessThan(REAL_MICROMETRES.cell); expect(REAL_MICROMETRES.cell).toBeLessThan(REAL_MICROMETRES.swimmer); expect(REAL_MICROMETRES.swimmer).toBeLessThan(REAL_MICROMETRES.drop);
  });
  it('each picture draws its two things in the true proportion (within a fifth)', () => {
    for (const stop of SCALE_STOPS) {
      if (!stop.small) continue;
      const drawn = stop.bigUnits / stop.smallUnits, real = timesLonger(stop.big, stop.small);
      expect(drawn / real, stop.id).toBeGreaterThan(0.8); expect(drawn / real, stop.id).toBeLessThan(1.2);
    }
  });
  it('each dive magnifies, and a deeper dive takes longer but never drags', () => {
    for (let i = 0; i < LAST_STOP; i++) { expect(zoomFactor(i), String(i)).toBeGreaterThan(5); expect(zoomMs(i)).toBeGreaterThanOrEqual(900); expect(zoomMs(i)).toBeLessThanOrEqual(2100); }
    expect(zoomFactor(LAST_STOP)).toBe(1);
    expect(zoomMs(1)).toBeGreaterThan(zoomMs(2));
  });
  it('the landing view never goes flat', () => {
    expect(LAND_TILT).toBeGreaterThan(0.05); expect(LAND_TILT).toBeLessThan(VIEW_TILT);
    expect(landFrame(0).tilt).toBeCloseTo(VIEW_TILT); expect(landFrame(1).tilt).toBeCloseTo(LAND_TILT);
  });
});

describe('Tiny Structures: the kit pictures', () => {
  it('every picture is a kit file with a recorded source, and none of this activity’s own shows a child', () => {
    for (const art of TINY_KIT_ART) {
      expect(art.src).toMatch(/^\/visuals\/studio-v2\/(bop|makers|v30)\/[a-z0-9-]+\.webp$/); expect(art.src480).toBe(art.src.replace('.webp', '-480.webp'));
      expect(art.width).toBeGreaterThan(0); expect(art.height).toBeGreaterThan(0); expect(art.source.length).toBeGreaterThan(8);
      // The likeness register goes by file name: a picture of this activity that showed a child would need to say so.
      // No file of this activity's own shows a child; the children come from the shared library, whose names say so.
      if (art.src.includes('/tiny-builders-')) expect(art.src).not.toMatch(/bebe|gobgob|crew/);
      else if (art.src.includes('/makers/')) expect(art.src).toMatch(/\/kit-(bebe|aya|prop|tool)-[a-z-]+\.webp$/);
    }
    expect(MONITOR_SCREEN).toHaveLength(4);
    for (const [x, y] of MONITOR_SCREEN) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(1); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(1); }
  });
  it('the cues are eight words at most', () => {
    const en = TINY_BUILDERS_COPY.en, he = TINY_BUILDERS_COPY.he;
    for (const words of [en, he]) for (const cue of [words.build, words.whole, words.journey, words.landing, words.landed, words.cheer]) expect(cue.trim().split(/\s+/).length, cue).toBeLessThanOrEqual(8);
  });
});

describe('Tiny Structures: the simplifications are written down', () => {
  it('the rules file carries the SIMPLIFICATIONS note', () => {
    const src = readFileSync(path.join(here, 'tinyBuildersRules.ts'), 'utf8');
    expect(src).toMatch(/SIMPLIFICATIONS/);
    for (const point of ['three pairs', 'invented', 'not a simulation', 'squeeze', 'paramecium', 'electron']) expect(src).toContain(point);
  });
});
