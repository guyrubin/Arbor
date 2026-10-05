/**
 * The statue picture — B-GAME-09 (ruling G12: the ONE ending object).
 *
 * Composed ON THE DEVICE with a canvas: the courtyard plate, the cover
 * objects, the cat turned round and squinting (`looking`), and the child's
 * hero in the freeze pose held longest this sitting, standing where it froze.
 * No model call, no network: every image is already on the page (data urls
 * or the sandbox's own art). The pure part (what goes where) is
 * `statueShot` + `pictureLayout`; `composeStatuePicture` draws it.
 */
import { DESIGN, PLATE_BLEED, pointOnPath, sneakLayout, type FieldPoint } from "../../game/fieldLayout";
import { referenceSprite, resolvePose, type HeroSheet } from "../../hero/heroSheet";
import { longestStatue, type FreezePose, type SneakState } from "./rules";
import { watcherSprite, type ArtSprite, type SneakArt } from "./sneakArt";

/** The picture: 4:3, sized for a phone share and a desktop frame. */
export const PICTURE = { w: 1200, h: 900 } as const;

export interface StatueShot {
  pose: FreezePose;
  /** Where along the run the hero froze (0 = back gate, 1 = the stool). */
  at: number;
}

/** The statue to picture: the freeze held longest (null when none was held). */
export function statueShot(s: Pick<SneakState, "statues">): StatueShot | null {
  const st = longestStatue(s);
  return st ? { pose: st.pose, at: Math.min(0.92, Math.max(0.08, st.at)) } : null;
}

interface Placed { x: number; y: number; h: number }

export interface PictureLayout {
  /** Crop of the design space (landscape), design units. */
  crop: { x: number; y: number; w: number; h: number };
  /** Picture px per design unit. */
  scale: number;
  hero: Placed;
  watcher: Placed;
  covers: { id: string; x: number; y: number; h: number }[];
}

/** Where everything stands in the picture (landscape courtyard, design units). */
export function pictureLayout(shot: StatueShot, watcherAspect = 0.75): PictureLayout {
  const lay = sneakLayout("landscape");
  const p = pointOnPath(lay.heroPath, shot.at);
  const hero = { x: p.x, y: p.y, h: p.h };
  const watcher = { x: lay.watcher.feet.x, y: lay.watcher.feet.y, h: lay.watcher.h };
  const box = (c: Placed, halfW: number) => ({ x0: c.x - halfW, x1: c.x + halfW, y0: c.y - c.h, y1: c.y + c.h * 0.06 });
  const a = box(hero, hero.h * 0.4);
  const b = box(watcher, (watcher.h * watcherAspect) / 2);
  let x0 = Math.min(a.x0, b.x0);
  let x1 = Math.max(a.x1, b.x1);
  let y0 = Math.min(a.y0, b.y0);
  let y1 = Math.max(a.y1, b.y1);
  const padX = (x1 - x0) * 0.1;
  const padY = (y1 - y0) * 0.1;
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  // Grow to 4:3 around the centre.
  const ratio = PICTURE.w / PICTURE.h;
  let w = x1 - x0;
  let h = y1 - y0;
  if (w / h < ratio) w = h * ratio; else h = w / ratio;
  const d = DESIGN.landscape;
  // Never larger than the plate, never outside it.
  const maxW = d.w * (1 + 2 * PLATE_BLEED);
  const maxH = d.h * (1 + 2 * PLATE_BLEED);
  if (w > maxW) { w = maxW; h = w / ratio; }
  if (h > maxH) { h = maxH; w = h * ratio; }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const minX = -d.w * PLATE_BLEED;
  const minY = -d.h * PLATE_BLEED;
  const x = Math.min(Math.max(cx - w / 2, minX), minX + maxW - w);
  const y = Math.min(Math.max(cy - h / 2, minY), minY + maxH - h);
  const covers = lay.covers.map((c) => ({ id: c.id, x: c.feet.x, y: c.feet.y, h: c.h }));
  return { crop: { x, y, w, h }, scale: PICTURE.w / w, hero, watcher, covers };
}

