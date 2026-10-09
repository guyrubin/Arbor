/**
 * K2 block 2b (B-BOOK-30) — the book's narration in the CHILD'S NAME.
 *
 *   POST /api/children/:childId/book-narration { bookId, lang, file }
 *        lang = the voice folder (en | he-m | he-f), file = a narration file
 *
 * Only the files that say the child's name are rendered per child (Five Smooth
 * Stones: cover, p1, p10.a/b/c per voice); every other file is the book's
 * shared set (lib/library/narrationFiles). The NAME is read from the child
 * record, never from the request: the body carries ids only (any other key or
 * free text is refused). The words are the book's (lib/library/narrationTts:
 * the display text in English, the fully pointed Hebrew), with the style prompt
 * and direction tags; one narrator, Sulafat (books decision G13):
 *   EN  BOOK_TTS_MODEL_EN (default gemini-2.5-pro-tts)
 *   HE  BOOK_TTS_MODEL_HE (default gemini-3.1-flash-tts-preview)
 *   voice BOOK_TTS_VOICE (default Sulafat); endpoint BOOK_TTS_ENDPOINT
 *   (default the global Cloud TTS endpoint; an `eu-` host declares EU
 *   residency — prod's route policy admits EU only, so prod needs it).
 * The provider's data class includes child data (the name): the candidate
 * declares child_profile and the route policy decides (fails closed).
 * Each take (60 s timeout) is checked by the server's ASR when one is usable
 * (CHILD_ASR_PROVIDER): the child's first name must be heard; at most 3 takes;
 * a failed check stores nothing. A take that passes is stored at
 *   children/{cid}/books/{bookId}/narration/n-<hash of the first name>/<lang>/<file>
 * and once the voice folder has every name file, the bookAssets doc switches
 * to that set (setId) and an older name's set is removed. Quota: per child
 * tts_book_30d (BOOK_TTS_PER_CHILD_30D, default 30 takes) and a global daily
 * limit (BOOK_TTS_GLOBAL_DAILY, default 300); Free gets none (the book poses'
 * plan table). MODEL_PROVIDER=mock answers a short tone (WAV), no spend.
 */
import express, { type RequestHandler, type Response } from "express";
import { GoogleAuth } from "google-auth-library";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { BOOK_ASSET_ID, bookAssetObject, childBookAssetPrefix, isBookAssetRel, type BookAssetsDoc } from "../lib/library/bookAssetPaths.js";
import { getLibraryBook } from "../lib/library/books/index.js";
import { isHeroBookSheetId } from "../lib/library/bookSheet.js";
import { bookNarrationFiles, isNameBearing, nameBearingFiles, VOICE_FOLDERS, type VoiceFolder } from "../lib/library/narrationFiles.js";
import { bookTtsOf, NARRATION_VOICE, narrationTtsRequest } from "../lib/library/narrationTts.js";
import { heroAvatarHash } from "../lib/heroSheetContract.js";
import { heroFirstName } from "../lib/heroJourneyRender.js";
import { providerRegion, routePolicyFor, selectProvider, type ProviderCandidate } from "../ai/capabilities/policy.js";
import type { BookAssetBucket } from "./bookAssets.js";
import type { BookAssetsDocStore } from "./bookSheet.js";
import type { EntitlementStore } from "./entitlements.js";
import type { UsageCounterStore } from "./quotaStore.js";
import { HERO_BOOK_POSES_BY_PLAN, imagePlanFor } from "./imageQuota.js";
import { bookAssetLimiter } from "./apiRateLimits.js";
import { logger, requestIdOf } from "./logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const envNum = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(v) && v >= 0 ? v : fallback;
};
export const BOOK_TTS_COUNTERS = { child: "tts_book_30d", global: "tts_book_global_daily" } as const;
export const bookTtsLimits = () => ({ perChild30d: envNum("BOOK_TTS_PER_CHILD_30D", 30), globalDaily: envNum("BOOK_TTS_GLOBAL_DAILY", 300) });
export const BOOK_TTS_TAKES = 3;
export const BOOK_TTS_TIMEOUT_MS = 60_000;

