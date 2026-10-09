/**
 * K2 block 4a — the book sheet's WRITE path (the read path is the owner-checked
 * proxy in server/bookAssets.ts). The parent's device draws the book poses on
 * the one hero pipeline (/api/hero-pose), keys them, uploads each file here and
 * commits; the commit is what makes the book visible to the child.
 *
 *   PUT  /api/children/:childId/book-assets/:bookId/file?path=<rel>[&aspect=&footX=&footW=]
 *        body: the WebP bytes (Content-Type image/webp, <= 300 KB, RIFF/WEBP magic)
 *        rel:  hero-sheets/h-<avatarHash>/<pose>.webp          (a pose of this book; anchors required;
 *                                                              redrawn=1 marks the parent's one Redraw)
 *              hero-sheets/h-<avatarHash>/choices/<choice>.webp (a choice of this book; 4:3)
 *   POST /api/children/:childId/book-assets/:bookId/commit { avatarHash, dryRun? }
 *        lists the hero's folder; every pose the book needs (a pose or its
 *        stopgap, lib/library/bookPoses) must be there; writes
 *        users/{uid}/children/{cid}/bookAssets/{bookId} (the BookAssetsDoc the
 *        reader and useChildLibraryBooks read) and removes an older hero's
 *        sheet folder. dryRun answers { complete, missing, have, committed,
 *        admin } and changes nothing (the builder's resume probe).
 *
 * Refusals (route-tested): no verified caller 401 (fail-closed unless the
 * sandbox's `local`), another family 403 (requireOwnership), Free 403
 * (hero_sheet_plan: the book poses' plan table), an unknown book / a path of
 * any other shape / a pose or choice the book does not have 400, not the
 * child's CURRENT hero 409 (hero_changed / hero_missing / hero_photo_source),
 * not WebP 415, over 300 KB 413, a sprite without valid anchors (or whose
 * aspect is not the file's) 400, an incomplete sheet 409, an admin-uploaded
 * sheet 409 (never replaced). Never a model call.
 */
import express, { type RequestHandler, type Response } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { BOOK_ASSET_ID, bookAssetObject, childBookAssetPrefix, isBookAssetRel, type BookAssetsDoc } from "../lib/library/bookAssetPaths.js";
import { getLibraryBook } from "../lib/library/books/index.js";
import { missingBookPoses } from "../lib/library/bookPoses.js";
import { BOOK_SPRITE_MAX_BYTES, bookSheetChoiceRel, bookSheetId, bookSheetPoseRel, isAvatarHash, isHeroBookSheetId, readSpriteAnchor } from "../lib/library/bookSheet.js";
import { HERO_BOOK_POSE_SETS, heroAvatarHash } from "../lib/heroSheetContract.js";
import type { BookAssetBucket } from "./bookAssets.js";
import type { HeroPoseSource } from "./heroPoseRoute.js";
import type { EntitlementStore } from "./entitlements.js";
import { HERO_BOOK_POSES_BY_PLAN, imagePlanFor } from "./imageQuota.js";
import { logger, requestIdOf } from "./logger.js";

/** The child's book docs (users/{uid}/children/{cid}/bookAssets/{bookId}). */
export interface BookAssetsDocStore {
  read(uid: string, childId: string, bookId: string): Promise<BookAssetsDoc | null>;
  write(uid: string, childId: string, doc: BookAssetsDoc): Promise<void>;
}

