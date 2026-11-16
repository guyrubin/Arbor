import type { Ref } from 'react';
import { mk, mx } from './windupCar';
import { pointAt, shapeOf, type Track } from './windupRaceRules';

/** Wind-up Racer scenery: a sunny room seen side-on, a wooden table, and the
 * household things each track is built from. Paper-cut shapes, soft
 * gradients, one light from the window at the top left, no outlines.
 *
 * World space is SVG space: x to the right along the table, y DOWN, y = 0 is
 * the line the wheels roll on (track heights are drawn as -y). */

export const TABLE_BACK = -50;
export const TABLE_FRONT = 26;
export const APRON = 30;

const fill = (colour: string) => ({ style: { fill: colour } });

/** Every gradient and pattern the scene uses, once per scene. */
export function SceneDefs({ id }: { id: string }) {
  const stop = (offset: string, colour: string) => <stop offset={offset} style={{ stopColor: colour }} />;
  return <defs>
    <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('paper', 'butter', 78))}{stop('.7', mx('paper', 'sand', 70))}{stop('1', mx('sand', 'clay-pale', 60))}</linearGradient>
    <pattern id={`${id}paper`} width="34" height="40" patternUnits="userSpaceOnUse">
      <rect x="16" width="2" height="40" {...fill(mx('sand', 'transparent', 32))} />
      <circle cx="0" cy="10" r="2.2" {...fill(mx('rose', 'transparent', 30))} />
      <circle cx="34" cy="10" r="2.2" {...fill(mx('rose', 'transparent', 30))} />
      <path d="M-2 14q2 3 4 0M32 14q2 3 4 0" style={{ fill: 'none', stroke: mx('sage', 'transparent', 45), strokeWidth: 1.2 }} />
      <circle cx="17" cy="30" r="1.2" {...fill(mx('sage', 'transparent', 40))} />
    </pattern>
    <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">{stop('0', mk('sky'))}{stop('.65', mk('sky-pale'))}{stop('1', mk('butter'))}</linearGradient>
    <radialGradient id={`${id}sun`} cx=".5" cy=".5" r=".5">{stop('0', mk('white'))}{stop('.35', mx('sun', 'white', 60))}{stop('1', mx('sun', 'transparent', 0))}</radialGradient>
    <linearGradient id={`${id}beam`} x1="0" y1="0" x2="1" y2="1">{stop('0', mx('butter', 'transparent', 70))}{stop('1', mx('butter', 'transparent', 0))}</linearGradient>
    <linearGradient id={`${id}top`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('wood', 'wood-dark', 70))}{stop('.35', mk('wood'))}{stop('1', mx('wood-light', 'wood', 70))}</linearGradient>
    <linearGradient id={`${id}apron`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('wood-light', 'white', 80))}{stop('.12', mk('wood'))}{stop('1', mk('wood-dark'))}</linearGradient>
    <linearGradient id={`${id}under`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('umber', 'wood-dark', 75))}{stop('.12', mx('wood-dark', 'umber', 60))}{stop('.4', mx('wood', 'wood-dark', 55))}{stop('1', mx('wood', 'clay', 70))}</linearGradient>
    <pattern id={`${id}grain`} width="260" height="76" patternUnits="userSpaceOnUse">
      <path d="M0 8C60 5 120 11 260 7M0 30C80 27 150 34 260 29M10 52C90 49 170 56 250 51M0 68C70 66 160 71 260 67" style={{ fill: 'none', stroke: mx('wood-dark', 'transparent', 28), strokeWidth: 1.4, strokeLinecap: 'round' }} />
      <ellipse cx="190" cy="40" rx="14" ry="3.2" style={{ fill: 'none', stroke: mx('wood-dark', 'transparent', 22), strokeWidth: 1.1 }} />
    </pattern>
    <linearGradient id={`${id}ruler`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('wood-light', 'butter', 70))}{stop('1', mk('wood-light'))}</linearGradient>
    <linearGradient id={`${id}block`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('wood-light', 'white', 75))}{stop('1', mx('wood-light', 'wood', 60))}</linearGradient>
    <linearGradient id={`${id}pages`} x1="0" y1="0" x2="0" y2="1">{stop('0', mk('white'))}{stop('1', mk('paper-shade'))}</linearGradient>
    <radialGradient id={`${id}wool`} cx=".35" cy=".3" r=".75">{stop('0', mx('blossom', 'rose', 40))}{stop('.7', mk('rose'))}{stop('1', mk('rose-deep'))}</radialGradient>
    <linearGradient id={`${id}cushion`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('celadon', 'white', 60))}{stop('1', mk('celadon-deep'))}</linearGradient>
    <linearGradient id={`${id}tunnel`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('paper', 'white', 50))}{stop('1', mx('paper-shade', 'paper', 70))}</linearGradient>
    <linearGradient id={`${id}wallshade`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('umber', 'transparent', 0))}{stop('1', mx('umber', 'transparent', 16))}</linearGradient>
    <radialGradient id={`${id}pool`} cx=".5" cy=".5" r=".5">{stop('0', mx('butter', 'transparent', 55))}{stop('1', mx('butter', 'transparent', 0))}</radialGradient>
  </defs>;
}

