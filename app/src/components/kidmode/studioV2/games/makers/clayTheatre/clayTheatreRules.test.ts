/** Clay Theatre's rules: stop-motion time, the show from film can to
 * premiere, the film the projector makes from the child's six poses, and the
 * stage layout. Everything is pure, so a whole sitting is played here. */
import { describe, expect, it } from 'vitest';
import {
  CHAPTERS, CLAY_IDS, CREW, FPS, GEL_IDS, GROUND, MAX_PRINTS, PREMIERE, PULL_ENOUGH, PULL_REACH, ROOM, SET_W, SHOTS, STEPS, STORIES, STORY_IDS, TUNES, TUNE_IDS, TWOS,
  carriedPose, chaptersDone, chooseStory, clayLine, coloured, crewMood, directDone, directJobs, drawingAt, drawingPose, filmBeats, filmDone, filmDrawings, filmFrames, frameOfKey, heroOf, keyNear,
  knead, lumpPose, movedEnough, newShow, nextAct, nextKnead, nextPull, placeBuddy, premiereAt, premiereSeconds, pressPrint, pull, pullAmount, pullsDone, setGel, setTune, shapeDone, shoot,
  showLook, stageLayout, startPose, storiesFor, toAnimate, toDirect, toPremiere, toPx, toSet, unshoot,
  type Field, type Show,
} from './clayTheatreRules';
import { BUDDY_ACTS, FULL_PULLS, HEROES, PULL_IDS, heroDrop, type Pose } from './clayBody';

const FIELD: Field = { x0: 20, x1: 380, y0: 20, y1: GROUND };
const pose = (x: number, y: number, extra: Partial<Pose> = {}): Pose => ({ x, y, rot: 0, sx: 1, sy: 1, flip: 1, ...extra });
/** A show with the hero shaped and coloured, ready for the camera. */
function shaped(story = STORY_IDS[0], seed = 3): Show {
  let show = chooseStory(newShow(seed), story);
  show = knead(knead(show, 'blue'), 'yellow');
  for (const id of PULL_IDS) show = pull(show, id);
  return show;
}
/** Six shots along a jump, taken through the same rules the camera uses. */
function filmed(story = STORY_IDS[0], seed = 3): Show {
  let show = toAnimate(shaped(story, seed));
  const hero = heroOf(show), start = startPose(show);
  const path: [number, number][] = [[0, 0], [30, -40], [60, -80], [90, -90], [120, -50], [150, 0]];
  path.forEach(([dx, dy], i) => { show = shoot(show, i === 0 ? start : carriedPose(hero, show.keys[show.keys.length - 1], start.x + dx * start.flip, start.y + dy, FIELD)); });
  return show;
}

describe('stop-motion time: twelve frames a second, every drawing held for two', () => {
  it('is on twos', () => { expect(FPS).toBe(12); expect(TWOS).toBe(2); expect(SHOTS).toBe(6); });
  it('lays three in-betweens between two of the child’s poses', () => {
    expect(filmDrawings(0)).toBe(0); expect(filmDrawings(1)).toBe(1); expect(filmDrawings(2)).toBe(STEPS + 1);
    expect(filmDrawings(SHOTS)).toBe((SHOTS - 1) * STEPS + 1);
    expect(filmFrames(SHOTS)).toBe(filmDrawings(SHOTS) * TWOS);
    // Six poses run for three and a half seconds.
    expect(filmFrames(SHOTS) / FPS).toBe(3.5);
  });
  it('shows the same drawing on both frames of a pair, and the child’s own pose on its frame', () => {
    for (let f = 0; f < filmFrames(SHOTS); f += 2) expect(drawingAt(f, SHOTS)).toBe(drawingAt(f + 1, SHOTS));
    for (let key = 0; key < SHOTS; key++) { expect(drawingAt(frameOfKey(key), SHOTS)).toBe(key * STEPS); expect(keyNear(frameOfKey(key), SHOTS)).toBe(key); }
    expect(drawingAt(9999, SHOTS)).toBe(filmDrawings(SHOTS) - 1); expect(drawingAt(-5, SHOTS)).toBe(0);
  });
});

