import type { CSSProperties } from 'react';
import type { Feeling } from './forestStories';
import type { NoteId } from './adventureRules';

// Namespace the dock asset id: it is raster art, not the same-named icon glyph.
type CanalPiece = 'boat' | 'rock' | 'parcel' | 'canal-dock' | 'water' | 'lilies';
const CANAL: Record<CanalPiece, number> = { boat: 0, rock: 1, parcel: 2, 'canal-dock': 3, water: 4, lilies: 5 };
const FEELINGS: Record<Feeling, number> = { sad: 0, worried: 1, angry: 2, excited: 3, proud: 4, lonely: 5 };
function spriteStyle(at: number): CSSProperties {
  return { backgroundPosition: `${(at % 3) * 50}% ${Math.floor(at / 3) * 100}%` };
}
/** Original neutral raster art. Semantics live on the native control, not on
 * duplicated image labels. One atlas per world keeps the request count small. */
export function CanalSprite({ piece, className = '' }: { piece: CanalPiece; className?: string }) {
  return <span className={`adventure-sprite adventure-sprite--canal ${className}`} data-piece={piece} style={spriteStyle(CANAL[piece])} aria-hidden="true" />;
}
export function InstrumentSprite({ note, lit = false }: { note: NoteId; lit?: boolean }) {
  return <span className="adventure-sprite adventure-sprite--instrument" style={spriteStyle(note + (lit ? 3 : 0))} aria-hidden="true" />;
}
export function FeelingSprite({ feeling }: { feeling: Feeling }) {
  return <span className="adventure-sprite adventure-sprite--feeling" style={spriteStyle(FEELINGS[feeling])} aria-hidden="true" />;
}
