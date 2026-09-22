import { describe, expect, it } from "vitest";
import { resolveHeroUrl } from "./HeroAvatar";

describe("G1 hero-first — the hero is the generated character, never the raw photo", () => {
  it("a photo-only profile (avatar metadata absent) has no hero", () => {
    expect(resolveHeroUrl({ photoUrl: "data:image/jpeg;base64,AAA" })).toBeNull();
    expect(resolveHeroUrl({ photoUrl: "https://firebasestorage/x.jpg", avatar: undefined })).toBeNull();
  });
  it("a generated hero stored in photoUrl with avatar metadata resolves", () => {
    expect(resolveHeroUrl({ photoUrl: "data:image/png;base64,BBB", avatar: { style: "storybook", source: "descriptor" } })).toBe("data:image/png;base64,BBB");
  });
  it("comicAvatarUrl wins when present", () => {
    expect(resolveHeroUrl({ comicAvatarUrl: "data:hero", photoUrl: "data:photo", avatar: { style: "flat" } })).toBe("data:hero");
    expect(resolveHeroUrl({ comicAvatarUrl: "data:hero" })).toBe("data:hero");
  });
  it("nothing set → null, not undefined or empty string", () => {
    expect(resolveHeroUrl({})).toBeNull();
    expect(resolveHeroUrl({ avatar: { style: "flat" }, photoUrl: "" })).toBeNull();
  });
});
