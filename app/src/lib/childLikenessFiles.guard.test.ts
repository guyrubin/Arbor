/**
 * B-BOOK-20 / Lane C T16, the static clause (reference/kid-books-standard.md,
 * "no sprite, print or audio of a real child in `public/` or git").
 *
 * A child's likeness and voice-in-their-name live ONLY in private Storage
 * (`children/{childId}/books/…`, lib/library/bookAssetPaths; served
 * owner-checked by server/bookAssets.ts, erased with the child). Two checks:
 *
 * 1. Shape. No file in git or in app/public may take a private book shape:
 *    the bookAssetPaths grammar (hero-sheets/…, their choices/ and prints/,
 *    manifests, narration/<set>/<en|he-m|he-f>/…) matched case-insensitively
 *    in any folder, the Storage prefix children/<id>/books/ itself, a hero
 *    pose folder at any depth, a sheet.json, and any book audio outside the
 *    book's shared, name-free set (lib/library/narrationFiles
 *    SHARED_NARRATION_SETS; bookRelease.guard checks each of its files is
 *    name-free). A plain prints/ folder elsewhere (docs/prints/…) is not a
 *    book shape.
 * 2. Named likeness. Files that already show the proof child (the hero
 *    sheet, the shared card tiles, the avatar) cannot be told apart by shape,
 *    so they are NAMED, each group with the row that owns its removal
 *    (childLikenessFiles.named.ts). The tree must hold exactly that list in
 *    the likeness families: a new one fails until it is named with an owner,
 *    and a removed one fails until its line goes, so the list only shrinks.
 *
 * The reader clauses of T16 (no photo URL in any reader image; `bookReads`
 * the only write) are rendered checks on real private book files and stay
 * with the production verification.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHARED_NARRATION_SETS } from "./library/narrationFiles";
import { NAMED_LIKENESS_FILES } from "./childLikenessFiles.named";

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO = path.join(APP, "..");

const IMAGE = "webp|png|jpe?g|gif|avif|svg|heic|bmp|tiff?";
const AUDIO = "mp3|wav|m4a|ogg|opus|aac|webm|flac";
const MEDIA_OR_JSON = new RegExp(`\\.(${IMAGE}|${AUDIO}|json|mp4|mov)$`, "i");
const VOICE = "(en|he-m|he-f)";

/** The private book shapes (bookAssetPaths grammar, any folder, any case). */
const PRIVATE_SHAPES: readonly RegExp[] = [
  /(^|\/)children\/[^/]+\/books\//i, // the Storage prefix itself, any file
  /(^|\/)hero[-_]?sheets?\//i, // hero-sheets/…, hero-sheet/…, heroSheets/…, incl. choices/ prints/ manifest.json
  /(^|\/)hero\/(.+\/)?[^/]+$/i, // a hero pose folder at any depth (filtered to media/json below)
  /(^|\/)sheet\.json$/i,
  /(^|\/)books\/(.+\/)?(prints|choices)\//i, // a print or choice card flattened out of its sheet folder
  /(^|\/)books\/[^/]+\/manifest\.json$/i,
  new RegExp(`(^|/)narration/[^/]+/${VOICE}/`, "i"),
  /(^|\/)he-[mf]\//i, // a gendered narration voice folder anywhere
  /(^|\/)audio\/books\//i, // any book audio (the shared set is let through below)
];

/** app/public/audio/books/<bookId>/<its shared set>/<voice>/<file>: the name-free set, every child's. */
function inSharedSet(p: string): boolean {
  const m = new RegExp(`^app/public/audio/books/([^/]+)/([^/]+)/${VOICE}/[^/]+$`).exec(p);
  return !!m && Object.prototype.hasOwnProperty.call(SHARED_NARRATION_SETS, m[1]) && SHARED_NARRATION_SETS[m[1]] === m[2];
}

/** Repo-relative, forward slashes, `..` resolved (so `_proof/../x` is `x`). */
const norm = (p: string) => path.posix.normalize(p.split(path.sep).join("/").replace(/\\/g, "/"));

const NAMED = new Map(NAMED_LIKENESS_FILES.flatMap((g) => g.files.map((f) => [f, g.owner] as const)));

