/**
 * B-KID-74 (KC-01) — one kid game shell. In Kid Mode a game has ONE top bar
 * (the overlay's: Home · the game's name · hear-it · grown-ups exit), the
 * instruction once, the world's card as a soft backdrop, dots for progress and
 * an explicit finish (Play again / Home). The parent door keeps PlayHeader.
 * Rendered with react-dom/server (no jsdom in this repo).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ kid: true }));
vi.mock("../../../lib/kidModeGate", () => ({ isKidModeActive: () => gate.kid, subscribeKidMode: () => () => {} }));
vi.mock("../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", aiLang: "en", t: (k: string) => k }) }));
vi.mock("../../../context/ArborContext", () => ({ useArborOptional: () => ({ childProfile: { id: "c1", kidTheme: "film3d" } }), useArbor: () => ({ childProfile: { id: "c1" } }) }));
vi.mock("../../../lib/voice", () => ({ speakText: vi.fn(), stopVoice: vi.fn(), voiceSupported: () => true }));
vi.mock("../../ui/HeroAvatar", () => ({ HeroAvatar: () => <span data-hero="" /> }));

import { GameShell, GameFinish, GameProgressDots } from "./GameShell";
import { setKidHome } from "../kidChrome";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, ...p), "utf8");

afterEach(() => { gate.kid = true; setKidHome(null); });

describe("GameShell in Kid Mode", () => {
  const html = renderToStaticMarkup(
    <GameShell worldId="memory" title="Mind Vault" instruction="Find the pairs." eyebrow="Hero mission" progress={{ index: 2, total: 5 }}>
      <div data-game-body="" />
    </GameShell>,
  );
  it("prints no second title, no eyebrow, no say-bubble: the overlay bar names the game", () => {
    expect(html).not.toMatch(/<h1\b/);
    expect(html).not.toContain("Mind Vault");
    expect(html).not.toContain("Hero mission");
    expect(html).not.toContain("play-scene-header");
  });
  it("shows the instruction once, on a solid token surface", () => {
    expect((html.match(/Find the pairs\./g) ?? []).length).toBe(1);
    expect(html).toMatch(/data-game-instruction=""[^>]*background:var\(--arbor-paper-elevated\)/);
  });
  it("the world's own card is a VISIBLE banner strip (decorative, ~30 % of the viewport, focal point top); the play surface overlaps its faded edge", () => {
    expect(html).toMatch(/aria-hidden="true" data-game-backdrop=""/);
    expect(html).toContain("game-memory-480.webp");
    expect(html).toContain("game-memory-1024.webp 1024w");
    expect(html).toContain("clamp(150px, 30dvh, 300px)");
    expect(html).toContain("object-position:50% 22%");
    // not hidden behind the play card: no blur, no dimming, not absolutely behind
    expect(html).not.toContain("blur(");
    expect(html).not.toMatch(/data-game-backdrop=""[^>]*absolute inset-0/);
    expect(html).toContain("margin-block-start:-56px");
    // text sits on the solid instruction surface, after the banner
    expect(html.indexOf("data-game-backdrop")).toBeLessThan(html.indexOf("data-game-instruction"));
  });
  it("progress is dots — never numerals", () => {
    const dots = renderToStaticMarkup(<GameProgressDots index={2} total={5} />);
    expect((dots.match(/<span/g) ?? []).length).toBe(5);
    expect(dots).not.toMatch(/>\d/);
    expect(dots).toContain('aria-hidden="true"');
    expect(html).toContain("data-game-progress");
  });
});

describe("GameShell on the parent door", () => {
  it("renders today's PlayHeader (title + eyebrow) unchanged", () => {
    gate.kid = false;
    const html = renderToStaticMarkup(<GameShell worldId="memory" title="Mind Vault" instruction="Find the pairs." eyebrow="Hero mission"><div /></GameShell>);
    expect(html).toMatch(/<h1\b[^>]*>Mind Vault<\/h1>/);
    expect(html).toContain("Hero mission");
    expect(html).not.toContain("data-game-backdrop");
  });
});

describe("GameFinish — the explicit end", () => {
  it("the hero cheers; Play again + Home (when Kid Mode registered Home); no stars", () => {
    setKidHome(() => {});
    const html = renderToStaticMarkup(<GameFinish title="You found them all!" onPlayAgain={() => {}} playAgainLabel="Play again" homeLabel="Home" />);
    expect(html).toContain("data-hero");
    expect(html).toContain("Play again");
    expect(html).toContain("Home");
    expect(html).not.toMatch(/⭐|★|stars/);
  });
  it("outside Kid Mode there is no Home to offer", () => {
    const html = renderToStaticMarkup(<GameFinish title="Done" onPlayAgain={() => {}} playAgainLabel="Play again" homeLabel="Home" />);
    expect(html).not.toContain(">Home<");
  });
});

describe("Fable render: the bar names the world reached from the home tile", () => {
  it("the home tile's path (arcade + its world id) titles the bar with the world's kid name, never 'Playbank'", async () => {
    const { kidBarTitle } = await import("../KidModeOverlay");
    const { kidDestinations } = await import("../KidDashboard");
    const { translate } = await import("../../../lib/i18n");
    for (const lang of ["en", "he"] as const) {
      const t = (k: string) => translate(lang, k);
      for (const d of kidDestinations("noahs-ark").filter((x) => x.surface === "arcade")) {
        const title = kidBarTitle("arcade", d.arg, null, t)!;
        expect(title, `${lang} ${d.tile}`).not.toBe(t("kid.surface.arcade"));
        expect(title).not.toMatch(/Playbank|ארגז המשחקים/);
      }
      expect(kidBarTitle("arcade", "memory", "stale", t)).toBe(t("kid.game.mind-vault.title"));
    }
    expect(kidBarTitle("arcade", "memory", null, (k) => k)).toBe("kid.game.mind-vault.title");
    expect(kidBarTitle("journeys", null, "Noah's Ark", (k) => k)).toBe("Noah's Ark");
    expect(kidBarTitle("home", null, null, (k) => k)).toBeNull();
  });
  it("the visible title node renders that title and takes the remaining width", () => {
    const overlay = read("..", "KidModeOverlay.tsx");
    expect(overlay).toContain("const barTitle = kidBarTitle(view, arcadeWorldId, surfaceTitle, t);");
    const node = overlay.slice(overlay.indexOf("data-kid-bar-title"), overlay.indexOf("{barTitle}") + 10);
    expect(node).toContain('flex: "1 1 0%"');
    expect(node).toContain("minWidth: 0");
    expect(node).toContain("WebkitLineClamp: 2");
    // the Home label folds to icon-only below sm, so the name keeps the width
    expect(overlay).toContain('<span className="hidden sm:inline">{t("kid.back.home")}</span>');
  });
});

describe("the one top bar + migrated worlds", () => {
  const overlay = read("..", "KidModeOverlay.tsx");
  it("the overlay bar carries hear-it inside a game and registers Home for the finish", () => {
    expect(overlay).toContain('{view === "arcade" && <KidHearItButton />}');
    expect(overlay).toContain('setKidHome(() => setView("home"));');
  });
  it.each([["MindVaultWorld.tsx", "memory"], ["PatternPowerWorld.tsx", "pattern"], ["FeelingsLabTab.tsx", "feelings"], ["BeatKeeperWorld.tsx", "beat"], ["HeroPoseWorld.tsx", "pose"], ["SpellForgeWorld.tsx", "reading"]])("%s is on the shell (no PlayHeader of its own)", (file, worldId) => {
    const src = read("..", "..", "practice", file);
    expect(src).toContain("<GameShell");
    expect(src).toContain(`worldId="${worldId}"`);
    expect(src).not.toContain("<PlayHeader");
  });
  it("Pattern Power: in Kid Mode the pips, the support caption and the in-header hear-it give way to the shell; the done view is GameFinish", () => {
    const pp = read("..", "..", "practice", "PatternPowerWorld.tsx");
    expect(pp).toContain("{!kid && <ProgressPips");
    expect(pp).toContain("progress={{ index: idx, total }}");
    expect(pp).toMatch(/if \(isKidModeActive\(\)\) \{\s*return <GameFinish/);
  });
  it("Mind Vault: in the kid shell the in-panel hear-it row and Celebrate give way to the shell", () => {
    const mm = read("..", "..", "practice", "MemoryMatch.tsx");
    expect(mm).toContain("const inKidShell = embedded && isKidModeActive();");
    expect(mm).toContain("{won && inKidShell ? (\n        <GameFinish");
    expect(mm).toContain("{!inKidShell && (");
  });
});
