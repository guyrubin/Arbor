import { useState, type Ref } from 'react';
import { Camera, Check } from 'lucide-react';
import { CUSHION_PICTURE, FRIENDS, FRIEND_ORDER, HALL_PICTURE, STEPPE_PICTURE, type FriendId, type KitPicture } from './mammothArt';

/** One kit picture laid over the stage. The engine sizes and places it (the
 * hall always covers the stage) and moves its layer with the camera. */
function Picture({ picture, className }: { picture: KitPicture; className: string }) {
  return <img className={`iaf-picture ${className}`} src={picture.src} srcSet={`${picture.src480} 480w, ${picture.src} ${picture.width}w`} sizes="(min-width: 700px) 1100px, 220vw" alt="" draggable={false} decoding="async" />;
}
/** The Ice Age beyond the glass: the layer under the mammoth while it is out on the steppe. */
export function SteppeLayer({ layerRef }: { layerRef: Ref<HTMLDivElement> }) {
  return <div ref={layerRef} className="iaf-layer iaf-layer--steppe" aria-hidden="true"><Picture picture={STEPPE_PICTURE} className="iaf-picture--steppe" /></div>;
}
/** The great glass hall, its window openings cut clear: the layer over the steppe (and over the mammoth, until it steps in). */
export function HallLayer({ layerRef }: { layerRef: Ref<HTMLDivElement> }) {
  return <div ref={layerRef} className="iaf-layer iaf-layer--hall" aria-hidden="true"><Picture picture={HALL_PICTURE} className="iaf-picture--hall" /></div>;
}

/** The crew on the floor of the hall, seen from behind, looking up at the
 * giant; and the cushion of steppe grass. Each is a real button: a friend
 * says hello (the mammoth notices), the cushion offers a bunch of grass. */
export function FloorLayer({ layerRef, basketRef, names, grassLabel, cheer, side, onFriend, onGrass }: {
  layerRef: Ref<HTMLDivElement>; basketRef: Ref<HTMLButtonElement>; names: Record<FriendId, string>; grassLabel: string;
  cheer: { key: number; big: boolean }; side: 'left' | 'right'; onFriend(id: FriendId): void; onGrass(): void;
}) {
  const [missing, setMissing] = useState<readonly FriendId[]>([]);
  const [waving, setWaving] = useState<{ id: FriendId; key: number } | null>(null);
  return <div ref={layerRef} className="iaf-layer iaf-layer--floor" data-side={side}>
    <div className="iaf-crew" data-cheer={cheer.key ? (cheer.big ? 'big' : 'small') : undefined} data-beat={cheer.key % 2}>
      {FRIEND_ORDER.filter(id => !missing.includes(id)).map((id, index) => <button key={id} type="button" className="iaf-friend" data-friend={id} data-wide-only={FRIENDS[id].wideOnly || undefined} data-wave={waving?.id === id ? waving.key : undefined} aria-label={names[id]}
        style={{ ['--iaf-friend-tall' as string]: FRIENDS[id].tall, ['--iaf-friend-aspect' as string]: FRIENDS[id].aspect, ['--iaf-friend-order' as string]: index }}
        onClick={() => { setWaving(now => ({ id, key: (now?.key ?? 0) + 1 })); onFriend(id); }}>
        <img className="iaf-friend__figure" key={waving?.id === id ? waving.key : 0} src={FRIENDS[id].src} alt="" draggable={false} decoding="async" onError={() => setMissing(list => (list.includes(id) ? list : [...list, id]))} />
      </button>)}
    </div>
    <button ref={basketRef} type="button" className="iaf-basket" aria-label={grassLabel} onClick={onGrass}>
      <img className="iaf-basket__cushion" src={CUSHION_PICTURE.src} alt="" draggable={false} decoding="async" />
    </button>
  </div>;
}

/** The hint hand: a soft white mitten with one finger out, shown doing the first gesture on the real thing. Never takes a touch. */
export function HintHand({ handRef }: { handRef: Ref<HTMLSpanElement> }) {
  return <span ref={handRef} className="iaf-ghost" aria-hidden="true">
    <svg viewBox="-30 -8 60 78" focusable="false">
      <path className="iaf-ghost__shade" d="M-6 2C-6 -6 6 -6 6 2L6 24C9 20 17 20 17 28L17 32C21 30 26 33 26 39L25 52C24 64 15 70 3 70C-9 70 -17 64 -21 54L-27 38C-29 32 -22 28 -18 33L-12 40L-12 6Z" transform="translate(1.5 3)" />
      <path className="iaf-ghost__hand" d="M-6 2C-6 -6 6 -6 6 2L6 24C9 20 17 20 17 28L17 32C21 30 26 33 26 39L25 52C24 64 15 70 3 70C-9 70 -17 64 -21 54L-27 38C-29 32 -22 28 -18 33L-12 40L-12 6C-12 3 -9 1 -6 2Z" />
      <path className="iaf-ghost__line" d="M6 24L6 36M17 32L17 40" />
    </svg>
  </span>;
}

/** One of the five ProofLens photos: an empty frame until its secret is found, then the photo the lens took of it. */
export function PhotoBadge({ canvasRef, lit, large = false }: { canvasRef?: Ref<HTMLCanvasElement>; lit: boolean; large?: boolean }) {
  return <span className="iaf-photo" data-lit={lit} data-large={large || undefined}>
    <canvas ref={canvasRef} className="iaf-photo__shot" width={112} height={112} aria-hidden="true" />
    <span className="iaf-photo__lens" aria-hidden="true"><Camera size={large ? 20 : 15} /></span>
    <span className="iaf-photo__tick" aria-hidden="true"><Check size={large ? 13 : 11} strokeWidth={3.4} /></span>
  </span>;
}
