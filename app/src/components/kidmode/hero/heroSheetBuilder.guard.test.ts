/**
 * B-GAME-13c guard — nothing in Kid Mode triggers generation. The builder (and
 * the pose route it calls) is reachable only from the parent side: no module
 * under components/kidmode/ imports it except its own files; no game imports
 * the keyer or the store's writers; the route is called with ids only.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchHeroPose } from "./buildHeroSheet";

const here = path.dirname(fileURLToPath(import.meta.url));
const KIDMODE = path.resolve(here, "..");
const SRC = path.resolve(KIDMODE, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");
const BUILDER_FILES = new Set(["components/kidmode/hero/buildHeroSheet.ts"]);

describe("B-GAME-13c: Kid Mode never draws a hero", () => {
  const kid = walk(KIDMODE);

  it("the scan sees Kid Mode (games included)", () => {
    expect(kid.length).toBeGreaterThan(30);
    expect(kid.some((f) => rel(f).startsWith("components/kidmode/games/"))).toBe(true);
  });

  it("no Kid Mode module imports the builder or calls the pose route", () => {
    const offenders = kid
      .filter((f) => !BUILDER_FILES.has(rel(f)))
      .filter((f) => { const s = readFileSync(f, "utf8"); return /from\s+["'][^"']*buildHeroSheet["']/.test(s) || s.includes("/api/hero-pose"); })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("no game imports the keyer, and only the builder writes sheet docs", () => {
    const games = kid.filter((f) => rel(f).startsWith("components/kidmode/games/"));
    for (const f of games) expect(readFileSync(f, "utf8"), rel(f)).not.toMatch(/heroKeyer|buildHeroSheet/);
    const writers = kid.filter((f) => /\.(writePose|writeMeta)\(/.test(readFileSync(f, "utf8"))).map(rel);
    expect(writers).toEqual(["components/kidmode/hero/buildHeroSheet.ts"]);
  });

  it("the parent side starts it from the accept, not from a render", () => {
    const creator = readFileSync(path.join(SRC, "components/profile/AvatarCreator.tsx"), "utf8");
    const use = creator.slice(creator.indexOf("const use = async () => {"), creator.indexOf("const visibleResult"));
    expect(use).toMatch(/onCreated\([\s\S]*?\);\s*[\s\S]*?startHeroSheet\(\{ childId, photoUrl: dataUrl, source: draft\.source \}\)/);
    expect((creator.match(/startHeroSheet\(/g) ?? []).length).toBe(1);
  });
});

describe("B-GAME-13c: the device sends ids only", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("fetchHeroPose posts { childId, pose, avatarHash } and nothing else; refusals come back as codes", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return { ok: false, status: 403, json: async () => ({ code: "hero_sheet_plan" }) };
    });
    const r = await fetchHeroPose({ childId: "c1", pose: "idle", avatarHash: "abc" });
    expect(r).toEqual({ ok: false, status: 403, code: "hero_sheet_plan" });
    expect(Object.keys(bodies[0] as object).sort()).toEqual(["avatarHash", "childId", "pose"]);
  });
});
