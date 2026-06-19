/**
 * Share Card — the single on-device canvas renderer behind every branded share
 * artifact (avatar / story / answer_card / growth_card). Renders entirely on the
 * client (no upload, no libraries), mirroring the privacy stance of
 * lib/analytics.ts and the original heroCard.ts. Every card carries a visible
 * "Made with Arbor" wordmark + canonical short URL; the tappable referral/UTM
 * deep link lives in the share CAPTION (lib/share.ts), never as readable pixels.
 *
 * This is the branded IMAGE sibling of the clinical/text exporter in
 * lib/reportExport.ts — the two paths are intentionally separate (see the
 * shared-file conflict notes in the mk-p0-3 spec). lib/heroCard.ts is now a thin
 * compat shim that delegates here.
 */
import type { LoopArtifact } from "./loopEvents";

const W = 1080;
const H = 1350;

export type ShareCardOpts = {
  /** Stylized hero/avatar image (data URL or https). Optional for text-led cards. */
  imageUrl?: string;
  /** Child first name shown on the card. */
  name?: string;
  age?: number;
  /** answer_card: the parent's question + a short non-diagnostic takeaway. */
  question?: string;
  takeaway?: string;
  /** story: a short story title. */
  title?: string;
  /** growth_card: milestone headline + sub (real data supplied by mk-p2-6). */
  headline?: string;
  sub?: string;
};

export type RenderedCard = { dataUrl: string; blob: Blob };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image"));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw an image cover-fitted (object-fit: cover) into a box. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height;
  const br = w / h;
  let dw = w, dh = h, dx = x, dy = y;
  if (ir > br) { dw = h * ir; dx = x - (dw - w) / 2; } else { dh = w / ir; dy = y - (dh - h) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Heuristic: does the text contain RTL (Hebrew/Arabic) code points? */
function hasRtl(s: string): boolean {
  return /[֐-׿؀-ۿ]/.test(s);
}

/** Word-wrap text to a max width, returning the laid-out lines (capped). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) lines[maxLines - 1] = `${last.slice(0, -1)}…`;
  }
  return lines;
}

function newCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  return { canvas, ctx };
}

function brandWash(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#eef6f0");
  g.addColorStop(1, "#d6ebde");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Bottom brand band: "Made with Arbor" wordmark + canonical short URL. The
 * wordmark is intentionally latin in all locales (it's the brand mark, not UI
 * copy). The referral/UTM link is NOT drawn here — it ships in the caption.
 */
function brandBand(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#29333f";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText("Made with Arbor", W / 2, H - 86);
  ctx.fillStyle = "#5f6b75";
  ctx.font = "600 32px system-ui, sans-serif";
  ctx.fillText("arbor.app", W / 2, H - 44);
}

async function finalize(canvas: HTMLCanvasElement): Promise<RenderedCard> {
  const dataUrl = canvas.toDataURL("image/png");
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image"))), "image/png");
  });
  return { dataUrl, blob };
}

