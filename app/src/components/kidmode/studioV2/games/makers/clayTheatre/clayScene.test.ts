/** The set painter, run against a recording canvas: every story paints in
 * every pass without a single non-finite number or a colour that did not come
 * from the palette, a drawing is a pure function of its scene, and the boil
 * really changes the clay between drawings. How it looks is a rendered check. */
import { describe, expect, it } from 'vitest';
import { FULL_PULLS, NO_PULLS, type Pose } from './clayBody';
import { GROUND, STORIES, STORY_IDS, showLook, stageLayout, type GelId, type StoryId } from './clayTheatreRules';
import { PALETTE_NAMES, mixRgb, paint, paintClay, readPalette, type Palette, type RGB } from './clayPaint';
import { CLAY_TONES, GEL_TONES, clayTone, filmView, paintGel, paintScene, type Scene, type View } from './clayScene';

type Call = [string, ...unknown[]];
/** A 2D context that draws nothing and remembers everything. */
function recorder() {
  const calls: Call[] = [], styles: string[] = [], canvas = {};
  const gradient = () => ({ addColorStop: (_at: number, colour: string) => { styles.push(colour); } });
  const target: Record<string, unknown> = { canvas, globalAlpha: 1 };
  const ctx = new Proxy(target, {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return (...args: unknown[]) => { calls.push([prop, ...args]); return gradient(); };
      if (prop === 'createPattern') return () => null;
      if (prop === 'getTransform') return () => ({ a: 2, b: 0 });
      return (...args: unknown[]) => { calls.push([prop, ...args]); };
    },
    set(obj, prop: string, value) { if ((prop === 'fillStyle' || prop === 'strokeStyle' || prop === 'shadowColor') && typeof value === 'string') styles.push(value); obj[prop] = value; calls.push([`set:${prop}`, typeof value === 'object' ? 'object' : value]); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, styles };
}
/** A palette with a distinct colour for every token, so a mix-up would show. */
const PAL = Object.fromEntries(PALETTE_NAMES.map((name, i) => [name, [(i * 37) % 256, (i * 91) % 256, (i * 53) % 256] as RGB])) as Palette;
const L = stageLayout(390, 768), VIEW: View = { unit: L.unit, ox: L.ox, oy: L.oy, cloth: L.cloth, detail: 1 };
const POSE: Pose = { x: 180, y: 150, rot: -20, sx: 1.05, sy: 0.96, flip: 1 };
function scene(story: StoryId, drawing = 3, gel: GelId = 'clearGel', pulls = FULL_PULLS): Scene {
  const spec = STORIES[story];
  return {
    story, look: showLook(11), drawing, gel,
    hero: { id: spec.hero, body: clayTone(spec.clay[0], PAL), trim: clayTone(spec.clay[1], PAL), pulls, pose: POSE, prints: [{ x: 10, y: -4, rot: 20 }], press: { at: [0, -10], amount: 0.6 }, look: [300, 60], marble: { tone: PAL.amber, amount: 0.5 } },
    ghosts: [{ ...POSE, x: 120 }, { ...POSE, x: 150 }], buddy: { id: spec.buddy, at: spec.buddyHome, act: 'hopAct', tone: clayTone(spec.clay[1], PAL), drawing },
  };
}
const finite = (calls: Call[]) => calls.every(call => call.slice(1).every(arg => typeof arg !== 'number' || Number.isFinite(arg)));
const fromPalette = (styles: string[]) => styles.every(style => /^rgb\(\d+ \d+ \d+ \/ [01]\.\d{3}\)$/.test(style));

describe('the set painter', () => {
  it.each(STORY_IDS)('%s: paints the whole set with finite numbers and palette colours only', story => {
    const { ctx, calls, styles } = recorder();
    paintScene(ctx, VIEW, scene(story, 3, 'roseGel'), PAL);
    expect(calls.filter(c => c[0] === 'fill').length).toBeGreaterThan(20);
    expect(finite(calls)).toBe(true); expect(fromPalette(styles)).toBe(true);
    // Every save is restored: nothing leaks into the next drawing.
    expect(calls.filter(c => c[0] === 'save').length).toBe(calls.filter(c => c[0] === 'restore').length);
  });
  it.each(STORY_IDS)('%s: the three passes together are the whole picture', story => {
    const whole = recorder(), parts = recorder();
    paintScene(whole.ctx, VIEW, scene(story), PAL);
    for (const part of ['backPass', 'castPass', 'frontPass'] as const) paintScene(parts.ctx, VIEW, scene(story), PAL, part);
    const fills = (calls: Call[]) => calls.filter(c => c[0] === 'fill' || c[0] === 'stroke' || c[0] === 'fillRect').length;
    expect(fills(parts.calls)).toBe(fills(whole.calls));
    const cast = recorder(); paintScene(cast.ctx, VIEW, scene(story), PAL, 'castPass');
    expect(fills(cast.calls)).toBeGreaterThan(10); expect(fills(cast.calls)).toBeLessThan(fills(whole.calls));
  });
  it.each(STORY_IDS)('%s: a drawing is a pure function of its scene, and the next drawing boils', story => {
    const a = recorder(), b = recorder(), c = recorder();
    paintScene(a.ctx, VIEW, scene(story, 5), PAL, 'castPass'); paintScene(b.ctx, VIEW, scene(story, 5), PAL, 'castPass'); paintScene(c.ctx, VIEW, scene(story, 6), PAL, 'castPass');
    expect(JSON.stringify(b.calls)).toBe(JSON.stringify(a.calls));
    expect(JSON.stringify(c.calls)).not.toBe(JSON.stringify(a.calls));
  });
  it('a still hero (motion reduced) is the same on every drawing', () => {
    const still = (drawing: number) => { const r = recorder(), s = scene('snailGarden', drawing); paintScene(r.ctx, VIEW, { ...s, buddy: null, hero: { ...s.hero!, boil: 0, look: null } }, PAL, 'castPass'); return r.calls.filter(c => c[0] === 'bezierCurveTo' || c[0] === 'moveTo'); };
    expect(JSON.stringify(still(8)).length).toBeGreaterThan(100);
    // The outline does not move; only the texture's seed (the drawing) may differ.
    expect(JSON.stringify(still(9).slice(0, 80))).toBe(JSON.stringify(still(8).slice(0, 80)));
  });
  it('paints the bare lump, the film frame and a thumbnail too', () => {
    for (const story of STORY_IDS) {
      const lump = recorder(); paintScene(lump.ctx, VIEW, scene(story, 2, 'clearGel', NO_PULLS), PAL);
      const frame = recorder(); paintScene(frame.ctx, filmView({ x: 0, y: 0, w: 370, h: 260 }, [POSE], 1), scene(story), PAL);
      const thumb = recorder(); paintScene(thumb.ctx, filmView({ x: 0, y: 0, w: 58, h: 40 }, [POSE], 0.4), scene(story), PAL);
      for (const r of [lump, frame, thumb]) { expect(finite(r.calls)).toBe(true); expect(fromPalette(r.styles)).toBe(true); expect(r.calls.some(c => c[0] === 'fill')).toBe(true); }
      // A thumbnail skips the fine work.
      expect(thumb.calls.length).toBeLessThan(frame.calls.length);
    }
  });
  it('a gel lays its own colour over the set, and no gel lays nothing', () => {
    const none = recorder(); paintGel(none.ctx, VIEW, 'clearGel', PAL); expect(none.calls).toHaveLength(0);
    for (const gel of ['roseGel', 'blueGel', 'goldGel'] as const) {
      const r = recorder(); paintGel(r.ctx, VIEW, gel, PAL);
      expect(r.calls.some(c => c[0] === 'set:globalCompositeOperation' && c[1] === 'source-atop')).toBe(true);
      const tone = PAL[GEL_TONES[gel]!]; expect(r.styles).toContain(paint(tone, 0.2));
    }
  });
});

describe('the film view', () => {
  it('fits the whole film into the frame: every pose is inside it, the floor is in the picture', () => {
    const poses: Pose[] = [{ ...POSE, x: -60, y: 200 }, { ...POSE, x: 200, y: -40 }, { ...POSE, x: 470, y: 180 }], frame = { x: 10, y: 20, w: 300, h: 200 };
    const view = filmView(frame, poses, 1);
    for (const p of poses) { const x = view.ox + p.x * view.unit, y = view.oy + p.y * view.unit; expect(x).toBeGreaterThan(frame.x); expect(x).toBeLessThan(frame.x + frame.w); expect(y).toBeGreaterThan(frame.y); expect(y).toBeLessThan(frame.y + frame.h); }
    const floor = view.oy + GROUND * view.unit; expect(floor).toBeGreaterThan(frame.y + frame.h * 0.5); expect(floor).toBeLessThan(frame.y + frame.h);
  });
});

describe('clay colour', () => {
  it('reads nothing but greys when there is no page to read from', () => { const pal = readPalette(null); for (const name of PALETTE_NAMES) expect(pal[name]).toHaveLength(3); });
  it('mixes and prints colours as numbers, never as a literal', () => {
    expect(mixRgb([0, 0, 0], [100, 200, 50], 0.5)).toEqual([50, 100, 25]);
    expect(paint([10.4, 20.6, 30], 0.5)).toBe('rgb(10 21 30 / 0.500)'); expect(paint([1, 2, 3], 7)).toBe('rgb(1 2 3 / 1.000)');
  });
  it('gives each of the six lumps its own clay, and plain putty before any is kneaded in', () => {
    const tones = Object.keys(CLAY_TONES).map(id => clayTone(id as keyof typeof CLAY_TONES, PAL).join());
    expect(new Set(tones).size).toBe(6); expect(tones).not.toContain(clayTone(null, PAL).join());
  });
  it('draws nothing for a degenerate piece', () => { const r = recorder(); paintClay(r.ctx, [[0, 0], [1, 1]], [1, 2, 3], PAL, { seed: 1, drawing: 0, unit: 1 }); expect(r.calls).toHaveLength(0); });
});
