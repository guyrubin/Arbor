import { describe, expect, it } from "vitest";
import { cleanNameLatin, NAME_LATIN_MAX, offersNameLatin, storyName } from "./storyName";

// B-KID-168 — synthetic names only (this repo is public).
describe("storyName: the child's name in a story's own language", () => {
  const noa = { name: "נועה כהן", nameLatin: "Noa Cohen" };

  it("an English story uses the name in English letters; every other language keeps the profile name", () => {
    expect(storyName(noa, "en")).toBe("Noa Cohen");
    expect(storyName(noa, "he")).toBe("נועה כהן");
    expect(storyName(noa, "he-f")).toBe("נועה כהן");
  });

  it("an empty or missing English-letter name keeps today's behaviour", () => {
    expect(storyName({ name: "נועה כהן" }, "en")).toBe("נועה כהן");
    expect(storyName({ name: "נועה כהן", nameLatin: "   " }, "en")).toBe("נועה כהן");
    expect(storyName({ name: "Maya", nameLatin: null }, "en")).toBe("Maya");
    expect(storyName(null, "en")).toBe("");
  });

  it("the stored value is trimmed, single-spaced and capped; blank clears it", () => {
    expect(cleanNameLatin("  Noa   Cohen ")).toBe("Noa Cohen");
    expect(cleanNameLatin("   ")).toBe("");
    expect(cleanNameLatin(undefined)).toBe("");
    expect(cleanNameLatin("x".repeat(NAME_LATIN_MAX + 10))).toHaveLength(NAME_LATIN_MAX);
  });

  it("the drawer offers the field for a name in another script, or when one is saved; never fills it in", () => {
    expect(offersNameLatin("נועה")).toBe(true);
    expect(offersNameLatin("Maya")).toBe(false);
    expect(offersNameLatin("Zoë")).toBe(false);
    expect(offersNameLatin("Maya", "Maya")).toBe(true);
    expect(offersNameLatin("")).toBe(false);
  });
});
