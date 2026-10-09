/**
 * B-GAME-13c — who plays: the resolution chain order on fixtures, the proof
 * allow-list, and the child's own docs (partial plays, stale is skipped).
 */
import { describe, expect, it } from "vitest";
import { heroAvatarHash, type HeroSheetPoseDoc, type HeroSheetPoseId } from "../../../lib/heroSheetContract";
import { parseHeroSheetDocs, sheetFromDocs, type HeroSheetDocs } from "../../../lib/heroSheetStore";
import { proofAllowedFor, resolveHeroSheetChain, stockSheetUrl, type ChainSources } from "./useHeroSheet";
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
  const child = { id: "c1", photoUrl: HERO };

  it("1: the child's own sheet wins once idle + cheer exist (partial plays, the rest falls back)", async () => {
    const r = await resolveHeroSheetChain(child, sources({ docs: docsOf(["idle", "cheer"]), proofAllowed: true }));
    expect(r.from).toBe("child");
    expect(Object.keys(r.sheet.poses).sort()).toEqual(["cheer", "idle"]);
    expect(r.sheet.source).toBe("generated");
    expect(r.sheet.poses.idle?.url).toBe("data:image/webp;base64,idle");
  });

  it("idle alone is not yet playable: the chain falls through", async () => {
    const r = await resolveHeroSheetChain(child, sources({ docs: docsOf(["idle"]) }));
    expect(r.from).toBe("placeholder");
  });

  it("a sheet of an older hero is stale and skipped", async () => {
    const r = await resolveHeroSheetChain(child, sources({ docs: docsOf(["idle", "cheer"], "0000000000000000") }));
    expect(r.from).toBe("placeholder");
    expect(sheetFromDocs(docsOf(["idle", "cheer"], "0000000000000000"), HASH)).toBeNull();
  });

  it("2: the proof only when allowed; 3: the device sheet; 4: the chosen stock hero; 5: the placeholder", async () => {
    expect((await resolveHeroSheetChain(child, sources({ proofAllowed: true }))).from).toBe("proof");
    expect((await resolveHeroSheetChain(child, sources({ proofAllowed: false }))).from).toBe("placeholder");
    expect((await resolveHeroSheetChain(child, sources({ readDevice: () => sheet("proof", "device") }))).from).toBe("device");
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
    expect((await resolveHeroSheetChain({ ...child, stockHeroId: "s3" }, sources({ readDevice: () => sheet("proof", "device") }))).from).toBe("device");
    expect((await resolveHeroSheetChain(child, sources({ proofAllowed: true, readDevice: () => sheet("proof", "device") }))).from).toBe("proof");
    // A failing proof fetch falls through.
    expect((await resolveHeroSheetChain(child, sources({ proofAllowed: true, loadProof: async () => { throw new Error("offline"); } }))).from).toBe("placeholder");
  });

  it("the proof allow-list: listed children, or a build without Firebase (the sandbox); never another family", () => {
    expect(proofAllowedFor("son", { firebase: true, allowList: ["son"] })).toBe(true);
    expect(proofAllowedFor("other", { firebase: true, allowList: ["son"] })).toBe(false);
    expect(proofAllowedFor("other", { firebase: false, allowList: [] })).toBe(true);
    expect(proofAllowedFor("", { firebase: false })).toBe(false);
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

describe("K1: the proof hero stays with the proof child only", () => {
  it("the owner's son (his production child id) keeps the proof sheet on a Firebase build; any other child does not", async () => {
    const { proofAllowedFor, PROOF_HERO_CHILD_IDS } = await import("./useHeroSheet");
    expect(PROOF_HERO_CHILD_IDS).toEqual(["child-1780330920145"]);
    expect(proofAllowedFor("child-1780330920145", { firebase: true })).toBe(true);
    expect(proofAllowedFor("child-1780330920146", { firebase: true })).toBe(false);
    expect(proofAllowedFor("", { firebase: true })).toBe(false);
  });
});
