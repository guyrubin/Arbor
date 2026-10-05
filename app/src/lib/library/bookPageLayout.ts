/**
 * lib/library/bookPageLayout — B-BOOK-03 (+ RULINGS ruling 6, fix round 1):
 * ONE pure function returns every rect of a book page for a box (lane B §6.1).
 * No DOM: the React renderer (components/library/BookPage + BookReader)
 * positions its layers from it; a canvas twin for export can reuse it later.
 *
 * Wide (box >= 900 px and landscape; target 1920x1080):
 * - facing (every story page in the proof): an open book. The art page holds
 *   the WHOLE plate at its own aspect (never stretched, never cropped) inside
 *   a thin paper margin; the paper text page sits beside it. In Hebrew the
 *   text page goes on the left (the art itself is NOT mirrored). The decision
 *   page widens its text page so three LARGE picture cards (>= 300 px at
 *   1920) sit in a row without the words dropping under the type token.
 * - spread: honoured ONLY when the words (and the page controls) fit entirely
 *   inside the plate's authored calm `textRect`; otherwise facing (fix round
 *   1: a card floating over the art read as a slideshow).
 * - cover: the whole plate is the book's front; the title, the name line and
 *   the cover line are set in the plate's calm band (`textRect`) with no card,
 *   and ONE Open toy sits under the plate. If the title does not fit the band
 *   the cover is a facing title page (large title, name line, cover line, Open).
 * The book type is the largest that fits the words (estimated), floored at the
 * --kid-t-book token (a dense page at 1280 may step down at most 4 px).
 *
 * Narrow / portrait (target 375x812): stacked — a 3:4 window of the plate on
 * top (never under 300 px wide), the words on a paper sheet below. The window
 * centre is the page's phoneCrop (else the plate's authored window), moved
 * only as far as needed to hold the hero, the after-repair hero and every
 * repair item. The decision page's cards may ride up over the art's lower
 * edge (`sheetOverlap`) rather than shrink the picture below the floor.
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

/** What the text page / panel has to hold. */
export interface LayoutContent {
  /** Characters per paragraph, the name filled in. */
  paras: readonly number[];
  /** Choice cards in a row under the words (the decision page). */
  choices?: number;
  /** The repair prompt row (a repair page before it is done). */
  prompt?: boolean;
  /** Characters of a title set above the words (the cover). */
  title?: number;
}

export interface LayoutPlate {
  width: number;
  height: number;
  window?: { cx: number };
  textZone?: "inline-start" | "inline-end" | "bottom";
}

export interface LayoutOpts {
  /** Lay the page out as the book's cover. */
  cover?: boolean;
  /** The plate (default: the 1536x1024 master, centred window). */
  plate?: LayoutPlate;
  /** The slot to place (default: page.hero). */
  slot?: Slot | null;
  content?: LayoutContent;
  /** Sprite box width / height when the sheet gives no anchor. The sprite is
   *  drawn contain + bottom-centre in it, so a square box holds any pose at
   *  full height (conservative). */
  heroBoxAspect?: number;
  /** The sheet's measured sprite geometry per pose (the art agent's anchor:
   *  the centre of the lowest opaque band). Known = the box IS the sprite. */
  anchorOf?: AnchorOf;
}

/** A sprite's geometry: aspect = width / height of the (tight) image; footX =
 *  the feet-band centre and footW = its width, as fractions of the width. */
export interface SpriteAnchor {
  aspect: number;
  footX: number;
  footW: number;
}
export type AnchorOf = (pose: string) => SpriteAnchor | undefined;

export interface ShadowEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  opacity: number;
  /** Gaussian blur radius, px. */
  blur: number;
}

export interface HeroRect extends Rect {
  flip: boolean;
  /** The whole sprite box lies inside the visible art window. */
  inWindow: boolean;
}

