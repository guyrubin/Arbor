/**
 * B-GAME-13c — who plays: the resolution chain order on fixtures, the proof
 * allow-list, and the child's own docs (partial plays, stale is skipped).
 */
import { describe, expect, it, vi } from "vitest";
import { heroAvatarHash, type HeroSheetPoseDoc, type HeroSheetPoseId } from "../../../lib/heroSheetContract";
import { parseHeroSheetDocs, sheetFromDocs, type HeroSheetDocs } from "../../../lib/heroSheetStore";
import { avatarFallbackSheet, proofAllowedFor, resolveHeroSheetChain, stockSheetUrl, type ChainSources } from "./useHeroSheet";
import { resolvePose } from "./heroSheet";
import type { HeroSheet } from "./heroSheet";

const HERO = "data:image/png;base64,SEVSTw==";
const HASH = heroAvatarHash(HERO);
const sheet = (source: HeroSheet["source"], heroId: string): HeroSheet => ({ v: 1, heroId, source, theme: "film3d", poses: { idle: { url: `data:image/png;base64,${heroId}`, w: 10, h: 20, foot: { x: 5, y: 19 } } } });
const poseDoc = (pose: HeroSheetPoseId, avatarHash = HASH): HeroSheetPoseDoc => ({
  id: pose, v: 1, pose, dataUrl: `data:image/webp;base64,${pose}`, w: 400, h: 960, foot: { x: 200, y: 940 }, head: { x: 200, y: 200, r: 90 },
  scale: 1, avatarHash, model: "m", keyColour: "#00B140", createdAt: "2026-10-06",
});
const docsOf = (poses: HeroSheetPoseId[], avatarHash = HASH, status: "building" | "complete" = "building"): HeroSheetDocs =>
  parseHeroSheetDocs([{ id: "_meta", v: 1, heroId: avatarHash, source: "generated", avatarHash, poses, status, updatedAt: "x" }, ...poses.map((p) => poseDoc(p, avatarHash))]);

const sources = (over: Partial<ChainSources> = {}): ChainSources => ({
  docs: null,
  proofAllowed: false,
  loadProof: async () => sheet("proof", "proof"),
  readDevice: () => null,
  loadStock: async (id) => sheet("stock", id),
  ...over,
});

describe("B-GAME-13c resolution chain", () => {
  const child = { id: "c1", photoUrl: HERO, avatar: { source: "descriptor" } };

  it("1: the child's own sheet wins once idle + cheer exist (partial plays, the rest falls back)", async () => {
    const r = await resolveHeroSheetChain(child, sources({ docs: docsOf(["idle", "cheer"]), proofAllowed: true }));
    expect(r.from).toBe("child");
    expect(Object.keys(r.sheet.poses).sort()).toEqual(["cheer", "idle"]);
    expect(r.sheet.source).toBe("generated");
    expect(r.sheet.poses.idle?.url).toBe("data:image/webp;base64,idle");
  });

  it("idle alone is not yet playable: the chain falls through", async () => {
    const r = await resolveHeroSheetChain(child, sources({ docs: docsOf(["idle"]) }));
    expect(r.from).toBe("avatar");
    expect(r.sheet.poses.idle?.url).toBe(HERO);
  });

  it("a sheet of an older hero is stale and skipped", async () => {
    const r = await resolveHeroSheetChain(child, sources({ docs: docsOf(["idle", "cheer"], "0000000000000000") }));
    expect(r.from).toBe("avatar");
    expect(sheetFromDocs(docsOf(["idle", "cheer"], "0000000000000000"), HASH)).toBeNull();
  });

  it("2: the proof only when allowed; 3: the device sheet; 4: the chosen stock hero; 5: the placeholder", async () => {
    const child = { id: "c1" }; // Legacy unbound likeness art requires an explicit sandbox source.
    expect((await resolveHeroSheetChain(child, sources({ proofAllowed: true, allowUnboundProof: true }))).from).toBe("proof");
    expect((await resolveHeroSheetChain(child, sources({ proofAllowed: false }))).from).toBe("placeholder");
    expect((await resolveHeroSheetChain(child, sources({ allowUnboundProof: true, readDevice: () => sheet("proof", "device") }))).from).toBe("device");
    const stock = await resolveHeroSheetChain({ ...child, stockHeroId: "s3" }, sources());
    expect(stock.from).toBe("stock");
    expect(stock.sheet.heroId).toBe("s3");
    // An absent stock sheet falls through; a junk id is never fetched.
    expect((await resolveHeroSheetChain({ ...child, stockHeroId: "s3" }, sources({ loadStock: async () => null }))).from).toBe("placeholder");
    let asked = "";
    await resolveHeroSheetChain({ ...child, stockHeroId: "../../x" }, sources({ loadStock: async (id) => { asked = id; return null; } }));
    expect(asked).toBe("");
    expect(stockSheetUrl("s3")).toBe("/visuals/heroes/s3/sheet.json");
    // Order: the device sheet beats the stock hero; the proof beats the device.
    expect((await resolveHeroSheetChain({ ...child, stockHeroId: "s3" }, sources({ allowUnboundProof: true, readDevice: () => sheet("proof", "device") }))).from).toBe("device");
    expect((await resolveHeroSheetChain(child, sources({ allowUnboundProof: true, proofAllowed: true, readDevice: () => sheet("proof", "device") }))).from).toBe("proof");
    // A failing proof fetch falls through.
    expect((await resolveHeroSheetChain(child, sources({ proofAllowed: true, loadProof: async () => { throw new Error("offline"); } }))).from).toBe("placeholder");
  });

  it("the proof allow-list: listed children, or a build without Firebase (the sandbox); never another family", () => {
    expect(proofAllowedFor("son", { firebase: true })).toBe(false);
    expect(proofAllowedFor("other", { firebase: false })).toBe(true);
    expect(proofAllowedFor("", { firebase: false })).toBe(false);
  });
});

