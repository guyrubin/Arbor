import { describe, expect, it } from 'vitest';
import { BASE_Y, PROFILES, radiusAt, topY } from './bottleGeometry';
import { BOTTLE_SHAPES, BOTTLE_STICKERS, BOTTLE_TINTS, freshBottle, placeSticker, slotView, validBottle, type BottleStickerPlacement } from './bottleLabRules';
import {
  ARCH_STEPS, CHAPTERS, CHAPTER_WAIT_MS, DISPERSION, FINALE, FINALE_FILL, PLATE, RUB_NEED, TALLEST, archSecret, benchScale, blendedProfile, chapterReady, dealSitting, dropSlot, finalePose, frostShown,
  glassPath, hintFor, lensAir, lensWet, mixWeights, nextAct, nextFreeSlot, nextShape, noDeeds, oneShape, otherFinish, plateRow, profileRadius, pullLean, pullShape, pullStretch, ringRatio, ringStep, rubFade,
  rubStep, settleShape, soakFront, stageLayout, turnToFree, type Act, type Weights,
} from './glassworks';

const sum = (w: Weights) => w.round + w.tall + w.flask;
const STAGES: readonly [number, number][] = [[390, 770], [360, 640], [844, 326], [1024, 704], [1180, 700], [820, 1100], [1920, 1000]];

describe('one camera for the whole picture', () => {
  it('a ring is flat on the horizon, seen from above below it and from below above it', () => {
    expect(ringRatio(PLATE.horizon)).toBe(0);
    expect(ringRatio(PLATE.baseY)).toBeGreaterThan(0.3);
    expect(ringRatio(PLATE.horizon - 200)).toBeLessThan(0);
    expect(benchScale(PLATE.baseY)).toBe(1);
    expect(benchScale(PLATE.baseY + 100)).toBeGreaterThan(1);
    expect(benchScale(PLATE.benchFar)).toBeLessThan(1);
  });
  it.each(STAGES)('%i by %i: the bottle stands on the bench, whole and inside the stage', (w, h) => {
    const L = stageLayout(w, h);
    expect(L.portrait).toBe(h > w);
    expect(L.base.x).toBeCloseTo(w / 2, 6);
    // Its foot is on the bench (nearer than the far edge) and the tallest shape fits under the top.
    expect(plateRow(L, L.base.y)).toBeCloseTo(PLATE.baseY, 6);
    expect(L.base.y).toBeGreaterThan((PLATE.benchFar - L.y0) * L.k);
    expect(L.base.y - TALLEST * L.unit).toBeGreaterThan(0);
    expect(L.base.y).toBeLessThan(h * 0.86);
    // The widest shape leaves room on both sides.
    expect(180 * L.unit).toBeLessThan(w * 0.7);
    // The plate covers the stage: no edge of the room picture shows.
    expect(L.x0).toBeGreaterThanOrEqual(0); expect(L.x0 + w / L.k).toBeLessThanOrEqual(PLATE.width);
    expect(L.y0).toBeGreaterThanOrEqual(0); expect(L.y0 + h / L.k).toBeLessThanOrEqual(PLATE.height);
  });
  it.each(STAGES)('%i by %i: the discs, the sticker card and Aya are on the bench and reachable', (w, h) => {
    for (const ayaLeft of [true, false]) {
      const L = stageLayout(w, h, ayaLeft), far = (PLATE.benchFar - L.y0) * L.k;
      expect(L.discs).toHaveLength(4);
      for (const d of L.discs) { expect(d.x - L.discWidth / 2).toBeGreaterThanOrEqual(-L.discWidth * 0.1); expect(d.x + L.discWidth / 2).toBeLessThanOrEqual(w + L.discWidth * 0.1); expect(d.y).toBeGreaterThan(far); expect(d.y).toBeLessThan(h); }
      expect(new Set(L.discs.map(d => `${Math.round(d.x)},${Math.round(d.y)}`)).size).toBe(4);
      expect(L.card.stickers).toHaveLength(6);
      for (const s of L.card.stickers) { expect(s.x - L.card.size / 2).toBeGreaterThanOrEqual(L.card.x - 1); expect(s.x + L.card.size / 2).toBeLessThanOrEqual(L.card.x + L.card.width + 1); expect(s.y + L.card.size / 2).toBeLessThanOrEqual(h); }
      expect(L.card.x).toBeGreaterThanOrEqual(0); expect(L.card.x + L.card.width).toBeLessThanOrEqual(w);
      expect(L.card.size).toBeGreaterThanOrEqual(40);
      expect(L.aya.x).toBeGreaterThan(0); expect(L.aya.x).toBeLessThan(w); expect(L.aya.y).toBeGreaterThan(far);
      // Aya is on the side asked for, and on a wide stage the discs are on the other one.
      expect(L.aya.x < L.base.x).toBe(ayaLeft);
      if (!L.portrait) for (const d of L.discs) expect(d.x > L.base.x).toBe(ayaLeft);
    }
  });
  it('the finale raises the picture on a tall stage only, and never past the plate', () => {
    const rest = stageLayout(390, 770), up = stageLayout(390, 770, true, 1), wide = stageLayout(1180, 700, true, 1);
    expect(up.base.y).toBeLessThan(rest.base.y - 30);
    expect(up.y0 + 770 / up.k).toBeLessThanOrEqual(PLATE.height);
    expect(wide.base.y).toBe(stageLayout(1180, 700).base.y);
  });
  it('three arches, left to right, above the bench', () => {
    const L = stageLayout(1180, 700);
    expect(L.arches.map(a => a.x)).toEqual([...L.arches.map(a => a.x)].sort((a, b) => a - b));
    for (const a of L.arches) expect(a.y + a.height).toBeLessThanOrEqual((PLATE.benchFar - L.y0) * L.k + 1);
  });
});