describe('the film cans', () => {
  it('holds four films, each with its own hero and its own friend', () => {
    expect(STORY_IDS).toHaveLength(4);
    expect(new Set(STORY_IDS.map(id => STORIES[id].hero)).size).toBe(4);
    expect(new Set(STORY_IDS.map(id => STORIES[id].buddy)).size).toBe(4);
    for (const id of STORY_IDS) { expect(STORIES[id].clay[0]).not.toBe(STORIES[id].clay[1]); expect(HEROES[STORIES[id].hero]).toBeDefined(); }
  });
  it('offers all four every time, in an order that belongs to the round', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed < 40; seed++) { const offered = storiesFor(seed); expect([...offered].sort()).toEqual([...STORY_IDS].sort()); orders.add(offered.join()); }
    expect(orders.size).toBeGreaterThan(1);
    expect(storiesFor(12)).toEqual(storiesFor(12));
  });
  it('dresses each round differently, and the same round the same way', () => {
    expect(showLook(5)).toEqual(showLook(5));
    const looks = Array.from({ length: 30 }, (_, i) => showLook(i + 1));
    for (const look of looks) { expect([...look.lumps].sort()).toEqual([...CLAY_IDS].sort()); expect([1, -1]).toContain(look.side); expect(look.hour).toBeGreaterThanOrEqual(0); expect(look.hour).toBeLessThan(3); }
    expect(new Set(looks.map(l => l.lumps.join())).size).toBeGreaterThan(5);
    expect(new Set(looks.map(l => l.side)).size).toBe(2);
    expect(new Set(looks.map(l => l.hour)).size).toBe(3);
  });
});