describe("approved profile avatar is the identity authority", () => {
  const current = { id: "c1", photoUrl: HERO, avatar: { source: "descriptor" } };
  it("does not show unrelated proof, device or stock art for an approved profile avatar", async () => {
    const loadStock = vi.fn(async (id: string) => sheet("stock", id));
    const result = await resolveHeroSheetChain({ ...current, stockHeroId: "other" }, sources({
      proofAllowed: true, readDevice: () => sheet("proof", "old-hero"), loadStock,
    }));
    expect(result.from).toBe("avatar"); expect(result.sheet.source).toBe("avatar");
    expect(result.sheet.poses.idle?.url).toBe(HERO); expect(loadStock).not.toHaveBeenCalled();
    // Every requested pose reuses the same approved pixels until poses exist.
    expect(resolvePose(result.sheet, "cheer")?.sprite.url).toBe(HERO);
    expect(resolvePose(result.sheet, "dash")?.sprite.url).toBe(HERO);
  });
  it("removing the approved avatar cannot resurrect historical proof/device likeness in production", async () => {
    const old = sheet("proof", HASH);
    const result = await resolveHeroSheetChain({ id: "proof-child" }, sources({
      proofAllowed: true, loadProof: async () => old, readDevice: () => old,
    }));
    expect(result.from).toBe("placeholder"); expect(result.sheet.heroId).not.toBe(HASH);
    const selected = await resolveHeroSheetChain({ id: "c1", stockHeroId: "chosen" }, sources({ readDevice: () => old }));
    expect(selected.from).toBe("stock"); expect(selected.sheet.heroId).toBe("chosen");
  });
  it("accepts a proof or device sheet only when its identity matches the current avatar", async () => {
    const proof = await resolveHeroSheetChain(current, sources({ proofAllowed: true, loadProof: async () => sheet("proof", HASH) }));
    expect(proof.from).toBe("proof");
    const device = await resolveHeroSheetChain(current, sources({ readDevice: () => sheet("generated", HASH) }));
    expect(device.from).toBe("device");
  });
  it("follows the same comic-before-photo rule as the profile preview, including stale docs", async () => {
    const comicAvatarUrl = "data:image/png;base64,Q09NSUM=", comicHash = heroAvatarHash(comicAvatarUrl);
    const child = { ...current, comicAvatarUrl };
    const old = await resolveHeroSheetChain(child, sources({ docs: docsOf(["idle", "cheer"]) }));
    expect(old.from).toBe("avatar"); expect(old.sheet.poses.idle?.url).toBe(comicAvatarUrl);
    const matching = await resolveHeroSheetChain(child, sources({ docs: docsOf(["idle", "cheer"], comicHash) }));
    expect(matching.from).toBe("child"); expect(matching.sheet.heroId).toBe(comicHash);
  });
  it.each(["data:image/jpeg;base64,UkFX", "https://photos.invalid/raw.jpg"])("never promotes an uploaded photo without generated metadata (%s)", async photoUrl => {
    const result = await resolveHeroSheetChain({ id: "c1", photoUrl }, sources({ docs: docsOf(["idle", "cheer"]) }));
    expect(result.from).toBe("placeholder");
    expect(Object.values(result.sheet.poses).every(pose => pose?.url !== photoUrl)).toBe(true);
  });
  it("keeps an approved portrait's original URL and neutral box without inventing body proportions", () => {
    const fallback = avatarFallbackSheet(HERO);
    expect(fallback.heroId).toBe(HASH); expect(Object.keys(fallback.poses)).toEqual(["idle"]);
    expect(fallback.poses.idle).toEqual({ url: HERO, w: 1, h: 1, foot: { x: 0.5, y: 1 } });
  });
});