/* ---------- the room (two parallax layers behind the table) ---------- */

export const WINDOW_EVERY = 1150;
function Window({ x, id }: { x: number; id: string }) {
  return <g transform={`translate(${x} 0)`}>
    {/* Sunlight falling from the window toward the table, down to the right. */}
    <path d="M10 -430L210 -430L520 -60L250 -60Z" style={{ fill: `url(#${id}beam)`, opacity: .38 }} />
    <rect x="-12" y="-448" width="244" height="292" rx="6" {...fill(mx('shadow', 'transparent', 10))} />
    <rect x="-8" y="-452" width="236" height="286" rx="6" {...fill(mk('white'))} />
    <rect x="6" y="-438" width="208" height="258" rx="3" style={{ fill: `url(#${id}sky)` }} />
    <circle cx="160" cy="-388" r="64" style={{ fill: `url(#${id}sun)` }} />
    {/* Garden outside: soft hills and a round tree, cut from paper. */}
    <path d="M6 -228C50 -258 100 -246 140 -236C170 -228 196 -250 214 -246L214 -180L6 -180Z" {...fill(mx('sage', 'sky-pale', 70))} />
    <path d="M6 -206C60 -224 120 -214 214 -222L214 -180L6 -180Z" {...fill(mx('spring', 'sage', 55))} />
    <rect x="58" y="-262" width="7" height="50" rx="3" {...fill(mx('wood-dark', 'sage', 60))} />
    <circle cx="61" cy="-276" r="28" {...fill(mx('leaf', 'sage', 55))} />
    <circle cx="50" cy="-284" r="16" {...fill(mx('spring', 'leaf', 45))} />
    {/* Glazing bars and their shadows. */}
    <rect x="107" y="-438" width="8" height="258" {...fill(mk('white'))} />
    <rect x="6" y="-314" width="208" height="8" {...fill(mk('white'))} />
    <rect x="115" y="-438" width="2" height="258" {...fill(mx('shadow', 'transparent', 10))} />
    <rect x="6" y="-306" width="208" height="2" {...fill(mx('shadow', 'transparent', 10))} />
    {/* Sill. */}
    <rect x="-22" y="-172" width="264" height="14" rx="5" {...fill(mk('white'))} />
    <rect x="-22" y="-160" width="264" height="5" rx="2.5" {...fill(mx('paper-shade', 'linen-shade', 50))} />
    {/* Linen curtains, gathered at each side. */}
    <path d="M-34 -470C-14 -470 6 -466 14 -460C4 -380 26 -300 8 -170C-4 -166 -20 -164 -36 -166C-26 -260 -40 -380 -34 -470Z" {...fill(mx('linen', 'butter', 70))} />
    <path d="M-20 -462C-24 -380 -12 -300 -22 -168" style={{ fill: 'none', stroke: mx('linen-shade', 'transparent', 70), strokeWidth: 3, strokeLinecap: 'round' }} />
    <path d="M254 -470C234 -470 214 -466 206 -460C216 -380 194 -300 212 -170C224 -166 240 -164 256 -166C246 -260 260 -380 254 -470Z" {...fill(mx('linen', 'butter', 60))} />
    <path d="M240 -462C244 -380 232 -300 242 -168" style={{ fill: 'none', stroke: mx('linen-shade', 'transparent', 70), strokeWidth: 3, strokeLinecap: 'round' }} />
    <rect x="-50" y="-478" width="320" height="9" rx="4.5" {...fill(mx('wood', 'wood-dark', 60))} />
    <circle cx="-50" cy="-473.5" r="7" {...fill(mk('wood-dark'))} />
    <circle cx="270" cy="-473.5" r="7" {...fill(mk('wood-dark'))} />
  </g>;
}