export function shapeOffenders(paths: readonly string[], named: ReadonlyMap<string, string> = NAMED): string[] {
  return [...new Set(paths.map(norm))]
    .filter((p) => MEDIA_OR_JSON.test(p) || /(^|\/)children\/[^/]+\/books\//i.test(p))
    .filter((p) => PRIVATE_SHAPES.some((re) => re.test(p)))
    .filter((p) => !inSharedSet(p) && !named.has(p))
    .sort();
}

/** The families the proof child's likeness already lives in; any file here must be named. */
const LIKENESS_FAMILIES: readonly RegExp[] = [
  /^app\/public\/_proof\//,
  /^app\/public\/visuals\/cards\/(.+\/)?(game|story)-[^/]+$/,
  new RegExp(`^app/public/(.+/)?[^/]*avatar[^/]*\\.(${IMAGE})$`, "i"),
];
export function unnamedLikeness(paths: readonly string[], named: ReadonlyMap<string, string> = NAMED): string[] {
  return [...new Set(paths.map(norm))].filter((p) => LIKENESS_FAMILIES.some((re) => re.test(p)) && !named.has(p)).sort();
}

function tracked(): string[] {
  try {
    return execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
/** Every file in app/public, tracked or not, except the git-ignored DEV folder (B-BOOK-01; asserted below). */
function publicFiles(dir = path.join(APP, "public"), acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (dir === path.join(APP, "public") && name === "_dev") continue;
    if (statSync(full).isDirectory()) publicFiles(full, acc);
    else acc.push(path.relative(REPO, full));
  }
  return acc;
}

describe("T16 static clause — no sprite, print or audio of a real child in git or public/", () => {
  const files = tracked();
  const pub = publicFiles();

  it("the scans read real file lists, and public/_dev stays git-ignored DEV-only", () => {
    expect(files.length).toBeGreaterThan(500);
    expect(pub.length).toBeGreaterThan(50);
    expect(readFileSync(path.join(APP, ".gitignore"), "utf8")).toMatch(/^public\/_dev\/$/m);
    expect(files.filter((f) => f.startsWith("app/public/_dev/"))).toEqual([]);
  });

  it("nothing tracked in git has a private book shape (outside the named list)", () => {
    expect(shapeOffenders(files)).toEqual([]);
  });

  it("nothing in the app's public folder does either (tracked or not)", () => {
    expect(shapeOffenders(pub)).toEqual([]);
  });

  it("every file in a likeness family is named with the row that owns its removal", () => {
    expect(unnamedLikeness([...files, ...pub])).toEqual([]);
  });

  it("the named list only shrinks: every named file still exists, once, and each group names an owner row", () => {
    const all = new Set([...files, ...pub].map(norm));
    const listed = NAMED_LIKENESS_FILES.flatMap((g) => g.files);
    expect(listed.filter((f) => !all.has(f))).toEqual([]);
    expect(new Set(listed).size).toBe(listed.length);
    for (const g of NAMED_LIKENESS_FILES) expect(g.owner).toMatch(/^B-(BOOK|GAME)-\d+/);
    // the avatar and the likeness-reference tile, and the proof sheet, are on it
    expect(NAMED.get("app/public/visuals/dylan-hero-avatar.png")).toMatch(/B-BOOK-31/);
    expect(NAMED.get("app/public/visuals/cards/game-mimic.png")).toMatch(/B-BOOK-31/);
    expect(NAMED.get("app/public/_proof/hero/sheet.json")).toMatch(/B-GAME-35/);
  });

  it("negative control: every private shape is caught, in any case and any folder; the shared set and plain prints/ folders are not", () => {
    expect(shapeOffenders([
      "app/public/books/five-smooth-stones/hero-sheets/s1/look-up.webp",
      "app/public/books/fss/hero-sheets/s1/prints/cover.png",
      "app/public/children/kid-a/books/fss/hero-sheets/s1/manifest.json",
      "children/kid-a/books/fss/manifest.json",
      "app/public/visuals/hero/s1/idle.webp",
      "app/public/visuals/hero-sheet/s1/idle.webp",
      "app/public/visuals/heroSheets/s1/idle.webp",
      "app/public/visuals/hero/idle.gif",
      "app/public/visuals/hero/sheet.JSON",
      "app/public/_proof/../visuals/hero/idle.webp",
      "app/public/audio/books/fss/he-m/p1.mp3",
      "app/public/audio/books/five-smooth-stones/kid-a-v3/en/p1.mp3",
      "app/public/audio/narration/s1/he-m/p1.cues.json",
      "app/public/kid/books/fss/prints/page-3.png",
      // not book shapes: shared name-free narration, plain prints/ folders, kid sneak audio, source code
      "app/public/audio/books/five-smooth-stones/shared-v3/he-m/p2.mp3",
      "app/public/audio/books/five-smooth-stones/shared-v3/en/p9.cues.json",
      "docs/prints/layout.png",
      "app/public/visuals/prints/catalog.svg",
      "app/public/audio/kid/sneak/en/p1.mp3",
      "app/src/components/kidmode/hero/HeroSprite.tsx",
    ])).toEqual([
      "app/public/audio/books/five-smooth-stones/kid-a-v3/en/p1.mp3",
      "app/public/audio/books/fss/he-m/p1.mp3",
      "app/public/audio/narration/s1/he-m/p1.cues.json",
      "app/public/books/five-smooth-stones/hero-sheets/s1/look-up.webp",
      "app/public/books/fss/hero-sheets/s1/prints/cover.png",
      "app/public/children/kid-a/books/fss/hero-sheets/s1/manifest.json",
      "app/public/kid/books/fss/prints/page-3.png",
      "app/public/visuals/hero-sheet/s1/idle.webp",
      "app/public/visuals/hero/idle.gif",
      "app/public/visuals/hero/idle.webp",
      "app/public/visuals/hero/s1/idle.webp",
      "app/public/visuals/hero/sheet.JSON",
      "app/public/visuals/heroSheets/s1/idle.webp",
      "children/kid-a/books/fss/manifest.json",
    ]);
  });

  it("negative control: a new file in a likeness family fails; only named files pass", () => {
    expect(unnamedLikeness([
      "app/public/visuals/cards/game-mimic.png",
      "app/public/visuals/dylan-hero-avatar.png",
      "app/public/_proof/hero/sheet.json",
      "app/public/visuals/cards/game-new-tile.png",
      "app/public/visuals/cards/web/story-new-1024.webp",
      "app/public/_proof/hero/new-pose.webp",
      "app/public/visuals/kid-avatar.webp",
      "app/public/visuals/cards/web/kid-discovery-garden-v2-480.webp",
    ])).toEqual([
      "app/public/_proof/hero/new-pose.webp",
      "app/public/visuals/cards/game-new-tile.png",
      "app/public/visuals/cards/web/story-new-1024.webp",
      "app/public/visuals/kid-avatar.webp",
    ]);
    // a named file is excused from the shape check only while it is named
    expect(shapeOffenders(["app/public/_proof/hero/sheet.json"])).toEqual([]);
    expect(shapeOffenders(["app/public/_proof/hero/sheet.json"], new Map())).toEqual(["app/public/_proof/hero/sheet.json"]);
  });
});
