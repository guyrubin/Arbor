/**
 * K2 2b — the book's narration in the child's name: ids only (never free text),
 * only the name-bearing files, the name from the child record, the machine
 * ear's check (a failed check stores nothing), the quota (429), the residency
 * policy for child data, the doc moving to the name's set when the voice
 * folder is complete, and the sandbox's tone.
 */
import { Readable } from "node:stream";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "test" }));

import { bookTtsCandidate, createBookNarrationRouter, localNarrationChildSource, mockBookTts, mockToneWav, narrationSetId, type BookTtsCheck, type BookTtsProvider, type BookTtsRequest, type NarrationChildSource } from "./bookNarration";
import { LocalBookAssetsDocStore } from "./bookSheet";
import type { BookAssetBucket, BookAssetFile } from "./bookAssets";
import { MemoryCounterStore } from "./quotaStore";
import type { EntitlementStore, Plan } from "./entitlements";
import type { BookAssetsDoc } from "../lib/library/bookAssetPaths";

const BOOK = "five-smooth-stones";
const SHEET = "h-0123456789abcdef";
const PREFIX = `children/kid1/books/${BOOK}/`;

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
const DOC: BookAssetsDoc = { id: BOOK, bookId: BOOK, sheetId: SHEET, setId: "none", sets: ["none"], sheetManifest: { poses: {} }, files: [`hero-sheets/${SHEET}/sit.webp`], bytes: 1, createdAt: "t0" };

