import { useId } from 'react';

/** The Maker Desk room, drawn once at 360 by 420: a wall with a window and a
 * cork pinboard, a two-plank shelf, and the wooden desk with the cream-and-teal
 * computer, a desk lamp, a mug of pencils and a potted plant. Paper-cut and
 * matte-clay shapes, one light from the top left (the window), soft contact
 * shadows and a little grain. It is the same way round in both reading
 * directions. Interactive places are real buttons laid over it by the game. */
export interface RoomLook {
  light: 'day' | 'evening';
  blind: 'open' | 'closed';
  bird: boolean;
  screen: 'off' | 'warming' | 'on';
}
const v = (name: string) => ({ fill: `var(--mk-${name})` });
const mix = (a: string, b: string, p: number) => ({ fill: `color-mix(in srgb, var(--mk-${a}) ${p}%, var(--mk-${b}))` });
const stop = (name: string, opacity = 1) => ({ stopColor: `var(--mk-${name})`, stopOpacity: opacity });
const stopMix = (a: string, b: string, p: number) => ({ stopColor: `color-mix(in srgb, var(--mk-${a}) ${p}%, var(--mk-${b}))` });

export function DeskRoomArt({ look }: { look: RoomLook }) {
  const id = useId();
  const u = (name: string) => `url(#${id}${name})`;
  const evening = look.light === 'evening';
  return <svg className="md-room-art" viewBox="0 0 360 420" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" data-light={look.light} data-blind={look.blind} data-screen={look.screen}>
    <defs>
      <linearGradient id={`${id}wall`} x1="0" y1="0" x2=".35" y2="1"><stop offset="0" style={stop('paper')} /><stop offset=".6" style={stop('cream')} /><stop offset="1" style={stopMix('cream', 'paper-shade', 45)} /></linearGradient>
      <radialGradient id={`${id}glow`} cx=".2" cy=".15" r=".75"><stop offset="0" style={stop('white', 0.75)} /><stop offset="1" style={stop('white', 0)} /></radialGradient>
      <linearGradient id={`${id}skyDay`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('sky')} /><stop offset="1" style={stop('sky-pale')} /></linearGradient>
      <linearGradient id={`${id}skyEve`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('indigo-deep')} /><stop offset=".55" style={stopMix('violet', 'rose-deep', 45)} /><stop offset="1" style={stop('amber')} /></linearGradient>
      <linearGradient id={`${id}frame`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop('wood-light')} /><stop offset="1" style={stop('wood')} /></linearGradient>
      <linearGradient id={`${id}blind`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('white')} /><stop offset="1" style={stop('linen')} /></linearGradient>
      <linearGradient id={`${id}cork`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stopMix('sand', 'wood-light', 70)} /><stop offset="1" style={stopMix('wood-light', 'wood', 75)} /></linearGradient>
      <linearGradient id={`${id}plank`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('wood-light')} /><stop offset="1" style={stop('wood')} /></linearGradient>
      <linearGradient id={`${id}deskTop`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stopMix('wood-light', 'sand', 70)} /><stop offset="1" style={stop('wood-light')} /></linearGradient>
      <linearGradient id={`${id}deskFront`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('wood')} /><stop offset="1" style={stopMix('wood', 'wood-dark', 55)} /></linearGradient>
      <linearGradient id={`${id}plastic`} x1="0" y1="0" x2=".6" y2="1"><stop offset="0" style={stop('white')} /><stop offset=".45" style={stop('cream')} /><stop offset="1" style={stopMix('cream', 'paper-shade', 30)} /></linearGradient>
      <linearGradient id={`${id}teal`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('celadon')} /><stop offset="1" style={stop('teal')} /></linearGradient>
      <radialGradient id={`${id}glassOff`} cx=".35" cy=".3" r=".9"><stop offset="0" style={stopMix('slate', 'graphite', 50)} /><stop offset="1" style={stop('night')} /></radialGradient>
      <radialGradient id={`${id}glassOn`} cx=".5" cy=".45" r=".75"><stop offset="0" style={stopMix('sea', 'teal', 45)} /><stop offset=".6" style={stop('teal-deep')} /><stop offset="1" style={stop('night')} /></radialGradient>
      <linearGradient id={`${id}shade`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop('celadon')} /><stop offset="1" style={stop('teal-deep')} /></linearGradient>
      <linearGradient id={`${id}beam`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('sun', 0.55)} /><stop offset="1" style={stop('sun', 0)} /></linearGradient>
      <radialGradient id={`${id}dusk`} cx=".17" cy=".52" r=".95"><stop offset="0" style={stop('indigo-deep', 0.05)} /><stop offset=".35" style={stop('indigo-deep', 0.35)} /><stop offset="1" style={stop('indigo-deep', 0.7)} /></radialGradient>
      <radialGradient id={`${id}warmth`} cx=".5" cy=".5" r=".5"><stop offset="0" style={stop('amber', 0.5)} /><stop offset="1" style={stop('amber', 0)} /></radialGradient>
      <radialGradient id={`${id}lampPool`} cx=".5" cy=".5" r=".5"><stop offset="0" style={stop('butter', 0.85)} /><stop offset="1" style={stop('butter', 0)} /></radialGradient>
      <radialGradient id={`${id}halo`} cx=".5" cy=".5" r=".5"><stop offset="0" style={stop('sea', 0.55)} /><stop offset="1" style={stop('sea', 0)} /></radialGradient>
      <linearGradient id={`${id}pot`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('clay-light')} /><stop offset="1" style={stop('clay')} /></linearGradient>
      <linearGradient id={`${id}mug`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('rose')} /><stop offset="1" style={stop('rose-deep')} /></linearGradient>
      <filter id={`${id}soft`} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      <filter id={`${id}paperGrain`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" stitchTiles="stitch" /><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" /></filter>
      <clipPath id={`${id}glassClip`}><rect x="32" y="38" width="92" height="96" rx="3" /></clipPath>
      <clipPath id={`${id}screenClip`}><rect x="78" y="193" width="102" height="67" rx="11" /></clipPath>
    </defs>

    {/* The wall, lit from the window. */}
    <rect width="360" height="420" fill={u('wall')} />
    <rect width="360" height="300" fill={u('glow')} />
    <path d="M0 292h360v8H0z" style={mix('paper-shade', 'wood-light', 60)} opacity=".7" />

    {/* The window: the sky outside, a branch, the blind, the sill. */}
    <rect x="18" y="24" width="120" height="132" rx="8" style={mix('paper-shade', 'wood', 70)} opacity=".35" filter={u('soft')} />
    <rect x="22" y="28" width="112" height="116" rx="7" fill={u('frame')} />
    <g clipPath={u('glassClip')}>
      <rect x="32" y="38" width="92" height="96" fill={evening ? u('skyEve') : u('skyDay')} />
      {evening
        ? <g><circle cx="102" cy="58" r="8" style={v('butter')} /><circle cx="106" cy="55" r="7" style={mix('indigo-deep', 'violet', 70)} /><circle cx="50" cy="52" r="1.2" style={v('butter')} /><circle cx="70" cy="64" r="1" style={v('butter')} /><circle cx="88" cy="46" r="1" style={v('butter')} /></g>
        : <g><ellipse cx="58" cy="62" rx="17" ry="6" style={v('white')} opacity=".95" /><ellipse cx="68" cy="58" rx="10" ry="6" style={v('white')} /><ellipse cx="102" cy="80" rx="12" ry="4" style={v('white')} opacity=".8" /></g>}
      <path d="M32 120c14-10 28-12 44-6s30 2 48-6v26H32z" style={evening ? mix('teal-deep', 'indigo-deep', 55) : v('sage')} />
      <path d="M32 128c20-8 40-6 60-2s22 0 32-4v12H32z" style={evening ? v('indigo-deep') : v('leaf')} opacity=".9" />
      <path d="M124 40c-12 6-20 14-26 26" strokeWidth="3" strokeLinecap="round" fill="none" style={{ stroke: 'var(--mk-wood-dark)' }} />
      {[[112, 46, -30], [104, 54, 20], [98, 64, -10], [118, 52, 60]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx="6" ry="3" transform={`rotate(${r} ${x} ${y})`} style={evening ? mix('leaf-deep', 'indigo-deep', 50) : i % 2 ? v('leaf') : v('spring')} />)}
      {/* The bird lands on the outside ledge. */}
      <g className="md-bird" data-here={look.bird && look.blind === 'open'}>
        <ellipse cx="96" cy="131" rx="9" ry="1.6" style={v('shadow')} opacity=".2" />
        <path d="M86 120c0-7 5-11 11-11 5 0 8 3 9 7l5 1-5 3c-1 6-6 10-12 10-5 0-8-4-8-10z" style={v('rose')} />
        <path d="M90 121c2 4 6 6 11 5-2 3-6 5-10 3-2-1-2-4-1-8z" style={v('blossom')} />
        <path d="M87 118c4-2 9-1 12 3-5 1-9 0-12-3z" style={v('rose-deep')} />
        <path d="M106 116l5 1-5 2z" style={v('amber')} /><circle cx="101.5" cy="114.5" r="1.3" style={v('ink')} />
        <path d="M93 129v3M98 129v3" strokeWidth="1.2" strokeLinecap="round" style={{ stroke: 'var(--mk-amber)' }} />
      </g>
      <rect x="32" y="38" width="92" height="96" style={v('white')} opacity=".08" />
      <path d="M40 40l26 0-30 50z" style={v('white')} opacity=".14" />
    </g>
    <rect x="76" y="36" width="4" height="100" style={mix('wood', 'wood-light', 50)} />
    <rect x="30" y="84" width="96" height="4" style={mix('wood', 'wood-light', 50)} />
    {/* The roller blind: rolled up when open, down and softly folded when closed. */}
    <g className="md-blind" data-open={look.blind === 'open'}>
      <rect x="31" y="38" width="94" height="92" fill={u('blind')} />
      {[52, 68, 84, 100, 116].map(y => <rect key={y} x="31" y={y} width="94" height="1.5" style={v('linen-shade')} opacity=".7" />)}
      <rect x="31" y="126" width="94" height="6" rx="2" style={v('wood-light')} />
      <circle cx="78" cy="138" r="3" style={v('wood')} />
    </g>
    <rect x="26" y="30" width="104" height="10" rx="5" style={v('linen')} />
    <rect x="26" y="30" width="104" height="4" rx="2" style={v('white')} opacity=".6" />
    <rect x="14" y="144" width="128" height="9" rx="3" style={v('wood-light')} />
    <rect x="14" y="150" width="128" height="3" rx="1.5" style={v('wood')} />
    <ellipse cx="78" cy="158" rx="58" ry="3" style={v('shadow')} opacity=".1" />

    {/* The cork pinboard with paper scraps. */}
    <rect x="202" y="24" width="138" height="90" rx="7" style={v('wood')} opacity=".3" filter={u('soft')} transform="translate(2 3)" />
    <rect x="200" y="22" width="138" height="90" rx="7" fill={u('frame')} />
    <rect x="206" y="28" width="126" height="78" rx="4" fill={u('cork')} />
    {[[214, 36], [236, 60], [262, 44], [290, 92], [318, 40], [226, 96], [306, 70], [250, 84], [278, 34]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r=".9" style={v('wood-dark')} opacity=".45" />)}
    <g transform="rotate(-6 232 52)"><rect x="213" y="36" width="40" height="34" rx="2" style={v('shadow')} opacity=".12" transform="translate(1.5 2)" /><rect x="213" y="36" width="40" height="34" rx="2" style={v('butter')} />
      {[46, 53, 60].map((y, i) => <rect key={y} x="218" y={y} width={i === 2 ? 18 : 28} height="2" rx="1" style={v('ink-soft')} opacity=".35" />)}</g>
    <circle cx="233" cy="38" r="3" style={v('poppy')} /><circle cx="232" cy="37" r="1" style={v('white')} opacity=".6" />
    <g transform="rotate(5 284 58)"><rect x="262" y="34" width="44" height="48" rx="2" style={v('shadow')} opacity=".12" transform="translate(1.5 2)" /><rect x="262" y="34" width="44" height="48" rx="2" style={v('white')} />
      <circle cx="294" cy="46" r="6" style={v('sun')} />
      {[0, 60, 120, 180, 240, 300].map(a => <rect key={a} x="293" y="36" width="2" height="4" rx="1" style={v('amber')} transform={`rotate(${a} 294 46)`} />)}
      <path d="M268 78v-14l10-8 10 8v14z" style={v('sky')} /><path d="M266 65l12-10 12 10z" style={v('rose')} /><rect x="275" y="70" width="5" height="8" style={v('wood')} /></g>
    <circle cx="284" cy="36" r="3" style={v('teal')} /><circle cx="283" cy="35" r="1" style={v('white')} opacity=".6" />
    <g transform="rotate(-3 322 66)"><rect x="313" y="34" width="18" height="62" rx="2" style={v('white')} />
      {['teal', 'amber', 'rose', 'leaf'].map((ink, i) => <rect key={ink} x="316" y={37 + i * 14.5} width="12" height="12" rx="1.5" style={v(ink)} />)}</g>
    <path d="M220 86l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" style={v('gold-light')} transform="rotate(-8 224 98)" />
    <g transform="rotate(3 276 96)"><rect x="252" y="86" width="46" height="20" rx="2" style={v('sky-pale')} /><path d="M255 100c5-4 9-4 13 0s9 4 13 0 9-4 13 0" fill="none" strokeWidth="2" strokeLinecap="round" style={{ stroke: 'var(--mk-sea)' }} /></g>

    {/* The shelf: two planks on brass brackets. The things stand on them. */}
    {[172, 238].map(y => <g key={y}>
      <ellipse cx="270" cy={y + 12} rx="76" ry="4" style={v('shadow')} opacity=".12" filter={u('soft')} />
      <path d={`M212 ${y + 8}v10l10-10zM318 ${y + 8}l10 10v-10z`} style={v('brass')} />
      <rect x="194" y={y} width="152" height="9" rx="3" fill={u('plank')} />
      <rect x="194" y={y} width="152" height="2.5" rx="1.2" style={v('wood-light')} />
      <rect x="194" y={y + 7} width="152" height="2" rx="1" style={v('wood-dark')} opacity=".5" />
    </g>)}
    <path d="M232 247v9M262 247v9" strokeWidth="1" style={{ stroke: 'var(--mk-wood-dark)' }} opacity=".6" />

    {/* The plant, at the end of the desk. */}
    <ellipse cx="324" cy="300" rx="26" ry="4" style={v('shadow')} opacity=".2" filter={u('soft')} />
    {[['M324 268c-6-16-22-22-30-18 4 10 16 18 30 18z', 'leaf'], ['M324 268c2-18 16-30 26-28-2 12-12 24-26 28z', 'leaf-deep'], ['M324 268c-14-6-30-2-34 6 12 4 24 2 34-6z', 'spring'], ['M324 268c-2-20 4-32 10-36 4 12 0 26-10 36z', 'moss'], ['M324 268c10-10 26-10 30-4-8 8-20 8-30 4z', 'leaf']].map(([d, ink], i) => <path key={i} d={d} style={v(ink)} />)}
    <path d="M306 268h36l-4 32h-28z" fill={u('pot')} />
    <rect x="303" y="264" width="42" height="8" rx="3" style={v('clay-light')} />
    <path d="M310 276h4l-2 20h-3z" style={v('white')} opacity=".2" />

    {/* The desk. */}
    <path d="M0 296h360v16H0z" fill={u('deskTop')} />
    <path d="M0 296h360v2.5H0z" style={v('white')} opacity=".35" />
    {[[20, 302, 90], [150, 305, 120], [250, 301, 80]].map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height="1" rx=".5" style={v('wood')} opacity=".35" />)}
    <path d="M0 312h360v108H0z" fill={u('deskFront')} />
    <path d="M0 312h360v4H0z" style={v('wood-dark')} opacity=".45" />
    <rect x="118" y="320" width="124" height="30" rx="6" style={mix('wood', 'wood-light', 60)} />
    <rect x="118" y="346" width="124" height="4" rx="2" style={v('wood-dark')} opacity=".35" />
    <rect x="164" y="330" width="32" height="8" rx="4" style={v('brass')} /><rect x="166" y="331" width="28" height="2.5" rx="1.2" style={v('gold-light')} opacity=".7" />
    {[[24, 334, 70], [270, 338, 64], [20, 410, 120], [230, 412, 110]].map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height="1.2" rx=".6" style={v('wood-dark')} opacity=".3" />)}
    {/* A slightly worn patch where the stickers go. */}
    <rect x="70" y="358" width="220" height="54" rx="14" style={mix('wood', 'wood-dark', 70)} opacity=".45" />

    {/* The mug of pencils. */}
    <ellipse cx="249" cy="300" rx="16" ry="3" style={v('shadow')} opacity=".22" filter={u('soft')} />
    {[['amber', 240, -8], ['sea', 248, 4], ['leaf', 255, 12]].map(([ink, x, r], i) => <g key={i} transform={`rotate(${r} ${x} 280)`}><rect x={Number(x) - 2} y="256" width="4" height="30" rx="1" style={v(String(ink))} /><path d={`M${Number(x) - 2} 256l2-6 2 6z`} style={v('sand')} /></g>)}
    <path d="M238 272h22v22a4 4 0 0 1-4 4h-14a4 4 0 0 1-4-4z" fill={u('mug')} />
    <path d="M260 277c7 0 7 12 0 12" fill="none" strokeWidth="3" style={{ stroke: 'var(--mk-rose-deep)' }} />
    <rect x="241" y="275" width="3" height="18" rx="1.5" style={v('white')} opacity=".25" />

    {/* The computer: cream plastic, teal trim, a slightly curved screen. */}
    <ellipse cx="130" cy="300" rx="76" ry="5" style={v('shadow')} opacity=".22" filter={u('soft')} />
    <path d="M110 286h40l6 12h-52z" style={mix('cream', 'paper-shade', 40)} />
    <rect x="58" y="176" width="144" height="116" rx="18" fill={u('plastic')} />
    <path d="M70 180h120a14 14 0 0 1 10 6H62a14 14 0 0 1 8-6z" style={v('white')} opacity=".6" />
    <rect x="58" y="282" width="144" height="10" rx="5" style={v('paper-shade')} opacity=".5" />
    <rect x="70" y="186" width="118" height="80" rx="15" style={mix('paper-shade', 'linen-shade', 60)} />
    <rect x="73" y="189" width="112" height="75" rx="13" style={v('linen-shade')} opacity=".7" />
    <g clipPath={u('screenClip')} className="md-screen" data-screen={look.screen}>
      <rect x="78" y="193" width="102" height="67" fill={u('glassOff')} />
      <g className="md-screen__on">
        <rect x="78" y="193" width="102" height="67" fill={u('glassOn')} />
        {/* A tiny desktop, seen from the room: three icons and a sun. */}
        <rect x="78" y="193" width="102" height="8" style={v('teal-deep')} />
        {[[92, 'amber'], [122, 'rose'], [152, 'spring']].map(([x, ink]) => <g key={String(x)}><rect x={Number(x)} y="216" width="16" height="16" rx="2" style={v('indigo-deep')} /><rect x={Number(x) + 4} y="220" width="8" height="8" style={v(String(ink))} /><rect x={Number(x) + 1} y="236" width="14" height="2" style={v('cream')} opacity=".7" /></g>)}
        <path d="M78 252l10-4 10 2 12-5 14 3 12-4 14 4 12-3 18 4v12H78z" style={v('teal')} opacity=".7" />
        {Array.from({ length: 11 }, (_, i) => <rect key={i} x="78" y={194 + i * 6} width="102" height="1.4" style={v('night')} opacity=".22" />)}
      </g>
      <path d="M84 198c20-4 46-4 64-2l-58 42c-6-14-8-26-6-40z" style={v('white')} opacity=".1" />
      <rect x="78" y="193" width="102" height="67" rx="11" fill="none" strokeWidth="8" style={{ stroke: 'var(--mk-night)' }} opacity=".35" />
    </g>
    <rect x="72" y="272" width="44" height="5" rx="2.5" fill={u('teal')} />
    <rect x="124" y="272" width="6" height="5" rx="2.5" style={v('teal')} opacity=".6" />
    {[160, 166, 172].map(x => <rect key={x} x={x} y="271" width="3" height="8" rx="1.5" style={v('paper-shade')} />)}
    <circle cx="186" cy="275" r="3.4" className="md-led" style={look.screen === 'off' ? v('steel-dark') : v('spring')} />
    {look.screen !== 'off' && <circle cx="186" cy="275" r="7" style={v('spring')} opacity=".3" />}

    {/* The keyboard and a mouse. */}
    <path d="M70 303l6-6h108l6 6v7a3 3 0 0 1-3 3H73a3 3 0 0 1-3-3z" fill={u('plastic')} />
    {[0, 1].map(row => Array.from({ length: 12 }, (_, i) => <rect key={`${row}-${i}`} x={80 + i * 8.6 - row * 2} y={299 + row * 5} width="6.6" height="3.6" rx="1" style={(i + row * 3) % 5 === 0 ? v('teal') : mix('paper-shade', 'cream', 60)} />))}
    <rect x="100" y="309" width="60" height="2.6" rx="1.3" style={mix('paper-shade', 'cream', 60)} />
    <ellipse cx="130" cy="315" rx="62" ry="2" style={v('shadow')} opacity=".18" />
    <path d="M200 312c-2-6 2-10 7-10s9 4 7 10z" fill={u('plastic')} /><path d="M207 302v4" strokeWidth="1" style={{ stroke: 'var(--mk-paper-shade)' }} />
    <path d="M207 302c0-8-8-6-14-10" fill="none" strokeWidth="1.4" style={{ stroke: 'var(--mk-paper-shade)' }} />

    {/* The desk lamp: a teal shade on a jointed arm. */}
    <ellipse cx="32" cy="299" rx="24" ry="3.5" style={v('shadow')} opacity=".22" filter={u('soft')} />
    <path d="M14 296c0-6 8-9 18-9s18 3 18 9z" fill={u('shade')} />
    <path d="M31 288l-8-52" strokeWidth="5" strokeLinecap="round" style={{ stroke: 'var(--mk-teal-deep)' }} />
    <path d="M23 236l30-26" strokeWidth="5" strokeLinecap="round" style={{ stroke: 'var(--mk-teal-deep)' }} />
    <circle cx="23" cy="236" r="5" style={v('brass')} /><circle cx="53" cy="210" r="4.5" style={v('brass')} />
    <g transform="rotate(28 60 214)">
      <path d="M44 212c0-12 7-20 16-20s16 8 16 20z" fill={u('shade')} />
      <path d="M48 202c3-6 7-8 12-8" fill="none" strokeWidth="2" strokeLinecap="round" style={{ stroke: 'var(--mk-white)' }} opacity=".45" />
      <ellipse cx="60" cy="212" rx="16" ry="3.5" style={evening ? v('butter') : v('teal-deep')} />
      {evening && <ellipse cx="60" cy="213" rx="8" ry="3" style={v('white')} />}
    </g>

    {/* Evening: the whole room dims and the lamp throws a warm pool on the desk. */}
    <g className="md-evening" data-on={evening}>
      <rect width="360" height="420" className="md-evening__tint" fill={u('dusk')} />
      <circle cx="62" cy="240" r="120" fill={u('warmth')} className="md-evening__beam" />
      <path d="M60 220L14 304h110z" fill={u('beam')} className="md-evening__beam" />
      <ellipse cx="66" cy="302" rx="58" ry="10" fill={u('lampPool')} className="md-evening__pool" />
    </g>
    {/* The screen's own glow is on top of any evening. */}
    {look.screen !== 'off' && <ellipse cx="129" cy="226" rx="88" ry="66" fill={u('halo')} className="md-screen-halo" />}
    <rect width="360" height="420" filter={u('paperGrain')} opacity=".07" className="md-grain" />
  </svg>;
}
