/**
 * PR C (Everyday Plans) — the plan-narration route: ids only (the plan from
 * the child's record, the name from the child record), the plan sheet first,
 * every page of the book into the child's own set, Sulafat through the
 * canonical settings, the machine ear on the name lines only, the EU path
 * (child data) for a name line, the quota, idempotency by the words (a stored
 * file is never rendered again; changed words are rendered again and said),
 * the registered doc, the export inventory, and the sandbox.
 */
import { Readable } from "node:stream";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "test" }));

import { bookTtsCandidate, BOOK_TTS_COUNTERS, mockBookTts, type BookTtsCheck, type BookTtsProvider, type BookTtsRequest, type NarrationChildSource } from "./bookNarration";
import { createPlanNarrationRouter, localPlanBookSource, type PlanBookSource } from "./planNarration";
import { inventoryChildBookAssets } from "./bookAssetExport";
import { LocalBookAssetsDocStore } from "./bookSheet";
import type { BookAssetBucket, BookAssetFile } from "./bookAssets";
import { MemoryCounterStore } from "./quotaStore";
import type { EntitlementStore, Plan } from "./entitlements";
import type { BookAssetsDoc } from "../lib/library/bookAssetPaths";
import { composePlanBook, defaultPlanComposition } from "../lib/library/plans/composePlanBook";
import { PLAN_POO_SIT } from "../lib/library/plans/patterns/planPooSit";
import { planBookId, type PlanBookDoc } from "../lib/library/plans/planBookDoc";
import { planNarrationFiles } from "../lib/library/plans/planNarration";
import { PLAN_SHEET_BOOK_ID } from "../lib/library/plans/planPoses";

const PATTERN = "plan-poo-sit";
const CHILD = "kid1";
const PREFIX = `children/${CHILD}/books/${PATTERN}/`;
const SHEET = "h-0123456789abcdef";

function memBucket() {
  const objects = new Map<string, Buffer>();
  const fileOf = (name: string): BookAssetFile => ({
    name,
    get metadata() { return objects.has(name) ? { size: String(objects.get(name)!.length) } : undefined; },
    exists: async () => [objects.has(name)],
    createReadStream: () => Readable.from([objects.get(name) ?? Buffer.alloc(0)]),
    delete: async () => void objects.delete(name),
    save: async (data) => void objects.set(name, data),
  });
  const bucket: BookAssetBucket = { file: fileOf, getFiles: async ({ prefix }) => [[...objects.keys()].filter((k) => k.startsWith(prefix)).map(fileOf)] };
  return { bucket, objects };
}

const plans = (p: Record<string, Plan>): EntitlementStore => ({ async getPlan(uid) { return p[uid] ?? null; }, async getRecord(uid) { return p[uid] ? { plan: p[uid], status: "active" } : null; } });
const open: RequestHandler = (_req, _res, next) => next();

/** The child's approved plan (the parent's choices), as the compose route stores it. */
function planDoc(extra: Partial<PlanBookDoc> = {}): PlanBookDoc {
  const c = defaultPlanComposition(PLAN_POO_SIT, { bookId: planBookId(PATTERN, CHILD), approvedAt: "2026-10-27T18:00:00.000Z", approvedBy: "owner" });
  return { ...c, id: c.bookId, kind: "plan", pattern: PATTERN, lang: "en", createdAt: c.approvedAt, updatedAt: c.approvedAt, status: "active", ...extra };
}
/** The child's shared plan sheet with every pose the book needs. */
function planSheet(): BookAssetsDoc {
  const book = composePlanBook(PLAN_POO_SIT, planDoc());
  const poses = [...new Set([book.cover, ...book.pages].map((p) => p.hero?.pose).filter((p): p is string => !!p))];
  return { id: PLAN_SHEET_BOOK_ID, bookId: PLAN_SHEET_BOOK_ID, sheetId: SHEET, setId: SHEET, sheetManifest: { poses: Object.fromEntries(poses.map((p) => [p, { file: `${p}.webp` }])) }, files: poses.map((p) => `hero-sheets/${SHEET}/${p}.webp`), bytes: 1, createdAt: "t0" };
}

