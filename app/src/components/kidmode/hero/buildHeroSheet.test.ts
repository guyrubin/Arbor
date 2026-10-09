/**
 * B-GAME-13c — the parent-side sheet builder on fakes: route -> key -> QA ->
 * normalise -> store, idle first; a QA reject retried once (counted); a hero
 * not saved yet waited for; Free refused with nothing written; a reload
 * resumes; a new hero replaces the old sheet.
 */
import { describe, expect, it } from "vitest";
import { HERO_SHEET_POSE_IDS, heroAvatarHash, type HeroSheetPoseId } from "../../../lib/heroSheetContract";
import { buildHeroSheet, markHeroPoseOk, redrawHeroPose, startHeroSheet, type BuilderDeps, type PoseResponse } from "./buildHeroSheet";
import { sheetFromDocs } from "../../../lib/heroSheetStore";
import { heroSheetStoreFor } from "../../../lib/heroSheetStore";
import type { RgbaImage } from "./heroKeyer";

type RGB = [number, number, number];
const KEY: RGB = [0, 177, 64];

function raster(pose: string, opts: { gradient?: boolean } = {}): RgbaImage {
  const W = 200, H = 280;
  const data = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, c: RGB) => { const i = (y * W + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; };
  const up = pose === "cheer" || pose === "hold-up";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c: RGB = KEY;
    if (opts.gradient) { const f = 1 - 0.4 * (y / H) ** 2; c = [0, Math.round(177 * f), Math.round(64 * f)]; }
    const dh = (x - 100) ** 2 + (y - 70) ** 2;
    if (dh < 22 ** 2) c = y < 62 ? [70, 40, 20] : [225, 160, 120];
    if (y > 90 && y < 240 && Math.abs(x - 100) < 28) c = [40, 60, 150];
    if (up && y > 30 && y < 110 && Math.abs(x - 100) > 30 && Math.abs(x - 100) < 42) c = [40, 60, 150];
    if (up && y > 90 && y < 110 && Math.abs(x - 100) <= 30) c = [40, 60, 150];
    put(x, y, c);
  }
  return { width: W, height: H, data };
}

function fakes(opts: { refuse?: Record<string, string>; gradientOnce?: HeroSheetPoseId[]; changedTimes?: number } = {}) {
  const images = new Map<string, RgbaImage>();
  const calls: HeroSheetPoseId[] = [];
  const once = new Set(opts.gradientOnce ?? []);
  let changed = opts.changedTimes ?? 0;
  const mem = new Map<string, string>();
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  const deps: BuilderDeps = {
    async requestPose(body): Promise<PoseResponse> {
      calls.push(body.pose);
      if (changed > 0) { changed--; return { ok: false, status: 409, code: "hero_changed" }; }
      const code = opts.refuse?.[body.pose];
      if (code) return { ok: false, status: 403, code };
      const url = `data:image/png;base64,${body.pose}-${calls.length}`;
      images.set(url, raster(body.pose, { gradient: once.delete(body.pose) }));
      return { ok: true, dataUrl: url, avatarHash: body.avatarHash };
    },
    async decode(url) {
      const r = images.get(url);
      if (!r) throw new Error("unknown image");
      return r;
    },
    async encodeSprite(img, w, h) {
      const url = `data:image/webp;base64,${w}x${h}-${Math.random().toString(36).slice(2)}`;
      images.set(url, img);
      return { dataUrl: url, factor: 1 };
    },
    async encodeAnchor() { return "data:image/jpeg;base64,QU5DSE9S"; },
    store: heroSheetStoreFor("c1", { uid: null, storage }),
    sleep: async () => {},
    now: () => "2026-10-06T00:00:00.000Z",
  };
  return { deps, calls, store: deps.store, storage };
}

const HASH = heroAvatarHash("data:image/png;base64,SEVSTw==");

