/**
 * B-GAME-13b — POST /api/hero-pose refusals (contract): an uploaded image, a
 * photo-styled or raw-photo hero, a missing sign-in, the Free plan, a pose
 * before its anchor, a hero not saved yet; and the happy path's references.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCounterStore } from "./quotaStore.js";
import type { EntitlementStore, Plan } from "./entitlements.js";
import { createHeroPoseHandler, LocalHeroPoseSource, type HeroPoseSource, type StoredHero } from "./heroPoseRoute.js";
import { heroAvatarHash } from "../lib/heroSheetContract.js";
import { heroPosePrompt, POSES } from "./heroPosePrompts.js";

const HERO = "data:image/png;base64,SEVSTw==";
const ANCHOR = "data:image/jpeg;base64,SURMRQ==";

function makeRes() {
  const res: any = {
    statusCode: 200, body: undefined as any, headersSent: false,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; this.headersSent = true; return this; },
    setHeader() {},
  };
  return res;
}
const plans = (p: Record<string, Plan>): EntitlementStore => ({ async getPlan(uid) { return p[uid] ?? null; }, async getRecord(uid) { return p[uid] ? { plan: p[uid], status: "active" } : null; } });
const source = (hero: StoredHero | null, strictHash = true): HeroPoseSource & { loads: number } => ({ strictHash, loads: 0, async load() { this.loads++; return hero; } });

function setup(opts: { hero?: StoredHero | null; strict?: boolean; requireUid?: boolean; plan?: Plan; fail?: boolean } = {}) {
  const src = source(opts.hero === undefined ? { photoUrl: HERO, source: "descriptor", anchor: ANCHOR } : opts.hero, opts.strict ?? true);
  const counters = new MemoryCounterStore();
  const gen = vi.fn(async (_req: unknown, _res: unknown, input: { prompt: string; images: { mimeType: string; data: string }[] }) => {
    if (opts.fail) throw new Error("model down");
    void input;
    return { data: "UE9TRQ==", mimeType: "image/png" };
  });
  const failed: unknown[] = [];
  const handler = createHeroPoseHandler({
    source: src, counters, entitlements: plans({ u1: opts.plan ?? "plus" }), requireUid: opts.requireUid ?? true,
    generate: gen as any,
    fail: (res, e) => { failed.push(e); res.status(503).json({ error: "busy" }); },
  });
  const call = async (body: unknown, uid: string | null = "u1") => {
    const res = makeRes();
    await handler({ body, user: uid ? { uid } : undefined, ip: "1.1.1.1" } as any, res, () => {});
    return res;
  };
  return { src, counters, gen, failed, call };
}

beforeEach(() => { process.env.ENFORCE_ENTITLEMENTS = "true"; });
afterEach(() => { delete process.env.ENFORCE_ENTITLEMENTS; });

describe("B-GAME-13b /hero-pose — refusals", () => {
  it("refuses an uploaded image in the body, whatever the field, before reading anything", async () => {
    const s = setup();
    for (const body of [
      { childId: "c1", pose: "idle", photo: { dataUrl: HERO } },
      { childId: "c1", pose: "idle", dataUrl: HERO },
      { childId: "c1", pose: "idle", avatar: HERO },
      { childId: "c1", pose: "idle", note: "data:image/png;base64,AAAA" },
    ]) {
      const r = await s.call(body);
      expect(r.statusCode).toBe(400);
      expect(r.body.code).toBe("hero_pose_no_upload");
    }
    expect(s.src.loads).toBe(0);
    expect(s.gen).not.toHaveBeenCalled();
  });

  it("refuses a hero styled from a photo, and a stored photo URL that is not a generated data URL", async () => {
    const photo = setup({ hero: { photoUrl: HERO, source: "photo", anchor: null } });
    const r1 = await photo.call({ childId: "c1", pose: "idle" });
    expect(r1.statusCode).toBe(409);
    expect(r1.body.code).toBe("hero_photo_source");
    const raw = setup({ hero: { photoUrl: "https://storage.example/kid.jpg", source: "descriptor", anchor: null } });
    expect((await raw.call({ childId: "c1", pose: "idle" })).body.code).toBe("hero_missing");
    const none = setup({ hero: null });
    expect((await none.call({ childId: "c1", pose: "idle" })).body.code).toBe("hero_missing");
    for (const s of [photo, raw, none]) expect(s.gen).not.toHaveBeenCalled();
  });

  it("refuses a caller without a verified sign-in where the record is in Firestore", async () => {
    const s = setup({ requireUid: true });
    const r = await s.call({ childId: "c1", pose: "idle" }, null);
    expect(r.statusCode).toBe(401);
    expect(r.body.code).toBe("hero_pose_auth");
    expect(s.gen).not.toHaveBeenCalled();
  });

  it("refuses the Free plan (GD-5 default: stock heroes only) before reading the hero", async () => {
    const s = setup({ plan: "free" });
    const r = await s.call({ childId: "c1", pose: "idle" });
    expect(r.statusCode).toBe(403);
    expect(r.body).toMatchObject({ code: "hero_sheet_plan", plan: "free" });
    expect(s.src.loads).toBe(0);
    expect(s.gen).not.toHaveBeenCalled();
  });

  it("refuses a pose before the approved idle exists, a hero not saved yet, and junk", async () => {
    const noAnchor = setup({ hero: { photoUrl: HERO, source: "descriptor", anchor: null } });
    expect((await noAnchor.call({ childId: "c1", pose: "cheer" })).body.code).toBe("hero_anchor_missing");
    const changed = setup();
    const r = await changed.call({ childId: "c1", pose: "idle", avatarHash: "0000000000000000" });
    expect(r.statusCode).toBe(409);
    expect(r.body).toMatchObject({ code: "hero_changed", avatarHash: heroAvatarHash(HERO) });
    expect((await changed.call({ childId: "c1", pose: "wave" })).statusCode).toBe(400);
    expect((await changed.call({ pose: "idle" })).statusCode).toBe(400);
  });
});

describe("B-GAME-13b /hero-pose — the call", () => {
  it("idle: the stored hero is the only reference; others: the approved idle first, then the hero", async () => {
    const s = setup();
    const idle = await s.call({ childId: "c1", pose: "idle", avatarHash: heroAvatarHash(HERO) });
    expect(idle.statusCode).toBe(200);
    expect(idle.body).toMatchObject({ pose: "idle", avatarHash: heroAvatarHash(HERO), keyColour: "#00B140", model: "gemini-2.5-flash-image", newSheet: true });
    expect(idle.body.dataUrl).toBe("data:image/png;base64,UE9TRQ==");
    expect(s.gen.mock.calls[0][2].images).toEqual([{ mimeType: "image/png", data: "SEVSTw==" }]);
    expect(s.gen.mock.calls[0][2].prompt).toBe(heroPosePrompt("idle"));
    const cheer = await s.call({ childId: "c1", pose: "cheer" });
    expect(cheer.body.newSheet).toBe(false);
    expect(s.gen.mock.calls[1][2].images).toEqual([{ mimeType: "image/jpeg", data: "SURMRQ==" }, { mimeType: "image/png", data: "SEVSTw==" }]);
  });

  it("a provider failure answers through the image failure map and gives the call unit back", async () => {
    const s = setup({ fail: true });
    const r = await s.call({ childId: "c1", pose: "idle" });
    expect(r.statusCode).toBe(503);
    expect(s.failed).toHaveLength(1);
    const key = `u1:c1:${heroAvatarHash(HERO)}`;
    expect((await s.counters.peek("img_sheet_calls_30d", key, 30 * 86400000)).count).toBe(0);
    // ...but the sheet itself stays charged once (a retry never re-charges).
    expect((await s.counters.peek("img_sheet_30d", "u1:c1", 30 * 86400000)).count).toBe(1);
  });

  it("sandbox: the local source serves only heroes this server drew, and remembers the idle it drew as the anchor", async () => {
    const local = new LocalHeroPoseSource();
    expect(await local.load("local-sandbox", "c1")).toBeNull();
    local.remember("local-sandbox", "c1", { hero: { dataUrl: HERO, source: "descriptor" } });
    const counters = new MemoryCounterStore();
    const handler = createHeroPoseHandler({ source: local, counters, entitlements: plans({}), requireUid: false, generate: async () => ({ data: "SURMRQ==", mimeType: "image/png" }), fail: () => {} });
    delete process.env.ENFORCE_ENTITLEMENTS; // sandbox: unenforced = plus
    const res = makeRes();
    await handler({ body: { childId: "c1", pose: "idle", avatarHash: "abc" } } as any, res, () => {});
    expect(res.statusCode).toBe(200);
    expect(res.body.avatarHash).toBe("abc"); // the device's copy is re-encoded: its hash names the sheet
    expect((await local.load("local-sandbox", "c1"))?.anchor).toBe("data:image/png;base64,SURMRQ==");
  });
});

describe("B-GAME-13b prompts — fixed text", () => {
  it("every pose prompt is the template: no name slot, no pronoun of one child, one flat green background", () => {
    for (const pose of Object.keys(POSES) as (keyof typeof POSES)[]) {
      const p = heroPosePrompt(pose);
      expect(p).toContain("#00B140");
      expect(p).not.toMatch(/\$\{|\bhe\b|\bhis\b|\bhim\b|\bshe\b|\bher\b/i);
      expect(p).not.toMatch(/\bcape\b|\bsuit\b/i);
      expect(p).toContain(pose === "idle" ? "Image 1 is THE HERO — this is exactly who the hero is" : "Image 1 is THE HERO exactly as the hero must look");
    }
  });
});
