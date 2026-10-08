/**
 * The statue picture — B-GAME-09 (ruling G12: the ONE ending object).
 * B-GAME-09c: a composed close shot, a picture worth keeping.
 *
 * Composed ON THE DEVICE with a canvas: a crop of the courtyard plate around
 * the place the hero stands (the walkway, the gate and the bougainvillea
 * behind him), the child's hero LARGE in the freeze pose he held longest
 * (his figure 60-68 % of the picture's height, the face readable at phone
 * size), and the cat in the lower foreground corner seen FROM BEHIND, peering
 * at him (`looking`), each with a contact shadow (key light upper left). No
 * cover object is drawn, so nothing is cut by the frame's edge. Every sitting
 * gets a framing variant (which side he stands on, how tight) and a
 * time-of-day tint; two sittings in a row never share a variant
 * (`pickVariant`).
 * No model call, no network: every image is already on the page (data urls,
 * or same-origin files such as the sandbox's /_proof/ art — checked before
 * drawing, so the canvas is never tainted). The pure part (what goes where) is
 * `statueShot` + `pictureLayout`; `composeStatuePicture` draws it.
 */
import { DESIGN, PLATE_BLEED, sneakLayout, type FieldPoint } from "../../game/fieldLayout";
import { referenceSprite, resolvePose, type HeroSheet } from "../../hero/heroSheet";
import { hashSeed, longestStatue, type FreezePose, type SneakState } from "./rules";
import { watcherSprite, type ArtSprite, type SneakArt } from "./sneakArt";
import { sameOriginOrData } from "../../proofAssets";

/** The picture: 4:3, sized for a phone share and a desktop frame. */
export const PICTURE = { w: 1200, h: 900 } as const;

/** B-GAME-09d: the picture's shape. The kept / shared picture is always the
 *  4:3 one; a phone held upright is SHOWN a 3:4 close shot of the same moment
 *  (the same crop height, its sides trimmed), so it can fill the screen. */
export type PictureShape = "landscape" | "portrait";
export const PICTURE_SIZE: Readonly<Record<PictureShape, { w: number; h: number }>> = {
  landscape: PICTURE,
  portrait: { w: 900, h: 1200 },
};

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

export type PictureTint = "golden" | "rose" | "clear";

export interface PictureVariant {
  /** Which side of the picture the hero stands on (the cat takes the other corner). */
  side: "left" | "right";
  /** A tighter framing: the hero a little larger. */
  tight: boolean;
  /** Time of day: late gold, rosy dusk, clear afternoon. */
  tint: PictureTint;
}

/** Neighbours always differ in side AND tint, so a picked-next variant is
 *  visibly a different picture. */
export const PICTURE_VARIANTS: readonly PictureVariant[] = [
  { side: "right", tight: false, tint: "golden" },
  { side: "left", tight: true, tint: "rose" },
  { side: "right", tight: true, tint: "clear" },
  { side: "left", tight: false, tint: "golden" },
  { side: "right", tight: false, tint: "rose" },
  { side: "left", tight: true, tint: "clear" },
];

/** This sitting's variant: by its seed, never the previous picture's. */
export function pickVariant(seed: string, previous?: number | null): number {
  const n = PICTURE_VARIANTS.length;
  let i = hashSeed(seed) % n;
  if (typeof previous === "number" && i === ((previous % n) + n) % n) i = (i + 1) % n;
  return i;
}

/** Where the hero's feet stand on the walkway (landscape design units). */
const WALK = { yNear: 680, yFar: 560, centreX: 800, offsetX: 90 } as const;
/** Hero figure / picture height. */
const HERO_FRACTION = { loose: 0.6, tight: 0.68 } as const;
/** The feet sit this far down the picture. */
const FEET_AT = 0.92;

interface Placed { x: number; y: number; h: number }

export interface PictureLayout {
  variant: PictureVariant;
  /** Crop of the landscape plate's design space (design units, may use the bleed). */
  crop: { x: number; y: number; w: number; h: number };
  /** Picture px per design unit. */
  scale: number;
  /** Picture px: the hero's feet and figure height. */
  hero: Placed;
  /** Picture px: the cat's stool feet and height; `flip` mirrors it to peer the other way. */
  watcher: Placed & { flip: boolean };
}

