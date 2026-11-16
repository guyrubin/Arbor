import { memo } from 'react';
import { CLOTH_R, HOOP_CX, HOOP_CY } from './stitchGardenStitches';
import type { VisitorKind } from './stitchGardenCritters';
import { FERN, GOBGOB_GLAD, GOBGOB_WAITING, LEAFLAB, PINCUSHION, WAITRING, type KitPicture } from './stitchGardenKit';
import { CritterArt, KitProp } from './StitchArt';

/** What lies round the hoop on Aya's table, in the hoop drawing's own units:
 * the fern (the kit's, from above), the knit pincushion the needle rests in,
 * her LeafLab, and the small visitors worked in thread. Each is a toy: the
 * game lays a real button over it. GobGob's WaitRing rides in the HUD. */

const boxOf = (picture: KitPicture, x: number, y: number, w: number) => ({ x, y, w, h: w * picture.height / picture.width });
/** Where each thing lies (the picture's box, in drawing units). */
export const PLACES = {
  pincushion: boxOf(PINCUSHION, 366, 380, 62),
  leafLab: LEAFLAB ? { x: 2, y: 392, w: 52, h: 52 * LEAFLAB.crop.h / LEAFLAB.crop.w } : null,
  screw: { x: HOOP_CX + 15, y: -4, w: 36, h: 36 },
} as const;
/** The fern stands at one of the two far corners, half off the edge of the picture. */
export const fernPlace = (side: 1 | -1) => boxOf(FERN, side > 0 ? 356 : -66, -44, 150);
/** The middle line of the hoop's wood, where the ladybird walks. */
export const RING_R = CLOTH_R + 12;
/** Under the clasp at the top of the hoop: where the ladybird lives. */
export const BUG_HOME = -90, BUG_PEEK = -60;

/** The fern: its fronds stir in the air from the window, and rustle when touched. */
export const Fern = memo(function Fern({ side, rustle }: { side: 1 | -1; rustle: number }) {
  const b = fernPlace(side), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return <g className="sg-fern" data-rustle={rustle ? rustle % 2 : undefined} pointerEvents="none">
    <g className="sg-fern__sway" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <image href={FERN.src} x={b.x} y={b.y} width={b.w} height={b.h} transform={side > 0 ? undefined : `translate(${cx * 2} 0) scale(-1 1)`} />
    </g>
  </g>;
});