export interface BookPageLayout {
  mode: "wide" | "stacked";
  /** The page type actually laid out (a spread or a cover may fall back to facing). */
  pageType: "facing" | "spread" | "cover";
  dir: "ltr" | "rtl";
  /** The open book / framed plate (wide) or the column (stacked). */
  book: Rect;
  /** The paper page that holds the art (wide) — equals `art` when stacked. */
  artPage: Rect;
  /** The visible art window. */
  art: Rect;
  /** The full plate image (extends past `art` when stacked; clipped by it). */
  plate: Rect;
  /** The visible window in plate fractions. */
  crop: { x0: number; x1: number };
  /** The paper page / panel / sheet that holds the words and the controls. */
  textPage: Rect;
  /** The content box inside the text page's padding. */
  text: Rect;
  pad: { inline: number; block: number };
  typePx: number;
  lineHeight: number;
  titlePx: number;
  /** Height reserved at the bottom of the text box for the page controls. */
  navPx: number;
  /** Height of the choice-card row (0 when none), and one card's width and
   *  picture height. */
  cardsPx: number;
  cardW: number;
  cardPicH: number;
  /** Stacked: how far the sheet (its card row first) rides up over the art. */
  sheetOverlap: number;
  /** Cover: the rect of the ONE Open toy (under the plate). */
  openRect?: Rect;
  hero: HeroRect | null;
  /** The hero's body (narrower than the sprite box) — what a panel avoids. */
  heroBody: Rect | null;
  /** Contact shadow (scripts' compositor): a dark core hugging the soles + a
   *  soft cast away from the light. */
  shadow: (ShadowEllipse & { cast: ShadowEllipse }) | null;
  /** The physical side of a facing text page that touches the spine. */
  spine: "left" | "right";
  /** False when the words could not be fitted at the floor size (they then
   *  scroll inside the page — a text defect for the author, never clipped). */
  fits: boolean;
}

export const SPREAD_MIN_WIDTH = 900;
const MASTER: LayoutPlate = { width: 1536, height: 1024 };
const PHONE_WINDOW = 3 / 4; // width / height of the stacked art window
const CROP_MARGIN = 0.02; // fraction of the plate width kept around the hero
const ITEM_RADIUS = 0.03; // half-size of a repair item's tap target (plate widths)
const BODY_ASPECT = 0.6; // the hero's body box, width / height

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

function anchorFor(c: Pick<Ctx, "anchorOf" | "boxAspect">, slot: Slot | null | undefined): SpriteAnchor & { known: boolean } {
  const a = slot ? c.anchorOf?.(slot.pose) : undefined;
  return a ? { ...a, known: true } : { aspect: c.boxAspect, footX: 0.5, footW: 0.45, known: false };
}

function heroRect(slot: Slot | null | undefined, plate: Rect, art: Rect, a: SpriteAnchor): HeroRect | null {
  if (!slot) return null;
  const h = slot.scale * plate.h;
  const w = h * a.aspect;
  const x = plate.x + slot.x * plate.w - a.footX * w;
  const y = plate.y + slot.y * plate.h - h;
  const eps = 0.5;
  const inWindow = x >= art.x - eps && x + w <= art.x + art.w + eps && y >= art.y - eps && y + h <= art.y + art.h + eps;
  return { x, y, w, h, flip: slot.facing === "left", inWindow };
}

/** What a text panel must not cover: the sprite itself when its geometry is
 *  measured, else a body-width estimate. */
function bodyRect(slot: Slot | null | undefined, plate: Rect, a: SpriteAnchor & { known: boolean }): Rect | null {
  if (!slot) return null;
  const h = slot.scale * plate.h;
  if (a.known) {
    const w = h * a.aspect;
    return { x: plate.x + slot.x * plate.w - a.footX * w, y: plate.y + slot.y * plate.h - h, w, h };
  }
  const w = h * BODY_ASPECT;
  return { x: plate.x + slot.x * plate.w - w / 2, y: plate.y + slot.y * plate.h - h, w, h };
}

/** The art agent's contact shadow (compose.py `shadow`), as two ellipses:
 *  a dark core under the soles (alpha .92 x strength, blur .03 w) and a soft
 *  cast offset away from the light (alpha .59 x strength, blur .12 w), where
 *  w = the feet band's width. */
