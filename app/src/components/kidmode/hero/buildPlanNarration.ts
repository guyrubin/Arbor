/**
 * buildPlanNarration — PR C (Everyday Plans): the parent-side builder of a
 * child's PLAN books' narration IN THE CHILD'S NAME, through the canonical
 * books' pipeline (buildBookNarration, server/planNarration.ts). Parent side
 * only, like the sheet builders (heroSheetBuilder.guard.test.ts): Kid Mode
 * never imports it.
 *
 * Runs for the plan books the kid shelf shows (an active plan whose poses the
 * child's shared plan sheet covers — lib/bookAssets.libraryBookEntries), in
 * the voice folder the child hears (EN, HE-f for a girl, HE-m otherwise):
 *   - after a deliberate parent handover into Kids (buildBookNarration's
 *     ensureBookNarration), and after a sheet commits in that same
 *     owner/child lifetime (afterBookSheet / afterPlanSheet — the sheet
 *     builders' one hook each);
 *   - when the parent approves a plan (PlanComposer: the approved document
 *     rides along, so the run does not wait for the collection to settle);
 *     with the plan sheet still drawing, the server refuses for now and the
 *     approval is REMEMBERED for this owner/child lifetime, so the sheet's
 *     commit (afterPlanSheet) continues it without a second parent act.
 * Per file it asks the server (ids only; the sandbox adds the plan document
 * the server has no record of):
 *   POST /api/children/:cid/plan-narration { pattern, lang, file }
 * The server renders (or finds) each page, charges the book-narration quota
 * and hands back the pattern's registered doc. Idempotent: a file whose words
 * are unchanged is never rendered again (the server's rule) and a device that
 * finished a configuration (the folder, the name, every plan's words) does not
 * ask again (the marker). A refusal or the quota stops the run; the next
 * explicit trigger resumes it.
 */
