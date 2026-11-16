import { useId } from 'react';
import { CrankDefs, EngineArt, STAGE_BOX, poseOf } from './crankArt';
import { KIT_COMPANION, KIT_STAGE } from './crankKit';
import '../makerPalette.css';

/** How Things Move cover: the glass piston on the TrailBench in the Wonderworks
 * pavilion, close up: the big wheel, the glass half cleared with the crank and
 * rod showing, and the bench's companion looking on. A kit picture with the
 * activity's own machine on it. The wheel sits left of the middle (the Studio stands
 * the player's hero to the right of a card window), so the picture reads as a
 * square tile, a tall book row and a wide card window alike. */
const POSE = poseOf(5.2, 'engine');
const S = 0.9, DX = 150 - POSE.sx * S, DY = 158 - POSE.sy * S;
export default function CrankWorksCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  const { watch, faces } = KIT_COMPANION, friend = 100, fx = 270, fh = friend * watch.height / watch.width, fy = 456 - fh;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <CrankDefs id={id} />
    <g transform={`translate(${DX} ${DY}) scale(${S})`}>
      <image href={KIT_STAGE.src} x={STAGE_BOX.x} y={STAGE_BOX.y} width={STAGE_BOX.w} height={STAGE_BOX.h} preserveAspectRatio="none" />
      <EngineArt id={id} pose={POSE} open={0.5} />
      {/* The companion looks across at the machine: the kit picture, turned to face it. */}
      <image href={watch.src} x={fx} y={fy} width={friend} height={fh} transform={faces === 'right' ? `translate(${2 * fx + friend} 0) scale(-1 1)` : undefined} />
    </g>
  </svg>;
}
