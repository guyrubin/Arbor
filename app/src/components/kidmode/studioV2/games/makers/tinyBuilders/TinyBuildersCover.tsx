import PhageArt, { fibreTips } from './PhageArt';
import { Turntable } from './TinyScenes';
import { ART_ROOM, ART_TRAILBENCH } from './tinyKitArt';

/** Tiny Structures cover, a kit picture: the Wonderworks pavilion, the
 * TrailBench, and on its white turntable the finished glass model, with Aya
 * looking on. Fills its box; one subject that reads at 80 px (tile, sticker)
 * and in the tall card window. The room, the TrailBench and Aya are the kit's
 * own pictures; only the model and its turntable are drawn. */
const AYA = '/visuals/studio-v2/bop/aya-idle.webp';
export default function TinyBuildersCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  // The card window is wide (its crop keeps only the middle band), the tile
  // square: the card draws the model smaller and a little off-centre, so the
  // hero beside it never covers the head.
  const card = size === 'card';
  const s = card ? 0.52 : 0.76, ground = card ? 204 : 240, x = card ? 176 : 200;
  const benchW = 660 * s, benchX = x - benchW * 0.53, benchY = ground - benchW * (342 / 655) * 0.18;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <image href={ART_ROOM.src480} x={0} y={card ? -96 : -70} width={400} height={400} preserveAspectRatio="xMidYMid slice" />
    <image href={ART_TRAILBENCH.src480} x={benchX} y={benchY} width={benchW} height={benchW * 342 / 655} />
    <g transform={`translate(${x - 200 * s} ${ground - 338 * s}) scale(${s})`}>
      <Turntable rotation={22} tilt={0.22} tips={fibreTips(22, 0.22)} />
      <PhageArt rotation={22} tilt={0.22} />
    </g>
    <image href={AYA} x={x - 150 * s - 74} y={ground + 26 - 96} width={96} height={96} />
  </svg>;
}
