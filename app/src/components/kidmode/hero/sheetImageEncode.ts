/**
 * sheetImageEncode — K2: the book sheet's picture encoder on the parent's
 * device, the game encoder's fallback rule: WebP (alpha, <= 300 KB) where the
 * canvas can encode it, else PNG (<= 900 KB) — Safari's canvas cannot encode
 * WebP (toBlob('image/webp') hands back a PNG), so an iPhone parent's device
 * uploads PNG. Shrinks in steps until the file fits. Browser only.
 */
import { BOOK_PNG_MAX_BYTES, BOOK_SPRITE_MAX_BYTES, type SheetImageExt } from "../../../lib/library/bookSheet";
import type { RgbaImage } from "./heroKeyer";

export interface EncodedImage {
  body: Blob;
  ext: SheetImageExt;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));

export function canvasFromRgba(img: RgbaImage): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const d = new ImageData(img.width, img.height);
  d.data.set(img.data);
  ctx.putImageData(d, 0, 0);
  return c;
}

/** Encode a canvas (scaled by `start`, then 0.85 a step): WebP first, else PNG. */
export async function encodeCanvas(src: HTMLCanvasElement, start = 1): Promise<EncodedImage | null> {
  let factor = start;
  let webp = true;
  for (let round = 0; round < 6; round++) {
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(src.width * factor));
    out.height = Math.max(1, Math.round(src.height * factor));
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, out.width, out.height);
    if (webp) {
      for (const q of [0.88, 0.8, 0.72, 0.64]) {
        const b = await toBlob(out, "image/webp", q);
        if (!b || b.type !== "image/webp") { webp = false; break; }
        if (b.size <= BOOK_SPRITE_MAX_BYTES) return { body: b, ext: "webp" };
      }
    }
    if (!webp) {
      const b = await toBlob(out, "image/png");
      if (b && b.type === "image/png" && b.size <= BOOK_PNG_MAX_BYTES) return { body: b, ext: "png" };
    }
    factor *= 0.85;
  }
  return null;
}

/** A keyed sprite (at most 1200 px tall to start). */
export async function encodeSpriteBrowser(img: RgbaImage): Promise<EncodedImage | null> {
  const src = canvasFromRgba(img);
  return src ? encodeCanvas(src, Math.min(1, 1200 / img.height)) : null;
}
