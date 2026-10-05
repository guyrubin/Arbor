/**
 * lib/library/bookPageLayout — B-BOOK-03: ONE pure function returns every rect
 * of a book page for a box (lane B §6.1). No DOM: the React renderer
 * (components/library/BookPage + BookReader) positions its layers from it, and
 * a canvas twin for export can reuse it unchanged later.
 *
 * Two modes:
 * - spread (box >= 900 px wide and landscape; target 1920x1080): an open book.
 *   The art page holds the WHOLE plate at its own aspect (never stretched,
 *   never cropped) inside a thin paper margin; the paper text page sits beside
 *   it. In Hebrew the text page goes on the left and the art page on the right
 *   (the art itself is NOT mirrored in v1). The book type size is the largest
 *   that fits the page's words (estimated), floored at the --kid-t-book token.
 * - stacked (narrow / portrait; target 375x812): a 3:4 window of the plate on
 *   top, the words on a paper sheet below. The window's centre is the page's
 *   phoneCrop, moved only as far as needed to hold the hero (and an after-tap
 *   hero) with a margin; the art shrinks (staying 3:4) so the words and the
 *   next control fit without scrolling.
 *
 * The words never cover the art: the text page touches the art page edge-on
 * and never overlaps it (tested).
 */
import type { BookLang, Page, Slot } from "./types";

