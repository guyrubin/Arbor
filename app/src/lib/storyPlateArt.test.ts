import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getStorySpec } from "./heroJourneys";
import { JOSEPH_STORY_ART, JOSEPH_STORY_ID, STORY_ART_BEATS, storyBookArt, storyPageArt } from "./storyPlateArt";
import { storyCoverArt } from "./kidThemeManifest";
import type { HeroBeatId } from "../types";

const REPO = path.resolve(__dirname, "../../..");
const ART_FOLDER = `app/public/visuals/stories/v2/${JOSEPH_STORY_ID}`;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function webpDimensions(bytes: Buffer): { width: number; height: number } {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  switch (bytes.toString("ascii", 12, 16)) {
    case "VP8 ": return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    case "VP8L": {
      const packed = bytes.readUInt32LE(21);
      return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
    }
    case "VP8X": return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
    default: throw new Error("Unrecognized WebP frame header");
  }
}

describe("B-BOOK-83 complete existing Joseph art contract", () => {
  it("covers exactly the existing authored eight beats, each with its own scene; the shelf and reader share the cover", () => {
    const story = getStorySpec(JOSEPH_STORY_ID)!;
    expect(STORY_ART_BEATS).toEqual(story.beats.map(beat => beat.id));
    expect(Object.keys(JOSEPH_STORY_ART.pages)).toEqual(story.beats.map(beat => beat.id));
    const pictures = [JOSEPH_STORY_ART.cover, ...story.beats.map(beat => storyPageArt("film3d", story.id, beat.id)!)];
    expect(pictures).toHaveLength(9);
    expect(new Set(pictures.map(art => art.src)).size).toBe(9);
    expect(storyCoverArt("film3d", story.id)).toBe(JOSEPH_STORY_ART.cover);
    for (const art of pictures) {
      expect(art.hasHero).toBe(false);
      expect(art.childFree && art.textFree).toBe(true);
      expect(art.src).toMatch(/^\/visuals\/stories\/v2\/joseph-and-his-brothers\/[a-z]+\.webp$/);
      expect(art.src480).toBe(art.src.replace(".webp", "-480.webp"));
      expect(art.heroSlot.centerX).toBeGreaterThanOrEqual(.5);
      expect(art.heroSlot.centerX).toBeLessThanOrEqual(.62);
      expect(art.heroSlot.bottom).toBeLessThanOrEqual(.94);
      expect(art.heroSlot.bottom - art.heroSlot.height).toBeGreaterThanOrEqual(.66);
    }
  });

  it("never changes another story or theme, or treats an unknown/prototype beat as an image", () => {
    expect(storyBookArt("storybook", JOSEPH_STORY_ID)).toBeNull();
    for (const story of ["noahs-ark", "the-lantern-path", "toString", undefined]) {
      expect(storyBookArt("film3d", story)).toBeNull();
      expect(storyPageArt("film3d", story, "call")).toBeNull();
    }
    expect(storyPageArt("storybook", JOSEPH_STORY_ID, "call")).toBeNull();
    expect(storyPageArt("film3d", JOSEPH_STORY_ID, "toString" as HeroBeatId)).toBeNull();
    expect(storyCoverArt("storybook", JOSEPH_STORY_ID)).toBeNull();
  });

  it("ships exactly eighteen reviewed WebPs: nine distinct scenes, both derivative sizes, real dimensions and matching manifest digests", () => {
    const manifest = JSON.parse(readFileSync(path.join(REPO, "docs/design/story-art-v2.json"), "utf8"));
    const ordered = [JOSEPH_STORY_ART.cover, ...STORY_ART_BEATS.map(beat => JOSEPH_STORY_ART.pages[beat])];
    expect(manifest.storyId).toBe(JOSEPH_STORY_ID);
    expect(manifest.assets.map((asset: { beat: string }) => asset.beat)).toEqual(ordered.map(art => art.id));
    expect(readdirSync(path.join(REPO, ART_FOLDER)).sort()).toEqual(ordered.flatMap(art => [path.basename(art.src), path.basename(art.src480)]).sort());
    const largeHashes = new Set<string>(), sourceHashes = new Set<string>();
    let actualTotalBytes = 0;
    for (const art of ordered) {
      const asset = manifest.assets.find((entry: { beat: string }) => entry.beat === art.id);
      expect(asset, art.id).toBeTruthy();
      expect(asset.path).toBe(`app/public${art.src}`);
      expect(asset.src480).toBe(art.src480);
      expect([asset.width, asset.height]).toEqual([art.width, art.height]);
      expect(asset.childFree && asset.textFree && !asset.hasHero).toBe(true);
      expect(asset.review).toMatchObject({ childFree: true, textFree: true, semanticMatch: true, heroSlotClear: true });
      expect(asset.review.reviewer.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(Date.parse(asset.review.date))).toBe(true);
      expect(asset.crop.objectPosition).toBe(art.objectPosition);
      expect(asset.heroSlot).toEqual(art.heroSlot);
      const window = asset.crop.window;
      const clear = asset.reservedMasterRect;
      const portraitWidth = art.heroSlot.height / .75;
      const left = window.x + (art.heroSlot.centerX - portraitWidth / 2) * window.width;
      const right = window.x + (art.heroSlot.centerX + portraitWidth / 2) * window.width;
      const top = window.y + (art.heroSlot.bottom - art.heroSlot.height) * window.height;
      const bottom = window.y + art.heroSlot.bottom * window.height;
      expect(left, `${art.id}: frame starts inside the inspected empty master area`).toBeGreaterThanOrEqual(clear.x - .0001);
      expect(right, `${art.id}: frame ends inside the inspected empty master area`).toBeLessThanOrEqual(clear.x + clear.width + .0001);
      expect(top, art.id).toBeGreaterThanOrEqual(clear.y - .0001);
      expect(bottom, art.id).toBeLessThanOrEqual(clear.y + clear.height + .0001);
      expect(asset.source.provider).toBe("OpenAI");
      expect(asset.source.tool).toBe("image_gen.imagegen");
      expect(asset.source.native.width).toBeGreaterThanOrEqual(art.width);
      expect(asset.source.native.height).toBeGreaterThanOrEqual(art.height);
      expect(asset.source.native.sha256).toMatch(/^[0-9a-f]{64}$/);
      sourceHashes.add(asset.source.native.sha256);
      expect(asset.exports.map((file: { path: string }) => file.path).sort()).toEqual([`app/public${art.src}`, `app/public${art.src480}`].sort());
      for (const url of [art.src, art.src480]) {
        const file = asset.exports.find((entry: { path: string }) => entry.path === `app/public${url}`);
        const bytes = readFileSync(path.join(REPO, file.path));
        const dimensions = webpDimensions(bytes);
        expect(dimensions, url).toEqual({ width: file.width, height: file.height });
        expect(file.bytes, url).toBe(bytes.length);
        expect(file.sha256, url).toBe(digest(bytes));
        expect(bytes.length, url).toBeLessThanOrEqual((url === art.src ? 400 : 100) * 1024);
        actualTotalBytes += bytes.length;
        if (url === art.src) {
          expect(dimensions).toEqual({ width: art.width, height: art.height });
          expect(asset.sha256).toBe(file.sha256);
          largeHashes.add(file.sha256);
        } else expect(dimensions).toEqual({ width: 480, height: art.id === "cover" ? 640 : 320 });
      }
    }
    expect(largeHashes.size).toBe(9);
    expect(sourceHashes.size).toBe(9);
    expect(manifest.totalBytes).toBe(actualTotalBytes);
    // These are native 1536px legacy-reader plates, not an unearned claim of
    // canonical 2K composition, private poses, or a BookReader migration.
    expect(manifest.canonicalBookApproval).toBe(false);
    expect(manifest.closesBBook83).toBe(false);
    expect(manifest.nativeResolutionGate).toMatchObject({ minimumLandscapeWidth: 2048, met: false, status: "open" });
  });
});
