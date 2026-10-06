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
export const HERO_SHEET_POSE_IDS = ["idle", "tiptoe", "dash", "freeze-a", "freeze-b", "oops", "cheer", "hold-up"] as const;
export type HeroSheetPoseId = (typeof HERO_SHEET_POSE_IDS)[number];
export const HERO_SHEET_ANCHOR: HeroSheetPoseId = "idle";
export const HERO_SHEET_META_ID = "_meta";
export const HERO_SHEET_VERSION = 1;
export const HERO_SHEET_MODEL = "gemini-2.5-flash-image";
/** Bumped whenever a pose prompt changes (stamped into every response). */
export const HERO_SHEET_PROMPT_VERSION = "hero-pose-2026-10-06";

export const isHeroSheetPose = (v: unknown): v is HeroSheetPoseId =>
  typeof v === "string" && (HERO_SHEET_POSE_IDS as readonly string[]).includes(v);

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
  resting: "hero_sheet_resting",
} as const;