/** The far wall: wallpaper, windows with the afternoon sun. */
export function WallLayer({ width, id }: { width: number; id: string }) {
  const windows: number[] = [];
  for (let x = -60; x < width; x += WINDOW_EVERY) windows.push(x);
  return <g>
    <rect x="-3000" y="-1400" width={width + 6000} height={1400 + TABLE_BACK + 6} style={{ fill: `url(#${id}wall)` }} />
    <rect x="-3000" y="-1400" width={width + 6000} height={1400 + TABLE_BACK + 6} style={{ fill: `url(#${id}paper)`, opacity: .9 }} />
    {/* Picture rail. */}
    <rect x="-3000" y="-560" width={width + 6000} height="10" {...fill(mx('white', 'paper-shade', 70))} />
    <rect x="-3000" y="-550" width={width + 6000} height="3" {...fill(mx('shadow', 'transparent', 8))} />
    {windows.map(x => <Window key={x} x={x} id={id} />)}
    {/* The table's own shadow on the wall. */}
    <rect x="-3000" y={TABLE_BACK - 70} width={width + 6000} height="76" style={{ fill: `url(#${id}wallshade)` }} />
  </g>;
}

function Plant({ x }: { x: number }) {
  return <g transform={`translate(${x} 0)`}>
    <path d="M-6 -30C-30 -60 -26 -92 -10 -104C-8 -80 -4 -60 -2 -30Z" {...fill(mx('leaf', 'leaf-deep', 60))} />
    <path d="M2 -30C10 -70 30 -88 44 -90C34 -64 18 -46 6 -30Z" {...fill(mk('leaf'))} />
    <path d="M-2 -30C-6 -64 4 -100 18 -116C22 -84 12 -56 4 -30Z" {...fill(mx('spring', 'leaf', 50))} />
    <path d="M-22 -32L22 -32L17 0L-17 0Z" {...fill(mk('clay'))} />
    <path d="M-25 -36L25 -36L24 -27L-24 -27Z" {...fill(mk('clay-light'))} />
    <path d="M-17 -27L-14 0L-17 0Z" {...fill(mx('rust', 'transparent', 40))} />
  </g>;
}
function Jar({ x }: { x: number }) {
  return <g transform={`translate(${x} 0)`}>
    <rect x="-17" y="-52" width="34" height="52" rx="9" {...fill(mx('sky-pale', 'transparent', 70))} />
    {[[-8, -10, 'red'], [4, -12, 'amber'], [-2, -22, 'teal'], [8, -26, 'violet'], [-9, -30, 'sun'], [3, -36, 'poppy'], [-4, -6, 'leaf']].map(([cx, cy, c]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="4.6" {...fill(mk(String(c)))} />)}
    <rect x="-17" y="-52" width="34" height="52" rx="9" {...fill(mx('white', 'transparent', 22))} />
    <rect x="-12" y="-46" width="4" height="36" rx="2" {...fill(mx('white', 'transparent', 70))} />
    <rect x="-15" y="-60" width="30" height="10" rx="3" {...fill(mk('steel'))} />
  </g>;
}
function Clock({ x }: { x: number }) {
  return <g transform={`translate(${x} 0)`}>
    <rect x="-18" y="-6" width="6" height="6" rx="2" {...fill(mk('teal-deep'))} />
    <rect x="12" y="-6" width="6" height="6" rx="2" {...fill(mk('teal-deep'))} />
    <circle cy="-30" r="26" {...fill(mk('teal'))} />
    <circle cy="-30" r="19" {...fill(mk('white'))} />
    <path d="M0 -30V-43M0 -30L9 -25" style={{ stroke: mk('ink'), strokeWidth: 2.4, strokeLinecap: 'round' }} />
    <circle cx="-15" cy="-58" r="7" {...fill(mk('gold'))} /><circle cx="15" cy="-58" r="7" {...fill(mk('gold'))} />
    <path d="M-8 -40A13 13 0 0 1 4 -45" style={{ fill: 'none', stroke: mx('white', 'transparent', 60), strokeWidth: 2, strokeLinecap: 'round' }} />
  </g>;
}
function Spool({ x, colour }: { x: number; colour: string }) {
  return <g transform={`translate(${x} 0)`}>
    <rect x="-13" y="-5" width="26" height="5" rx="1.5" {...fill(mk('wood-light'))} />
    <rect x="-10" y="-30" width="20" height="25" {...fill(mk(colour))} />
    {[-24, -18, -12].map(y => <path key={y} d={`M-10 ${y}h20`} style={{ stroke: mx('white', 'transparent', 30), strokeWidth: 1 }} />)}
    <rect x="-13" y="-35" width="26" height="5" rx="1.5" {...fill(mx('wood-light', 'white', 70))} />
  </g>;
}

export const SHELF_EVERY = 1100;
/** The middle layer: a wall shelf with small things on it. */
export function ShelfLayer({ width }: { width: number }) {
  const shelves: number[] = [];
  for (let x = 520; x < width; x += SHELF_EVERY) shelves.push(x);
  return <g>
    {shelves.map((x, i) => <g key={x} transform={`translate(${x} -262)`}>
      <rect x="-10" y="12" width="400" height="22" rx="10" {...fill(mx('umber', 'transparent', 14))} />
      <path d="M30 12L30 54L44 54Z" {...fill(mk('wood-dark'))} />
      <path d="M330 12L330 54L344 54Z" {...fill(mk('wood-dark'))} />
      <rect x="0" y="0" width="380" height="13" rx="3" {...fill(mk('wood'))} />
      <rect x="0" y="0" width="380" height="3" rx="1.5" {...fill(mk('wood-light'))} />
      {i % 2 === 0
        ? <><Plant x={56} /><Jar x={150} /><Spool x={214} colour="poppy" /><Spool x={246} colour="bluebell" /><Clock x={320} /></>
        : <><Clock x={60} /><Spool x={130} colour="amber" /><Jar x={200} /><Plant x={310} /></>}
    </g>)}
  </g>;
}

/* ---------- the table ---------- */

/** Table top, its front edge, the shade under it and the legs. */
export function Table({ from, to, id }: { from: number; to: number; id: string }) {
  const width = to - from;
  const legs: number[] = [];
  for (let x = from + 260; x < to; x += 1000) legs.push(x);
  return <g>
    <rect x={from} y={TABLE_FRONT + APRON - 4} width={width} height="1400" style={{ fill: `url(#${id}under)` }} />
    {/* The floor far below: a woven rug on boards, out of focus in the shade. */}
    {[110, 170, 250].map(y => <rect key={y} x={from} y={TABLE_FRONT + APRON + y} width={width} height="3" {...fill(mx('wood-dark', 'transparent', 45))} />)}
    <rect x={from} y={TABLE_FRONT + APRON + 196} width={width} height="40" {...fill(mx('rose-deep', 'wood', 45))} />
    <rect x={from} y={TABLE_FRONT + APRON + 204} width={width} height="5" {...fill(mx('butter', 'rose-deep', 40))} />
    <rect x={from} y={TABLE_FRONT + APRON + 222} width={width} height="5" {...fill(mx('butter', 'rose-deep', 40))} />
    {legs.map(x => <g key={x}>
      <rect x={x} y={TABLE_FRONT + APRON - 4} width="46" height="250" {...fill(mx('wood-dark', 'umber', 70))} />
      <rect x={x} y={TABLE_FRONT + APRON - 4} width="10" height="250" {...fill(mx('wood', 'wood-dark', 50))} />
    </g>)}
    <rect x={from} y={TABLE_BACK} width={width} height={TABLE_FRONT - TABLE_BACK} style={{ fill: `url(#${id}top)` }} />
    <rect x={from} y={TABLE_BACK} width={width} height={TABLE_FRONT - TABLE_BACK} style={{ fill: `url(#${id}grain)` }} />
    {Array.from({ length: Math.ceil(width / WINDOW_EVERY) + 1 }, (_, i) => from + 300 + i * WINDOW_EVERY).map(x => <ellipse key={x} cx={x} cy="-8" rx="260" ry="34" style={{ fill: `url(#${id}pool)` }} />)}
    <rect x={from} y={TABLE_FRONT} width={width} height={APRON} style={{ fill: `url(#${id}apron)` }} />
    <rect x={from} y={TABLE_FRONT + APRON} width={width} height="8" {...fill(mx('shadow', 'transparent', 22))} />
  </g>;
}

/* ---------- household things the tracks are built from ---------- */

const BOOK_COLOURS = ['indigo', 'rust', 'celadon-deep', 'plum', 'teal-deep', 'moss', 'rose-deep', 'bluebell', 'wood-dark', 'red'];
/** A cloth-bound book standing up, spine to the room. */
function StandingBook({ x, w, h, colour, lean = 0 }: { x: number; w: number; h: number; colour: string; lean?: number }) {
  return <g transform={`translate(${x} ${TABLE_BACK + 14}) rotate(${lean})`}>
    <rect x="0" y={-h} width={w} height={h} rx="3" {...fill(mk(colour))} />
    <rect x="0" y={-h} width={w * .32} height={h} rx="3" {...fill(mx('white', 'transparent', 14))} />
    <rect x="2" y={-h + 12} width={w - 4} height="3" {...fill(mx('gold-light', 'transparent', 80))} />
    <rect x="2" y={-14} width={w - 4} height="3" {...fill(mx('gold-light', 'transparent', 80))} />
    <rect x={w * .2} y={-h * .62} width={w * .6} height={h * .2} rx="2" {...fill(mx('paper', colour, 80))} />
  </g>;
}
/** A book lying flat: cloth cover top and bottom, the page block between. */
function FlatBook({ x, y, w, h, colour }: { x: number; y: number; w: number; h: number; colour: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x="0" y="0" width={w} height={h} rx="3" {...fill(mk(colour))} />
    <rect x="5" y="3.5" width={w - 5} height={h - 7} rx="1" style={{ fill: 'url(#wr-pages)' }} className="wr-pages" />
    {Array.from({ length: Math.max(1, Math.floor((h - 9) / 3)) }, (_, i) => <path key={i} d={`M7 ${6 + i * 3}H${w - 2}`} style={{ stroke: mx('paper-shade', 'transparent', 80), strokeWidth: .8 }} />)}
    <rect x="0" y="0" width={w} height="3.5" rx="1.5" {...fill(mx('white', colour, 22))} />
    <rect x="0" y="0" width="7" height={h} rx="3" {...fill(mx(colour, 'shadow', 82))} />
  </g>;
}

function track1Props() {
  const books: { x: number; w: number; h: number; colour: string; lean?: number }[] = [];
  let x = 150, i = 0;
  while (x < 1000) {
    const w = 24 + ((i * 7) % 15), h = 96 + ((i * 37) % 52);
    books.push({ x, w, h, colour: BOOK_COLOURS[i % BOOK_COLOURS.length], lean: i === 6 ? 8 : 0 });
    x += w + (i === 5 ? 18 : 2); i++;
  }
  return <g>{books.map(b => <StandingBook key={b.x} {...b} />)}</g>;
}

function Ramp() {
  // The leaning book's top cover is the rolling surface from (250,0) up to (520,-90).
  const angle = Math.atan2(90, 270) * 180 / Math.PI, length = Math.hypot(270, 90);
  return <g>
    <FlatBook x={500} y={-30} w={200} h={30} colour="rust" />
    <FlatBook x={512} y={-60} w={182} h={30} colour="celadon-deep" />
    <FlatBook x={504} y={-90} w={196} h={30} colour="indigo" />
    <g transform={`translate(250 0) rotate(${-angle})`}>
      {/* A big hardback lying on its back: cloth boards top and bottom, the page block between, a round spine at the low end. */}
      <rect x="-2" y="0" width={length + 8} height="24" rx="3" {...fill(mk('plum'))} />
      <rect x="4" y="4" width={length - 2} height="16" style={{ fill: `url(#${'wr-'}pages)` }} />
      {[7, 10, 13, 16].map(y => <path key={y} d={`M6 ${y}H${length - 2}`} style={{ stroke: mx('paper-shade', 'transparent', 80), strokeWidth: .7 }} />)}
      <path d="M-2 0C-12 4 -12 20 -2 24L6 24L6 0Z" {...fill(mx('plum', 'shadow', 82))} />
      <rect x="-2" y="0" width={length + 8} height="3.2" rx="1.6" {...fill(mx('white', 'plum', 28))} />
      <rect x={length * .3} y="20" width={length * .4} height="4" {...fill(mx('gold-light', 'plum', 60))} />
    </g>
    {/* The wooden ruler, from the top of the stack down to the table. */}
    <g transform={`translate(680 -90) rotate(${Math.atan2(90, 320) * 180 / Math.PI})`}>
      <rect x="0" y="0" width={Math.hypot(320, 90) + 6} height="8" rx="1.5" style={{ fill: 'url(#wr-ruler)' }} className="wr-ruler" />
      {Array.from({ length: 33 }, (_, i) => <path key={i} d={`M${6 + i * 10} 8V${i % 5 === 0 ? 2.5 : 5}`} style={{ stroke: mx('wood-dark', 'transparent', 80), strokeWidth: .9 }} />)}
      <rect x="0" y="0" width={Math.hypot(320, 90) + 6} height="1.6" {...fill(mx('white', 'transparent', 60))} />
    </g>
  </g>;
}

/** A yellow pencil lying across the table, under the lane at x. */
function Pencil({ x }: { x: number }) {
  return <g transform={`translate(${x} -2) rotate(-62)`}>
    <rect x="-46" y="-4" width="74" height="8" {...fill(mk('amber'))} />
    <rect x="-46" y="-4" width="74" height="2.6" {...fill(mx('sun', 'white', 60))} />
    <rect x="-46" y="1.6" width="74" height="2.4" {...fill(mx('orange', 'amber', 60))} />
    <path d="M28 -4L42 0L28 4Z" {...fill(mk('sand'))} />
    <path d="M38 -1.2L42 0L38 1.2Z" {...fill(mk('graphite'))} />
    <rect x="-56" y="-4" width="10" height="8" rx="1" {...fill(mk('rose'))} />
    <rect x="-48" y="-4.4" width="4" height="8.8" {...fill(mk('steel'))} />
  </g>;
}

function Blocks() {
  // A wooden wedge up to a long plank: from (1180,0) up to (1380,-30), then flat.
  return <g>
    <path d="M1180 0L1380 -30L1380 4L1180 4Z" {...fill(mx('sun', 'amber', 45))} />
    <path d="M1240 4L1380 -16L1380 4Z" {...fill(mx('amber', 'orange', 70))} />
    <path d="M1180 0L1380 -30L1380 -26.5L1186 1.4Z" {...fill(mx('white', 'transparent', 60))} />
    <rect x="1378" y="-30" width="400" height="34" rx="3" {...fill(mx('sky', 'water', 55))} />
    <rect x="1378" y="-30" width="400" height="5" rx="2" {...fill(mx('sky-pale', 'sky', 50))} />
    {[1460, 1560, 1660].map(x => <circle key={x} cx={x} cy="-12" r="5" {...fill(mx('white', 'transparent', 35))} />)}
  </g>;
}

/** Props drawn behind the car, for each track. */
export function TrackBack({ track }: { track: Track }) {
  return <g>
    {track.id === 'shelf' && track1Props()}
    {track.id === 'ramp' && <><StandingBook x={30} w={26} h={118} colour="teal-deep" /><StandingBook x={58} w={30} h={104} colour="red" /><StandingBook x={1180} w={28} h={126} colour="moss" lean={-6} /><StandingBook x={1210} w={24} h={112} colour="indigo" /></>}
    {track.id === 'table' && <><StandingBook x={250} w={30} h={120} colour="plum" /><StandingBook x={282} w={24} h={100} colour="celadon-deep" /><Blocks /></>}
  </g>;
}
/** Props the car rolls over (drawn under the car but over the back props). */
export function TrackFloor({ track }: { track: Track }) {
  return <g>
    {track.id === 'ramp' && <Ramp />}
    {track.id === 'table' && <Pencil x={380} />}
  </g>;
}

/** The start: a painted toy block behind the car and a strip of masking tape. */
export function StartLine({ track }: { track: Track }) {
  const nose = pointAt(track, track.start + 48).x;
  return <g>
    {/* A strip of masking tape across the table, torn at both ends. */}
    <path d={`M${nose - 4} ${TABLE_BACK + 16}l3 -2 3 2 2 -2 2 2L${nose + 15} ${TABLE_FRONT - 6}l-2 2 -3 -2 -2 2 -3 -2Z`} style={{ fill: mx('butter', 'sand', 55), opacity: .85 }} />
    <path d={`M${nose - 2} ${TABLE_BACK + 17}L${nose + 9} ${TABLE_FRONT - 7}`} style={{ stroke: mx('white', 'transparent', 45), strokeWidth: 1.4 }} />
    <g transform="translate(-6 -38)">
      <rect x="0" y="0" width="28" height="38" rx="4" {...fill(mk('red'))} />
      <rect x="0" y="0" width="28" height="5" rx="2.5" {...fill(mx('poppy', 'white', 70))} />
      <path d="M14 10l3 6.5 7 .6-5.3 4.6 1.6 6.8L14 25l-6.3 3.5 1.6-6.8L4 17.1l7-.6z" {...fill(mk('sun'))} />
    </g>
  </g>;
}

/** The finish flag: a toothpick and folded paper, stuck in a lump of clay. */
export function Flag({ x, y, flying, flagRef }: { x: number; y: number; flying: boolean; flagRef?: Ref<SVGGElement> }) {
  return <g transform={`translate(${x} ${y})`} className="wr-flag" data-flying={flying} ref={flagRef}>
    <ellipse cx="0" cy="1" rx="16" ry="3" {...fill(mx('shadow', 'transparent', 18))} />
    <rect x="-1.6" y="-128" width="3.2" height="124" rx="1.6" {...fill(mk('wood-light'))} />
    <rect x="-1.6" y="-128" width="1.2" height="124" {...fill(mx('white', 'transparent', 60))} />
    <g className="wr-flag__paper">
      <path d="M1.6 -126L56 -112L1.6 -96Z" {...fill(mk('poppy'))} />
      <path d="M1.6 -126L30 -118.6L1.6 -111Z" {...fill(mx('white', 'poppy', 30))} />
      <path d="M1.6 -96L56 -112L50 -108Z" {...fill(mx('red', 'shadow', 80))} />
    </g>
    <path d="M-13 0C-13 -10 -6 -14 0 -14C6 -14 13 -10 13 0Z" {...fill(mk('clay'))} />
    <path d="M-8 -6C-6 -11 -2 -12 2 -12" style={{ fill: 'none', stroke: mx('clay-light', 'transparent', 80), strokeWidth: 2, strokeLinecap: 'round' }} />
  </g>;
}

/** The cushion that catches an overshoot; `squashRef` scales it from its face. */
export function Cushion({ x, y, squashRef }: { x: number; y: number; squashRef?: Ref<SVGGElement> }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cx="44" cy="1" rx="50" ry="4" {...fill(mx('shadow', 'transparent', 22))} />
    <g ref={squashRef}>
      <path d="M2 -6C-2 -30 4 -52 16 -56C40 -62 60 -62 76 -56C88 -50 92 -30 86 -6C70 2 20 2 2 -6Z" style={{ fill: 'url(#wr-cushion)' }} className="wr-cushion" />
      <path d="M14 -48C30 -54 50 -54 70 -50" style={{ fill: 'none', stroke: mx('white', 'transparent', 55), strokeWidth: 3, strokeLinecap: 'round' }} />
      <path d="M44 -58C46 -40 46 -20 44 -2" style={{ fill: 'none', stroke: mx('celadon-deep', 'transparent', 60), strokeWidth: 1.2, strokeDasharray: '3 3' }} />
      <circle cx="44" cy="-30" r="4" {...fill(mx('celadon-deep', 'leaf-deep', 70))} />
      {[-2, 90].map(cx => <path key={cx} d={`M${cx} -10l-6 4 6 2z`} {...fill(mx('celadon-deep', 'celadon', 60))} />)}
    </g>
  </g>;
}

/** A painted wooden domino, standing; the game tips it about its front foot. */
export const DOMINO_COLOURS = ['red', 'amber', 'teal', 'violet', 'poppy', 'water'];
export function Domino({ colour, dominoRef }: { colour: string; dominoRef?: Ref<SVGGElement> }) {
  return <g ref={dominoRef}>
    <rect x="-13" y="-58" width="13" height="58" rx="2.5" {...fill(mk(colour))} />
    <rect x="-13" y="-58" width="4.4" height="58" rx="2" {...fill(mx('white', 'transparent', 35))} />
    <rect x="-3" y="-58" width="3" height="58" rx="1.5" {...fill(mx('shadow', 'transparent', 18))} />
    <rect x="-13" y="-30" width="13" height="2.4" {...fill(mx('white', 'transparent', 70))} />
    <circle cx="-6.5" cy="-45" r="2.4" {...fill(mk('white'))} />
    <circle cx="-6.5" cy="-14" r="2.4" {...fill(mk('white'))} />
  </g>;
}

/** A ball of wool with a loose end. */
export function WoolBall({ ballRef, spinRef }: { ballRef?: Ref<SVGGElement>; spinRef?: Ref<SVGGElement> }) {
  return <g ref={ballRef}>
    <ellipse cx="0" cy="1" rx="20" ry="3" {...fill(mx('shadow', 'transparent', 22))} />
    <path d="M14 -6C26 -2 34 2 48 0" style={{ fill: 'none', stroke: mk('rose'), strokeWidth: 2.4, strokeLinecap: 'round' }} />
    <g transform="translate(0 -20)">
      <g ref={spinRef}>
        <circle r="20" style={{ fill: 'url(#wr-wool)' }} className="wr-wool" />
        {['M-18 -6C-6 -2 6 -2 18 -8', 'M-16 6C-4 10 8 10 18 4', 'M-8 -18C-2 -6 -2 6 -8 18', 'M6 -19C12 -6 12 6 6 19', 'M-19 -1C-8 4 8 -10 14 -14'].map(d => <path key={d} d={d} style={{ fill: 'none', stroke: mx('rose-deep', 'transparent', 55), strokeWidth: 1.6, strokeLinecap: 'round' }} />)}
        <path d="M-12 -12C-6 -16 2 -17 8 -15" style={{ fill: 'none', stroke: mx('white', 'transparent', 55), strokeWidth: 2, strokeLinecap: 'round' }} />
      </g>
    </g>
  </g>;
}

/** The paper tunnel: its back half sits behind the car, its front sheet over it.
 * The paper lets the light through, so the car shows as a shadow inside. */
export function TunnelBack({ from, to }: { from: number; to: number }) {
  return <path d={`M${from} 4C${from} -96 ${to} -96 ${to} 4Z`} {...fill(mx('linen-shade', 'umber', 80))} />;
}
export function TunnelFront({ from, to }: { from: number; to: number }) {
  const w = to - from, folds = 5;
  const arch = `M${from} 6C${from} -104 ${to} -104 ${to} 6Z`;
  return <g>
    {/* One sheet of printed paper bent into a long arch. It glows a little in
        the window light and lets the car show through as a shadow. */}
    <path d={arch} style={{ fill: 'url(#wr-tunnel)', opacity: .8 }} />
    {Array.from({ length: folds }, (_, i) => from + (i + 0.5) * w / folds).map((x, i) => <path key={x} d={`M${x - w / folds / 2} 6L${x - w / folds / 2} -60L${x + w / folds / 2} -60L${x + w / folds / 2} 6Z`} style={{ fill: i % 2 ? mx('paper-shade', 'transparent', 30) : mx('white', 'transparent', 20) }} clipPath="url(#wr-arch)" />)}
    <clipPath id="wr-arch"><path d={arch} /></clipPath>
    <g clipPath="url(#wr-arch)">
      {Array.from({ length: 9 }, (_, row) => Array.from({ length: Math.ceil(w / 34) }, (_, col) => <circle key={`${row}:${col}`} cx={from + 12 + col * 34 + (row % 2) * 17} cy={-6 - row * 11} r="3.2" style={{ fill: mx(row % 3 === 0 ? 'rose' : row % 3 === 1 ? 'sky' : 'amber', 'transparent', 55) }} />))}
      <rect x={from} y="-20" width={w} height="26" style={{ fill: mx('umber', 'transparent', 10) }} />
    </g>
    {/* The cut paper edges at each end, a little curled. */}
    <path d={`M${from} 6C${from} -60 ${from + 30} -90 ${from + 70} -96C${from + 34} -86 ${from + 8} -56 ${from + 7} 6Z`} {...fill(mx('linen-shade', 'umber', 70))} />
    <path d={`M${to} 6C${to} -60 ${to - 30} -90 ${to - 70} -96C${to - 34} -86 ${to - 8} -56 ${to - 7} 6Z`} {...fill(mx('linen-shade', 'umber', 70))} />
    <path d={`M${from + 26} -46C${from + 46} -78 ${to - 70} -86 ${to - 34} -66`} style={{ fill: 'none', stroke: mx('white', 'transparent', 75), strokeWidth: 3, strokeLinecap: 'round' }} />
  </g>;
}

/** Chalk marks where earlier runs reached; the newest is the brightest. */
export function ChalkMarks({ track, marks }: { track: Track; marks: readonly number[] }) {
  return <g>{marks.map((reach, i) => {
    const p = pointAt(track, Math.min(reach, shapeOf(track).total));
    const fresh = i === marks.length - 1;
    return <g key={`${i}:${reach}`} transform={`translate(${p.x} ${-p.y})`} style={{ opacity: fresh ? 1 : .32 + i * .16 }}><g className="wr-chalk" data-fresh={fresh}>
      {/* A chalk tick across the front of the table: rough, two strokes. */}
      <path d="M-4 -6L5 24" style={{ fill: 'none', stroke: mx('wood-dark', 'transparent', 25), strokeWidth: 7, strokeLinecap: 'round' }} />
      <path d="M-5 -8L4 22" style={{ fill: 'none', stroke: mk('chalk'), strokeWidth: 5, strokeLinecap: 'round' }} />
      <path d="M-3 -6L5.5 20" style={{ fill: 'none', stroke: mk('white'), strokeWidth: 1.6, strokeLinecap: 'round', strokeDasharray: '6 3' }} />
      <path d="M-10 10L11 8" style={{ fill: 'none', stroke: mx('chalk', 'transparent', 85), strokeWidth: 3.6, strokeLinecap: 'round' }} />
    </g></g>;
  })}</g>;
}

/** The rolling line, for the little map. */
export function trackLine(track: Track): string {
  return track.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${-y}`).join('');
}
