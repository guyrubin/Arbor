/**
 * B-BOOK-31 / B-KID-143 — the reference-likeness audit, as a second synthetic
 * child account would meet the product.
 *
 * The 5 Oct glossy story covers and game cards (`/visuals/cards/`, manifest
 * `hasHero: true`) paint the reference family's child. They stay on disk (Guy,
 * 5 Oct) but no shared slot may show them to any account: every catalogue
 * cover, book page, sticker, stage and world card reads through the hero-free
 * accessors (lib/kidThemeManifest sharedKidArt / storyCoverArt), and the only
 * hero a child sees is their own (private prints, approved sheet, portrait).
 * A hero-less child still gets a complete book (the designed title card, the
 * hero-free plate). The reference family's own private book covers stay its
 * own (owner/child/edition-scoped prints).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const who = vi.hoisted(() => ({ theme: "film3d" as "film3d" | "storybook" }));
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => ({ childProfile: { id: "synthetic-second-child", kidTheme: who.theme } }),
  useArbor: () => ({ childProfile: { id: "synthetic-second-child", kidTheme: who.theme } }),
}));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => <span data-own-hero="" />, useHeroAvatar: () => ({ url: null, hasHero: false }) }));
vi.mock("./rewards/useKidSouvenirs", () => ({ useKidSouvenirs: () => ({ items: [], loaded: true, scopeKey: "o:c", awardOnce: async () => false, upsert: async () => undefined }) }));

import { HERO_STORIES } from "../../lib/heroJourneys";
import { KID_THEME_IDS, KID_THEME_MANIFEST, KID_WORLD_TILE_IDS, kidArt, sharedKidArt, storyCoverArt, storyCoverKey, type KidArtKey } from "../../lib/kidThemeManifest";
import { KidBookCover } from "./KidBookCover";
import { StoryCard } from "../stories/StoryCard";
import { KidSouvenirSticker } from "./rewards/KidSouvenir";
import { KidStageFallback } from "./KidStageFallback";
import { kidStageArt } from "./kidStageArt";
import { worldArtwork } from "../practice/worldArtwork";
import WorldScene from "../practice/WorldScene";
import { bookCoverScopeKey, visibleBookCoverPrint } from "./bookCoverScope";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const REFERENCE = "/visuals/cards/";
const STORY_IDS = HERO_STORIES.map((s) => s.id);
const painted = (theme: (typeof KID_THEME_IDS)[number]) =>
  Object.entries(KID_THEME_MANIFEST[theme]).filter(([, art]) => art?.hasHero).map(([key]) => key as KidArtKey);
/** Every web file of a hero-painted picture (the folder also holds two hero-free
 *  backgrounds — the play card and the garden — which any child may see). */
const PAINTED_FILES = [...new Set(KID_THEME_IDS.flatMap((t) => painted(t).flatMap((k) => [kidArt(t, k)!.src, kidArt(t, k)!.src480])))];
const showsReference = (html: string) => PAINTED_FILES.filter((f) => html.includes(f));

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("the reference likeness is only reachable through the manifest, and the manifest never hands it to a shared slot", () => {
  it("non-vacuous: the hero-painted pictures exist, and every one of them is a /visuals/cards/ file", () => {
    const keys = painted("film3d");
    expect(keys.filter((k) => k.startsWith("story.")).length).toBeGreaterThanOrEqual(21); // the 10 + 11 film-3D covers
    for (const k of keys) expect(kidArt("film3d", k)!.src, k).toContain(REFERENCE);
  });
  it("every theme, every story and every slot: the shared accessors never return a hero-painted picture", () => {
    for (const theme of KID_THEME_IDS) {
      for (const id of STORY_IDS) {
        expect(storyCoverArt(theme, id)?.hasHero ?? false, `${theme}:${id}`).toBe(false);
        expect(worldArtwork(`story-${id}`, theme)?.hasHero ?? false, `${theme}:${id}`).toBe(false);
      }
      for (const key of painted(theme)) expect(sharedKidArt(theme, key), `${theme}:${key}`).toBeNull();
    }
  });
  it("no source outside the manifest names a /visuals/cards/ file or reads a story cover past storyCoverArt", () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      if (file.endsWith(path.join("lib", "kidThemeManifest.ts"))) continue;
      // B-GA-09: a guard registry that forbids new likeness files and never renders (test-only import, strings and hashes only: childLikenessFiles.guard.test.ts).
      if (file.endsWith(path.join("lib", "childLikenessFiles.named.ts"))) continue;
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      if (text.includes(REFERENCE)) offenders.push(`${path.relative(SRC, file)}: ${REFERENCE}`);
      if (text.includes("storyCoverKey(")) offenders.push(`${path.relative(SRC, file)}: storyCoverKey(`);
    }
    expect(offenders).toEqual([]);
  });
  it("negative control: the scans see a planted painted file", () => {
    expect(`src="${REFERENCE}web/story-noahs-ark-480.webp"`).toContain(REFERENCE);
    expect(showsReference(`<img src="${kidArt("film3d", storyCoverKey("noahs-ark"))!.src480}">`)).toHaveLength(1);
  });
});