function shadowFor(slot: Slot | null | undefined, plate: Rect, hero: HeroRect | null, a: SpriteAnchor): BookPageLayout["shadow"] {
  if (!slot || !hero) return null;
  const s = slot.shadow ?? 0.8;
  const dx = slot.lightDx ?? 0.8;
  const w = Math.max(6, a.footW * hero.w);
  const fx = plate.x + slot.x * plate.w;
  const fy = plate.y + slot.y * plate.h;
  return {
    cx: fx,
    cy: fy + 0.01 * w,
    rx: w * 0.56,
    ry: Math.max(2, w * 0.035),
    opacity: Math.min(1, 0.92 * s),
    blur: Math.max(2, w * 0.03),
    cast: {
      cx: fx + dx * 0.715 * w,
      cy: fy + 0.011 * w,
      rx: w * (0.55 + 0.26 * Math.abs(dx)),
      ry: w * 0.121,
      opacity: Math.min(1, 0.59 * s),
      blur: Math.max(6, w * 0.12),
    },
  };
}

/** A point of the plate (fractions) in box coordinates. */
export function platePoint(l: Pick<BookPageLayout, "plate">, fx: number, fy: number): { x: number; y: number } {
  return { x: l.plate.x + fx * l.plate.w, y: l.plate.y + fy * l.plate.h };
}

/** The window centre the page asks for: the page override, else the plate's
 *  authored window, else the middle. */
export function windowCentre(page: Page, plate?: LayoutPlate): number {
  return page.phoneCrop ?? plate?.window?.cx ?? 0.5;
}

/** The intervals (plate-width fractions) the phone window must hold: the
 *  hero now, the hero after the repair, and every repair item where the child
 *  taps it. Later intervals win when they cannot all fit; the page's own hero
 *  is applied last, so it always wins. */
function requiredIntervals(page: Page, slot: Slot | null | undefined, plateAspect: number, anchorOf?: AnchorOf): [number, number][] {
  const out: [number, number][] = [];
  for (const it of page.repair?.items ?? []) out.push([it.x - ITEM_RADIUS, it.x + ITEM_RADIUS]);
  for (const s of [page.repair?.heroAfter, page.hero, slot]) {
    if (!s) continue;
    const a = anchorOf?.(s.pose) ?? { aspect: 1, footX: 0.5, footW: 0.45 };
    const w = (s.scale * a.aspect) / plateAspect;
    out.push([s.x - a.footX * w, s.x + (1 - a.footX) * w]);
  }
  return out;
}

/** The phone window [x0, x1] (plate fractions): centred on the authored
 *  window, moved only as far as needed so the required intervals (+ margin)
 *  are inside. */
export function phoneWindow(page: Page, slot: Slot | null | undefined, plate: LayoutPlate, anchorOf?: AnchorOf): { x0: number; x1: number } {
  const aspect = plate.width / plate.height;
  const wf = Math.min(1, PHONE_WINDOW / aspect);
  let cx = clamp(windowCentre(page, plate), wf / 2, 1 - wf / 2);
  for (const [lo0, hi0] of requiredIntervals(page, slot, aspect, anchorOf)) {
    const lo = lo0 - CROP_MARGIN;
    const hi = hi0 + CROP_MARGIN;
    if (lo < cx - wf / 2) cx = lo + wf / 2;
    if (hi > cx + wf / 2) cx = hi - wf / 2;
  }
  cx = clamp(cx, wf / 2, 1 - wf / 2);
  return { x0: cx - wf / 2, x1: cx + wf / 2 };
}

interface Ctx {
  page: Page;
  box: Box;
  plate: LayoutPlate;
  aspect: number;
  slot: Slot | null | undefined;
  boxAspect: number;
  anchorOf?: AnchorOf;
  content: LayoutContent;
  lineHeight: number;
  dir: "ltr" | "rtl";
  tokenPx: number;
  floors: number[];
  cover: boolean;
}

/** Largest type in [max, floor] whose words fit in the room left at this width. */
function fitType(c: Ctx, width: number, room: (type: number) => number, max: number, floor: number): number {
  for (let type = max; type >= floor; type--) if (estimateTextHeight(c.content.paras, width, type, c.lineHeight) <= room(type)) return type;
  return 0;
}

/** Card sizing at this viewport: >= 300 px at 1920, never under 140. */
function cardSizes(W: number): number[] {
  const top = Math.round(clamp(W * 0.165, 140, 320));
  const out: number[] = [];
  for (let w = top; w >= 140; w -= 20) out.push(w);
  return out;
}
const CARD_GAP = 16;
const CARD_LABEL_PX = 64; // two label lines + the card's padding
const cardPic = (w: number) => Math.round(w * 0.64);

