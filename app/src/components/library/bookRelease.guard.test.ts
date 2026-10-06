/**
 * B-BOOK release (R3) — production guards for the book path:
 *   1. the only book files in the bundle are the child-free plates and
 *      overlays (public/visuals/books): no sprite, print, choice picture or
 *      narration — those are private, per child, in Storage;
 *   2. production code never names the DEV folder (public/_dev) outside the
 *      DEV-gated library files, and the kid door opens the reader with
 *      dev={false};
 *   3. the book path makes no model call: the kid door files and the private
 *      file loader never reach a generate / TTS endpoint or speech synthesis,
 *      and the loader's only request is the owner-checked book-asset proxy;
 *   4. a child without complete private files sees no change (the hook is
 *      cloud-only and returns nothing until the collection has loaded).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const APP = path.resolve(SRC, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const DOOR = [
  "components/kidmode/KidBookReaderView.tsx",
  "components/kidmode/LibraryBookCover.tsx",
  "components/kidmode/useChildLibraryBooks.ts",
  "lib/bookAssets.ts",
  "lib/bookAssetStore.ts",
  "server/bookAssets.ts",
  "lib/library/bookAssetPaths.ts",
  "lib/library/bookPoses.ts",
];

describe("R3: the bundle carries only child-free book files", () => {
  it("public/visuals/books holds plates and overlays only — no sprite, print, choice, narration or manifest", () => {
    const files = walk(path.join(APP, "public", "visuals", "books")).map((f) => path.relative(path.join(APP, "public", "visuals", "books"), f).split(path.sep).join("/"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f, f).toMatch(/^[a-z0-9-]+\/(?:PL[A-Za-z0-9-]*\.webp|overlays\/[a-z0-9-]+\.webp)$/);
      expect(f, f).not.toMatch(/hero-sheets|prints|choices|narration|\.mp3|\.wav|\.json/);
    }
  });
});

describe("R3: production code never reaches the DEV folder", () => {
  it("only the DEV-gated library files name /_dev (each behind a dev flag); the door files never do", () => {
    const named = walk(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("/_dev"))
      .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
      .sort();
    expect(named).toEqual([
      "components/library/devBookRoute.tsx",
      "lib/library/bookPlates.ts",
      "lib/library/books/fiveSmoothStones.ts",
      "lib/library/heroSheet.ts",
      "lib/library/narration.ts",
      "lib/library/staticJson.ts",
    ]);
    for (const f of DOOR) expect(read(f), f).not.toContain("_dev");
  });

  it("the kid door opens the reader with dev={false}, the child's own sheet and narration; ?book stays DEV-only", () => {
    const view = read("components/kidmode/KidBookReaderView.tsx");
    expect(view).toMatch(/<BookReader [^>]*dev=\{false\}[^>]*sheet=\{resolved\.sheet\}[^>]*assets=\{resolved\.narration\}/);
    expect(read("main.tsx")).toMatch(/const devBookReview = import\.meta\.env\.DEV && new URLSearchParams/);
    expect(read("lib/library/heroSheet.ts")).toMatch(/if \(opts\.dev && id\) return devHeroSheet\(id\);\s+return null;/);
  });
});

describe("R3: no model call on the book path", () => {
  it("the door files never reach a generate / TTS endpoint, speech synthesis or the TTS queue", () => {
    for (const f of DOOR) {
      const s = read(f);
      expect(s, f).not.toMatch(/\/api\/generate|\/api\/tts|speechSynthesis|kidSay\(|autoReadPage|api\.generate|naturalVoice|lib\/voice/);
    }
  });

  it("the loader's ONE request is the owner-checked book-asset proxy, with the bearer token from authHeaders only", () => {
    const store = read("lib/bookAssetStore.ts");
    expect(store.match(/fetch\(/g)).toHaveLength(1);
    expect(store).toMatch(/await fetch\(bookAssetUrl\(childId, doc\.bookId, rel\)/);
    expect(store).toMatch(/import \{ authHeaders \} from "\.\/api";/);
    expect(store).not.toMatch(/import \{[^}]*\b(api|generate)[A-Za-z]*\b[^}]*\} from "\.\/api"/);
    for (const f of DOOR.filter((x) => x !== "lib/bookAssetStore.ts")) expect(read(f).includes("fetch("), f).toBe(false);
  });
});

describe("R2: a child without complete private files sees no change", () => {
  it("the hook is cloud-only and empty until loaded; the kid home shows library books only with the opener", () => {
    expect(read("components/kidmode/useChildLibraryBooks.ts")).toContain("col.remote && col.loaded ? libraryBookEntries(col.items) : []");
    const dash = read("components/kidmode/KidDashboard.tsx");
    expect(dash).toContain("const tonightLib = onOpenBook ? libraryBooks[0] ?? null : null;");
    expect(dash).toContain("const moreLib = onOpenBook ? libraryBooks.slice(1) : [];");
    expect(read("components/kidmode/KidModeOverlay.tsx")).toContain("onOpenBook={setOpenBookId}");
  });
});
