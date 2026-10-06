/**
 * B-GAME-13b — POST /api/hero-pose { childId, pose, avatarHash? }
 *
 * Draws ONE pose of the child's hero sheet on a flat chroma green and returns
 * it as a data URL; the parent's device keys it (components/kidmode/hero/
 * heroKeyer.ts), runs the QA gate and stores it in the child's record.
 *
 * Safety (contract-tested in heroPoseRoute.test.ts):
 *  - the body carries ids only: any image or data URL in it is refused — the
 *    server reads the child's STORED hero itself (HeroPoseSource);
 *  - the stored hero must be a generated one made from text cues
 *    (`avatar.source === "descriptor"`, a `data:image/` URL); a hero styled
 *    from a reference photo is refused, a raw photo URL is refused;
 *  - the prompt is fixed template text (heroPosePrompts.ts): no name, no free
 *    text, nothing from the body but the pose id;
 *  - in Firestore mode a verified uid is required (the record path is the
 *    caller's own `users/{uid}`); requireOwnership guards the child id.
 * Order: `idle` first (the anchor); every other pose needs the approved idle,
 * stored by the device on the idle doc (`anchor`), as image 1.
 * Allowance: imageQuota.chargeHeroSheetCall — its own counters and breaker,
 * never the scene buckets; Free gets no sheet unless HERO_SHEET_POSES_BY_PLAN
 * says so (GD-5).
 */
import type { Request, RequestHandler, Response } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import type { GeneratedImage } from "../ai/modelRouter.js";
import type { UsageCounterStore } from "./quotaStore.js";
import type { EntitlementStore } from "./entitlements.js";
import { HERO_SHEET_POSES_BY_PLAN, chargeHeroSheetCall, imagePlanFor } from "./imageQuota.js";
import { heroPosePrompt } from "./heroPosePrompts.js";
import {
  HERO_POSE_REFUSALS,
  HERO_SHEET_MODEL,
  HERO_SHEET_PROMPT_VERSION,
  heroAvatarHash,
  isHeroSheetPose,
  type HeroSheetPoseId,
} from "../lib/heroSheetContract.js";

/** The flat background every pose is asked for (heroPosePrompts BACKGROUND;
 *  the device's keyer samples the real one from the border). */
export const HERO_SHEET_KEY_COLOUR = "#00B140";

/** What the server knows about the child's hero, read from the child record. */
export interface StoredHero {
  /** The child's `photoUrl` (a generated hero is an inline data:image URL). */
  photoUrl: string | null;
  /** `avatar.source` — "descriptor" (text cues) or "photo" (photo-styled). */
  source: string | null;
  /** The approved idle on its key colour (heroSheet/idle `anchor`), if stored. */
  anchor: string | null;
}

export interface HeroPoseSource {
  load(uid: string, childId: string): Promise<StoredHero | null>;
  /** False where the record the server reads is not the device's copy byte for
   *  byte (local sandbox), so a client hash cannot be compared. */
  readonly strictHash: boolean;
  /** Local sandbox only: remember an image THIS server generated. */
  remember?(uid: string, childId: string, entry: { hero?: { dataUrl: string; source: string }; anchor?: string }): void;
}