function layoutFacing(c: Ctx): BookPageLayout {
  const { box, aspect, dir, content } = c;
  const W = box.width;
  const H = box.height;
  const m = Math.round(clamp(Math.min(W, H) * 0.04, 16, 48));
  const availW = W - 2 * m;
  const availH = H - 2 * m;
  let best: BookPageLayout | null = null;
  // The decision page: the text page must hold three cards in a row.
  const cardOptions = content.choices ? cardSizes(W) : [0];
  for (const floor of c.floors) {
    for (const cardW of cardOptions) {
      const ts = content.choices ? [0] : [0.66, 0.74, 0.82, 0.9, 1.0];
      for (const t of ts) {
        let P = availH;
        let pm = Math.round(clamp(P * 0.016, 8, 16));
        let textW: number;
        if (content.choices) {
          const padGuess = Math.round(clamp(W * 0.022, 24, 44));
          textW = 3 * cardW + 2 * CARD_GAP + 2 * padGuess;
          // the art page takes the rest of the width (whole plate, its own aspect)
          P = Math.min(availH, Math.floor((availW - textW - 2 * pm) / aspect + 2 * pm));
          pm = Math.round(clamp(P * 0.016, 8, 16));
        } else {
          const widthAt = (p: number, margin: number) => (p - 2 * margin) * aspect + 2 * margin + t * p;
          if (widthAt(P, pm) > availW) {
            P = (availW + 2 * pm * aspect - 2 * pm) / (aspect + t);
            pm = Math.round(clamp(P * 0.016, 8, 16));
            P = (availW + 2 * pm * aspect - 2 * pm) / (aspect + t);
          }
          P = Math.floor(P);
          textW = 0;
        }
        const plateH = P - 2 * pm;
        const plateW = Math.round(plateH * aspect);
        const artPageW = plateW + 2 * pm;
        if (!content.choices) textW = Math.floor(Math.min(t * P, availW - artPageW));
        textW = Math.min(textW, availW - artPageW);
        // the decision page may need more height than the art: the text page grows
        const padI = content.choices ? Math.round(clamp(W * 0.022, 24, 44)) : Math.round(clamp(textW * 0.09, 24, 56));
        const navPx = 96;
        // the cards take the text box's real width (rounding may trim a few px)
        const effCardW = content.choices ? Math.floor((textW - 2 * padI - 2 * CARD_GAP) / 3) : 0;
        const picH = content.choices ? cardPic(effCardW) : 0;
        const cardsPx = content.choices ? picH + CARD_LABEL_PX : 0;
        const promptPx = content.prompt ? 72 : 0;
        const titlePx = Math.round(clamp(P * 0.062, 34, 60));
        const fixedOf = (textBoxW: number) => navPx + (cardsPx ? cardsPx + 24 : 0) + promptPx + titleHeight(content.title ?? 0, textBoxW, titlePx);
        let pageH = P;
        const padB0 = Math.round(clamp(P * 0.065, 24, 60));
        const textBoxW = textW - 2 * padI;
        const maxType = Math.round(clamp(P * 0.044, c.tokenPx, 40));
        let typePx = fitType(c, textBoxW, () => pageH - 2 * padB0 - fixedOf(textBoxW), maxType, floor);
        if (!typePx && content.choices) {
          // grow the text page's height (up to the stage) before shrinking cards
          const need = 2 * padB0 + fixedOf(textBoxW) + estimateTextHeight(content.paras, textBoxW, floor, c.lineHeight);
          if (need <= availH) {
            pageH = Math.ceil(need);
            typePx = fitType(c, textBoxW, () => pageH - 2 * padB0 - fixedOf(textBoxW), maxType, floor);
          }
        }
        const fits = typePx > 0;
        const bookH = Math.max(P, pageH);
        const bookW = artPageW + textW;
        const bx = Math.round((W - bookW) / 2);
        const by = Math.round((H - bookH) / 2);
        const artY = by + Math.round((bookH - P) / 2);
        const artPage: Rect = dir === "ltr" ? { x: bx, y: artY, w: artPageW, h: P } : { x: bx + textW, y: artY, w: artPageW, h: P };
        const textPage: Rect = dir === "ltr" ? { x: bx + artPageW, y: by, w: textW, h: bookH } : { x: bx, y: by, w: textW, h: bookH };
        const art: Rect = { x: artPage.x + pm, y: artPage.y + pm, w: plateW, h: plateH };
        const text: Rect = { x: textPage.x + padI, y: textPage.y + padB0, w: textBoxW, h: bookH - 2 * padB0 };
        const anchor = anchorFor(c, c.slot);
        const hero = heroRect(c.slot, art, art, anchor);
        best = {
          mode: "wide",
          pageType: "facing",
          dir,
          book: { x: bx, y: by, w: bookW, h: bookH },
          artPage,
          art,
          plate: art,
          crop: { x0: 0, x1: 1 },
          textPage,
          text,
          pad: { inline: padI, block: padB0 },
          typePx: fits ? typePx : floor,
          lineHeight: c.lineHeight,
          titlePx,
          navPx,
          cardsPx,
          cardW: effCardW,
          cardPicH: picH,
          sheetOverlap: 0,
          hero,
          heroBody: bodyRect(c.slot, art, anchor),
          shadow: shadowFor(c.slot, art, hero, anchor),
          spine: dir === "ltr" ? "left" : "right",
          fits,
        };
        if (fits) return best;
      }
    }
  }
  return best!;
}

