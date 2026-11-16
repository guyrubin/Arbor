/** Bottle Lab's kit pictures: the one place a path, its pixel size and the kit
 * file it comes from are written down. Glass Grove's bottle bench is staged
 * entirely on shipped Horizon Valley art (no picture is made at run time, and
 * none is new): the arched pavilion room, the kit lamp, Aya and her watering
 * can, and sticker prints of the kit's own props and of the companions' faces
 * (the companions come from the shared `kit-*` library).
 * Strings and numbers only. */
import { studioBopArt, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
import type { BottleSticker, BottleTint } from './bottleLabRules';

export interface KitPicture { src: string; src480: string; width: number; height: number; source: string }
const bop = (stem: string, width: number, height: number, twin = false): KitPicture =>
  ({ src: studioBopArt(stem), src480: studioBopArt(twin ? `${stem}-480` : stem), width, height, source: `studio-v2/bop/${stem}.webp` });

export const KIT_LAMP = bop('item-lamp', 245, 300);
export const KIT_CAN = bop('item-can', 278, 205);
/** Characters come from the Studio's one shared kit library (never a private copy). */
const lib = (stem: string, width: number, height: number, source: string): KitPicture =>
  ({ src: `${STUDIO_MAKERS_ROOT}${stem}.webp`, src480: `${STUDIO_MAKERS_ROOT}${stem}-480.webp`, width, height, source: `studio-v2/makers/${stem}.webp (kit ${source})` });
/** Aya standing (front), walking (side, facing right as stored) and sitting, looking up to the right. */
export const KIT_AYA = { front: lib('kit-aya-front', 408, 768, 'v30/05-aya.png'), side: lib('kit-aya-side', 373, 768, 'v30/05-aya.png'), sitting: lib('kit-aya-sitting', 452, 768, 'v30/17-bop-key-art.png') } as const;

/** The Game Cut's picture: Glass Grove's pavilion and the glassworks bench, as
 * two layers in one plate space (see `PLATE` in glassworks.ts: 2048 wide, the
 * horizon on row 490, focal 1000). The room layer is the shipped arched room carried
 * on both ways as its own mirror image; the bench layer is the kit's round table top
 * (pale wood, linen, teal inlay) laid into the room's own perspective, with
 * transparency above its far edge. Built by the art script named in the
 * round's log; no picture is made at run time. */
const own = (stem: string, width: number, height: number, source: string): KitPicture =>
  ({ src: `${STUDIO_MAKERS_ROOT}${stem}.webp`, src480: `${STUDIO_MAKERS_ROOT}${stem}-480.webp`, width, height, source });
export const KIT_PLATE = {
  room: own('bottle-lab-room', 2048, 1024, 'studio-v2/bop/scene-delivery.webp (extended by its mirror image)'),
  bench: own('bottle-lab-benchtop', 1536, 585, 'studio-v2/bop/scene-table.webp (laid into the room perspective)'),
} as const;
/** The four colour discs: the kit's blue filter disc, recoloured to each glass tint. The round part's centre sits 42% across. */
export const KIT_DISCS: Readonly<Record<BottleTint, KitPicture>> = {
  clear: own('bottle-lab-disc-clear', 295, 141, 'studio-v2/bop/item-disc.webp (recoloured)'),
  sea: own('bottle-lab-disc-sea', 295, 141, 'studio-v2/bop/item-disc.webp (recoloured)'),
  amber: own('bottle-lab-disc-amber', 295, 141, 'studio-v2/bop/item-disc.webp (recoloured)'),
  rose: own('bottle-lab-disc-rose', 295, 141, 'studio-v2/bop/item-disc.webp (recoloured)'),
};
export const DISC_CENTRE = 0.42;
/** Where the two plates sit in the 360 by 440 still life of a kept bottle (the
 * cover and the preview): the plate point the bottle stands on in play
 * (1024, 865) is the still life's own foot (180, 380), at 0.455 units a pixel. */
const STILL = 0.455;
export const STILL_PLACE = {
  room: { x: 180 - 1024 * STILL, y: 380 - 865 * STILL, width: 2048 * STILL, height: 1024 * STILL },
  bench: { x: 180 - 1024 * STILL, y: 380 - 865 * STILL + 640 * STILL, width: 2048 * STILL, height: 780 * STILL },
} as const;

/** A sticker is a round white vinyl disc printed with a square crop of a kit
 * picture (pixels of that picture). The saved `art` ids do not change. */
export interface StickerPrint { picture: KitPicture; crop: readonly [x: number, y: number, size: number]; fit: number }
export const STICKER_PRINT: Readonly<Record<BottleSticker, StickerPrint>> = {
  star: { picture: lib('kit-pep-playful', 481, 512, 'v30/15-companion-reactions.png'), crop: [-10, 0, 500], fit: 1 },
  leaf: { picture: KIT_CAN, crop: [54, 102, 68], fit: 0.86 },
  wave: { picture: lib('kit-chock-attentive', 506, 512, 'v30/15-companion-reactions.png'), crop: [3, 0, 500], fit: 1 },
  sun: { picture: bop('sun-lit', 520, 520), crop: [58, 44, 404], fit: 0.9 },
  moon: { picture: lib('kit-aya-delighted', 512, 449, 'v30/15-companion-reactions.png'), crop: [16, -16, 480], fit: 1 },
  heart: { picture: bop('flower-open', 293, 440), crop: [9, 6, 276], fit: 0.9 },
};

/** Every kit file this activity shows, for the art manifest. */
export const BOTTLE_KIT_SOURCES: readonly string[] = [...new Set([KIT_PLATE.room, KIT_PLATE.bench, ...Object.values(KIT_DISCS), KIT_LAMP, KIT_CAN, KIT_AYA.front, KIT_AYA.side, KIT_AYA.sitting, ...Object.values(STICKER_PRINT).map(p => p.picture)].map(p => p.source))];