/** The models and voice (env-configurable; G13 defaults). */
export const bookTtsSettings = () => ({
  en: process.env.BOOK_TTS_MODEL_EN || NARRATION_VOICE.en.model,
  he: process.env.BOOK_TTS_MODEL_HE || NARRATION_VOICE.he.model,
  voice: process.env.BOOK_TTS_VOICE || NARRATION_VOICE.voice,
  endpoint: (process.env.BOOK_TTS_ENDPOINT || "https://texttospeech.googleapis.com").replace(/\/+$/, ""),
});

/** The narration set of a first name: `n-<hash>` (a new name is a new set). */
export const narrationSetId = (firstName: string): string => `n-${heroAvatarHash(`book-narration-v1|${firstName.normalize("NFC")}`)}`;

/* ── The child record (the name and the Hebrew form) ─────────────────────── */

export interface NarrationChildSource {
  load(uid: string, childId: string): Promise<{ name: string | null; gender: string | null } | null>;
  /** False in the local sandbox: the record lives in the browser. */
  readonly strict: boolean;
}

export class FirestoreNarrationChildSource implements NarrationChildSource {
  readonly strict = true;
  private readonly db: Firestore;
  constructor(config: ArborConfig) {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  async load(uid: string, childId: string) {
    const snap = await this.db.doc(`users/${uid}/children/${childId}`).get();
    if (!snap.exists) return null;
    const d = snap.data() ?? {};
    return { name: typeof d.name === "string" ? d.name : null, gender: typeof d.gender === "string" ? d.gender : null };
  }
}

/** Sandbox: no record on the server; only the mock voice may run without a name. */
export const localNarrationChildSource: NarrationChildSource = { strict: false, async load() { return { name: null, gender: null }; } };

/* ── The voice ────────────────────────────────────────────────────────────── */

export interface BookTtsRequest { text: string; prompt: string; languageCode: string; model: string; voice: string }
export interface BookTtsProvider {
  synthesize(req: BookTtsRequest): Promise<{ audio: Buffer; ext: "mp3" | "wav" }>;
  /** Where the provider runs (the route policy's residency check). */
  candidate(): ProviderCandidate;
}

export const bookTtsCandidate = (endpoint: string): ProviderCandidate => ({
  ref: { provider: "google", model: "gemini-tts", region: /^https:\/\/eu-/.test(endpoint) ? "eu" : providerRegion("global") },
  capabilities: ["speech_synthesis"],
  audiences: ["parent", "child"],
  // K2: the book's words WITH THE CHILD'S NAME: child data.
  dataClasses: ["public", "account", "child_profile"],
  trainsOnCustomerData: false,
  retentionDays: 0,
  score: { quality: 3, safety: 3, reliability: 3, latencyFitness: 3, costFitness: 3 },
});

let auth: GoogleAuth | null = null;
export const googleBookTts = (config: ArborConfig): BookTtsProvider => ({
  candidate: () => bookTtsCandidate(bookTtsSettings().endpoint),
  async synthesize(req) {
    if (!auth) auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const t = await client.getAccessToken();
    const token = typeof t === "string" ? t : t?.token;
    if (!token) throw new Error("no ADC token for Cloud Text-to-Speech");
    const res = await fetch(`${bookTtsSettings().endpoint}/v1/text:synthesize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8", ...(config.gcpProjectId ? { "x-goog-user-project": config.gcpProjectId } : {}) },
      signal: AbortSignal.timeout(BOOK_TTS_TIMEOUT_MS),
      body: JSON.stringify({
        input: { text: req.text, prompt: req.prompt },
        voice: { languageCode: req.languageCode, name: req.voice, modelName: req.model },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });
    if (!res.ok) throw new Error(`Cloud TTS synthesize failed (${res.status})`);
    const json = (await res.json()) as { audioContent?: string };
    if (!json.audioContent) throw new Error("Cloud TTS returned no audioContent");
    // char-metered usage signal; never the text (it carries the child's name)
    logger.info("tts.book", { model: req.model, chars: req.text.length + req.prompt.length });
    return { audio: Buffer.from(json.audioContent, "base64"), ext: "mp3" };
  },
});

/** A short tone (WAV, 16 kHz mono): MODEL_PROVIDER=mock, so the sandbox hears that the page plays. */
export function mockToneWav(ms = 700, hz = 523): Buffer {
  const rate = 16000, n = Math.round((rate * ms) / 1000);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0, "latin1"); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8, "latin1");
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36, "latin1"); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 800, (n - i) / 800);
    b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 6000 * env), 44 + i * 2);
  }
  return b;
}
export const mockBookTts: BookTtsProvider = {
  candidate: () => ({ ...bookTtsCandidate("https://eu-mock"), ref: { provider: "mock", model: "tone", region: "eu" } }),
  async synthesize() { return { audio: mockToneWav(), ext: "wav" }; },
};

/** The machine ear: is the first name heard in the take? null = no usable ASR (no check). */
export type BookTtsCheck = ((audio: Buffer, ext: "mp3" | "wav", firstName: string, lang: "en" | "he") => Promise<boolean>) | null;

/* ── Quota ────────────────────────────────────────────────────────────────── */

export type BookTtsCharge = { ok: true; release: () => Promise<void> } | { ok: false; status: number; body: Record<string, unknown> };

export async function chargeBookTts(counters: UsageCounterStore, input: { uid: string; childId: string }): Promise<BookTtsCharge> {
  const lim = bookTtsLimits();
  const resting = (window: string, resetAt: number): BookTtsCharge => ({ ok: false, status: 429, body: { error: "The book's voice is resting today", code: "book_narration_resting", window, retryable: false, resetAt: new Date(resetAt).toISOString() } });
  const global = await counters.increment(BOOK_TTS_COUNTERS.global, "all", DAY_MS, { limit: lim.globalDaily });
  if (global.count > lim.globalDaily) return resting("day", global.resetAt);
  const key = `${input.uid}:${input.childId}`;
  const child = await counters.increment(BOOK_TTS_COUNTERS.child, key, MONTH_MS, { limit: lim.perChild30d });
  if (child.count > lim.perChild30d) {
    await counters.add(BOOK_TTS_COUNTERS.child, key, -1, MONTH_MS);
    return resting("month", child.resetAt);
  }
  let released = false;
  return { ok: true, release: async () => { if (!released) { released = true; await counters.add(BOOK_TTS_COUNTERS.child, key, -1, MONTH_MS); } } };
}

/* ── The route ────────────────────────────────────────────────────────────── */

export interface BookNarrationDeps {
  getBucket: () => Promise<BookAssetBucket | null>;
  requireOwnership: RequestHandler;
  docs: BookAssetsDocStore;
  children: NarrationChildSource;
  counters: UsageCounterStore;
  entitlements?: EntitlementStore;
  provider: BookTtsProvider;
  check: BookTtsCheck;
  /** MODEL_PROVIDER=mock: the tone may run without a name (the sandbox). */
  mock?: boolean;
  /** Sandbox: the unauthenticated local caller. */
  local?: boolean;
  config: Pick<ArborConfig, "arborEnv">;
  writesPerMin?: number;
  /** TTS_DISABLED (outside mock): the kill switch answers 503, nothing spent. */
  disabled?: boolean;
}

const ALLOWED_KEYS = new Set(["bookId", "lang", "file"]);
const FILE = /^[A-Za-z0-9_-]{1,64}(?:\.[A-Za-z0-9_-]{1,16})?\.mp3$/;
const refuse = (res: Response, status: number, code: string, error: string, extra: Record<string, unknown> = {}) => void res.status(status).json({ error, code, ...extra });

export function createBookNarrationRouter(deps: BookNarrationDeps): express.Router {
  const router = express.Router();
  const limit = bookAssetLimiter("write", deps.writesPerMin);
  const verified: RequestHandler = (req, res, next) => {
    const uid = (req as { user?: { uid?: string } }).user?.uid;
    if (deps.local && (!uid || uid === "local-sandbox")) return next();
    if (!uid || uid === "local-sandbox") return refuse(res, 401, "book_narration_auth", "Unauthorized");
    next();
  };

  router.post("/children/:childId/book-narration", verified, limit, deps.requireOwnership, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    // 1. Ids only: never a name, a text, a prompt or a voice from the request.
    if (Object.keys(body).some((k) => !ALLOWED_KEYS.has(k))) return refuse(res, 400, "book_narration_free_text", "The narration takes ids only");
    const { bookId, lang, file } = body as { bookId?: unknown; lang?: unknown; file?: unknown };
    const childId = String(req.params.childId);
    if (typeof bookId !== "string" || !BOOK_ASSET_ID.test(bookId) || typeof lang !== "string" || !(VOICE_FOLDERS as readonly string[]).includes(lang) || typeof file !== "string" || !FILE.test(file) || !BOOK_ASSET_ID.test(childId)) {
      return refuse(res, 400, "book_narration_bad_request", "bookId, lang and file are required");
    }
    const folder = lang as VoiceFolder;
    const book = getLibraryBook(bookId);
    if (!book || !bookTtsOf(book)) return refuse(res, 400, "book_narration_bad_request", "Unknown book");
    const row = bookNarrationFiles(book, folder).find((f) => f.file === file);
    if (!row) return refuse(res, 400, "book_narration_bad_request", "Not a narration file of this book");
    // 2. Only the files that say the child's name: every other one is the shared set.
    if (!isNameBearing(row)) return refuse(res, 400, "book_narration_name_free", "This page is the book's shared narration");
    // 3. The plan (the book poses' table: Free none).
    const plan = await imagePlanFor(req, deps.entitlements);
    if (!HERO_BOOK_POSES_BY_PLAN[plan].length) return refuse(res, 403, "book_narration_plan", "The book in the child's name is part of Plus and Family", { plan });
    // 4. The name and the Hebrew form, from the child record.
    const owner = (req as { user?: { uid?: string } }).user?.uid || "local-sandbox";
    const record = await deps.children.load(owner, childId).catch(() => null);
    const firstName = heroFirstName({ name: record?.name ?? "" });
    if (!firstName && !(deps.mock && !deps.children.strict)) return refuse(res, 409, "book_narration_no_name", "The child's name is not saved yet");
    if (folder !== "en" && deps.children.strict) {
      const he = record?.gender === "girl" ? "he-f" : "he-m";
      if (folder !== he) return refuse(res, 409, "book_narration_wrong_voice", "That is not this child's Hebrew form", { lang: he });
    }
    // 5. The book must show this child's own hero sheet (never an admin-uploaded one).
    const doc = await deps.docs.read(owner, childId, bookId).catch(() => null);
    if (!doc) return refuse(res, 409, "book_narration_no_book", "The book's pictures come first");
    if (!isHeroBookSheetId(doc.sheetId)) return refuse(res, 409, "book_sheet_admin", "This book has an uploaded set");
    try {
      const bucket = await deps.getBucket();
      if (!bucket) return refuse(res, 503, "book_storage_unavailable", "Book storage is not available");
      const setId = narrationSetId(firstName || "sandbox");
      const stem = file.replace(/\.mp3$/, "");
      const relOf = (ext: string) => `narration/${setId}/${folder}/${stem}.${ext}`;
      const exists = async (rel: string) => (await bucket.file(bookAssetObject(childId, bookId, rel)).exists())[0];
      let stored: string | null = (await exists(relOf("mp3"))) ? relOf("mp3") : (await exists(relOf("wav"))) ? relOf("wav") : null;
      let takes = 0;
      if (!stored) {
        if (deps.disabled) return refuse(res, 503, "book_narration_off", "The book's voice is switched off");
        // 6. The provider must be allowed child data where it runs (fails closed).
        try {
          selectProvider({ capability: "speech_synthesis", route: "creative_low_risk", audience: "child", locale: folder === "en" ? "en" : "he", dataClasses: ["child_profile"], risk: "low" }, routePolicyFor(deps.config), [deps.provider.candidate()]);
        } catch {
          return refuse(res, 503, "book_narration_policy", "The book's voice is not available here");
        }
        const tts = narrationTtsRequest(book, folder, file, firstName || "sandbox");
        if (!tts) return refuse(res, 400, "book_narration_bad_request", "No TTS input for this file");
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
            logger.error("Book narration provider error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
            return refuse(res, 503, "book_narration_busy", "The book's voice is busy. Please try again later.", { retryable: true });
          }
          // the machine ear: the child's first name must be in the take
          if (deps.check && !deps.mock && !(await deps.check(take.audio, take.ext, firstName, tts.lang).catch(() => false))) continue;
          const rel = relOf(take.ext);
          const f = bucket.file(bookAssetObject(childId, bookId, rel));
          if (!f.save) return refuse(res, 503, "book_storage_unavailable", "Book storage is not available");
          await f.save(take.audio, { contentType: take.ext === "wav" ? "audio/wav" : "audio/mpeg", resumable: false, metadata: { cacheControl: "private, max-age=86400", metadata: {} } });
          stored = rel;
        }
        if (!stored) return refuse(res, 422, "book_narration_check_failed", "The voice did not say the name clearly; nothing was stored", { takes });
      }
      // 7. The doc moves to this name's set once the voice folder has every name file.
      const updated = await updateNarrationDoc({ bucket, docs: deps.docs, owner, childId, bookId, doc, setId, folder, book });
      res.json({ ok: true, path: stored, takes, cached: takes === 0, complete: !!updated, ...(updated ? { doc: updated } : {}), ...(deps.local ? { local: true } : {}) });
    } catch (error: unknown) {
      logger.error("Book narration error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      refuse(res, 500, "book_narration_failed", "Failed to make the narration");
    }
  });
  return router;
}

/** Point the doc at `setId` when the folder has every name-bearing file;
 *  remove an older name's set. Returns the new doc, or null (not complete yet). */
export async function updateNarrationDoc(a: {
  bucket: BookAssetBucket; docs: BookAssetsDocStore; owner: string; childId: string; bookId: string;
  doc: BookAssetsDoc; setId: string; folder: VoiceFolder; book: NonNullable<ReturnType<typeof getLibraryBook>>;
}): Promise<BookAssetsDoc | null> {
  const prefix = `${childBookAssetPrefix(a.childId)}${a.bookId}/`;
  const [listed] = await a.bucket.getFiles({ prefix: `${prefix}narration/` });
  const rels = listed.map((f) => f.name.slice(prefix.length)).filter(isBookAssetRel);
  const mine = rels.filter((r) => r.startsWith(`narration/${a.setId}/`));
  const has = (file: string) => mine.some((r) => r === `narration/${a.setId}/${a.folder}/${file}` || r === `narration/${a.setId}/${a.folder}/${file.replace(/\.mp3$/, ".wav")}`);
  if (!nameBearingFiles(a.book, a.folder).filter((f) => f.endsWith(".mp3")).every(has)) return null;
  const doc: BookAssetsDoc = {
    ...a.doc,
    setId: a.setId,
    sets: [a.setId],
    files: [...a.doc.files.filter((r) => !r.startsWith("narration/")), ...mine].sort(),
  };
  if (doc.setId !== a.doc.setId || doc.files.length !== a.doc.files.length) await a.docs.write(a.owner, a.childId, doc);
  // an older NAME's set (n-*) goes; a set this pipeline did not make stays
  const stale = listed.filter((f) => {
    const set = f.name.slice(prefix.length).split("/")[1] ?? "";
    return /^n-[0-9a-f]{16}$/.test(set) && set !== a.setId;
  });
  await Promise.all(stale.map((f) => f.delete().catch(() => undefined)));
  return doc;
}
