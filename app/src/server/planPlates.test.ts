/**
 * B-BOOK-75 (plates painted in-product) — server/planPlates: the shared
 * plan plates are painted ONLY by a verified admin / comped email (403 for a
 * family, the sandbox caller and a signed-out caller), idempotently (a
 * painted plate is skipped unless `repaint`), under a per-run cap refused
 * BEFORE any provider call, through the image routes' global breaker and a
 * per-painter ledger, with a provenance record beside each master
 * (qc "unverified", childFree / textFree false until viewed). The read route
 * serves any signed-in user (401 signed out, the sandbox where allowed), 404
 * until painted, long cache headers once painted. Every object sits under
 * shared/plans/ — never a child path. Synthetic data only.
 */
import express from "express";
import { Readable } from "node:stream";
import type { AddressInfo } from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import type { BookAssetBucket, BookAssetFile, BookAssetSaveOptions } from "./bookAssets";
import { IMAGE_COUNTERS, IMAGE_GLOBAL_DAILY } from "./imageQuota";
import { MemoryCounterStore } from "./quotaStore";
import { createPlanPlatesRouter, estimatePaintUsd, imageDimensions, isPlatePainter, PLAN_PLATE_PREFIX, PLAN_PLATE_RULES, PLAN_PLATES_COUNTER, PLAN_PLATES_MAX_IMAGES, PLAN_PLATES_MAX_USD, PLATE_LIGHT, PLATE_RULES, PLATE_STYLE, planPlateObject, planPlatePrompt, plateStatesFrom } from "./planPlates";
import { TAIL } from "./heroPosePrompts";
import { PLAN_PLATE_BRIEFS, planPlateTable } from "../lib/library/plans/planPlates";
import { PATTERN_IDS } from "../lib/library/plans/planVisibility";
import { childBookAssetPrefix } from "../lib/library/bookAssetPaths";

/** An in-memory stand-in for the child-assets bucket (the BookAssetBucket shape). */
class MemoryBucket implements BookAssetBucket {
  objects = new Map<string, { data: Buffer; opts: BookAssetSaveOptions }>();
  file(name: string): BookAssetFile {
    const objects = this.objects;
    return {
      name,
      exists: async () => [objects.has(name)],
      createReadStream: () => Readable.from([objects.get(name)?.data ?? Buffer.alloc(0)]),
      delete: async () => { objects.delete(name); },
      save: async (data: Buffer, opts: BookAssetSaveOptions) => { objects.set(name, { data, opts }); },
    };
  }
  async getFiles(opts: { prefix: string }): Promise<[BookAssetFile[]]> {
    return [[...this.objects.keys()].filter((n) => n.startsWith(opts.prefix)).map((n) => this.file(n))];
  }
}

// a 3x2 PNG header (IHDR only: enough for the dimension read) and a 1536x1024 one
const png = (w: number, h: number) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};
const MASTER = png(1536, 1024);

const ENV = { ARBOR_ADMIN_EMAILS: "founder@example.test", ARBOR_FAMILY_EMAILS: "Comped@Example.test, demo@example.test" } as NodeJS.ProcessEnv;
const CFG = { modelProvider: "vertex", memoryAdapter: "firestore", arborEnv: "prod", vertexModelImage: "gemini-2.5-flash-image", vertexImageRegions: ["europe-west4", "europe-west1"], gcpRegion: "europe-west4", geminiImageModel: "gemini-2.5-flash-image" } as const;

type User = { uid: string; email?: string | null } | null;
interface Served { url: string; close: () => void; bucket: MemoryBucket; counters: MemoryCounterStore; calls: string[] }

