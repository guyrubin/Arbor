/**
 * The toy kit: every tappable thing in Kids Mode is a flat ceramic control.
 * GO is a dark face with a light label. Reduced motion drops the press scale.
 * Rendered with react-dom/server (no jsdom in this repo).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ kid: true }));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => gate.kid, subscribeKidMode: () => () => {} }));

import { KidToy } from "./KidToy";
import { PlayButton } from "../ui/playkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(__dirname, "..", "..", "index.css"), "utf8");
const toyCss = css.slice(css.indexOf("── D-02 · The toy"), css.indexOf("── D-04 · Game pieces"));
const shell = readFileSync(path.join(__dirname, "game", "GameShell.tsx"), "utf8");

afterEach(() => { gate.kid = true; });

describe("KidToy", () => {
  it("is a real button carrying tone / size / shape for the CSS recipe", () => {
    const html = renderToStaticMarkup(<KidToy tone="go" size="l" glyphEnd="arrow_forward">Read</KidToy>);
    expect(html).toMatch(/^<button type="button" class="kid-toy" data-tone="go" data-size="l" data-shape="bar"/);
    expect(html).toContain(">Read<");
    // the directional arrow mirrors in Hebrew; a non-directional glyph does not
    expect(html).toContain("kid-toy-glyph rtl:-scale-x-100");
    expect(renderToStaticMarkup(<KidToy glyph="home" shape="round" aria-label="Home" />)).not.toContain("scale-x");
  });
  it("piece feedback is a state, never a colour the caller picks", () => {
    expect(renderToStaticMarkup(<KidToy state="not-yet">x</KidToy>)).toContain('data-state="not-yet"');
  });
});

describe("the toy recipe (index.css, .arbor-play only)", () => {
  it("flat ceramic: no gloss, no lip, a small press, the focus ring stays", () => {
    expect(toyCss).toContain("--toy-depth: 0px;");
    expect(toyCss).toContain("background: var(--toy-face);");
    expect(toyCss).toContain("margin-block-end: 0;");
    expect(toyCss).not.toMatch(/linear-gradient|toy-lip|scale\(1\.03,\s*0\.94\)/);
    expect(toyCss).toContain("transform: scale(0.98);");
    expect(toyCss).toContain("min-block-size: 64px;");
    expect(toyCss).toMatch(/\.kid-toy:focus-visible \{ outline: 3px solid var\(--arbor-sky\)/);
  });
  it("GO is a dark face with a light label; not-yet stays the lavender wash", () => {
    expect(toyCss).toContain('.arbor-play .kid-toy[data-tone="go"] { --toy-face: var(--arbor-ink); --toy-ink: var(--arbor-paper-elevated); border-color: transparent; }');
    expect(toyCss).toContain("--toy-ink: var(--arbor-ink);");
    expect(toyCss).toContain('[data-state="not-yet"] { --toy-face: var(--arbor-lav-wash); --toy-ink: var(--arbor-lav-ink); }');
    expect(toyCss).toContain('--toy-face: var(--studio-action);');
  });
  it("reduced motion drops the press; motion tokens + keyframes have reduced forms", () => {
    const reduced = toyCss.slice(toyCss.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".arbor-play .kid-toy:active { transform: none; }");
    expect(reduced).not.toContain("scale(");
    expect(css).toContain("--kid-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);");
    for (const k of ["kid-pop-in", "kid-bob", "kid-drop", "kid-wobble"]) expect(css).toContain(`@keyframes ${k}`);
  });
  it("every selector in the kid language is scoped under .arbor-play (the parent register never moves)", () => {
    const block = css.slice(css.indexOf("KID UI LANGUAGE v1"), css.indexOf("NATIVE SAFE AREAS"));
    const selectors = [...block.matchAll(/^\s*([^@{}\n/][^{}\n]*)\{/gm)].map((m) => m[1].trim()).filter((s) => !/^(from|to|\d+%)/.test(s));
    expect(selectors.length).toBeGreaterThan(20);
    // split on top-level commas only (a comma inside :is()/:has() is one selector)
    const topLevel = (sel: string) => { const out: string[] = []; let depth = 0, cur = ""; for (const ch of sel) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
    for (const sel of selectors) for (const part of topLevel(sel)) expect(part.trim(), part).toMatch(/\.arbor-play/);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("child entrance visibility", () => {
  const motion = css.slice(css.indexOf("── D-02 · Shape + motion"), css.indexOf("── D-03 · Kid type"));
  const firstFrame = (name: string) => new RegExp(`@keyframes ${name}\\s*\\{\\s*(?:0%|from)\\s*\\{([^}]+)\\}`).exec(css)?.[1] ?? "";

  it("keeps child content visible at frame zero, including delayed or paused entrances", () => {
    for (const name of ["kid-pop-in", "kid-drop"]) {
      expect(firstFrame(name), name).toMatch(/opacity:\s*1\s*;/);
      expect(firstFrame(name), name).not.toMatch(/(?:visibility:\s*hidden|display:\s*none|scale\(0\))/);
    }
    // Shared scenes retain the parent fade by default, with an inherited
    // child-only override. This also covers world tiles using play-pop-in.
    expect(firstFrame("play-pop-in")).toMatch(/opacity:\s*var\(--kid-entry-opacity,\s*0\)\s*;/);
    const scopes = [...css.matchAll(/([^{}]+)\{[^{}]*--kid-entry-opacity:\s*1\s*;[^{}]*\}/g)];
    expect(scopes).toHaveLength(1);
    expect(scopes[0][1].trim()).toMatch(/\.arbor-play$/);
  });

  it("removes child entrances for reduced motion without overriding disabled states or pointer access", () => {
    const reduced = motion.slice(motion.indexOf("@media (prefers-reduced-motion: reduce)"));
    const stopped = /([^{}]+)\{\s*animation:\s*none\s*;\s*\}/.exec(reduced)?.[1] ?? "";
    for (const name of ["play-pop-in", "kid-pop-in", "kid-drop", "kid-bob", "kid-wobble"]) {
      expect(stopped).toContain(`.arbor-play .${name}`);
    }
    expect(reduced).not.toMatch(/opacity:|pointer-events:|visibility:|display:|animation-delay:/);
    expect(reduced).not.toContain("kid-fade-in");
  });
});

describe("applied to the loudest controls", () => {
  it("PlayButton inside Kid Mode is a toy: primary = GO, soft = paper; the parent door keeps its pill", () => {
    expect(renderToStaticMarkup(<PlayButton onClick={() => {}}>Go</PlayButton>)).toContain('class="kid-toy" data-tone="go"');
    expect(renderToStaticMarkup(<PlayButton variant="soft" onClick={() => {}}>Back</PlayButton>)).toContain('data-tone="paper"');
    gate.kid = false;
    const parent = renderToStaticMarkup(<PlayButton onClick={() => {}}>Go</PlayButton>);
    expect(parent).not.toContain("kid-toy");
    expect(parent).toContain("play-pressable");
  });
  it("a game's finish: Play again is the GO toy (l, replay glyph), Home a paper toy", () => {
    expect(shell).toContain('<KidToy tone="go" size="l" glyph="replay" onClick={onPlayAgain}');
    expect(shell).toContain('<KidToy tone="paper" glyph="home" onClick={goHome}');
    expect(shell).not.toContain("<PlayButton");
  });
});
