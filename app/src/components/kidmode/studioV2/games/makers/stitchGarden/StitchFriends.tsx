import { memo, type CSSProperties } from 'react';
import { CLOTH_R, HOOP_CX, HOOP_CY } from './stitchGardenStitches';
import type { VisitorKind } from './stitchGardenCritters';
import { AYA_GLAD, AYA_WATCHING, BUD, GOBGOB_CURIOUS, GOBGOB_GLAD, GOBGOB_WAITING, LEAFLAB, PINCUSHION, WATERING_CAN, type KitPicture } from './stitchGardenKit';
import { CritterArt, KitProp } from './StitchArt';

/** Who and what is on Aya's table around the hoop. All of it is kit art (Aya,
 * her watering can, the bud that would not hurry, the knit pincushion) placed
 * in the hoop drawing's own units; the visitors are worked in thread. Each
 * piece is a toy: the game lays a real button over it. */

const boxOf = (picture: KitPicture, x: number, y: number, w: number) => ({ x, y, w, h: w * picture.height / picture.width });
/** Where each thing stands (the picture's box, in drawing units). */
export const PLACES = {
  aya: boxOf(AYA_WATCHING, -20, 334, 118),
  wateringCan: boxOf(WATERING_CAN, -3, 3, 80),
  bud: boxOf(BUD[0], 387, -8, 51),
  pincushion: boxOf(PINCUSHION, 366, 380, 62),
  leafLab: LEAFLAB ? boxOf(LEAFLAB, 56, 414, 36) : null,
  screw: { x: HOOP_CX + 15, y: -4, w: 36, h: 36 },
} as const;
/** Aya's own outline inside her square picture: the part a finger aims for. */
export const AYA_BODY = { x: PLACES.aya.x + PLACES.aya.w * 0.3, y: PLACES.aya.y + 4, w: PLACES.aya.w * 0.4, h: PLACES.aya.h - 4 };
/** The middle line of the hoop's wood, where the ladybird walks. */
export const RING_R = CLOTH_R + 12;
/** Under the clasp at the top of the hoop: where the ladybird lives. */
export const BUG_HOME = -90, BUG_PEEK = -60;

const shade = (pct: number) => `color-mix(in srgb, var(--mk-shadow) ${pct}%, transparent)`;

/** Aya watches the work; when a flower is whole she is glad, and hops. */
export const Aya = memo(function Aya({ glad, hop }: { glad: boolean; hop: number }) {
  const b = PLACES.aya;
  return <g className="sg-aya" data-glad={glad} data-hop={hop ? hop % 2 : undefined} style={{ transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h}px` }} pointerEvents="none">
    <ellipse cx={b.x + b.w / 2 + 3} cy={b.y + b.h - 3} rx={b.w * 0.2} ry="4.5" style={{ fill: shade(26) }} />
    <g className="sg-aya__breath" style={{ transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h}px` }}>
      <image className="sg-aya__pose" data-on={!glad} href={AYA_WATCHING.src} x={b.x} y={b.y} width={b.w} height={b.h} />
      <image className="sg-aya__pose" data-on={glad} href={AYA_GLAD.src} x={b.x} y={b.y} width={b.w} height={b.h} />
    </g>
  </g>;
});