/** Firestore (Cloud Run ADC). */
export class FirestoreBookAssetsDocStore implements BookAssetsDocStore {
  private readonly db: Firestore;
  constructor(config: ArborConfig) {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  private ref(uid: string, childId: string, bookId: string) {
    return this.db.doc(`users/${uid}/children/${childId}/bookAssets/${bookId}`);
  }
  async read(uid: string, childId: string, bookId: string): Promise<BookAssetsDoc | null> {
    const snap = await this.ref(uid, childId, bookId).get();
    return snap.exists ? ((snap.data() ?? null) as BookAssetsDoc | null) : null;
  }
  async write(uid: string, childId: string, doc: BookAssetsDoc): Promise<void> {
    await this.ref(uid, childId, doc.bookId).set(doc);
  }
}

/** Sandbox: the device keeps the doc (its local collection); the server only
 *  remembers the last commit per child so a recommit keeps the narration set. */
export class LocalBookAssetsDocStore implements BookAssetsDocStore {
  private readonly docs = new Map<string, BookAssetsDoc>();
  async read(uid: string, childId: string, bookId: string): Promise<BookAssetsDoc | null> {
    return this.docs.get(`${uid}:${childId}:${bookId}`) ?? null;
  }
  async write(uid: string, childId: string, doc: BookAssetsDoc): Promise<void> {
    this.docs.set(`${uid}:${childId}:${doc.bookId}`, doc);
  }
}

export const createBookAssetsDocStore = (config: ArborConfig): BookAssetsDocStore =>
  config.memoryAdapter === "firestore" ? new FirestoreBookAssetsDocStore(config) : new LocalBookAssetsDocStore();

/** RIFF....WEBP */
export function isWebp(buf: Buffer): boolean {
  return buf.length >= 30 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP";
}

/** The canvas size of a WebP (VP8X, VP8L or VP8), or null. */
export function webpSize(buf: Buffer): { w: number; h: number } | null {
  if (!isWebp(buf)) return null;
  const kind = buf.toString("latin1", 12, 16);
  if (kind === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (kind === "VP8L") {
    if (buf[20] !== 0x2f) return null;
    const b = buf.readUInt32LE(21);
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) };
  }
  if (kind === "VP8 ") {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

export interface BookSheetDeps {
  getBucket: () => Promise<BookAssetBucket | null>;
  requireOwnership: RequestHandler;
  heroSource: HeroPoseSource;
  entitlements?: EntitlementStore;
  docs: BookAssetsDocStore;
  /** Sandbox (MEMORY_ADAPTER=local): the unauthenticated local caller may write. */
  local?: boolean;
  now?: () => string;
}

type Refuse = (res: Response, status: number, code: string, error: string, extra?: Record<string, unknown>) => void;
const refuse: Refuse = (res, status, code, error, extra = {}) => {
  res.status(status).json({ error, code, ...extra });
};

export function createBookSheetRouter(deps: BookSheetDeps): express.Router {
  const router = express.Router();
  const now = deps.now ?? (() => new Date().toISOString());
  const uidOf = (req: express.Request) => (req as { user?: { uid?: string } }).user?.uid;
  const verified: RequestHandler = (req, res, next) => {
    const uid = uidOf(req);
    if (deps.local && (!uid || uid === "local-sandbox")) return next();
    if (!uid || uid === "local-sandbox") return refuse(res, 401, "book_sheet_auth", "Unauthorized");
    next();
  };
  /** The plan, the book, the child's current hero: shared by both routes. */
  const gate = async (req: express.Request, res: Response, askedHash: unknown): Promise<{ owner: string; childId: string; bookId: string; avatarHash: string } | null> => {
    const { childId, bookId } = req.params as { childId: string; bookId: string };
    const book = BOOK_ASSET_ID.test(childId) && BOOK_ASSET_ID.test(bookId) ? getLibraryBook(bookId) : undefined;
    if (!book || !Object.prototype.hasOwnProperty.call(HERO_BOOK_POSE_SETS, bookId)) {
      refuse(res, 400, "book_sheet_bad_request", "Unknown book");
      return null;
    }
    const plan = await imagePlanFor(req, deps.entitlements);
    if (!HERO_BOOK_POSES_BY_PLAN[plan].length) {
      refuse(res, 403, "hero_sheet_plan", "Hero poses are part of Plus and Family", { plan });
      return null;
    }
    if (!isAvatarHash(askedHash)) {
      refuse(res, 400, "book_sheet_bad_request", "avatarHash is required");
      return null;
    }
    const owner = uidOf(req) || "local-sandbox";
    if (deps.heroSource.strictHash) {
      const hero = await deps.heroSource.load(owner, childId).catch(() => null);
      if (!hero?.photoUrl || !/^data:image\//i.test(hero.photoUrl)) {
        refuse(res, 409, "hero_missing", "Create the hero first");
        return null;
      }
      if (hero.source !== "descriptor") {
        refuse(res, 409, "hero_photo_source", "Book poses are drawn only for heroes made from a description");
        return null;
      }
      const current = heroAvatarHash(hero.photoUrl);
      if (current !== askedHash) {
        refuse(res, 409, "hero_changed", "This is not the child's current hero", { avatarHash: current });
        return null;
      }
    }
    return { owner, childId, bookId, avatarHash: askedHash };
  };

  router.put(
    "/children/:childId/book-assets/:bookId/file",
    verified,
    deps.requireOwnership,
    express.raw({ type: () => true, limit: "1mb" }),
    async (req, res) => {
      const rel = typeof req.query.path === "string" ? req.query.path : "";
      const m = /^hero-sheets\/h-([0-9a-f]{16})\/(?:choices\/)?([A-Za-z0-9_-]{1,64})\.webp$/.exec(rel);
      if (!m || !isBookAssetRel(rel)) return refuse(res, 400, "book_sheet_bad_path", "Bad book sheet path");
      const g = await gate(req, res, m[1]);
      if (!g) return;
      const book = getLibraryBook(g.bookId)!;
      const sheetId = bookSheetId(g.avatarHash);
      const isChoice = rel === bookSheetChoiceRel(sheetId, m[2]);
      const known = isChoice
        ? book.decision.choices.some((c) => c.id === m[2])
        : (HERO_BOOK_POSE_SETS[g.bookId as keyof typeof HERO_BOOK_POSE_SETS] as readonly string[]).includes(m[2]) && rel === bookSheetPoseRel(sheetId, m[2]);
      if (!known) return refuse(res, 400, "book_sheet_bad_path", "Not a pose or choice of this book");
      const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (type !== "image/webp" || !isWebp(body)) return refuse(res, 415, "book_sheet_not_webp", "WebP only");
      if (body.length > BOOK_SPRITE_MAX_BYTES) return refuse(res, 413, "book_sheet_too_large", "At most 300 KB a file");
      const size = webpSize(body);
      if (!size || size.w < 16 || size.h < 16) return refuse(res, 415, "book_sheet_not_webp", "WebP only");
      let custom: Record<string, string> = {};
      if (!isChoice) {
        const a = readSpriteAnchor({ aspect: req.query.aspect, footX: req.query.footX, footW: req.query.footW });
        if (!a || Math.abs(a.aspect - size.w / size.h) > 0.02) return refuse(res, 400, "book_sheet_bad_anchor", "A sprite needs its measured anchors");
        custom = { aspect: String(a.aspect), footX: String(a.footX), footW: String(a.footW), ...(req.query.redrawn === "1" ? { redrawn: "1" } : {}) };
      }
      try {
        const bucket = await deps.getBucket();
        const file = bucket?.file(bookAssetObject(g.childId, g.bookId, rel));
        if (!file?.save) return refuse(res, 503, "book_storage_unavailable", "Book storage is not available");
        await file.save(body, { contentType: "image/webp", resumable: false, metadata: { cacheControl: "private, max-age=86400", metadata: custom } });
        res.json({ ok: true, path: rel, bytes: body.length });
      } catch (error: unknown) {
        logger.error("Book sheet upload error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
        refuse(res, 500, "book_sheet_upload_failed", "Failed to store the file");
      }
    },
  );

  router.post("/children/:childId/book-assets/:bookId/commit", verified, deps.requireOwnership, async (req, res) => {
    const body = (req.body ?? {}) as { avatarHash?: unknown; dryRun?: unknown };
    const g = await gate(req, res, body.avatarHash);
    if (!g) return;
    const book = getLibraryBook(g.bookId)!;
    const sheetId = bookSheetId(g.avatarHash);
    try {
      const bucket = await deps.getBucket();
      if (!bucket) return refuse(res, 503, "book_storage_unavailable", "Book storage is not available");
      const prefix = `${childBookAssetPrefix(g.childId)}${g.bookId}/`;
      const [listed] = await bucket.getFiles({ prefix });
      const byRel = new Map(listed.map((f) => [f.name.slice(prefix.length), f] as const).filter(([rel]) => isBookAssetRel(rel)));
      const poses: BookAssetsDoc["sheetManifest"]["poses"] = {};
      for (const pose of HERO_BOOK_POSE_SETS[g.bookId as keyof typeof HERO_BOOK_POSE_SETS]) {
        const f = byRel.get(bookSheetPoseRel(sheetId, pose));
        const a = f ? readSpriteAnchor(f.metadata?.metadata ?? null) : null;
        if (a) poses[pose] = { file: `${pose}.webp`, ...a, ...(f?.metadata?.metadata?.redrawn === "1" ? { redrawn: true } : {}) };
      }
      const missing = missingBookPoses(book, Object.keys(poses));
      const have = [...byRel.keys()].filter((rel) => rel.startsWith(`hero-sheets/${sheetId}/`)).sort();
      const existing = await deps.docs.read(g.owner, g.childId, g.bookId).catch(() => null);
      const admin = !!existing?.sheetId && !isHeroBookSheetId(existing.sheetId);
      if (body.dryRun === true) {
        // committed: the book already shows THIS hero; admin: an uploaded sheet the pipeline never replaces
        return void res.json({ complete: missing.length === 0, missing, have, committed: existing?.sheetId === sheetId, admin });
      }
      if (missing.length) return refuse(res, 409, "book_sheet_incomplete", "The sheet is not complete", { missing, have });
      if (admin) return refuse(res, 409, "book_sheet_admin", "This book has an uploaded sheet");
      const choices: Record<string, string> = {};
      for (const c of book.decision.choices) if (byRel.has(bookSheetChoiceRel(sheetId, c.id))) choices[c.id] = `choices/${c.id}.webp`;
      // The child's narration set (Block 2) stays with the book across a recommit.
      const setId = existing?.setId && BOOK_ASSET_ID.test(existing.setId) ? existing.setId : "none";
      const files = [
        ...Object.values(poses).map((p) => `hero-sheets/${sheetId}/${p.file}`),
        ...Object.values(choices).map((f) => `hero-sheets/${sheetId}/${f}`),
        ...[...byRel.keys()].filter((rel) => rel.startsWith(`narration/${setId}/`)),
      ].sort();
      const bytes = files.reduce((n, rel) => n + (Number(byRel.get(rel)?.metadata?.size) || 0), 0);
      const doc: BookAssetsDoc = {
        id: g.bookId,
        bookId: g.bookId,
        sheetId,
        setId,
        sets: [setId],
        sheetManifest: { poses, ...(Object.keys(choices).length ? { choices } : {}) },
        files,
        bytes,
        createdAt: now(),
      };
      await deps.docs.write(g.owner, g.childId, doc);
      // An older hero's sheet goes once the new one is the book's.
      const stale = listed.filter((f) => {
        const rel = f.name.slice(prefix.length);
        return rel.startsWith("hero-sheets/") && !rel.startsWith(`hero-sheets/${sheetId}/`) && isHeroBookSheetId(rel.split("/")[1]);
      });
      await Promise.all(stale.map((f) => f.delete().catch(() => undefined)));
      res.json({ ok: true, doc, removed: stale.length, ...(deps.local ? { local: true } : {}) });
    } catch (error: unknown) {
      logger.error("Book sheet commit error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      refuse(res, 500, "book_sheet_commit_failed", "Failed to commit the sheet");
    }
  });

  return router;
}