describe("B-GAME-13c builder", () => {
  it("draws idle first, then the other seven, keys each and stores one doc per pose + a complete meta", async () => {
    const f = fakes();
    const r = await buildHeroSheet({ childId: "c1", avatarHash: HASH }, f.deps);
    expect(r.status).toBe("complete");
    expect(r.stored).toEqual([...HERO_SHEET_POSE_IDS]);
    expect(f.calls[0]).toBe("idle");
    expect(f.calls[1]).toBe("cheer"); // idle + cheer = playable soonest
    expect(r.calls).toBe(8);
    const docs = await f.store.read();
    expect(docs.meta).toMatchObject({ status: "complete", avatarHash: HASH, source: "generated" });
    expect(docs.meta?.poses).toEqual([...HERO_SHEET_POSE_IDS]);
    const idle = docs.poses.idle!;
    expect(idle.h).toBe(960);
    expect(idle.anchor).toBe("data:image/jpeg;base64,QU5DSE9S");
    expect(idle.keyColour).toBe("#00B140");
    expect(idle.foot.y).toBeGreaterThan(900);
    for (const p of HERO_SHEET_POSE_IDS) {
      const d = docs.poses[p]!;
      expect(d.avatarHash).toBe(HASH);
      expect(d.model).toBe("gemini-2.5-flash-image");
      expect(d.head.r).toBeGreaterThan(0);
      expect(d.dataUrl.startsWith("data:image/webp")).toBe(true);
    }
    expect(docs.poses["hold-up"]?.hand).toBeTruthy();
  });

  it("a QA reject is drawn once more with the same prompt (counted); a second reject skips the pose, play is not blocked", async () => {
    const f = fakes({ gradientOnce: ["tiptoe"] });
    const r = await buildHeroSheet({ childId: "c1", avatarHash: HASH }, f.deps);
    expect(r.status).toBe("complete");
    expect(f.calls.filter((p) => p === "tiptoe")).toHaveLength(2);
    expect(r.calls).toBe(9);
    expect(r.stored).toContain("tiptoe");
  });

  it("waits for the parent's save (hero_changed) before the first pose", async () => {
    const f = fakes({ changedTimes: 3 });
    const r = await buildHeroSheet({ childId: "c1", avatarHash: HASH }, f.deps);
    expect(r.status).toBe("complete");
    expect(f.calls.slice(0, 4)).toEqual(["idle", "idle", "idle", "idle"]);
  });

  it("Free (or a photo hero): refused at the first call, nothing written", async () => {
    for (const code of ["hero_sheet_plan", "hero_photo_source"]) {
      const f = fakes({ refuse: { idle: code } });
      const r = await buildHeroSheet({ childId: "c1", avatarHash: HASH }, f.deps);
      expect(r).toMatchObject({ status: "not-started", stoppedBy: code, calls: 1 });
      expect(f.storage.getItem("arbor.heroSheet.c1")).toBeNull();
    }
  });

  it("a reload resumes: poses already stored for this hero are kept and not drawn again", async () => {
    const f = fakes({ refuse: { dash: "hero_sheet_resting" } });
    const first = await buildHeroSheet({ childId: "c1", avatarHash: HASH }, f.deps);
    expect(first.status).toBe("stopped");
    expect(first.stoppedBy).toBe("hero_sheet_resting");
    const kept = first.stored.length;
    expect(kept).toBeGreaterThanOrEqual(2);
    f.calls.length = 0;
    const g = { ...f.deps, requestPose: fakes().deps.requestPose };
    // The same store, a working route: only the missing poses are drawn.
    const images = new Map<string, RgbaImage>();
    g.requestPose = async (body) => { f.calls.push(body.pose); const u = `data:image/png;base64,r-${body.pose}`; images.set(u, raster(body.pose)); return { ok: true, dataUrl: u, avatarHash: body.avatarHash }; };
    const decode = f.deps.decode;
    g.decode = async (u) => images.get(u) ?? decode(u);
    const second = await buildHeroSheet({ childId: "c1", avatarHash: HASH }, g);
    expect(second.status).toBe("complete");
    expect(f.calls).toHaveLength(8 - kept);
    expect(f.calls).not.toContain("idle");
  });

  it("a new hero replaces the old sheet in the same pass", async () => {
    const f = fakes();
    await buildHeroSheet({ childId: "c1", avatarHash: "1111111111111111" }, f.deps);
    const r = await buildHeroSheet({ childId: "c1", avatarHash: HASH }, f.deps);
    expect(r.status).toBe("complete");
    const docs = await f.store.read();
    expect(docs.meta?.avatarHash).toBe(HASH);
    for (const p of HERO_SHEET_POSE_IDS) expect(docs.poses[p]?.avatarHash).toBe(HASH);
  });

  it("startHeroSheet: only a hero drawn from a description, one build per hero at a time", async () => {
    const f = fakes();
    expect(startHeroSheet({ childId: "c1", photoUrl: "data:image/png;base64,SEVSTw==", source: "photo" }, f.deps)).toBeNull();
    expect(startHeroSheet({ childId: "c1", photoUrl: "https://x/y.png", source: "descriptor" }, f.deps)).toBeNull();
    const a = startHeroSheet({ childId: "c1", photoUrl: "data:image/png;base64,SEVSTw==", source: "descriptor" }, f.deps);
    const b = startHeroSheet({ childId: "c1", photoUrl: "data:image/png;base64,SEVSTw==", source: "descriptor" }, f.deps);
    expect(a).toBe(b);
    expect((await a)?.status).toBe("complete");
  });
});

