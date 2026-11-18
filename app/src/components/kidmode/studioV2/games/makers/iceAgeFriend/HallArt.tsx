import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import { FRIENDS, FRIEND_ORDER, HALL_PICTURE, TOOL_PICTURE, type FriendId } from './mammothArt';
import type { DiscoveryId } from './iceAgeFriendRules';

/** The great glass hall, its window openings cut clear: the dim room the child
 * stands in for chapter one, in front of the painted Ice Age. The engine
 * sizes and places the picture; the frost the child wipes sets how much
 * daylight the room has (`--iaf-light`), so the hall brightens as the glass
 * clears. A blue shade and a pool of window light are laid on the picture
 * only (masked by its own shape), never on the view through the glass. */
export function HallLayer() {
  const mask = { ['--iaf-hall-url' as string]: `url(${HALL_PICTURE.src})` } as CSSProperties;
  return <div className="iaf-hall" data-play-depth="2" aria-hidden="true" style={mask}>
    <img className="iaf-picture" src={HALL_PICTURE.src} srcSet={`${HALL_PICTURE.src480} 480w, ${HALL_PICTURE.src} ${HALL_PICTURE.width}w`} sizes="(min-width: 700px) 1400px, 300vw" alt="" draggable={false} decoding="async" />
    <span className="iaf-picture iaf-hall__dusk" />
    <span className="iaf-hall__pool" />
  </div>;
}

/** The crew on the floor of the hall, seen from behind, small under the
 * giant. Each is a real button: a friend says hello, and the mammoth notices. */
export function CrewLayer({ names, cheer, side, onFriend }: { names: Record<FriendId, string>; cheer: number; side: 'left' | 'right'; onFriend(id: FriendId): void }) {
  const [missing, setMissing] = useState<readonly FriendId[]>([]);
  const [waving, setWaving] = useState<{ id: FriendId; key: number } | null>(null);
  return <div className="iaf-floor" data-side={side} data-play-depth="1">
    <div className="iaf-crew" data-cheer={cheer ? (cheer % 2 ? 'a' : 'b') : undefined}>
      {FRIEND_ORDER.filter(id => !missing.includes(id)).map((id, index) => <button key={id} type="button" className="iaf-friend" data-friend={id} data-wide-only={FRIENDS[id].wideOnly || undefined} data-wave={waving?.id === id ? waving.key : undefined} aria-label={names[id]}
        style={{ ['--iaf-friend-tall' as string]: FRIENDS[id].tall, ['--iaf-friend-aspect' as string]: FRIENDS[id].aspect, ['--iaf-friend-order' as string]: index }}
        onClick={() => { setWaving(now => ({ id, key: (now?.key ?? 0) + 1 })); onFriend(id); }}>
        <img className="iaf-friend__figure" key={waving?.id === id ? waving.key : 0} src={FRIENDS[id].src} alt="" draggable={false} decoding="async" onError={() => setMissing(list => (list.includes(id) ? list : [...list, id]))} />
      </button>)}
    </div>
  </div>;
}

/** The crew at the end, dark against the snow, watching the sky. */
export function Watchers({ side }: { side: 'left' | 'right' }) {
  return <div className="iaf-watchers" data-side={side} aria-hidden="true">
    {FRIEND_ORDER.map((id, index) => <img key={id} className="iaf-watcher" src={FRIENDS[id].src} alt="" draggable={false} decoding="async"
      style={{ ['--iaf-friend-tall' as string]: FRIENDS[id].tall, ['--iaf-friend-order' as string]: index }} />)}
  </div>;
}

/** The hint hand: a soft white mitten with one finger out, shown doing the gesture on the real thing. Never takes a touch. */
export function HintHand({ handRef }: { handRef: Ref<HTMLSpanElement> }) {
  return <span ref={handRef} className="iaf-ghost" aria-hidden="true">
    <svg viewBox="-30 -8 60 78" focusable="false">
      <path className="iaf-ghost__shade" d="M-6 2C-6 -6 6 -6 6 2L6 24C9 20 17 20 17 28L17 32C21 30 26 33 26 39L25 52C24 64 15 70 3 70C-9 70 -17 64 -21 54L-27 38C-29 32 -22 28 -18 33L-12 40L-12 6Z" transform="translate(1.5 3)" />
      <path className="iaf-ghost__hand" d="M-6 2C-6 -6 6 -6 6 2L6 24C9 20 17 20 17 28L17 32C21 30 26 33 26 39L25 52C24 64 15 70 3 70C-9 70 -17 64 -21 54L-27 38C-29 32 -22 28 -18 33L-12 40L-12 6C-12 3 -9 1 -6 2Z" />
      <path className="iaf-ghost__line" d="M6 24L6 36M17 32L17 40" />
    </svg>
  </span>;
}

/** One of the child's pictures, copied from the engine's own (the actual view the lens recorded). */
export function Photo({ source, size, className }: { source: HTMLCanvasElement | null; size: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, g = canvas?.getContext('2d');
    if (!canvas || !g || !source) return;
    try { g.clearRect(0, 0, canvas.width, canvas.height); g.drawImage(source, 0, 0, canvas.width, canvas.height); } catch { /* not ready */ }
  }, [source]);
  return <canvas ref={ref} className={`iaf-photo${className ? ` ${className}` : ''}`} width={size} height={size} aria-hidden="true" />;
}

/** The print of a picture just taken: the picture itself, large and round,
 * with the tool that found it, its name and one true sentence. */
export function Print({ id, source, title, text, tool, rtl }: { id: DiscoveryId; source: HTMLCanvasElement | null; title: string; text: string; tool: string; rtl: boolean }) {
  return <div className="iaf-print" data-iaf-print={id} dir={rtl ? 'rtl' : 'ltr'} role="group" aria-labelledby="iaf-print-title">
    <div className="iaf-print__picture">
      <Photo source={source} size={320} />
      <span className="iaf-print__tool" aria-hidden="true"><img src={TOOL_PICTURE[id].src} alt="" draggable={false} decoding="async" /></span>
    </div>
    <div className="iaf-print__words">
      <p className="iaf-print__by">{tool}</p>
      <h3 id="iaf-print-title" className="iaf-print__title">{title}</h3>
      <p className="iaf-print__text">{text}</p>
    </div>
  </div>;
}