/** Where everything stands in the picture (picture px; the crop in design units). */
export function pictureLayout(shot: StatueShot, variantIndex = 0, shape: PictureShape = "landscape"): PictureLayout {
  const P = PICTURE_SIZE[shape];
  const upright = shape === "portrait";
  const variant = PICTURE_VARIANTS[((variantIndex % PICTURE_VARIANTS.length) + PICTURE_VARIANTS.length) % PICTURE_VARIANTS.length];
  // The hero's own depth scale (fieldLayout's landscape run is linear in y).
  const path = sneakLayout("landscape").heroPath;
  const a = path[0];
  const b = path[path.length - 1];
  const heroH = (y: number) => a.h + ((b.h - a.h) * (y - a.y)) / (b.y - a.y);
  // Further down the run he froze -> a little nearer the camera.
  const depth = Math.min(1, Math.max(0, (shot.at - 0.08) / 0.84));
  const feetY = WALK.yFar + (WALK.yNear - WALK.yFar) * depth;
  const feetX = WALK.centreX + (variant.side === "right" ? WALK.offsetX : -WALK.offsetX);
  const frac = variant.tight ? HERO_FRACTION.tight : HERO_FRACTION.loose;
  const h = heroH(feetY) / frac;
  const w = h * (P.w / P.h);
  // Upright, the hero stands a touch further from the cat's corner.
  const across = upright ? 0.64 : 0.62;
  const heroAcross = variant.side === "right" ? across : 1 - across;
  const d = DESIGN.landscape;
  const minX = -d.w * PLATE_BLEED;
  const minY = -d.h * PLATE_BLEED;
  const maxX = d.w * (1 + PLATE_BLEED);
  const maxY = d.h * (1 + PLATE_BLEED);
  const x = Math.min(Math.max(feetX - heroAcross * w, minX), maxX - w);
  const y = Math.min(Math.max(feetY - FEET_AT * h, minY), maxY - h);
  const scale = P.h / h;
  const hero = { x: (feetX - x) * scale, y: (feetY - y) * scale, h: heroH(feetY) * scale };
  // The cat: lower foreground corner opposite the hero, seen from behind,
  // peering at him (the sprite peers right; mirrored when he stands left).
  // Upright the cat is a little smaller and further in, so it stays whole in the narrower frame.
  const catH = P.h * (upright ? 0.4 : 0.44);
  const catAt = upright ? 0.22 : 0.2;
  const watcher = variant.side === "right"
    ? { x: P.w * catAt, y: P.h * 0.975, h: catH, flip: false }
    : { x: P.w * (1 - catAt), y: P.h * 0.975, h: catH, flip: true };
  return { variant, crop: { x, y, w, h }, scale, hero, watcher };
}

