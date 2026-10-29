/**
 * PR C (Everyday Plans) — the reader's side of plan narration: the shelf entry
 * of a plan book carries the pattern's narration doc (the child's own set)
 * beside the shared plan sheet; the reader loads the voice folder from it
 * through the owner-checked file proxy; without it the book reads in silence;
 * a read makes ZERO model or TTS calls (files only, ever).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("./api", () => ({ authHeaders: async () => ({ "Content-Type": "application/json", Authorization: "Bearer T" }) }));

import { setBookAssetBackend, type BookAssetBackend, type CachedFile } from "./bookAssetStore";
import { libraryBookEntries, resolveBookAssets } from "./bookAssets";
import type { BookAssetsDoc } from "./library/bookAssetPaths";
import { planBookFromDoc, type PlanBookDoc } from "./library/plans/planBookDoc";
import { emptyPlanNarrationDoc, planNarrationFiles, planNarrationRel } from "./library/plans/planNarration";
import { PLAN_POSES, PLAN_SHEET_BOOK_ID } from "./library/plans/planPoses";

const CHILD = "kid1";
const PATTERN = "plan-poo-sit";
const plan: PlanBookDoc = {
  id: `${PATTERN}.${CHILD}`, bookId: `${PATTERN}.${CHILD}`, kind: "plan", pattern: PATTERN, lang: "en",
  stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "after-meal", boxItemIds: ["book"], durationDays: 14,
  approvedAt: new Date().toISOString(), approvedBy: "parent", createdAt: "t", updatedAt: "t", status: "active",
};
const SHEET = "h-0123456789abcdef";
const sheet: BookAssetsDoc = {
  id: PLAN_SHEET_BOOK_ID, bookId: PLAN_SHEET_BOOK_ID, sheetId: SHEET, setId: SHEET,
  sheetManifest: { poses: Object.fromEntries(PLAN_POSES.map((p) => [p, { file: `${p}.webp`, aspect: 0.6, footX: 0.5, footW: 0.3 }])) },
  files: PLAN_POSES.map((p) => `hero-sheets/${SHEET}/${p}.webp`), bytes: 1, createdAt: "t0",
};
const book = planBookFromDoc(plan)!;
const narration = (folder: "en" | "he-f" = "en"): BookAssetsDoc => {
  const rels = planNarrationFiles(book, folder).map((f) => planNarrationRel(CHILD, folder, f.file));
  return { ...emptyPlanNarrationDoc(CHILD, PATTERN, "t1"), files: rels, narrationText: Object.fromEntries(rels.map((r) => [r, "h"])) };
};

function memoryBackend(): BookAssetBackend {
  const recs = new Map<string, CachedFile>();
  return { get: async (id) => recs.get(id), put: async (r) => void recs.set(r.id, r), deleteWhere: async (pred) => { for (const [k, r] of recs) if (pred(r)) recs.delete(k); } };
}

describe("PR C: the shelf entry of a plan book", () => {
  it("carries the pattern's narration doc beside the shared plan sheet; without one the entry has none; the narration doc is never a book", () => {
    const bare = libraryBookEntries([sheet], [plan]);
    expect(bare.map((e) => e.book.id)).toEqual([plan.id]);
    expect(bare[0].narration).toBeUndefined();
    const n = narration();
    const entries = libraryBookEntries([sheet, n, { ...emptyPlanNarrationDoc(CHILD, "plan-sleep-alone", "t1") }], [plan]);
    expect(entries.map((e) => e.book.id)).toEqual([plan.id]);
    expect(entries[0].doc).toBe(sheet);
    expect(entries[0].narration).toBe(n);
    expect(libraryBookEntries([n], [])).toEqual([]);
  });
});

describe("PR C: reading a plan book", () => {
  const calls: { url: string; method: string }[] = [];
  beforeEach(() => {
    setBookAssetBackend(memoryBackend());
    calls.length = 0;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, method: (init?.method ?? "GET").toUpperCase() });
      return new Response("BYTES", { status: 200 });
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setBookAssetBackend(null);
  });

  it("loads the sheet from plan-poses and the voice folder from the pattern's doc, as blob URLs keyed <folder>/<file>", async () => {
    const r = await resolveBookAssets(CHILD, sheet, "en", { narration: narration() });
    expect(Object.keys(r.sheet.poses).sort()).toEqual([...PLAN_POSES].sort());
    expect(Object.keys(r.narration.files).sort()).toEqual(planNarrationFiles(book, "en").map((f) => `en/${f.file}`).sort());
    expect(r.narration.files["en/cover.mp3"]).toMatch(/^blob:/);
    expect(calls.some((c) => c.url === `/api/children/${CHILD}/book-assets/${PATTERN}/file?path=${encodeURIComponent(`narration/${CHILD}/en/cover.mp3`)}`)).toBe(true);
    expect(calls.some((c) => c.url === `/api/children/${CHILD}/book-assets/${PLAN_SHEET_BOOK_ID}/file?path=${encodeURIComponent(`hero-sheets/${SHEET}/sit-calm.webp`)}`)).toBe(true);
    // the plan sheet's own doc is never asked for narration; the other folder is never fetched
    expect(calls.some((c) => c.url.includes(`book-assets/${PLAN_SHEET_BOOK_ID}/file?path=narration`))).toBe(false);
    expect(calls.some((c) => c.url.includes("he-f"))).toBe(false);
    r.revoke();
  });

  it("without a narration doc the book reads in silence: the sheet loads, no narration file is asked for", async () => {
    const r = await resolveBookAssets(CHILD, sheet, "en");
    expect(Object.keys(r.sheet.poses).length).toBe(PLAN_POSES.length);
    expect(r.narration.files).toEqual({});
    expect(calls.some((c) => c.url.includes("narration"))).toBe(false);
    r.revoke();
  });

  it("a read makes zero model or TTS calls: GET file reads only, never a narration route", async () => {
    const r = await resolveBookAssets(CHILD, sheet, "he-f", { narration: narration("he-f") });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.method === "GET" && /\/book-assets\/[^/]+\/file\?path=/.test(c.url))).toBe(true);
    expect(calls.some((c) => /narration$|plan-narration|book-narration|hero-pose|generate|tts/i.test(c.url))).toBe(false);
    r.revoke();
  });

  it("the reader modules never reach a narration route or the parent-side builders (files only)", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = path.resolve(here, "..");
    for (const f of ["components/kidmode/KidBookReaderView.tsx", "components/library/BookReader.tsx", "components/library/useNarration.ts", "lib/bookAssets.ts", "lib/bookAssetStore.ts"]) {
      const s = readFileSync(path.join(src, f), "utf8");
      expect(s, f).not.toMatch(/plan-narration|book-narration|buildPlanNarration|buildBookNarration|\/api\/hero-pose/);
      expect(s, f).not.toMatch(/method:\s*["']POST["']/);
    }
  });
});
