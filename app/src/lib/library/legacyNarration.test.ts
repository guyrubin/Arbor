import { describe, expect, it } from "vitest";
import { isBookAssetRel } from "./bookAssetPaths";
import { LEGACY_NARRATION_SET, legacyFolder, legacyNarrationRel, legacyPageUnits, legacySource, parseLegacyManifest } from "./legacyNarration";

const page = (p: Partial<Parameters<typeof legacyPageUnits>[0]>) =>
  legacyPageUnits({ onCover: false, atEnd: false, beatId: undefined, choiceId: undefined, choiceIds: ["a", "b", "c"], ...p });

describe("B-BOOK-73: what a legacy page reads", () => {
  it("cover, a beat, the question page, the chosen outcome, the end", () => {
    expect(page({ onCover: true, beatId: "call" })).toEqual(["title"]);
    expect(page({ beatId: "call" })).toEqual(["call"]);
    expect(page({ beatId: "decision" })).toEqual(["decision", "question", "choice.a", "choice.b", "choice.c"]);
    expect(page({ beatId: "decision", choiceId: "b" })).toEqual(["decision"]);
    expect(page({ beatId: "consequence", choiceId: "b" })).toEqual(["outcome.b"]);
    expect(page({ beatId: "consequence" })).toEqual([]);
    expect(page({ atEnd: true, beatId: "reflection" })).toEqual(["the-end"]);
  });
  it("the Hebrew folder follows the child's gender; English has one", () => {
    expect(legacyFolder("en", "girl")).toBe("en");
    expect(legacyFolder("he", "girl")).toBe("he-f");
    expect(legacyFolder("he", "boy")).toBe("he-m");
    expect(legacyFolder("he", undefined)).toBe("he-m");
  });
  it("every unit's file is a path the private book route serves", () => {
    for (const unit of ["title", "call", "question", "choice.a", "outcome.c", "the-end"]) {
      expect(isBookAssetRel(legacyNarrationRel(LEGACY_NARRATION_SET, "he-m", unit)), unit).toBe(true);
    }
    expect(isBookAssetRel("manifest.json")).toBe(true);
  });
  it("a manifest is read only when it is this book's legacy narration; odd unit names are dropped", () => {
    const raw = { kind: "legacy-narration", storyId: "noahs-ark", set: "sulafat-v1", createdAt: "2026-10-11", folders: { en: ["call", "choice.a", "../x", 7], "he-m": ["title"] } };
    const m = parseLegacyManifest(raw, "noahs-ark")!;
    expect(m.folders.en).toEqual(["call", "choice.a"]);
    expect(parseLegacyManifest(raw, "jonah-and-the-great-fish")).toBeNull();
    expect(parseLegacyManifest({ ...raw, kind: "book" }, "noahs-ark")).toBeNull();
    expect(legacySource(m)).toEqual({
      bookId: "noahs-ark",
      createdAt: "2026-10-11",
      files: ["narration/sulafat-v1/en/call.mp3", "narration/sulafat-v1/en/choice.a.mp3", "narration/sulafat-v1/he-m/title.mp3"],
    });
  });
});