describe('chapter 1: shape and colour', () => {
  it('starts at the cans and waits there for a can', () => {
    const show = newShow(1);
    expect(show.chapter).toBe('cans'); expect(knead(show, 'red')).toBe(show); expect(pull(show, 'front')).toBe(show);
    expect(chooseStory(show, 'frogPond')).toMatchObject({ chapter: 'shape', story: 'frogPond' });
  });
  it('kneads the body first, then the trim, then each in turn', () => {
    let show = chooseStory(newShow(1), 'whaleJump');
    expect(nextKnead(show)).toBe('body');
    show = knead(show, 'blue'); expect(show.body).toBe('blue'); expect(coloured(show)).toBe(false); expect(nextKnead(show)).toBe('trim');
    show = knead(show, 'yellow'); expect(show.trim).toBe('yellow'); expect(coloured(show)).toBe(true);
    show = knead(show, 'red'); expect(show).toMatchObject({ body: 'red', trim: 'yellow' });
    show = knead(show, 'green'); expect(show).toMatchObject({ body: 'red', trim: 'green' });
  });
  it('does not knead the same clay in twice: the show comes back unchanged, never an error', () => {
    let show = knead(chooseStory(newShow(1), 'whaleJump'), 'blue');
    expect(knead(show, 'blue')).toBe(show);
    show = knead(show, 'yellow');
    expect(knead(show, 'yellow')).toBe(show);
  });
  it('pulls the three parts of the hero out of the lump, in any order', () => {
    let show = knead(knead(chooseStory(newShow(1), 'moonRocket'), 'red'), 'yellow');
    expect(nextPull(show)).toBe('front'); expect(shapeDone(show)).toBe(false);
    show = pull(show, 'top'); expect(pullsDone(show)).toBe(1); expect(nextPull(show)).toBe('front');
    expect(pull(show, 'top')).toBe(show);
    show = pull(pull(show, 'back'), 'front');
    expect(nextPull(show)).toBeNull(); expect(shapeDone(show)).toBe(true);
  });
  it('needs both the colour and the shape before the camera comes out', () => {
    let show = chooseStory(newShow(1), 'whaleJump');
    for (const id of PULL_IDS) show = pull(show, id);
    expect(shapeDone(show)).toBe(false); expect(toAnimate(show)).toBe(show);
    show = knead(knead(show, 'blue'), 'red');
    expect(toAnimate(show).chapter).toBe('animate');
  });
  it('reads a drag along the handle as a pull, and nothing for a drag the other way', () => {
    expect(pullAmount([1, 0], [PULL_REACH, 0])).toBe(1);
    expect(pullAmount([1, 0], [PULL_REACH / 2, 30])).toBeCloseTo(0.5);
    expect(pullAmount([1, 0], [-40, 0])).toBe(0);
    expect(pullAmount([0, -2], [0, -PULL_REACH * 3])).toBeLessThanOrEqual(1.15);
    expect(PULL_ENOUGH).toBeGreaterThan(0.3); expect(PULL_ENOUGH).toBeLessThan(0.8);
  });
  it('keeps a thumbprint in the clay’s own coordinates, the newest few only', () => {
    let show = shaped();
    for (let i = 0; i < 9; i++) show = pressPrint(show, [i * 20 - 80, i * 5 - 20]);
    expect(show.prints).toHaveLength(MAX_PRINTS);
    for (const print of show.prints) { expect(Math.abs(print.x)).toBeLessThanOrEqual(70); expect(Math.abs(print.y)).toBeLessThanOrEqual(34); }
    const again = pressPrint(show, [show.prints[0].x + 2, show.prints[0].y]);
    expect(again.prints).toHaveLength(MAX_PRINTS);
  });
  it('seats the lump and the finished hero on the stage floor', () => {
    for (const story of STORY_IDS) {
      const raw = chooseStory(newShow(4), story), lump = lumpPose(raw), done = shaped(story, 4), start = startPose(done), hero = heroOf(done);
      expect(lump.y + heroDrop(hero, raw.pulls, lump)).toBeCloseTo(GROUND, 5);
      expect(start.y + heroDrop(hero, FULL_PULLS, start)).toBeCloseTo(GROUND, 5);
      expect(start.x).toBeGreaterThan(40); expect(start.x).toBeLessThan(SET_W - 40);
    }
  });
});