/** The knit round the needle rests in. */
export const Pincushion = memo(function Pincushion({ ping }: { ping: number }) {
  const b = PLACES.pincushion;
  return <g className="sg-pin" data-ping={ping ? ping % 2 : undefined} style={{ transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h / 2}px` }}><KitProp picture={PINCUSHION} x={b.x} y={b.y} width={b.w} /></g>;
});

/** Aya's LeafLab: the puck that reads water, light and warmth. */
export const LeafLab = memo(function LeafLab({ ping }: { ping: number }) {
  const b = PLACES.leafLab;
  if (!b || !LEAFLAB) return null;
  const c = LEAFLAB.crop;
  return <g className="sg-lab" data-ping={ping ? ping % 2 : undefined} style={{ transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h}px` }} pointerEvents="none">
    <ellipse cx={b.x + b.w / 2 + 3} cy={b.y + b.h - 4} rx={b.w * 0.44} ry={b.h * 0.2} style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 26%, transparent)' }} />
    <svg x={b.x} y={b.y} width={b.w} height={b.h} viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`}><image href={LEAFLAB.src} width={LEAFLAB.width} height={LEAFLAB.height} /></svg>
  </g>;
});

export interface VisitorPose { x: number; y: number; face: 1 | -1; ms: number; loop: number; away: boolean }
/** The bee, firefly or butterfly: it flies where the game sends it (a transform, eased by CSS) and hovers there. */
export const Visitor = memo(function Visitor({ kind, pose }: { kind: VisitorKind; pose: VisitorPose }) {
  return <g className="sg-visitor" data-away={pose.away} style={{ transform: `translate(${pose.x}px, ${pose.y}px)`, transitionDuration: `${pose.ms}ms` }} pointerEvents="none">
    <g className="sg-visitor__loop" data-loop={pose.loop ? pose.loop % 2 : undefined}>
      <g className="sg-visitor__bob"><g style={{ transform: `scale(${pose.face * 0.92}, 0.92)` }}><CritterArt kind={kind} /></g></g>
    </g>
  </g>;
});

export interface BugPose { theta: number; ms: number; walking: boolean; out: boolean; hop: number; dir: 1 | -1 }
/** The ladybird on the hoop's wood: it turns about the hoop's centre, so it walks the ring. */
export const Ladybird = memo(function Ladybird({ pose }: { pose: BugPose }) {
  return <g className="sg-bug" data-out={pose.out} data-walking={pose.walking} style={{ transformOrigin: `${HOOP_CX}px ${HOOP_CY}px`, transform: `rotate(${pose.theta}deg)`, transitionDuration: `${pose.ms}ms` }} pointerEvents="none">
    <g transform={`translate(${HOOP_CX + RING_R} ${HOOP_CY}) rotate(${pose.dir > 0 ? 90 : -90})`}>
      <g className="sg-bug__hop" data-hop={pose.hop ? pose.hop % 2 : undefined}><g transform="scale(.86)"><CritterArt kind="ladyBird" /></g></g>
    </g>
  </g>;
});

/** The showing hand: it comes from the chosen seed packet, taps the open mark
 * and goes, so a child who cannot read sees the first move; while a flower
 * waits for its first pull it taps the cloth. Chrome, not scene: a white hand
 * with a graphite line, and a signal ring where it taps. It never takes a
 * touch. `step`: 1 at the packet, 2 on its way, 3 pressing, 4 leaving. */
export function HintHand({ step, from, to }: { step: 0 | 1 | 2 | 3 | 4; from: { x: number; y: number }; to: { x: number; y: number } }) {
  if (step === 0) return null;
  const at = step === 1 ? from : to;
  return <span className="sg-hint" data-step={step} style={{ transform: `translate3d(${at.x}px, ${at.y}px, 0)` }} aria-hidden="true">
    <span className="sg-hint__ring" />
    <svg className="sg-hint__hand" viewBox="0 0 64 76" focusable="false">
      <path className="sg-hint__shade" d="M23 8c3.6-1 7 1.200 7.800 4.800l3.400 15.800 3.200-.6c2.800-.5 5.400 1 6.400 3.400 2.800-1.200 6 .2 7.200 3 3-.6 5.800 1.400 6.400 4.400l2.200 11.600c2 10.600-4.400 19.800-15 21.800l-5.800 1.100c-6.600 1.200-12.200-1-16.400-6.200L9.600 50.600c-2.600-3.400 1-8 5-6.200l6.600 3.200-5-31.800c-.6-3.600 3-6.600 6.800-7.800z" transform="translate(2 3)" />
      <path className="sg-hint__skin" d="M23 8c3.6-1 7 1.200 7.800 4.800l3.400 15.800 3.200-.6c2.800-.5 5.400 1 6.400 3.400 2.800-1.200 6 .2 7.200 3 3-.6 5.800 1.400 6.400 4.400l2.200 11.600c2 10.600-4.400 19.800-15 21.800l-5.800 1.100c-6.600 1.200-12.200-1-16.400-6.200L9.600 50.600c-2.600-3.400 1-8 5-6.200l6.600 3.200-5-31.800c-.6-3.600 3-6.600 6.800-7.800z" />
      <path className="sg-hint__line" d="M37.400 28l1.800 9.400M43.800 31.400l1.600 8.200M51 34.400l1.300 6.600" />
    </svg>
  </span>;
}

/** GobGob's WaitRing, the patient-progress band: the kit's own picture of it,
 * with a shade over each light that is not on yet. One more light for each
 * pull of the thread; in the set-piece its loop closes. */
export function WaitRing({ lights }: { lights: number }) {
  return <span className="sg-waitring" data-lights={lights} aria-hidden="true">
    <img src={WAITRING.src480 ?? WAITRING.src} alt="" draggable={false} />
    {WAITRING.lights.map((l, i) => <i key={i} data-lit={i < lights} style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%` }} />)}
  </span>;
}
/** GobGob beside his ring, for the set-piece. Shown once the shared library has his faces. */
export const GOBGOB_HERE = !!GOBGOB_WAITING && !!GOBGOB_GLAD;
export function GobGobRing({ lights }: { lights: number }) {
  const face = lights >= 4 ? GOBGOB_GLAD : GOBGOB_WAITING;
  return <div className="sg-ringcard" data-sg-ring={lights}>
    {face && <span className="sg-ringcard__face"><img src={face.src480 ?? face.src} alt="" draggable={false} /></span>}
    <WaitRing lights={lights} />
  </div>;
}
