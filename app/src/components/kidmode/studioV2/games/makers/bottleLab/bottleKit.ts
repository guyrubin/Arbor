/** Bottle Lab's kit pictures: the one place a path, its pixel size and the kit
 * file it comes from are written down. Glass Grove's bottle bench is staged
 * entirely on shipped Horizon Valley art (no picture is made at run time, and
 * none is new): the arched pavilion room, the kit lamp, Aya and her watering
 * can, and sticker prints cropped from the kit's own props and companions.
 * Strings and numbers only. */
import { studioBopArt } from '../../../../../../lib/kidThemeManifest';
import type { BottleSticker } from './bottleLabRules';

export interface KitPicture { src: string; src480: string; width: number; height: number; source: string }
const bop = (stem: string, width: number, height: number, twin = false): KitPicture =>
  ({ src: studioBopArt(stem), src480: studioBopArt(twin ? `${stem}-480` : stem), width, height, source: `app/public/visuals/studio-v2/bop/${stem}.webp` });

/** The room behind the bottle and where it sits in the 360 by 440 still life:
 * the line where its wall meets its floor lies on the scene's TABLE_Y. */
export const KIT_ROOM = { ...bop('scene-delivery', 1024, 1024, true), place: { x: -90, y: -46, width: 540, height: 540 } } as const;
/** How far the room reaches past the still life on each side, in scene units. */
export const ROOM_SPILL = -KIT_ROOM.place.x;

export const KIT_LAMP = bop('item-lamp', 245, 300);
export const KIT_CAN = bop('item-can', 278, 205);
export const KIT_AYA = { idle: bop('aya-idle', 440, 440), happy: bop('aya-happy', 440, 440) } as const;

/** A sticker is a round white vinyl disc printed with a square crop of a kit
 * picture (pixels of that picture). The saved `art` ids do not change. */
export interface StickerPrint { picture: KitPicture; crop: readonly [x: number, y: number, size: number]; fit: number }
export const STICKER_PRINT: Readonly<Record<BottleSticker, StickerPrint>> = {
  star: { picture: bop('pep-idle', 440, 440), crop: [150, 4, 172], fit: 0.84 },
  leaf: { picture: KIT_CAN, crop: [54, 102, 68], fit: 0.8 },
  wave: { picture: bop('chock-idle', 440, 440), crop: [98, 6, 150], fit: 0.84 },
  sun: { picture: bop('sun-lit', 520, 520), crop: [58, 44, 404], fit: 0.82 },
  moon: { picture: KIT_AYA.idle, crop: [117, 6, 208], fit: 0.84 },
  heart: { picture: bop('flower-open', 293, 440), crop: [9, 6, 276], fit: 0.82 },
};

/** Every kit file this activity shows, for the art manifest. */
export const BOTTLE_KIT_SOURCES: readonly string[] = [...new Set([KIT_ROOM, KIT_LAMP, KIT_CAN, KIT_AYA.idle, KIT_AYA.happy, ...Object.values(STICKER_PRINT).map(p => p.picture)].map(p => p.source))];
