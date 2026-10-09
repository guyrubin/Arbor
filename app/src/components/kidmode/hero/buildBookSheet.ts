/**
 * buildBookSheet — K2 block 4b: the parent-side BOOK sheet builder. The child's
 * own hero on every page of a library book, drawn on the ONE hero pipeline.
 *
 * Parent side only, like buildHeroSheet: started from buildHeroSheet's
 * startHeroSheet / ensureHeroSheet (the hero accept, the parent shell) once the
 * game's idle exists — the server anchors every book pose on it. No Kid Mode
 * module imports this file (heroSheetBuilder.guard.test.ts).
 *
 * Per book (Five Smooth Stones today):
 *   POST .../book-assets/:bookId/commit { dryRun }   the resume probe: what the
 *        hero's folder already has; a book already showing this hero, an
 *        admin-uploaded sheet or a Free plan ends here (nothing drawn)
 *   per missing pose (17: every pose a page shows, not the costume-only one):
 *     POST /api/hero-pose { childId, pose, avatarHash }  (book prompt, anchored)
 *     -> heroKeyer.keyBookSprite (cut-out + QA gate, tight trim, anchors)
 *     -> on a QA reject: once more (counted on the book's own per-sheet calls)
 *     -> WebP <= 300 KB, else PNG <= 900 KB (Safari's canvas has no WebP encoder)
 *     -> PUT .../file?path=hero-sheets/h-<hash>/<pose>.<webp|png>
 *   then the choice cards (choiceCards.ts, no model call) and the commit — the
 *   ONLY step that makes the book visible. A refusal, the quota, a pose that
 *   keeps failing QA or a picture that cannot be encoded stop the build before
 *   the commit: nothing is half-committed, the book stays hidden; a later run
 *   resumes from the files already uploaded.
 * One build per child; a newer hero cancels the older build (the folder is
 * named by the hero, so two heroes never mix). Sandbox: the commit answers
 * `local` and the device keeps the doc in its local collection.
 */
