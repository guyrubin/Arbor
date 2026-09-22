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

  it("…and when there is no hero it is SPROUT, never a letter in a circle", () => {
    // Round 1 closed the photo leak and shipped the wrong fallback: `Avatar`'s
    // null-photo branch is initials, so the hero-less child met a flat disc with
    // a "D" in it — in the one moment the surface asks about *them*. Every other
    // world falls back to Sprout; a letter disc is parent contact-list chrome.
    const feelings = files.find((f) => f.rel.endsWith("FeelingsLabTab.tsx"))!;
    expect(feelings.text).toContain('import { ArborMascot } from "../ui/ArborMascot"');
    expect((feelings.text.match(/fallback=\{<ArborMascot /g) ?? []).length).toBe(2);
    // Both self-check sites — the one that has a hero and the one that does not.
    expect((feelings.text.match(/<EmotionAvatar/g) ?? []).length).toBe(2);
  });

  it("the fallback slot exists on the primitive, so the ring still composes", () => {
    const emotion = readFileSync(path.join(here, "EmotionAvatar.tsx"), "utf8");
    expect(emotion).toContain("fallback?: React.ReactNode");
    // Supplied fallback wins over Avatar's initials, and only when there is no
    // portrait — a real hero still renders as the portrait.
    expect(emotion).toContain("{!photoURL && fallback ? (");
    expect(emotion).toContain("<Avatar name={name} photoURL={photoURL} size={size} />");
  });

  it("no kid surface renders an initials disc as the child's own stand-in", () => {
    // <Avatar> is the parent-register person chip. A kid surface may not reach
    // for it without handing it a fallback, or the initials branch is live again.
    const offenders = files
      .filter((f) => /<Avatar\b/.test(f.text))
      .map((f) => f.rel);
    expect(offenders, "kid surfaces use HeroAvatar (Sprout fallback), not Avatar").toEqual([]);
    const usesEmotionAvatar = files.filter((f) => /<EmotionAvatar\b/.test(f.text));
    expect(usesEmotionAvatar.length).toBeGreaterThan(0);
    for (const f of usesEmotionAvatar) {
      expect(f.text, `${f.rel} must pass a mascot fallback to EmotionAvatar`).toContain("fallback={<ArborMascot ");
    }
  });

  it("Sprout is the fallback, in the one place the fallback lives", () => {
    const hero = readFileSync(path.join(here, "HeroAvatar.tsx"), "utf8");
    const fallback = hero.slice(hero.indexOf("if (!url || failedUrl === url)"), hero.indexOf("const badge"));
    expect(fallback).toContain("<ArborMascot");
    expect(fallback).not.toContain("photoUrl");
  });
});
