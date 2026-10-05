/**
 * B-KID-48 (KA-25, remaining scope) — no English literal in the Hebrew kid
 * shell for a nameless child, the hero picture's alt, or the Hero Comics title.
 * Before: a child with no first name was greeted "Hi your child!" (HE: "היי
 * your child!"), every hero picture's alt read "<name>, the hero" in English,
 * and the comics door said "קומיקס גיבורים" while the shelf it opened said
 * "קומיקס הגיבורים".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { en as kidEn, he as kidHe } from "../../lib/i18nElevation/kidRegister";
import { en as expEn, he as expHe } from "../../lib/i18nElevation/kidsExperience";
import { he as storiesHe } from "../../lib/i18nElevation/kidsStories";
import { HERO_NAME_FALLBACK } from "../../lib/heroNameFallback";

const SRC = path.resolve(__dirname, "..", "..");
const avatar = readFileSync(path.join(SRC, "components/ui/HeroAvatar.tsx"), "utf8");
const dash = readFileSync(path.join(SRC, "components/kidmode/KidDashboard.tsx"), "utf8");

describe("B-KID-48: a nameless child, the hero alt, one comics title", () => {
  it("the greeting never interpolates the sentinel", () => {
    expect(dash).toContain('{hero.name === HERO_NAME_FALLBACK ? kt("elev.kid.greeting.noName") : kt("kid.greeting", { name: hero.name })}');
    expect(HERO_NAME_FALLBACK).toBe("your child");
  });
  it("the hero alt is keyed (named and unnamed), never the English template", () => {
    expect(avatar).not.toContain("`${name}, the hero`");
    expect(avatar).toContain('translate(lang, "elev.kids.hero.altUnnamed")');
    expect(avatar).toContain('translate(lang, "elev.kids.hero.alt", { name })');
  });
  // The greeting is kid register (elev.kid.*); the alt sits on the SHARED
  // HeroAvatar, so its keys live outside the kid namespace (KID-1: no
  // parent-surface file names a kid.* key).
  it.each([
    ["elev.kid.greeting.noName", kidEn, kidHe],
    ["elev.kids.hero.alt", expEn, expHe],
    ["elev.kids.hero.altUnnamed", expEn, expHe],
  ] as const)("%s exists in EN and Hebrew, no slash-gendering", (key, enD, heD) => {
    expect(enD[key], key).toBeTruthy();
    expect(/[א-ת]/.test(heD[key] ?? ""), key).toBe(true);
    expect(heD[key]).not.toMatch(/[א-ת]\/[א-ת]/);
    expect(/[A-Za-z]/.test((heD[key] ?? "").replace("{name}", ""))).toBe(false);
  });
  it("ONE Hebrew name for Hero Comics: the door tile, the overlay header and the shelf title agree", () => {
    expect(storiesHe["shelf.title"]).toBe(expHe["elev.kids.comics.title"]);
  });
  it("NEGATIVE CONTROL: the pre-fix greeting rendered the sentinel inside the Hebrew line", () => {
    expect("היי {name}!".replace("{name}", HERO_NAME_FALLBACK)).toMatch(/[A-Za-z]/);
  });
});