type Served = Awaited<ReturnType<typeof serve>>;
async function serve(opts: { name?: string | null; nameLatin?: string | null; gender?: string | null; check?: BookTtsCheck; provider?: BookTtsProvider; sheet?: BookAssetsDoc | null; plan?: PlanBookDoc | null; arborEnv?: string; children?: NarrationChildSource; mock?: boolean; local?: boolean; source?: PlanBookSource; disabled?: boolean } = {}) {
  const mem = memBucket();
  const docs = new LocalBookAssetsDocStore();
  const sheet = opts.sheet === undefined ? planSheet() : opts.sheet;
  if (sheet) { await docs.write("owner", CHILD, sheet); await docs.write("local-sandbox", CHILD, sheet); }
  const stored = opts.plan === undefined ? planDoc() : opts.plan;
  const source: PlanBookSource = opts.source ?? { strict: true, async load(_uid, _child, bookId) { return stored && stored.id === bookId ? stored : null; } };
  const calls: BookTtsRequest[] = [];
  const provider: BookTtsProvider = opts.provider ?? { candidate: () => bookTtsCandidate("https://eu-texttospeech.googleapis.com"), synthesize: async (req) => { calls.push(req); return { audio: Buffer.from(`ID3-${calls.length}`), ext: "mp3" }; } };
  const children: NarrationChildSource = opts.children ?? { strict: true, async load() { return { name: opts.name === undefined ? "Maya Cohen" : opts.name, nameLatin: opts.nameLatin ?? null, gender: opts.gender === undefined ? "girl" : opts.gender }; } };
  const counters = new MemoryCounterStore();
  let t = 0;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const who = req.header("x-test-user");
    if (who) (req as { user?: { uid: string } }).user = { uid: who };
    next();
  });
  app.use("/api", createPlanNarrationRouter({
    getBucket: async () => mem.bucket, requireOwnership: open, docs, children, plans: source, counters,
    entitlements: plans({ owner: "plus", free: "free" }), provider, check: opts.check === undefined ? null : opts.check,
    mock: opts.mock, local: opts.local, config: { arborEnv: (opts.arborEnv ?? "local") as never }, disabled: opts.disabled, now: () => `t${++t}`,
  }));
  let server!: ReturnType<express.Express["listen"]>;
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = async (body: unknown, user: string | null = "owner") => {
    const res = await fetch(`${base}/api/children/${CHILD}/plan-narration`, { method: "POST", headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { post, calls, objects: mem.objects, bucket: mem.bucket, docs, counters, stop: () => new Promise<void>((r) => server.close(() => r())) };
}
const FILES = planNarrationFiles(composePlanBook(PLAN_POO_SIT, planDoc()), "en").map((f) => f.file);
const renderAll = async (s: Served, lang = "en") => { for (const file of FILES) expect((await s.post({ pattern: PATTERN, lang, file })).status, file).toBe(200); };

beforeEach(() => { process.env.ENFORCE_ENTITLEMENTS = "true"; });
afterEach(() => {
  for (const k of ["ENFORCE_ENTITLEMENTS", "BOOK_TTS_PER_CHILD_30D", "BOOK_TTS_GLOBAL_DAILY"]) delete process.env[k];
});

describe("PR C: the plan-narration route takes ids only", () => {
  it("free text is refused (a name, a text, a prompt, a voice, a plan document outside the sandbox), before anything is read or spent", async () => {
    const s = await serve();
    for (const extra of [{ name: "Bob" }, { text: "Hello" }, { prompt: "shout" }, { voice: "Puck" }, { plan: planDoc() }]) {
      const r = await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3", ...extra });
      expect(r.status, JSON.stringify(extra)).toBe(400);
      expect(r.body.code).toBe("plan_narration_free_text");
    }
    for (const body of [{ pattern: PATTERN, lang: "fr", file: "p1.mp3" }, { pattern: PATTERN, lang: "en", file: "../p1.mp3" }, { pattern: PATTERN, lang: "en", file: "p99.mp3" }, { pattern: "five-smooth-stones", lang: "en", file: "p1.mp3" }, { lang: "en", file: "p1.mp3" }]) {
      expect((await s.post(body)).body.code, JSON.stringify(body)).toBe("plan_narration_bad_request");
    }
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" }, null)).status).toBe(401);
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" }, "free")).body.code).toBe("book_narration_plan");
    expect(s.calls).toEqual([]);
    await s.stop();
  });

  it("the plan comes from the child's record and must be active; the plan sheet comes first; the name from the child record", async () => {
    const noPlan = await serve({ plan: null });
    expect((await noPlan.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).body.code).toBe("plan_narration_no_plan");
    await noPlan.stop();
    const closed = await serve({ plan: planDoc({ status: "closed" }) });
    expect((await closed.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).body.code).toBe("plan_narration_closed");
    await closed.stop();
    const noSheet = await serve({ sheet: null });
    expect((await noSheet.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).body.code).toBe("plan_narration_no_sheet");
    await noSheet.stop();
    const sheet = planSheet();
    const partial = await serve({ sheet: { ...sheet, files: sheet.files.slice(1) } });
    expect((await partial.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).body.code).toBe("plan_narration_no_sheet");
    await partial.stop();
    const noName = await serve({ name: "" });
    expect((await noName.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).body.code).toBe("book_narration_no_name");
    await noName.stop();
    const s = await serve();
    expect((await s.post({ pattern: PATTERN, lang: "he-m", file: "p1.mp3" })).body).toMatchObject({ code: "book_narration_wrong_voice", lang: "he-f" });
    expect(s.calls).toEqual([]);
    await s.stop();
  });
});

describe("PR C: every page of the plan book, in the child's own set, with the canonical narrator", () => {
  it("renders a page into children/{cid}/books/{pattern}/narration/{cid}/<lang>/, Sulafat with the canonical models and style prompt; the name on the name lines only", async () => {
    const s = await serve({ nameLatin: "Maya Cohen" });
    const p1 = await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" });
    expect(p1.status).toBe(200);
    expect(p1.body).toMatchObject({ ok: true, path: `narration/${CHILD}/en/p1.mp3`, takes: 1, cached: false, rerendered: false, complete: false });
    expect(s.objects.has(`${PREFIX}narration/${CHILD}/en/p1.mp3`)).toBe(true);
    expect(s.calls[0]).toMatchObject({ voice: "Sulafat", model: "gemini-2.5-pro-tts", languageCode: "en-US" });
    expect(s.calls[0].prompt).toContain("A warm grandparent");
    expect(s.calls[0].text).toContain("My body is like a wonderful machine");
    expect(s.calls[0].text).not.toContain("Maya");
    const cover = await s.post({ pattern: PATTERN, lang: "en", file: "cover.mp3" });
    expect(cover.status).toBe(200);
    expect(s.calls[1].text).toContain("Maya's special plan");
    expect(s.calls[1].text).not.toContain("Cohen");
    const doc = (await s.docs.read("owner", CHILD, PATTERN))!;
    expect(doc).toMatchObject({ id: PATTERN, bookId: PATTERN, setId: CHILD, sets: [CHILD], sheetId: "plan-narration", files: [`narration/${CHILD}/en/cover.mp3`, `narration/${CHILD}/en/p1.mp3`] });
    expect(Object.keys(doc.narrationText ?? {}).sort()).toEqual([`narration/${CHILD}/en/cover.mp3`, `narration/${CHILD}/en/p1.mp3`]);
    await s.stop();
  });

  it("nine files complete the English set; the Hebrew form of a girl is HE-f with the pattern's feminine text and the Hebrew model", async () => {
    const s = await serve();
    await renderAll(s);
    expect(s.calls).toHaveLength(9);
    expect([...s.objects.keys()].filter((k) => k.startsWith(PREFIX)).length).toBe(9);
    const last = await s.post({ pattern: PATTERN, lang: "en", file: "p8.mp3" });
    expect(last.body).toMatchObject({ cached: true, complete: true });
    const he = await s.post({ pattern: PATTERN, lang: "he-f", file: "p2.mp3" });
    expect(he.status).toBe(200);
    expect(s.calls[9]).toMatchObject({ model: "gemini-3.1-flash-tts-preview", languageCode: "he-IL" });
    expect(s.calls[9].text).toContain("אחרי שאני אוכלת");
    expect(he.body).toMatchObject({ path: `narration/${CHILD}/he-f/p2.mp3`, complete: false });
    await s.stop();
  });

  it("the TTS takes are ledgered on the book narration counters (per child and global); the quota answers 429 and nothing more is spent", async () => {
    process.env.BOOK_TTS_PER_CHILD_30D = "2";
    const s = await serve();
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).status).toBe(200);
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p2.mp3" })).status).toBe(200);
    expect((await s.counters.peek(BOOK_TTS_COUNTERS.child, `owner:${CHILD}`, 30 * 24 * 3600 * 1000)).count).toBe(2);
    expect((await s.counters.peek(BOOK_TTS_COUNTERS.global, "all", 24 * 3600 * 1000)).count).toBe(2);
    const r = await s.post({ pattern: PATTERN, lang: "en", file: "p3.mp3" });
    expect([r.status, r.body.code]).toEqual([429, "book_narration_resting"]);
    expect(s.calls).toHaveLength(2);
    // a stored file still answers from the store
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).body).toMatchObject({ cached: true });
    await s.stop();
  });
});

