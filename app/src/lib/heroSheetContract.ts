/**
 * heroSheetContract — B-GAME-13: what the client builder, the server pose
 * route and the child record agree on. Pure (no React, no Firebase): imported
 * by `server/heroPoseRoute.ts` and by `components/kidmode/hero/*`.
 *
 * Storage (one doc per pose, far under Firestore's 1 MB):
 *   users/{uid}/children/{cid}/heroSheet/{poseId}   HeroSheetPoseDoc
 *   users/{uid}/children/{cid}/heroSheet/_meta      HeroSheetMetaDoc
 * Sandbox (no Firebase): the same docs as one array at the device key
 * `arbor.heroSheet.<cid>` (the useChildCollection local shape).
 * Registered in CHILD_SUBCOLLECTIONS: export + erase cover it.
 * Generated art only — never a photo; the child's name is never in it.
 */

/** The eight game poses (ruling G4), the anchor first. */
import { PLAN_POSES, type PlanPose } from "./library/plans/planPoses.js";
export const HERO_SHEET_POSE_IDS = ["idle", "tiptoe", "dash", "freeze-a", "freeze-b", "oops", "cheer", "hold-up"] as const;
export type HeroSheetPoseId = (typeof HERO_SHEET_POSE_IDS)[number];
export const HERO_SHEET_ANCHOR: HeroSheetPoseId = "idle";
export const HERO_SHEET_META_ID = "_meta";
export const HERO_SHEET_VERSION = 1;
export const HERO_SHEET_MODEL = "gemini-2.5-flash-image";
/** Bumped whenever a pose prompt changes (stamped into every response).
 *  2026-10-09 (K2): the book poses' prompts were added; the game's eight are
 *  byte-identical (pinned in server/heroPosePrompts.test.ts). */
export const HERO_SHEET_PROMPT_VERSION = "hero-pose-2026-10-09";

export const isHeroSheetPose = (v: unknown): v is HeroSheetPoseId =>
  typeof v === "string" && (HERO_SHEET_POSE_IDS as readonly string[]).includes(v);

/* ── K2: the BOOK poses, on the ONE hero pipeline ─────────────────────────────
 * A book's poses are drawn by the same route, the same SPRITE_STYLE / REFS /
 * HERO prompt blocks and the same per-sheet allowance as the game's eight,
 * always anchored on the child's approved game `idle` (image 1) — so the hero
 * of the book IS the hero of the game. Pose ids are one global, open set
 * (RULINGS ruling 2): a book names a pose, the sheet resolves it; they never
 * collide with the game's ids (tested). Five Smooth Stones: the 18 poses its
 * pages, repair ends, costume slot and art states name (lib/library/bookPoses
 * bookPoseIds — pinned by test). No caller yet. */
export const HERO_BOOK_POSE_SETS = {
  "five-smooth-stones": [
    "armour-stuck", "free-stretch", "look-across", "look-up", "look-up-unsure", "run-staff", "run-staff-left", "sit", "sit-hunched",
    "sling-release", "sling-swing", "sling-swing-face-right", "squat-stones", "stand-tall", "stand-tall-hand", "walk-bread", "worried", "worried-tunic",
  ],
} as const;
export type HeroBookPoseId = (typeof HERO_BOOK_POSE_SETS)[keyof typeof HERO_BOOK_POSE_SETS][number];
/** Every book pose id (all books), once. */
export const HERO_BOOK_POSE_IDS: readonly HeroBookPoseId[] = [...new Set(Object.values(HERO_BOOK_POSE_SETS).flatMap((set) => [...set]))];
export const isHeroBookPose = (v: unknown): v is HeroBookPoseId =>
  typeof v === "string" && (HERO_BOOK_POSE_IDS as readonly string[]).includes(v);