describe('chapter 2: animate', () => {
  it('always takes the first frame, and after that only a pose that changed', () => {
    let show = toAnimate(shaped());
    const start = startPose(show);
    show = shoot(show, start); expect(show.keys).toHaveLength(1);
    expect(shoot(show, start)).toBe(show);
    expect(shoot(show, { ...start, x: start.x + 3 })).toBe(show);
    expect(shoot(show, { ...start, x: start.x + 20 }).keys).toHaveLength(2);
    expect(shoot(show, { ...start, sx: 1.14, sy: 0.8 }).keys).toHaveLength(2);
  });
  it('stops at six frames, and can give the last one back', () => {
    const show = filmed();
    expect(show.keys).toHaveLength(SHOTS); expect(filmDone(show)).toBe(true);
    expect(shoot(show, pose(10, 10))).toBe(show);
    const undone = unshoot(show);
    expect(undone.keys).toHaveLength(SHOTS - 1); expect(filmDone(undone)).toBe(false); expect(toDirect(undone)).toBe(undone);
    expect(unshoot(toAnimate(shaped()))).toEqual(toAnimate(shaped()));
  });
  it('lets the clay answer how it is carried: it faces the way it goes and leans into a climb', () => {
    const from = pose(200, 200);
    const right = carriedPose('whale', from, 260, 150, FIELD), left = carriedPose('whale', from, 140, 150, FIELD);
    expect(right.flip).toBe(1); expect(left.flip).toBe(-1);
    expect(right.rot).toBeLessThan(0);                                   // nose up on the way up
    expect(carriedPose('whale', from, 260, 230, FIELD).rot).toBeGreaterThan(0);
    expect(right.sx).toBeGreaterThan(1); expect(right.sy).toBeLessThan(1); // a long step stretches it
    // The rocket points where it flies; straight up is no turn at all.
    const high = pose(200, 120);
    expect(carriedPose('rocket', high, 200, 60, FIELD).rot).toBeCloseTo(0);
    expect(carriedPose('rocket', high, 280, 120, FIELD).rot).toBeCloseTo(90);
    expect(carriedPose('rocket', high, 120, 120, FIELD).rot).toBeCloseTo(-90);
    expect(carriedPose('rocket', high, 120, 120, FIELD).flip).toBe(1);
    // The frog never turns round; it squats on the ground and stretches in the air.
    expect(carriedPose('frog', from, 120, 100, FIELD).flip).toBe(1);
    expect(carriedPose('frog', from, 240, 60, FIELD).sy).toBeGreaterThan(1);
  });
  it('keeps the hero on the set and never under the floor', () => {
    for (const hero of ['whale', 'rocket', 'frog', 'snail'] as const) {
      const from = pose(200, 150), down = carriedPose(hero, from, 900, 900, FIELD), up = carriedPose(hero, from, -900, -900, FIELD);
      expect(down.x).toBe(FIELD.x1); expect(up.x).toBe(FIELD.x0); expect(up.y).toBe(FIELD.y0);
      expect(down.y + heroDrop(hero, FULL_PULLS, { ...down, rot: 0, sx: 1, sy: 1 })).toBeLessThanOrEqual(GROUND + 1e-6);
    }
  });
  it('a pressed pose is squashed, and counts as a change', () => {
    const from = pose(200, 200), pressed = carriedPose('frog', from, 200, 200, FIELD, true), plain = carriedPose('frog', from, 200, 200, FIELD);
    expect(pressed.sy).toBeLessThan(plain.sy); expect(pressed.sx).toBeGreaterThan(plain.sx);
    expect(movedEnough(plain, pressed)).toBe(true); expect(movedEnough(plain, plain)).toBe(false);
  });
});

describe('the film the projector makes from six poses', () => {
  const show = filmed(), keys = show.keys, last = filmDrawings(keys.length) - 1;
  it('shows the child’s own pose, untouched, on every fourth drawing', () => {
    keys.forEach((key, i) => expect(drawingPose(keys, i * STEPS)).toBe(key));
    expect(drawingPose(keys, -3)).toBe(keys[0]); expect(drawingPose(keys, 999)).toBe(keys[keys.length - 1]);
    expect(drawingPose([], 0)).toBeNull(); expect(drawingPose([keys[0]], 7)).toBe(keys[0]);
  });
  it('lays real in-betweens between them: every drawing moves on from the one before', () => {
    for (let d = 1; d <= last; d++) {
      const a = drawingPose(keys, d - 1)!, b = drawingPose(keys, d)!;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0.5);
      const seg = Math.min(keys.length - 2, Math.floor(d / STEPS)), lo = Math.min(keys[seg].x, keys[seg + 1].x) - 12, hi = Math.max(keys[seg].x, keys[seg + 1].x) + 12;
      expect(b.x).toBeGreaterThanOrEqual(lo); expect(b.x).toBeLessThanOrEqual(hi);
    }
  });
  it('never carries the hero below the lower of the two poses it is between', () => {
    for (let d = 0; d <= last; d++) { const seg = Math.min(keys.length - 2, Math.floor(d / STEPS)); expect(drawingPose(keys, d)!.y).toBeLessThanOrEqual(Math.max(keys[seg].y, keys[seg + 1].y) + 1e-9); }
  });
  it('is the same film forwards, backwards and at random: a drawing depends only on its number', () => {
    const forward = Array.from({ length: last + 1 }, (_, d) => drawingPose(keys, d));
    const backward = Array.from({ length: last + 1 }, (_, i) => drawingPose(keys, last - i)).reverse();
    expect(backward).toEqual(forward);
    for (const d of [last, 0, 7, 3, last - 1]) expect(drawingPose(keys, d)).toEqual(forward[d]);
  });
  it('finds the moments an audience answers: the top of the jump and the longest step', () => {
    const beats = filmBeats(keys), top = keys.reduce((best, key, i) => (key.y < keys[best].y ? i : best), 0);
    expect(beats.apex).toBe(top * STEPS);
    expect(beats.leap).toBeGreaterThanOrEqual(0); expect(beats.leap).toBeLessThan(filmDrawings(keys.length));
  });
});

