/**
 * server/planPlates — B-BOOK-75 (plates painted in-product): the SHARED plan
 * plates — child-free, text-free pattern art every family reads — painted
 * once through the server's image provider and served from the child-assets
 * bucket under a NON-child prefix.
 *
 *   POST /api/admin/plan-plates   { pattern?, plate?, repaint? }
 *        Allowed only for a verified uid whose email is in ARBOR_ADMIN_EMAILS
 *        or ARBOR_FAMILY_EMAILS (isPlatePainter); 403 for everyone else.
 *        Paints every brief in scope (one pattern, one plate, or all) through
 *        the same provider path as /generate-scene (modelProvider.generateImage,
 *        the approved model and region pins), the brief plus the standard
 *        rules (PLAN_PLATE_RULES). Idempotent: a painted plate is skipped
 *        unless `repaint`. Per run: at most PLAN_PLATES_MAX_IMAGES images or
 *        PLAN_PLATES_MAX_USD estimated (429 plan_plates_cap before a call is
 *        made). Every provider call goes through the image routes' global
 *        breaker (imageQuota IMAGE_COUNTERS.global) and a per-painter daily
 *        ledger (PLAN_PLATES_COUNTER); the provider's own ai.usage record
 *        is written by the router. A run stops at the request deadline and
 *        answers what it did; calling again continues (skip = idempotent).
 *   GET  /api/admin/plan-plates
 *        The per-plate state (painted / failed / unpainted) per pattern, for
 *        the admin control (components/plans/PlanPlatePainter). Same gate.
 *   GET  /api/plans/plates/:pattern/:plate
 *        Read-only, any signed-in user (shared, child-free content: no
 *        per-child ownership check; auth kept, the sandbox lets the
 *        unauthenticated local caller through like server/bookAssets.ts).
 *        Streams the stored webp (or png) with long cache headers; 404 when
 *        unpainted (the renderer advances on image error).
 *
 * Storage: shared/plans/<pattern>/<plate>.webp|.png, a provenance JSON
 * beside it (<plate>.json: childFree / textFree flags — false until a person
 * has viewed the plate full size, lane B §4.9 — model, location, prompt
 * sha256, painter uid, time, cost estimate, qc) and, after a failed paint,
 * <plate>.failed.json (removed by the next success). The provider returns no
 * text / figure attribute signal, so every paint records `qc: "unverified"`.
 * Never a child path: the erase sweep (children/<cid>/books/) and the export
 * inventory never see these objects.
 */
import express, { type RequestHandler, type Response } from "express";
import { createHash } from "node:crypto";
import type { ArborConfig } from "../config/env.js";
import type { GeneratedImage, GenerateImageOptions } from "../ai/modelRouter.js";
import { isAbortError } from "../ai/modelRetry.js";
import { PLAN_PLATE_BRIEFS, planPlateTable } from "../lib/library/plans/planPlates.js";
import { isPatternId, PATTERN_IDS } from "../lib/library/plans/planVisibility.js";
import type { PatternId } from "../lib/library/types.js";
import type { BookAssetBucket, BookAssetFile } from "./bookAssets.js";
import { IMAGE_COUNTERS, IMAGE_GLOBAL_DAILY } from "./imageQuota.js";
import type { UsageCounterStore } from "./quotaStore.js";
import { bookAssetLimiter } from "./apiRateLimits.js";
import { logger, requestIdOf } from "./logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The shared, non-child prefix of the painted plates in the child-assets bucket. */
export const PLAN_PLATE_PREFIX = "shared/plans/";
/** Rough list price of one Gemini image (the figure imageQuota budgets with). */
export const PLAN_PLATE_IMAGE_USD = 0.039;
/** Per-run caps: refuse a run that would paint more than this before any call. */
export const PLAN_PLATES_MAX_IMAGES = 80;
export const PLAN_PLATES_MAX_USD = 10;
/** The per-painter daily ledger (beside the image routes' global breaker). */
export const PLAN_PLATES_COUNTER = "img_plan_plates_daily";
/** One run's wall-clock budget (under Cloud Run's request timeout) and one image's. */
export const PLAN_PLATES_RUN_MS = 240_000;
export const PLAN_PLATE_IMAGE_MS = 60_000;