/* ── B-BOOK-75 follow-up: the child's ONE shared PLAN sheet (bookAssets/plan-poses).
 * The route draws the twelve shared plan poses under a `plan-` prefix so a plan
 * pose never collides with a book pose of the same name ("stand-tall" is David
 * in armour in five-smooth-stones and the hero in their own clothes here); the
 * sheet's files and manifest keep the bare plan pose id the plan books name. */
export const PLAN_ROUTE_PREFIX = "plan-";
export type HeroPlanPoseId = `${typeof PLAN_ROUTE_PREFIX}${PlanPose}`;
export const HERO_PLAN_POSE_IDS: readonly HeroPlanPoseId[] = PLAN_POSES.map((p) => `${PLAN_ROUTE_PREFIX}${p}` as HeroPlanPoseId);
export const isHeroPlanPose = (v: unknown): v is HeroPlanPoseId =>
  typeof v === "string" && (HERO_PLAN_POSE_IDS as readonly string[]).includes(v);
/** The route pose of a plan pose, and back. */
export const planRoutePose = (pose: PlanPose): HeroPlanPoseId => `${PLAN_ROUTE_PREFIX}${pose}`;
export const planPoseOfRoute = (id: HeroPlanPoseId): PlanPose => id.slice(PLAN_ROUTE_PREFIX.length) as PlanPose;

/** A pose the route draws: a game pose, a book pose or a plan pose. */
export type HeroPoseId = HeroSheetPoseId | HeroBookPoseId | HeroPlanPoseId;
export const isHeroPose = (v: unknown): v is HeroPoseId => isHeroSheetPose(v) || isHeroBookPose(v) || isHeroPlanPose(v);

export interface HeroSheetPoseDoc {
  id: HeroSheetPoseId;
  v: 1;
  pose: HeroSheetPoseId;
  /** data:image/webp (or image/png where the device cannot encode WebP), alpha. */
  dataUrl: string;
  w: number;
  h: number;
  foot: { x: number; y: number };
  head: { x: number; y: number; r: number };
  hand?: { l?: [number, number]; r?: [number, number] };
  /** Residual draw factor (1 unless the resample was capped). */
  scale: number;
  avatarHash: string;
  model: string;
  keyColour: string;
  createdAt: string;
  /** idle only: the approved idle on its flat key colour (small JPEG) — the
   *  server's image 1 for the other seven poses. */
  anchor?: string;
  /** B-GAME-14: the parent's verdict ("ok") and whether the one redraw is spent. */
  review?: "ok";
  redrawn?: boolean;
}

export type HeroSheetStatus = "building" | "complete" | "stopped";

export interface HeroSheetMetaDoc {
  id: typeof HERO_SHEET_META_ID;
  v: 1;
  heroId: string;
  source: "generated";
  avatarHash: string;
  /** Poses stored so far (in order). */
  poses: HeroSheetPoseId[];
  status: HeroSheetStatus;
  /** Why a build stopped (a refusal code), for the parent line only. */
  stoppedBy?: string;
  updatedAt: string;
}

/**
 * Hash of the stored hero (the child's `photoUrl` data URL): 64 bits, hex.
 * Not cryptographic — it names a hero so a new hero makes the old sheet stale.
 * The same function runs on the server and the device.
 */
export function heroAvatarHash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** The refusal codes the route answers with (the builder reads them). */
export const HERO_POSE_REFUSALS = {
  upload: "hero_pose_no_upload",
  auth: "hero_pose_auth",
  plan: "hero_sheet_plan",
  missing: "hero_missing",
  photo: "hero_photo_source",
  changed: "hero_changed",
  anchor: "hero_anchor_missing",
  /** K2: a book pose asked before the child's approved game idle exists. */
  bookAnchor: "hero_book_anchor_missing",
  resting: "hero_sheet_resting",
} as const;

/** The sheet of a stock hero (B-GAME-15), same HeroSheet shape. The art path
 *  lives here, outside the kid components (B-KID-70 (c): art by manifest/lib). */
export const stockHeroSheetUrl = (id: string) => `/visuals/heroes/${id}/sheet.json`;
