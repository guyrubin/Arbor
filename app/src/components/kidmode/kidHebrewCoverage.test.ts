/**
 * Kids Mode Hebrew coverage (S-3, 5 Oct) — every string the Kids Mode pack
 * added or changed (R-2b, R-3, R-5, B-KID-29, B-KID-37, B-KID-53) resolves to
 * Hebrew in HE, and the HE kid home names each world in Hebrew wherever a
 * Hebrew name exists (B-KID-48 scope): the kid tile title equals the parent
 * door's Hebrew world name, one name per world.
 */
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";
import { KID_GAME_TITLE_KEY } from "./KidDashboard";
import { KID_THEME_IDS } from "../../lib/kidThemeManifest";

const HEBREW = /[֐-׿]/;
const ADDED_KEYS = [
  "kid.quest.eyebrow", // R-2b
  "set.kidLook.title", "set.kidLook.sub", ...KID_THEME_IDS.map((t) => `set.kidLook.${t}`), // R-5
  "elev.kids.feelings.retry", "elev.kids.feelings.done.title", "elev.kids.feelings.done.sub", "elev.kids.feelings.again", // B-KID-29
  "elev.play.beat.feedback.nailed", // B-KID-37
  "elev.kids.reading.title", // B-KID-53 (Spell Forge header)
];

/** kid home world id → the parent door's world key suffix (practiceDoors.ts). */
const DOOR_KEY: Record<string, string> = {
  speech: "speech", feelings: "feelings", memory: "memory", beat: "rhythm",
  pose: "movement", pattern: "logic", adventures: "adventures", mimic: "mimic",
};

describe("Kids Mode HE coverage", () => {
  it.each(ADDED_KEYS.map((k) => [k]))("%s has a Hebrew value", (key) => {
    expect(translate("en", key), key).not.toBe(key);
    const heValue = translate("he", key);
    expect(heValue, key).not.toBe(key);
    expect(heValue, `${key} = ${heValue}`).toMatch(HEBREW);
  });

  it("every world header title (B-KID-53) is Hebrew in HE", () => {
    for (const [worldId, key] of Object.entries(KID_GAME_TITLE_KEY)) {
      expect(translate("he", key), `${worldId} → ${key}`).toMatch(HEBREW);
    }
  });

  it("the HE kid home names each world with the parent door's Hebrew name (one name per world)", () => {
    for (const [worldId, suffix] of Object.entries(DOOR_KEY)) {
      const tileKey = KID_GAME_TITLE_KEY[worldId];
      expect(tileKey, worldId).toBeTruthy();
      const doorHe = translate("he", `elev.practice.world.kid.${suffix}`);
      expect(doorHe).toMatch(HEBREW);
      expect(translate("he", tileKey), worldId).toBe(doorHe);
    }
  });

  it("negative control: an English placeholder would fail the Hebrew rule", () => {
    expect("Mind Vault").not.toMatch(HEBREW);
  });
});