/** Firestore (Cloud Run ADC): users/{uid}/children/{childId} + heroSheet/idle. */
export class FirestoreHeroPoseSource implements HeroPoseSource {
  readonly strictHash = true;
  private readonly db: Firestore;
  constructor(config: ArborConfig) {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  async load(uid: string, childId: string): Promise<StoredHero | null> {
    const childRef = this.db.doc(`users/${uid}/children/${childId}`);
    const [child, idle] = await Promise.all([childRef.get(), childRef.collection("heroSheet").doc("idle").get()]);
    if (!child.exists) return null;
    const data = child.data() ?? {};
    const avatar = (data.avatar ?? {}) as { source?: unknown };
    const idleData = idle.exists ? (idle.data() ?? {}) : {};
    return {
      photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : null,
      source: typeof avatar.source === "string" ? avatar.source : null,
      anchor: typeof idleData.anchor === "string" ? idleData.anchor : null,
    };
  }
}

/**
 * Local sandbox: the child record lives in the browser, so the server keeps
 * the heroes IT generated (/generate-avatar with a childId) and the last idle
 * it drew — never an image a client sent.
 */
export class LocalHeroPoseSource implements HeroPoseSource {
  readonly strictHash = false;
  private readonly heroes = new Map<string, { dataUrl: string; source: string }>();
  private readonly anchors = new Map<string, string>();
  async load(uid: string, childId: string): Promise<StoredHero | null> {
    const hero = this.heroes.get(`${uid}:${childId}`);
    if (!hero) return null;
    return { photoUrl: hero.dataUrl, source: hero.source, anchor: this.anchors.get(`${uid}:${childId}`) ?? null };
  }
  remember(uid: string, childId: string, entry: { hero?: { dataUrl: string; source: string }; anchor?: string }): void {
    const key = `${uid}:${childId}`;
    if (entry.hero) {
      this.heroes.set(key, entry.hero);
      this.anchors.delete(key); // a new hero: the old idle is not its anchor
      if (this.heroes.size > 200) this.heroes.delete(this.heroes.keys().next().value as string);
    }
    if (entry.anchor) this.anchors.set(key, entry.anchor);
  }
}

export const createHeroPoseSource = (config: ArborConfig): HeroPoseSource =>
  config.memoryAdapter === "firestore" ? new FirestoreHeroPoseSource(config) : new LocalHeroPoseSource();

/** Body keys that would carry an image. Any of them = refused. */
const IMAGE_KEYS = ["photo", "image", "images", "dataUrl", "avatar", "reference", "refs", "anchor", "hero"];

const parseDataUrl = (url: string): { mimeType: string; data: string } | null => {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(url);
  return m ? { mimeType: m[1], data: m[2] } : null;
};

export interface HeroPoseDeps {
  source: HeroPoseSource;
  counters: UsageCounterStore;
  entitlements?: EntitlementStore;
  /** True when the server reads the child record from Firestore (auth needed). */
  requireUid: boolean;
  /** The image call (api.ts wires the route budget and the provider). */
  generate: (req: Request, res: Response, input: { prompt: string; images: { mimeType: string; data: string }[]; pose: HeroSheetPoseId }) => Promise<GeneratedImage>;
  /** Maps a provider failure to the response (api.ts sendImageFailure). */
  fail: (res: Response, error: unknown) => void;
}

export function createHeroPoseHandler(deps: HeroPoseDeps): RequestHandler {
  return async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const refuse = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => {
      res.status(status).json({ error, code, ...extra });
    };
    // 1. Ids only: the hero is read from the record, never taken from the body.
    const carriesImage = IMAGE_KEYS.some((k) => k in body)
      || Object.values(body).some((v) => typeof v === "string" && /^data:/i.test(v.trim()));
    if (carriesImage) return refuse(400, HERO_POSE_REFUSALS.upload, "Hero poses are drawn from the stored hero only");
    const uid = (req as unknown as { user?: { uid?: string } }).user?.uid;
    if (deps.requireUid && !uid) return refuse(401, HERO_POSE_REFUSALS.auth, "Sign in to draw hero poses");
    const childId = typeof body.childId === "string" ? body.childId.trim() : "";
    const pose = body.pose;
    if (!childId || childId.length > 128 || !isHeroSheetPose(pose)) return refuse(400, "hero_pose_bad_request", "childId and a pose are required");

    // 2. The plan's pose set (GD-5: Free = none by default).
    const plan = await imagePlanFor(req, deps.entitlements);
    if (!HERO_SHEET_POSES_BY_PLAN[plan].includes(pose)) return refuse(403, HERO_POSE_REFUSALS.plan, "Hero poses are part of Plus and Family", { plan });

    // 3. The stored hero: generated from text cues, inline.
    const owner = uid || "local-sandbox";
    let hero: StoredHero | null = null;
    try {
      hero = await deps.source.load(owner, childId);
    } catch {
      hero = null;
    }
    if (!hero?.photoUrl || !/^data:image\//i.test(hero.photoUrl)) return refuse(409, HERO_POSE_REFUSALS.missing, "Create the hero first");
    if (hero.source !== "descriptor") return refuse(409, HERO_POSE_REFUSALS.photo, "This hero was made from a photo; poses are drawn only for heroes made from a description");
    const stored = parseDataUrl(hero.photoUrl);
    if (!stored) return refuse(409, HERO_POSE_REFUSALS.missing, "Create the hero first");
    const storedHash = heroAvatarHash(hero.photoUrl);
    const asked = typeof body.avatarHash === "string" ? body.avatarHash : "";
    if (deps.source.strictHash && asked && asked !== storedHash) {
      return refuse(409, HERO_POSE_REFUSALS.changed, "The hero is not saved yet", { avatarHash: storedHash });
    }
    const avatarHash = deps.source.strictHash ? storedHash : asked || storedHash;
    const images = [stored];
    if (pose !== "idle") {
      const anchor = hero.anchor ? parseDataUrl(hero.anchor) : null;
      if (!anchor) return refuse(409, HERO_POSE_REFUSALS.anchor, "The first pose is not ready yet");
      images.unshift(anchor);
    }

    // 4. The sheet allowance (own counters + breaker; never the scene buckets).
    const charge = await chargeHeroSheetCall(deps.counters, { plan, uid: owner, childId, avatarHash });
    if (!charge.ok) { res.status(charge.status).json(charge.body); return; }

    // 5. One image call; a failure gives the per-sheet call unit back.
    try {
      const image = await deps.generate(req, res, { prompt: heroPosePrompt(pose), images, pose });
      if (res.headersSent) return;
      const dataUrl = `data:${image.mimeType};base64,${image.data}`;
      // Sandbox: the idle THIS server drew is the next poses' image 1.
      if (pose === "idle" && !deps.source.strictHash) deps.source.remember?.(owner, childId, { anchor: dataUrl });
      res.json({
        pose,
        dataUrl,
        avatarHash,
        model: HERO_SHEET_MODEL,
        keyColour: HERO_SHEET_KEY_COLOUR,
        promptVersion: HERO_SHEET_PROMPT_VERSION,
        newSheet: charge.newSheet,
      });
    } catch (error) {
      await charge.release().catch(() => undefined);
      if (res.headersSent) return;
      deps.fail(res, error);
    }
  };
}
