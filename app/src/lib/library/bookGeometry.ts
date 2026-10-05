/**
 * lib/library/bookGeometry — B-BOOK-06/08: a book's art geometry as ONE plain
 * object (JSON), owned by the plate author (RULINGS BR6) and overwritable
 * without touching the book's words. For the proof it is GENERATED from the
 * art agent's plates.json by scripts/import-book-art.py. All positions are
 * fractions of the master plate.
 *
 * - plates[id]: size {w, h} of the shipped file, light {dx}, provenance,
 *   variantOf, window {cx}, textZone, focus (choice-card crops).
 * - pages[id]: hero (slot + shadow / lightDx / tint), heroAfter (after the
 *   repair), heroAlt (costume variants), phoneCrop (the 3:4 window centre),
 *   textRect (the calm area on a spread), items (repair tap points + landing
 *   spots), overlays (file, position, anchor, z, rotate, showWhen, reveal),
 *   occluders (plate patches over the hero).
 *
 * `readGeometry` validates an untrusted JSON value: a bad entry is dropped
 * (never thrown), so a half-finished geometry file still renders a book.
 */
import type { PlateRect } from "./bookPlates";
import type { PlateOccluder, Slot } from "./types";

export interface PlateGeometry {
  size?: { w: number; h: number };
  lightDx?: number;
  provenance?: { childFree: boolean; textFree: boolean; reviewedBy: string | null };
  variantOf?: string;
  window?: { cx: number };
  textZone?: "inline-start" | "inline-end" | "bottom";
  focus?: Record<string, PlateRect>;
}

export interface OverlayGeometry {
  file?: string;
  x: number;
  y: number;
  scale: number;
  aspect?: number;
  footX?: number;
  anchor?: "feet" | "center";
  z?: "over" | "under";
  rotate?: number;
  shadow?: number;
  showWhen?: { item: string; done: boolean };
  reveal?: "always" | "afterNarration";
}

export interface PageGeometry {
  plate?: string;
  hero?: Slot | null;
  heroAfter?: Slot;
  heroAlt?: Record<string, Slot>;
  phoneCrop?: number;
  textRect?: [number, number, number, number];
  items?: Record<string, { x: number; y: number; to?: { x: number; y: number } }>;
  overlays?: Record<string, OverlayGeometry>;
  occluders?: PlateOccluder[];
}

export interface BookGeometry {
  plates: Record<string, PlateGeometry>;
  pages: Record<string, PageGeometry>;
  /** Choice-card pictures, by choice id: file paths relative to the book's
   *  public folder (e.g. "choices/a.webp"). */
  choiceArt?: Record<string, string>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const frac = (v: unknown): v is number => num(v) && v >= 0 && v <= 1;
const pos = (v: unknown): v is number => num(v) && v > 0;
/** Overlays may hang past the plate edge (the dust cloud is anchored below it). */
const loose = (v: unknown): v is number => num(v) && v >= -1 && v <= 2;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function point(v: unknown): { x: number; y: number } | undefined {
  return isObj(v) && frac(v.x) && frac(v.y) ? { x: v.x, y: v.y } : undefined;
}

function rect(v: unknown): PlateRect | undefined {
  if (!isObj(v) || !frac(v.x) || !frac(v.y) || !frac(v.w) || !frac(v.h)) return undefined;
  return v.w > 0 && v.h > 0 && v.x + v.w <= 1.0001 && v.y + v.h <= 1.0001 ? { x: v.x, y: v.y, w: v.w, h: v.h } : undefined;
}

function box4(v: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(frac)) return undefined;
  const [x0, y0, x1, y1] = v as number[];
  return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : undefined;
}

export function readSlot(v: unknown): Slot | undefined {
  if (!isObj(v) || typeof v.pose !== "string" || !ID.test(v.pose) || !frac(v.x) || !frac(v.y) || !frac(v.scale)) return undefined;
  const slot: Slot = {
    pose: v.pose,
    x: v.x,
    y: v.y,
    scale: v.scale,
    facing: v.facing === "left" ? "left" : "right",
    z: v.z === "fg" ? "fg" : "fr",
  };
  if (frac(v.shadow)) slot.shadow = v.shadow;
  if (num(v.lightDx) && Math.abs(v.lightDx) <= 2) slot.lightDx = v.lightDx;
  if (Array.isArray(v.tint) && v.tint.length === 3 && v.tint.every((c) => num(c) && c >= 0 && c <= 255)) slot.tint = [v.tint[0], v.tint[1], v.tint[2]] as [number, number, number];
  return slot;
}

