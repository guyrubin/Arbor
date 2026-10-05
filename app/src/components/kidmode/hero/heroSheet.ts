/**
 * heroSheet — B-GAME-05 (lane B §D contract, adapted by ruling G4): the
 * child's hero as a set of camera-facing pose sprites, moved in code.
 *
 * Eight proof poses (G4): idle, tiptoe, dash, freeze-a, freeze-b, oops,
 * cheer, hold-up. Each sprite carries its FOOT anchor (sprite px), so a pose
 * swap never moves the feet. A missing pose resolves through FALLBACK, then
 * idle, then any pose present: a figure never renders empty.
 *
 * Source for the proof, first found wins: the local-only file
 * `/_proof/hero/sheet.json` (proofAssets.ts; read by the game while its flag
 * is on; sprite urls relative to that folder), then a sheet injected on the
 * sandbox at local-storage key `arbor.heroSheet.<childId>` (JSON of
 * HeroSheet; sprite urls may be data urls). Otherwise the built-in DEV PLACEHOLDER (devPlaceholderSheet.ts) —
 * scaffolding for the orchestrator's checks, never shown to the owner.
 * Likeness art never enters git (public/_proof/ is excluded and guarded).
 */
import { PROOF_HERO_SHEET_URL, fetchProofJson } from "../proofAssets";


export type HeroPoseId = "idle" | "tiptoe" | "dash" | "freeze-a" | "freeze-b" | "oops" | "cheer" | "hold-up";

export const HERO_POSES: readonly HeroPoseId[] = ["idle", "tiptoe", "dash", "freeze-a", "freeze-b", "oops", "cheer", "hold-up"];

export interface HeroSprite {
  /** data:image/webp|png|svg+xml, or a sandbox-served url. */
  url: string;
  /** Intrinsic sprite size, px. */
  w: number;
  h: number;
  /** Where the feet touch the ground, sprite px. */
  foot: { x: number; y: number };
  /** Head centre + radius, sprite px (close-ups, face checks). */
  head?: { x: number; y: number; r: number };
  /** Hand points, sprite px (hold-up carries the prize here). */
  hand?: { l?: [number, number]; r?: [number, number] };
  /** Optional size factor for this pose (a sheet whose poses were cut at
   *  different figure heights): multiplies the drawn size; the feet stay put. */
  scale?: number;
}

export type HeroSheetSource = "generated" | "stock" | "proof" | "dev-placeholder";

export interface HeroSheet {
  v: 1;
  heroId: string;
  source: HeroSheetSource;
  theme: "film3d";
  createdAt?: string;
  poses: Partial<Record<HeroPoseId, HeroSprite>>;
}

/** The proof sheet file, parsed (null when absent or malformed). */
export async function loadProofHeroSheet(fetcher?: Parameters<typeof fetchProofJson>[1]): Promise<HeroSheet | null> {
  const raw = await fetchProofJson(PROOF_HERO_SHEET_URL, fetcher);
  const sheet = raw ? parseHeroSheet(raw) : null;
  return sheet ? { ...sheet, source: "proof" } : null;
}

/** Missing pose -> the next pose to try (then idle, then anything present). */
export const FALLBACK: Readonly<Record<HeroPoseId, readonly HeroPoseId[]>> = {
  idle: [],
  tiptoe: ["idle"],
  dash: ["tiptoe", "idle"],
  "freeze-a": ["freeze-b", "idle"],
  "freeze-b": ["freeze-a", "idle"],
  oops: ["idle"],
  cheer: ["hold-up", "idle"],
  "hold-up": ["cheer", "idle"],
};

/** The sprite to draw for `pose`, following the fallback map; null only for
 *  a sheet with no usable pose at all. */
export function resolvePose(sheet: HeroSheet | null | undefined, pose: HeroPoseId): { pose: HeroPoseId; sprite: HeroSprite } | null {
  if (!sheet) return null;
  const chain: HeroPoseId[] = [pose, ...FALLBACK[pose], "idle", ...HERO_POSES];
  for (const p of chain) {
    const sprite = sheet.poses[p];
    if (sprite) return { pose: p, sprite };
  }
  return null;
}