describe('chapter one: the soft glass takes a shape', () => {
  it('up stretches it tall, down presses it round, sideways tilts it into a flask', () => {
    const lump: Weights = { round: 0.4, tall: 0.3, flask: 0.3 };
    expect(settleShape(pullShape(lump, 0, -0.5))).toBe('tall');
    expect(settleShape(pullShape(lump, 0, 0.5))).toBe('round');
    expect(settleShape(pullShape(lump, 0.6, 0))).toBe('flask');
    expect(settleShape(pullShape(lump, -0.6, 0))).toBe('flask');
    expect(pullShape(oneShape('round'), 0, -1)).toEqual(oneShape('tall'));
  });
  it('the weights always sum to one, whatever the finger does', () => {
    let w: Weights = { round: 0.2, tall: 0.5, flask: 0.3 };
    for (const [dx, dy] of [[0, 0], [0.1, -0.2], [-2, 3], [NaN, 0.3], [0.5, Infinity], [0.03, 0.01]] as const) {
      w = pullShape(w, dx, dy);
      expect(sum(w)).toBeCloseTo(1, 9);
      for (const s of BOTTLE_SHAPES) { expect(w[s]).toBeGreaterThanOrEqual(0); expect(w[s]).toBeLessThanOrEqual(1); }
    }
  });
  it('a small drag changes it a little; a touch that does not move changes nothing', () => {
    const from = oneShape('round');
    expect(pullShape(from, 0, 0)).toEqual(from);
    const little = pullShape(from, 0, -0.1), more = pullShape(from, 0, -0.3);
    expect(little.tall).toBeGreaterThan(0); expect(more.tall).toBeGreaterThan(little.tall);
    expect(settleShape(little)).toBe('round');
  });
  it('a tap walks through the three shapes and comes back', () => {
    expect([0, 1, 2].reduce(s => nextShape(s), 'round' as (typeof BOTTLE_SHAPES)[number])).toBe('round');
    expect(new Set(BOTTLE_SHAPES.map(nextShape)).size).toBe(3);
  });
  it('the glass follows the finger a little further, within its limits', () => {
    expect(pullStretch(-0.4)).toBeGreaterThan(1); expect(pullStretch(0.4)).toBeLessThan(1); expect(pullStretch(0)).toBe(1);
    expect(pullStretch(-99)).toBeLessThanOrEqual(1.22); expect(pullStretch(99)).toBeGreaterThanOrEqual(0.84);
    expect(pullLean(0.2)).toBeGreaterThan(0); expect(pullLean(-0.2)).toBeLessThan(0); expect(Math.abs(pullLean(9))).toBeLessThanOrEqual(13);
  });
  it.each(BOTTLE_SHAPES)('%s: a settled glass is exactly that shape\'s own profile', (shape) => {
    const p = blendedProfile(oneShape(shape), 64), top = topY(shape), h = BASE_Y - top;
    expect(p.height).toBeCloseTo(h, 6);
    for (const v of [0, 0.25, 0.5, 0.8, 1]) expect(profileRadius(p, v)).toBeCloseTo(radiusAt(shape, top + h * v), 0);
    expect(p.stickerRows.map(r => top + r * h)).toEqual(PROFILES[shape].rows.map(r => expect.closeTo(r, 6)));
    expect(p.sticker).toBeCloseTo(PROFILES[shape].sticker, 6);
  });
  it('half way between two shapes the glass is between them, never thinner than a neck', () => {
    const mid = blendedProfile(mixWeights(oneShape('round'), oneShape('tall'), 0.5), 64);
    const a = blendedProfile(oneShape('round'), 64), b = blendedProfile(oneShape('tall'), 64);
    expect(mid.height).toBeCloseTo((a.height + b.height) / 2, 6);
    for (let i = 0; i < 64; i++) { expect(mid.radius[i]).toBeCloseTo((a.radius[i] + b.radius[i]) / 2, 4); expect(mid.radius[i]).toBeGreaterThan(10); }
  });
});