function serve(opts: { user?: User; bucket?: MemoryBucket | null; generate?: (prompt: string) => Promise<{ data: string; mimeType: string }>; allowLocal?: boolean; runMs?: number; maxImagesPerRun?: number; maxUsdPerRun?: number; counters?: MemoryCounterStore; config?: Partial<typeof CFG> } = {}): Promise<Served> {
  const app = express();
  const bucket = opts.bucket === undefined ? new MemoryBucket() : opts.bucket;
  const counters = opts.counters ?? new MemoryCounterStore();
  const calls: string[] = [];
  app.use((req, _res, next) => { if (opts.user) (req as any).user = opts.user; next(); });
  app.use("/api", createPlanPlatesRouter({
    config: { ...CFG, ...(opts.config ?? {}) } as any,
    getBucket: async () => bucket,
    generate: async ({ prompt }) => { calls.push(prompt); return opts.generate ? opts.generate(prompt) : { data: MASTER.toString("base64"), mimeType: "image/png" }; },
    counters,
    allowLocal: opts.allowLocal,
    env: ENV,
    runMs: opts.runMs,
    maxImagesPerRun: opts.maxImagesPerRun,
    maxUsdPerRun: opts.maxUsdPerRun,
    now: () => Date.parse("2026-10-28T10:00:00.000Z"),
  }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`, close: () => server.close(), bucket: bucket as MemoryBucket, counters, calls }));
  });
}

const post = (url: string, body: unknown) => fetch(`${url}/admin/plan-plates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ADMIN: User = { uid: "founder-uid", email: "founder@example.test" };
const COMPED: User = { uid: "comped-uid", email: "comped@example.test" };
const FAMILY: User = { uid: "family-1", email: "parent@example.test" };

describe("isPlatePainter", () => {
  it("a verified uid with an email on ARBOR_ADMIN_EMAILS or ARBOR_FAMILY_EMAILS (case-insensitive); nobody else", () => {
    expect(isPlatePainter({ uid: "u1", email: "founder@example.test" }, ENV)).toBe(true);
    expect(isPlatePainter({ uid: "u2", email: "COMPED@example.test" }, ENV)).toBe(true);
    expect(isPlatePainter({ uid: "u3", email: "parent@example.test" }, ENV)).toBe(false);
    expect(isPlatePainter({ uid: "", email: "founder@example.test" }, ENV)).toBe(false);
    expect(isPlatePainter({ uid: "local-sandbox", email: "founder@example.test" }, ENV)).toBe(false);
    expect(isPlatePainter({ uid: "u4", email: null }, ENV)).toBe(false);
    expect(isPlatePainter({ uid: "u1", email: "founder@example.test" }, {} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("the prompt, the object names and the cost", () => {
  it("every brief paints under the standard rules: child-free, text-free, key light upper left, hero slot empty, no religious symbol, no weapon", () => {
    expect(PLAN_PLATE_RULES).toMatch(/UPPER LEFT/);
    expect(PLAN_PLATE_RULES).toMatch(/hero slot .* stays EMPTY/);
    expect(PLAN_PLATE_RULES).toMatch(/NO CHILD/);
    expect(PLAN_PLATE_RULES).toMatch(/no letters/i);
    expect(PLAN_PLATE_RULES).toMatch(/no religious symbols/i);
    expect(PLAN_PLATE_RULES).toMatch(/no weapons?/i);
    expect(PLAN_PLATE_RULES).toMatch(/3:2/);
    // the script's blocks verbatim (the closed PR #170) + the hero sheet's TAIL
    expect(PLAN_PLATE_RULES).toContain(PLATE_RULES);
    expect(PLAN_PLATE_RULES).toContain(TAIL);
    expect(PLATE_STYLE).toMatch(/game-tile look/);
    for (const p of PATTERN_IDS) for (const id of Object.keys(planPlateTable(p))) {
      const prompt = planPlatePrompt(p, id)!;
      const spec = PLAN_PLATE_BRIEFS[p]![id];
      expect(prompt).toContain(`SCENE (${p} / ${id}): ${spec.brief}.`);
      expect(prompt).toContain(`LIGHT: ${PLATE_LIGHT[spec.light]}.`);
      expect(prompt.startsWith(PLATE_STYLE)).toBe(true);
      expect(prompt.endsWith(TAIL)).toBe(true);
      if (spec.textZone) expect(prompt).toMatch(/a text panel sits there/);
      // no diagnosis noun, no public figure, no child's name reaches the painter
      expect(prompt).not.toMatch(/\b(adhd|autis\w*|anxiety disorder|diagnos\w*|disorder)\b/i);
    }
    expect(planPlatePrompt("plan-poo-sit", "PP99")).toBeNull();
  });

  it("objects live under shared/plans/, never a child prefix", () => {
    expect(planPlateObject("plan-poo-sit", "PP1", "webp")).toBe("shared/plans/plan-poo-sit/PP1.webp");
    expect(planPlateObject("plan-poo-sit", "PP1", "json")).toBe("shared/plans/plan-poo-sit/PP1.json");
    expect(PLAN_PLATE_PREFIX.startsWith(childBookAssetPrefix("any-child").split("/")[0])).toBe(false);
    expect(() => planPlateObject("plan-made-up", "PP1", "webp")).toThrow();
    expect(() => planPlateObject("plan-poo-sit", "../x", "webp")).toThrow();
  });

  it("a full paint of every pattern fits under the per-run caps (64 images ≈ USD 2.50)", () => {
    const all = PATTERN_IDS.reduce((n, p) => n + Object.keys(planPlateTable(p)).length, 0);
    expect(all).toBe(64);
    expect(all).toBeLessThanOrEqual(PLAN_PLATES_MAX_IMAGES);
    expect(estimatePaintUsd(all)).toBeLessThanOrEqual(PLAN_PLATES_MAX_USD);
    expect(estimatePaintUsd(all)).toBeCloseTo(2.496, 3);
  });

  it("reads PNG and WebP dimensions", () => {
    expect(imageDimensions(MASTER)).toEqual({ width: 1536, height: 1024 });
    const webp = Buffer.alloc(30);
    webp.write("RIFF", 0, "ascii"); webp.write("WEBP", 8, "ascii"); webp.write("VP8 ", 12, "ascii");
    webp.writeUInt16LE(1536, 26); webp.writeUInt16LE(1024, 28);
    expect(imageDimensions(webp)).toEqual({ width: 1536, height: 1024 });
    expect(imageDimensions(Buffer.from("nope"))).toBeNull();
  });

  it("plateStatesFrom reads painted / failed / unpainted off one listing", () => {
    const st = plateStatesFrom(["shared/plans/plan-poo-sit/PP1.webp", "shared/plans/plan-poo-sit/PP2.failed.json", "shared/plans/plan-poo-sit/PP3.png"]);
    expect(st["plan-poo-sit"].PP1).toBe("painted");
    expect(st["plan-poo-sit"].PP2).toBe("failed");
    expect(st["plan-poo-sit"].PP3).toBe("painted");
    expect(st["plan-poo-sit"].PP4).toBe("unpainted");
    expect(Object.keys(st)).toHaveLength(8);
  });
});

describe("POST /admin/plan-plates", () => {
  const servers: { close: () => void }[] = [];
  afterAll(() => servers.forEach((s) => s.close()));
  const up = async (o: Parameters<typeof serve>[0] = {}) => { const s = await serve(o); servers.push(s); return s; };

  it("403 for a family, a signed-out caller and the sandbox; nothing is painted or listed", async () => {
    for (const user of [FAMILY, null, { uid: "local-sandbox", email: "founder@example.test" }]) {
      const s = await up({ user, allowLocal: true });
      const r = await post(s.url, { pattern: "plan-poo-sit" });
      expect(r.status).toBe(403);
      expect((await r.json()).code).toBe("plan_plates_forbidden");
      expect(s.calls).toHaveLength(0);
      expect((await fetch(`${s.url}/admin/plan-plates`)).status).toBe(403);
    }
  });

  it("the admin and a comped email paint one pattern: eight masters, a provenance record each, every call ledgered", async () => {
    for (const user of [ADMIN, COMPED]) {
      const s = await up({ user });
      const r = await post(s.url, { pattern: "plan-poo-sit" });
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.run).toMatchObject({ planned: 8, painted: 8, failed: 0, skipped: 0, left: 0, stopped: null, model: "gemini-2.5-flash-image", location: "europe-west4" });
      expect(body.run.estimatedUsd).toBeCloseTo(0.312, 3);
      expect(s.calls).toHaveLength(8);
      for (const id of Object.keys(planPlateTable("plan-poo-sit"))) {
        const master = s.bucket.objects.get(`shared/plans/plan-poo-sit/${id}.png`)!;
        expect(master, id).toBeDefined();
        expect(master.opts.contentType).toBe("image/png");
        const prov = JSON.parse(s.bucket.objects.get(`shared/plans/plan-poo-sit/${id}.json`)!.data.toString("utf8"));
        expect(prov).toMatchObject({ pattern: "plan-poo-sit", plate: id, childFree: false, textFree: false, qc: "unverified", model: "gemini-2.5-flash-image", location: "europe-west4", painterUid: user!.uid, paintedAt: "2026-10-28T10:00:00.000Z", costUsd: 0.039, width: 1536, height: 1024, aspect: "3:2" });
        expect(prov.promptSha256).toMatch(/^[0-9a-f]{64}$/);
      }
      for (const name of s.bucket.objects.keys()) expect(name.startsWith("shared/plans/")).toBe(true);
      expect((await s.counters.peek(IMAGE_COUNTERS.global, "all", 86_400_000)).count).toBe(8);
      expect((await s.counters.peek(PLAN_PLATES_COUNTER, user!.uid, 86_400_000)).count).toBe(8);
    }
  });

  it("is idempotent: a second run skips every painted plate; `repaint` paints again; one plate alone", async () => {
    const s = await up({ user: ADMIN });
    await post(s.url, { pattern: "plan-poo-sit" });
    const again = await (await post(s.url, { pattern: "plan-poo-sit" })).json();
    expect(again.run).toMatchObject({ planned: 0, painted: 0, skipped: 8 });
    expect(s.calls).toHaveLength(8);
    const one = await (await post(s.url, { pattern: "plan-poo-sit", plate: "PP3", repaint: true })).json();
    expect(one.run).toMatchObject({ planned: 1, painted: 1, skipped: 0 });
    expect(one.results).toEqual([{ pattern: "plan-poo-sit", plate: "PP3", state: "painted" }]);
    expect(s.calls).toHaveLength(9);
    expect((await post(s.url, { pattern: "plan-poo-sit", plate: "PP99" })).status).toBe(404);
    expect((await post(s.url, { pattern: "plan-made-up" })).status).toBe(404);
  });

  it("refuses a run over the per-run cap (images or USD) before any provider call", async () => {
    const s = await up({ user: ADMIN, maxImagesPerRun: 5 });
    const r = await post(s.url, { pattern: "plan-poo-sit" });
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ code: "plan_plates_cap", planned: 8, maxImagesPerRun: 5 });
    expect(s.calls).toHaveLength(0);
    const usd = await up({ user: ADMIN, maxUsdPerRun: 0.1 });
    expect((await post(usd.url, { pattern: "plan-poo-sit" })).status).toBe(429);
    expect(usd.calls).toHaveLength(0);
    // the whole registry in one run stays under the production caps
    const all = await up({ user: ADMIN });
    const full = await (await post(all.url, {})).json();
    expect(full.run).toMatchObject({ planned: 64, painted: 64 });
  });

  it("stops at the image routes' global breaker and at the run deadline, and says what is left", async () => {
    const counters = new MemoryCounterStore();
    for (let i = 0; i < IMAGE_GLOBAL_DAILY - 2; i += 1) await counters.increment(IMAGE_COUNTERS.global, "all", 86_400_000);
    const s = await up({ user: ADMIN, counters });
    const body = await (await post(s.url, { pattern: "plan-poo-sit" })).json();
    expect(body.run).toMatchObject({ planned: 8, painted: 2, left: 6, stopped: "breaker" });
    expect(s.calls).toHaveLength(2);
    expect(body.results.filter((r: { state: string }) => r.state === "unpainted")).toHaveLength(6);
    const slow = await up({ user: ADMIN, runMs: -1 });
    const b2 = await (await post(slow.url, { pattern: "plan-poo-sit" })).json();
    expect(b2.run).toMatchObject({ painted: 0, left: 8, stopped: "deadline" });
  });

  it("records a failed paint beside the plate and clears it on the next success; the status route reads it", async () => {
    let fail = true;
    const s = await up({ user: ADMIN, generate: async () => { if (fail) throw new Error("provider said no"); return { data: MASTER.toString("base64"), mimeType: "image/webp" }; } });
    const r1 = await (await post(s.url, { pattern: "plan-poo-sit", plate: "PP1" })).json();
    expect(r1.run).toMatchObject({ painted: 0, failed: 1 });
    expect(r1.results[0]).toMatchObject({ state: "failed", reason: "provider said no" });
    expect(s.bucket.objects.has("shared/plans/plan-poo-sit/PP1.failed.json")).toBe(true);
    const st1 = await (await fetch(`${s.url}/admin/plan-plates`)).json();
    expect(st1.patterns["plan-poo-sit"].PP1).toBe("failed");
    expect(st1.patterns["plan-poo-sit"].PP2).toBe("unpainted");
    expect(st1).toMatchObject({ storage: true, costPerImageUsd: 0.039, maxImagesPerRun: 80, maxUsdPerRun: 10 });
    fail = false;
    const r2 = await (await post(s.url, { pattern: "plan-poo-sit", plate: "PP1" })).json();
    expect(r2.run).toMatchObject({ painted: 1, failed: 0 });
    expect(s.bucket.objects.has("shared/plans/plan-poo-sit/PP1.failed.json")).toBe(false);
    expect(s.bucket.objects.has("shared/plans/plan-poo-sit/PP1.webp")).toBe(true);
    const st2 = await (await fetch(`${s.url}/admin/plan-plates`)).json();
    expect(st2.patterns["plan-poo-sit"].PP1).toBe("painted");
  });

  it("503 without a bucket (the status says storage: false)", async () => {
    const s = await up({ user: ADMIN, bucket: null });
    expect((await post(s.url, { pattern: "plan-poo-sit" })).status).toBe(503);
    expect((await (await fetch(`${s.url}/admin/plan-plates`)).json()).storage).toBe(false);
  });
});

describe("GET /plans/plates/:pattern/:plate", () => {
  const servers: { close: () => void }[] = [];
  afterAll(() => servers.forEach((s) => s.close()));
  const up = async (o: Parameters<typeof serve>[0] = {}) => { const s = await serve(o); servers.push(s); return s; };

  it("404 until painted, 200 with the image and long cache headers after; any signed-in user, no child in the path", async () => {
    const bucket = new MemoryBucket();
    const admin = await up({ user: ADMIN, bucket });
    const family = await up({ user: FAMILY, bucket });
    expect((await fetch(`${family.url}/plans/plates/plan-poo-sit/PP1`)).status).toBe(404);
    await post(admin.url, { pattern: "plan-poo-sit", plate: "PP1" });
    const r = await fetch(`${family.url}/plans/plates/plan-poo-sit/PP1`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("cache-control")).toBe("private, max-age=604800, immutable");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await r.arrayBuffer()).equals(MASTER)).toBe(true);
    expect((await fetch(`${family.url}/plans/plates/plan-poo-sit/PP2`)).status).toBe(404);
    expect((await fetch(`${family.url}/plans/plates/plan-made-up/PP1`)).status).toBe(404);
    expect((await fetch(`${family.url}/plans/plates/plan-poo-sit/..%2Fx`)).status).toBe(404);
  });

  it("401 signed out (fail closed), the sandbox's local caller only where allowed", async () => {
    const bucket = new MemoryBucket();
    bucket.objects.set("shared/plans/plan-poo-sit/PP1.webp", { data: Buffer.from("webp"), opts: { contentType: "image/webp" } });
    const closed = await up({ user: null, bucket });
    expect((await fetch(`${closed.url}/plans/plates/plan-poo-sit/PP1`)).status).toBe(401);
    const sandbox = await up({ user: null, bucket, allowLocal: true });
    const r = await fetch(`${sandbox.url}/plans/plates/plan-poo-sit/PP1`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/webp");
    const none = await up({ user: FAMILY, bucket: null });
    expect((await fetch(`${none.url}/plans/plates/plan-poo-sit/PP1`)).status).toBe(404);
  });
});
