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
 *      cloud-only and returns nothing until the collection has loaded);
 *   5. (K2) the only narration in the bundle is a book's SHARED set: exactly
 *      its name-free files (lib/library/narrationFiles), and no file that
 *      says the child's name exists anywhere under public/audio.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allBooks } from "../../lib/library/books";
import { nameBearingFiles, sharedNarrationShipped, SHARED_NARRATION_SETS, VOICE_FOLDERS } from "../../lib/library/narrationFiles";

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

// ── K2: the shared narration ─────────────────────────────────────────────────
const AUDIO = path.join(APP, "public", "audio");
/** `p10.a.mp3` / `p9.cues.json` → `p10.a` / `p9`. */
const stemOf = (file: string) => file.replace(/\.(mp3|wav|m4a|ogg|aac|opus|webm|json)$/i, "").replace(/\.cues$/, "");
const bookById = new Map(allBooks().map((b) => [b.id, b]));
const nameStems = (bookId: string) => {
  const b = bookById.get(bookId);
  return new Set(b ? VOICE_FOLDERS.flatMap((v) => nameBearingFiles(b, v)).map(stemOf) : []);
};
const everyNameStem = new Set([...bookById.keys()].flatMap((id) => [...nameStems(id)]));

/** The paths (relative to public/audio) that would put a child's name in the bundle. */
export function nameBearingUnderAudio(rels: readonly string[]): string[] {
  return rels.filter((rel) => {
    const parts = rel.split("/");
    const stem = stemOf(parts[parts.length - 1]);
    if (parts[0] !== "books") return everyNameStem.has(stem);
    // a book folder must be a known book with a shared set; its name-bearing ids never ship
    return !Object.prototype.hasOwnProperty.call(SHARED_NARRATION_SETS, parts[1] ?? "") || nameStems(parts[1]).has(stem);
  });
}

describe("K2: the bundle's narration is the shared, name-free set only", () => {
  const rels = existsSync(AUDIO) ? walk(AUDIO).map((f) => path.relative(AUDIO, f).split(path.sep).join("/")) : [];

  it("no name-bearing file id exists anywhere under public/audio", () => {
    expect(rels.some((r) => r.startsWith("books/"))).toBe(true);
    expect(nameBearingUnderAudio(rels)).toEqual([]);
  });

  it("negative controls: a name-bearing id is caught in the shared set, in another folder and under an unknown book", () => {
    expect(
      nameBearingUnderAudio([
        "books/five-smooth-stones/shared-v3/en/p1.mp3",
        "books/five-smooth-stones/shared-v3/he-m/p10.b.wav",
        "books/five-smooth-stones/dylan-v3/he-f/cover.mp3",
        "kid/sneak/en/p10.c.m4a",
        "books/no-such-book/shared/en/p2.mp3",
        "books/five-smooth-stones/shared-v3/en/p2.mp3",
      ]),
    ).toEqual([
      "books/five-smooth-stones/shared-v3/en/p1.mp3",
      "books/five-smooth-stones/shared-v3/he-m/p10.b.wav",
      "books/five-smooth-stones/dylan-v3/he-f/cover.mp3",
      "kid/sneak/en/p10.c.m4a",
      "books/no-such-book/shared/en/p2.mp3",
    ]);
  });

  it("each book's shared folder holds exactly its name-free list (no more, no less), and nothing else is under public/audio/books", () => {
    const expected: string[] = [];
    for (const [bookId, setId] of Object.entries(SHARED_NARRATION_SETS)) {
      const book = bookById.get(bookId);
      expect(book, bookId).toBeTruthy();
      const shipped = sharedNarrationShipped(book!);
      for (const folder of VOICE_FOLDERS) for (const f of shipped[folder]) expected.push(`books/${bookId}/${setId}/${folder}/${f}`);
    }
    expect(rels.filter((r) => r.startsWith("books/")).sort()).toEqual(expected.sort());
  });

  it("the private loader's only other read is the shared set's cue sidecar, as static JSON", () => {
    const loader = read("lib/bookAssets.ts");
    expect(loader.match(/loadStaticJson\(/g)).toHaveLength(1);
    expect(loader).toMatch(/const shared = sharedNarrationUrls\(book, folder\);/);
  });
});
