/**
 * choiceCards — K2 4e: the decision page's choice cards SHOW THE CHILD. Each
 * card is a 4:3 crop of the composite of the choice's first page (its plate +
 * the child's own sprite at the page's slot), made on the parent's device from
 * the sprites the book sheet builder just keyed: no model call, no new prompt.
 * Uploaded with the sheet (hero-sheets/h-<hash>/choices/<choiceId>.webp); the
 * reader shows the child's card first (lib/library/heroSheet
 * choicePictureSources), else the plate's focus crop as before.
 * Parent side only (buildBookSheet); the plate URL comes from lib/library.
 */
import { getPlate } from "../../../lib/library/books";
import { plateSources } from "../../../lib/library/bookPlates";
import { BOOK_CHOICE_H, BOOK_CHOICE_W, BOOK_SPRITE_MAX_BYTES } from "../../../lib/library/bookSheet";
import type { SpriteAnchor } from "../../../lib/library/bookPageLayout";
import type { Book, Slot } from "../../../lib/library/types";
import type { BookSprite } from "./buildBookSheet";
import type { RgbaImage } from "./heroKeyer";

export interface Box { x: number; y: number; w: number; h: number }

export interface ChoiceCardPlan {
  choiceId: string;
  plateId: string;
  /** The plate's master size (px). */
  plate: { w: number; h: number };
  /** The sprite's box on the plate (px) and whether it is mirrored. */
  hero: Box & { flip: boolean };
  /** The 4:3 crop of the plate the card shows (px). */
  crop: Box;
}

/** The hero's box on the plate, as the reader places it (bookPageLayout heroRect). */
export function heroBoxOnPlate(slot: Slot, a: SpriteAnchor, plate: { w: number; h: number }): Box & { flip: boolean } {
  const h = slot.scale * plate.h;
  const w = h * a.aspect;
  return { x: slot.x * plate.w - a.footX * w, y: slot.y * plate.h - h, w, h, flip: slot.facing === "left" };
}

/** A 4:3 crop around the hero: 1.6x the hero's height, the feet near the
 *  bottom (88 %), centred on the hero, inside the plate. */
export function cropAround(hero: Box, plate: { w: number; h: number }): Box {
  let h = Math.min(plate.h, hero.h * 1.6, (plate.w * 3) / 4);
  let w = (h * 4) / 3;
  if (w > plate.w) { w = plate.w; h = (w * 3) / 4; }
  const feet = hero.y + hero.h;
  const x = Math.min(plate.w - w, Math.max(0, hero.x + hero.w / 2 - w / 2));
  const y = Math.min(plate.h - h, Math.max(0, feet - 0.88 * h));
  return { x, y, w, h };
}

/** The card of every choice whose first page shows a pose the child has. */
export function choiceCardPlans(book: Book, anchors: ReadonlyMap<string, SpriteAnchor>): ChoiceCardPlan[] {
  const out: ChoiceCardPlan[] = [];
  for (const c of book.decision.choices) {
    const page = c.branch[0];
    const slot = page?.hero;
    const a = slot ? anchors.get(slot.pose) : undefined;
    const plate = page ? getPlate(book.id, page.plateId) : undefined;
    if (!slot || !a || !plate) continue;
    const size = { w: plate.width, h: plate.height };
    const hero = heroBoxOnPlate(slot, a, size);
    out.push({ choiceId: c.id, plateId: plate.id, plate: size, hero, crop: cropAround(hero, size) });
  }
  return out;
}

/* ── Browser rendering ────────────────────────────────────────────────────── */

function canvasOfRgba(img: RgbaImage): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const d = new ImageData(img.width, img.height);
  d.data.set(img.data);
  c.getContext("2d")?.putImageData(d, 0, 0);
  return c;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const el = new Image();
  el.decoding = "async";
  el.src = src;
  await el.decode();
  return el;
}

/** Render the cards (800 x 600 WebP) for the builder; a card that cannot be
 *  made is left out (the reader falls back to the plate's focus crop). */
export async function renderChoiceCards(book: Book, sprites: ReadonlyMap<string, BookSprite>): Promise<Record<string, Blob>> {
  const anchors = new Map([...sprites].map(([pose, s]) => [pose, s.anchor] as const));
  const out: Record<string, Blob> = {};
  for (const plan of choiceCardPlans(book, anchors)) {
    const plate = getPlate(book.id, plan.plateId);
    const pose = book.decision.choices.find((c) => c.id === plan.choiceId)?.branch[0]?.hero?.pose;
    const s = pose ? sprites.get(pose) : undefined;
    if (!plate || !s) continue;
    try {
      const img = await loadImage(plateSources(plate, { dev: false })[0]);
      const k = BOOK_CHOICE_W / plan.crop.w;
      const c = document.createElement("canvas");
      c.width = BOOK_CHOICE_W;
      c.height = BOOK_CHOICE_H;
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingQuality = "high";
      // the plate file may be smaller than the master: map the crop to its pixels
      const sx = img.naturalWidth / plan.plate.w, sy = img.naturalHeight / plan.plate.h;
      ctx.drawImage(img, plan.crop.x * sx, plan.crop.y * sy, plan.crop.w * sx, plan.crop.h * sy, 0, 0, BOOK_CHOICE_W, BOOK_CHOICE_H);
      const hx = (plan.hero.x - plan.crop.x) * k, hy = (plan.hero.y - plan.crop.y) * k, hw = plan.hero.w * k, hh = plan.hero.h * k;
      const sprite = canvasOfRgba(s.sprite);
      if (plan.hero.flip) {
        ctx.save();
        ctx.translate(hx + hw, hy);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0, hw, hh);
        ctx.restore();
      } else ctx.drawImage(sprite, hx, hy, hw, hh);
      for (const q of [0.86, 0.78, 0.7]) {
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", q));
        if (blob && blob.type === "image/webp" && blob.size <= BOOK_SPRITE_MAX_BYTES) { out[plan.choiceId] = blob; break; }
      }
    } catch {
      /* this card falls back to the plate's focus crop */
    }
  }
  return out;
}
