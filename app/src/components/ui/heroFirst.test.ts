import { describe, expect, it } from "vitest";
import { resolveHeroUrl } from "./HeroAvatar";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/* ═══════════════════════════════════════════════════════════════════════════
   M1 — the invariant has to hold at the CALL SITES too.

   `resolveHeroUrl` refusing a photo-only profile is worth nothing if a child
   surface reads `childProfile.photoUrl` itself. Mood Mountain did exactly that:
   it handed the raw upload to <EmotionAvatar> -> <Avatar>, which renders it as
   an <img>. A child with a real photo and `avatar: null` therefore had no hero
   anywhere EXCEPT the one screen that mirrored their actual face back at them
   as a game companion. This scan is the guard for that class.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("M1 — no child surface reads the raw photo itself", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const roots = [
    path.join(here, "..", "practice"),
    path.join(here, "..", "kidmode"),
  ];
  const files = roots.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => ({ rel: `${path.basename(dir)}/${f}`, text: readFileSync(path.join(dir, f), "utf8") })),
  );

  it("scans a non-trivial set (sanity)", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it("every hero image resolves through the shared resolver", () => {
    const offenders = files
      .filter((f) => /\bchildProfile\.photoUrl\b/.test(f.text))
      .map((f) => f.rel);
    expect(offenders, "use resolveHeroUrl / useHeroAvatar, never childProfile.photoUrl").toEqual([]);
  });

  it("Mood Mountain's self-check companion is the hero", () => {
    const feelings = files.find((f) => f.rel.endsWith("FeelingsLabTab.tsx"))!;
    expect(feelings.text).toContain('import { resolveHeroUrl } from "../ui/HeroAvatar"');
    expect(feelings.text).toContain("const heroUrl = resolveHeroUrl(childProfile)");
    expect((feelings.text.match(/photoURL=\{heroUrl\}/g) ?? []).length).toBe(2);
  });

  it("Sprout is the fallback, in the one place the fallback lives", () => {
    const hero = readFileSync(path.join(here, "HeroAvatar.tsx"), "utf8");
    const fallback = hero.slice(hero.indexOf("if (!url || failedUrl === url)"), hero.indexOf("const badge"));
    expect(fallback).toContain("<ArborMascot");
    expect(fallback).not.toContain("photoUrl");
  });
});