async function serve(opts: { name?: string | null; gender?: string | null; check?: BookTtsCheck; provider?: BookTtsProvider; doc?: BookAssetsDoc | null; arborEnv?: string; children?: NarrationChildSource; mock?: boolean; local?: boolean } = {}) {
  const mem = memBucket();
  const docs = new LocalBookAssetsDocStore();
  const doc = opts.doc === undefined ? DOC : opts.doc;
  if (doc) await docs.write("owner", "kid1", doc);
  if (doc) await docs.write("local-sandbox", "kid1", doc);
  const calls: BookTtsRequest[] = [];
  const provider: BookTtsProvider = opts.provider ?? { candidate: () => bookTtsCandidate("https://eu-texttospeech.googleapis.com"), synthesize: async (req) => { calls.push(req); return { audio: Buffer.from("ID3-take"), ext: "mp3" }; } };
  const children: NarrationChildSource = opts.children ?? { strict: true, async load() { return { name: opts.name === undefined ? "Maya Cohen" : opts.name, gender: opts.gender === undefined ? "girl" : opts.gender }; } };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const who = req.header("x-test-user");
    if (who) (req as { user?: { uid: string } }).user = { uid: who };
    next();
  });
  app.use("/api", createBookNarrationRouter({
    getBucket: async () => mem.bucket, requireOwnership: open, docs, children, counters: new MemoryCounterStore(),
    entitlements: plans({ owner: "plus", free: "free" }), provider, check: opts.check === undefined ? null : opts.check,
    mock: opts.mock, local: opts.local, config: { arborEnv: (opts.arborEnv ?? "local") as never },
  }));
  let server!: ReturnType<express.Express["listen"]>;
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = async (body: unknown, user: string | null = "owner") => {
    const res = await fetch(`${base}/api/children/kid1/book-narration`, { method: "POST", headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { post, calls, objects: mem.objects, docs, stop: () => new Promise<void>((r) => server.close(() => r())) };
}

beforeEach(() => { process.env.ENFORCE_ENTITLEMENTS = "true"; });
afterEach(() => {
  for (const k of ["ENFORCE_ENTITLEMENTS", "BOOK_TTS_PER_CHILD_30D", "BOOK_TTS_GLOBAL_DAILY"]) delete process.env[k];
});

describe("K2 2b: the narration route takes ids only, and only the files that say the name", () => {
  it("free text is refused (a name, a text, a prompt, a voice), before anything is read or spent", async () => {
    const s = await serve();
    for (const extra of [{ name: "Bob" }, { text: "Hello" }, { prompt: "shout" }, { voice: "Puck" }]) {
      const r = await s.post({ bookId: BOOK, lang: "en", file: "p1.mp3", ...extra });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe("book_narration_free_text");
    }
    expect(s.calls).toEqual([]);
    await s.stop();
  });

  it("a name-free file is refused (the shared set says it); junk is refused", async () => {
    const s = await serve();
    const r = await s.post({ bookId: BOOK, lang: "en", file: "p2.mp3" });
    expect([r.status, r.body.code]).toEqual([400, "book_narration_name_free"]);
    for (const body of [{ bookId: BOOK, lang: "fr", file: "p1.mp3" }, { bookId: BOOK, lang: "en", file: "../p1.mp3" }, { bookId: BOOK, lang: "en", file: "p99.mp3" }, { bookId: "no-book", lang: "en", file: "p1.mp3" }, { lang: "en", file: "p1.mp3" }]) {
      expect((await s.post(body)).body.code, JSON.stringify(body)).toBe("book_narration_bad_request");
    }
    expect(s.calls).toEqual([]);
    await s.stop();
  });

  it("the name comes from the child record (first name only); Free, the wrong Hebrew form, no name, no book refused", async () => {
    const s = await serve();
    const r = await s.post({ bookId: BOOK, lang: "en", file: "p1.mp3" });
    expect(r.status).toBe(200);
    expect(s.calls[0].text.startsWith("Today, Maya is David")).toBe(true);
    expect(s.calls[0].text).not.toContain("Cohen");
    expect(s.calls[0]).toMatchObject({ voice: "Sulafat", model: "gemini-2.5-pro-tts", languageCode: "en-US" });
    expect(s.calls[0].prompt).toContain("A warm grandparent");
    expect((await s.post({ bookId: BOOK, lang: "he-m", file: "p1.mp3" })).body).toMatchObject({ code: "book_narration_wrong_voice", lang: "he-f" });
    const he = await s.post({ bookId: BOOK, lang: "he-f", file: "p1.mp3" });
    expect(he.status).toBe(200);
    expect(s.calls[1].text).toContain("Maya הִיא דָּוִד");
    expect(s.calls[1].model).toBe("gemini-3.1-flash-tts-preview");
    expect((await s.post({ bookId: BOOK, lang: "en", file: "p1.mp3" }, "free")).body.code).toBe("book_narration_plan");
    expect((await s.post({ bookId: BOOK, lang: "en", file: "p1.mp3" }, null)).status).toBe(401);
    await s.stop();
    const noName = await serve({ name: "" });
    expect((await noName.post({ bookId: BOOK, lang: "en", file: "p1.mp3" })).body.code).toBe("book_narration_no_name");
    await noName.stop();
    const noBook = await serve({ doc: null });
    expect((await noBook.post({ bookId: BOOK, lang: "en", file: "p1.mp3" })).body.code).toBe("book_narration_no_book");
    await noBook.stop();
    const admin = await serve({ doc: { ...DOC, sheetId: "dylan-v2" } });
    expect((await admin.post({ bookId: BOOK, lang: "en", file: "p1.mp3" })).body.code).toBe("book_sheet_admin");
    await admin.stop();
  });
});

describe("K2 2b: the check, the quota, the policy", () => {
  it("a failed check stores nothing: three takes, none says the name -> 422, no file, the doc unchanged", async () => {
    const heard: string[] = [];
    const s = await serve({ check: async (_a, _e, name) => { heard.push(name); return false; } });
    const r = await s.post({ bookId: BOOK, lang: "en", file: "p1.mp3" });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ code: "book_narration_check_failed", takes: 3 });
    expect(s.calls).toHaveLength(3);
    expect(heard).toEqual(["Maya", "Maya", "Maya"]);
    expect([...s.objects.keys()].filter((k) => k.includes("/narration/"))).toEqual([]);
    expect((await s.docs.read("owner", "kid1", BOOK))!.setId).toBe("none");
    await s.stop();
  });

  it("a take the check accepts on the second try is stored once", async () => {
    let n = 0;
    const s = await serve({ check: async () => ++n === 2 });
    const r = await s.post({ bookId: BOOK, lang: "en", file: "cover.mp3" });
    expect(r.body).toMatchObject({ ok: true, takes: 2, path: `narration/${narrationSetId("Maya")}/en/cover.mp3` });
    expect(s.objects.has(`${PREFIX}narration/${narrationSetId("Maya")}/en/cover.mp3`)).toBe(true);
    await s.stop();
  });

  it("429 on the quota (per child, then the global day)", async () => {
    process.env.BOOK_TTS_PER_CHILD_30D = "2";
    const s = await serve({ check: async () => false });
    const r = await s.post({ bookId: BOOK, lang: "en", file: "p1.mp3" });
    expect(r.status).toBe(429);
    expect(r.body).toMatchObject({ code: "book_narration_resting", window: "month" });
    expect(s.calls).toHaveLength(2);
    await s.stop();
    delete process.env.BOOK_TTS_PER_CHILD_30D;
    process.env.BOOK_TTS_GLOBAL_DAILY = "0";
    const g = await serve();
    expect((await g.post({ bookId: BOOK, lang: "en", file: "p1.mp3" })).body).toMatchObject({ code: "book_narration_resting", window: "day" });
    expect(g.calls).toEqual([]);
    await g.stop();
  });

  it("the provider carries child data: prod admits it only where it runs in the EU (fails closed)", async () => {
    const global: BookTtsProvider = { candidate: () => bookTtsCandidate("https://texttospeech.googleapis.com"), synthesize: async () => ({ audio: Buffer.from("x"), ext: "mp3" }) };
    expect(bookTtsCandidate("https://texttospeech.googleapis.com").dataClasses).toContain("child_profile");
    const prod = await serve({ provider: global, arborEnv: "prod" });
    expect((await prod.post({ bookId: BOOK, lang: "en", file: "p1.mp3" })).body.code).toBe("book_narration_policy");
    await prod.stop();
    const eu = await serve({ arborEnv: "prod" });
    expect((await eu.post({ bookId: BOOK, lang: "en", file: "p1.mp3" })).status).toBe(200);
    await eu.stop();
  });
});

