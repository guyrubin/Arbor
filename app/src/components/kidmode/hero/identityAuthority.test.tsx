/**
 * B-KID-143 — the current profile-approved hero and its revision own
 * present-tense identity everywhere, for a current family AND a separate
 * synthetic family (both synthetic here; the real-account check is Guy's):
 *   profile picture · Kids home / games (the one sheet chain) · the book sheet
 *   a new build draws · the cover a child sees
 * all key on ONE revision: heroAvatarHash(resolveHeroUrl(child)).
 * Stale revisions and the other family's (wrong-child) docs cannot replace it;
 * a missing sheet plays the same approved portrait; approved historical books
 * keep the sheet they were committed with; no surface reads the avatar fields
 * past the one resolver.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { resolveHeroUrl } from "../../../lib/heroIdentity";
import { childPicture } from "../../../lib/childPicture";
import { heroAvatarHash, type HeroSheetPoseDoc, type HeroSheetPoseId } from "../../../lib/heroSheetContract";
import { parseHeroSheetDocs, type HeroSheetDocs } from "../../../lib/heroSheetStore";
import { bookSheetId } from "../../../lib/library/bookSheet";
import { getLibraryBook } from "../../../lib/library/books";
import type { BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
import { avatarFallbackSheet, heroSheetAvatarUrl, resolveHeroSheetChain, type ChainSources } from "./useHeroSheet";
import { bookCoverScopeKey, visibleBookCoverPrint } from "../bookCoverScope";

vi.mock("../../../lib/plans/planPlateSource", () => ({ usePlanPlateSrcs: (s: readonly string[]) => s }));
vi.mock("../../../lib/bookAssetStore", () => ({ fetchBookAsset: vi.fn(async () => null) }));
vi.mock("../../../lib/bookAssets", () => ({ libraryBookCoverUrl: vi.fn(async () => null) }));
import { coverHeroPose } from "../LibraryBookCover";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..", "..");

/** Two synthetic families: an approved descriptor hero (current family) and an approved comic hero. */
const FAMILY_A = { id: "synthetic-current-child", name: "Noa", photoUrl: "data:image/png;base64,QUFBQQ==", avatar: { source: "descriptor" as const } };
const FAMILY_B = { id: "synthetic-second-child", name: "Ari", comicAvatarUrl: "data:image/png;base64,QkJCQg==" };
const revisionOf = (child: { photoUrl?: string; comicAvatarUrl?: string; avatar?: unknown }) => heroAvatarHash(resolveHeroUrl(child)!);

const poseDoc = (pose: HeroSheetPoseId, avatarHash: string): HeroSheetPoseDoc => ({
  id: pose, v: 1, pose, dataUrl: `data:image/webp;base64,${pose}-${avatarHash}`, w: 400, h: 960, foot: { x: 200, y: 940 }, head: { x: 200, y: 200, r: 90 },
  scale: 1, avatarHash, model: "m", keyColour: "#00B140", createdAt: "2026-10-28",
});
const docsOf = (avatarHash: string): HeroSheetDocs =>
  parseHeroSheetDocs([{ id: "_meta", v: 1, heroId: avatarHash, source: "generated", avatarHash, poses: ["idle", "cheer"], status: "complete", updatedAt: "x" }, poseDoc("idle", avatarHash), poseDoc("cheer", avatarHash)]);
const sources = (docs: HeroSheetDocs | null): ChainSources => ({
  docs, proofAllowed: false, loadProof: async () => null, readDevice: () => null, loadStock: async () => null,
});
const book = getLibraryBook("five-smooth-stones")!;
const coverPose = book.cover.hero!.pose;
const bookOf = (sheetId: string) => ({ id: book.id, bookId: book.id, sheetId, setId: "none", sets: ["none"], sheetManifest: { poses: { [coverPose]: { file: `${coverPose}.webp` } } }, files: [], bytes: 0, createdAt: "2026-10-20T00:00:00Z" }) as unknown as BookAssetsDoc;