describe('chapter two: colour and finish', () => {
  it('the colour climbs from the foot to over the lip and never falls back', () => {
    expect(soakFront(0)).toBe(0); expect(soakFront(1)).toBeGreaterThan(1);
    let last = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) { const f = soakFront(t); expect(f).toBeGreaterThanOrEqual(last); last = f; }
    expect(soakFront(NaN)).toBe(0); expect(soakFront(9)).toBe(soakFront(1));
  });
  it('enough rubbing changes the finish; a rub that stops fades away', () => {
    let p = 0;
    for (let i = 0; i < 26; i++) p = rubStep(p, 10, 100);
    expect(p).toBeCloseTo(1, 6);
    expect(rubStep(0, 100 * RUB_NEED, 100)).toBe(1);
    expect(rubStep(0.4, 5, 0)).toBe(0.4); expect(rubStep(0.4, NaN, 100)).toBe(0.4);
    expect(rubFade(0.5, 0.05)).toBeLessThan(0.5); expect(rubFade(0.01, 0.1)).toBe(0);
    expect(otherFinish('gloss')).toBe('frost'); expect(otherFinish('frost')).toBe('gloss');
  });
  it('the glass looks as frosted as the rub has made it, with no jump when the finish changes', () => {
    expect(frostShown('gloss', 0)).toBe(0); expect(frostShown('frost', 0)).toBe(1);
    expect(frostShown('gloss', 1)).toBe(frostShown('frost', 0));
    expect(frostShown('frost', 1)).toBe(frostShown('gloss', 0));
    expect(frostShown('gloss', 0.4)).toBeCloseTo(0.4, 9);
  });
});

describe('chapter three: stickers', () => {
  it('a tapped sticker goes to the free place that faces the child, middle row first', () => {
    const first = nextFreeSlot([], 0)!;
    expect(slotView(first, 0)).toMatchObject({ front: true, scaleX: 1, row: 1 });
    // Tap after tap fills only free places that face the front, never one twice.
    let list: readonly BottleStickerPlacement[] = [];
    for (let i = 0; i < 3; i++) { const slot = nextFreeSlot(list, 0)!; expect(slotView(slot, 0).front).toBe(true); list = placeSticker(list, 'sun', slot); }
    expect(new Set(list.map(s => s.slot)).size).toBe(3);
    expect(nextFreeSlot(list, 0)).toBeNull();
    expect(validBottle({ ...freshBottle(), stickers: list })).toBe(true);
  });
  it('when the front is full the bottle turns to a free side; six stickers is full', () => {
    let list: readonly BottleStickerPlacement[] = [];
    for (const slot of [0, 4, 8]) list = placeSticker(list, 'leaf', slot);
    const turn = turnToFree(list, 0)!;
    expect(nextFreeSlot(list, turn)).not.toBeNull();
    for (const slot of [1, 5, 9]) list = placeSticker(list, 'moon', slot);
    expect(nextFreeSlot(list, 0)).toBeNull(); expect(turnToFree(list, 0)).toBeNull(); expect(dropSlot(list, 0, 0, 1)).toBeNull();
  });
  it('a dropped sticker takes the nearest free place in its band, or none if it missed the glass', () => {
    expect(dropSlot([], 0, 0.05, 0)).toBe(0); expect(dropSlot([], 0, -0.1, 2)).toBe(8);
    expect(dropSlot([], 45, 0.6, 1)).toBe(4); expect(dropSlot([], 45, -0.6, 1)).toBe(7);
    expect(dropSlot([{ art: 'star', slot: 4 }], 45, 0.6, 1)).toBeNull();
    expect(dropSlot([], 0, 1.4, 1)).toBeNull(); expect(dropSlot([], 0, NaN, 1)).toBeNull();
    expect(dropSlot([], 0, 0, 7)).toBe(8);
  });
});

