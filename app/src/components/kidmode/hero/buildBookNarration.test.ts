/**
 * K2 2c — the narration builder: the five name files of the folder the child
 * hears (HE-f for a girl, HE-m otherwise, EN), ids only, a refusal or the quota
 * stops it, the rate limit is waited out, the sandbox keeps the doc, and it
 * runs again only when the name, the Hebrew form or the language changes; the
 * book sheet hands over to it.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
import { afterBookSheet, buildBookNarration, ensureBookNarration, narrationFolder, resetBookNarrationForTest, type NarrationBuilderDeps, type NarrationCall } from "./buildBookNarration";

const here = path.dirname(fileURLToPath(import.meta.url));
const DOC = { id: "five-smooth-stones", bookId: "five-smooth-stones", sheetId: "h-0123456789abcdef", setId: "n-1", sheetManifest: { poses: {} }, files: [], bytes: 0, createdAt: "t" } as BookAssetsDoc;

function fake(answer: (body: { bookId: string; lang: string; file: string }, n: number) => NarrationCall = (_b, n) => ({ ok: true, complete: n === 5, cached: false, ...(n === 5 ? { doc: DOC, local: true } : {}) })) {
  const bodies: { bookId: string; lang: string; file: string }[] = [];
  const kept: BookAssetsDoc[] = [];
  const sleeps: number[] = [];
  const deps: NarrationBuilderDeps = {
    render: async (body) => { bodies.push(body); return answer(body, bodies.length); },
    keepLocalDoc: async (d) => void kept.push(d),
    sleep: async (ms) => void sleeps.push(ms),
  };
  return { deps, bodies, kept, sleeps };
}
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

beforeEach(() => resetBookNarrationForTest());

describe("K2 2c: the narration builder", () => {
  it("the folder the child hears: EN, HE-f for a girl, HE-m for a boy or no recorded gender", () => {
    expect(narrationFolder("en", "girl")).toBe("en");
    expect(narrationFolder("he", "girl")).toBe("he-f");
    expect(narrationFolder("he", "boy")).toBe("he-m");
    expect(narrationFolder("he", undefined)).toBe("he-m");
  });

  it("asks for the five name files of the folder, ids only; the sandbox keeps the completed doc", async () => {
    const f = fake();
    const r = await buildBookNarration({ childId: "kid1", folder: "he-f" }, f.deps);
    expect(r).toMatchObject({ status: "complete", rendered: 5 });
    expect(f.bodies.map((b) => b.file)).toEqual(["cover.mp3", "p1.mp3", "p10.a.mp3", "p10.b.mp3", "p10.c.mp3"]);
    for (const b of f.bodies) expect(Object.keys(b).sort()).toEqual(["bookId", "file", "lang"]);
    expect(f.bodies.every((b) => b.lang === "he-f")).toBe(true);
    expect(f.kept).toEqual([DOC]);
  });

  it("a refusal or the quota stops the run; the rate limit and a busy voice are waited out", async () => {
    const quota = fake((_b, n) => (n === 2 ? { ok: false, status: 429, code: "book_narration_resting" } : { ok: true, complete: false, cached: false }));
    expect(await buildBookNarration({ childId: "kid1", folder: "en" }, quota.deps)).toMatchObject({ status: "stopped", stoppedBy: "book_narration_resting", rendered: 1 });
    expect(quota.bodies).toHaveLength(2);
    const plan = fake(() => ({ ok: false, status: 403, code: "book_narration_plan" }));
    expect(await buildBookNarration({ childId: "kid1", folder: "en" }, plan.deps)).toMatchObject({ status: "not-started", stoppedBy: "book_narration_plan" });
    expect(plan.bodies).toHaveLength(1);
    const limited = fake((_b, n) => (n <= 2 ? { ok: false, status: 429, code: "book_assets_rate" } : n === 3 ? { ok: false, status: 503, code: "book_narration_busy" } : { ok: true, complete: false, cached: true }));
    expect((await buildBookNarration({ childId: "kid1", folder: "en" }, limited.deps)).status).toBe("complete");
    expect(limited.sleeps).toEqual([20_000, 20_000, 8000]);
  });

  it("runs again only when the name, the Hebrew form or the folder changes; the sheet hands over with the last known context", async () => {
    const storage = mem();
    const child = { id: "kid1", name: "Maya Cohen", gender: "girl" as const };
    const a = fake();
    await ensureBookNarration(child, "he-f", a.deps, storage);
    expect(a.bodies).toHaveLength(5);
    resetBookNarrationForTest();
    const b = fake();
    expect(ensureBookNarration(child, "he-f", b.deps, storage)).toBeNull(); // done on this device
    const c = fake();
    await ensureBookNarration({ ...child, name: "Noa" }, "he-f", c.deps, storage);
    expect(c.bodies).toHaveLength(5);
    const d = fake();
    await ensureBookNarration({ ...child, name: "Noa" }, "en", d.deps, storage);
    expect(d.bodies.every((x) => x.lang === "en")).toBe(true);
    const e = fake();
    await afterBookSheet("kid1", e.deps);
    expect(e.bodies).toHaveLength(5);
    expect(afterBookSheet("nobody")).toBeNull();
    expect(ensureBookNarration({ id: "kid2", name: "" }, "en")).toBeNull();
  });

  it("wired: the book sheet hands over after a commit; the parent shell runs it for the folder the child hears", () => {
    const sheet = readFileSync(path.join(here, "buildBookSheet.ts"), "utf8");
    expect(sheet).toContain('if (r.status === "complete" || r.status === "already") void import("./buildBookNarration").then((m) => m.afterBookSheet(childId))');
    const door = readFileSync(path.join(here, "..", "..", "layout", "KidModeButton.tsx"), "utf8");
    expect(door).toContain("const narrationVoice = narrationFolder(storyLanguage(uiLang, aiLang), child?.gender);");
    expect(door).toContain("void ensureBookNarration(child, narrationVoice); }, [child?.id, child?.name, child?.gender, narrationVoice]);");
  });
});
