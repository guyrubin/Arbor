/**
 * buildBookNarration — K2 block 2c (B-BOOK-30): the parent-side builder of the
 * book's narration IN THE CHILD'S NAME. Parent side only, like the sheet
 * builders (heroSheetBuilder.guard.test.ts): Kid Mode never imports it.
 *
 * Runs after the book sheet commits (buildBookSheet hands over) and again when
 * the child's name, Hebrew form or story language changes (the parent shell,
 * KidModeButton). For the voice folder the child hears (EN, or HE-f for a girl
 * and HE-m otherwise — the reader's heGender rule) it asks the server for each
 * file that says the name:
 *   POST /api/children/:cid/book-narration { bookId, lang, file }   (ids only)
 * The server reads the name from the child record, renders (or finds) the take
 * and moves the book to the name's set once the folder is complete; a stored
 * file is never re-rendered. A refusal or the quota stops the run (the book
 * keeps its earlier narration, or silence on the name pages). The sandbox
 * (MODEL_PROVIDER=mock) gets a tone, and the device keeps the doc.
 */
import { authHeaders } from "../../../lib/api";
import type { BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
import { getLibraryBook } from "../../../lib/library/books";
import { heGender } from "../../../lib/library/bookText";
import { nameBearingFiles, type VoiceFolder } from "../../../lib/library/narrationFiles";
import type { BookReaderChild } from "../../../lib/library/types";
import { DEFAULT_SHEET_BOOK, keepLocalBookDoc } from "./buildBookSheet";

export type NarrationCall =
  | { ok: true; complete: boolean; cached: boolean; doc?: BookAssetsDoc; local?: boolean }
  | { ok: false; status: number; code: string };

export interface NarrationBuilderDeps {
  render(body: { bookId: string; lang: VoiceFolder; file: string }): Promise<NarrationCall>;
  keepLocalDoc(doc: BookAssetsDoc): Promise<void>;
  sleep(ms: number): Promise<void>;
}

export interface NarrationBuildResult {
  status: "complete" | "stopped" | "not-started";
  files: string[];
  rendered: number;
  stoppedBy?: string;
}

/** The voice folder the child hears: the story language, then the Hebrew form. */
export function narrationFolder(lang: "en" | "he", gender: BookReaderChild["gender"]): VoiceFolder {
  return lang === "he" ? (heGender(gender) === "f" ? "he-f" : "he-m") : "en";
}

const RATE_LIMITED = new Set(["book_assets_rate", "http_429"]);
const BUSY = new Set(["book_narration_busy", "network", "http_500", "http_502", "http_503", "book_storage_unavailable"]);

/** Render (or find) every name file of one voice folder. */
export async function buildBookNarration(input: { childId: string; folder: VoiceFolder; bookId?: string }, deps: NarrationBuilderDeps): Promise<NarrationBuildResult> {
  const bookId = input.bookId ?? DEFAULT_SHEET_BOOK;
  const book = getLibraryBook(bookId);
  if (!book) return { status: "not-started", files: [], rendered: 0, stoppedBy: "no-book" };
  const files = nameBearingFiles(book, input.folder).filter((f) => f.endsWith(".mp3"));
  let rendered = 0;
  let doc: BookAssetsDoc | null = null;
  let local = false;
  for (const file of files) {
    let r: NarrationCall = { ok: false, status: 0, code: "network" };
    for (let rate = 0, busy = 0; ; ) {
      r = await deps.render({ bookId, lang: input.folder, file }).catch(() => ({ ok: false as const, status: 0, code: "network" }));
      if (r.ok) break;
      const { code } = r as { code: string };
      if (RATE_LIMITED.has(code) && rate < 6) { rate++; await deps.sleep(20_000); continue; }
      if (BUSY.has(code) && busy < 2) { busy++; await deps.sleep(8000 * (busy)); continue; }
      break;
    }
    if (!r.ok) {
      const stop = (r as { code: string }).code;
      return { status: rendered || doc ? "stopped" : "not-started", files, rendered, stoppedBy: stop };
    }
    const ok = r as Extract<NarrationCall, { ok: true }>;
    if (!ok.cached) rendered++;
    if (ok.doc) doc = ok.doc;
    if (ok.local) local = true;
  }
  if (doc && local) await deps.keepLocalDoc(doc).catch(() => undefined);
  return { status: "complete", files, rendered };
}

/* ── Browser wiring ──────────────────────────────────────────────────────── */

export function browserNarrationDeps(childId: string): NarrationBuilderDeps {
  return {
    async render(body) {
      const res = await fetch(`/api/children/${encodeURIComponent(childId)}/book-narration`, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = null;
      }
      if (!res.ok || !data) return { ok: false, status: res.status, code: typeof data?.code === "string" ? data.code : `http_${res.status}` };
      return { ok: true, complete: !!data.complete, cached: !!data.cached, ...(data.doc ? { doc: data.doc as BookAssetsDoc } : {}), local: !!data.local };
    },
    keepLocalDoc: keepLocalBookDoc(childId),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

/* ── When it runs ────────────────────────────────────────────────────────── */

type NarrationContext = { name: string; gender?: BookReaderChild["gender"]; folder: VoiceFolder };
const contexts = new Map<string, NarrationContext>();
const running = new Map<string, Promise<NarrationBuildResult>>();
const ensured = new Set<string>();
const MARK = (childId: string) => `arbor.bookNarration.${childId}`;
const keyOf = (c: NarrationContext) => `${c.name}|${c.gender ?? ""}|${c.folder}`;

function start(childId: string, ctx: NarrationContext, deps?: NarrationBuilderDeps, storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null): Promise<NarrationBuildResult> {
  const key = `${childId}|${keyOf(ctx)}`;
  const live = running.get(key);
  if (live) return live;
  const job = buildBookNarration({ childId, folder: ctx.folder }, deps ?? browserNarrationDeps(childId))
    .then((r) => {
      if (r.status === "complete") {
        try { storage?.setItem(MARK(childId), keyOf(ctx)); } catch { /* best effort */ }
      }
      return r;
    })
    .catch((): NarrationBuildResult => ({ status: "stopped", files: [], rendered: 0, stoppedBy: "error" }))
    .finally(() => running.delete(key));
  running.set(key, job);
  return job;
}

/**
 * The parent shell (KidModeButton): the child's narration for the folder they
 * hear. Once per child, name, Hebrew form and folder per page load; skipped
 * when this device already completed exactly that.
 */
export function ensureBookNarration(
  child: { id: string; name?: string | null; gender?: BookReaderChild["gender"] } | null | undefined,
  folder: VoiceFolder,
  deps?: NarrationBuilderDeps,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null,
): Promise<NarrationBuildResult> | null {
  const name = (child?.name ?? "").trim();
  if (!child?.id || !name) return null;
  const ctx: NarrationContext = { name, gender: child.gender, folder };
  contexts.set(child.id, ctx);
  const key = `${child.id}|${keyOf(ctx)}`;
  if (ensured.has(key)) return null;
  ensured.add(key);
  let done: string | null = null;
  try { done = storage?.getItem(MARK(child.id)) ?? null; } catch { done = null; }
  if (done === keyOf(ctx)) return null;
  return start(child.id, ctx, deps, storage);
}

/** buildBookSheet hands over after a commit: the narration of the child's
 *  last known name and folder follows (a book whose sheet just changed keeps
 *  its narration set; a new book gets its first). */
export function afterBookSheet(childId: string, deps?: NarrationBuilderDeps): Promise<NarrationBuildResult> | null {
  const ctx = contexts.get(childId);
  return ctx ? start(childId, ctx, deps) : null;
}

/** Test seam. */
export function resetBookNarrationForTest(): void {
  contexts.clear();
  running.clear();
  ensured.clear();
}