/** avatar — the hero portrait card (the original Hero Card design). */
async function renderAvatarCard(opts: ShareCardOpts): Promise<RenderedCard> {
  const { canvas, ctx } = newCanvas();
  brandWash(ctx);

  // Subtle comic sunburst behind the hero.
  ctx.save();
  ctx.translate(W / 2, 520);
  for (let i = 0; i < 24; i++) {
    ctx.rotate((Math.PI * 2) / 24);
    ctx.fillStyle = i % 2 === 0 ? "rgba(52,178,119,0.07)" : "rgba(63,140,201,0.05)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(760, -90);
    ctx.lineTo(760, 90);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const size = 700, x = (W - size) / 2, y = 170;
  ctx.fillStyle = "#29333f";
  roundRect(ctx, x - 16, y - 16, size + 32, size + 32, 60);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, size, size, 48);
  ctx.clip();
  try {
    if (opts.imageUrl) {
      const img = await loadImage(opts.imageUrl);
      drawCover(ctx, img, x, y, size, size);
    } else {
      ctx.fillStyle = "#e4f4ec";
      ctx.fillRect(x, y, size, size);
    }
  } catch {
    ctx.fillStyle = "#e4f4ec";
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  // Star badge.
  ctx.fillStyle = "#34b277";
  ctx.beginPath();
  ctx.arc(x + size - 36, y + size - 36, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 70px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★", x + size - 36, y + size - 28);

  const name = opts.name || "Hero";
  ctx.direction = hasRtl(name) ? "rtl" : "ltr";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#29333f";
  ctx.font = "700 104px Georgia, 'Times New Roman', serif";
  ctx.fillText(name.toUpperCase(), W / 2, y + size + 160);
  ctx.direction = "ltr";

  ctx.fillStyle = "#1f8a5a";
  ctx.font = "800 46px system-ui, sans-serif";
  ctx.fillText(opts.age ? `ARBOR HERO · AGE ${opts.age}` : "ARBOR HERO", W / 2, y + size + 226);

  brandBand(ctx);
  return finalize(canvas);
}

/** Small hero chip drawn at the bottom-area of text-led cards. */
async function drawHeroChip(ctx: CanvasRenderingContext2D, imageUrl: string | undefined, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#29333f";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.clip();
  try {
    if (imageUrl) {
      const img = await loadImage(imageUrl);
      drawCover(ctx, img, cx - (r - 8), cy - (r - 8), (r - 8) * 2, (r - 8) * 2);
    } else {
      ctx.fillStyle = "#e4f4ec";
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  } catch {
    ctx.fillStyle = "#e4f4ec";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** Shared quote/headline body for the text-led cards (answer / story / growth). */
async function renderQuoteCard(opts: {
  eyebrow: string;
  primary: string;
  secondary?: string;
  imageUrl?: string;
  name?: string;
}): Promise<RenderedCard> {
  const { canvas, ctx } = newCanvas();
  brandWash(ctx);

  // Card panel.
  const pad = 90, pw = W - pad * 2, py = 150, ph = 880;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, pad, py, pw, ph, 56);
  ctx.fill();

  const innerX = pad + 70;
  const innerW = pw - 140;

  // Eyebrow.
  ctx.textAlign = "left";
  ctx.direction = hasRtl(opts.eyebrow) ? "rtl" : "ltr";
  ctx.fillStyle = "#1f8a5a";
  ctx.font = "800 38px system-ui, sans-serif";
  ctx.fillText(opts.eyebrow.toUpperCase(), ctx.direction === "rtl" ? innerX + innerW : innerX, py + 110);

  // Primary (large quote/headline), word-wrapped.
  ctx.fillStyle = "#29333f";
  ctx.font = "700 64px Georgia, 'Times New Roman', serif";
  ctx.direction = hasRtl(opts.primary) ? "rtl" : "ltr";
  const primaryLines = wrapLines(ctx, opts.primary, innerW, 6);
  let ty = py + 220;
  for (const line of primaryLines) {
    ctx.fillText(line, ctx.direction === "rtl" ? innerX + innerW : innerX, ty);
    ty += 86;
  }

  // Secondary (the takeaway / sub).
  if (opts.secondary) {
    ty += 24;
    ctx.fillStyle = "#3a4651";
    ctx.font = "500 44px system-ui, sans-serif";
    ctx.direction = hasRtl(opts.secondary) ? "rtl" : "ltr";
    const secLines = wrapLines(ctx, opts.secondary, innerW, 5);
    for (const line of secLines) {
      ctx.fillText(line, ctx.direction === "rtl" ? innerX + innerW : innerX, ty);
      ty += 64;
    }
  }
  ctx.direction = "ltr";

  // Hero chip + name, bottom-left of the panel.
  const chipR = 78, chipCx = innerX + chipR, chipCy = py + ph - 110;
  await drawHeroChip(ctx, opts.imageUrl, chipCx, chipCy, chipR);
  if (opts.name) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#29333f";
    ctx.font = "700 46px system-ui, sans-serif";
    ctx.direction = hasRtl(opts.name) ? "rtl" : "ltr";
    ctx.fillText(opts.name, chipCx + chipR + 30, chipCy + 16);
    ctx.direction = "ltr";
  }

  brandBand(ctx);
  return finalize(canvas);
}

function renderAnswerCard(opts: ShareCardOpts): Promise<RenderedCard> {
  return renderQuoteCard({
    eyebrow: "Ask Arbor",
    primary: opts.question || "A parent's question",
    secondary: opts.takeaway,
    imageUrl: opts.imageUrl,
    name: opts.name,
  });
}

function renderStoryCard(opts: ShareCardOpts): Promise<RenderedCard> {
  return renderQuoteCard({
    eyebrow: "An Arbor story",
    primary: opts.title || (opts.name ? `${opts.name}'s story` : "A story"),
    secondary: opts.takeaway,
    imageUrl: opts.imageUrl,
    name: opts.name,
  });
}

/** growth_card — placeholder template; real data wired by mk-p2-6. */
function renderGrowthCard(opts: ShareCardOpts): Promise<RenderedCard> {
  return renderQuoteCard({
    eyebrow: "Progress",
    primary: opts.headline || (opts.name ? `${opts.name}'s progress` : "Progress this month"),
    secondary: opts.sub,
    imageUrl: opts.imageUrl,
    name: opts.name,
  });
}

/** The single entry point: render any artifact to a PNG data URL + blob. */
export function renderShareCard(artifact: LoopArtifact, opts: ShareCardOpts): Promise<RenderedCard> {
  switch (artifact) {
    case "story":
      return renderStoryCard(opts);
    case "answer_card":
      return renderAnswerCard(opts);
    case "growth_card":
      return renderGrowthCard(opts);
    case "avatar":
    default:
      return renderAvatarCard(opts);
  }
}

/** Compat: the original hero-card data-URL API (delegates to the avatar template). */
export async function renderHeroCard(opts: { imageUrl: string; name: string; age?: number }): Promise<string> {
  const { dataUrl } = await renderAvatarCard(opts);
  return dataUrl;
}