describe('chapter 3: direct', () => {
  it('opens only when the film is whole', () => {
    expect(toDirect(toAnimate(shaped()))).toMatchObject({ chapter: 'animate' });
    expect(toDirect(filmed()).chapter).toBe('direct');
  });
  it('brings the friend onto the set where it is dropped, kept inside the set', () => {
    let show = toDirect(filmed());
    expect(directDone(show)).toBe(false); expect(toPremiere(show)).toBe(show);
    show = placeBuddy(show, [-500, 900], FIELD);
    expect(show.buddy!.at[0]).toBe(FIELD.x0 + 20); expect(show.buddy!.at[1]).toBe(GROUND - 18); expect(show.buddy!.act).toBe(BUDDY_ACTS[0]);
    show = placeBuddy(show, [210, 120], FIELD);
    expect(show.buddy!.at).toEqual([210, 120]);
    expect(directDone(show)).toBe(true);
  });
  it('gives the friend its next act on a tap, round and round, and keeps the act when it is moved', () => {
    let show = placeBuddy(toDirect(filmed()), [200, 100], FIELD);
    const seen = [show.buddy!.act];
    for (let i = 0; i < BUDDY_ACTS.length; i++) { show = nextAct(show); seen.push(show.buddy!.act); }
    expect(seen.slice(0, BUDDY_ACTS.length)).toEqual([...BUDDY_ACTS]); expect(seen[BUDDY_ACTS.length]).toBe(BUDDY_ACTS[0]);
    show = nextAct(show);
    expect(placeBuddy(show, [100, 100], FIELD).buddy!.act).toBe(show.buddy!.act);
    expect(nextAct(toDirect(filmed())).buddy).toBeNull();
  });
  it('puts a gel on the lamp, takes it off again, and picks a tune', () => {
    let show = toDirect(filmed());
    expect(directJobs(show)).toEqual({ friend: false, light: false, tune: false });
    show = setGel(show, 'roseGel'); expect(show.gel).toBe('roseGel');
    show = setGel(show, 'blueGel'); expect(show.gel).toBe('blueGel');
    expect(setGel(show, 'blueGel').gel).toBe('clearGel');
    show = setTune(show, 'tuneB');
    expect(directJobs(placeBuddy(show, [200, 100], FIELD))).toEqual({ friend: true, light: true, tune: true });
    expect(GEL_IDS).toHaveLength(3); expect(TUNE_IDS).toHaveLength(3);
    for (const id of TUNE_IDS) { expect(TUNES[id]).toHaveLength(8); for (const step of TUNES[id]) { expect(step).toBeGreaterThanOrEqual(0); expect(step).toBeLessThan(20); } }
  });
  it('light and tune are the director’s choice: the premiere needs only the friend', () => {
    const show = placeBuddy(toDirect(filmed()), [200, 100], FIELD);
    expect(toPremiere(show).chapter).toBe('premiere');
  });
});

