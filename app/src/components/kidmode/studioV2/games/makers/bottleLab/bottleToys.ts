/** What the still picture of a kept bottle (the cover and the preview) still
 * needs from the old toys: where Aya stands in it, and where a sticker's
 * shadow falls inside the bottle's own. Pure numbers. The play itself lives
 * in glassworks.ts. */
import { BASE_Y, PROFILES, radiusAt, type ShapeId } from './bottleGeometry';
import { slotView, type BottleStickerPlacement } from './bottleLabRules';

/** Aya in the still life: how far from the bottle she stands, where her feet are, how tall she is (scene units). */
export const AYA = { reach: 134, feet: 386, far: 368, height: 90 } as const;

/** Where a sticker's shadow falls inside the bottle's own shadow: `u` across
 * (-1 to 1) and `t` up the bottle (0 the base, 1 the top), as the lamp sees it. */
export function stickerShade(shape: ShapeId, placement: BottleStickerPlacement, rotation: number, lamp: number) {
  const v = slotView(placement.slot, rotation - lamp * 0.6), y = PROFILES[shape].rows[v.row], top = PROFILES[shape].knots[0][0];
  return { u: v.x, wide: Math.max(0.25, v.scaleX), t: (BASE_Y - y) / (BASE_Y - top), radius: radiusAt(shape, y) };
}