describe("B-KID-143: one approved revision per child, on every surface", () => {
  for (const child of [FAMILY_A, FAMILY_B]) {
    it(`${child.id}: profile, Kids home, games and a new book sheet all name the same approved source and revision`, async () => {
      const approved = resolveHeroUrl(child)!;
      const rev = revisionOf(child);
      // Profile: the picture is the approved hero.
      expect(childPicture(child)).toMatchObject({ kind: "hero", url: approved });
      // Kids home + games: the one chain (useStudioHero / Sneak & Freeze both read useHeroSheetState).
      expect(heroSheetAvatarUrl(child)).toBe(approved);
      const played = await resolveHeroSheetChain(child, sources(docsOf(rev)));
      expect(played.from).toBe("child");
      expect(played.sheet.heroId).toBe(rev);
      // New book / cover derivatives: drawn and committed under this revision only.
      expect(bookSheetId(rev)).toBe(`h-${rev}`);
    });
  }
  it("the two families never share a revision, a sheet or a book folder", () => {
    expect(revisionOf(FAMILY_A)).not.toBe(revisionOf(FAMILY_B));
    expect(bookSheetId(revisionOf(FAMILY_A))).not.toBe(bookSheetId(revisionOf(FAMILY_B)));
  });
});

describe("B-KID-143: stale revisions and wrong-child responses cannot replace the approved hero", () => {
  it("a stale revision of the same child plays the CURRENT approved portrait, not the stale sheet", async () => {
    const stale = await resolveHeroSheetChain(FAMILY_A, sources(docsOf("0123456789abcdef")));
    expect(stale.from).toBe("avatar");
    expect(stale.sheet.poses.idle?.url).toBe(FAMILY_A.photoUrl);
  });
  it("the other family's sheet (a wrong-child response) is refused for this child", async () => {
    const wrong = await resolveHeroSheetChain(FAMILY_A, sources(docsOf(revisionOf(FAMILY_B))));
    expect(wrong.from).toBe("avatar");
    expect(wrong.sheet.heroId).toBe(revisionOf(FAMILY_A));
    expect(JSON.stringify(wrong.sheet)).not.toContain(revisionOf(FAMILY_B));
  });
  it("a cover fetched for one child is never displayed for the other (owner, child and edition scope)", () => {
    const doc = bookOf(bookSheetId(revisionOf(FAMILY_A)));
    const a = bookCoverScopeKey("owner-1", FAMILY_A.id, doc);
    const fetched = { scope: a, url: "blob:a-cover" };
    expect(visibleBookCoverPrint(fetched, a)).toBe("blob:a-cover");
    expect(visibleBookCoverPrint(fetched, bookCoverScopeKey("owner-1", FAMILY_B.id, doc))).toBeNull();
    expect(visibleBookCoverPrint(fetched, bookCoverScopeKey("owner-2", FAMILY_A.id, doc))).toBeNull();
  });
});

describe("B-KID-143: missing sheets and approved historical books", () => {
  it("no sheet yet: every pose plays the same approved portrait (honest fallback, nothing drawn)", async () => {
    const r = await resolveHeroSheetChain(FAMILY_B, sources(null));
    expect(r).toMatchObject({ from: "avatar" });
    expect(r.sheet).toEqual(avatarFallbackSheet(FAMILY_B.comicAvatarUrl));
  });
  it("no approved avatar: a neutral placeholder or the chosen stock hero, never another family's likeness", async () => {
    const none = await resolveHeroSheetChain({ id: "synthetic-heroless" }, sources(docsOf(revisionOf(FAMILY_A))));
    expect(none.from).toBe("placeholder");
    expect(JSON.stringify(none.sheet)).not.toContain(revisionOf(FAMILY_A));
  });
  it("an approved historical book keeps the sheet it was committed with after the avatar changes (no silent re-render)", () => {
    const historical = bookOf(bookSheetId("fedcba9876543210")); // committed for the previous revision
    const pose = coverHeroPose({ book, doc: historical })!;
    expect(pose.rel).toBe(`hero-sheets/h-fedcba9876543210/${coverPose}.webp`);
    expect(pose.rel).not.toContain(revisionOf(FAMILY_A));
  });
});

describe("B-KID-143: one resolver — no surface reads the avatar fields past it", () => {
  const ALLOWED = new Set([
    "lib/heroIdentity.ts", "lib/childPicture.ts", // the resolvers
    "components/kidmode/hero/useHeroSheet.ts", "components/kidmode/hero/buildHeroSheet.ts", "components/layout/PlanSheetEnsurer.tsx", // pass the fields INTO resolveHeroUrl
  ]);
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [f] : [];
  });
  it("kid surfaces (Kids home, games, books, stickers) never read photoUrl / comicAvatarUrl directly", () => {
    const offenders = walk(path.join(SRC, "components", "kidmode"))
      .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => /\.(photoUrl|comicAvatarUrl)\b/.test(readFileSync(path.join(SRC, rel), "utf8")));
    expect(offenders).toEqual([]);
  });
});
