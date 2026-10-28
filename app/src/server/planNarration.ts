/**
 * PR C (Everyday Plans) — a PLAN book's narration in the CHILD'S NAME, through
 * the canonical books' pipeline (server/bookNarration.ts: the same narrator,
 * Sulafat, the same models, style prompt, quota, machine ear and residency
 * policy).
 *
 *   POST /api/children/:childId/plan-narration { pattern, lang, file }
 *        pattern = the plan pattern (plan-poo-sit …), lang = the voice folder
 *        (en | he-m | he-f), file = a narration file of that plan book
 *
 * The WORDS come from the child's stored plan document (users/{uid}/children/
 * {cid}/books/{pattern}.{cid}: the parent's choices, recomposed from the
 * pattern registry — lib/library/plans/planBookDoc) and the NAME from the
 * child record; the body carries ids only. The sandbox (no Firestore: the plan
 * doc lives on the device) may send the plan document itself as `plan`; a
 * strict source refuses it. Every page file is rendered per child (a pattern
 * ships no shared set) and stored at
 *   children/{cid}/books/{pattern}/narration/{cid}/<lang>/<file>
 * — the child's set is the child id (lib/library/plans/planNarration) — and
 * listed, with the hash of the words it was rendered from, in the registered
 * `bookAssets/{pattern}` doc. A stored file whose words are unchanged is never
 * rendered again; one whose words changed (a renamed child, a re-approved own
 * step) is rendered again and the response says so (`rerendered`).
 *
 * The route policy: a line that says the name, or the parent's own step, is
 * child data (`child_profile` — prod admits the EU endpoint only), exactly as
 * a canonical name page; the pattern's own lines are public text. The machine
 * ear checks the first name on the name lines only (BOOK_TTS_TAKES takes).
 * Quota: the book narration counters (tts_book_30d, tts_book_global_daily);
 * MODEL_PROVIDER=mock answers a tone, no spend. The plan sheet must show this
 * book first (bookAssets/plan-poses covers its poses), as on the kid shelf.
 */
import express, { type RequestHandler, type Response } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { bookAssetObject, type BookAssetsDoc } from "../lib/library/bookAssetPaths.js";
import { VOICE_FOLDERS, type VoiceFolder } from "../lib/library/narrationFiles.js";
import { planBookFromDoc, planBookId, readPlanBookDoc, type PlanBookDoc } from "../lib/library/plans/planBookDoc.js";
import { getPattern } from "../lib/library/plans/planBooks.js";
import { emptyPlanNarrationDoc, planNarrationComplete, planNarrationDocId, planNarrationRel, planNarrationRequest, planSheetCovers, storedPlanNarration } from "../lib/library/plans/planNarration.js";
import { PLAN_SHEET_BOOK_ID } from "../lib/library/plans/planPoses.js";
import { isPatternId } from "../lib/library/plans/planVisibility.js";
import { heroFirstName } from "../lib/heroJourneyRender.js";
import { storyName } from "../lib/storyName.js";
import { routePolicyFor, selectProvider } from "../ai/capabilities/policy.js";
import type { BookAssetBucket } from "./bookAssets.js";
import { BOOK_TTS_TAKES, bookTtsSettings, chargeBookTts, type BookTtsCharge, type BookTtsCheck, type BookTtsProvider, type NarrationChildSource } from "./bookNarration.js";
import type { BookAssetsDocStore } from "./bookSheet.js";
import type { EntitlementStore } from "./entitlements.js";
import type { UsageCounterStore } from "./quotaStore.js";
import { HERO_BOOK_POSES_BY_PLAN, imagePlanFor } from "./imageQuota.js";
import { bookAssetLimiter } from "./apiRateLimits.js";
import { logger, requestIdOf } from "./logger.js";

/* ── The child's plan document ───────────────────────────────────────────── */

export interface PlanBookSource {
  /** The stored row, or null. Untrusted data: the route reads it through readPlanBookDoc. */
  load(uid: string, childId: string, bookId: string): Promise<unknown | null>;
  /** False in the local sandbox: the document lives on the device and may come in the body. */
  readonly strict: boolean;
}

