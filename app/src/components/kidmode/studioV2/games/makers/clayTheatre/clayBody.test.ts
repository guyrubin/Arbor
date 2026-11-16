/** The clay itself: one outline per hero that is pulled out of the same lump,
 * the pieces that grow with each pull, poses, presses and the stop-motion
 * boil. Geometry only; how it is painted is a rendered check. */
import { describe, expect, it } from 'vitest';
import { BODY_VERTICES, LUMP_BODY, seeded, type Pt } from './clayShapes';
import {
  BUDDY_ACTS, FULL_PULLS, HEROES, HERO_IDS, NO_PULLS, PULL_IDS, boilOutline, buddyParts, buddyPose, heroDrop, heroHit, heroOutline, heroPieces, posePoint, pressOutline, pullShares, shaped, unposePoint,
  type BuddyId, type Pose,
} from './clayBody';

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const POSES: Pose[] = [{ x: 0, y: 0, rot: 0, sx: 1, sy: 1, flip: 1 }, { x: 120, y: 80, rot: 35, sx: 1.1, sy: 0.9, flip: 1 }, { x: 300, y: 40, rot: -60, sx: 0.9, sy: 1.2, flip: -1 }];

describe('one outline, pulled out of a lump', () => {
  it.each(HERO_IDS)('%s: the lump, the hero and every in-between share the same vertices', hero => {
    for (const pulls of [NO_PULLS, FULL_PULLS, { front: 0.4, back: 1, top: 0 }]) expect(heroOutline(hero, pulls)).toHaveLength(BODY_VERTICES);
    expect(HEROES[hero].body).toHaveLength(BODY_VERTICES); expect(LUMP_BODY).toHaveLength(BODY_VERTICES);
  });
  it('every hero starts as the same hand-rolled lump', () => {
    const lump = heroOutline('whale', NO_PULLS);
    for (const hero of HERO_IDS) expect(heroOutline(hero, NO_PULLS)).toEqual(lump);
    lump.forEach((p, i) => expect(dist(p, LUMP_BODY[i])).toBeLessThan(3));
  });
  it.each(HERO_IDS)('%s: fully pulled, the outline is the hero', hero => {
    heroOutline(hero, FULL_PULLS).forEach((p, i) => expect(dist(p, HEROES[hero].body[i])).toBeLessThan(1e-9));
  });
  it.each(HERO_IDS)('%s: each pull owns a share of the clay, and the three shares of a vertex add to one', hero => {
    const shares = pullShares(HEROES[hero]);
    for (const share of shares) expect(share.front + share.back + share.top).toBeCloseTo(1, 9);
    for (const id of PULL_IDS) { expect(shares.some(s => s[id] > 0.8)).toBe(true); expect(shares.some(s => s[id] < 0.1)).toBe(true); }
  });
  it.each(HERO_IDS)('%s: one pull moves its own part and leaves the far side of the lump alone', hero => {
    const lump = heroOutline(hero, NO_PULLS), shares = pullShares(HEROES[hero]);
    for (const id of PULL_IDS) {
      const pulled = heroOutline(hero, { ...NO_PULLS, [id]: 1 });
      const mine = shares.map((s, i) => ({ own: s[id], moved: dist(pulled[i], lump[i]) }));
      const most = Math.max(...mine.map(m => m.moved));
      expect(most).toBeGreaterThan(4);
      // A pull is always seen: it grows a piece, or it moves the outline a long way.
      expect(HEROES[hero].pieces.some(p => p.pull === id) || most > 12).toBe(true);
      for (const m of mine.filter(v => v.own < 0.02)) expect(m.moved).toBeLessThan(4);
    }
  });
  it('a half pull is a real in-between, not a jump', () => {
    const a = heroOutline('whale', NO_PULLS), half = heroOutline('whale', { front: 0.5, back: 0.5, top: 0.5 }), b = heroOutline('whale', FULL_PULLS);
    half.forEach((p, i) => { expect(p[0]).toBeCloseTo((a[i][0] + b[i][0]) / 2, 9); expect(p[1]).toBeCloseTo((a[i][1] + b[i][1]) / 2, 9); });
    expect(shaped(NO_PULLS)).toBe(0); expect(shaped(FULL_PULLS)).toBe(1); expect(shaped({ front: 1, back: 0, top: 0 })).toBeCloseTo(1 / 3);
  });
});

describe('the pieces stuck on', () => {
  it.each(HERO_IDS)('%s: a bare lump has none; the finished hero has them all', hero => {
    expect(heroPieces(hero, NO_PULLS)).toHaveLength(0);
    expect(heroPieces(hero, FULL_PULLS)).toHaveLength(HEROES[hero].pieces.length);
  });
  it.each(HERO_IDS)('%s: each piece grows out with its own pull and no other', hero => {
    for (const id of PULL_IDS) {
      const grown = heroPieces(hero, { ...NO_PULLS, [id]: 1 });
      expect(grown.every(p => p.piece.pull === id)).toBe(true);
      expect(grown).toHaveLength(HEROES[hero].pieces.filter(p => p.pull === id).length);
    }
  });
  it('a piece half out is smaller than the piece fully out', () => {
    const half = heroPieces('whale', { ...NO_PULLS, back: 0.4 }), full = heroPieces('whale', { ...NO_PULLS, back: 1 });
    const reach = (pts: readonly Pt[]) => Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0]));
    expect(half[0].grow).toBeLessThan(full[0].grow); expect(reach(half[0].points)).toBeLessThan(reach(full[0].points));
  });
  it('every hero can see: eyes or a porthole', () => {
    for (const hero of HERO_IDS) expect(HEROES[hero].pieces.some(p => p.kind === 'eye' || p.kind === 'porthole')).toBe(true);
  });
});