const DROPS: readonly { dx: number; dy: number; delay: number }[] = [
  { dx: 30, dy: 44, delay: 120 }, { dx: 44, dy: 58, delay: 200 }, { dx: 24, dy: 60, delay: 280 }, { dx: 52, dy: 46, delay: 340 }, { dx: 38, dy: 70, delay: 420 }, { dx: 58, dy: 64, delay: 500 },
];
/** The watering can tips and a few drops fall towards the cloth. `pour` counts the pours. */
export const WateringCan = memo(function WateringCan({ pour }: { pour: number }) {
  const b = PLACES.wateringCan, rose = { x: b.x + b.w * 0.93, y: b.y + b.h * 0.2 };
  return <g pointerEvents="none">
    <g className="sg-can" data-pour={pour ? pour % 2 : undefined} style={{ transformOrigin: `${b.x + b.w * 0.45}px ${b.y + b.h}px` }}><KitProp picture={WATERING_CAN} x={b.x} y={b.y} width={b.w} /></g>
    {pour > 0 && <g key={pour} className="sg-drops">
      {DROPS.map((d, i) => <ellipse key={i} cx={rose.x} cy={rose.y} rx="1.9" ry="2.6" style={{ fill: 'color-mix(in srgb, var(--mk-sky) 80%, var(--mk-white))', '--sg-dx': `${d.dx}px`, '--sg-dy': `${d.dy}px`, animationDelay: `${d.delay}ms` } as CSSProperties} />)}
    </g>}
  </g>;
});

/** The bud in its pot: three kit pictures on one canvas. It opens when it is ready, not before. */
export const Bud = memo(function Bud({ stage, nudge }: { stage: 0 | 1 | 2; nudge: number }) {
  const b = PLACES.bud;
  return <g className="sg-bud" data-stage={stage} data-nudge={nudge ? nudge % 2 : undefined} style={{ transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h}px` }} pointerEvents="none">
    <ellipse cx={b.x + b.w / 2 + 3} cy={b.y + b.h - 2} rx={b.w * 0.42} ry="4" style={{ fill: shade(24) }} />
    {BUD.map((picture, i) => <image key={i} className="sg-bud__day" data-on={i === stage} href={picture.src} x={b.x} y={b.y} width={b.w} height={b.h} />)}
  </g>;
});

/** The knit round the needle rests in. */
export const Pincushion = memo(function Pincushion() {
  const b = PLACES.pincushion;
  return <KitProp className="sg-pin" picture={PINCUSHION} x={b.x} y={b.y} width={b.w} />;
});

/** Aya's LeafLab, when the shared library has it. */
export const LeafLab = memo(function LeafLab({ ping }: { ping: number }) {
  const b = PLACES.leafLab;
  if (!b || !LEAFLAB) return null;
  return <g className="sg-lab" data-ping={ping ? ping % 2 : undefined} style={{ transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h}px` }}><KitProp picture={LEAFLAB} x={b.x} y={b.y} width={b.w} /></g>;
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

/** The showing hand: it comes from the chosen pattern card, taps one cross and
 * goes, so a child who cannot read sees the first move. Chrome, not scene: a
 * white hand with a graphite line, and a signal ring where it taps. It never
 * takes a touch. `step`: 1 at the card, 2 on its way, 3 pressing, 4 leaving. */
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

/** GobGob waits with the bud. His WaitRing fills while the needle works, one
 * light at a time, the first amber and the rest cyan as on the band itself;
 * when the flower is whole he is glad. Shown once the shared library has his
 * two faces. */
export const GOBGOB_HERE = !!GOBGOB_WAITING && !!GOBGOB_GLAD;
export function GobGobWaiting({ mood, lights, nudge }: { mood: 'waiting' | 'glad' | 'curious'; lights: number; nudge: number }) {
  if (!GOBGOB_WAITING || !GOBGOB_GLAD) return null;
  const faces: [string, KitPicture | null][] = [['waiting', GOBGOB_WAITING], ['glad', GOBGOB_GLAD], ['curious', GOBGOB_CURIOUS ?? GOBGOB_WAITING]];
  const shown = mood === 'curious' && !GOBGOB_CURIOUS ? 'waiting' : mood;
  return <span className="sg-gob" data-mood={shown} data-nudge={nudge ? nudge % 2 : undefined} aria-hidden="true">
    <span className="sg-gob__face">{faces.map(([name, picture]) => picture && <img key={name} data-on={name === shown} src={picture.src480 ?? picture.src} alt="" draggable={false} />)}</span>
    <span className="sg-waitring" data-lights={lights}>{[0, 1, 2, 3].map(i => <i key={i} data-lit={i < lights} />)}</span>
  </span>;
}
