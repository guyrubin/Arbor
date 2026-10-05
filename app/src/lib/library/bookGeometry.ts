/**
 * lib/library/bookGeometry — B-BOOK-06: a book's art geometry as ONE plain
 * object (JSON), owned by the plate author (RULINGS BR6) and overwritable
 * without touching the book's words: per plate the 3:4 window, the text zone
 * and the choice-card focus rects; per page the hero slot, the after-repair
 * slot, the repair item positions and the overlay positions. All numbers are
 * fractions of the master plate.
 *
 * `readGeometry` validates an untrusted JSON value: a bad entry is dropped
 * (never thrown), so a half-finished geometry file still renders a book.
 */
import type { PlateRect } from "./bookPlates";
import type { Slot } from "./types";

export interface PlateGeometry {
  window?: { cx: number };
  textZone?: "inline-start" | "inline-end" | "bottom";
  focus?: Record<string, PlateRect>;
}

export interface PageGeometry {
  hero?: Slot | null;
  heroAfter?: Slot;
  phoneCrop?: number;
  items?: Record<string, { x: number; y: number; to?: { x: number; y: number } }>;
  overlays?: Record<string, { x: number; y: number; scale: number; aspect?: number }>;
}

export interface BookGeometry {
  plates: Record<string, PlateGeometry>;
  pages: Record<string, PageGeometry>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const frac = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const pos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function point(v: unknown): { x: number; y: number } | undefined {
  return isObj(v) && frac(v.x) && frac(v.y) ? { x: v.x, y: v.y } : undefined;
}

function rect(v: unknown): PlateRect | undefined {
  if (!isObj(v) || !frac(v.x) || !frac(v.y) || !frac(v.w) || !frac(v.h)) return undefined;
  return v.w > 0 && v.h > 0 && v.x + v.w <= 1 && v.y + v.h <= 1 ? { x: v.x, y: v.y, w: v.w, h: v.h } : undefined;
}

export function readSlot(v: unknown): Slot | undefined {
  if (!isObj(v) || typeof v.pose !== "string" || !ID.test(v.pose) || !frac(v.x) || !frac(v.y) || !frac(v.scale)) return undefined;
  return {
    pose: v.pose,
    x: v.x,
    y: v.y,
    scale: v.scale,
    facing: v.facing === "left" ? "left" : "right",
    z: v.z === "fg" ? "fg" : "fr",
  };
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
    if (p.hero === null) g.hero = null;
    else {
      const s = readSlot(p.hero);
      if (s) g.hero = s;
    }
    const after = readSlot(p.heroAfter);
    if (after) g.heroAfter = after;
    if (frac(p.phoneCrop)) g.phoneCrop = p.phoneCrop;
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
      const at = point(o);
      if (!at || !isObj(o) || !pos(o.scale)) continue;
      overlays[oid] = { ...at, scale: o.scale, ...(pos(o.aspect) ? { aspect: o.aspect } : {}) };
    }
    if (Object.keys(overlays).length) g.overlays = overlays;
    out.pages[id] = g;
  }
  return out;
}
