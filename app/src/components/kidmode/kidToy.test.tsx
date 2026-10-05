/**
 * B-KID-133 (D-02) — the toy kit (KID-DESIGN-DIRECTION §2.3 + §2.7): every
 * tappable thing in Kids Mode is a moulded toy with a lip that sinks and
 * springs; yellow means GO; reduced motion keeps the lip press, drops the
 * squash. Rendered with react-dom/server (no jsdom in this repo).
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
const toyCss = css.slice(css.indexOf("── D-02 · The toy"), css.indexOf("── D-01 · The Stage"));
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
  it("moulded lip + contact shadow + gloss, squash on press, spring on release", () => {
    expect(toyCss).toContain("0 var(--toy-depth) 0 var(--toy-lip)");
    expect(toyCss).toContain("transform: translateY(calc(var(--toy-depth) - 1px)) scale(1.03, 0.94);");
    expect(toyCss).toContain("transition: transform var(--kid-dur-release) var(--kid-ease-spring)");
    expect(toyCss).toContain("min-block-size: 64px;");
    expect(toyCss).toMatch(/\.kid-toy:focus-visible \{ outline: 3px solid var\(--arbor-sky\)/);
  });
  it("GO = yellow face, ochre lip, navy label (dark on light: out of the white-label inventory)", () => {
    expect(toyCss).toContain('.arbor-play .kid-toy[data-tone="go"] { --toy-face: var(--arbor-yellow); --toy-lip: var(--arbor-ochre); }');
    expect(toyCss).toContain("--toy-ink: var(--arbor-ink);");
    expect(toyCss).toContain('[data-state="not-yet"] { --toy-face: var(--arbor-lav-wash); --toy-lip: var(--arbor-lav)');
  });
  it("reduced motion: the lip press only, no squash; motion tokens + keyframes have reduced forms", () => {
    const reduced = toyCss.slice(toyCss.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".arbor-play .kid-toy:active { transform: translateY(calc(var(--toy-depth) - 1px)); }");
    expect(reduced).not.toContain("scale(");
    expect(css).toContain("--kid-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);");
    for (const k of ["kid-pop-in", "kid-bob", "kid-drop", "kid-wobble", "kid-fade-in"]) expect(css).toContain(`@keyframes ${k}`);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.arbor-play \.kid-pop-in \{ animation: kid-fade-in/);
  });
  it("every selector in the kid language is scoped under .arbor-play (the parent register never moves)", () => {
    const block = css.slice(css.indexOf("KID UI LANGUAGE v1"), css.indexOf("NATIVE SAFE AREAS"));
    const selectors = [...block.matchAll(/^\s*([^@{}\n/][^{}\n]*)\{/gm)].map((m) => m[1].trim()).filter((s) => !/^(from|to|\d+%)/.test(s));
    expect(selectors.length).toBeGreaterThan(20);
    for (const sel of selectors) for (const part of sel.split(",")) expect(part.trim(), part).toMatch(/\.arbor-play/);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
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