describe('poses', () => {
  it.each(HERO_IDS)('%s: a point placed on the set comes back to the same place in the clay', hero => {
    for (const pose of POSES) for (const p of [[0, 0], [40, -20], [-80, 30]] as Pt[]) {
      const back = unposePoint(hero, pose, posePoint(hero, pose, p));
      expect(back[0]).toBeCloseTo(p[0], 8); expect(back[1]).toBeCloseTo(p[1], 8);
    }
  });
  it('the rocket stands on its tail: its nose is above its middle', () => {
    const rest = POSES[0];
    expect(posePoint('rocket', rest, [100, 0])[1]).toBeLessThan(-50);
    expect(posePoint('whale', rest, [80, 0])[0]).toBeGreaterThan(50);
    expect(posePoint('whale', { ...rest, flip: -1 }, [80, 0])[0]).toBeLessThan(-50);
  });
  it.each(HERO_IDS)('%s: sits a positive distance above its lowest point, and can be touched', hero => {
    expect(heroDrop(hero, FULL_PULLS)).toBeGreaterThan(10); expect(heroDrop(hero, NO_PULLS)).toBeGreaterThan(10);
    const pose = POSES[1];
    expect(heroHit(hero, FULL_PULLS, pose, [pose.x, pose.y])).toBe(true);
    expect(heroHit(hero, FULL_PULLS, pose, [pose.x + 260, pose.y + 200])).toBe(false);
  });
});

describe('the boil and the press', () => {
  const outline = heroOutline('frog', FULL_PULLS);
  it('a held drawing is still; a new drawing never lands in quite the same place', () => {
    expect(boilOutline(outline, 7, 1)).toEqual(boilOutline(outline, 7, 1));
    expect(boilOutline(outline, 8, 1)).not.toEqual(boilOutline(outline, 7, 1));
    expect(boilOutline(outline, 7, 2)).not.toEqual(boilOutline(outline, 7, 1));
  });
  it('moves every vertex a little, and none of them far', () => {
    for (let drawing = 0; drawing < 12; drawing++) {
      const moved = boilOutline(outline, drawing, 1, 0.9).map((p, i) => dist(p, outline[i]));
      expect(Math.max(...moved)).toBeLessThan(2); expect(Math.max(...moved)).toBeGreaterThan(0.2);
    }
  });
  it('is off when asked to be (motion reduced)', () => { expect(boilOutline(outline, 4, 1, 0)).toEqual(outline); });
  it('a press flattens the clay under the finger', () => {
    const top = Math.min(...outline.map(p => p[1])), pressed = pressOutline(outline, [0, top], 1);
    expect(Math.min(...pressed.map(p => p[1]))).toBeGreaterThan(top + 2);
    expect(pressOutline(outline, [0, top], 0)).toEqual(outline);
  });
  it('seeded numbers are stable and inside [0, 1)', () => {
    for (let i = 0; i < 50; i++) { const v = seeded(i, 3); expect(v).toBe(seeded(i, 3)); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('the friend', () => {
  const IDS: BuddyId[] = ['seaBird', 'starlet', 'dragonfly', 'ladybird'];
  it.each(IDS)('%s: is made of clay parts, and moves between beats', id => {
    const a = buddyParts(id, 0), b = buddyParts(id, 0.25);
    expect(a.length).toBeGreaterThan(0);
    for (const part of a) expect(part.points.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
  it('hops off the floor and lands again, spins all the way round, or sways side to side', () => {
    const at: Pt = [200, 220], hops = Array.from({ length: 8 }, (_, d) => buddyPose('hopAct', at, d));
    expect(Math.min(...hops.map(h => h.y))).toBeLessThan(at[1] - 15); expect(Math.max(...hops.map(h => h.y))).toBeCloseTo(at[1]);
    const spins = Array.from({ length: 8 }, (_, d) => buddyPose('spinAct', at, d).rot);
    expect(new Set(spins).size).toBe(8); expect(Math.max(...spins)).toBeGreaterThan(300);
    const sways = Array.from({ length: 8 }, (_, d) => buddyPose('swayAct', at, d).x);
    expect(Math.min(...sways)).toBeLessThan(at[0] - 8); expect(Math.max(...sways)).toBeGreaterThan(at[0] + 8);
    expect(buddyPose('hopAct', at, 3)).toEqual(buddyPose('hopAct', at, 11));
    expect(BUDDY_ACTS).toHaveLength(3);
  });
});
