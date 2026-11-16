/** Every frame of every film is a pure function of (reel, frame, clay): the
 * same frame renders to the same markup whether it is reached playing,
 * scrubbing or running backwards, and neighbouring frames really differ. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClayScene, CurtainCallScene } from './ClayScene';
import { FRESH_HANDS, REELS, lastFrame, pressPrint, setPorthole, showFor, timeOf, type ReelId } from './clayTheatreRules';
import { CALL_SECONDS, TOY_TAIL, heroPlace, liveTouches, toySpots, type Touch } from './clayHands';

const draw = (reel: ReelId, frame: number, lite = false) => renderToStaticMarkup(<ClayScene reel={reel} frame={frame} body="red" trim="green" lite={lite} />);

describe('ClayScene draws a frame from the frame number alone', () => {
  it.each(REELS)('%s: a frame scrubbed to backwards is identical to the frame played forwards', reel => {
    const end = lastFrame(reel);
    const forward = Array.from({ length: end + 1 }, (_, f) => draw(reel, f));
    const backward = Array.from({ length: end + 1 }, (_, i) => draw(reel, end - i)).reverse();
    expect(backward).toEqual(forward);
    // Random access: jump around, then come back.
    for (const f of [end, 0, Math.floor(end / 2), 3, end - 1]) expect(draw(reel, f)).toBe(forward[f]);
  }, 60_000);
  it.each(REELS)('%s: the film moves (no two neighbouring frames are the same picture while it runs)', reel => {
    const end = lastFrame(reel);
    let same = 0;
    for (let f = 1; f <= end; f++) if (draw(reel, f) === draw(reel, f - 1)) same++;
    expect(same).toBe(0);
  }, 60_000);
  it('the clay colours reach the scene, and the strip frames are the same film without the stage', () => {
    const red = draw('rocket', 10), blue = renderToStaticMarkup(<ClayScene reel="rocket" frame={10} body="blue" trim="green" />);
    expect(red).not.toBe(blue); expect(red).toContain('--mk-poppy'); expect(blue).toContain('--mk-water');
    const lite = draw('rocket', 10, true);
    expect(lite).not.toContain('ct-frame'); expect(lite).not.toContain('<filter'); expect(red).toContain('ct-frame');
  });
  it('no raw colour literal in any frame (all colour is palette tokens)', () => {
    for (const reel of REELS) for (const f of [0, 40, lastFrame(reel)]) expect(draw(reel, f)).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?!-)|rgba?\(|hsla?\(/);
  });
  it('particles stay capped: the busiest splash frame draws a bounded number of shapes', () => {
    let most = 0;
    for (let f = 0; f <= lastFrame('jump'); f++) most = Math.max(most, (draw('jump', f).match(/<circle/g) ?? []).length);
    expect(most).toBeLessThan(160);
  }, 60_000);
  it('the felt curtain, not cardboard, dresses the stage; drawn across, it hides the film', () => {
    const open = draw('jump', 30), shut = renderToStaticMarkup(<ClayScene reel="jump" frame={30} body="red" trim="green" drapes={1} />);
    expect(open).toContain('ct-frame'); expect(shut).not.toBe(open); expect(open).toContain('--mk-teal');
  });
});

describe("the child's hands change the frame, purely", () => {
  const hands = setPorthole(pressPrint(pressPrint(FRESH_HANDS, [-20, 6]), [30, -8]), 2);
  const withHands = (reel: ReelId, frame: number, touches: readonly Touch[] = [], hand = 0) => renderToStaticMarkup(<ClayScene reel={reel} frame={frame} body="red" trim="green" hands={hands} touches={liveTouches(touches, hand)} />);
  it('the same frame, choices and touch ages draw the same picture from any direction', () => {
    const press: Touch = { key: 1, toy: 'clayHero', index: 0, x: 200, y: 180, dir: 1, born: 0, lifted: 3 };
    const forward = Array.from({ length: 97 }, (_, f) => withHands('rocket', f, [press], 5));
    const backward = Array.from({ length: 97 }, (_, i) => withHands('rocket', 96 - i, [press], 5)).reverse();
    expect(backward).toEqual(forward);
  }, 60_000);
  it('thumbprints and the chosen porthole are in the film; a live press dents and squashes it', () => {
    expect(withHands('rocket', 12)).not.toBe(draw('rocket', 12)); expect(withHands('jump', 46)).not.toBe(draw('jump', 46));
    expect(withHands('rocket', 66)).not.toBe(renderToStaticMarkup(<ClayScene reel="rocket" frame={66} body="red" trim="green" hands={setPorthole(hands, 0)} />));
    const hero = heroPlace('rocket', timeOf(12), hands);
    const held: Touch = { key: 1, toy: 'clayHero', index: 0, x: hero.cx, y: hero.cy, dir: 1, born: 0, lifted: null };
    const pressed = withHands('rocket', 12, [held], 4);
    expect(pressed).not.toBe(withHands('rocket', 12)); expect(pressed).toMatch(/scale\(1\.\d+ 0\.\d+\)/);
  });
  it('once a touch has run out, the frame is exactly the film again (no residue, nothing leaks)', () => {
    for (const reel of REELS) {
      const t = timeOf(20), touches: Touch[] = toySpots(reel, t).map((s, i) => ({ key: i + 1, toy: s.toy, index: s.index, x: s.x, y: s.y, dir: 1, born: 0, lifted: 1 }));
      touches.push({ key: 90, toy: 'openAir', index: 0, x: 120, y: 80, dir: 1, born: 0, lifted: 0 }, { key: 91, toy: 'deepWater', index: 0, x: 120, y: 250, dir: -1, born: 0, lifted: 0 }, { key: 92, toy: 'seaSkin', index: 0, x: 300, y: 240, dir: 1, born: 0, lifted: 0 }, { key: 93, toy: 'cometWish', index: 0, x: 0, y: 0, dir: 1, born: 0, lifted: 0 }, { key: 94, toy: 'feltDrape', index: 0, x: 5, y: 100, dir: 1, born: 0, lifted: 0 });
      const during = withHands(reel, 20, touches, 3), after = withHands(reel, 20, touches, 2 + Math.max(...Object.values(TOY_TAIL)));
      expect(during).not.toBe(withHands(reel, 20)); expect(after).toBe(withHands(reel, 20));
      expect(during).not.toMatch(/NaN|undefined/);
    }
  });
  it('each show dresses the sets differently, and the same show the same way', () => {
    const show = (n: number, reel: ReelId) => renderToStaticMarkup(<ClayScene reel={reel} frame={24} body="red" trim="green" show={showFor(n)} />);
    for (const reel of ['rocket', 'jump', 'frog'] as const) { expect(show(1, reel)).not.toBe(show(0, reel)); expect(show(3, reel)).toBe(show(0, reel)); expect(show(0, reel)).toBe(draw(reel, 24)); }
  });
});

describe('the curtain call is drawn from its frame alone', () => {
  const call = (frame: number, frogToo = true) => renderToStaticMarkup(<CurtainCallScene frame={frame} body="blue" trim="yellow" frogToo={frogToo} />);
  it('the same frame is the same picture; the cast, the bows and the roses are all in it', () => {
    const end = Math.round(CALL_SECONDS * 12);
    const forward = Array.from({ length: end + 1 }, (_, f) => call(f)), backward = Array.from({ length: end + 1 }, (_, i) => call(end - i)).reverse();
    expect(backward).toEqual(forward);
    expect(call(6)).toContain('ct-body'); expect(call(6)).toContain('ct-aya'); expect(call(6)).toContain('ct-frog'); expect(call(6, false)).not.toContain('ct-frog');
    expect(call(16)).not.toBe(call(15)); expect(call(end)).not.toMatch(/NaN|undefined|#[0-9a-fA-F]{3,8}\b(?!-)|rgba?\(|hsla?\(/);
  }, 60_000);
});
