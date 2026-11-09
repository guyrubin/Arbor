/**
 * B-KID-122 / B-KID-133 — recycled shelf tiles must show the title-card
 * fallback until the CURRENT book/theme image has loaded. This is source-level
 * and deterministic; it does not replace the operated mobile/RTL checks.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isKidCoverLoaded } from "./KidBookCover";

describe("KidBookCover image readiness follows the actual artwork", () => {
  const first = "/art/synthetic-first-cover.webp";
  const second = "/art/synthetic-second-cover.webp";

  it("keeps a recycled tile pending when a different story replaces its old image", () => {
    expect(isKidCoverLoaded(first, first)).toBe(true);
    expect(isKidCoverLoaded(second, first)).toBe(false);
    expect(isKidCoverLoaded(second, second)).toBe(true);
  });

  it("keeps a switched theme pending until the replacement artwork loads", () => {
    const film3d = "/art/film3d-synthetic.webp";
    const storybook = "/art/storybook-synthetic.webp";
    expect(isKidCoverLoaded(storybook, film3d)).toBe(false);
    expect(isKidCoverLoaded(storybook, storybook)).toBe(true);
  });

  it("never reveals an image-ready flag for a title-card-only book", () => {
    expect(isKidCoverLoaded(null, first)).toBe(false);
    expect(isKidCoverLoaded(null, null)).toBe(false);
    expect(isKidCoverLoaded(first, null)).toBe(false);
  });

  it("the actual cover image uses scoped readiness for both load and cached-image paths", () => {
    const source = readFileSync(fileURLToPath(new URL("./KidBookCover.tsx", import.meta.url)), "utf8");
    expect(source).toContain("const loaded = isKidCoverLoaded(art?.src480 ?? null, loadedArt);");
    expect(source).toContain("if (el && el.complete && el.naturalWidth > 0 && !loaded) setLoadedArt(art.src480)");
    expect(source).toContain("onLoad={() => setLoadedArt(art.src480)}");
    expect(source).not.toContain("const [loaded, setLoaded] = useState(false)");
  });
});