describe('the arc: three chapters, then the set-piece', () => {
  it('opening, shape, colour, dress, finale, done', () => {
    const acts: Act[] = ['opening']; while (acts[acts.length - 1] !== 'done') acts.push(nextAct(acts[acts.length - 1]));
    expect(acts).toEqual(['opening', ...CHAPTERS, 'finale', 'done']);
    expect(nextAct('done')).toBe('done');
  });
  it('a chapter\'s action shows once its thing has been tried, or after a patient wait', () => {
    const none = noDeeds();
    for (const c of CHAPTERS) { expect(chapterReady(c, none)).toBe(false); expect(chapterReady(c, none, CHAPTER_WAIT_MS)).toBe(true); }
    expect(chapterReady('shape', { ...none, shaped: 1 })).toBe(true);
    expect(chapterReady('colour', { ...none, coloured: 1 })).toBe(true); expect(chapterReady('colour', { ...none, rubbed: 1 })).toBe(true);
    expect(chapterReady('dress', { ...none, stuck: 1 })).toBe(true);
    // Something done in another chapter does not open this one.
    expect(chapterReady('colour', { ...none, shaped: 3 })).toBe(false); expect(chapterReady('dress', { ...none, coloured: 2, turned: 1 })).toBe(false);
  });
  it('the ghost hand shows each chapter\'s gesture until the child has done it', () => {
    const none = noDeeds();
    expect(hintFor('opening', none)).toBeNull(); expect(hintFor('finale', none)).toBeNull();
    expect(hintFor('shape', none)).toBe('pull'); expect(hintFor('shape', { ...none, shaped: 1 })).toBeNull();
    expect(hintFor('colour', none)).toBe('disc'); expect(hintFor('colour', { ...none, coloured: 1 })).toBe('rub'); expect(hintFor('colour', { ...none, coloured: 1, rubbed: 1 })).toBeNull();
    expect(hintFor('dress', none)).toBe('stickOn'); expect(hintFor('dress', { ...none, stuck: 1 })).toBe('turn'); expect(hintFor('dress', { ...none, stuck: 1, turned: 1 })).toBeNull();
  });
});

describe('a sitting is dealt, and no two alike', () => {
  it('the same seed deals the same sitting', () => {
    expect(dealSitting(12345, 2)).toEqual(dealSitting(12345, 2));
  });
  it('every deal is whole: all four discs with the clear one first, all six stickers, a lump that is no finished shape', () => {
    for (let seed = 1; seed < 60; seed++) for (const n of [0, 1, 2, 5]) {
      const s = dealSitting(seed * 7919, n);
      expect([...s.discs].sort()).toEqual([...BOTTLE_TINTS].sort()); expect(s.discs[0]).toBe('clear');
      expect([...s.card].sort()).toEqual([...BOTTLE_STICKERS].sort());
      expect(sum(s.lump)).toBeCloseTo(1, 9); expect(Math.max(s.lump.round, s.lump.tall, s.lump.flask)).toBeLessThan(0.95);
      expect(['day', 'warm', 'cool']).toContain(s.light); expect([-1, 1]).toContain(s.sunSide); expect(s.motes).toBeGreaterThanOrEqual(10);
    }
  });
  it('play again starts from a different lump, and seeds change the bench', () => {
    expect(new Set([0, 1, 2].map(n => settleShape(dealSitting(99, n).lump))).size).toBe(3);
    const orders = new Set(Array.from({ length: 30 }, (_, i) => dealSitting(1000 + i * 31).card.join()));
    expect(orders.size).toBeGreaterThan(10);
    expect(new Set(Array.from({ length: 30 }, (_, i) => dealSitting(1000 + i * 31).discs.join())).size).toBeGreaterThan(2);
  });
  it('odd seeds still deal', () => {
    for (const seed of [0, -5, NaN, Infinity, 2 ** 40]) expect(dealSitting(seed).discs).toHaveLength(4);
  });
});

