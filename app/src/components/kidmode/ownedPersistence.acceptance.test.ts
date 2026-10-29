/**
 * B-KID-165 — owned persistence, verified as ONE matrix (the agent half; a
 * physical device's reload / offline / revoke is Guy's). Every place Kid
 * Mode keeps something of a child's:
 *   - is a registered per-child subcollection (export and erase reach it);
 *   - keeps EXACTLY the stated semantics: a book position, a quest step and a
 *     saved creation are REPLACED in place (one row per key — the latest), a
 *     keepsake is earned once and kept, a finished book is appended once per
 *     true ending; the key rule is read off the source;
 *   - has named fixtures for a child / account / edition switch, reload and
 *     offline, stale callbacks, refused or unavailable storage (no invented
 *     success) and a saved END that is not a new finish.
 * HELD (not built, by decision): a version HISTORY of saved creations and a
 * mid-game resume. No store for either exists; a new one fails here until it
 * comes with its retained / replaced semantics and export / erase proof.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const childData = read("lib/childData.ts");
const registered = new Set([...childData.slice(childData.indexOf("export const CHILD_SUBCOLLECTIONS")).matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]));

type Store = { name: string; module: string; keeps: "replaced" | "kept once" | "appended"; key: RegExp; fixtures: { file: string; tests: string[] }[] };
const STORES: Store[] = [
  {
    name: "bookBookmarks", module: "components/library/useBookBookmark.ts", keeps: "replaced",
    key: /bookmarkFor\(book, edition, /, // id = the book id: lib/library/bookBookmarks.bookmarkFor
    fixtures: [
      { file: "components/library/useBookBookmark.test.ts", tests: ["held callbacks cannot save after a %s switch", "an offline pending bookmark cannot migrate after a %s switch", "an owner round trip and unmount retire asynchronous writes before completion feedback", "failed writes retain the position for an explicit retry", "%s failure ignores unsafe rows and opens the cover", "reopens a safe owner-scoped offline cache without requiring server confirmation"] },
      { file: "lib/library/bookBookmarks.test.ts", tests: ["unknown pages, impossible branches, missing metadata and changed editions start at the cover", "binds to authored text/path and frozen assets, with stable object-key ordering"] },
      { file: "components/library/useBookProgress.test.ts", tests: ["only the final page to END completes; repeated effects and mounting a saved END do not"] },
    ],
  },
  {
    name: "studioQuestProgress", module: "components/kidmode/studioV2/studioProgress.ts", keeps: "replaced",
    key: /upsert\(\{ id: `\$\{STUDIO_QUEST_ID\}:\$\{step\}`/,
    fixtures: [{ file: "components/kidmode/studioV2/studioProgress.test.ts", tests: ["resumes exact choices after serialization without dates or expiry", "rejects malformed, foreign and out of order progress", "writes a bounded choice to deterministic doc, and rejects a stale owner receipt"] }],
  },
  {
    name: "studioCreations", module: "components/kidmode/studioV2/studioCreations.ts", keeps: "replaced",
    key: /upsert\(\{ id: clean\.kind, ownerId, childId, creation: clean \}\)/,
    fixtures: [{ file: "components/kidmode/studioV2/studioCreations.test.ts", tests: ["does not expose another owner or child, even from a local fallback", "refuses a write before hydration, after scope retirement, or on a fallback error", "does not acknowledge a rejected storage write"] }],
  },
  {
    name: "kidSouvenirs", module: "components/kidmode/rewards/useKidSouvenirs.ts", keeps: "kept once",
    key: /souvenirToAward\(store\.items, kind, refId, new Date\(\)\)/,
    fixtures: [{ file: "components/kidmode/rewards/kidSouvenirs.test.tsx", tests: ["a world or book ending earns its souvenir the first time only", "already earned: the sticker shows, no 'new', nothing is written again", "stored per child and registered for export + erase"] }],
  },
  {
    name: "bookReads", module: "lib/bookReads.ts", keeps: "appended",
    key: /id: `\$\{id\}--\$\{now\.getTime\(\)\}`/,
    fixtures: [{ file: "components/library/useBookProgress.test.ts", tests: ["only the final page to END completes; repeated effects and mounting a saved END do not"] }],
  },
];

describe("B-KID-165: every place Kid Mode keeps a child's things", () => {
  it.each(STORES.map((s) => [s.name, s] as const))("%s: registered for export and erase", (name) => {
    expect(registered.has(name), name).toBe(true);
  });

  it.each(STORES.map((s) => [s.name, s] as const))("%s: its key rule is in the source (what is replaced, kept or appended)", (_name, s) => {
    expect(read(s.module), `${s.module}: ${s.keeps}`).toMatch(s.key);
  });

  it.each(STORES.map((s) => [s.name, s] as const))("%s: the named owned fixtures exist", (_name, s) => {
    for (const f of s.fixtures) {
      const src = read(f.file);
      for (const t of f.tests) expect(src.includes(`"${t}"`) || src.includes(`'${t}'`), `${f.file} › ${t}`).toBe(true);
    }
  });

  it("a saved creation is REPLACED, never a history: one row per kind, the id is the kind", () => {
    const src = read("components/kidmode/studioV2/studioCreations.ts");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).toMatch(/row\.id === row\.creation\?\.kind/);
    expect(code).not.toMatch(/history|version|revision\s*:/i);
  });

  it("HELD: no creation history and no mid-game resume store exists until one comes with its semantics and export/erase proof", () => {
    const held = [...registered].filter((n) => /history|versions|resume|gameState|creationLog|questLog/i.test(n));
    expect(held).toEqual([]);
  });
});
