/** Every frame of every film is a pure function of (reel, frame, clay): the
 * same frame renders to the same markup whether it is reached playing,
 * scrubbing or running backwards, and neighbouring frames really differ. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClayScene } from './ClayScene';
import { REELS, lastFrame, type ReelId } from './clayTheatreRules';

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
});
