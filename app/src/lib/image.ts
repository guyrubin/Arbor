/**
 * Downscale an image File to a small JPEG data URL suitable for storing inline
 * on a Firestore document (kept well under the 1MB doc limit). Avoids needing a
 * separate object-storage bucket for lightweight log thumbnails.
 */
export async function fileToThumbnail(file: File, maxDim = 480, quality = 0.7): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/* ── M4: the hero data-URL budget ──────────────────────────────────────────── */

/**
 * A generated hero is stored INLINE in the child document (`photoUrl`), so its
 * size is a persistence constraint, not a cosmetic one: Firestore refuses a
 * document over 1 MiB and the write then fails — historically, silently.
 * 200 KB keeps a 512 px hero well inside that ceiling with room for the rest
 * of the profile (interests, strengths, challenges, notes).
 */
export const HERO_MAX_BYTES = 200_000;

/** Decoded byte length of a data URL's payload (base64 → bytes; raw → length). */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  const payload = dataUrl.slice(comma + 1);
  if (!/;base64/i.test(dataUrl.slice(0, comma))) return payload.length;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/** One re-encode attempt: longest edge `dim`, JPEG `quality`. Null = impossible. */
export type DataUrlEncoder = (dataUrl: string, dim: number, quality: number) => Promise<string | null>;

/** Ladder of attempts, widest/sharpest first. */
const HERO_STEPS: ReadonlyArray<{ dim: number; quality: number }> = [
  { dim: 512, quality: 0.86 },
  { dim: 512, quality: 0.72 },
  { dim: 384, quality: 0.7 },
  { dim: 320, quality: 0.65 },
  { dim: 256, quality: 0.6 },
];

/** DOM encoder — same Image + canvas path fileToThumbnail already uses. */
const domEncoder: DataUrlEncoder = async (dataUrl, dim, quality) => {
  try {
    if (typeof document === "undefined" || typeof Image === "undefined") return null;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const scale = Math.min(1, dim / Math.max(img.width || dim, img.height || dim));
    const w = Math.max(1, Math.round((img.width || dim) * scale));
    const h = Math.max(1, Math.round((img.height || dim) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
};

/**
 * Bring a generated image inside a byte budget before it is handed to a caller
 * that will persist it. Already-small input is returned untouched (no quality
 * lost for nothing). Otherwise the ladder is walked and the FIRST result inside
 * the budget wins; if none fits, the smallest result is returned — and if the
 * platform cannot re-encode at all (no canvas), the original comes back rather
 * than nothing, so the caller still has a hero and the write either succeeds or
 * fails loudly.
 */
export async function shrinkDataUrlToBudget(
  dataUrl: string,
  opts: { maxBytes?: number; steps?: ReadonlyArray<{ dim: number; quality: number }>; encode?: DataUrlEncoder } = {},
): Promise<string> {
  const maxBytes = opts.maxBytes ?? HERO_MAX_BYTES;
  if (!dataUrl || dataUrlByteLength(dataUrl) <= maxBytes) return dataUrl;
  const encode = opts.encode ?? domEncoder;
  let smallest: string | undefined;
  for (const step of opts.steps ?? HERO_STEPS) {
    const candidate = await encode(dataUrl, step.dim, step.quality);
    if (!candidate) continue;
    if (dataUrlByteLength(candidate) <= maxBytes) return candidate;
    if (!smallest || dataUrlByteLength(candidate) < dataUrlByteLength(smallest)) smallest = candidate;
  }
  return smallest ?? dataUrl;
}
