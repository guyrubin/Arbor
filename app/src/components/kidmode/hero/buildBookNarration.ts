/**
 * buildBookNarration — K2 block 2c (B-BOOK-30): the parent-side builder of the
 * book's narration IN THE CHILD'S NAME. Parent side only, like the sheet
 * builders (heroSheetBuilder.guard.test.ts): Kid Mode never imports it.
 *
 * Runs after a deliberate parent handover into Kids and, for that same
 * owner/child lifetime, after the book sheet commits. Mounting parent controls
 * or restoring a child session never starts narration. For the voice folder the child hears (EN, or HE-f for a girl
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
import { nameBearingFiles, type VoiceFolder } from "../../../lib/library/narrationFiles";
import type { BookReaderChild } from "../../../lib/library/types";
import { heroSheetOwnerKey } from "../../../lib/heroSheetStore";
export { narrationFolder } from "../../../lib/library/narrationVoice";
import { DEFAULT_SHEET_BOOK, keepLocalBookDoc } from "./buildBookSheet";

export type NarrationCall =
  | { ok: true; complete: boolean; cached: boolean; doc?: BookAssetsDoc; local?: boolean }
  | { ok: false; status: number; code: string };

export interface NarrationBuilderDeps {
  render(body: { bookId: string; lang: VoiceFolder; file: string }): Promise<NarrationCall>;
  keepLocalDoc(doc: BookAssetsDoc): Promise<void>;
  sleep(ms: number): Promise<void>;
  /** Retired owner/selection work stops before every new request and write. */
  isCurrent?(): boolean;
}

export interface NarrationBuildResult {
  status: "complete" | "stopped" | "not-started";
  files: string[];
  rendered: number;
  stoppedBy?: string;
}

