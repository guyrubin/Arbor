import type { CSSProperties } from 'react';
import './bopStage.css';

/** Toy-world art shared by the Bop games: one folder, one naming rule. Every
 * file is an authored, shipped image (no likeness, nothing made at runtime).
 * Names are always full hyphenated file stems, e.g. "aya-idle". */
const BASE = '/visuals/studio-v2/bop/';
export type BopSceneId = 'scene-delivery' | 'scene-sun' | 'scene-table' | 'scene-floor';
export type BopFriendId = 'aya' | 'chock' | 'pep';
export type BopMood = 'idle' | 'happy';

export function bopArt(name: string): string { return `${BASE}${name}.webp`; }

/** One cut-out toy or friend. Decorative: the control that holds it carries the name. */
export function BopSprite({ name, size, className = '', flat = false, style }: { name: string; size?: number | string; className?: string; flat?: boolean; style?: CSSProperties }) {
  return <img className={`bop-sprite${flat ? ' bop-sprite--flat' : ''}${className ? ` ${className}` : ''}`} data-bop-sprite={name} src={bopArt(name)} alt="" draggable={false} decoding="async" style={{ inlineSize: size, ...style }} />;
}

/** The room behind a game. Sits under everything else in a `.bop-stage`. */
export function BopScene({ scene }: { scene: BopSceneId }) {
  return <img className="bop-scene" data-bop-scene={scene} src={bopArt(`${scene}-480`)} srcSet={`${bopArt(`${scene}-480`)} 480w, ${bopArt(scene)} 1024w`} sizes="(min-width: 700px) 620px, 100vw" alt="" draggable={false} decoding="async" />;
}

/** An animal friend. Animals show feeling with ears, tail and posture only. */
export function BopFriend({ friend, mood = 'idle', size = 96, className = '' }: { friend: BopFriendId; mood?: BopMood; size?: number; className?: string }) {
  // Every pose of a friend is drawn on one square canvas, feet on the bottom
  // edge, so changing mood never changes the animal's size or where it stands.
  // The box is `size` wide and twice as tall; a wide pose may spill sideways.
  return <span className={`bop-friend${className ? ` ${className}` : ''}`} data-bop-friend={friend} data-mood={mood} aria-hidden="true" style={{ inlineSize: size, blockSize: size * 2 }}>
    <BopSprite name={`${friend}-${mood}`} size={size * 2} style={{ marginInline: -size / 2 }} />
  </span>;
}
