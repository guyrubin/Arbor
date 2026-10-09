import express, { type RequestHandler } from "express";
import { BOOK_ASSET_ID, bookAssetContentType, bookAssetObject, childBookAssetPrefix, isBookAssetRel } from "../lib/library/bookAssetPaths.js";
import { logger, requestIdOf } from "./logger.js";
import { bookAssetLimiter } from "./apiRateLimits.js";

/**
 * B-BOOK release — a child's private book files (hero sheet, choice cards,
 * printed pages, narration in the child's name) live in Firebase Storage under
 * `children/{childId}/books/{bookId}/…` (lib/library/bookAssetPaths). Clients
 * have NO Storage access there (storage.rules only opens users/{uid}/); the app
 * reads each file through this proxy, which
 *   - requires a verified caller (fails closed: no uid → 401, even where the
 *     auth middleware is not enforcing),
 *   - checks the caller's family owns the child (requireChildOwnership),
 *   - serves only the path shapes bookAssetPaths allows,
 *   - answers `Cache-Control: private` (the client keeps its own IndexedDB copy).
 * The erase sweep (eraseChildBookAssets) runs from /privacy/erase and from the
 * account deletion, and returns the number of files it removed.
 * K2: the sandbox (MEMORY_ADAPTER=local, no Firebase) serves the same paths
 * from a local folder (server/localBookAssetBucket.ts) with `allowLocal`: the
 * unauthenticated "local-sandbox" caller is let through there only; with
 * Firestore the proxy stays fail-closed. The write path: server/bookSheet.ts.
 */

/** GCS File.save options (the subset the book write path uses). */
export interface BookAssetSaveOptions {
  contentType: string;
  resumable?: boolean;
  metadata?: { cacheControl?: string; metadata?: Record<string, string> };
}

export interface BookAssetFile {
  name: string;
  /** Object metadata as listed (GCS: size as a string, custom keys under `metadata`). */
  metadata?: { size?: string | number; metadata?: Record<string, string> };
  exists(): Promise<[boolean]>;
  createReadStream(): NodeJS.ReadableStream;
  delete(): Promise<unknown>;
  save?(data: Buffer, opts: BookAssetSaveOptions): Promise<unknown>;
}

export interface BookAssetBucket {
  file(name: string): BookAssetFile;
  getFiles(opts: { prefix: string }): Promise<[BookAssetFile[]]>;
}

/** The configured bucket, or null when none is configured. */
export async function defaultBookAssetBucket(bucketName: string | undefined): Promise<BookAssetBucket | null> {
  if (!bucketName) return null;
  const { getStorage } = await import("firebase-admin/storage");
  return getStorage().bucket(bucketName) as unknown as BookAssetBucket;
}

/** Delete every book file of one child; returns how many were removed. A
 *  bucket that was never provisioned counts 0. */
export async function eraseChildBookAssets(bucket: BookAssetBucket | null, childId: string): Promise<number> {
  if (!bucket || !BOOK_ASSET_ID.test(childId)) return 0;
  try {
    const [files] = await bucket.getFiles({ prefix: childBookAssetPrefix(childId) });
    await Promise.all(files.map((f) => f.delete()));
    return files.length;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not exist|notFound|404/i.test(message)) return 0;
    throw err;
  }
}

export function createBookAssetsRouter(deps: { getBucket: () => Promise<BookAssetBucket | null>; requireOwnership: RequestHandler; allowLocal?: boolean; readsPerMin?: number }): express.Router {
  const router = express.Router();
  // K2: off the per-IP /api limit; its own per-account limit (a first open reads every file)
  const limit = bookAssetLimiter("read", deps.readsPerMin);
  const verified: RequestHandler = (req, res, next) => {
    const uid = (req as { user?: { uid?: string } }).user?.uid;
    if (deps.allowLocal && (!uid || uid === "local-sandbox")) return next();
    if (!uid || uid === "local-sandbox") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
  router.get("/children/:childId/book-assets/:bookId/file", verified, limit, deps.requireOwnership, async (req, res) => {
    const { childId, bookId } = req.params;
    const rel = typeof req.query.path === "string" ? req.query.path : "";
    if (!BOOK_ASSET_ID.test(childId) || !BOOK_ASSET_ID.test(bookId) || !isBookAssetRel(rel)) {
      res.status(400).json({ error: "Bad book asset path" });
      return;
    }
    try {
      const bucket = await deps.getBucket();
      if (!bucket) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const file = bucket.file(bookAssetObject(childId, bookId, rel));
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.setHeader("Content-Type", bookAssetContentType(rel));
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const stream = file.createReadStream();
      stream.on("error", (err: Error) => {
        logger.error("Book asset stream error", err, { requestId: requestIdOf(req) });
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      stream.pipe(res);
    } catch (error: unknown) {
      logger.error("Book asset error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to read the book file" });
    }
  });
  return router;
}