export interface NarrationBuildScope {
  ownerKey: string;
  /** Captured by ProfileProvider; survives closing the entry control, not a
   * child/account change (including A–B–A). */
  isCurrent(): boolean;
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
  const current = () => deps.isCurrent?.() !== false;
  const retired = (): NarrationBuildResult => ({ status: "stopped", files, rendered, stoppedBy: "scope_changed" });
  for (const file of files) {
    let r: NarrationCall = { ok: false, status: 0, code: "network" };
    for (let rate = 0, busy = 0; ; ) {
      if (!current()) return retired();
      r = await deps.render({ bookId, lang: input.folder, file }).catch(() => ({ ok: false as const, status: 0, code: "network" }));
      if (!current()) return retired();
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
  if (!current()) return retired();
  if (doc && local) {
    try { await deps.keepLocalDoc(doc); }
    catch { return { status: "stopped", files, rendered, stoppedBy: "local_storage" }; }
  }
  if (!current()) return retired();
  return { status: "complete", files, rendered };
}

/* ── Browser wiring ──────────────────────────────────────────────────────── */

export function browserNarrationDeps(childId: string, isCurrent: () => boolean = () => true): NarrationBuilderDeps {
  return {
    isCurrent,
    async render(body) {
      const changed = { ok: false as const, status: 0, code: "scope_changed" };
      if (!isCurrent()) return changed;
      const headers = await authHeaders();
      if (!isCurrent()) return changed;
      const res = await fetch(`/api/children/${encodeURIComponent(childId)}/book-narration`, { method: "POST", headers, body: JSON.stringify(body) });
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = null;
      }
      if (!isCurrent()) return changed;
      if (!res.ok || !data) return { ok: false, status: res.status, code: typeof data?.code === "string" ? data.code : `http_${res.status}` };
      return { ok: true, complete: !!data.complete, cached: !!data.cached, ...(data.doc ? { doc: data.doc as BookAssetsDoc } : {}), local: !!data.local };
    },
    async keepLocalDoc(doc) {
      if (!isCurrent()) throw new Error("Narration scope changed");
      await keepLocalBookDoc(childId)(doc);
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

/* ── When it runs ────────────────────────────────────────────────────────── */

type NarrationStorage = Pick<Storage, "getItem" | "setItem"> | null;
function defaultStorage(): NarrationStorage {
  try { return typeof localStorage === "undefined" ? null : localStorage; }
  catch { return null; }
}
type NarrationContext = NarrationBuildScope & {
  name: string; latin: string; gender?: BookReaderChild["gender"]; folder: VoiceFolder; storage: NarrationStorage;
};
const contexts = new Map<string, NarrationContext>();
const running = new Map<string, { ctx: NarrationContext; job: Promise<NarrationBuildResult> }>();
const completed = new Set<string>();
// Keep the existing per-child key so export/erase cleanup still covers it.
// The v2 marker adds ownership; unowned legacy success markers are not trusted.
const MARK = (childId: string) => `arbor.bookNarration.${childId}`;
const contextKey = (owner: string, child: string) => JSON.stringify([owner, child]);
// B-KID-168: the server keys the child's set on both names (one set serves
// every voice), so a new name in English letters re-renders each folder once.
// Without one, the key and its saved marker are unchanged.
const keyOf = (c: NarrationContext) => JSON.stringify(c.latin ? [c.name, c.gender ?? "", c.folder, c.latin] : [c.name, c.gender ?? "", c.folder]);
const jobKey = (child: string, c: NarrationContext) => JSON.stringify([c.ownerKey, child, keyOf(c)]);
const markerOf = (c: NarrationContext) => JSON.stringify({ v: 2, owner: c.ownerKey, configuration: keyOf(c) });
const currentContext = (child: string, c: NarrationContext) => c.isCurrent()
  && heroSheetOwnerKey() === c.ownerKey && contexts.get(contextKey(c.ownerKey, child)) === c;

function start(childId: string, ctx: NarrationContext, deps?: NarrationBuilderDeps): Promise<NarrationBuildResult> {
  const key = jobKey(childId, ctx);
  const live = running.get(key);
  if (live?.ctx === ctx) return live.job;
  const current = () => currentContext(childId, ctx) && deps?.isCurrent?.() !== false;
  const base = deps ?? browserNarrationDeps(childId, current);
  const job = buildBookNarration({ childId, folder: ctx.folder }, { ...base, isCurrent: current })
    .then(r => {
      if (r.status === "complete" && current()) {
        completed.add(key);
        try { ctx.storage?.setItem(MARK(childId), markerOf(ctx)); } catch { /* memory still deduplicates */ }
      }
      // An admin-uploaded book keeps its own narration (the server refuses
      // every name file for it): ask once per page load, not on every entry.
      if (r.stoppedBy === "book_sheet_admin") completed.add(key);
      return r;
    })
    .catch((): NarrationBuildResult => ({ status: "stopped", files: [], rendered: 0, stoppedBy: "error" }))
    .finally(() => { if (running.get(key)?.job === job) running.delete(key); });
  running.set(key, { ctx, job });
  return job;
}

/** Explicit parent handover only. Share in-flight work and confirmed success;
 * a refusal, offline attempt or retired scope never poisons a later entry. */
export function ensureBookNarration(
  child: { id: string; name?: string | null; nameLatin?: string | null; gender?: BookReaderChild["gender"] } | null | undefined,
  folder: VoiceFolder,
  deps?: NarrationBuilderDeps,
  storage: NarrationStorage = defaultStorage(),
  scope?: NarrationBuildScope,
): Promise<NarrationBuildResult> | null {
  const name = (child?.name ?? "").trim();
  if (!child?.id || !name) return null;
  const ownerKey = scope?.ownerKey ?? heroSheetOwnerKey();
  if (ownerKey === "signed-out" || ownerKey !== heroSheetOwnerKey() || scope?.isCurrent() === false) return null;
  const slot = contextKey(ownerKey, child.id);
  const previous = contexts.get(slot);
  const next: NarrationContext = { name, latin: (child.nameLatin ?? "").trim(), gender: child.gender, folder, ownerKey,
    isCurrent: scope?.isCurrent ?? (() => heroSheetOwnerKey() === ownerKey), storage };
  const ctx = previous && currentContext(child.id, previous) && keyOf(previous) === keyOf(next) ? previous : next;
  contexts.set(slot, ctx);
  const key = jobKey(child.id, ctx);
  if (completed.has(key)) return null;
  let done: string | null = null;
  try { done = storage?.getItem(MARK(child.id)) ?? null; } catch { /* unconfirmed */ }
  if (done === markerOf(ctx)) { completed.add(key); return null; }
  return start(child.id, ctx, deps);
}

/** A committed sheet can continue only an existing explicit entry intent for
 * this same owner/child lifetime. It cannot revive a retired account's work. */
export function afterBookSheet(childId: string, deps?: NarrationBuilderDeps): Promise<NarrationBuildResult> | null {
  const ctx = contexts.get(contextKey(heroSheetOwnerKey(), childId));
  return ctx && currentContext(childId, ctx) ? start(childId, ctx, deps) : null;
}

/** B-BOOK-75 follow-up — the ONE stable attach point for plan-book narration:
 * called by the plan sheet builder (buildBookSheet.startBrowserPlanSheet) when
 * the child's shared plan sheet commits or already shows this hero, exactly
 * where `afterBookSheet` is called for a canonical book. Today it starts
 * nothing (the plan-narration step attaches here, same deps, same ledger);
 * it never renders at read time and never runs for a child without a sheet. */
export function afterPlanSheet(childId: string, deps?: NarrationBuilderDeps): Promise<NarrationBuildResult> | null {
  void childId; void deps;
  return null;
}

/** Test seam. */
export function resetBookNarrationForTest(): void {
  contexts.clear();
  running.clear();
  completed.clear();
}