function readOverlay(v: unknown): OverlayGeometry | undefined {
  if (!isObj(v) || !loose(v.x) || !loose(v.y) || !pos(v.scale) || v.scale > 3) return undefined;
  const o: OverlayGeometry = { x: v.x, y: v.y, scale: v.scale };
  if (typeof v.file === "string" && ID.test(v.file)) o.file = v.file;
  if (pos(v.aspect)) o.aspect = v.aspect;
  if (frac(v.footX)) o.footX = v.footX;
  if (v.anchor === "center" || v.anchor === "feet") o.anchor = v.anchor;
  if (v.z === "under" || v.z === "over") o.z = v.z;
  if (num(v.rotate) && Math.abs(v.rotate) <= 360) o.rotate = v.rotate;
  if (frac(v.shadow)) o.shadow = v.shadow;
  if (isObj(v.showWhen) && typeof v.showWhen.item === "string" && ID.test(v.showWhen.item) && typeof v.showWhen.done === "boolean") o.showWhen = { item: v.showWhen.item, done: v.showWhen.done };
  if (v.reveal === "afterNarration" || v.reveal === "always") o.reveal = v.reveal;
  return o;
}

function entries(v: unknown): [string, unknown][] {
  return isObj(v) ? Object.entries(v).filter(([k]) => ID.test(k)) : [];
}

export function readGeometry(raw: unknown): BookGeometry {
  const out: BookGeometry = { plates: {}, pages: {} };
  if (!isObj(raw)) return out;
  for (const [id, p] of entries(raw.plates)) {
    if (!isObj(p)) continue;
    const g: PlateGeometry = {};
    if (isObj(p.size) && pos(p.size.w) && pos(p.size.h)) g.size = { w: p.size.w, h: p.size.h };
    if (isObj(p.light) && num(p.light.dx) && Math.abs(p.light.dx) <= 2) g.lightDx = p.light.dx;
    if (isObj(p.provenance) && typeof p.provenance.childFree === "boolean" && typeof p.provenance.textFree === "boolean") {
      const by = p.provenance.reviewedBy;
      g.provenance = { childFree: p.provenance.childFree, textFree: p.provenance.textFree, reviewedBy: typeof by === "string" ? by : null };
    }
    if (typeof p.variantOf === "string" && ID.test(p.variantOf)) g.variantOf = p.variantOf;
    if (isObj(p.window) && frac(p.window.cx)) g.window = { cx: p.window.cx };
    if (p.textZone === "inline-start" || p.textZone === "inline-end" || p.textZone === "bottom") g.textZone = p.textZone;
    const focus: Record<string, PlateRect> = {};
    for (const [cid, r] of entries(p.focus)) {
      const ok = rect(r);
      if (ok) focus[cid] = ok;
    }
    if (Object.keys(focus).length) g.focus = focus;
    out.plates[id] = g;
  }
  for (const [id, p] of entries(raw.pages)) {
    if (!isObj(p)) continue;
    const g: PageGeometry = {};
    if (typeof p.plate === "string" && ID.test(p.plate)) g.plate = p.plate;
    if (p.hero === null) g.hero = null;
    else {
      const s = readSlot(p.hero);
      if (s) g.hero = s;
    }
    const after = readSlot(p.heroAfter);
    if (after) g.heroAfter = after;
    const alt: Record<string, Slot> = {};
    for (const [k, s] of entries(p.heroAlt)) {
      const ok = readSlot(s);
      if (ok) alt[k] = ok;
    }
    if (Object.keys(alt).length) g.heroAlt = alt;
    if (frac(p.phoneCrop)) g.phoneCrop = p.phoneCrop;
    const tr = box4(p.textRect);
    if (tr) g.textRect = tr;
    const items: NonNullable<PageGeometry["items"]> = {};
    for (const [iid, it] of entries(p.items)) {
      const at = point(it);
      if (!at) continue;
      const to = isObj(it) ? point(it.to) : undefined;
      items[iid] = to ? { ...at, to } : at;
    }
    if (Object.keys(items).length) g.items = items;
    const overlays: NonNullable<PageGeometry["overlays"]> = {};
    for (const [oid, o] of entries(p.overlays)) {
      const ok = readOverlay(o);
      if (ok) overlays[oid] = ok;
    }
    if (Object.keys(overlays).length) g.overlays = overlays;
    if (Array.isArray(p.occluders)) {
      const occ: PlateOccluder[] = [];
      for (const o of p.occluders) {
        const b = isObj(o) ? box4(o.box) : undefined;
        if (!b || !isObj(o)) continue;
        occ.push({ box: b, opacity: frac(o.opacity) ? o.opacity : 0.85, feather: frac(o.feather) ? o.feather : 0.012, featherTop: frac(o.featherTop) ? o.featherTop : 0.004 });
      }
      if (occ.length) g.occluders = occ;
    }
    out.pages[id] = g;
  }
  const art: Record<string, string> = {};
  for (const [cid, f] of entries(raw.choiceArt)) {
    if (typeof f === "string" && /^choices\/[A-Za-z0-9_-]{1,64}\.webp$/.test(f)) art[cid] = f;
  }
  if (Object.keys(art).length) out.choiceArt = art;
  return out;
}