export interface Box {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the text page has to hold. */
export interface LayoutContent {
  /** Characters per paragraph, the name filled in. */
  paras: readonly number[];
  /** Choice cards in a row under the words (the decision page). */
  choices?: number;
  /** The one big action button (a repair page before its tap). */
  action?: boolean;
  /** Characters of a title set above the words (the cover). */
  title?: number;
}

export interface LayoutOpts {
  /** The plate's pixel size (default: the 1536x1024 master). */
  plate?: { width: number; height: number };
  /** The slot to place (default: page.hero). */
  slot?: Slot | null;
  /** Another slot the phone window must also hold (the after-tap hero). */
  alsoContain?: Slot | null;
  content?: LayoutContent;
  /** Sprite box width / height. The sprite is drawn contain + bottom-centre in
   *  it, so a square box holds any pose at full height (conservative). */
  heroBoxAspect?: number;
}

export interface HeroRect extends Rect {
  flip: boolean;
  /** The whole sprite box lies inside the visible art window. */
  inWindow: boolean;
}

export interface BookPageLayout {
  mode: "spread" | "stacked";
  dir: "ltr" | "rtl";
  /** The open book (spread) or the column (stacked). */
  book: Rect;
  /** The paper page that holds the art (spread) — equals `art` when stacked. */
  artPage: Rect;
  /** The visible art window. */
  art: Rect;
  /** The full plate image (extends past `art` when stacked; clipped by it). */
  plate: Rect;
  /** The visible window in plate fractions. */
  crop: { x0: number; x1: number };
  /** The paper page / sheet that holds the words and the controls. */
  textPage: Rect;
  /** The content box inside the text page's padding. */
  text: Rect;
  pad: { inline: number; block: number };
  /** Book type size and line height. */
  typePx: number;
  lineHeight: number;
  titlePx: number;
  /** Height reserved at the bottom of the text box for the page controls. */
  navPx: number;
  /** Height of the choice-card row (0 when none). */
  cardsPx: number;
  hero: HeroRect | null;
  shadow: { cx: number; cy: number; rx: number; ry: number; opacity: number } | null;
  /** The physical side of the text page that touches the spine (spread). */
  spine: "left" | "right";
  /** False when the words could not be fitted at the floor size (they then
   *  scroll inside the page — a text defect for the author, never clipped). */
  fits: boolean;
}

export const SPREAD_MIN_WIDTH = 900;
const MASTER = { width: 1536, height: 1024 };
const PHONE_WINDOW = 3 / 4; // width / height of the stacked art window
const CROP_MARGIN = 0.02; // fraction of the plate width kept around the hero

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The --kid-t-book token at this viewport width: clamp(20px, 16px + 0.8vw, 26px). */
export function kidBookTokenPx(viewportWidth: number): number {
  return clamp(16 + 0.008 * viewportWidth, 20, 26);
}

/** Average advance of a book-voice character, in em, with line-break waste. */
const CHAR_EM = 0.54;

/** Estimated height of paragraphs set in `width` px at `type` px. */
export function estimateTextHeight(paras: readonly number[], width: number, type: number, lineHeight: number): number {
  if (width <= 0) return Infinity;
  const perLine = Math.max(1, Math.floor(width / (type * CHAR_EM)));
  const lines = paras.reduce((n, chars) => n + Math.max(1, Math.ceil(chars / perLine)), 0);
  const gaps = Math.max(0, paras.length - 1) * type * 0.6;
  return lines * type * lineHeight + gaps;
}

function titleHeight(chars: number, width: number, titlePx: number): number {
  if (!chars) return 0;
  const perLine = Math.max(1, Math.floor(width / (titlePx * 0.56)));
  return Math.ceil(chars / perLine) * titlePx * 1.12 + titlePx * 0.5;
}

function heroRect(slot: Slot | null | undefined, plate: Rect, art: Rect, aspect: number): HeroRect | null {
  if (!slot) return null;
  const h = slot.scale * plate.h;
  const w = h * aspect;
  const x = plate.x + slot.x * plate.w - w / 2;
  const y = plate.y + slot.y * plate.h - h;
  const eps = 0.5;
  const inWindow = x >= art.x - eps && x + w <= art.x + art.w + eps && y >= art.y - eps && y + h <= art.y + art.h + eps;
  return { x, y, w, h, flip: slot.facing === "left", inWindow };
}

function shadowFor(slot: Slot | null | undefined, plate: Rect, hero: HeroRect | null): BookPageLayout["shadow"] {
  if (!slot || !hero) return null;
  return {
    cx: plate.x + slot.x * plate.w,
    cy: plate.y + slot.y * plate.h,
    rx: hero.h * (slot.pose === "sit" ? 0.26 : 0.2),
    ry: Math.max(3, hero.h * 0.035),
    opacity: 0.34,
  };
}

/** Half-width of a slot's sprite box, in plate-width fractions. */
function slotHalfWidth(slot: Slot, plateAspect: number, boxAspect: number): number {
  return (slot.scale * boxAspect) / plateAspect / 2;
}

/** The phone window [x0, x1] (plate fractions): centred on phoneCrop, moved
 *  only as far as needed so every slot's sprite box + margin is inside. */
export function phoneWindow(page: Page, slots: readonly (Slot | null | undefined)[], plateAspect: number, boxAspect: number): { x0: number; x1: number } {
  const wf = Math.min(1, PHONE_WINDOW / plateAspect);
  let cx = clamp(page.phoneCrop, wf / 2, 1 - wf / 2);
  for (const s of slots) {
    if (!s) continue;
    const half = slotHalfWidth(s, plateAspect, boxAspect);
    const lo = s.x - half - CROP_MARGIN;
    const hi = s.x + half + CROP_MARGIN;
    if (lo < cx - wf / 2) cx = lo + wf / 2;
    if (hi > cx + wf / 2) cx = hi - wf / 2;
  }
  cx = clamp(cx, wf / 2, 1 - wf / 2);
  return { x0: cx - wf / 2, x1: cx + wf / 2 };
}

export function computeBookPageLayout(page: Page, box: Box, lang: BookLang, opts: LayoutOpts = {}): BookPageLayout {
  const plateSize = opts.plate ?? MASTER;
  const aspect = plateSize.width / plateSize.height;
  const slot = opts.slot === undefined ? page.hero : opts.slot;
  const boxAspect = opts.heroBoxAspect ?? 1;
  const content: LayoutContent = opts.content ?? { paras: [page.text.en.length] };
  const lineHeight = lang === "he" ? 1.6 : 1.5;
  const dir = lang === "he" ? "rtl" : "ltr";
  const tokenPx = kidBookTokenPx(box.width);
  const W = Math.max(1, box.width);
  const H = Math.max(1, box.height);

  if (W >= SPREAD_MIN_WIDTH && W >= H) {
    // ── spread ───────────────────────────────────────────────────────────────
    const m = Math.round(clamp(Math.min(W, H) * 0.04, 16, 48));
    const availW = W - 2 * m;
    const availH = H - 2 * m;
    // The type floor is the --kid-t-book token; a dense page (the decision
    // page at 1280 px) may step down at most 4 px (never below 20) before the
    // words are declared not to fit.
    const floors = [Math.ceil(tokenPx), Math.max(20, Math.ceil(tokenPx) - 4)];
    let best: BookPageLayout | null = null;
    for (const floor of floors)
    for (const t of [0.66, 0.74, 0.82, 0.9, 1.0]) {
      let P = availH;
      let pm = Math.round(clamp(P * 0.016, 8, 16));
      const widthAt = (p: number, margin: number) => (p - 2 * margin) * aspect + 2 * margin + t * p;
      if (widthAt(P, pm) > availW) {
        P = (availW + 2 * pm * aspect - 2 * pm) / (aspect + t);
        pm = Math.round(clamp(P * 0.016, 8, 16));
        P = (availW + 2 * pm * aspect - 2 * pm) / (aspect + t);
      }
      P = Math.floor(P);
      const plateH = P - 2 * pm;
      const plateW = Math.round(plateH * aspect);
      const artPageW = plateW + 2 * pm;
      const textW = Math.floor(Math.min(t * P, availW - artPageW));
      const bookW = artPageW + textW;
      const bx = Math.round((W - bookW) / 2);
      const by = Math.round((H - P) / 2);
      const artPage: Rect = dir === "ltr" ? { x: bx, y: by, w: artPageW, h: P } : { x: bx + textW, y: by, w: artPageW, h: P };
      const textPage: Rect = dir === "ltr" ? { x: bx + artPageW, y: by, w: textW, h: P } : { x: bx, y: by, w: textW, h: P };
      const art: Rect = { x: artPage.x + pm, y: artPage.y + pm, w: plateW, h: plateH };
      const padI = Math.round(clamp(textW * 0.09, 24, 56));
      const padB = Math.round(clamp(P * 0.065, 24, 60));
      const text: Rect = { x: textPage.x + padI, y: textPage.y + padB, w: textW - 2 * padI, h: P - 2 * padB };
      const navPx = 96;
      const cardsPx = content.choices ? Math.round(clamp(P * 0.2, 132, 176)) : 0;
      const actionPx = content.action ? 104 : 0;
      const titlePx = Math.round(clamp(P * 0.062, 34, 60));
      const fixed = navPx + (cardsPx ? cardsPx + 20 : 0) + actionPx + titleHeight(content.title ?? 0, text.w, titlePx);
      const room = text.h - fixed;
      const maxType = Math.round(clamp(P * 0.044, tokenPx, 40));
      let typePx = 0;
      for (let type = maxType; type >= floor; type--) {
        if (estimateTextHeight(content.paras, text.w, type, lineHeight) <= room) {
          typePx = type;
          break;
        }
      }
      const fits = typePx > 0;
      const plate = art;
      const hero = heroRect(slot, plate, art, boxAspect);
      const layout: BookPageLayout = {
        mode: "spread",
        dir,
        book: { x: bx, y: by, w: bookW, h: P },
        artPage,
        art,
        plate,
        crop: { x0: 0, x1: 1 },
        textPage,
        text,
        pad: { inline: padI, block: padB },
        typePx: fits ? typePx : floor,
        lineHeight,
        titlePx,
        navPx,
        cardsPx,
        hero,
        shadow: shadowFor(slot, plate, hero),
        spine: dir === "ltr" ? "left" : "right",
        fits,
      };
      best = layout;
      if (fits) return layout;
    }
    return best!;
  }

  // ── stacked ────────────────────────────────────────────────────────────────
  const colW = Math.min(W, 640);
  const colX = Math.round((W - colW) / 2);
  const padI = 20;
  const padB = 16;
  const navPx = 84;
  const textW = colW - 2 * padI;
  const cardsPx = content.choices ? 132 : 0;
  const actionPx = content.action ? 96 : 0;
  const titlePx = Math.round(clamp(W * 0.085, 30, 40));
  const fixed = navPx + (cardsPx ? cardsPx + 12 : 0) + actionPx + titleHeight(content.title ?? 0, textW, titlePx) + 2 * padB;
  const maxArtH = colW / PHONE_WINDOW;
  const minArtH = Math.round(H * 0.36);
  // Prefer a generous picture (>= 52 % of the height): take the largest type
  // that leaves it; else the largest type that leaves the floor (36 %); else
  // the floor size (the words then scroll in the sheet — fits = false).
  const maxType = W <= 480 ? 22 : 24;
  const targetArtH = Math.min(maxArtH, H * 0.52);
  const artAt = (type: number) => Math.min(maxArtH, H - (fixed + estimateTextHeight(content.paras, textW, type, lineHeight)));
  const floorType = Math.ceil(tokenPx);
  const types: number[] = [];
  for (let type = Math.max(maxType, floorType); type >= floorType; type--) types.push(type);
  const typePx = types.find((t) => artAt(t) >= targetArtH) ?? types.find((t) => artAt(t) >= minArtH) ?? floorType;
  let artH = artAt(typePx);
  const fits = artH >= minArtH;
  artH = Math.floor(Math.max(artH, minArtH));
  const artW = Math.floor(artH * PHONE_WINDOW);
  const art: Rect = { x: Math.round((W - artW) / 2), y: 0, w: artW, h: artH };
  // The window holds the page's slot AND its after-tap slot, so it does not
  // jump when the repair tap moves the hero.
  const crop = phoneWindow(page, [slot, page.hero, page.actionTap?.heroAfter, opts.alsoContain], aspect, boxAspect);
  const plateDisplayW = artH * aspect;
  const plate: Rect = { x: art.x - crop.x0 * plateDisplayW, y: 0, w: plateDisplayW, h: artH };
  const textPage: Rect = { x: colX, y: artH, w: colW, h: Math.max(0, H - artH) };
  const text: Rect = { x: colX + padI, y: artH + padB, w: textW, h: Math.max(0, H - artH - 2 * padB) };
  const hero = heroRect(slot, plate, art, boxAspect);
  return {
    mode: "stacked",
    dir,
    book: { x: colX, y: 0, w: colW, h: H },
    artPage: art,
    art,
    plate,
    crop,
    textPage,
    text,
    pad: { inline: padI, block: padB },
    typePx,
    lineHeight,
    titlePx,
    navPx,
    cardsPx,
    hero,
    shadow: shadowFor(slot, plate, hero),
    spine: dir === "ltr" ? "left" : "right",
    fits,
  };
}

/** Area of the intersection of two rects (0 when they only touch). */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