/** The reference height every pose scales against (idle, else the first). */
export function referenceSprite(sheet: HeroSheet): HeroSprite | null {
  return resolvePose(sheet, "idle")?.sprite ?? null;
}

/** Sprite px -> parent units for one pose: `height` is the reference (idle)
 *  sprite's height, times the pose's own `scale` when the sheet gives one. */
export function poseFactor(sheet: HeroSheet, sprite: HeroSprite, height: number): number {
  const ref = referenceSprite(sheet);
  return ref ? (height / ref.h) * (sprite.scale ?? 1) : 1;
}

/** Where a held prize sits, in parent units relative to the feet: the
 *  midpoint of the hand anchors (one hand: that hand), else just above the
 *  head box, else above the sprite. */
export function carryPoint(sprite: HeroSprite, k: number, size: number): { x: number; y: number } {
  const { l, r } = sprite.hand ?? {};
  const rel = (x: number, y: number) => ({ x: (x - sprite.foot.x) * k, y: (y - sprite.foot.y) * k });
  if (l && r) return rel((l[0] + r[0]) / 2, (l[1] + r[1]) / 2);
  if (l || r) { const h = (l ?? r) as [number, number]; return rel(h[0], h[1]); }
  if (sprite.head) { const p = rel(sprite.head.x, sprite.head.y - sprite.head.r); return { x: p.x, y: p.y - size * 0.55 }; }
  const p = rel(sprite.w / 2, 0);
  return { x: p.x, y: p.y - size * 0.55 };
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseSprite(raw: unknown): HeroSprite | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const foot = r.foot as Record<string, unknown> | undefined;
  if (typeof r.url !== "string" || !r.url || !num(r.w) || !num(r.h) || r.w <= 0 || r.h <= 0) return null;
  if (!foot || !num(foot.x) || !num(foot.y)) return null;
  // Only image data urls or http(s)/relative urls; never javascript: or anything else.
  if (!/^(data:image\/(png|webp|jpeg|svg\+xml)[;,]|https?:\/\/|\/)/.test(r.url)) return null;
  const sprite: HeroSprite = { url: r.url, w: r.w, h: r.h, foot: { x: foot.x, y: foot.y } };
  if (num(r.scale) && r.scale > 0.2 && r.scale < 5) sprite.scale = r.scale;
  const head = r.head as Record<string, unknown> | undefined;
  if (head && num(head.x) && num(head.y) && num(head.r)) sprite.head = { x: head.x, y: head.y, r: head.r };
  const hand = r.hand as Record<string, unknown> | undefined;
  if (hand) {
    const pt = (v: unknown): [number, number] | undefined => (Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]) ? [v[0], v[1]] : undefined);
    const l = pt(hand.l);
    const rr = pt(hand.r);
    if (l || rr) sprite.hand = { ...(l ? { l } : {}), ...(rr ? { r: rr } : {}) };
  }
  return sprite;
}

/** Validate an injected sheet; anything malformed is null (the caller falls back). */
export function parseHeroSheet(raw: unknown): HeroSheet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !r.poses || typeof r.poses !== "object") return null;
  const poses: Partial<Record<HeroPoseId, HeroSprite>> = {};
  for (const p of HERO_POSES) {
    const s = parseSprite((r.poses as Record<string, unknown>)[p]);
    if (s) poses[p] = s;
  }
  if (Object.keys(poses).length === 0) return null;
  const source: HeroSheetSource = r.source === "generated" || r.source === "stock" || r.source === "dev-placeholder" ? r.source : "proof";
  return {
    v: 1,
    heroId: typeof r.heroId === "string" ? r.heroId : "proof",
    source,
    theme: "film3d",
    ...(typeof r.createdAt === "string" ? { createdAt: r.createdAt } : {}),
    poses,
  };
}

/** The device-local key a proof sheet is injected at (child-scoped: swept by
 *  clearChildLocalState with the child's other local rows). */
export function heroSheetKey(childId: string): string {
  return `arbor.heroSheet.${childId}`;
}

export function readStoredHeroSheet(childId: string, storage?: Pick<Storage, "getItem"> | null): HeroSheet | null {
  if (!childId) return null;
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    const raw = store?.getItem(heroSheetKey(childId));
    return raw ? parseHeroSheet(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