import { authHeaders } from "../../../lib/api";
import { libraryBookEntries } from "../../../lib/bookAssets";
import { heroFirstName } from "../../../lib/heroJourneyRender";
import { heroSheetOwnerKey } from "../../../lib/heroSheetStore";
import type { BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
import { narrationFolder } from "../../../lib/library/narrationVoice";
import { readPlanBookDoc, type PlanBookDoc } from "../../../lib/library/plans/planBookDoc";
import { planNarrationConfiguration, planNarrationFiles, planNarrationRequest, storedPlanNarration, type VoiceFolder } from "../../../lib/library/plans/planNarration";
import { isPlanBook, type BookReaderChild, type PatternId, type PlanBook } from "../../../lib/library/types";
import { planDocsOnDevice, readPlanNarrationSource, type PlanNarrationSource } from "../../../lib/planNarrationSource";
import { storyName } from "../../../lib/storyName";
import { keepLocalBookDoc } from "./buildBookSheet";

export { narrationFolder };
export type { PlanNarrationSource };

export type PlanNarrationCall =
  | { ok: true; complete: boolean; cached: boolean; rerendered?: boolean; doc?: BookAssetsDoc; local?: boolean }
  | { ok: false; status: number; code: string };

export interface PlanNarrationBuilderDeps {
  read(childId: string): Promise<PlanNarrationSource>;
  render(body: { pattern: PatternId; lang: VoiceFolder; file: string; plan?: PlanBookDoc }): Promise<PlanNarrationCall>;
  keepLocalDoc(doc: BookAssetsDoc): Promise<void>;
  sleep(ms: number): Promise<void>;
  /** Retired owner/selection work stops before every new request and write. */
  isCurrent?(): boolean;
  /** Sandbox: the server has no record of the plan; the document rides in the body. */
  planInBody?: boolean;
}

export interface PlanNarrationBuildResult {
  status: "complete" | "stopped" | "not-started";
  /** The plan books the run covered (book ids). */
  books: string[];
  /** Files asked for / rendered now (not cached). */
  asked: number;
  rendered: number;
  stoppedBy?: string;
}

export interface PlanNarrationChild {
  id: string;
  name?: string | null;
  nameLatin?: string | null;
  gender?: BookReaderChild["gender"];
}

const RATE_LIMITED = new Set(["book_assets_rate", "http_429"]);
const BUSY = new Set(["book_narration_busy", "network", "http_500", "http_502", "http_503", "book_storage_unavailable"]);
/** The approved document may still be on its way to the server. */
const SETTLING = new Set(["plan_narration_no_plan"]);

/** The name the voice says in this folder (B-KID-168: English letters for the English voice). */
export const spokenFirstName = (child: PlanNarrationChild, folder: VoiceFolder): string =>
  heroFirstName({ name: storyName({ name: child.name ?? "", nameLatin: child.nameLatin ?? null }, folder === "en" ? "en" : "he") });

/** The plan books the shelf shows for this child, with their stored docs; an
 *  `extra` document (just approved) replaces the stored row of the same id. */
export function planEntriesOf(source: PlanNarrationSource, extra?: PlanBookDoc | null, now: Date = new Date()): { book: PlanBook; doc: PlanBookDoc; narration?: BookAssetsDoc }[] {
  const plans = extra ? [...source.plans.filter((p) => readPlanBookDoc(p)?.id !== extra.id), extra] : source.plans;
  const docs = new Map(plans.map((p) => readPlanBookDoc(p)).filter((p): p is PlanBookDoc => !!p).map((p) => [p.id, p]));
  return libraryBookEntries(source.docs, plans, now)
    .filter((e): e is typeof e & { book: PlanBook } => isPlanBook(e.book))
    .map((e) => ({ book: e.book, doc: docs.get(e.book.id)!, ...(e.narration ? { narration: e.narration } : {}) }))
    .filter((e) => !!e.doc);
}

/** Render (or find) every file of every plan book of one voice folder. */
export async function buildPlanNarration(input: { childId: string; folder: VoiceFolder; child: PlanNarrationChild; extra?: PlanBookDoc | null }, deps: PlanNarrationBuilderDeps): Promise<PlanNarrationBuildResult> {
  const current = () => deps.isCurrent?.() !== false;
  const firstName = spokenFirstName(input.child, input.folder);
  let entries: ReturnType<typeof planEntriesOf>;
  try {
    entries = planEntriesOf(await deps.read(input.childId), input.extra);
  } catch {
    return { status: "not-started", books: [], asked: 0, rendered: 0, stoppedBy: "read" };
  }
  const books = entries.map((e) => e.book.id);
  if (!entries.length) return { status: "not-started", books, asked: 0, rendered: 0, stoppedBy: "no-plan" };
  let asked = 0;
  let rendered = 0;
  const kept = new Map<string, BookAssetsDoc>();
  let local = false;
  const retired = (): PlanNarrationBuildResult => ({ status: "stopped", books, asked, rendered, stoppedBy: "scope_changed" });
  for (const e of entries) {
    for (const f of planNarrationFiles(e.book, input.folder)) {
      // a file this device already sees stored with the current words is not asked for
      const req = planNarrationRequest(e.book, input.folder, f.file, firstName);
      if (req && e.narration && !kept.has(e.book.pattern) && storedPlanNarration(e.narration, input.childId, input.folder, f.file, req.textHash)) continue;
      let r: PlanNarrationCall = { ok: false, status: 0, code: "network" };
      for (let rate = 0, busy = 0, settle = 0; ; ) {
        if (!current()) return retired();
        asked++;
        r = await deps.render({ pattern: e.book.pattern, lang: input.folder, file: f.file, ...(deps.planInBody ? { plan: e.doc } : {}) }).catch(() => ({ ok: false as const, status: 0, code: "network" }));
        if (!current()) return retired();
        if (r.ok) break;
        const { code } = r as { code: string };
        if (RATE_LIMITED.has(code) && rate < 6) { rate++; await deps.sleep(20_000); continue; }
        if (BUSY.has(code) && busy < 2) { busy++; await deps.sleep(8000 * busy); continue; }
        if (SETTLING.has(code) && settle < 3) { settle++; await deps.sleep(5000); continue; }
        break;
      }
      if (!r.ok) {
        const stop = (r as { code: string }).code;
        return { status: rendered || kept.size ? "stopped" : "not-started", books, asked, rendered, stoppedBy: stop };
      }
      const ok = r as Extract<PlanNarrationCall, { ok: true }>;
      if (!ok.cached) rendered++;
      if (ok.doc) kept.set(e.book.pattern, ok.doc);
      if (ok.local) local = true;
    }
  }
  if (!current()) return retired();
  if (local) {
    for (const doc of kept.values()) {
      try { await deps.keepLocalDoc(doc); }
      catch { return { status: "stopped", books, asked, rendered, stoppedBy: "local_storage" }; }
      if (!current()) return retired();
    }
  }
  return { status: "complete", books, asked, rendered };
}

/* ── Browser wiring ──────────────────────────────────────────────────────── */

export function browserPlanNarrationDeps(childId: string, isCurrent: () => boolean = () => true): PlanNarrationBuilderDeps {
  return {
    isCurrent,
    planInBody: planDocsOnDevice(),
    read: readPlanNarrationSource,
    async render(body) {
      const changed = { ok: false as const, status: 0, code: "scope_changed" };
      if (!isCurrent()) return changed;
      const headers = await authHeaders();
      if (!isCurrent()) return changed;
      const res = await fetch(`/api/children/${encodeURIComponent(childId)}/plan-narration`, { method: "POST", headers, body: JSON.stringify(body) });
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = null;
      }
      if (!isCurrent()) return changed;
      if (!res.ok || !data) return { ok: false, status: res.status, code: typeof data?.code === "string" ? data.code : `http_${res.status}` };
      return { ok: true, complete: !!data.complete, cached: !!data.cached, rerendered: !!data.rerendered, ...(data.doc ? { doc: data.doc as BookAssetsDoc } : {}), local: !!data.local };
    },
    async keepLocalDoc(doc) {
      if (!isCurrent()) throw new Error("Plan narration scope changed");
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

export interface PlanNarrationScope {
  ownerKey: string;
  isCurrent(): boolean;
}

const MARK = (childId: string) => `arbor.planNarration.${childId}`;
const running = new Map<string, Promise<PlanNarrationBuildResult | null>>();
const completed = new Set<string>();
/** The last explicit parent act per owner/child (the approval, the handover): what a sheet's commit may continue. */
const remembered = new Map<string, { child: PlanNarrationChild; folder: VoiceFolder; scope?: PlanNarrationScope; storage?: NarrationStorage }>();
const rememberKey = (owner: string, child: string) => JSON.stringify([owner, child]);
const jobKey = (owner: string, child: string, folder: VoiceFolder) => JSON.stringify([owner, child, folder]);
const markerOf = (owner: string, configuration: string) => JSON.stringify({ v: 1, owner, configuration });

/**
 * An explicit parent act only (the handover into Kids, the plan sheet's commit
 * in that lifetime, a plan's approval). Shares in-flight work per owner, child
 * and folder; confirmed completion of a configuration is remembered on the
 * device; a refusal or a retired scope never poisons a later trigger. Resolves
 * null when there is nothing to do.
 */
export function ensurePlanNarration(
  child: PlanNarrationChild | null | undefined,
  folder: VoiceFolder,
  opts: { scope?: PlanNarrationScope; planDoc?: PlanBookDoc | null; deps?: PlanNarrationBuilderDeps; storage?: NarrationStorage | undefined } = {},
): Promise<PlanNarrationBuildResult | null> | null {
  const name = (child?.name ?? "").trim();
  if (!child?.id || !name) return null;
  const ownerKey = opts.scope?.ownerKey ?? heroSheetOwnerKey();
  if (ownerKey === "signed-out" || ownerKey !== heroSheetOwnerKey() || opts.scope?.isCurrent() === false) return null;
  const isCurrent = () => heroSheetOwnerKey() === ownerKey && opts.scope?.isCurrent() !== false && opts.deps?.isCurrent?.() !== false;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  remembered.set(rememberKey(ownerKey, child.id), { child, folder, ...(opts.scope ? { scope: opts.scope } : {}), ...(opts.storage !== undefined ? { storage: opts.storage } : {}) });
  const key = jobKey(ownerKey, child.id, folder);
  const live = running.get(key);
  if (live) return live;
  const base = opts.deps ?? browserPlanNarrationDeps(child.id, isCurrent);
  const deps: PlanNarrationBuilderDeps = { ...base, isCurrent };
  const job = (async (): Promise<PlanNarrationBuildResult | null> => {
    // the configuration this device may already have finished: the folder, the name, every shelf plan's words
    let entries: ReturnType<typeof planEntriesOf>;
    try { entries = planEntriesOf(await deps.read(child.id), opts.planDoc); }
    catch { return null; }
    if (!isCurrent() || !entries.length) return null;
    const configuration = planNarrationConfiguration(entries.map((e) => e.book), folder, spokenFirstName(child, folder));
    const done = markerOf(ownerKey, configuration);
    if (completed.has(done)) return null;
    let marked: string | null = null;
    try { marked = storage?.getItem(MARK(child.id)) ?? null; } catch { /* unconfirmed */ }
    if (marked === done) { completed.add(done); return null; }
    const r = await buildPlanNarration({ childId: child.id, folder, child, extra: opts.planDoc }, deps);
    if (r.status === "complete" && isCurrent()) {
      completed.add(done);
      try { storage?.setItem(MARK(child.id), done); } catch { /* memory still deduplicates */ }
    }
    return r;
  })()
    .catch((): PlanNarrationBuildResult => ({ status: "stopped", books: [], asked: 0, rendered: 0, stoppedBy: "error" }))
    .finally(() => { if (running.get(key) === job) running.delete(key); });
  running.set(key, job);
  return job;
}

/** The plan sheet's commit (buildBookNarration.afterPlanSheet) continues the
 *  last explicit parent act for this owner/child in this page lifetime — the
 *  approval whose run the drawing sheet refused, or the handover. Nothing
 *  remembered, or a retired owner, starts nothing. */
export function afterPlanSheetNarration(childId: string, deps?: PlanNarrationBuilderDeps): Promise<PlanNarrationBuildResult | null> | null {
  const r = remembered.get(rememberKey(heroSheetOwnerKey(), childId));
  if (!r || r.scope?.isCurrent() === false) return null;
  return ensurePlanNarration(r.child, r.folder, { ...(r.scope ? { scope: r.scope } : {}), ...(deps ? { deps } : {}), ...(r.storage !== undefined ? { storage: r.storage } : {}) });
}

/** Test seam. */
export function resetPlanNarrationForTest(): void {
  running.clear();
  completed.clear();
  remembered.clear();
}
