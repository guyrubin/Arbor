/**
 * Hero Card — renders the child's hero avatar into a shareable, downloadable
 * card (PNG) entirely on-device via canvas (no libraries, no upload). Part of
 * the cross-domain hero promise: the child's hero becomes a keepsake the family
 * can save and share. The source image is the already-stylized avatar (never a
 * raw face); generated images carry SynthID/C2PA, and we add a visible
 * "Made with Arbor" watermark.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the hero image"));
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

export async function renderHeroCard(opts: { imageUrl: string; name: string; age?: number }): Promise<string> {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // Background: soft brand wash.
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#eef6f0");
  g.addColorStop(1, "#d6ebde");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

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

  // Hero in a bold rounded frame.
  const size = 700, x = (W - size) / 2, y = 170;
  ctx.fillStyle = "#29333f";
  roundRect(ctx, x - 16, y - 16, size + 32, size + 32, 60);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, size, size, 48);
  ctx.clip();
  try {
    const img = await loadImage(opts.imageUrl);
    drawCover(ctx, img, x, y, size, size);
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

  // Name + tagline.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#29333f";
  ctx.font = "700 104px Georgia, 'Times New Roman', serif";
  ctx.fillText((opts.name || "Hero").toUpperCase(), W / 2, y + size + 160);

  ctx.fillStyle = "#1f8a5a";
  ctx.font = "800 46px system-ui, sans-serif";
  ctx.fillText(opts.age ? `ARBOR HERO · AGE ${opts.age}` : "ARBOR HERO", W / 2, y + size + 226);

  // Footer watermark.
  ctx.fillStyle = "#5f6b75";
  ctx.font = "600 36px system-ui, sans-serif";
  ctx.fillText("Made with Arbor", W / 2, H - 70);

  return canvas.toDataURL("image/png");
}

/** Render + trigger a download of the hero card. */
export async function downloadHeroCard(opts: { imageUrl: string; name: string; age?: number }): Promise<void> {
  const dataUrl = await renderHeroCard(opts);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${(opts.name || "hero").toLowerCase()}-arbor-hero-card.png`;
  a.click();
}
