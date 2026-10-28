/**
 * B-BOOK-20 / Lane C T16, the static clause (reference/kid-books-standard.md,
 * "no sprite, print or audio of a real child in `public/` or git").
 *
 * A child's likeness and voice-in-their-name live ONLY in private Storage
 * (children/{childId}/books/…, served owner-checked by server/bookAssets.ts,
 * erased with the child). This guard fails when such a file shape lands in
 * git or in the app's public folder:
 *  - the private book shapes: hero-sheets/…, prints/…, narration/…;
 *  - a hero pose sheet (a `hero/` folder of pose images, or a sheet.json);
 * with ONE named exception: app/public/_proof/, the proof child's sheet that
 * Guy ruled on 5 Oct 2026 stays in the app until its private migration
 * (B-BOOK-71 / B-GAME-35). Removing it is those rows' work, not this guard's.
 *
 * The reader clauses of T16 (no photo URL in any reader image; `bookReads`
 * the only write) are rendered checks on real private book files and stay
 * with the production verification.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO = path.join(APP, "..");
/** Guy's 5 Oct 2026 ruling: the proof sheet stays in the app (B-BOOK-71 / B-GAME-35 own its removal). */
const RULED_EXCEPTION = "app/public/_proof/";

const MEDIA = /\.(webp|png|jpe?g|gif|avif|svg|mp3|wav|m4a|ogg|opus|webm|mp4)$/i;
const PRIVATE_BOOK_SHAPE = /(^|\/)(hero-sheets|prints|narration)\//i;
const POSE_SHEET = /(^|\/)hero\/[^/]+\.(webp|png|jpe?g|avif)$|(^|\/)sheet\.json$/i;

function offenders(paths: readonly string[]): string[] {
  return paths
    .map((p) => p.split(path.sep).join("/"))
    .filter((p) => !p.startsWith(RULED_EXCEPTION))
    .filter((p) => (MEDIA.test(p) && PRIVATE_BOOK_SHAPE.test(p)) || POSE_SHEET.test(p))
    .sort();
}

function tracked(): string[] {
  try {
    return execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
function publicFiles(dir = path.join(APP, "public"), acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) publicFiles(full, acc);
    else acc.push(path.relative(REPO, full));
  }
  return acc;
}

describe("T16 static clause — no sprite, print or audio of a real child in git or public/", () => {
  const files = tracked();
  const pub = publicFiles();

  it("the scans read real file lists", () => {
    expect(files.length).toBeGreaterThan(500);
    expect(pub.length).toBeGreaterThan(50);
    expect(files.some((f) => f.startsWith(RULED_EXCEPTION))).toBe(true); // the exception is real, and named
  });

  it("nothing tracked in git has a private book or pose-sheet shape (outside the ruled exception)", () => {
    expect(offenders(files)).toEqual([]);
  });

  it("nothing in the app's public folder does either (tracked or not)", () => {
    expect(offenders(pub)).toEqual([]);
  });

  it("negative control: each shape is caught, and only the ruled folder is excepted", () => {
    expect(offenders([
      "app/public/books/five-smooth-stones/hero-sheets/s1/look-up.webp",
      "app/public/kid/prints/page-3.png",
      "app/public/audio/narration/s1/he-m/p1.mp3",
      "app/public/visuals/hero/idle.webp",
      "app/public/visuals/hero/sheet.json",
      "app/public/_proof/hero/idle-960.webp",
      "app/public/visuals/cards/web/calm.webp",
    ])).toEqual([
      "app/public/audio/narration/s1/he-m/p1.mp3",
      "app/public/books/five-smooth-stones/hero-sheets/s1/look-up.webp",
      "app/public/kid/prints/page-3.png",
      "app/public/visuals/hero/idle.webp",
      "app/public/visuals/hero/sheet.json",
    ]);
  });
});