/** Picture px -> picture px as drawn (mirrored for right-to-left, like the scene). */
export function toPicture(p: FieldPoint, rtl: boolean, shape: PictureShape = "landscape"): FieldPoint {
  return { x: rtl ? PICTURE_SIZE[shape].w - p.x : p.x, y: p.y };
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

/** A token colour at alpha 0 (a gradient's clear end keeps its hue). */
function clearOf(colour: string): string {
  // #rrggbb -> #rrggbb00 (the same hue, fully clear); anything else -> transparent.
  return /^#[0-9a-f]{6}$/i.test(colour) ? `${colour}00` : "transparent";
}

/** The tint's wash colours (tokens): light from the upper left, shade below. */
const TINT: Readonly<Record<PictureTint, { light: string; lightA: number; shade: string; shadeA: number }>> = {
  golden: { light: "--arbor-yellow", lightA: 0.34, shade: "--arbor-peach", shadeA: 0.1 },
  rose: { light: "--arbor-pink", lightA: 0.2, shade: "--arbor-clay", shadeA: 0.1 },
  clear: { light: "--arbor-paper-elevated", lightA: 0.22, shade: "--arbor-clay", shadeA: 0.05 },
};

/**
 * Draw the statue picture; resolves to a JPEG data url, or null when the
 * canvas cannot be read back (a cross-origin sprite) — the caller then shows
 * the picture without keeping it.
 */
export async function composeStatuePicture(o: { shot: StatueShot; art: SneakArt; sheet: HeroSheet; rtl: boolean; variant?: number; shape?: PictureShape }): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const looking = watcherSprite(o.art, "looking", false).sprite;
  const size = PICTURE_SIZE[o.shape ?? "landscape"];
  const l = pictureLayout(o.shot, o.variant ?? 0, o.shape ?? "landscape");
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const heroPose = resolvePose(o.sheet, o.shot.pose);
  const ref = referenceSprite(o.sheet);
  if (!heroPose || !ref) return null;
  // B-GAME-09b: every image drawn is a data url or a same-origin file (the
  // placeholders, the sandbox's /_proof/ art) — so the canvas is never
  // tainted. A sprite from anywhere else could taint it: skip the picture
  // (nothing saved) rather than throw.
  const urls = [o.art.plate.landscape, looking.url, heroPose.sprite.url];
  if (!urls.every(sameOriginOrData)) return null;
  const [plate, cat, hero] = await Promise.all([loadImage(o.art.plate.landscape), loadImage(looking.url), loadImage(heroPose.sprite.url)]);
  const W = size.w;
  const H = size.h;
  const tint = TINT[l.variant.tint];
  ctx.save();
  if (o.rtl) { ctx.translate(W, 0); ctx.scale(-1, 1); }

  // 1. The plate, cropped: its image spans the design space plus the bleed.
  //    A breath of softness keeps the zoomed plate behind the sharp hero.
  const d = DESIGN.landscape;
  const pw = d.w * (1 + 2 * PLATE_BLEED);
  const ph = d.h * (1 + 2 * PLATE_BLEED);
  const kx = plate.naturalWidth / pw;
  const ky = plate.naturalHeight / ph;
  ctx.save();
  try { ctx.filter = "blur(1.2px)"; } catch { /* a canvas without filters draws it sharp */ }
  ctx.drawImage(plate, (l.crop.x + d.w * PLATE_BLEED) * kx, (l.crop.y + d.h * PLATE_BLEED) * ky, l.crop.w * kx, l.crop.h * ky, -2, -2, W + 4, H + 4);
  ctx.restore();

  // 2. Time of day: a light wash from the upper left, a shade from below.
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  const lg = ctx.createRadialGradient(W * 0.15, -H * 0.1, 0, W * 0.15, -H * 0.1, W * 1.1);
  lg.addColorStop(0, tokenColour(tint.light));
  lg.addColorStop(1, clearOf(tokenColour(tint.light)));
  ctx.globalAlpha = tint.lightA * 2;
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "multiply";
  const sg = ctx.createLinearGradient(0, H * 0.55, 0, H);
  sg.addColorStop(0, clearOf(tokenColour(tint.shade)));
  sg.addColorStop(1, tokenColour(tint.shade));
  ctx.globalAlpha = tint.shadeA;
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const shadow = (x: number, y: number, rx: number, alpha: number) => {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, tokenColour("--arbor-ink"));
    g.addColorStop(1, "transparent");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.translate(x, y);
    ctx.scale(1, 0.2);
    ctx.translate(-x, -y);
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const place = (img: HTMLImageElement, sprite: Pick<ArtSprite, "w" | "h" | "anchor">, at: FieldPoint, height: number, flip = false) => {
    const k = height / sprite.h;
    ctx.save();
    ctx.translate(at.x, at.y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -sprite.anchor.x * k, -sprite.anchor.y * k, sprite.w * k, sprite.h * k);
    ctx.restore();
  };

  // 3. The hero, large, on the walkway: contact shadow (down-right), then the pose.
  const heroSprite = heroPose.sprite;
  const heroDrawH = (heroSprite.h / ref.h) * l.hero.h * (heroSprite.scale ?? 1);
  shadow(l.hero.x + l.hero.h * 0.06, l.hero.y, l.hero.h * 0.26, 0.42);
  place(hero, { w: heroSprite.w, h: heroSprite.h, anchor: heroSprite.foot }, l.hero, heroDrawH);

  // 4. The cat in the foreground corner, from behind, peering at him.
  shadow(l.watcher.x + l.watcher.h * 0.05, l.watcher.y, l.watcher.h * 0.3, 0.45);
  place(cat, looking, l.watcher, l.watcher.h, l.watcher.flip);

  // 5. A soft vignette ties the picture together.
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.45, W * 0.5, H * 0.5, W * 0.78);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, tokenColour("--arbor-ink"));
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.restore();
  try {
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  }
}