const PLATE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The standard rules every plate brief is painted under (the plate contract). */
export const PLAN_PLATE_RULES = [
  "This is a background PLATE for a children's picture book, landscape 3:2 (1536 by 1024).",
  "Warm, semi-realistic game-tile look: soft painted surfaces, gentle depth, friendly colours.",
  "One key light from the upper left; one consistent light direction across the whole scene.",
  "The hero floor slot — the open area of floor in the middle foreground — stays EMPTY: no figure, no object there.",
  "No people and no child-like figure of any kind: no child, no doll, no silhouette of a person, no face, no hands, no toy that looks like a person.",
  "No text of any kind: no letters, no numbers, no words, no signs, no labels, no logos, no writing on anything.",
  "No religious symbols. No weapon of any kind; nothing pointed toward the viewer.",
  "Nothing scary, nothing sad: a calm home or outdoor place a young child knows.",
].join(" ");

const LIGHT_WORDS: Record<string, string> = {
  morning: "clear morning light",
  day: "soft daylight",
  golden: "warm golden-hour light",
  dusk: "soft dusk light",
  night: "calm night light with a low lamp glow",
};

/** The prompt of one plate: its brief, its light rig, the standard rules. */
export function planPlatePrompt(patternId: PatternId, plateId: string): string | null {
  const spec = PLAN_PLATE_BRIEFS[patternId]?.[plateId];
  if (!spec) return null;
  return `Paint one background plate. Scene: ${spec.brief}. Light: ${LIGHT_WORDS[spec.light] ?? spec.light}. ${PLAN_PLATE_RULES}`;
}

const envList = (env: NodeJS.ProcessEnv, name: string): string[] =>
  (env[name] || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** May this verified caller paint the shared plates? A uid from the token and
 *  an email on ARBOR_ADMIN_EMAILS or ARBOR_FAMILY_EMAILS (the founder / admin /
 *  comped accounts); the sandbox caller and every other family: no. */
export function isPlatePainter(actor: { uid: string | null; email: string | null }, env: NodeJS.ProcessEnv = process.env): boolean {
  const uid = (actor.uid || "").trim();
  const email = (actor.email || "").trim().toLowerCase();
  if (!uid || uid === "local-sandbox" || !email) return false;
  return envList(env, "ARBOR_ADMIN_EMAILS").includes(email) || envList(env, "ARBOR_FAMILY_EMAILS").includes(email);
}

export type PlateExt = "webp" | "png";
/** The object name of a plate's master, its provenance or its failure record. */
export function planPlateObject(patternId: string, plateId: string, ext: PlateExt | "json" | "failed.json"): string {
  if (!isPatternId(patternId) || !PLATE_ID.test(plateId)) throw new Error("bad plan plate id");
  return `${PLAN_PLATE_PREFIX}${patternId}/${plateId}.${ext}`;
}

export const estimatePaintUsd = (images: number): number => Math.round(images * PLAN_PLATE_IMAGE_USD * 1000) / 1000;

export type PlateState = "painted" | "failed" | "unpainted";

/** The per-plate state from one listing of the shared prefix. */
export function plateStatesFrom(names: readonly string[]): Record<PatternId, Record<string, PlateState>> {
  const set = new Set(names);
  const out = {} as Record<PatternId, Record<string, PlateState>>;
  for (const p of PATTERN_IDS) {
    out[p] = {};
    for (const id of Object.keys(planPlateTable(p))) {
      const painted = set.has(planPlateObject(p, id, "webp")) || set.has(planPlateObject(p, id, "png"));
      out[p][id] = painted ? "painted" : set.has(planPlateObject(p, id, "failed.json")) ? "failed" : "unpainted";
    }
  }
  return out;
}

/** Width and height from a PNG or WebP header (null when unreadable). */
export function imageDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buf.subarray(12, 16).toString("ascii") === "IHDR") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 30 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    const chunk = buf.subarray(12, 16).toString("ascii");
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  return null;
}

