import { useEffect, useRef, useState } from 'react';
import { DESK_KIT } from './deskKit';
/** Inside the computer everything is deliberately chunky: crisp squares from
 * a small fixed palette, to contrast with the soft paper room around it.
 * Each drawing is a grid of letters; each letter is one square of one ink. */
const INK: Readonly<Record<string, string>> = {
  k: 'var(--mk-indigo-deep)', n: 'var(--mk-night)', i: 'var(--mk-indigo)', t: 'var(--mk-teal)', T: 'var(--mk-teal-deep)',
  c: 'var(--mk-cream)', p: 'var(--mk-paper-shade)', w: 'var(--mk-white)', b: 'var(--mk-butter)', y: 'var(--mk-sun)',
  a: 'var(--mk-amber)', o: 'var(--mk-orange)', r: 'var(--mk-rose)', R: 'var(--mk-rose-deep)', s: 'var(--mk-sea)',
  g: 'var(--mk-spring)', G: 'var(--mk-leaf)', l: 'var(--mk-lilac)', d: 'var(--mk-wood-light)', D: 'var(--mk-wood)', e: 'var(--mk-wood-dark)',
};

export const ICON_BOUNCE = [
  '.kkkkkkkkkkkkkk.',
  'knnnnnnnnnnnnnnk',
  'kaanrrnssnggnllk',
  'kaanrrnssnggnllk',
  'knnnnnnnnnnnnnnk',
  'kniinaaniiniinnk',
  'kniinaaniiniinnk',
  'knnnnnnnnnnnnnnk',
  'knnnnnnnnwwnnnnk',
  'knnnnnnnnwwnnnnk',
  'knnnnnnnnnnnnnnk',
  'knnnnnnnnnnnnnnk',
  'knnnccccccnnnnnk',
  'knnnttttttnnnnnk',
  'knnnnnnnnnnnnnnk',
  '.kkkkkkkkkkkkkk.',
];
export const ICON_THINGS = [
  '................',
  '......y.........',
  '.....yyy........',
  '...yyyyyyy...s..',
  '....yyyyy...sss.',
  '....yy.yy...sss.',
  '.rrrrrr.....sss.',
  '..rRRr......sss.',
  'eeeeeeeeeeeeeeee',
  'edddddddddddddde',
  'eDDDDDDDDDDDDDDe',
  'eDDDcccccccDDDDe',
  'eDDDcppppppDDDDe',
  'eDDDDDDDDDDDDDDe',
  'eeeeeeeeeeeeeeee',
  '................',
];
export const ICON_TERMINAL = [
  '.kkkkkkkkkkkkkk.',
  'kttttttttttttttk',
  'ktwtbtattttttttk',
  'knnnnnnnnnnnnnnk',
  'kngnnnnnnnnnnnnk',
  'knnggnnnnnnnnnnk',
  'knnnnggnnnnnnnnk',
  'knnggnnnnnnnnnnk',
  'kngnnnnbbbbnnnnk',
  'knnnnnnnnnnnnnnk',
  'knnnnnnnnnnnnnnk',
  'knggggnggnggggnk',
  'knnnnnnnnnnnnnnk',
  'kngggnggggnnnnnk',
  'knnnnnnnnnnnnnnk',
  '.kkkkkkkkkkkkkk.',
];
export const PIXEL_SUN = [
  '...y..y...',
  '....yy....',
  'y.yyyyyy.y',
  '..yybbyy..',
  '.yybbbbyy.',
  '.yybbbbyy.',
  '..yybbyy..',
  'y.yyyyyy.y',
  '....yy....',
  '...y..y...',
];
export const PIXEL_MOON = [
  '...bbbb...',
  '..bbb.....',
  '.bbb......',
  '.bbb....w.',
  'bbbb......',
  'bbbb......',
  '.bbbb.....',
  '.bbbbb..b.',
  '..bbbbbbb.',
  '...bbbb...',
];

/** Merges each run of same-ink squares in a row into one rect, so a drawing
 * is a handful of nodes, not hundreds. */
export function pixelRects(rows: readonly string[]): { x: number; y: number; w: number; ink: string }[] {
  const out: { x: number; y: number; w: number; ink: string }[] = [];
  rows.forEach((row, y) => {
    const cells = [...row];
    for (let x = 0; x < cells.length;) {
      const ink = cells[x]; let w = 1;
      while (x + w < cells.length && cells[x + w] === ink) w++;
      if (INK[ink]) out.push({ x, y, w, ink: INK[ink] });
      x += w;
    }
  });
  return out;
}