describe('a whole show, from the can to the premiere', () => {
  it.each(STORY_IDS)('%s: every chapter opens in turn and none can be skipped', story => {
    let show = chooseStory(newShow(9), story);
    expect(chaptersDone(show)).toEqual({ shape: false, animate: false, direct: false });
    expect(toAnimate(show)).toBe(show); expect(toDirect(show)).toBe(show); expect(toPremiere(show)).toBe(show);
    show = filmed(story, 9);
    expect(chaptersDone(show)).toEqual({ shape: true, animate: false, direct: false });
    expect(toPremiere(show)).toBe(show);
    show = toDirect(show);
    expect(chaptersDone(show)).toEqual({ shape: true, animate: true, direct: false });
    show = toPremiere(placeBuddy(show, STORIES[story].buddyHome, FIELD));
    expect(show.chapter).toBe('premiere'); expect(chaptersDone(show)).toEqual({ shape: true, animate: true, direct: true });
    // Nothing about how the child played is kept: only what the film is made of.
    expect(Object.keys(show).sort()).toEqual(['body', 'buddy', 'chapter', 'gel', 'keys', 'kneads', 'prints', 'pulls', 'seed', 'story', 'trim', 'tune']);
  });
  it('has three chapters', () => { expect(CHAPTERS).toEqual(['shape', 'animate', 'direct']); });
});

describe('the premiere', () => {
  const show = filmed(), keys = show.keys, frames = filmFrames(SHOTS), total = premiereSeconds(SHOTS);
  it('runs its phases in order: lights down, the film, a breath, the film again up close, lights up, applause', () => {
    const order: string[] = [];
    for (let t = 0; t <= total + 0.5; t += 0.05) { const phase = premiereAt(t, SHOTS).phase; if (order[order.length - 1] !== phase) order.push(phase); }
    expect(order).toEqual(['dim', 'roll', 'hold', 'encore', 'lights', 'applause', 'over']);
    expect(total).toBeGreaterThan(9); expect(total).toBeLessThan(15);
  });
  it('shows every frame of the film, twice, at twelve a second', () => {
    for (const phase of ['roll', 'encore'] as const) {
      const start = phase === 'roll' ? PREMIERE.dim : PREMIERE.dim + frames / FPS + PREMIERE.hold, seen = new Set<number>();
      for (let f = 0; f < frames; f++) { const moment = premiereAt(start + (f + 0.5) / FPS, SHOTS); expect(moment.phase).toBe(phase); seen.add(moment.frame); }
      expect(seen.size).toBe(frames);
    }
  });
  it('is dark while the film runs and light again for the applause', () => {
    expect(premiereAt(0, SHOTS).dark).toBe(0);
    expect(premiereAt(PREMIERE.dim + 1, SHOTS)).toMatchObject({ dark: 1, beam: 1, push: 0 });
    expect(premiereAt(PREMIERE.dim + frames / FPS + PREMIERE.hold + 1, SHOTS).push).toBe(1);
    expect(premiereAt(total - 1, SHOTS)).toMatchObject({ phase: 'applause', dark: 0, beam: 0 });
  });
  it('the crew watch, start at the top of the jump, turn to each other, and cheer at the end', () => {
    const beats = filmBeats(keys), atApex = premiereAt(PREMIERE.dim + ((beats.apex + 1) * TWOS + 0.5) / FPS, SHOTS);
    expect(CREW.some((_, i) => crewMood(i, atApex, keys) === 'gasping')).toBe(true);
    const hold = premiereAt(PREMIERE.dim + frames / FPS + 0.2, SHOTS);
    expect(CREW.every((_, i) => crewMood(i, hold, keys) === 'turning')).toBe(true);
    const clap = premiereAt(total - 1, SHOTS);
    expect(CREW.every((_, i) => crewMood(i, clap, keys) === 'cheering')).toBe(true);
    expect(CREW.every((_, i) => crewMood(i, premiereAt(0.2, SHOTS), keys) === 'watching')).toBe(true);
    const moods = new Set<string>();
    for (let t = 0; t <= total; t += 0.05) CREW.forEach((_, i) => moods.add(crewMood(i, premiereAt(t, SHOTS), keys)));
    expect([...moods].sort()).toEqual(['cheering', 'gasping', 'leaning', 'turning', 'watching']);
  });
});