export interface PlanPlateProvenance {
  pattern: PatternId;
  plate: string;
  file: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  /** "3:2" when the master is within 1% of the plate contract. */
  aspect: "3:2" | "other" | "unknown";
  /** False until a person has viewed the plate full size (lane B §4.9). */
  childFree: false;
  textFree: false;
  /** The provider offers no text / figure attribute signal: never verified here. */
  qc: "unverified";
  model: string;
  location: string;
  promptSha256: string;
  painterUid: string;
  paintedAt: string;
  costUsd: number;
}

export interface PlanPlatesDeps {
  config: Pick<ArborConfig, "modelProvider" | "memoryAdapter" | "arborEnv" | "vertexModelImage" | "vertexImageRegions" | "gcpRegion" | "geminiImageModel">;
  getBucket: () => Promise<BookAssetBucket | null>;
  /** The same provider path as /generate-scene (modelProvider.generateImage). */
  generate: (options: GenerateImageOptions) => Promise<GeneratedImage>;
  counters: UsageCounterStore;
  /** K2 sandbox: the unauthenticated local caller may READ (never paint). */
  allowLocal?: boolean;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  runMs?: number;
  readsPerMin?: number;
  /** Test seams for the per-run caps (production: the constants above). */
  maxImagesPerRun?: number;
  maxUsdPerRun?: number;
}

const refuse = (res: Response, status: number, code: string, message: string, extra: Record<string, unknown> = {}) => res.status(status).json({ error: message, code, ...extra });

const userOf = (req: express.Request) => (req as { user?: { uid?: string; email?: string | null } }).user;

