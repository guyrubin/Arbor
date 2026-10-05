/**
 * B-KID-133 (D-04) — game pieces are moulded coins (KID-DESIGN-DIRECTION
 * §2.6, §3.6): a square coin 96-168 px with the emoji embossed at 58 %, a
 * label on a paper tag under it, centred auto-fit grid; wrong = lavender "not
 * yet" (never pink); no emoji outside a coin on the kid branch of the worlds
 * this item touched. Rendered with react-dom/server (no jsdom).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ kid: true }));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => gate.kid, subscribeKidMode: () => () => {}, noteKidActivity: () => {} }));

import { ChoiceTile } from "../ui/playkit";
import { KidCoin } from "./KidCoin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, ...p), "utf8");
const css = read("..", "..", "index.css");
const coinCss = css.slice(css.indexOf("── D-04 · Game pieces"), css.indexOf("── D-01 · The Stage"));

afterEach(() => { gate.kid = true; });

/** --piece = clamp(96px, min(24vw, 18dvh), 168px) at a viewport. */
const piece = (w: number, h: number) => Math.min(168, Math.max(96, Math.min(0.24 * w, 0.18 * h)));

describe("the piece size rule", () => {
  it("is declared once, exactly as specified", () => {
    expect(coinCss).toContain(".arbor-play { --piece: clamp(96px, min(24vw, 18dvh), 168px); }");
    expect(coinCss).toContain("grid-template-columns: repeat(auto-fit, var(--piece));");
    expect(coinCss).toContain("justify-content: center;");
  });
  it("375x812: three options fit one row (3 x 96 + 2 x 12 <= 343); 1280x800: 140-168 px coins", () => {
    expect(piece(375, 812)).toBe(96);
    expect(3 * piece(375, 812) + 2 * 12).toBeLessThanOrEqual(343);
    expect(piece(1280, 800)).toBeGreaterThanOrEqual(140);
    expect(piece(1280, 800)).toBeLessThanOrEqual(168);
    expect(piece(1920, 1080)).toBe(168);
  });
  it("the coin is square, its emoji 58 % of it, embossed, in a recessed well", () => {
    expect(coinCss).toContain("aspect-ratio: 1;");
    expect(coinCss).toContain("font-size: 58cqi;");
    expect(coinCss).toContain("filter: drop-shadow(0 3px 0 color-mix(in oklab, var(--arbor-ink) 22%, transparent));");
    expect(coinCss).toContain("box-shadow: inset 0 3px 6px color-mix(in oklab, var(--arbor-ink) 18%, transparent);");
    // never a -soft gradient token inside color-mix (an invalid declaration the browser drops)
    expect(coinCss).not.toMatch(/color-mix\([^;]*-soft\b/);
  });
});

describe("ChoiceTile in Kid Mode", () => {
  it("is a square coin with its label on a paper tag", () => {
    const html = renderToStaticMarkup(<ChoiceTile emoji="😢" label="Sad" wash="clay" onClick={() => {}} />);
    expect(html).toMatch(/^<button type="button"[^>]*class="kid-piece"/);
    expect(html).toContain('class="kid-coin" data-wash="clay"');
    expect(html).toContain('<span class="kid-coin-glyph">😢</span>');
    expect(html).toContain('<span class="kid-piece-tag">Sad</span>');
  });
  it("a wrong tap is lavender 'not yet' (never pink, never a shake); correct is green", () => {
    const wrong = renderToStaticMarkup(<ChoiceTile emoji="🔺" label="" state="wrong" />);
    expect(wrong).toContain('data-state="not-yet"');
    expect(wrong).not.toMatch(/pink|play-nudge/);
    expect(coinCss).toContain('.kid-piece[data-state="not-yet"] .kid-coin { --coin-face: var(--arbor-lav-wash); --coin-lip: var(--arbor-lav); }');
    expect(coinCss).toContain('.kid-piece[data-state="not-yet"] .kid-coin { animation: kid-wobble');
    expect(renderToStaticMarkup(<ChoiceTile emoji="🔺" label="" state="correct" />)).toContain('data-state="correct"');
  });
  it("the parent door keeps its tile", () => {
    gate.kid = false;
    const html = renderToStaticMarkup(<ChoiceTile emoji="😢" label="Sad" />);
    expect(html).not.toContain("kid-coin");
    expect(html).toContain("min-h-[112px]");
  });
  it("KidCoin is decorative and can pin a size", () => {
    expect(renderToStaticMarkup(<KidCoin emoji="🧱" size={64} />)).toBe('<span aria-hidden="true" class="kid-coin" style="--coin-size:64px"><span class="kid-coin-glyph">🧱</span></span>');
  });
});

describe("the worlds' kid branches", () => {
  const pattern = read("..", "practice", "PatternPowerWorld.tsx");
  const mood = read("..", "practice", "FeelingsLabTab.tsx");
  const beat = read("..", "practice", "BeatKeeperWorld.tsx");
  const vault = read("..", "practice", "MemoryMatch.tsx");
  it("Pattern Power: coins on a paper track, the missing slot a glowing socket; options in the piece grid", () => {
    expect(pattern).toContain('<div className="pattern-sequence kid-track" role="img" aria-label={patternAria} data-kid-track="">');
    expect(pattern).toContain('<span className="kid-socket" data-filled={picked ? "" : undefined}>');
    expect(pattern).toContain('<div className={kid ? "kid-piece-grid" : "grid grid-cols-3 gap-3"}>');
    expect(coinCss).toContain("border: 3px dashed var(--arbor-sky);");
  });
  it("Mood Mountain: feelings are coins on their own washes (angry peach, sad tint, frustrated lavender); the scenario emoji is in a 64 px coin; no white play card", () => {
    const kid = mood.slice(mood.indexOf("  return (\n    <GameShell\n      worldId=\"feelings\""));
    expect(mood).toMatch(/angry: "peach",[\s\S]*?frustrated: "lav",/);
    expect(mood).toMatch(/sad: "clay",/);
    expect(kid).toContain('<KidCoin emoji={scenario.emoji} wash="yellow" size={64} />');
    expect(kid).toContain('<div className="kid-piece-grid">');
    expect(kid).not.toContain("<PlayPanel");
    expect(kid).not.toMatch(/text-5xl|text-2xl/);
  });
  it("Beat Keeper: the coin IS the play — the tag is the beat's name, no 'Play' prefix, no panel", () => {
    expect(beat).toContain('label={kid ? label : t("elev.kids.beat.choose.cta", { name: label })}');
    expect(beat).toContain('return kid ? <div data-kid-beat-pick="">{children}</div> : <PlayPanel tone="clay">{children}</PlayPanel>;');
  });
  it("Mind Vault: toy cards that flip (M4), dotted world-wash backs with no emoji, a match lifts", () => {
    expect(vault).toContain('className="kid-card" data-face={face ? "" : undefined} data-matched={c.matched ? "" : undefined}>');
    expect(vault).toContain('<span className="kid-card-side kid-card-back" />');
    expect(coinCss).toContain(".arbor-play .kid-card[data-face] .kid-card-inner { transform: rotateY(180deg); }");
    expect(coinCss).toContain(".arbor-play .kid-card[data-matched] .kid-card-inner { transform: rotateY(180deg) translateY(-6px); }");
    const reduced = coinCss.slice(coinCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("transition: opacity 150ms");
  });
});
