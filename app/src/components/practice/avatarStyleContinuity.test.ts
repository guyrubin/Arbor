import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAvatarStyle } from "../../lib/avatarStyle";

const src = (...parts: string[]) => readFileSync(resolve(process.cwd(), "src", ...parts), "utf8").replace(/\r\n/g, "\n");
const count = (text: string, fragment: string) => text.split(fragment).length - 1;

describe("avatar medium continuity", () => {
  it("keeps the five persisted style ids and defaults unknown values to comic medium", () => {
    for (const style of ["storybook", "soft3d", "watercolor", "flat", "comichero"] as const) {
      expect(normalizeAvatarStyle(style)).toBe(style);
    }
    expect(normalizeAvatarStyle("princess")).toBe("comichero");
    expect(normalizeAvatarStyle(undefined)).toBe("comichero");
  });

  it("keys generated scene cache and requests by the selected medium", () => {
    const scene = src("components", "practice", "WorldScene.tsx");
    expect(scene).toContain('normalizeAvatarStyle(heroStyle)');
    expect(scene).toContain('["world-v3", worldId, shortHash(heroUrl), style]');
    expect(scene).toContain('style,');
    expect(scene).toContain('preserve the supplied child');
    expect(scene).not.toContain('not 3D animation and not flat vector art');
  });

  it("wires the selected hero style through every kid scene caller", () => {
    const dashboard = src("components", "kidmode", "KidDashboard.tsx");
    const arcade = src("components", "practice", "HeroArcade.tsx");
    const journey = src("components", "tabs", "HeroJourneyTab.tsx");
    expect(count(dashboard, 'heroStyle={hero.style}')).toBe(3);
    expect(count(arcade, 'heroStyle={hero.style}')).toBe(1);
    expect(count(journey, 'heroStyle={heroAvatarStyle}')).toBe(2);
    expect(journey).toContain('heroUrl={photoUrl} heroStyle={heroAvatarStyle}');
  });

  it("keeps generic scene rendering style-aware without changing the child costume", () => {
    const api = src("routes", "api.ts");
    const begin = api.indexOf('router.post("/generate-scene"');
    const end = api.indexOf('router.post("/generate-comic"');
    const sceneRoute = api.slice(begin, end);
    expect(sceneRoute).toContain('SCENE_STYLE_DIRECTIONS[normalizeAvatarStyle(style)]');
    expect(sceneRoute).toContain('Rendering medium: ${stylePrompt}.');
    expect(sceneRoute).toContain('Preserve the reference');
    expect(sceneRoute).toContain('Do not replace their clothing or identity with a generic costume.');
    expect(sceneRoute).toContain('Friendly lighting and a readable composition');
    expect(sceneRoute).toContain('Gentle, non-scary, non-violent and age-appropriate for ages 4-8.');
    expect(sceneRoute).not.toContain('Calm, soft palette');
    expect(api).toContain('comichero: "a bold modern cel-shaded comic-book rendering medium');
    expect(api).toContain("preserve the reference character's existing clothing and accessories exactly");
    const comicRoute = api.slice(end);
    expect(comicRoute).toContain("Preserve the reference character's face, hair, age, clothing, character intent and accessories exactly.");
    expect(comicRoute).toContain("Feature a single friendly child protagonist");
    expect(comicRoute).not.toContain("friendly child superhero as the central");
    expect(comicRoute).not.toContain("legacy superhero chest emblem");
    expect(comicRoute).not.toContain("showLegacyNameEmblem");
  });

  it("keeps generic world prompts free of forced comic costumes", () => {
    const dashboard = src("components", "kidmode", "KidDashboard.tsx");
    const arcade = src("components", "practice", "HeroArcade.tsx");
    expect(dashboard).not.toContain('brave flowing cape');
    expect(dashboard).not.toContain('brave cape mid-adventure');
    expect(dashboard).not.toContain('dynamic superhero action pose');
    expect(arcade).not.toContain('dynamic superhero action pose');
  });
});
