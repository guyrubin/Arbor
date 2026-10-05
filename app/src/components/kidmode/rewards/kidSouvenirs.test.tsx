/**
 * B-KID-94 + B-KID-96 v1 — one finish moment; the child keeps ONE souvenir
 * sticker per world / book: existing art only (the world's card / the book's
 * cover), earned once, lifetime-monotonic, never a score, no streak; stored
 * per child (registered for export + erase); "My stickers" on the home,
 * hidden while empty.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ items: [] as { id: string; kind: "world" | "book"; refId: string; earnedAt: string }[], upserts: [] as unknown[] }));
vi.mock("./useKidSouvenirs", () => ({ useKidSouvenirs: () => ({ items: store.items, loaded: true, upsert: async (s: unknown) => { store.upserts.push(s); } }) }));
vi.mock("../../ui/HeroAvatar", () => ({ HeroAvatar: () => <span data-hero="" />, useHeroAvatar: () => ({ url: null }) }));
vi.mock("../../../context/ArborContext", () => ({ useArborOptional: () => ({ childProfile: { id: "c1", kidTheme: "film3d" } }), useArbor: () => ({ childProfile: { id: "c1", kidTheme: "film3d" } }) }));

import { SOUVENIR_COLLECTION, souvenirArt, souvenirStrip, souvenirToAward } from "./kidSouvenirs";
import { KidFinishMoment, KidStickerStrip, KidSouvenirSticker } from "./KidSouvenir";
import { CHILD_SUBCOLLECTIONS } from "../../../lib/childData";
import { en, he } from "../../../lib/i18nElevation/kidsStories";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, ...p), "utf8");
const NOW = new Date("2026-10-05T18:00:00Z");

describe("the ledger: once each, only ever grows", () => {
  it("a world or book ending earns its souvenir the first time only", () => {
    const first = souvenirToAward([], "world", "memory", NOW)!;
    expect(first).toEqual({ id: "world:memory", kind: "world", refId: "memory", earnedAt: NOW.toISOString() });
    expect(souvenirToAward([first], "world", "memory", NOW)).toBeNull();
    expect(souvenirToAward([first], "book", "noahs-ark", NOW)!.id).toBe("book:noahs-ark");
  });
  it("only real kid worlds earn a world souvenir; no id = nothing", () => {
    expect(souvenirToAward([], "world", "word-world", NOW)).toBeNull();
    expect(souvenirToAward([], "world", "", NOW)).toBeNull();
  });
  it("the strip shows each souvenir once, newest first, and skips unknown worlds", () => {
    const items = [
      { id: "world:beat", kind: "world" as const, refId: "beat", earnedAt: "2026-10-01T10:00:00Z" },
      { id: "book:noahs-ark", kind: "book" as const, refId: "noahs-ark", earnedAt: "2026-10-03T10:00:00Z" },
      { id: "world:beat", kind: "world" as const, refId: "beat", earnedAt: "2026-10-01T10:00:00Z" },
      { id: "world:face-match", kind: "world" as const, refId: "face-match", earnedAt: "2026-10-04T10:00:00Z" },
    ];
    expect(souvenirStrip(items).map((s) => s.id)).toEqual(["book:noahs-ark", "world:beat"]);
  });
  it("no score, no count, no streak, no expiry in the record or the module", () => {
    const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const src = code(read("kidSouvenirs.ts")) + code(read("KidSouvenir.tsx"));
    expect(src).not.toMatch(/streak|expires|score:|points|tomorrow/i);
    expect(Object.keys(souvenirToAward([], "world", "pose", NOW)!).sort()).toEqual(["earnedAt", "id", "kind", "refId"]);
  });
  it("stored per child and registered for export + erase", () => {
    expect(SOUVENIR_COLLECTION).toBe("kidSouvenirs");
    expect(CHILD_SUBCOLLECTIONS).toContain("kidSouvenirs");
    expect(read("useKidSouvenirs.ts")).toContain('useChildCollection<KidSouvenir>(childId, "kidSouvenirs")');
  });
});

describe("the sticker: existing art, die-cut", () => {
  it("a world's sticker is its card; a book's is its cover (or the Tonight card) — never another theme", () => {
    expect(souvenirArt({ kind: "world", refId: "memory" }, "film3d")!.src480).toContain("game-memory");
    expect(souvenirArt({ kind: "book", refId: "noahs-ark" }, "film3d")!.src480).toContain("noahs-ark");
    // B-KID-131 re-pin: film3d covers every book now; the Tonight-card fallback is proven on a storybook book without a cover.
    expect(souvenirArt({ kind: "book", refId: "the-lantern-path" }, "film3d")!.provenanceId).toBe("film3d-card:story-the-lantern-path");
    expect(souvenirArt({ kind: "book", refId: "noahs-ark" }, "storybook")!.provenanceId).toBe("world-art-v2:tonight-story");
    expect(souvenirArt({ kind: "world", refId: "memory" }, "storybook")!.provenanceId).toBe("world-art-v2:mind-vault");
  });
  it("round: a CSS mask on the picture and a token border, decorative", () => {
    const html = renderToStaticMarkup(<KidSouvenirSticker kind="world" refId="beat" />);
    expect(html).toContain('data-kid-sticker="world:beat"');
    expect(html).toMatch(/mask-image:radial-gradient\(closest-side/);
    expect(html).toContain("border:2px solid var(--comic-ink)");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});

describe("the ONE finish moment", () => {
  it("the hero (generated, else the theme's stock hero, else Sprout) + this ending's sticker; new the first time", () => {
    store.items = [];
    const html = renderToStaticMarkup(<KidFinishMoment childId="c1" kind="book" refId="noahs-ark" lang="he" />);
    expect(html).toContain("data-hero");
    expect(html).toContain('data-kid-sticker="book:noahs-ark"');
    expect(html).toContain(he["kidReward.newSticker"]);
  });
  it("already earned: the sticker shows, no 'new', nothing is written again", () => {
    store.items = [{ id: "book:noahs-ark", kind: "book", refId: "noahs-ark", earnedAt: NOW.toISOString() }];
    const html = renderToStaticMarkup(<KidFinishMoment childId="c1" kind="book" refId="noahs-ark" lang="en" />);
    expect(html).toContain('data-kid-sticker="book:noahs-ark"');
    expect(html).not.toContain(en["kidReward.newSticker"]);
  });
  it("wired: every game finish (GameFinish) and the reader's ending; finish sound on both; no star row", () => {
    const shell = read("..", "game", "GameShell.tsx");
    expect(shell).toContain('<KidFinishMoment childId={childId} kind="world" refId={world}');
    expect(shell).toContain('kidSfx("finish")');
    const reader = read("..", "..", "tabs", "HeroJourneyTab.tsx");
    expect(reader).toContain('<KidFinishMoment childId={childProfile.id} kind="book" refId={activeStory.id}');
    expect(reader).toMatch(/const toEnding = \(\) => \{[\s\S]*?kidSfx\("finish"\);/);
    expect(read("..", "..", "practice", "PatternPowerWorld.tsx")).toContain('<GameFinish worldId="pattern"');
    // Mimic's pack-complete beat: no star row in Kid Mode, the sticker instead (one hero on screen)
    const mimic = read("..", "..", "practice", "MimicStudioTab.tsx");
    expect(mimic).toContain("stars={kidMode ? undefined : wonPack.prompts.length}");
    expect(mimic).toContain('<KidFinishMoment childId={childProfile.id} kind="world" refId="mimic"');
  });
});

describe("My stickers on the home", () => {
  const props = { lang: "en" as const, nameOf: () => "Mind Vault", onOpen: () => {}, heading: <h2>My stickers</h2> };
  it("hidden while empty (no empty slots, no 'collect them all')", () => {
    expect(renderToStaticMarkup(<KidStickerStrip items={[]} {...props} />)).toBe("");
  });
  it("each earned sticker is a 44 px+ button named after its world / book, EN + HE", () => {
    const items = [{ id: "world:memory", kind: "world" as const, refId: "memory", earnedAt: NOW.toISOString() }];
    const html = renderToStaticMarkup(<KidStickerStrip items={items} {...props} />);
    expect(html).toContain('aria-label="Mind Vault sticker"');
    expect(html).toContain("min-inline-size:44px");
    expect(he["kidReward.myStickers"]).toMatch(/[֐-׿]/);
    expect(he["kidReward.stickerAria"]).toContain("{name}");
  });
  it("the home renders it under Games and a sticker opens its world / book", () => {
    const dash = read("..", "KidDashboard.tsx");
    expect(dash.indexOf("<KidStickerStrip")).toBeGreaterThan(dash.indexOf('aria-label={t("kid.games.title")}'));
    expect(dash).toContain('onOpen={(s) => onOpenSurface(s.kind === "world" ? "arcade" : "journeys", s.refId)}');
  });
});
