/**
 * kidThemes.test.ts — the P2 theme registry stays a faithful, deterministic
 * data lift of its two live sources:
 *   - HeroArcade.tsx WORLDS[]  (parsed from source — ids/names/colors verbatim)
 *   - heroJourneys.ts PACKS[]  (imported — ids/titles/titleHe/blurbs verbatim)
 *
 * Firewall contract under test:
 *   - every world id and every pack id appears EXACTLY once
 *   - unlocks are deterministic: only "default" | "pack-progress" exist,
 *     pack-progress always names a real pack and a finite positive threshold
 *   - accents come only from the six --arbor token families
 *   - no collectible exists before the P4 parent-mediated share loop
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KID_THEMES, getKidTheme, type KidTheme } from "./kidThemes";
import { PACKS } from "./heroJourneys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const arcadeSrc = stripComments(
  readFileSync(path.join(__dirname, "..", "components", "practice", "HeroArcade.tsx"), "utf8"),
);

/** HeroArcade world registry parsed from source: id → { name, color }. */
const ARCADE_WORLDS = new Map(
  [...arcadeSrc.matchAll(/\{ id: "([a-z-]+)", name: "([^"]+)", tag: "([^"]+)", icon: "[^"]+", color: "([a-z]+)"/g)].map(
    (m) => [m[1], { name: m[2], tag: m[3], color: m[4] }],
  ),
);

const TOKEN_ACCENTS = ["sky", "lav", "pink", "peach", "yellow", "clay"];
const HERO_TEMPLATES = ["story", "comic", "hero_card", "practice_stamp", "milestone"];
const SURFACES = ["journeys", "arcade", "feelings", "studio"];

describe("kidThemes registry — coverage", () => {
  it("parses the live HeroArcade WORLDS registry (sanity)", () => {
    expect(ARCADE_WORLDS.size).toBeGreaterThanOrEqual(10);
  });

  it("every HeroArcade world id appears exactly once", () => {
    for (const [worldId] of ARCADE_WORLDS) {
      const hits = KID_THEMES.filter((t) => t.id === worldId);
      expect(hits, `world "${worldId}" must appear exactly once`).toHaveLength(1);
      expect(hits[0].surface).toBe("arcade");
    }
  });

  it("every heroJourneys pack id appears exactly once", () => {
    expect(PACKS).toHaveLength(5);
    for (const pack of PACKS) {
      const hits = KID_THEMES.filter((t) => t.id === pack.id);
      expect(hits, `pack "${pack.id}" must appear exactly once`).toHaveLength(1);
      expect(hits[0].surface).toBe("journeys");
    }
  });

  it("contains nothing beyond the lifted worlds + packs, with globally unique ids", () => {
    expect(KID_THEMES).toHaveLength(ARCADE_WORLDS.size + PACKS.length);
    const ids = KID_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("kidThemes registry — verbatim lift", () => {
  it("world themes carry the world's name and color token verbatim", () => {
    for (const [worldId, world] of ARCADE_WORLDS) {
      const theme = getKidTheme(worldId)!;
      expect(theme.title, `title of "${worldId}"`).toBe(world.name);
      expect(theme.accent, `accent of "${worldId}"`).toBe(world.color);
      expect(theme.blurb, `blurb of "${worldId}" is the world tag`).toBe(world.tag);
    }
  });

  it("pack themes carry PACKS title/titleHe/blurb verbatim", () => {
    for (const pack of PACKS) {
      const theme = getKidTheme(pack.id)!;
      expect(theme.title).toBe(pack.title);
      expect(theme.titleHe).toBe(pack.titleHe);
      expect(theme.blurb).toBe(pack.blurb);
    }
  });

  it("every titleHe/blurbHe is present (EN placeholder allowed until GD-6)", () => {
    for (const theme of KID_THEMES) {
      expect(theme.titleHe, `${theme.id} titleHe`).toBeTruthy();
      expect(theme.blurbHe, `${theme.id} blurbHe`).toBeTruthy();
    }
  });
});

describe("kidThemes registry — deterministic, earned-only unlocks", () => {
  it("every unlock kind is 'default' or 'pack-progress' — nothing else exists", () => {
    for (const theme of KID_THEMES) {
      expect(
        ["default", "pack-progress"],
        `theme "${theme.id}" has unlock kind "${theme.unlock.kind}"`,
      ).toContain(theme.unlock.kind);
    }
  });

  it("pack-progress unlocks always name a real pack and a finite positive threshold", () => {
    const packIds = new Set(PACKS.map((p) => p.id as string));
    for (const theme of KID_THEMES) {
      if (theme.unlock.kind !== "pack-progress") continue;
      expect(packIds.has(theme.unlock.packId), `${theme.id} names unknown pack`).toBe(true);
      expect(Number.isFinite(theme.unlock.threshold)).toBe(true);
      expect(theme.unlock.threshold).toBeGreaterThan(0);
    }
  });

  it("the unlock evaluation is pure data — identical on repeated reads", () => {
    // Determinism: the registry is a const literal; two lookups return the
    // same object with the same unlock (no lazily computed / random state).
    for (const theme of KID_THEMES) {
      expect(getKidTheme(theme.id)).toBe(theme);
    }
  });

  it("the module source declares no random, purchase, or expiry machinery", () => {
    const src = stripComments(readFileSync(path.join(__dirname, "kidThemes.ts"), "utf8"));
    expect(src).not.toMatch(/Math\.random|Date\.now|\bpurchase|\bprice\b|\bgacha\b|\bexpir/i);
  });
});

describe("kidThemes registry — token accents, valid templates, no collectibles yet", () => {
  it.each(KID_THEMES.map((t): [string, KidTheme] => [t.id, t]))(
    "%s: accent/template/surface come from the closed sets",
    (_id, theme) => {
      expect(TOKEN_ACCENTS).toContain(theme.accent);
      expect(HERO_TEMPLATES).toContain(theme.backdropTemplate);
      expect(SURFACES).toContain(theme.surface);
      expect(theme.scenePromptSlug).toMatch(/^[a-z][a-z0-9-]*$/);
    },
  );

  it("no theme is collectible before the P4 parent-mediated share loop", () => {
    for (const theme of KID_THEMES) {
      expect(theme.collectible, `${theme.id} must not be collectible yet`).toBe(false);
    }
  });

  it("registry module imports only types (pure data — safe on any surface)", () => {
    const src = stripComments(readFileSync(path.join(__dirname, "kidThemes.ts"), "utf8"));
    const imports = [...src.matchAll(/^import\s+(.+?)\s+from\s+"[^"]+";?$/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const clause of imports) {
      expect(clause.startsWith("type "), `non-type import: ${clause}`).toBe(true);
    }
    expect(src).not.toMatch(/from "firebase/);
  });
});