describe("a second synthetic child, every catalogue cover and page", () => {
  for (const theme of KID_THEME_IDS) {
    it(`${theme}: kid covers, parent cards, stickers and the reader's loading page carry no reference likeness; every book stays complete`, () => {
      who.theme = theme;
      for (const id of STORY_IDS) {
        const kid = renderToStaticMarkup(<KidBookCover storyId={id} title="Synthetic book" pack="courage" theme={theme} readLabel="read" onOpen={() => {}} layout="grid" />);
        expect(showsReference(kid), id).toEqual([]);
        expect(kid, id).toContain("Synthetic book"); // complete: the title is always there
        expect(kid, id).toContain("data-kid-book-titlecard");
        const story = HERO_STORIES.find((s) => s.id === id)!;
        expect(showsReference(renderToStaticMarkup(<StoryCard story={story} lang="en" theme={theme} onOpen={() => {}} />)), id).toEqual([]);
        expect(showsReference(renderToStaticMarkup(<KidSouvenirSticker kind="book" refId={id} />)), id).toEqual([]);
        expect(showsReference(renderToStaticMarkup(<KidStageFallback storyId={id} />)), id).toEqual([]);
        expect(showsReference(kidStageArt(theme, { kind: "story", storyId: id }).wide?.src ?? ""), id).toEqual([]);
      }
    });
    it(`${theme}: games — every world tile, stage and card shows no reference likeness`, () => {
      who.theme = theme;
      for (const worldId of KID_WORLD_TILE_IDS) {
        const scene = renderToStaticMarkup(<WorldScene worldId={worldId} theme={theme} imagePrompt="synthetic" sizes="200px"><i data-own-hero="" /></WorldScene>);
        expect(showsReference(scene), worldId).toEqual([]);
        expect(scene, worldId).toContain("data-own-hero");
        expect(showsReference(renderToStaticMarkup(<KidStageFallback worldId={worldId} />)), worldId).toEqual([]);
        expect(showsReference(kidStageArt(theme, { kind: "world", worldId }).wide?.src ?? ""), worldId).toEqual([]);
      }
    });
  }
  it("WorldScene keeps an illustrated, hero-free tile where the static card painted a hero: that world's own painting", () => {
    expect(kidArt("film3d", "world.memory.tile")?.hasHero).toBe(true);
    const html = renderToStaticMarkup(<WorldScene worldId="memory" theme="film3d" imagePrompt="synthetic" sizes="200px">{null}</WorldScene>);
    expect(html).toContain(kidArt("storybook", "world.memory.tile")!.src480);
    expect(kidArt("storybook", "world.memory.tile")!.hasHero).toBe(false);
  });
});

describe("the reference family keeps its own covers; nobody else ever sees them", () => {
  const ownCover = { bookId: "five-smooth-stones", sheetId: "uploaded-approved-sheet", setId: "approved-set", createdAt: "2026-10-06T00:00:00Z",
    sheetManifest: { poses: {}, prints: { cover: { file: "prints/cover.webp" } } } } as unknown as BookAssetsDoc;
  it("its private printed cover is displayed for its own owner, child and edition only", () => {
    const own = bookCoverScopeKey("reference-owner", "reference-child", ownCover);
    const print = { scope: own, url: "blob:own-cover" };
    expect(visibleBookCoverPrint(print, own)).toBe("blob:own-cover");
    expect(visibleBookCoverPrint(print, bookCoverScopeKey("synthetic-owner", "synthetic-second-child", ownCover))).toBeNull();
    expect(visibleBookCoverPrint(print, bookCoverScopeKey("reference-owner", "a-sibling", ownCover))).toBeNull();
  });
  it("the manifest's painted covers are still on file (never deleted), just never offered to a shared slot", () => {
    expect(kidArt("film3d", storyCoverKey("david-and-goliath"))?.src).toContain(REFERENCE);
    expect(storyCoverArt("film3d", "david-and-goliath")).toBeNull();
  });
});