export function PixelArt({ rows, className }: { rows: readonly string[]; className?: string }) {
  const width = Math.max(...rows.map(row => [...row].length));
  return <svg className={className} viewBox={`0 0 ${width} ${rows.length}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    {pixelRects(rows).map((r, index) => <rect key={index} x={r.x} y={r.y} width={r.w} height={1} style={{ fill: r.ink }} />)}
  </svg>;
}

/** Hills for the wallpaper: a fixed, hand-picked skyline (no randomness). */
const FAR = [38, 37, 36, 36, 35, 34, 34, 33, 33, 34, 35, 35, 36, 36, 35, 34, 33, 32, 32, 33, 34, 35, 36, 37, 37, 36, 35, 35, 34, 34, 35, 36];
const NEAR = [46, 45, 45, 44, 43, 43, 42, 42, 43, 44, 45, 46, 46, 45, 44, 43, 43, 42, 41, 41, 42, 43, 44, 45, 46, 46, 47, 46, 45, 44, 44, 45];
const STARS: readonly [number, number][] = [[6, 5], [14, 11], [22, 4], [31, 8], [44, 6], [52, 13], [58, 4], [38, 16], [9, 18], [26, 21], [48, 22], [60, 17]];
const CLOUDS: readonly [number, number, number][] = [[6, 12, 12], [40, 7, 10], [30, 20, 8]];
/** The chunky valley is this many squares across and down. */
const VALLEY_W = 128, VALLEY_H = 96;

/** The desktop wallpaper: Horizon Valley itself, shown in chunky squares (the
 * kit's valley picture drawn once onto a tiny canvas and scaled up crisp).
 * Until the picture arrives, and if it never does, stepped teal hills under a
 * banded sky stand in. By night the same view dims and the stars come out.
 * The day or night picture itself is the clock in the corner. */
export function DeskWallpaper({ sky }: { sky: 'day' | 'night' }) {
  const day = sky === 'day';
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const node = canvas.current; const ctx = node?.getContext?.('2d');
    if (!node || !ctx || typeof Image === 'undefined') return;
    let live = true; const picture = new Image();
    picture.onload = () => {
      if (!live) return;
      try { ctx.imageSmoothingEnabled = true; ctx.drawImage(picture, 0, picture.height * 0.12, picture.width, picture.height * 0.8, 0, 0, VALLEY_W, VALLEY_H); setDrawn(true); } catch { /* The stepped hills stay. */ }
    };
    picture.src = DESK_KIT.valley.src;
    return () => { live = false; picture.onload = null; };
  }, []);
  return <span className="md-wallpaper" data-sky={sky} data-drawn={drawn} aria-hidden="true">
    <svg viewBox="0 0 64 60" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" focusable="false">
      <rect width="64" height="60" style={{ fill: day ? 'var(--mk-indigo)' : 'var(--mk-night)' }} />
      <rect y="12" width="64" height="9" style={{ fill: day ? 'color-mix(in srgb, var(--mk-indigo) 60%, var(--mk-bluebell))' : 'var(--mk-indigo-deep)' }} />
      <rect y="21" width="64" height="9" style={{ fill: day ? 'color-mix(in srgb, var(--mk-bluebell) 60%, var(--mk-lilac))' : 'color-mix(in srgb, var(--mk-indigo-deep) 60%, var(--mk-indigo))' }} />
      <rect y="30" width="64" height="30" style={{ fill: day ? 'color-mix(in srgb, var(--mk-lilac) 55%, var(--mk-rose))' : 'var(--mk-indigo)' }} />
      {day && CLOUDS.map(([x, y, w], index) => <g key={index} opacity=".75"><rect x={x + 2} y={y - 2} width={w - 5} height="2" style={{ fill: 'var(--mk-white)' }} /><rect x={x} y={y} width={w} height="2" style={{ fill: 'var(--mk-white)' }} /></g>)}
      {FAR.map((top, x) => <rect key={`f${x}`} x={x * 2} y={top} width="2" height={60 - top} style={{ fill: 'var(--mk-teal-deep)' }} />)}
      {NEAR.map((top, x) => <rect key={`n${x}`} x={x * 2} y={top} width="2" height={60 - top} style={{ fill: 'color-mix(in srgb, var(--mk-teal) 70%, var(--mk-teal-deep))' }} />)}
    </svg>
    <canvas ref={canvas} width={VALLEY_W} height={VALLEY_H} className="md-wallpaper__valley" />
    <span className="md-wallpaper__dusk" />
    <svg className="md-wallpaper__stars" viewBox="0 0 64 60" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" focusable="false">
      {STARS.map(([x, y], index) => <rect key={index} x={x} y={y} width="1" height="1" data-twinkle={index % 3 === 0} style={{ fill: 'var(--mk-butter)' }} />)}
    </svg>
  </span>;
}
export function PixelClock({ sky }: { sky: 'day' | 'night' }) {
  return <span className="md-clock" aria-hidden="true"><PixelArt rows={sky === 'day' ? PIXEL_SUN : PIXEL_MOON} /></span>;
}

/** The computer's little wiggle (`dance`): two frames of a pixel bench waving its lid. */
export const WIGGLE_A = [
  '..tttttt..', '..tccct...', '...tt.....', 'kkkkkkkkkk', 'kcackcsckk', 'kkkkkkkkkk', '.kk....kk.', '.kk....kk.',
];
export const WIGGLE_B = [
  '..tttttt..', '...tccct..', '.....tt...', 'kkkkkkkkkk', 'kcsckcackk', 'kkkkkkkkkk', '..kk..kk..', '.kk....kk.',
];