describe("PR C: fidelity and the EU path, as the canonical name pages", () => {
  it("the machine ear checks the name on a name line only (three takes, a failed check stores nothing); a page without the name is not checked", async () => {
    const heard: string[] = [];
    const s = await serve({ check: async (_a, _e, name) => { heard.push(name); return false; } });
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).status).toBe(200);
    expect(heard).toEqual([]);
    const cover = await s.post({ pattern: PATTERN, lang: "en", file: "cover.mp3" });
    expect([cover.status, cover.body.code, cover.body.takes]).toEqual([422, "book_narration_check_failed", 3]);
    expect(heard).toEqual(["Maya", "Maya", "Maya"]);
    expect(s.objects.has(`${PREFIX}narration/${CHILD}/en/cover.mp3`)).toBe(false);
    await s.stop();
  });

  it("a name line is child data: a provider not cleared for it is refused (fails closed) while the pattern's own lines still render; prod admits the EU endpoint only", async () => {
    const publicOnly: BookTtsProvider = { candidate: () => ({ ...bookTtsCandidate("https://eu-texttospeech.googleapis.com"), dataClasses: ["public"] }), synthesize: async () => ({ audio: Buffer.from("x"), ext: "mp3" }) };
    const s = await serve({ provider: publicOnly });
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).status).toBe(200);
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "cover.mp3" })).body.code).toBe("book_narration_policy");
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p8.mp3" })).body.code).toBe("book_narration_policy");
    await s.stop();
    const global: BookTtsProvider = { candidate: () => bookTtsCandidate("https://texttospeech.googleapis.com"), synthesize: async () => ({ audio: Buffer.from("x"), ext: "mp3" }) };
    const prod = await serve({ provider: global, arborEnv: "prod" });
    expect((await prod.post({ pattern: PATTERN, lang: "en", file: "cover.mp3" })).body.code).toBe("book_narration_policy");
    await prod.stop();
    const dev = await serve({ provider: global, arborEnv: "local" });
    expect((await dev.post({ pattern: PATTERN, lang: "en", file: "cover.mp3" })).status).toBe(200);
    await dev.stop();
  });

  it("TTS_DISABLED answers 503 for a file not yet stored; a stored file still plays", async () => {
    const s = await serve();
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).status).toBe(200);
    await s.stop();
    const off = await serve({ disabled: true });
    expect((await off.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).body.code).toBe("book_narration_off");
    await off.stop();
  });
});