export class FirestorePlanBookSource implements PlanBookSource {
  readonly strict = true;
  private readonly db: Firestore;
  constructor(config: ArborConfig) {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  async load(uid: string, childId: string, bookId: string): Promise<unknown | null> {
    const snap = await this.db.doc(`users/${uid}/children/${childId}/books/${bookId}`).get();
    return snap.exists ? snap.data() ?? null : null;
  }
}

/** Sandbox: no record on the server; the body may carry the device's document. */
export const localPlanBookSource: PlanBookSource = { strict: false, async load() { return null; } };

/* ── The route ────────────────────────────────────────────────────────────── */

export interface PlanNarrationDeps {
  getBucket: () => Promise<BookAssetBucket | null>;
  requireOwnership: RequestHandler;
  docs: BookAssetsDocStore;
  children: NarrationChildSource;
  plans: PlanBookSource;
  counters: UsageCounterStore;
  entitlements?: EntitlementStore;
  provider: BookTtsProvider;
  check: BookTtsCheck;
  mock?: boolean;
  local?: boolean;
  config: Pick<ArborConfig, "arborEnv">;
  writesPerMin?: number;
  disabled?: boolean;
  now?: () => string;
}

const ALLOWED_KEYS = new Set(["pattern", "lang", "file", "plan"]);
const FILE = /^[A-Za-z0-9_-]{1,64}\.mp3$/;
const CHILD = /^[A-Za-z0-9_-]{1,64}$/;
const refuse = (res: Response, status: number, code: string, error: string, extra: Record<string, unknown> = {}) => void res.status(status).json({ error, code, ...extra });

export function createPlanNarrationRouter(deps: PlanNarrationDeps): express.Router {
  const router = express.Router();
  const limit = bookAssetLimiter("write", deps.writesPerMin);
  const now = deps.now ?? (() => new Date().toISOString());
  const verified: RequestHandler = (req, res, next) => {
    const uid = (req as { user?: { uid?: string } }).user?.uid;
    if (deps.local && (!uid || uid === "local-sandbox")) return next();
    if (!uid || uid === "local-sandbox") return refuse(res, 401, "plan_narration_auth", "Unauthorized");
    next();
  };

  router.post("/children/:childId/plan-narration", verified, limit, deps.requireOwnership, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    // 1. Ids only: never a name, a text, a prompt or a voice from the request.
    if (Object.keys(body).some((k) => !ALLOWED_KEYS.has(k))) return refuse(res, 400, "plan_narration_free_text", "The narration takes ids only");
    if (body.plan !== undefined && deps.plans.strict) return refuse(res, 400, "plan_narration_free_text", "The plan is read from the child's record");
    const { pattern, lang, file } = body as { pattern?: unknown; lang?: unknown; file?: unknown };
    const childId = String(req.params.childId);
    if (!isPatternId(pattern) || typeof lang !== "string" || !(VOICE_FOLDERS as readonly string[]).includes(lang) || typeof file !== "string" || !FILE.test(file) || !CHILD.test(childId)) {
      return refuse(res, 400, "plan_narration_bad_request", "pattern, lang and file are required");
    }
    const folder = lang as VoiceFolder;
    if (!getPattern(pattern)) return refuse(res, 404, "plan_narration_bad_request", "This pattern is not authored yet");
    // 2. The plan (the book poses' table: Free none), as the canonical narration.
    const plan = await imagePlanFor(req, deps.entitlements);
    if (!HERO_BOOK_POSES_BY_PLAN[plan].length) return refuse(res, 403, "book_narration_plan", "The book in the child's name is part of Plus and Family", { plan });
    // 3. The name and the Hebrew form, from the child record (B-KID-168: English letters for the English voice).
    const owner = (req as { user?: { uid?: string } }).user?.uid || "local-sandbox";
    const record = await deps.children.load(owner, childId).catch(() => null);
    const firstName = heroFirstName({ name: record?.name ?? "" });
    const spoken = folder === "en" ? heroFirstName({ name: storyName(record, "en") }) : firstName;
    if (!firstName && !(deps.mock && !deps.children.strict)) return refuse(res, 409, "book_narration_no_name", "The child's name is not saved yet");
    if (folder !== "en" && deps.children.strict) {
      const he = record?.gender === "girl" ? "he-f" : "he-m";
      if (folder !== he) return refuse(res, 409, "book_narration_wrong_voice", "That is not this child's Hebrew form", { lang: he });
    }
    // 4. The child's approved plan: the stored document (the sandbox's from the body), active, recomposed from the registry.
    const bookId = planBookId(pattern, childId);
    const raw = deps.plans.strict ? await deps.plans.load(owner, childId, bookId).catch(() => null) : body.plan ?? (await deps.plans.load(owner, childId, bookId).catch(() => null));
    const planDoc: PlanBookDoc | null = readPlanBookDoc(raw);
    if (!planDoc || planDoc.id !== bookId || planDoc.pattern !== pattern) return refuse(res, 409, "plan_narration_no_plan", "This plan is not approved for the child yet");
    if (planDoc.status !== "active") return refuse(res, 409, "plan_narration_closed", "This plan is closed");
    const book = planBookFromDoc(planDoc);
    if (!book) return refuse(res, 409, "plan_narration_no_plan", "The plan no longer fits its pattern");
    // 5. The plan sheet shows this book first (the kid shelf's own rule).
    const sheet = await deps.docs.read(owner, childId, PLAN_SHEET_BOOK_ID).catch(() => null);
    if (!planSheetCovers(sheet, book)) return refuse(res, 409, "plan_narration_no_sheet", "The plan's pictures come first");
    const tts = planNarrationRequest(book, folder, file, spoken || "sandbox");
    if (!tts) return refuse(res, 400, "plan_narration_bad_request", "Not a narration file of this plan");
    try {
      const bucket = await deps.getBucket();
      if (!bucket) return refuse(res, 503, "book_storage_unavailable", "Book storage is not available");
      const docId = planNarrationDocId(pattern);
      const existing = await deps.docs.read(owner, childId, docId).catch(() => null);
      const exists = async (rel: string) => (await bucket.file(bookAssetObject(childId, pattern, rel)).exists())[0];
      const remembered = storedPlanNarration(existing, childId, folder, file, tts.textHash);
      let stored: string | null = remembered && (await exists(remembered)) ? remembered : null;
      const rel = planNarrationRel(childId, folder, file);
      const twin = (r: string) => (r.endsWith(".wav") ? r.replace(/\.wav$/, ".mp3") : r.replace(/\.mp3$/, ".wav"));
      const had = existing?.files.find((r) => r === rel || r === twin(rel)) ?? null;
      const rerendered = !stored && !!had;
      let takes = 0;
      if (!stored) {
        if (deps.disabled) return refuse(res, 503, "book_narration_off", "The book's voice is switched off");
        // 6. The provider must be allowed this file's data where it runs (fails closed): the EU path for a name line.
        try {
          selectProvider({ capability: "speech_synthesis", route: "creative_low_risk", audience: "child", locale: tts.lang, dataClasses: [...tts.dataClasses], risk: "low" }, routePolicyFor(deps.config), [deps.provider.candidate()]);
        } catch {
          return refuse(res, 503, "book_narration_policy", "The book's voice is not available here");
        }
        const s = bookTtsSettings();
        for (let t = 0; t < BOOK_TTS_TAKES && !stored; t++) {
          const charge = await chargeBookTts(deps.counters, { uid: owner, childId });
          if (!charge.ok) { const r = charge as Extract<BookTtsCharge, { ok: false }>; res.status(r.status).json(r.body); return; }
          takes++;
          let take: { audio: Buffer; ext: "mp3" | "wav" };
          try {
            take = await deps.provider.synthesize({ text: tts.text, prompt: tts.prompt, languageCode: tts.languageCode, model: tts.lang === "en" ? s.en : s.he, voice: s.voice });
          } catch (error: unknown) {
            await (charge as Extract<BookTtsCharge, { ok: true }>).release().catch(() => undefined);
            logger.error("Plan narration provider error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
            return refuse(res, 503, "book_narration_busy", "The book's voice is busy. Please try again later.", { retryable: true });
          }
          // the machine ear: on a name line, the child's first name must be in the take
          if (tts.nameBearing && deps.check && !deps.mock && !(await deps.check(take.audio, take.ext, spoken, tts.lang).catch(() => false))) continue;
          const out = take.ext === "wav" ? twin(rel) : rel;
          const f = bucket.file(bookAssetObject(childId, pattern, out));
          if (!f.save) return refuse(res, 503, "book_storage_unavailable", "Book storage is not available");
          await f.save(take.audio, { contentType: take.ext === "wav" ? "audio/wav" : "audio/mpeg", resumable: false, metadata: { cacheControl: "private, max-age=86400", metadata: {} } });
          stored = out;
          // ids and counts only: never the words (they carry the child's name)
          logger.info("tts.plan", { pattern, folder, file, chars: tts.text.length + tts.prompt.length, nameLine: tts.nameBearing, rerendered });
        }
        if (!stored) return refuse(res, 422, "book_narration_check_failed", "The voice did not say the name clearly; nothing was stored", { takes });
      }
      // 7. The registered doc lists the file with the words it was rendered from; a replaced twin goes.
      const base = existing ?? emptyPlanNarrationDoc(childId, pattern, now());
      const gone = base.files.filter((r) => r === twin(stored!) || (rerendered && r === had && r !== stored));
      await Promise.all(gone.map((r) => bucket.file(bookAssetObject(childId, pattern, r)).delete().catch(() => undefined)));
      const text = { ...(base.narrationText ?? {}) };
      for (const r of gone) delete text[r];
      text[stored] = tts.textHash;
      const doc: BookAssetsDoc = {
        ...base,
        setId: base.setId,
        files: [...new Set([...base.files.filter((r) => !gone.includes(r)), stored])].sort(),
        narrationText: text,
        // a re-rendered file keeps its name: the version stamp moves so a device copy is fetched fresh (lib/bookAssetStore)
        ...(rerendered ? { createdAt: now() } : {}),
      };
      const changed = !existing || doc.createdAt !== existing.createdAt || doc.files.length !== existing.files.length || doc.narrationText?.[stored] !== existing.narrationText?.[stored];
      if (changed) await deps.docs.write(owner, childId, doc);
      const complete = planNarrationComplete(doc, book, childId, folder, spoken || "sandbox");
      res.json({ ok: true, path: stored, takes, cached: takes === 0, rerendered, complete, doc, ...(deps.local ? { local: true } : {}) });
    } catch (error: unknown) {
      logger.error("Plan narration error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      refuse(res, 500, "book_narration_failed", "Failed to make the narration");
    }
  });
  return router;
}