describe('the stage for a room of any size', () => {
  const SIZES: [string, number, number][] = [['phone', 390, 768], ['phone on its side', 844, 314], ['tablet', 1024, 692], ['desktop', 1280, 724], ['small phone', 320, 520], ['wide desktop', 1920, 1000]];
  it.each(SIZES)('%s: the room covers the stage and the hero stands on the round dais', (_name, w, h) => {
    const L = stageLayout(w, h);
    expect(L.portrait).toBe(h >= w);
    expect(L.room.x).toBeLessThanOrEqual(0.5); expect(L.room.y).toBeLessThanOrEqual(0.5);
    expect(L.room.x + L.room.w).toBeGreaterThanOrEqual(w - 0.5); expect(L.room.y + L.room.h).toBeGreaterThanOrEqual(h - 0.5);
    // The set's floor line is the dais's own centre line in the picture, and the set's middle is the dais's middle.
    const [gx, gy] = toPx(L, [SET_W / 2, GROUND]);
    expect(gy).toBeCloseTo(L.room.y + ROOM.daisY * L.room.h, 3); expect(gx).toBeCloseTo(L.room.x + ROOM.daisX * L.room.w, 3);
    expect(gx).toBeCloseTo(w / 2, 3);
    // The hero is never tiny: a 200-unit animal is at least a fifth of the shorter side.
    expect(200 * L.unit).toBeGreaterThan(Math.min(w, h) * 0.2);
    expect(toSet(L, toPx(L, [123, 45]))[0]).toBeCloseTo(123); expect(toSet(L, toPx(L, [123, 45]))[1]).toBeCloseTo(45);
  });
  it.each(SIZES)('%s: the field, the cloth and every bench thing are on the stage', (_name, w, h) => {
    const L = stageLayout(w, h);
    expect(L.field.x1 - L.field.x0).toBeGreaterThan(200); expect(L.field.y1 - L.field.y0).toBeGreaterThan(90);
    const [fx0] = toPx(L, [L.field.x0, 0]), [fx1] = toPx(L, [L.field.x1, 0]);
    expect(fx0).toBeGreaterThanOrEqual(0); expect(fx1).toBeLessThanOrEqual(w);
    const [cx0, cy0] = toPx(L, [L.cloth.x, L.cloth.y]), [cx1, cy1] = toPx(L, [L.cloth.x + L.cloth.w, L.cloth.y + L.cloth.h]);
    expect(cx0).toBeGreaterThanOrEqual(-1); expect(cx1).toBeLessThanOrEqual(w + 1); expect(cy0).toBeGreaterThanOrEqual(0); expect(cy1).toBeLessThan(h);
    for (const box of [L.rug, L.lens, L.strip, L.cans, L.gels, L.tiles, L.friend, L.screen]) {
      expect(box.w).toBeGreaterThan(20); expect(box.h).toBeGreaterThan(16);
      expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.x + box.w).toBeLessThanOrEqual(w + 1); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.h).toBeLessThanOrEqual(h + 1);
    }
    // The film plays large: the screen is most of a phone's width, and at least a third of any stage's area's shorter side.
    expect(L.screen.w).toBeGreaterThan(Math.min(w * 0.5, h * 0.8)); if (L.portrait) expect(L.screen.w).toBeGreaterThan(w * 0.9);
  });
  it.each(SIZES)('%s: every story’s hero starts inside the field', (_name, w, h) => {
    const L = stageLayout(w, h);
    for (const story of STORY_IDS) for (const seed of [1, 2, 3, 4]) {
      const start = startPose(shaped(story, seed));
      expect(start.x).toBeGreaterThanOrEqual(L.field.x0); expect(start.x).toBeLessThanOrEqual(L.field.x1);
    }
  });
  it('survives a stage that has no size yet', () => {
    const L = stageLayout(0, 0);
    expect(Number.isFinite(L.unit)).toBe(true); expect(L.unit).toBeGreaterThan(0);
  });
});

describe('words', () => {
  it('fills numbered blanks', () => { expect(clayLine('frame {0} of {1}', 2, 6)).toBe('frame 2 of 6'); expect(clayLine('Film can: {0}', 'x')).toBe('Film can: x'); expect(clayLine('{0}{1}', 'a')).toBe('a'); });
});
