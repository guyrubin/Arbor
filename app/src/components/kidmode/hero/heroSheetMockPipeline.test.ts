/**
 * B-GAME-13d — the sandbox dry run, end to end without spending: the real
 * /hero-pose handler with MODEL_PROVIDER=mock (a deterministic drawn figure on
 * chroma green, PNG) -> the device builder (PNG decode, the real keyer + QA
 * gate, head normalisation) -> the child's record. A complete sheet comes out.
 */
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { MemoryCounterStore } from "../../../server/quotaStore";
import { createHeroPoseHandler, LocalHeroPoseSource } from "../../../server/heroPoseRoute";
import { mockHeroPoseImage } from "../../../server/heroPoseMock";
import { HERO_BOOK_POSE_IDS, HERO_SHEET_POSE_IDS, heroAvatarHash, type HeroSheetPoseId } from "../../../lib/heroSheetContract";
import { mockHeroPoseRaster } from "../../../lib/heroPoseMockArt";
import { buildHeroSheet, type BuilderDeps, type PoseResponse } from "./buildHeroSheet";
import { heroSheetStoreFor, sheetFromDocs } from "../../../lib/heroSheetStore";
import { keySprite, type RgbaImage } from "./heroKeyer";

/** Decode the PNGs our mock writes (8-bit RGBA, filter 0). */
function decodePng(dataUrl: string): RgbaImage {
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  let off = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = body.readUInt32BE(0); h = body.readUInt32BE(4); expect(body[8]).toBe(8); expect(body[9]).toBe(6); }
    if (type === "IDAT") idat.push(body);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    expect(raw[y * (w * 4 + 1)]).toBe(0);
    data.set(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)), y * w * 4);
  }
  return { width: w, height: h, data };
}

const HERO = "data:image/png;base64,TU9DSyBIRVJP";

describe("B-GAME-13d: the mock pose", () => {
  it("is deterministic, a real PNG, and passes the same QA gate as a real render, for every pose", () => {
    for (const pose of HERO_SHEET_POSE_IDS) {
      const a = mockHeroPoseImage(pose);
      expect(a.mimeType).toBe("image/png");
      expect(mockHeroPoseImage(pose).data).toBe(a.data);
      const img = decodePng(`data:image/png;base64,${a.data}`);
      expect(Array.from(img.data.slice(0, 64))).toEqual(Array.from(mockHeroPoseRaster(pose).data.slice(0, 64)));
      const k = keySprite(img);
      expect(k.qa.fails, `${pose}: ${k.qa.fails.join("; ")}`).toEqual([]);
    }
  }, 60_000);
});

describe("B-GAME-13d: sandbox dry run — route (mock) -> device builder -> record", () => {
  it("produces a complete eight-pose sheet in the child's record, with no model call", async () => {
    const source = new LocalHeroPoseSource();
    source.remember("local-sandbox", "kid1", { hero: { dataUrl: HERO, source: "descriptor" } });
    const generate = vi.fn(async () => { throw new Error("no model call in the dry run"); });
    const handler = createHeroPoseHandler({
      source, counters: new MemoryCounterStore(), requireUid: false, mock: true, generate,
      entitlements: { async getPlan() { return null; }, async getRecord() { return null; } },
      fail: (res, e) => { res.status(500).json({ error: String(e) }); },
    });
    const requestPose = async (body: { childId: string; pose: HeroSheetPoseId; avatarHash: string }): Promise<PoseResponse> => {
      let status = 200;
      let out: Record<string, unknown> = {};
      const res = { headersSent: false, status(c: number) { status = c; return this; }, json(p: Record<string, unknown>) { out = p; this.headersSent = true; return this; }, setHeader() {} };
      await handler({ body } as never, res as never, () => {});
      return status === 200 ? { ok: true, dataUrl: String(out.dataUrl), avatarHash: String(out.avatarHash) } : { ok: false, status, code: String(out.code ?? "") };
    };
    const encoded = new Map<string, RgbaImage>();
    const mem = new Map<string, string>();
    const store = heroSheetStoreFor("kid1", { uid: null, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); } } });
    const deps: BuilderDeps = {
      requestPose,
      decode: async (u) => encoded.get(u) ?? decodePng(u),
      encodeSprite: async (img, w, h) => { const u = `data:image/webp;base64,${w}x${h}x${encoded.size}`; encoded.set(u, img); return { dataUrl: u, factor: 1 }; },
      encodeAnchor: async () => "data:image/jpeg;base64,QQ==",
      store,
      sleep: async () => {},
      now: () => "2026-10-06T12:00:00.000Z",
    };
    const avatarHash = heroAvatarHash(HERO);
    const r = await buildHeroSheet({ childId: "kid1", avatarHash }, deps);
    expect(r).toMatchObject({ status: "complete", skipped: [], calls: 8 });
    expect(r.stored).toEqual([...HERO_SHEET_POSE_IDS]);
    expect(generate).not.toHaveBeenCalled();

    const docs = await store.read();
    expect(docs.meta).toMatchObject({ status: "complete", avatarHash });
    const sheet = sheetFromDocs(docs, avatarHash)!;
    expect(Object.keys(sheet.poses).sort()).toEqual([...HERO_SHEET_POSE_IDS].sort());
    // One pixels-per-head scale: every pose's drawn head within 12 % of idle's.
    const idleR = docs.poses.idle!.head.r;
    for (const p of HERO_SHEET_POSE_IDS) {
      const d = docs.poses[p]!;
      expect(Math.abs((d.head.r * d.scale) / idleR - 1), p).toBeLessThan(0.12);
      expect(d.foot.y, p).toBeGreaterThan(d.h * 0.6);
      expect(d.head.y, p).toBeLessThan(d.foot.y);
    }
    expect(docs.poses.idle!.h).toBe(960);
    expect(docs.poses["hold-up"]!.hand).toBeTruthy();
    // Sandbox: the server's anchor for the later poses is the idle it drew.
    expect((await source.load("local-sandbox", "kid1"))?.anchor).toMatch(/^data:image\/png;base64,/);
  }, 120_000);
});

describe("K2: the mock book poses", () => {
  it("every book pose is a deterministic PNG that passes the same QA gate as a real render", () => {
    const seen = new Set<string>();
    for (const pose of HERO_BOOK_POSE_IDS) {
      const a = mockHeroPoseImage(pose);
      expect(a.mimeType).toBe("image/png");
      expect(mockHeroPoseImage(pose).data).toBe(a.data);
      const k = keySprite(decodePng(`data:image/png;base64,${a.data}`));
      expect(k.qa.fails, `${pose}: ${k.qa.fails.join("; ")}`).toEqual([]);
      seen.add(a.data);
    }
    // a drawn figure per pose (worried-tunic draws the worried pose)
    expect(seen.size).toBe(HERO_BOOK_POSE_IDS.length - 1);
    expect(mockHeroPoseImage("worried-tunic").data).toBe(mockHeroPoseImage("worried").data);
  }, 120_000);

  it("the game's eight synthetic rasters are byte-identical to K1", () => {
    const h = createHash("sha256");
    for (const pose of HERO_SHEET_POSE_IDS) h.update(Buffer.from(mockHeroPoseRaster(pose).data));
    expect(h.digest("hex")).toBe("a48aa171edc950f9a8e0347f0d35cecc5b46abc424b1dd2e5c05f2ac7a68b353");
  });
});
