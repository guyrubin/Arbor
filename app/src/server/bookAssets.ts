import express, { type RequestHandler } from "express";
import { createHash } from "node:crypto";
import { BOOK_EXPORT_CONCURRENT_READS, BOOK_EXPORT_DIGEST_HEADER, BOOK_EXPORT_LIMITS } from "../lib/library/bookAssetExportContract.js";
import { BOOK_ASSET_ID, bookAssetContentType, bookAssetObject, childBookAssetPrefix, isBookAssetRel } from "../lib/library/bookAssetPaths.js";
import { logger, requestIdOf } from "./logger.js";
import { bookAssetLimiter, bookAssetRates } from "./apiRateLimits.js";
import { inventoryChildBookAssets } from "./bookAssetExport.js";

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
 *   - answers `Cache-Control: private, no-store` (B-GA-09 / LC-18): the client
 *     keeps its own IndexedDB copy, which the child's erase purges, while a
 *     browser HTTP-cache copy of the child's likeness or name audio would
 *     outlive the erase for a day and no script can clear it.
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
  metadata?: { size?: string | number; contentType?: string; metadata?: Record<string, string> };
  /** GCS: the object's stored metadata (its contentType is what the write path saved). */
  getMetadata?(): Promise<[{ contentType?: string; size?: string | number }]>;
  exists(): Promise<[boolean]>;
  createReadStream(): NodeJS.ReadableStream;
  delete(): Promise<unknown>;
  save?(data: Buffer, opts: BookAssetSaveOptions): Promise<unknown>;
}

export interface BookAssetBucket {
  file(name: string): BookAssetFile;
  getFiles(opts: { prefix: string; autoPaginate?: boolean; maxResults?: number; pageToken?: string }): Promise<[BookAssetFile[], unknown?]>;
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

/** B-CAREPRO-50 (critic r1): the object's stored media type (GCS metadata),
 *  lower-cased without parameters; "application/octet-stream" when absent. */
export async function storedContentType(file: BookAssetFile): Promise<string> {
  try {
    const meta = file.getMetadata ? (await file.getMetadata())[0] : file.metadata;
    const type = typeof meta?.contentType === "string" ? meta.contentType.split(";")[0].trim().toLowerCase() : "";
    return type || "application/octet-stream";
  } catch {
    return "application/octet-stream";
  }
}

export function createBookAssetsRouter(deps: { getBucket: () => Promise<BookAssetBucket | null>; requireOwnership: RequestHandler; allowLocal?: boolean; readsPerMin?: number; exportReadsPerMin?: number }): express.Router {
  const router = express.Router();
  // K2: off the per-IP /api limit; its own per-account limit (a first open reads every file)
  const limit = bookAssetLimiter("read", deps.readsPerMin);
  // B-CAREPRO-50: export reads keep their own per-account budget (they cannot
  // spend the reader's), at the reader's rate — `&export=1` never lifts the
  // per-minute read limit (critic r1); the client waits out a 429 and resumes.
  const exportLimit = bookAssetLimiter("read", deps.exportReadsPerMin ?? deps.readsPerMin ?? bookAssetRates().reads);
  // …and at most BOOK_EXPORT_CONCURRENT_READS in flight per account.
  const inflight = new Map<string, number>();
  const exportSlot: RequestHandler = (req, res, next) => {
    const uid = (req as { user?: { uid?: string } }).user?.uid ?? "";
    const held = inflight.get(uid) ?? 0;
    if (held >= BOOK_EXPORT_CONCURRENT_READS) {
      res.setHeader("Retry-After", "1");
      res.status(429).json({ error: "Too many export reads at once" });
      return;
    }
    inflight.set(uid, held + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const left = (inflight.get(uid) ?? 1) - 1;
      if (left > 0) inflight.set(uid, left); else inflight.delete(uid);
    };
    res.on("finish", release);
    res.on("close", release);
    next();
  };
  const verified: RequestHandler = (req, res, next) => {
    const uid = (req as { user?: { uid?: string } }).user?.uid;
    if (deps.allowLocal && (!uid || uid === "local-sandbox")) return next();
    if (!uid || uid === "local-sandbox") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
  // Export never inherits the anonymous local-sandbox reader exception.
  const exportVerified: RequestHandler = (req, res, next) => {
    const uid = (req as { user?: { uid?: string } }).user?.uid;
    if (!uid || uid === "local-sandbox") { res.status(401).json({ error: "Unauthorized" }); return; }
    res.setHeader("Cache-Control", "private, no-store");
    next();
  };
  router.get("/children/:childId/book-assets/export-manifest", exportVerified, limit, deps.requireOwnership, async (req, res) => {
    if (!BOOK_ASSET_ID.test(req.params.childId)) { res.status(400).json({ error: "Bad child id" }); return; }
    try {
      res.json(await inventoryChildBookAssets(await deps.getBucket(), req.params.childId));
    } catch {
      // Do not log storage errors: they may contain private object names or URLs.
      res.status(503).json({ error: "Book file inventory unavailable" });
    }
  });
  const verifiedRead: RequestHandler = (req, res, next) => req.query.export === "1" ? exportVerified(req, res, next) : verified(req, res, next);
  const readLimit: RequestHandler = (req, res, next) => (req.query.export === "1" ? exportLimit : limit)(req, res, next);
  const readSlot: RequestHandler = (req, res, next) => (req.query.export === "1" ? exportSlot(req, res, next) : next());
  router.get("/children/:childId/book-assets/:bookId/file", verifiedRead, readLimit, readSlot, deps.requireOwnership, async (req, res) => {
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
      if (req.query.export === "1") {
        // B-CAREPRO-50: an export read is the exact bytes plus the server's
        // SHA-256 of them (the client keeps the file only on a match), with a
        // length; bounded by the contract's per-file cap. A storage error, or
        // a client gone mid-read, ends the response without a clean 200.
        const stream = file.createReadStream();
        res.on("close", () => { if ("destroy" in stream) (stream as import("node:stream").Readable).destroy(); });
        const chunks: Buffer[] = [];
        let size = 0;
        try {
          for await (const chunk of stream as AsyncIterable<Buffer | string>) {
            const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
            size += buf.byteLength;
            if (size > BOOK_EXPORT_LIMITS.fileBytes) {
              if ("destroy" in stream) (stream as import("node:stream").Readable).destroy();
              res.status(413).json({ error: "Book file too large to export" });
              return;
            }
            chunks.push(buf);
          }
        } catch {
          res.destroy();
          return;
        }
        const body = Buffer.concat(chunks, size);
        // Critic r1: typed by what the write path STORED, never by the path's
        // extension; an untyped object goes out as octet-stream, which the
        // client refuses as an integrity failure.
        res.setHeader("Content-Type", await storedContentType(file));
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Length", String(size));
        res.setHeader(BOOK_EXPORT_DIGEST_HEADER, createHash("sha256").update(body).digest("hex"));
        res.end(body);
        return;
      }
      res.setHeader("Content-Type", bookAssetContentType(rel));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const stream = file.createReadStream();
      stream.on("error", (err: Error) => {
        if (req.query.export !== "1") logger.error("Book asset stream error", err, { requestId: requestIdOf(req) });
        if (!res.headersSent) res.status(500).end();
        else res.destroy(); // a partial stream must never look like a complete 200
      });
      res.on("close", () => { if ("destroy" in stream) (stream as import("node:stream").Readable).destroy(); });
      stream.pipe(res);
    } catch (error: unknown) {
      if (req.query.export !== "1") logger.error("Book asset error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to read the book file" });
    }
  });
  return router;
}