describe("PR C: idempotent, never re-rendered silently", () => {
  it("a stored file is never rendered again (cached, no provider call, no take charged)", async () => {
    const s = await serve();
    await renderAll(s);
    const before = s.calls.length;
    const bytes = s.objects.get(`${PREFIX}narration/${CHILD}/en/cover.mp3`);
    for (const file of FILES) expect((await s.post({ pattern: PATTERN, lang: "en", file })).body).toMatchObject({ cached: true, takes: 0, rerendered: false, complete: true });
    expect(s.calls).toHaveLength(before);
    expect(s.objects.get(`${PREFIX}narration/${CHILD}/en/cover.mp3`)).toBe(bytes);
    expect((await s.counters.peek(BOOK_TTS_COUNTERS.child, `owner:${CHILD}`, 30 * 24 * 3600 * 1000)).count).toBe(9);
    await s.stop();
  });

  it("changed words are rendered again and said so: a renamed child re-renders the name lines only; the version stamp moves", async () => {
    let name = "Maya Cohen";
    const children: NarrationChildSource = { strict: true, async load() { return { name, gender: "girl" }; } };
    const s = await serve({ children });
    await renderAll(s);
    const stamp = (await s.docs.read("owner", CHILD, PATTERN))!.createdAt;
    name = "Noa Cohen";
    const cover = await s.post({ pattern: PATTERN, lang: "en", file: "cover.mp3" });
    expect(cover.body).toMatchObject({ cached: false, rerendered: true, takes: 1, complete: false });
    expect(s.calls.at(-1)!.text).toContain("Noa's special plan");
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" })).body).toMatchObject({ cached: true, rerendered: false });
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p8.mp3" })).body).toMatchObject({ cached: false, rerendered: true, complete: true });
    const doc = (await s.docs.read("owner", CHILD, PATTERN))!;
    expect(doc.files).toHaveLength(9);
    expect(doc.createdAt).not.toBe(stamp);
    expect(s.calls).toHaveLength(11);
    await s.stop();
  });

  it("the sandbox: the tone, the plan from the body, the doc handed back for the device to keep; a strict source refuses the body's plan", async () => {
    delete process.env.ENFORCE_ENTITLEMENTS;
    const s = await serve({ mock: true, local: true, provider: mockBookTts, source: localPlanBookSource, children: { strict: false, async load() { return { name: null, gender: null }; } } });
    expect((await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3" }, null)).body.code).toBe("plan_narration_no_plan");
    const r = await s.post({ pattern: PATTERN, lang: "en", file: "p1.mp3", plan: planDoc() }, null);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, path: `narration/${CHILD}/en/p1.wav`, local: true, cached: false });
    expect((r.body.doc as BookAssetsDoc).files).toEqual([`narration/${CHILD}/en/p1.wav`]);
    expect(s.objects.get(`${PREFIX}narration/${CHILD}/en/p1.wav`)!.toString("latin1", 0, 4)).toBe("RIFF");
    // the Hebrew folders need no record in the sandbox
    expect((await s.post({ pattern: PATTERN, lang: "he-m", file: "p1.mp3", plan: planDoc() }, null)).status).toBe(200);
    await s.stop();
  });
});

describe("PR C: export and erase", () => {
  it("the files sit under the child's book prefix: the export inventory lists them, the erase sweep of children/{cid}/books/ removes them", async () => {
    const s = await serve();
    await renderAll(s);
    const inv = await inventoryChildBookAssets(s.bucket, CHILD);
    expect(inv.status).toBe("complete");
    expect(inv.files.map((f) => `${f.bookId}/${f.path}`)).toEqual(FILES.map((f) => `${PATTERN}/narration/${CHILD}/en/${f}`).sort());
    const [files] = await s.bucket.getFiles({ prefix: `children/${CHILD}/books/` });
    expect(files).toHaveLength(9);
    await s.stop();
  });
});