describe("K2 2b: the doc follows the name", () => {
  const NAME_FILES = ["cover.mp3", "p1.mp3", "p10.a.mp3", "p10.b.mp3", "p10.c.mp3"];

  it("the doc moves to the name's set once the voice folder has every name file; a stored file is never re-rendered; a new name replaces the old set", async () => {
    let name = "Maya";
    const s = await serve({ children: { strict: true, async load() { return { name, gender: "girl" }; } } });
    for (const [i, file] of NAME_FILES.entries()) {
      const r = await s.post({ bookId: BOOK, lang: "en", file });
      expect(r.body.complete, file).toBe(i === NAME_FILES.length - 1);
    }
    const doc = (await s.docs.read("owner", "kid1", BOOK))!;
    const set = narrationSetId("Maya");
    expect(doc.setId).toBe(set);
    expect(doc.files.filter((f) => f.startsWith("narration/")).sort()).toEqual(NAME_FILES.map((f) => `narration/${set}/en/${f}`).sort());
    expect(doc.files).toContain(`hero-sheets/${SHEET}/sit.webp`);
    // a second ask is the stored file
    const again = await s.post({ bookId: BOOK, lang: "en", file: "p1.mp3" });
    expect(again.body).toMatchObject({ cached: true, takes: 0 });
    expect(s.calls).toHaveLength(5);
    // a new name: a new set, the old one goes once the new folder is complete
    name = "Noa";
    for (const file of NAME_FILES) await s.post({ bookId: BOOK, lang: "en", file });
    const next = (await s.docs.read("owner", "kid1", BOOK))!;
    expect(next.setId).toBe(narrationSetId("Noa"));
    expect([...s.objects.keys()].some((k) => k.includes(set))).toBe(false);
    await s.stop();
  });

  it("the sandbox (MODEL_PROVIDER=mock, no record on the server): a short tone, stored as WAV, no check, no spend", async () => {
    delete process.env.ENFORCE_ENTITLEMENTS;
    const s = await serve({ provider: mockBookTts, children: localNarrationChildSource, mock: true, local: true, check: async () => false });
    const r = await s.post({ bookId: BOOK, lang: "he-m", file: "p1.mp3" }, null);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, local: true });
    expect(String(r.body.path)).toMatch(/^narration\/n-[0-9a-f]{16}\/he-m\/p1\.wav$/);
    const wav = mockToneWav();
    expect(wav.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("latin1")).toBe("WAVE");
    await s.stop();
  });
});
