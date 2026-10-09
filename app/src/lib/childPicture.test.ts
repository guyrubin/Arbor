/**
 * B-SHELL-27 — one face: the resolver order and the mounts that use it.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { asksForHero, childPicture } from "./childPicture";
import { todayLiveSource } from "../testTodaySource";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");
const HERO = "https://storage.example/heroes/dylan.webp";

describe("B-SHELL-27 — resolver order: hero render → uploaded photo → initial", () => {
  it("comicAvatarUrl is the hero", () => {
    expect(childPicture({ name: "Dylan", comicAvatarUrl: HERO, photoUrl: "data:image/png;base64,AAA" })).toEqual({ kind: "hero", url: HERO, initial: "D" });
  });
  it("a photoUrl marked generated is the hero; an unmarked one is a photo — the same URL either way", () => {
    expect(childPicture({ name: "Dylan", photoUrl: HERO, avatar: { source: "descriptor" } })).toMatchObject({ kind: "hero", url: HERO });
    expect(childPicture({ name: "Dylan", photoUrl: HERO })).toMatchObject({ kind: "photo", url: HERO });
  });
  it("nothing usable → the initial (HE too)", () => {
    expect(childPicture({ name: "דילן" })).toEqual({ kind: "initial", url: null, initial: "ד" });
    expect(childPicture({ name: "Dylan", photoUrl: "javascript:alert(1)" }).kind).toBe("initial");
  });
  it("a child with a hero render never gets a create-hero prompt; only the initial asks", () => {
    expect(asksForHero({ name: "Dylan", photoUrl: HERO })).toBe(false);
    expect(asksForHero({ name: "Dylan", comicAvatarUrl: HERO })).toBe(false);
    expect(asksForHero({ name: "Dylan" })).toBe(true);
  });
});

describe("B-SHELL-27 — every mount reads the one resolver (the same URL everywhere)", () => {
  it("sidebar switcher, top-bar switcher, My Child, Stories and Today", () => {
    // B-SHELL-38: the sidebar card mounts the switcher itself (one identity line), so its picture IS the chip's.
    expect(read("../components/profile/ProfileSwitcher.tsx")).toContain("<TopbarKidSwitcher maxWidth=\"100%\" fullWidth />");
    const top = read("../components/layout/TopbarKidSwitcher.tsx");
    expect(top).toContain("photoURL={childPicture(activeChild).url}");
    expect(top).toContain("photoURL={childPicture(p).url}");
    expect(top).not.toMatch(/photoURL=\{[a-zA-Z]+\.photoUrl\}/);
    const profile = read("../components/sections/ChildProfile.tsx");
    expect(profile).toContain("const hasHero = !asksForHero(childProfile);");
    expect(profile).toContain("<Avatar name={childProfile.name} photoURL={picture.url} size={40} />");
    expect(profile).not.toMatch(/<HeroAvatar size=\{56\}/);
    expect(read("../components/tabs/HeroJourneyTab.tsx")).toContain("{!kidMode && asksForHero(childProfile) && (");
    expect(todayLiveSource()).toContain("photoURL={childPicture(childProfile).url} size={28}");
  });
});
