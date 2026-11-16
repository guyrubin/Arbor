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

/** The room behind the bottle, and where it sits in the 360 by 440 still
 * life. One picture edited from two shipped kit pictures: the arched pavilion
 * room (`scene-delivery`, carried on both ways as its own mirror image and
 * softened a little, as a room behind a close object is) with the kit's round
 * pale-wood table and linen top (`scene-table`, laid down in the room's
 * perspective) in front. The bottle, the lamp and Aya stand on that table. */
export const KIT_ROOM = {
  src: '/visuals/studio-v2/makers/bottle-lab-bench.webp', src480: '/visuals/studio-v2/makers/bottle-lab-bench-480.webp', width: 1536, height: 1024,
  source: 'app/public/visuals/studio-v2/bop/scene-delivery.webp + app/public/visuals/studio-v2/bop/scene-table.webp',
  place: { x: -270, y: -92, width: 900, height: 600 },
} as const;
/** The far edge of the table top, in scene units: beyond it is the room. */
export const BENCH_Y = 334;

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
