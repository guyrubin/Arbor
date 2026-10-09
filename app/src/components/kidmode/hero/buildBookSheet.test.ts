/**
 * K2 4b — the book sheet builder on fake deps: the resume probe, 17 poses
 * drawn on the one pipeline and keyed in book mode, uploads with anchors, the
 * commit as the only visible step, nothing half-committed on a refusal or the
 * quota, the rate limit waited out, one build per child, the sandbox's doc.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeroPoseRaster } from "../../../lib/heroPoseMockArt";
import { bookSheetDrawPoses } from "../../../lib/library/bookSheet";
import { fiveSmoothStones as book } from "../../../lib/library/books/fiveSmoothStones";
import type { BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
import type { HeroPoseId } from "../../../lib/heroSheetContract";
import { buildBookSheet, keepLocalBookDoc, redrawBookPose, startBookSheet, type BookBuilderDeps, type BookPoseResponse, type CommitProbe } from "./buildBookSheet";

const HASH = "0123456789abcdef";
const DRAW = bookSheetDrawPoses(book);
const rel = (pose: string) => `hero-sheets/h-${HASH}/${pose}.webp`;
const DOC = { id: book.id, bookId: book.id, sheetId: `h-${HASH}`, setId: "none", sheetManifest: { poses: {} }, files: [], bytes: 0, createdAt: "t" } as BookAssetsDoc;

function fakeDeps(opts: Partial<BookBuilderDeps> & { have?: string[]; probeResult?: CommitProbe; commitLocal?: boolean } = {}) {
  const { have, probeResult, commitLocal, ...over } = opts;
  const uploads: { rel: string; anchor?: unknown }[] = [];
  const poses: string[] = [];
  const kept: BookAssetsDoc[] = [];
  const commits: string[] = [];
  const redrawn: string[] = [];
  const deps: BookBuilderDeps = {
    requestPose: vi.fn(async ({ pose }: { pose: HeroPoseId }): Promise<BookPoseResponse> => { poses.push(pose); return { ok: true, dataUrl: `mock:${pose}` }; }),
    decode: async (u) => mockHeroPoseRaster(u.slice(5) as HeroPoseId),
    encodeWebp: async () => new Blob(["RIFF"]),
    upload: async (r, _b, anchor, o) => { uploads.push({ rel: r, anchor }); if (o?.redrawn) redrawn.push(r); return { ok: true }; },
    probe: async () => probeResult ?? { ok: true, complete: false, missing: [], have: have ?? [], committed: false, admin: false },
    commitSheet: async (h) => { commits.push(h); return { ok: true, doc: DOC, local: !!commitLocal }; },
    keepLocalDoc: async (d) => void kept.push(d),
    sleep: async () => {},
    ...over,
  };
  return { deps, uploads, poses, kept, commits, redrawn };
}

describe("K2 4b: the book sheet builder", () => {
  it("draws the 17 book poses, uploads each with its anchors, then commits", async () => {
    const f = fakeDeps();
    const r = await buildBookSheet({ childId: "kid1", avatarHash: HASH }, f.deps);
    expect(r).toMatchObject({ status: "complete", calls: 17, skipped: [] });
    expect(f.poses.sort()).toEqual(DRAW);
    expect(f.uploads.map((u) => u.rel).sort()).toEqual(DRAW.map(rel).sort());
    for (const u of f.uploads) expect(u.anchor).toMatchObject({ aspect: expect.any(Number), footX: expect.any(Number), footW: expect.any(Number) });
    expect(f.commits).toEqual([HASH]);
    expect(f.kept).toEqual([]);
  }, 60_000);

  it("resumes: only the poses not uploaded yet are drawn; a book already showing this hero is left alone", async () => {
    const f = fakeDeps({ have: DRAW.slice(0, 12).map(rel) });
    const r = await buildBookSheet({ childId: "kid1", avatarHash: HASH }, f.deps);
    expect(r.status).toBe("complete");
    expect(f.poses.sort()).toEqual(DRAW.slice(12).sort());
    const done = fakeDeps({ probeResult: { ok: true, complete: true, missing: [], have: DRAW.map(rel), committed: true, admin: false } });
    expect((await buildBookSheet({ childId: "kid1", avatarHash: HASH }, done.deps)).status).toBe("already");
    expect(done.poses).toEqual([]);
    expect(done.commits).toEqual([]);
  }, 60_000);

  it("Free, an admin sheet or another hero: nothing is drawn and nothing committed", async () => {
    for (const probe of [
      { ok: false, status: 403, code: "hero_sheet_plan" },
      { ok: false, status: 409, code: "hero_changed" },
      { ok: true, complete: false, missing: [], have: [], committed: false, admin: true },
    ] as CommitProbe[]) {
      const f = fakeDeps({ probeResult: probe });
      const r = await buildBookSheet({ childId: "kid1", avatarHash: HASH }, f.deps);
      expect(r.status).toBe("not-started");
      expect(f.poses).toEqual([]);
      expect(f.commits).toEqual([]);
    }
  });

  it("the quota or a refusal mid-way stops the build before the commit (the book stays hidden)", async () => {
    let n = 0;
    const f = fakeDeps({ requestPose: async () => (++n === 5 ? { ok: false, status: 429, code: "hero_sheet_resting" } : { ok: true, dataUrl: "mock:worried" }) });
    const r = await buildBookSheet({ childId: "kid1", avatarHash: HASH }, f.deps);
    expect(r).toMatchObject({ status: "stopped", stoppedBy: "hero_sheet_resting" });
    expect(f.uploads).toHaveLength(4);
    expect(f.commits).toEqual([]);
  }, 60_000);

  it("a device that cannot encode WebP stops before any upload; the /api rate limit is waited out", async () => {
    const webp = fakeDeps({ encodeWebp: async () => null });
    expect((await buildBookSheet({ childId: "kid1", avatarHash: HASH }, webp.deps)).stoppedBy).toBe("webp_unsupported");
    expect(webp.uploads).toEqual([]);
    expect(webp.commits).toEqual([]);
    let limited = 2;
    const sleeps: number[] = [];
    const rate = fakeDeps({
      requestPose: async ({ pose }) => (limited-- > 0 ? { ok: false, status: 429, code: "http_429" } : { ok: true, dataUrl: `mock:${pose}` }),
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect((await buildBookSheet({ childId: "kid1", avatarHash: HASH }, rate.deps)).status).toBe("complete");
    expect(sleeps.slice(0, 2)).toEqual([20_000, 20_000]);
  }, 60_000);

  it("a pose that fails the QA gate twice is skipped; the commit decides (an incomplete sheet is refused)", async () => {
    const blank = { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4) };
    const f = fakeDeps({
      decode: async (u) => (u === "mock:sit" ? blank : mockHeroPoseRaster(u.slice(5) as HeroPoseId)),
      commitSheet: async () => ({ ok: false, status: 409, code: "book_sheet_incomplete" }),
    });
    const r = await buildBookSheet({ childId: "kid1", avatarHash: HASH }, f.deps);
    expect(r).toMatchObject({ status: "stopped", stoppedBy: "book_sheet_incomplete", skipped: ["sit"] });
    expect(f.uploads.map((u) => u.rel)).not.toContain(rel("sit"));
  }, 60_000);

  it("the sandbox: a local commit's doc is kept in the device's local collection", async () => {
    const f = fakeDeps({ commitLocal: true });
    await buildBookSheet({ childId: "kid1", avatarHash: HASH }, f.deps);
    expect(f.kept).toEqual([DOC]);
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    mem.set("arbor.bookAssets.kid1", JSON.stringify([{ ...DOC, sheetId: "h-old" }, { id: "other" }]));
    await keepLocalBookDoc("kid1", storage)(DOC);
    expect(JSON.parse(mem.get("arbor.bookAssets.kid1")!)).toEqual([{ id: "other" }, DOC]);
  }, 60_000);

  it("one build per child: the same hero joins the running build; a newer hero cancels the older (never committed)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const commits: string[] = [];
    const make = (hash: string) => (cancelled: () => boolean): BookBuilderDeps => fakeDeps({
      requestPose: async ({ pose }) => { await gate; return { ok: true, dataUrl: `mock:${pose}` }; },
      commitSheet: async (h) => { commits.push(h); return { ok: true, doc: { ...DOC, sheetId: `h-${hash}` }, local: false }; },
      cancelled,
    }).deps;
    const a = startBookSheet({ childId: "kidX", avatarHash: HASH }, make(HASH));
    expect(startBookSheet({ childId: "kidX", avatarHash: HASH }, make(HASH))).toBe(a);
    const NEW = "fedcba9876543210";
    const b = startBookSheet({ childId: "kidX", avatarHash: NEW }, make(NEW));
    release();
    expect((await a).stoppedBy).toBe("superseded");
    expect((await b).status).toBe("complete");
    expect(commits).toEqual([NEW]);
  }, 60_000);

  it("4d: the parent's Redraw draws one pose again, uploads it marked redrawn and recommits; only a drawn book pose", async () => {
    const f = fakeDeps({ commitLocal: true });
    const r = await redrawBookPose({ childId: "kid1", avatarHash: HASH, pose: "sit" }, f.deps);
    expect(r).toMatchObject({ ok: true, doc: DOC });
    expect(f.poses).toEqual(["sit"]);
    expect(f.redrawn).toEqual([rel("sit")]);
    expect(f.commits).toEqual([HASH]);
    expect(f.kept).toEqual([DOC]);
    for (const pose of ["worried-tunic", "idle", "kneel"]) expect((await redrawBookPose({ childId: "kid1", avatarHash: HASH, pose }, f.deps)).reason).toBe("not-in-sheet");
    const quota = fakeDeps({ requestPose: async () => ({ ok: false, status: 429, code: "hero_sheet_resting" }) });
    expect(await redrawBookPose({ childId: "kid1", avatarHash: HASH, pose: "sit" }, quota.deps)).toEqual({ ok: false, reason: "hero_sheet_resting" });
    expect(quota.commits).toEqual([]);
  }, 60_000);
});
