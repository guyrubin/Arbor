import { useId } from 'react';
import { FRIENDS, HALL_PICTURE, STEPPE_PICTURE } from './mammothArt';
import '../makerPalette.css';

/** Woolly Mammoth cover: the giant behind the glass. The kit's glass hall
 * (the same two pictures the game is staged in: the Ice Age view, then the
 * hall with its windows cut clear, laid over it), the mammoth's head, shoulder
 * and tusk close up between them, and Bebe and Pep small on the floor in
 * front, looking up. Fills its box (the box sets the size); one scene for the
 * tile, the book row, the card and the sticker. The fur is a static
 * approximation of the game's: a few hundred strands, grouped into a handful
 * of paths by colour so the cover stays light. */
type Pt = readonly [number, number];
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const inside = (x: number, y: number, poly: readonly Pt[]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const HEAD: Pt[] = [[214, 96], [196, 64], [160, 46], [122, 52], [98, 80], [90, 124], [96, 170], [126, 204], [180, 214], [222, 190], [232, 150]];
const BODY: Pt[] = [[214, 120], [246, 74], [300, 60], [360, 74], [420, 110], [430, 320], [180, 320], [196, 230], [226, 190]];
const path = (pts: readonly Pt[]) => `${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')}Z`;
/** Strands by colour bin (0 deep .. 4 sunlit). */
const BINS: string[][] = [[], [], [], [], []];
const grow = (poly: readonly Pt[], count: number, len: [number, number], angle: (x: number, y: number) => number) => {
  let placed = 0, tries = 0;
  while (placed < count && tries++ < count * 8) {
    const x = 80 + rnd() * 360, y = 40 + rnd() * 290;
    if (!inside(x, y, poly)) continue;
    const a = angle(x, y) + (rnd() - 0.5) * 0.35, l = len[0] + rnd() * (len[1] - len[0]);
    const droop = a + (Math.PI / 2 - a) * Math.min(0.5, l / 120);
    const cx = x + Math.cos(a) * l * 0.5, cy = y + Math.sin(a) * l * 0.5, tx = x + Math.cos(droop) * l, ty = y + Math.sin(droop) * l;
    // Low sun from the left: upper-left strands are lit, the rest fall into shade.
    const light = 1.1 - (y - 40) / 260 - (x - 80) / 700 + (rnd() - 0.5) * 0.5;
    BINS[Math.max(0, Math.min(4, Math.floor(light * 4.2)))].push(`M${x.toFixed(1)} ${y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`);
    placed++;
  }
};
grow(BODY, 760, [20, 48], (_x, y) => 0.5 + (y - 60) / 260);
grow(HEAD, 420, [8, 17], (x, y) => 0.6 + (y - 50) / 300 - (x < 130 ? 0.3 : 0));
grow([[110, 60], [150, 40], [196, 56], [170, 66], [130, 70]], 70, [12, 24], (x) => -1 + (x - 110) / 120);
grow([[88, 166], [122, 160], [124, 290], [84, 290]], 130, [6, 11], () => Math.PI / 2 + 0.15);
/** A ragged fringe along the hump and the crown, so the outline is hair, not a shape. */
const fringe = (pts: readonly Pt[], count: number, len: [number, number]) => {
  for (let i = 0; i < count; i++) {
    const t = rnd() * (pts.length - 1), k = Math.floor(t), f = t - k;
    const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f + 3;
    const a = -0.35 + rnd() * 0.9, l = len[0] + rnd() * (len[1] - len[0]);
    const light = 1 - (y - 40) / 260 - (x - 80) / 700 + rnd() * 0.3;
    BINS[Math.max(0, Math.min(4, Math.floor(light * 4.2)))].push(`M${x.toFixed(1)} ${y.toFixed(1)}q${(Math.cos(a) * l * 0.5).toFixed(1)} ${(Math.sin(a) * l * 0.5 - 4).toFixed(1)} ${(Math.cos(a + 0.5) * l).toFixed(1)} ${(Math.sin(a + 0.5) * l).toFixed(1)}`);
  }
};
fringe([[214, 120], [246, 74], [300, 60], [360, 74], [420, 110]], 150, [14, 30]);
fringe([[98, 80], [122, 52], [160, 46], [196, 64], [214, 96]], 90, [8, 18]);
const STRANDS = BINS.map(list => list.join(''));
const INK = [
  'color-mix(in srgb, var(--mk-fur-dark) 70%, var(--mk-shadow))', 'var(--mk-fur-dark)', 'var(--mk-fur)',
  'color-mix(in srgb, var(--mk-fur) 40%, var(--mk-rust))', 'color-mix(in srgb, var(--mk-fur-light) 45%, var(--mk-fur-tip))',
];
const WIDTH = [2.4, 2.1, 1.9, 1.7, 1.6];
/** Trunk centre line and the tusk sweeping out in front of it. */
const TRUNK = 'M120 168C104 206 104 250 114 290L120 320L86 320L80 292C70 250 76 200 94 162Z';
const TUSK = 'M128 204C126 262 104 300 70 300C46 300 40 276 50 250C52 268 62 280 76 278C102 274 108 236 104 198Z';

/** Where the hall picture sits in the cover's 400 by 300 frame: its three middle windows fill the frame, a mullion each side of the eye. */
const HALL_AT = { x: -257, y: -122, width: 803, height: 536 };

export default function IceAgeFriendCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId();
  const small = size === 'tile';
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}base`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-fur)' }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-fur-dark)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-fur-dark) 55%, var(--mk-shadow))' }} />
      </linearGradient>
      <linearGradient id={`${id}tusk`} x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-sand) 80%, var(--mk-umber))' }} />
        <stop offset=".3" style={{ stopColor: 'color-mix(in srgb, var(--mk-sand) 50%, var(--mk-cream))' }} />
        <stop offset=".75" style={{ stopColor: 'var(--mk-cream)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-white)' }} />
      </linearGradient>
      <linearGradient id={`${id}trunk`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-fur-dark)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-umber) 80%, var(--mk-paper-shade))' }} />
      </linearGradient>
      <linearGradient id={`${id}snow`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-snow-shade)' }} />
      </linearGradient>
    </defs>
    {/* The Ice Age beyond the glass. */}
    <image href={small ? STEPPE_PICTURE.src480 : STEPPE_PICTURE.src} {...HALL_AT} preserveAspectRatio="none" />
    <g transform="translate(6 2)">
      <path d={path(BODY)} fill={`url(#${id}base)`} />
      <path d={path(HEAD)} fill={`url(#${id}base)`} />
      <path d={TRUNK} fill={`url(#${id}trunk)`} />
      <path d="M86 196q12 3 30 0M84 222q14 3 30 0M84 248q14 3 28 0M88 274q12 3 26 0" fill="none" strokeWidth="1.6" strokeLinecap="round" style={{ stroke: 'color-mix(in srgb, var(--mk-fur-dark) 60%, var(--mk-shadow))', opacity: 0.6 }} />
      {STRANDS.map((d, i) => <path key={i} d={d} fill="none" strokeLinecap="round" strokeWidth={WIDTH[i]} style={{ stroke: INK[i] }} />)}
      {/* Snow on the crown and the hump. */}
      <path d="M118 56Q150 34 190 54Q160 44 124 62Z M236 82Q296 44 372 78Q300 56 244 90Z" fill={`url(#${id}snow)`} />
      <path d={TUSK} fill={`url(#${id}tusk)`} />
      <path d="M112 220C110 258 96 284 74 288" fill="none" strokeWidth="3" strokeLinecap="round" style={{ stroke: 'var(--mk-white)', opacity: 0.7 }} />
      <ellipse cx="114" cy="214" rx="14" ry="9" style={{ fill: 'var(--mk-fur-dark)' }} />
      {/* The small ear and the eye, with a catch-light. */}
      <ellipse cx="190" cy="128" rx="16" ry="21" transform="rotate(14 190 128)" style={{ fill: 'color-mix(in srgb, var(--mk-fur-dark) 70%, var(--mk-shadow))' }} />
      <ellipse cx="187" cy="125" rx="11" ry="16" transform="rotate(14 190 128)" style={{ fill: 'color-mix(in srgb, var(--mk-fur) 60%, var(--mk-fur-tip))', opacity: 0.55 }} />
      <ellipse cx="191" cy="130" rx="10" ry="15" transform="rotate(14 190 128)" style={{ fill: 'color-mix(in srgb, var(--mk-fur-dark) 70%, var(--mk-shadow))' }} />
      <ellipse cx="128" cy="112" rx="11" ry="8.4" style={{ fill: 'var(--mk-shadow)', opacity: 0.4 }} />
      <ellipse cx="128" cy="111" rx="6.4" ry="5.2" style={{ fill: 'color-mix(in srgb, var(--mk-umber) 40%, var(--mk-shadow))' }} />
      <path d="M120 108Q128 102 137 108" fill="none" strokeWidth="2" strokeLinecap="round" style={{ stroke: 'color-mix(in srgb, var(--mk-fur-dark) 60%, var(--mk-shadow))' }} />
      <circle cx="126" cy="109.2" r="1.8" style={{ fill: 'var(--mk-white)' }} />
    </g>
    {/* The hall: its frame, mullions and planters stand in front of the giant. */}
    <image href={small ? HALL_PICTURE.src480 : HALL_PICTURE.src} {...HALL_AT} preserveAspectRatio="none" />
    {/* Bebe and Pep, small, looking up. */}
    <ellipse cx="80" cy="293" rx="22" ry="4" style={{ fill: 'var(--mk-shadow)', opacity: 0.22 }} />
    <image href={FRIENDS.bebe.src.replace('.webp', '-480.webp')} x="62" y="192" width={102 * FRIENDS.bebe.aspect} height="102" preserveAspectRatio="xMidYMax meet" />
    <ellipse cx="117" cy="294" rx="13" ry="3" style={{ fill: 'var(--mk-shadow)', opacity: 0.22 }} />
    <image href={FRIENDS.pep.src.replace('.webp', '-480.webp')} x="107" y="248" width={46 * FRIENDS.pep.aspect} height="46" preserveAspectRatio="xMidYMax meet" />
  </svg>;
}