describe("B-GAME-14 parent review", () => {
  it("Yes keeps the pose; Redraw removes it from the record at once, draws it once more, and only once", async () => {
    const f = fakes();
    await buildHeroSheet({ childId: "c1", avatarHash: HASH }, f.deps);
    expect(await markHeroPoseOk(f.store, "idle")).toBe(true);
    expect((await f.store.read()).poses.idle?.review).toBe("ok");
    expect(await markHeroPoseOk(f.store, "idle")).toBe(false);

    // While the redraw is in flight the rejected pose is already gone: the
    // child's sheet resolves it through the fallback map, never the old art.
    const before = (await f.store.read()).poses.oops!.dataUrl;
    let seenDuring: boolean | null = null;
    const deps: BuilderDeps = { ...f.deps, requestPose: async (b) => { const docs = await f.store.read(); seenDuring = !!docs.poses.oops; return f.deps.requestPose(b); } };
    f.calls.length = 0;
    expect(await redrawHeroPose({ childId: "c1", avatarHash: HASH, pose: "oops" }, deps)).toEqual({ ok: true });
    expect(seenDuring).toBe(false);
    expect(f.calls).toEqual(["oops"]);
    const after = (await f.store.read()).poses.oops!;
    expect(after.redrawn).toBe(true);
    expect(after.dataUrl).not.toBe(before);
    expect((await f.store.read()).meta?.poses).toContain("oops");
    expect(sheetFromDocs(await f.store.read(), HASH)?.poses.oops).toBeTruthy();
    // One redraw per pose per creation.
    expect(await redrawHeroPose({ childId: "c1", avatarHash: HASH, pose: "oops" }, f.deps)).toEqual({ ok: false, reason: "redraw-spent" });
    // Not for another hero's sheet.
    expect(await redrawHeroPose({ childId: "c1", avatarHash: "2222222222222222", pose: "dash" }, f.deps)).toEqual({ ok: false, reason: "not-in-sheet" });
  });

  it("a redraw that fails leaves the pose out (the fallback plays), never the rejected art", async () => {
    const f = fakes();
    await buildHeroSheet({ childId: "c1", avatarHash: HASH }, f.deps);
    const deps: BuilderDeps = { ...f.deps, requestPose: async () => ({ ok: false, status: 429, code: "hero_sheet_resting" }) };
    expect(await redrawHeroPose({ childId: "c1", avatarHash: HASH, pose: "dash" }, deps)).toEqual({ ok: false, reason: "hero_sheet_resting" });
    const docs = await f.store.read();
    expect(docs.poses.dash).toBeUndefined();
    expect(docs.meta?.poses).not.toContain("dash");
    expect(sheetFromDocs(docs, HASH)?.poses.dash).toBeUndefined();
  });
});

describe("K1 ensureHeroSheet: a hero made before sheets existed gets one, once", () => {
  const HERO = "data:image/png;base64,SEVSTw==";
  it("draws the sheet of an existing described hero with no sheet; a second call (same hero) does nothing", async () => {
    const { ensureHeroSheet, resetEnsuredHeroSheetsForTest } = await import("./buildHeroSheet");
    resetEnsuredHeroSheetsForTest();
    const f = fakes();
    const child = { id: "c1", photoUrl: HERO, avatar: { source: "descriptor" } };
    const r = await ensureHeroSheet(child, f.deps);
    expect(r?.status).toBe("complete");
    expect(f.calls.length).toBe(8);
    expect(await ensureHeroSheet(child, f.deps)).toBeNull();
    expect(f.calls.length).toBe(8);
  });

  it("does nothing for a photo-sourced hero, no hero, or a hero whose sheet already exists", async () => {
    const { ensureHeroSheet, resetEnsuredHeroSheetsForTest } = await import("./buildHeroSheet");
    resetEnsuredHeroSheetsForTest();
    const f = fakes();
    expect(await ensureHeroSheet({ id: "c1", photoUrl: HERO, avatar: { source: "photo" } }, f.deps)).toBeNull();
    expect(await ensureHeroSheet({ id: "c1", photoUrl: null }, f.deps)).toBeNull();
    expect(await ensureHeroSheet(null, f.deps)).toBeNull();
    expect(f.calls.length).toBe(0);
    await buildHeroSheet({ childId: "c1", avatarHash: heroAvatarHash(HERO) }, f.deps);
    const before = f.calls.length;
    resetEnsuredHeroSheetsForTest();
    expect(await ensureHeroSheet({ id: "c1", photoUrl: HERO, avatar: { source: "descriptor" } }, f.deps)).toBeNull();
    expect(f.calls.length).toBe(before);
  });
});