/** Design point -> picture px (mirrored for right-to-left, like the scene). */
export function toPicture(l: PictureLayout, p: FieldPoint, rtl: boolean): FieldPoint {
  const x = (p.x - l.crop.x) * l.scale;
  return { x: rtl ? PICTURE.w - x : x, y: (p.y - l.crop.y) * l.scale };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

function tokenColour(name: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "currentColor";
  } catch {
    return "currentColor";
  }
}

/**
 * Draw the statue picture; resolves to a JPEG data url, or null when the
 * canvas cannot be read back (a cross-origin sprite) — the caller then shows
 * the picture without keeping it.
 */
export async function composeStatuePicture(o: { shot: StatueShot; art: SneakArt; sheet: HeroSheet; rtl: boolean }): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const looking = watcherSprite(o.art, "looking", false).sprite;
  const l = pictureLayout(o.shot, looking.w / looking.h);
  const canvas = document.createElement("canvas");
  canvas.width = PICTURE.w;
  canvas.height = PICTURE.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const heroPose = resolvePose(o.sheet, o.shot.pose);
  const ref = referenceSprite(o.sheet);
  if (!heroPose || !ref) return null;
  const [plate, cat, hero, ...covers] = await Promise.all([
    loadImage(o.art.plate.landscape),
    loadImage(looking.url),
    loadImage(heroPose.sprite.url),
    ...l.covers.map((c) => loadImage(o.art.covers[c.id as keyof SneakArt["covers"]].url)),
  ]);
  ctx.save();
  if (o.rtl) { ctx.translate(PICTURE.w, 0); ctx.scale(-1, 1); }
  // Plate: its image spans the design space plus the bleed.
  const d = DESIGN.landscape;
  const pw = d.w * (1 + 2 * PLATE_BLEED);
  const ph = d.h * (1 + 2 * PLATE_BLEED);
  const kx = plate.naturalWidth / pw;
  const ky = plate.naturalHeight / ph;
  ctx.drawImage(plate, (l.crop.x + d.w * PLATE_BLEED) * kx, (l.crop.y + d.h * PLATE_BLEED) * ky, l.crop.w * kx, l.crop.h * ky, 0, 0, PICTURE.w, PICTURE.h);
  const place = (img: HTMLImageElement, sprite: Pick<ArtSprite, "w" | "h" | "anchor">, at: FieldPoint, height: number) => {
    const k = (height / sprite.h) * l.scale;
    const x = (at.x - l.crop.x) * l.scale;
    const y = (at.y - l.crop.y) * l.scale;
    ctx.drawImage(img, x - sprite.anchor.x * k, y - sprite.anchor.y * k, sprite.w * k, sprite.h * k);
  };
  const shadow = (at: FieldPoint, width: number) => {
    const x = (at.x - l.crop.x) * l.scale;
    const y = (at.y - l.crop.y) * l.scale;
    const r = width * l.scale * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = tokenColour("--arbor-ink");
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  // Back to front by feet height.
  const items: { y: number; draw: () => void }[] = [];
  l.covers.forEach((c, i) => {
    const s = o.art.covers[c.id as keyof SneakArt["covers"]];
    items.push({ y: c.y, draw: () => place(covers[i], s, c, c.h) });
  });
  const heroSprite = heroPose.sprite;
  const heroScaleH = (heroSprite.h / ref.h) * l.hero.h;
  items.push({ y: l.hero.y + 1, draw: () => { shadow(l.hero, l.hero.h * 0.5); place(hero, { w: heroSprite.w, h: heroSprite.h, anchor: heroSprite.foot }, l.hero, heroScaleH); } });
  items.push({ y: l.watcher.y, draw: () => { shadow(l.watcher, l.watcher.h * 0.6); place(cat, looking, l.watcher, l.watcher.h); } });
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
  ctx.restore();
  try {
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}
