/**
 * B-KID-68 (KA-16) — ONE kid world registry. Every kid world is declared once
 * (kidWorlds.ts) with one name (EN + HE), one art key, one accent, one unit and
 * its routing id; the consumers read it instead of keeping their own map.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KID_WORLDS, KID_WORLD_NAME_KEY, kidWorldByWorldId } from "./kidWorlds";
import { KID_GAME_TITLE_KEY, KID_HOME_GAMES } from "./KidDashboard";
import { KID_WORLDS as ARCADE_KID_WORLDS } from "../practice/HeroArcade";
import { STUDIO_WORLDS } from "../practice/studioWorlds";
import { translate } from "../../lib/i18n";
import { KID_THEME_IDS, kidArt, worldTileKey } from "../../lib/kidThemeManifest";
import { greetingWorldNameKey, lastPlayedWorldYesterday } from "./kidGreeting";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEBREW = /[א-ת]/;

describe("B-KID-68: the registry", () => {
  it("covers exactly the arcade's kid worlds, each once", () => {
    const ids = KID_WORLDS.map((w) => w.worldId);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ARCADE_KID_WORLDS.map((w) => w.id).sort());
    expect(new Set(KID_WORLDS.map((w) => w.id)).size).toBe(KID_WORLDS.length);
  });
  it("one name per world, EN + HE: the kid name equals the parent door's name", () => {
    for (const w of KID_WORLDS) {
      for (const lang of ["en", "he"] as const) {
        const kid = translate(lang, w.nameKey);
        expect(kid, `${w.id} ${lang}`).not.toBe(w.nameKey);
        expect(translate(lang, w.doorNameKey), `${w.id} ${lang}`).toBe(kid);
        expect(translate(lang, w.subKey)).not.toBe(w.subKey);
      }
      expect(translate("he", w.nameKey)).toMatch(HEBREW);
    }
  });
  it("every world has its art in every theme (the art key is the routing id)", () => {
    for (const theme of KID_THEME_IDS) for (const w of KID_WORLDS) expect(kidArt(theme, worldTileKey(w.worldId)), `${theme} ${w.worldId}`).not.toBeNull();
  });
  it("lookups are derived, never a second map", () => {
    expect(KID_GAME_TITLE_KEY).toBe(KID_WORLD_NAME_KEY);
    expect(KID_HOME_GAMES.map((g) => [g.worldId, g.titleKey])).toEqual(KID_WORLDS.map((w) => [w.worldId, w.nameKey]));
    expect(kidWorldByWorldId("memory")?.id).toBe("mind-vault");
    expect(kidWorldByWorldId("word-world")).toBeUndefined();
  });
});

describe("B-KID-68: consumers read the registry", () => {
  it("the kid home declares no tile list of its own", () => {
    const dash = readFileSync(path.join(__dirname, "KidDashboard.tsx"), "utf8");
    expect(dash).toContain('from "./kidWorlds"');
    expect(dash).toContain("const GAMES = KID_WORLDS.map(");
    expect(dash).not.toMatch(/\{ id: "[a-z-]+", worldId: "/);
  });
  it("the parent Practice door's kid names and units come from the registry", () => {
    for (const s of STUDIO_WORLDS) {
      const k = kidWorldByWorldId(s.id);
      if (!k) continue; // Word World: parent-only
      expect(s.kidNameKey, s.id).toBe(k.doorNameKey);
      expect(s.unit, s.id).toBe(k.unit);
    }
    const studio = readFileSync(path.join(__dirname, "..", "practice", "studioWorlds.ts"), "utf8");
    expect(studio).toContain('from "../kidmode/kidWorlds"');
  });
});

describe("B-KID-68: the greeting reads the registry", () => {
  const none = { speech: [], mimic: [], adventures: [], events: [] };
  const y = "2026-09-02T12:00:00";
  it("the world played yesterday is a registry tile, named by its own key", () => {
    const w = lastPlayedWorldYesterday({ ...none, events: [{ timestamp: y, kind: "rhythm" as const }] }, "2026-09-03");
    expect(w).toBe(kidWorldByWorldId("beat")!.id);
    expect(greetingWorldNameKey(w!)).toBe(kidWorldByWorldId("beat")!.nameKey);
  });
  it("Spell Forge is greeted too, with its own name key (not a kid.game.* guess)", () => {
    const w = lastPlayedWorldYesterday({ ...none, events: [{ timestamp: y, kind: "phonics" as const }] }, "2026-09-03");
    expect(w).toBe("spell-forge");
    expect(greetingWorldNameKey(w!)).toBe("elev.kids.reading.title");
    expect(translate("he", greetingWorldNameKey(w!)!)).toMatch(HEBREW);
  });
  it("no tile-id union or kid.game.* template is restated", () => {
    const greet = readFileSync(path.join(__dirname, "kidGreeting.ts"), "utf8");
    expect(greet).not.toMatch(/"mood-mountain"|"sound-lab"|"pattern-power"/);
    const dash = readFileSync(path.join(__dirname, "KidDashboard.tsx"), "utf8");
    expect(dash).not.toContain("t(`kid.game.${yesterdayWorld}.title`)");
  });
});
