import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const read = (relative: string): string => fs.readFileSync(path.resolve(__dirname, relative), "utf8");

describe("kid saved-comic reader safety boundary", () => {
  const shelf = read("./KidComicsShelf.tsx");
  const reader = read("../stories/SavedComicReader.tsx");

  it("uses only exact child-partitioned saved metadata reads", () => {
    expect(shelf).toContain("rehydrateSavedMetaPagesFromStore(childProfile.id, meta");
    expect(shelf).toContain("savedMetaPagesAvailable(childProfile.id, meta");
    expect(shelf).not.toContain("rehydrateSavedPagesFromStore");
    expect(shelf).not.toContain("getScene(");
  });

  it("cannot mount generation, sharing, download, purchase, or parent-reader code", () => {
    const childSurface = `${shelf}\n${reader}`;
    expect(childSurface).not.toContain('from "../stories/ComicReader"');
    expect(childSurface).not.toMatch(/api\.|generateComic\(|generatePage\(|buildComicBook\(|shareComic\(|downloadHero|checkout\(|openPaywall/);
  });

  it("fails corrupt or incomplete bytes closed and reports image decode errors", () => {
    expect(shelf).toContain("urls.every(isStrictComicImageDataUrl)");
    expect(shelf).toContain("Promise.all(urls.map(imageDecodes))");
    expect(reader).toContain("pages.every((page) => isStrictComicImageDataUrl(page.dataUrl))");
    expect(reader).toContain("onImageError={onUnavailable}");
  });

  it("guards async results and visible books by the active auth-child-book scope", () => {
    expect(shelf).toContain("partitionRef.current !== startedPartition");
    expect(shelf).toContain("scopeRef.current !== startedScope");
    expect(shelf).toContain("open.partitionKey === partitionKey");
    expect(shelf).toContain("metaFingerprint(meta) === open.fingerprint");
  });

  it("suppresses the synthetic click after a recognized swipe", () => {
    expect(reader).toContain("suppressClick.current = true");
    expect(reader).toContain("if (suppressClick.current)");
  });
});
