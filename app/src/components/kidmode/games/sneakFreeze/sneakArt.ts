/**
 * Sneak & Freeze art slots — B-GAME-07b.
 *
 * The game draws five kinds of art, each a slot with an anchor:
 *   plate      Savta's courtyard, one per orientation, painted PLATE_BLEED
 *              beyond the design space (landscape 2240x1260 = 1600x900 + 20 %
 *              each side; portrait 1260x2240). No character in it.
 *   watcher    the cat on its stool. The screen is the wall the cat counts
 *              against (ruling, B-GAME-07c):
 *                counting   FACES THE VIEWER, paws over its eyes, chanting
 *                tell       faces the viewer, paws still over its eyes, ears up
 *                looking    turned round: seen FROM BEHIND, peering into the
 *                           courtyard (no face)
 *                laughing   faces the viewer, laughing
 *                sunglasses turned round like `looking` — seen FROM BEHIND —
 *                           wearing big sunglasses: it cannot see. Used ONLY
 *                           while it looks in a sunglasses round; that round's
 *                           counting / tell / laughing use the normal sprites
 *                           (B-GAME-07d)
 *                waiting    (optional) faces the viewer, sitting down
 *              Anchor = where the stool's legs meet the floor.
 *   covers     lemon-tree, bench, lantern. Anchor = base centre on the floor.
 *   prizes     lemon, wool, bell. Anchor = centre.
 *   tile       the home tile (handled by the home grid; not here).
 *
 * Source for the proof, first found wins slot by slot: the local-only file
 * `/_proof/scene/art.json` (proofAssets.ts; flag on only), then JSON
 * injected at local-storage key `arbor.sneakFreeze.art` (a Partial<SneakArt>),
 * then devPlaceholderArt() — TEMPORARY authored SVGs, never shown to the owner.
 */
import type { PrizeId, WatcherPose } from "./rules";
import type { CoverId, FieldOrientation } from "../../game/fieldLayout";
import { devPlaceholderArt } from "./devPlaceholderArt";
import { PROOF_SCENE_ART_URL, fetchProofJson } from "../../proofAssets";

export interface ArtSprite {
  url: string;
  /** Intrinsic size, px. */
  w: number;
  h: number;
  /** Anchor, sprite px (feet / base centre / centre — see the slot). */
  anchor: { x: number; y: number };
}

export type WatcherSlot = WatcherPose | "sunglasses";

export interface SneakArt {
  source: "proof" | "injected" | "dev-placeholder";
  plate: Record<FieldOrientation, string>;
  watcher: Partial<Record<WatcherSlot, ArtSprite>> & { counting: ArtSprite };
  covers: Record<CoverId, ArtSprite>;
  prizes: Record<PrizeId, ArtSprite>;
}

export const SNEAK_ART_KEY = "arbor.sneakFreeze.art";

const URL_OK = /^(data:image\/(png|webp|jpeg|svg\+xml)[;,]|https?:\/\/|\/)/;

function sprite(raw: unknown): ArtSprite | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const a = r.anchor as Record<string, unknown> | undefined;
  const n = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (typeof r.url !== "string" || !URL_OK.test(r.url) || !n(r.w) || !n(r.h) || r.w <= 0 || r.h <= 0 || !a || !n(a.x) || !n(a.y)) return null;
  return { url: r.url, w: r.w, h: r.h, anchor: { x: a.x, y: a.y } };
}

/** Merge an injected art JSON over the placeholders (slot by slot; bad slots ignored). */
export function mergeArt(base: SneakArt, raw: unknown, source: "proof" | "injected" = "injected"): SneakArt {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const out: SneakArt = { ...base, plate: { ...base.plate }, watcher: { ...base.watcher }, covers: { ...base.covers }, prizes: { ...base.prizes } };
  let any = false;
  const plate = r.plate as Record<string, unknown> | undefined;
  for (const o of ["landscape", "portrait"] as const) {
    const u = plate?.[o];
    if (typeof u === "string" && URL_OK.test(u)) { out.plate[o] = u; any = true; }
  }
  for (const group of ["watcher", "covers", "prizes"] as const) {
    const g = r[group] as Record<string, unknown> | undefined;
    if (!g || typeof g !== "object") continue;
    for (const [k, v] of Object.entries(g)) {
      if (!(k in (base[group] as object)) && group !== "watcher") continue;
      const s = sprite(v);
      if (s) { (out[group] as Record<string, ArtSprite>)[k] = s; any = true; }
    }
  }
  return any ? { ...out, source } : base;
}

/** The proof art file (urls resolved against its folder) merged over `base`;
 *  `base` unchanged when the file is absent or has no usable slot. */
export async function loadProofArt(base: SneakArt, fetcher?: Parameters<typeof fetchProofJson>[1]): Promise<SneakArt> {
  const raw = await fetchProofJson(PROOF_SCENE_ART_URL, fetcher);
  return raw ? mergeArt(base, raw, "proof") : base;
}

/** Every image url the scene draws (for preloading). */
export function artUrls(art: SneakArt): string[] {
  return [
    art.plate.landscape,
    art.plate.portrait,
    ...Object.values(art.watcher).map((s) => s?.url ?? ""),
    ...Object.values(art.covers).map((s) => s.url),
    ...Object.values(art.prizes).map((s) => s.url),
  ].filter((u) => !!u && !u.startsWith("data:"));
}

export function readSneakArt(storage?: Pick<Storage, "getItem"> | null): SneakArt {
  const base = devPlaceholderArt();
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    const raw = store?.getItem(SNEAK_ART_KEY);
    return raw ? mergeArt(base, JSON.parse(raw)) : base;
  } catch {
    return base;
  }
}

/** The watcher sprite for a pose: the sunglasses sprite (the cat from behind
 *  in sunglasses) only while it LOOKS in a sunglasses round; missing -> the
 *  pose's own sprite, then counting. */
export function watcherSprite(art: SneakArt, pose: WatcherPose, sunglasses: boolean): { slot: WatcherSlot; sprite: ArtSprite } {
  const want: WatcherSlot = sunglasses && pose === "looking" ? "sunglasses" : pose;
  const s = art.watcher[want];
  if (s) return { slot: want, sprite: s };
  const fallback: WatcherSlot = want === "waiting" ? "counting" : want === "sunglasses" ? (pose === "looking" ? "looking" : "counting") : "counting";
  return { slot: fallback, sprite: art.watcher[fallback] ?? art.watcher.counting };
}