import { authHeaders } from "../../../lib/api";
import { HERO_POSE_REFUSALS, type HeroPoseId } from "../../../lib/heroSheetContract";
import { bookAssetUrl, type BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
import { getLibraryBook } from "../../../lib/library/books";
import { bookSheetChoiceRel, bookSheetDrawPoses, bookSheetId, bookSheetPoseRel, sheetFileIn } from "../../../lib/library/bookSheet";
import type { Book } from "../../../lib/library/types";
import { bookSpriteAnchor, keyBookSprite, type BookSpriteAnchor, type RgbaImage } from "./heroKeyer";
import { browserImageDeps } from "./buildHeroSheet";
import { renderChoiceCards } from "./choiceCards";
import { encodeSpriteBrowser, type EncodedImage } from "./sheetImageEncode";

export const DEFAULT_SHEET_BOOK = "five-smooth-stones";

export type BookCall = { ok: true } | { ok: false; status: number; code: string };
export type BookPoseResponse = { ok: true; dataUrl: string } | { ok: false; status: number; code: string };
export type CommitProbe =
  | { ok: true; complete: boolean; missing: string[]; have: string[]; committed: boolean; admin: boolean }
  | { ok: false; status: number; code: string };
export type CommitResult = { ok: true; doc: BookAssetsDoc; local: boolean } | { ok: false; status: number; code: string };

/** A drawn, keyed book pose (in memory for the choice cards). */
export interface BookSprite {
  pose: string;
  sprite: RgbaImage;
  anchor: BookSpriteAnchor;
}

export interface BookBuilderDeps {
  requestPose(body: { childId: string; pose: HeroPoseId; avatarHash: string }): Promise<BookPoseResponse>;
  decode(dataUrl: string): Promise<RgbaImage>;
  /** WebP (<= 300 KB), else PNG (<= 900 KB), shrinking as needed; null when nothing fits. */
  encodeSprite(img: RgbaImage): Promise<EncodedImage | null>;
  upload(rel: string, body: Blob, anchor?: BookSpriteAnchor, opts?: { redrawn?: boolean }): Promise<BookCall>;
  probe(avatarHash: string): Promise<CommitProbe>;
  commitSheet(avatarHash: string): Promise<CommitResult>;
  /** 4e: the child's choice cards (crops of the book's composites), or none. */
  choiceCards?(book: Book, sprites: ReadonlyMap<string, BookSprite>): Promise<Record<string, EncodedImage>>;
  /** A sprite already uploaded in an earlier run (for the choice cards). */
  fetchSprite?(rel: string): Promise<RgbaImage | null>;
  /** Sandbox: the device keeps the committed doc (its local collection). */
  keepLocalDoc(doc: BookAssetsDoc): Promise<void>;
  sleep(ms: number): Promise<void>;
  /** True once a newer hero's build replaced this one. */
  cancelled?(): boolean;
}

export interface BookBuildResult {
  status: "complete" | "stopped" | "not-started" | "already";
  drawn: string[];
  skipped: string[];
  stoppedBy?: string;
  calls: number;
  doc?: BookAssetsDoc;
}

/** Refusals that end the build (nothing a retry can change today). */
const TERMINAL = new Set<string>([
  HERO_POSE_REFUSALS.plan, HERO_POSE_REFUSALS.photo, HERO_POSE_REFUSALS.missing, HERO_POSE_REFUSALS.auth,
  HERO_POSE_REFUSALS.upload, HERO_POSE_REFUSALS.resting, HERO_POSE_REFUSALS.anchor, HERO_POSE_REFUSALS.bookAnchor,
  HERO_POSE_REFUSALS.changed, "image_resting", "hero_pose_bad_request",
]);
/** The /api rate limit (30 a minute per IP) answers 429 without a code. */
const RATE_LIMITED = "http_429";
const RATE_WAIT_MS = 20_000;
const RATE_WAITS = 6;
const BUSY_RETRIES = 3;

type Drawn = { ok: true; sprite: BookSprite } | { ok: false; stop?: string; skip?: string };

async function callWithRetry<T extends { ok: boolean }>(fn: () => Promise<T>, deps: BookBuilderDeps, count?: () => void): Promise<T | { ok: false; status: number; code: string }> {
  for (let rate = 0, busy = 0; ; ) {
    count?.();
    const r = (await fn().catch(() => ({ ok: false, status: 0, code: "network" }))) as T | { ok: false; status: number; code: string };
    if (r.ok) return r;
    const code = (r as { code: string }).code;
    if (code === RATE_LIMITED && rate < RATE_WAITS) { rate++; await deps.sleep(RATE_WAIT_MS); continue; }
    if (TERMINAL.has(code) || code === RATE_LIMITED) return r;
    if (busy < BUSY_RETRIES) { busy++; await deps.sleep(4000 * 2 ** (busy - 1)); continue; }
    return r;
  }
}

/** Draw one book pose: route call, key (book mode), QA; one more try on a QA reject. */
async function drawBookPose(childId: string, pose: string, avatarHash: string, deps: BookBuilderDeps, count: () => void): Promise<Drawn> {
  for (let qaTry = 0; qaTry < 2; qaTry++) {
    const res = await callWithRetry(() => deps.requestPose({ childId, pose: pose as HeroPoseId, avatarHash }), deps, count);
    if (!res.ok) {
      const { code } = res as { code: string };
      return TERMINAL.has(code) || code === RATE_LIMITED ? { ok: false, stop: code } : { ok: false, skip: "busy" };
    }
    const img = await deps.decode((res as { dataUrl: string }).dataUrl).catch(() => null);
    if (!img) continue;
    const k = keyBookSprite(img);
    if (k.ok && k.sprite && k.anchor) return { ok: true, sprite: { pose, sprite: k.sprite, anchor: k.anchor } };
  }
  return { ok: false, skip: "qa" };
}

/** Build (or resume) the book sheet of the child's current hero. */
export async function buildBookSheet(input: { childId: string; avatarHash: string; bookId?: string }, deps: BookBuilderDeps): Promise<BookBuildResult> {
  const bookId = input.bookId ?? DEFAULT_SHEET_BOOK;
  const book = getLibraryBook(bookId);
  const { childId, avatarHash } = input;
  let calls = 0;
  const count = () => { calls++; };
  const drawn: string[] = [];
  const skipped: string[] = [];
  if (!book) return { status: "not-started", drawn, skipped, stoppedBy: "no-book", calls };
  const sheetId = bookSheetId(avatarHash);

  // 1. The resume probe (nothing drawn when the book already shows this hero).
  const probe = await callWithRetry(() => deps.probe(avatarHash), deps);
  if (!probe.ok) return { status: "not-started", drawn, skipped, stoppedBy: (probe as { code: string }).code, calls };
  const p = probe as Extract<CommitProbe, { ok: true }>;
  if (p.admin) return { status: "not-started", drawn, skipped, stoppedBy: "book_sheet_admin", calls };
  // A book already showing this hero is left alone (a recommit would refetch
  // every file on the child's device); the parent's Redraw recommits.
  if (p.committed) return { status: "already", drawn, skipped, calls };

  // 2. The missing poses, one at a time (the /api rate limit is per IP).
  const sprites = new Map<string, BookSprite>();
  const queue = bookSheetDrawPoses(book).filter((pose) => !sheetFileIn(p.have, (ext) => bookSheetPoseRel(sheetId, pose, ext)));
  for (const pose of queue) {
    if (deps.cancelled?.()) return { status: "stopped", drawn, skipped, stoppedBy: "superseded", calls };
    const d = await drawBookPose(childId, pose, avatarHash, deps, count);
    if (!d.ok) {
      const miss = d as { stop?: string; skip?: string };
      if (miss.stop) return { status: "stopped", drawn, skipped: [...skipped, pose], stoppedBy: miss.stop, calls };
      skipped.push(pose);
      continue;
    }
    const s = (d as { sprite: BookSprite }).sprite;
    const enc = await deps.encodeSprite(s.sprite).catch(() => null);
    if (!enc) return { status: "stopped", drawn, skipped: [...skipped, pose], stoppedBy: "image_too_large", calls };
    const up = await callWithRetry(() => deps.upload(bookSheetPoseRel(sheetId, pose, enc.ext), enc.body, s.anchor), deps);
    if (!up.ok) return { status: "stopped", drawn, skipped: [...skipped, pose], stoppedBy: (up as { code: string }).code, calls };
    sprites.set(pose, s);
    drawn.push(pose);
  }
  if (deps.cancelled?.()) return { status: "stopped", drawn, skipped, stoppedBy: "superseded", calls };

  // 3. The choice cards (4e): crops of the composites, on the device.
  if (deps.choiceCards) {
    const need = book.decision.choices.filter((c) => !sheetFileIn(p.have, (ext) => bookSheetChoiceRel(sheetId, c.id, ext)));
    if (need.length) {
      for (const c of need) {
        const pose = c.branch[0]?.hero?.pose;
        if (pose && !sprites.has(pose) && deps.fetchSprite) {
          const rel = sheetFileIn(p.have, (ext) => bookSheetPoseRel(sheetId, pose, ext));
          const img = rel ? await deps.fetchSprite(rel).catch(() => null) : null;
          if (img) sprites.set(pose, { pose, sprite: img, anchor: bookSpriteAnchor(img) });
        }
      }
      const cards = await deps.choiceCards(book, sprites).catch(() => ({} as Record<string, EncodedImage>));
      for (const c of need) {
        const card = cards[c.id];
        if (card) await callWithRetry(() => deps.upload(bookSheetChoiceRel(sheetId, c.id, card.ext), card.body), deps);
      }
    }
  }

  // 4. The commit: the book becomes visible, or stays hidden.
  const done = await callWithRetry(() => deps.commitSheet(avatarHash), deps);
  if (!done.ok) return { status: "stopped", drawn, skipped, stoppedBy: (done as { code: string }).code, calls };
  const ok = done as Extract<CommitResult, { ok: true }>;
  if (ok.local) await deps.keepLocalDoc(ok.doc).catch(() => undefined);
  return { status: "complete", drawn, skipped, calls, doc: ok.doc };
}

/* ── K2 4d: the parent's Redraw of one book pose ─────────────────────────────
 * From the review strip (components/profile/BookSheetStrip.tsx): the pose is
 * drawn once more for the same hero (counted on the book's own per-sheet
 * calls), uploaded over the old file with `redrawn`, and the sheet recommitted
 * (a new createdAt: the child's device fetches the new picture). One per pose:
 * the strip offers it only while the manifest entry is not `redrawn`.
 */
export async function redrawBookPose(input: { childId: string; avatarHash: string; pose: string; bookId?: string }, deps: BookBuilderDeps): Promise<{ ok: boolean; reason?: string; doc?: BookAssetsDoc }> {
  const { childId, avatarHash, pose } = input;
  const book = getLibraryBook(input.bookId ?? DEFAULT_SHEET_BOOK);
  if (!book || !bookSheetDrawPoses(book).includes(pose)) return { ok: false, reason: "not-in-sheet" };
  const d = await drawBookPose(childId, pose, avatarHash, deps, () => undefined);
  if (!d.ok) { const miss = d as { stop?: string; skip?: string }; return { ok: false, reason: miss.stop ?? miss.skip ?? "qa" }; }
  const s = (d as { sprite: BookSprite }).sprite;
  const enc = await deps.encodeSprite(s.sprite).catch(() => null);
  if (!enc) return { ok: false, reason: "image_too_large" };
  const up = await callWithRetry(() => deps.upload(bookSheetPoseRel(bookSheetId(avatarHash), pose, enc.ext), enc.body, s.anchor, { redrawn: true }), deps);
  if (!up.ok) return { ok: false, reason: (up as { code: string }).code };
  const done = await callWithRetry(() => deps.commitSheet(avatarHash), deps);
  if (!done.ok) return { ok: false, reason: (done as { code: string }).code };
  const ok = done as Extract<CommitResult, { ok: true }>;
  if (ok.local) await deps.keepLocalDoc(ok.doc).catch(() => undefined);
  return { ok: true, doc: ok.doc };
}

/* ── Browser wiring ──────────────────────────────────────────────────────── */

const codeOf = async (res: Response): Promise<string> => {
  try {
    const d = (await res.json()) as { code?: unknown };
    return typeof d?.code === "string" ? d.code : `http_${res.status}`;
  } catch {
    return `http_${res.status}`;
  }
};

/** The /api calls of one child and book, with the parent's token. */
export interface BookSheetApi {
  requestPose: BookBuilderDeps["requestPose"];
  upload: BookBuilderDeps["upload"];
  probe: BookBuilderDeps["probe"];
  commitSheet: BookBuilderDeps["commitSheet"];
  fetchSpriteBlob(rel: string): Promise<Blob | null>;
}

/** `origin` = "" in the app (same origin); the dry-run test passes its server's. */
export function bookSheetApi(childId: string, bookId: string = DEFAULT_SHEET_BOOK, origin = ""): BookSheetApi {
  const base = `${origin}/api/children/${encodeURIComponent(childId)}/book-assets/${encodeURIComponent(bookId)}`;
  const post = async (body: unknown) => fetch(`${base}/commit`, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
  const fetchSpriteBlob = async (rel: string): Promise<Blob | null> => {
    const headers = await authHeaders();
    delete headers["Content-Type"];
    const res = await fetch(`${origin}${bookAssetUrl(childId, bookId, rel)}`, { headers, credentials: "same-origin" });
    return res.ok ? res.blob() : null;
  };
  return {
    async requestPose(body) {
      const res = await fetch(`${origin}/api/hero-pose`, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) return { ok: false, status: res.status, code: await codeOf(res) };
      const d = (await res.json().catch(() => null)) as { dataUrl?: unknown } | null;
      return typeof d?.dataUrl === "string" ? { ok: true, dataUrl: d.dataUrl } : { ok: false, status: res.status, code: "bad_response" };
    },
    async upload(rel, body, anchor, opts) {
      const q = new URLSearchParams({ path: rel, ...(anchor ? { aspect: String(anchor.aspect), footX: String(anchor.footX), footW: String(anchor.footW) } : {}), ...(opts?.redrawn ? { redrawn: "1" } : {}) });
      const headers = await authHeaders();
      headers["Content-Type"] = rel.endsWith(".png") ? "image/png" : "image/webp";
      const res = await fetch(`${base}/file?${q}`, { method: "PUT", headers, body });
      return res.ok ? { ok: true } : { ok: false, status: res.status, code: await codeOf(res) };
    },
    async probe(avatarHash) {
      const res = await post({ avatarHash, dryRun: true });
      if (!res.ok) return { ok: false, status: res.status, code: await codeOf(res) };
      const d = (await res.json()) as { complete?: boolean; missing?: string[]; have?: string[]; committed?: boolean; admin?: boolean };
      return { ok: true, complete: !!d.complete, missing: d.missing ?? [], have: d.have ?? [], committed: !!d.committed, admin: !!d.admin };
    },
    async commitSheet(avatarHash) {
      const res = await post({ avatarHash });
      if (!res.ok) return { ok: false, status: res.status, code: await codeOf(res) };
      const d = (await res.json()) as { doc?: BookAssetsDoc; local?: boolean };
      return d.doc ? { ok: true, doc: d.doc, local: !!d.local } : { ok: false, status: res.status, code: "bad_response" };
    },
    fetchSpriteBlob,
  };
}

/** Sandbox: the committed doc into the device's local `bookAssets` collection
 *  (the useChildCollection local shape: one array per child). */
export function keepLocalBookDoc(childId: string, storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null) {
  return async (doc: BookAssetsDoc): Promise<void> => {
    if (!storage) return;
    const key = `arbor.bookAssets.${childId}`;
    let list: BookAssetsDoc[] = [];
    try {
      const raw: unknown = JSON.parse(storage.getItem(key) ?? "[]");
      if (Array.isArray(raw)) list = raw as BookAssetsDoc[];
    } catch {
      list = [];
    }
    storage.setItem(key, JSON.stringify([...list.filter((d) => d?.id !== doc.id), doc]));
  };
}

/* ── One build per child ─────────────────────────────────────────────────── */

const running = new Map<string, { hash: string; cancel: () => void; job: Promise<BookBuildResult> }>();

/**
 * Start (or join) the book sheet of the child's hero. A build of another hero
 * for the same child is cancelled first (it stops between poses; nothing of it
 * is committed) and the new one starts once it has stopped.
 */
export function startBookSheet(input: { childId: string; avatarHash: string; bookId?: string }, makeDeps: (cancelled: () => boolean) => BookBuilderDeps): Promise<BookBuildResult> {
  const live = running.get(input.childId);
  if (live && live.hash === input.avatarHash) return live.job;
  let stop = false;
  const before = live ? (live.cancel(), live.job.catch(() => undefined)) : Promise.resolve(undefined);
  const job = before
    .then(() => buildBookSheet(input, makeDeps(() => stop)))
    .catch((): BookBuildResult => ({ status: "stopped", drawn: [], skipped: [], stoppedBy: "error", calls: 0 }))
    .finally(() => {
      if (running.get(input.childId)?.job === job) running.delete(input.childId);
    });
  running.set(input.childId, { hash: input.avatarHash, cancel: () => { stop = true; }, job });
  return job;
}

/** True while this device is drawing a book sheet for the child. */
export function bookSheetRunning(childId: string): boolean {
  return running.has(childId);
}

/** The browser builder of one child's book sheet (parent side). */
export function browserBookBuilderDeps(childId: string, cancelled: () => boolean, bookId: string = DEFAULT_SHEET_BOOK): BookBuilderDeps {
  const api = bookSheetApi(childId, bookId);
  return {
    requestPose: api.requestPose,
    upload: api.upload,
    probe: api.probe,
    commitSheet: api.commitSheet,
    decode: browserImageDeps.decode,
    encodeSprite: encodeSpriteBrowser,
    choiceCards: renderChoiceCards,
    async fetchSprite(rel) {
      const blob = await api.fetchSpriteBlob(rel);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      try {
        return await browserImageDeps.decode(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    keepLocalDoc: keepLocalBookDoc(childId),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    cancelled,
  };
}

/** Called by buildHeroSheet once the game's idle of this hero exists. */
export function startBrowserBookSheet(childId: string, avatarHash: string): Promise<BookBuildResult> {
  return startBookSheet({ childId, avatarHash }, (cancelled) => browserBookBuilderDeps(childId, cancelled));
}