export function createPlanPlatesRouter(deps: PlanPlatesDeps): express.Router {
  const router = express.Router();
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => Date.now());
  const runMs = deps.runMs ?? PLAN_PLATES_RUN_MS;
  const maxImages = deps.maxImagesPerRun ?? PLAN_PLATES_MAX_IMAGES;
  const maxUsd = deps.maxUsdPerRun ?? PLAN_PLATES_MAX_USD;
  const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
  const vertex = deps.config.modelProvider === "vertex";
  const mock = deps.config.modelProvider === "mock";
  const pin = {
    model: mock ? "mock" : vertex ? deps.config.vertexModelImage : deps.config.geminiImageModel,
    location: mock ? "mock" : vertex ? (deps.config.vertexImageRegions?.[0] ?? deps.config.gcpRegion) : "gemini_dev",
  };

  const painterOnly: RequestHandler = (req, res, next) => {
    const user = userOf(req);
    if (!isPlatePainter({ uid: user?.uid ?? null, email: user?.email ?? null }, env)) { refuse(res, 403, "plan_plates_forbidden", "Not authorized"); return; }
    res.setHeader("Cache-Control", "no-store");
    next();
  };

  const listShared = async (bucket: BookAssetBucket): Promise<string[]> => {
    const [files] = await bucket.getFiles({ prefix: PLAN_PLATE_PREFIX });
    return files.map((f) => f.name);
  };

  router.get("/admin/plan-plates", painterOnly, async (req, res) => {
    try {
      const bucket = await deps.getBucket();
      const names = bucket ? await listShared(bucket) : [];
      res.json({ storage: !!bucket, patterns: plateStatesFrom(names), costPerImageUsd: PLAN_PLATE_IMAGE_USD, maxImagesPerRun: maxImages, maxUsdPerRun: maxUsd });
    } catch (error: unknown) {
      logger.error("Plan plates status error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      refuse(res, 503, "plan_plates_unavailable", "Plate storage is not available");
    }
  });

  router.post("/admin/plan-plates", painterOnly, express.json({ limit: "4kb" }), async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (b.pattern !== undefined && !isPatternId(b.pattern)) { refuse(res, 404, "plan_unknown_pattern", "Unknown pattern"); return; }
    const patterns: PatternId[] = isPatternId(b.pattern) ? [b.pattern] : [...PATTERN_IDS];
    const onlyPlate = typeof b.plate === "string" ? b.plate : null;
    if (onlyPlate !== null && (!PLATE_ID.test(onlyPlate) || !patterns.some((p) => planPlateTable(p)[onlyPlate]))) { refuse(res, 404, "plan_unknown_plate", "Unknown plate"); return; }
    const repaint = b.repaint === true;
    const uid = userOf(req)!.uid!;

    const bucket = await deps.getBucket();
    if (!bucket) { refuse(res, 503, "plan_plates_unavailable", "Plate storage is not available"); return; }
    let existing: Set<string>;
    try {
      existing = new Set(await listShared(bucket));
    } catch (error: unknown) {
      logger.error("Plan plates listing error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      refuse(res, 503, "plan_plates_unavailable", "Plate storage is not available");
      return;
    }
    const isPainted = (p: PatternId, id: string) => existing.has(planPlateObject(p, id, "webp")) || existing.has(planPlateObject(p, id, "png"));

    const todo: { pattern: PatternId; plate: string }[] = [];
    const results: { pattern: PatternId; plate: string; state: PlateState | "skipped"; reason?: string }[] = [];
    for (const p of patterns) {
      for (const id of Object.keys(planPlateTable(p))) {
        if (onlyPlate !== null && id !== onlyPlate) continue;
        if (!repaint && isPainted(p, id)) results.push({ pattern: p, plate: id, state: "skipped" });
        else todo.push({ pattern: p, plate: id });
      }
    }
    const estimatedUsd = estimatePaintUsd(todo.length);
    if (todo.length > maxImages || estimatedUsd > maxUsd) {
      refuse(res, 429, "plan_plates_cap", "This run is over the per-run cap", { planned: todo.length, estimatedUsd, maxImagesPerRun: maxImages, maxUsdPerRun: maxUsd });
      return;
    }

    const started = now();
    let painted = 0;
    let failed = 0;
    let stopped: "deadline" | "breaker" | "client" | null = null;
    let clientGone = false;
    res.on("close", () => { if (!res.writableEnded) clientGone = true; });
    for (const job of todo) {
      if (clientGone) { stopped = "client"; break; }
      if (now() - started > runMs) { stopped = "deadline"; break; }
      // The image routes' global breaker bounds provider attempts, i.e. cost, for everyone.
      const global = await deps.counters.increment(IMAGE_COUNTERS.global, "all", DAY_MS);
      if (global.count > IMAGE_GLOBAL_DAILY) { stopped = "breaker"; break; }
      await deps.counters.increment(PLAN_PLATES_COUNTER, uid, DAY_MS);
      const prompt = planPlatePrompt(job.pattern, job.plate)!;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PLAN_PLATE_IMAGE_MS);
      try {
        const image = await deps.generate({ prompt, budget: { signal: controller.signal, deadlineAt: now() + PLAN_PLATE_IMAGE_MS, totalMs: PLAN_PLATE_IMAGE_MS } });
        const data = Buffer.from(image.data, "base64");
        if (!data.length) throw new Error("empty image");
        const ext: PlateExt = /webp/i.test(image.mimeType) ? "webp" : "png";
        const dims = imageDimensions(data);
        const aspect: PlanPlateProvenance["aspect"] = dims ? (Math.abs(dims.width / dims.height - 1.5) < 0.015 ? "3:2" : "other") : "unknown";
        const file = bucket.file(planPlateObject(job.pattern, job.plate, ext));
        if (!file.save) throw new Error("storage has no write path");
        const provenance: PlanPlateProvenance = {
          pattern: job.pattern, plate: job.plate, file: file.name, mimeType: ext === "webp" ? "image/webp" : "image/png",
          width: dims?.width ?? null, height: dims?.height ?? null, aspect,
          childFree: false, textFree: false, qc: "unverified",
          model: pin.model, location: pin.location, promptSha256: sha256(prompt), painterUid: uid,
          paintedAt: new Date(now()).toISOString(), costUsd: PLAN_PLATE_IMAGE_USD,
        };
        await file.save(data, { contentType: provenance.mimeType, resumable: false, metadata: { cacheControl: "private, max-age=604800", metadata: { pattern: job.pattern, plate: job.plate, qc: "unverified" } } });
        await bucket.file(planPlateObject(job.pattern, job.plate, "json")).save!(Buffer.from(JSON.stringify(provenance)), { contentType: "application/json", resumable: false });
        // A repaint of a .png over an old .webp (or the reverse) leaves one master only.
        const other = bucket.file(planPlateObject(job.pattern, job.plate, ext === "webp" ? "png" : "webp"));
        if (existing.has(other.name)) await other.delete().catch(() => undefined);
        const failedRecord = bucket.file(planPlateObject(job.pattern, job.plate, "failed.json"));
        if (existing.has(failedRecord.name)) await failedRecord.delete().catch(() => undefined);
        painted += 1;
        results.push({ pattern: job.pattern, plate: job.plate, state: "painted" });
      } catch (error: unknown) {
        failed += 1;
        const reason = isAbortError(error) ? "deadline" : (error instanceof Error ? error.message : String(error)).slice(0, 160);
        results.push({ pattern: job.pattern, plate: job.plate, state: "failed", reason });
        logger.warn("Plan plate paint failed", { requestId: requestIdOf(req), pattern: job.pattern, plate: job.plate, reason });
        try {
          await bucket.file(planPlateObject(job.pattern, job.plate, "failed.json")).save!(Buffer.from(JSON.stringify({ pattern: job.pattern, plate: job.plate, reason, at: new Date(now()).toISOString(), painterUid: uid })), { contentType: "application/json", resumable: false });
        } catch { /* the response carries the failure */ }
      } finally {
        clearTimeout(timer);
      }
    }
    const attempted = painted + failed;
    for (const job of todo.slice(attempted)) results.push({ pattern: job.pattern, plate: job.plate, state: isPainted(job.pattern, job.plate) ? "painted" : "unpainted", reason: stopped ?? undefined });
    if (clientGone) return;
    res.json({
      run: { planned: todo.length, painted, failed, skipped: results.filter((r) => r.state === "skipped").length, left: todo.length - attempted, stopped, estimatedUsd, spentUsd: estimatePaintUsd(attempted), costPerImageUsd: PLAN_PLATE_IMAGE_USD, model: pin.model, location: pin.location },
      results,
    });
  });

  // The read route: any signed-in user (the sandbox's local caller where allowed).
  const verified: RequestHandler = (req, res, next) => {
    const uid = userOf(req)?.uid;
    if (deps.allowLocal && (!uid || uid === "local-sandbox")) return next();
    if (!uid || uid === "local-sandbox") { res.status(401).json({ error: "Unauthorized" }); return; }
    next();
  };
  const limit = bookAssetLimiter("read", deps.readsPerMin);
  router.get("/plans/plates/:pattern/:plate", verified, limit, async (req, res) => {
    const { pattern, plate } = req.params;
    if (!isPatternId(pattern) || !PLATE_ID.test(plate) || !planPlateTable(pattern)[plate]) { res.status(404).json({ error: "Not found" }); return; }
    try {
      const bucket = await deps.getBucket();
      if (!bucket) { res.status(404).json({ error: "Not found" }); return; }
      let file: BookAssetFile | null = null;
      let type = "image/webp";
      for (const ext of ["webp", "png"] as const) {
        const f = bucket.file(planPlateObject(pattern, plate, ext));
        const [exists] = await f.exists();
        if (exists) { file = f; type = ext === "webp" ? "image/webp" : "image/png"; break; }
      }
      if (!file) { res.status(404).json({ error: "Not found" }); return; }
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "private, max-age=604800, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const stream = file.createReadStream();
      stream.on("error", (err: Error) => {
        logger.error("Plan plate stream error", err, { requestId: requestIdOf(req) });
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
      });
      res.on("close", () => { if ("destroy" in stream) (stream as import("node:stream").Readable).destroy(); });
      stream.pipe(res);
    } catch (error: unknown) {
      logger.error("Plan plate read error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to read the plate" });
    }
  });

  return router;
}