describe('the set-piece', () => {
  it('the can comes, pours and goes; the water only rises; then the sun; then Aya behind the glass', () => {
    expect(finalePose(0)).toMatchObject({ can: 0, flow: false, water: 0, sun: 0, behind: 0, free: false });
    let water = -1, sun = -1, behind = -1, turn = -1, poured = false;
    for (let t = 0; t <= 9; t += 0.05) {
      const p = finalePose(t);
      expect(p.water).toBeGreaterThanOrEqual(water - 1e-9); expect(p.sun).toBeGreaterThanOrEqual(sun - 1e-9); expect(p.behind).toBeGreaterThanOrEqual(behind - 1e-9); expect(p.turn).toBeGreaterThanOrEqual(turn - 1e-9);
      water = p.water; sun = p.sun; behind = p.behind; turn = p.turn; poured ||= p.flow;
      if (p.flow) { expect(p.can).toBe(1); expect(p.tip).toBeGreaterThan(0.5); }
      for (const v of [p.can, p.tip, p.water, p.sun, p.dim, p.behind]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
    expect(poured).toBe(true);
    const end = finalePose(9);
    expect(end).toMatchObject({ can: 0, flow: false, water: 1, sun: 1, behind: 1, free: true, turn: 360 });
    // The order of the beats: the water is in before the sun is up, and the sun is up before Aya is behind.
    expect(finalePose(FINALE.sunFrom).water).toBeGreaterThan(0.8);
    expect(finalePose(FINALE.ayaFrom).sun).toBeGreaterThan(0.8);
    expect(finalePose(FINALE.free - 0.01).free).toBe(false);
    expect(FINALE_FILL).toBeGreaterThan(0.4); expect(FINALE_FILL).toBeLessThan(0.9);
  });
  it('with motion reduced it is a cut to the lit, filled bottle, and the bottle can be kept soon after', () => {
    expect(finalePose(0, true)).toMatchObject({ can: 0, flow: false, water: 1, sun: 1, behind: 1, turn: 0, free: false });
    expect(finalePose(FINALE.reducedFree, true).free).toBe(true);
    expect(finalePose(NaN).water).toBe(0);
  });
});

describe('light through glass', () => {
  it('empty, the view keeps its sides and reaches outward toward the edges', () => {
    expect(lensAir(0)).toBe(0);
    for (const u of [0.2, 0.5, 0.8, 1]) { expect(lensAir(u)).toBeGreaterThan(0); expect(lensAir(-u)).toBeCloseTo(-lensAir(u), 12); }
    expect(lensAir(1) / 1).toBeGreaterThan(lensAir(0.3) / 0.3);
    expect(lensAir(5)).toBe(lensAir(1));
  });
  it('full of water, the view is turned left for right and is larger in the middle', () => {
    expect(lensWet(0)).toBeCloseTo(0, 12);
    for (const u of [0.1, 0.5, 0.9]) { expect(lensWet(u)).toBeLessThan(0); expect(lensWet(-u)).toBeGreaterThan(0); }
    // Near the axis a step across the glass is a smaller step across the room: magnified.
    expect(Math.abs(lensWet(0.1)) / 0.1).toBeLessThan(1);
    // At the edge it reaches past the outline: the room beside the bottle is squeezed in.
    expect(Math.abs(lensWet(1))).toBeGreaterThan(1);
  });
  it('blue bends more than red, and an edge ray runs through more glass than a middle one', () => {
    expect(DISPERSION.red).toBeLessThan(DISPERSION.green); expect(DISPERSION.blue).toBeGreaterThan(DISPERSION.green);
    expect(glassPath(1)).toBe(1); expect(glassPath(0.2)).toBeGreaterThan(glassPath(0.8)); expect(Number.isFinite(glassPath(0))).toBe(true);
  });
});

describe('sound and the secret', () => {
  it('a tall bottle rings higher than a round one, a flask lowest, and water lowers the note', () => {
    expect(ringStep(oneShape('tall'))).toBeGreaterThan(ringStep(oneShape('round')));
    expect(ringStep(oneShape('round'))).toBeGreaterThan(ringStep(oneShape('flask')));
    for (const s of BOTTLE_SHAPES) { expect(ringStep(oneShape(s), 0.7)).toBeLessThan(ringStep(oneShape(s))); expect(ringStep(oneShape(s), 1)).toBeGreaterThanOrEqual(0); }
    expect(Number.isInteger(ringStep({ round: 0.3, tall: 0.5, flask: 0.2 }))).toBe(true);
  });
  it('all three arches, in any order with nothing between, wake the rainbow', () => {
    expect(new Set(ARCH_STEPS).size).toBe(3);
    expect(archSecret([0, 1, 2])).toBe(true); expect(archSecret([2, 0, 1])).toBe(true); expect(archSecret([1, 1, 0, 2, 1])).toBe(true);
    expect(archSecret([0, 1])).toBe(false); expect(archSecret([0, 1, 1])).toBe(false); expect(archSecret([0, 1, 2, 2])).toBe(false);
  });
});