/** Area of the intersection of two rects (0 when they only touch). */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The whole plate, large, in a paper frame (spread and cover). `reserveB`
 *  keeps room under the plate (the cover's Open toy). */
function framedPlate(c: Ctx, reserveB = 0): { artPage: Rect; art: Rect } {
  const W = c.box.width;
  const H = c.box.height;
  const m = Math.round(clamp(Math.min(W, H) * 0.04, 16, 48));
  const pm = 12;
  const availW = W - 2 * m;
  const availH = H - 2 * m - reserveB;
  const plateH = Math.floor(Math.min(availH - 2 * pm, (availW - 2 * pm) / c.aspect));
  const plateW = Math.round(plateH * c.aspect);
  const top = Math.round((H - reserveB - plateH) / 2) - pm;
  const artPage: Rect = { x: Math.round((W - plateW) / 2) - pm, y: Math.max(m, top), w: plateW + 2 * pm, h: plateH + 2 * pm };
  return { artPage, art: { x: artPage.x + pm, y: artPage.y + pm, w: plateW, h: plateH } };
}

function rectOnPlate(r: readonly [number, number, number, number], art: Rect): Rect {
  return { x: art.x + r[0] * art.w, y: art.y + r[1] * art.h, w: (r[2] - r[0]) * art.w, h: (r[3] - r[1]) * art.h };
}

/** A spread is honoured only when the words AND the page controls fit inside
 *  the plate's authored calm rect (fix round 1 ruling 1); else null → facing. */
function layoutSpread(c: Ctx): BookPageLayout | null {
  const r = c.page.textRect;
  if (!r) return null;
  const { artPage, art } = framedPlate(c);
  const zone = rectOnPlate(r, art);
  const pad = Math.round(clamp(zone.w * 0.05, 12, 28));
  const textW = zone.w - 2 * pad;
  const navPx = 92;
  if (c.content.choices || c.content.prompt || textW < 240) return null;
  const maxType = Math.round(clamp(art.h * 0.042, c.tokenPx, 38));
  const typePx = fitType(c, textW, () => zone.h - 2 * pad - navPx, maxType, c.floors[0]);
  if (!typePx) return null;
  const anchor = anchorFor(c, c.slot);
  const hero = heroRect(c.slot, art, art, anchor);
  const body = bodyRect(c.slot, art, anchor);
  if (body && overlapArea(zone, body) > 0) return null;
  return {
    mode: "wide",
    pageType: "spread",
    dir: c.dir,
    book: artPage,
    artPage,
    art,
    plate: art,
    crop: { x0: 0, x1: 1 },
    textPage: zone,
    text: { x: zone.x + pad, y: zone.y + pad, w: textW, h: zone.h - 2 * pad },
    pad: { inline: pad, block: pad },
    typePx,
    lineHeight: c.lineHeight,
    titlePx: 0,
    navPx,
    cardsPx: 0,
    cardW: 0,
    cardPicH: 0,
    sheetOverlap: 0,
    hero,
    heroBody: body,
    shadow: shadowFor(c.slot, art, hero, anchor),
    spine: c.dir === "ltr" ? "left" : "right",
    fits: true,
  };
}

const OPEN_ROW = 112;

/** The cover as the book's front: the whole plate, the title set in its calm
 *  band (no card), ONE Open toy under the plate. Null when the title does not
 *  fit the band → a facing title page. `content.paras` = [cover line, name line]. */
function layoutCover(c: Ctx): BookPageLayout | null {
  const r = c.page.textRect;
  if (!r) return null;
  const { artPage, art } = framedPlate(c, OPEN_ROW);
  const zone = rectOnPlate(r, art);
  const pad = Math.round(clamp(zone.h * 0.08, 8, 20));
  const w = zone.w - 2 * pad;
  const [lineChars = 0, nameChars = 0] = c.content.paras;
  const titleChars = c.content.title ?? 0;
  for (let titlePx = Math.round(clamp(art.h * 0.085, 40, 84)); titlePx >= 34; titlePx -= 2) {
    const namePx = Math.round(titlePx * 0.5);
    const linePx = Math.max(18, Math.round(titlePx * 0.36));
    const hTitle = Math.ceil(titleChars / Math.max(1, Math.floor(w / (titlePx * 0.56)))) * titlePx * 1.08;
    const hName = nameChars ? Math.ceil(nameChars / Math.max(1, Math.floor(w / (namePx * 0.56)))) * namePx * 1.25 : 0;
    const hLine = estimateTextHeight([lineChars], w, linePx, 1.35);
    if (hTitle + hName + hLine + 2 * pad > zone.h) continue;
    const anchor = anchorFor(c, c.slot);
    const hero = heroRect(c.slot, art, art, anchor);
    const openW = Math.round(clamp(art.w * 0.3, 260, 380));
    return {
      mode: "wide",
      pageType: "cover",
      dir: c.dir,
      book: artPage,
      artPage,
      art,
      plate: art,
      crop: { x0: 0, x1: 1 },
      textPage: zone,
      text: { x: zone.x + pad, y: zone.y + pad, w, h: zone.h - 2 * pad },
      pad: { inline: pad, block: pad },
      typePx: linePx,
      lineHeight: 1.35,
      titlePx,
      navPx: 0,
      cardsPx: 0,
      cardW: 0,
      cardPicH: 0,
      sheetOverlap: 0,
      openRect: { x: Math.round(art.x + (art.w - openW) / 2), y: artPage.y + artPage.h + 18, w: openW, h: 88 },
      hero,
      heroBody: bodyRect(c.slot, art, anchor),
      shadow: shadowFor(c.slot, art, hero, anchor),
      spine: c.dir === "ltr" ? "left" : "right",
      fits: true,
    };
  }
  return null;
}

/** The stacked art window is never narrower than this (fix round 1). */
export const STACKED_ART_MIN_W = 300;

function layoutStacked(c: Ctx): BookPageLayout {
  const { box, aspect, dir, content, page } = c;
  const W = box.width;
  const H = box.height;
  const colW = Math.min(W, 640);
  const colX = Math.round((W - colW) / 2);
  const padI = 20;
  const padB = 16;
  const navPx = 84;
  const textW = colW - 2 * padI;
  const cardW = content.choices ? Math.floor((textW - 2 * 10) / 3) : 0;
  const picH = content.choices ? cardPic(cardW) : 0;
  const cardsPx = content.choices ? picH + CARD_LABEL_PX : 0;
  const promptPx = content.prompt ? 56 : 0;
  const titlePx = Math.round(clamp(W * 0.085, 30, 40));
  const fixed = navPx + (cardsPx ? cardsPx + 12 : 0) + promptPx + titleHeight(content.title ?? 0, textW, titlePx) + 2 * padB;
  const maxArtH = colW / PHONE_WINDOW;
  const floorArtH = Math.min(maxArtH, Math.ceil(Math.min(STACKED_ART_MIN_W, W - 16) / PHONE_WINDOW));
  // Prefer a generous picture (>= 52 % of the height): take the largest type
  // that leaves it; else the largest that leaves the floor; else the floor.
  const maxType = W <= 480 ? 22 : 24;
  const targetArtH = Math.min(maxArtH, Math.max(H * 0.52, floorArtH));
  const artAt = (type: number) => Math.min(maxArtH, H - (fixed + estimateTextHeight(content.paras, textW, type, c.lineHeight)));
  const floorType = Math.ceil(c.tokenPx);
  const types: number[] = [];
  for (let type = Math.max(maxType, floorType); type >= floorType; type--) types.push(type);
  // under the floor, a non-decision page may set its words at 18 px rather
  // than shrink the picture under 300 px
  const lowTypes = content.choices ? [] : [floorType - 1, 18].filter((t) => t >= 18 && t < floorType);
  const typePx = types.find((t) => artAt(t) >= targetArtH) ?? types.find((t) => artAt(t) >= floorArtH) ?? lowTypes.find((t) => artAt(t) >= floorArtH) ?? floorType;
  const natural = artAt(typePx);
  const artH = Math.floor(Math.max(natural, floorArtH));
  // the decision page lets its card row ride up over the art's lower edge
  const sheetOverlap = content.choices && natural < floorArtH ? Math.min(Math.ceil(floorArtH - natural), cardsPx) : 0;
  const fits = natural + sheetOverlap >= floorArtH - 0.5;
  const artW = Math.floor(artH * PHONE_WINDOW);
  const art: Rect = { x: Math.round((W - artW) / 2), y: 0, w: artW, h: artH };
  const crop = phoneWindow(page, c.slot, c.plate, c.anchorOf);
  const plateDisplayW = artH * aspect;
  const plate: Rect = { x: art.x - crop.x0 * plateDisplayW, y: 0, w: plateDisplayW, h: artH };
  const sheetY = artH - sheetOverlap;
  const textPage: Rect = { x: colX, y: sheetY, w: colW, h: Math.max(0, H - sheetY) };
  const text: Rect = { x: colX + padI, y: sheetY + padB, w: textW, h: Math.max(0, H - sheetY - 2 * padB) };
  const anchor = anchorFor(c, c.slot);
  const hero = heroRect(c.slot, plate, art, anchor);
  return {
    mode: "stacked",
    pageType: c.cover ? "cover" : page.type ?? "facing",
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
    lineHeight: c.lineHeight,
    titlePx,
    navPx,
    cardsPx,
    cardW,
    cardPicH: picH,
    sheetOverlap,
    hero,
    heroBody: bodyRect(c.slot, plate, anchor),
    shadow: shadowFor(c.slot, plate, hero, anchor),
    spine: dir === "ltr" ? "left" : "right",
    fits,
  };
}

export function computeBookPageLayout(page: Page, box: Box, lang: BookLang, opts: LayoutOpts = {}): BookPageLayout {
  const plate = opts.plate ?? MASTER;
  const tokenPx = kidBookTokenPx(box.width);
  const c: Ctx = {
    page,
    box: { width: Math.max(1, box.width), height: Math.max(1, box.height) },
    plate,
    aspect: plate.width / plate.height,
    slot: opts.slot === undefined ? page.hero : opts.slot,
    boxAspect: opts.heroBoxAspect ?? 1,
    anchorOf: opts.anchorOf,
    content: opts.content ?? { paras: [page.text.en.length] },
    lineHeight: lang === "he" ? 1.6 : 1.5,
    dir: lang === "he" ? "rtl" : "ltr",
    tokenPx,
    // The type floor is the --kid-t-book token; a dense page may step down
    // at most 4 px (never below 20) before the words are declared not to fit.
    floors: [Math.ceil(tokenPx), Math.max(20, Math.ceil(tokenPx) - 4)],
    cover: !!opts.cover,
  };
  if (c.box.width >= SPREAD_MIN_WIDTH && c.box.width >= c.box.height) {
    if (c.cover) {
      const cover = layoutCover(c);
      if (cover) return cover;
    } else if (page.type === "spread") {
      const spread = layoutSpread(c);
      if (spread) return spread;
    }
    return layoutFacing(c);
  }
  return layoutStacked(c);
}
