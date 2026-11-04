/**
 * B-GAME-18 (wave-3 carry-over from the wave-1 kids critic): the arcade
 * tiles' tags rendered the English PLAY value ("FEELINGS", "SPEECH") on the
 * Hebrew page. Each tag is now an i18n key, EN + HE, and the tile reads it
 * through t(); the EN value stays the PLAY table's tag (kidThemes' blurb).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";
import { ARCADE_WORLDS, arcadeTagKey } from "./HeroArcade";

const here = path.dirname(fileURLToPath(import.meta.url));
const arcade = readFileSync(path.join(here, "HeroArcade.tsx"), "utf8");

describe("B-GAME-18: the arcade tile tag speaks the page's language", () => {
  it("every arcade world has its tag in EN (the PLAY value) and in Hebrew (no Latin letters)", () => {
    expect(ARCADE_WORLDS.length).toBeGreaterThanOrEqual(10);
    for (const w of ARCADE_WORLDS) {
      const key = arcadeTagKey(w.id);
      expect(translate("en", key), w.id).toBe(w.tag);
      const he = translate("he", key);
      expect(he, w.id).not.toBe(key);
      expect(he, w.id).toMatch(/[א-ת]/);
      expect(he, w.id).not.toMatch(/[A-Za-z]/);
    }
  });

  it("the tile and its aria label read the translated tag, never the table's English value", () => {
    expect(arcade).toContain("const tag = t(arcadeTagKey(w.id));");
    expect(arcade).toContain("data-arcade-tag={w.id}>{tag}</span>");
    expect(arcade).not.toMatch(/>\{w\.tag\}</);
    expect(arcade).not.toMatch(/tag: w\.tag \}/);
  });
});