describe("B-GAME-13c stored docs", () => {
  it("parses only well-formed pose docs and the meta; junk and unsafe urls are dropped", () => {
    const d = parseHeroSheetDocs([
      { id: "_meta", avatarHash: HASH, poses: ["idle", "wave"], status: "complete" },
      poseDoc("idle"),
      { ...poseDoc("cheer"), dataUrl: "javascript:alert(1)" },
      { ...poseDoc("oops"), pose: "idle" },
      { ...poseDoc("dash"), foot: { x: "1" } },
      { ...poseDoc("hold-up"), hand: { l: [1, 2], r: [3, 4] } },
      "junk", null,
    ]);
    expect(d.meta?.poses).toEqual(["idle"]);
    expect(d.meta?.status).toBe("complete");
    expect(Object.keys(d.poses).sort()).toEqual(["hold-up", "idle"]);
    expect(d.poses["hold-up"]?.hand).toEqual({ l: [1, 2], r: [3, 4] });
    expect(parseHeroSheetDocs({ v: 1, poses: {} })).toEqual({ meta: null, poses: {} }); // an injected proof object is not docs
  });
});

describe("B-BOOK-71 / B-GAME-35: no production child id in the public source", () => {
  it("the proof sheet is sandbox-only: no child plays it on a Firebase build", async () => {
    const { proofAllowedFor } = await import("./useHeroSheet");
    for (const id of ["proof-child", "c1"]) expect(proofAllowedFor(id, { firebase: true })).toBe(false);
    expect(proofAllowedFor("", { firebase: false })).toBe(false);
  });
  it("B-BOOK-71 guard: a hosted production build never opens the sandbox seam, even without Firebase", async () => {
    const { heroSandboxSeam, proofAllowedFor } = await import("./useHeroSheet");
    expect(heroSandboxSeam({ firebase: false, hosted: false })).toBe(true); // the sandbox keeps its proof hero
    expect(heroSandboxSeam({ firebase: false, hosted: true })).toBe(false);
    expect(heroSandboxSeam({ firebase: true, hosted: false })).toBe(false);
    expect(proofAllowedFor("c1", { firebase: false, hosted: true })).toBe(false);
    expect(proofAllowedFor("c1", { firebase: false, hosted: false })).toBe(true);
    // Every sandbox branch of the hook reads the one seam (no bare Firebase check left).
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.resolve(__dirname, "useHeroSheet.ts"), "utf8");
    expect(src).toMatch(/allowUnboundProof: heroSandboxSeam\(\)/);
    expect(src).not.toMatch(/firebaseEnabled \? null : readStoredHeroSheet|allowUnboundProof: !firebaseEnabled/);
  });
  it("B-BOOK-71 guard: no *_CHILD_IDS constant with a literal id exists under app/src (an allow-list of children is never public source)", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "../../..");
    // A declared constant whose name ends in _CHILD_ID(S), assigned a literal:
    // an array or a Set of literals, or a string.
    const literalAllowList = /\b(?:const|let|var)\s+[A-Z][A-Z0-9_]*_CHILD_IDS?\b\s*(?::[^=\n]*)?=\s*(?:new\s+Set\s*(?:<[^>]*>)?\(\s*)?(?:\[\s*)?["'`]/;
    const retiredName = ["PROOF", "HERO", "CHILD", "IDS"].join("_");
    // Negative controls (names built at run time so this file never matches itself).
    const ids = ["SAMPLE", "CHILD", "IDS"].join("_");
    const one = ["OWNER", "CHILD", "ID"].join("_");
    expect(literalAllowList.test(`export const ${ids} = ["kid-a"];`)).toBe(true);
    expect(literalAllowList.test(`const ${ids}: ReadonlySet<string> = new Set(['kid-a']);`)).toBe(true);
    expect(literalAllowList.test(`const ${one} = "kid-a";`)).toBe(true);
    expect(literalAllowList.test(`const ${ids} = readIdsFromConfig();`)).toBe(false);
    expect(literalAllowList.test(`export const ${one} = defaultChildProfile.id;`)).toBe(false);
    expect(literalAllowList.test(`f({ childId = ${one}, gender = "boy" })`)).toBe(false);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx|mts|mjs|json)$/.test(name)) continue;
        const text = readFileSync(full, "utf8");
        if (literalAllowList.test(text) || text.includes(retiredName)) hits.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
  it("no source file under app/src names a production child id (child-<13 digits>)", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "../../..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx|json)$/.test(name)) continue;
        if (new RegExp("child-1[0-9]{12}").test(readFileSync(full, "utf8"))) hits.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
  it("the parent door starts ensureHeroSheet for every child (a complete sheet of the current hero is never redrawn)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.resolve(__dirname, "../../layout/KidModeButton.tsx"), "utf8");
    expect(src).toMatch(/if \(child\) void ensureHeroSheet\(child\);/);
    expect((src.match(/ensureHeroSheet\(/g) ?? []).length).toBe(1);
  });
});
