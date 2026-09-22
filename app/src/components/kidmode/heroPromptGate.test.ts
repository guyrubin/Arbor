/**
 * M4 — the one parent-side step before Kid Mode (kids gauntlet, 22 Sep 2026).
 *
 * Two guarantees, both of which a child pays for if they break:
 *  1. the step appears ONLY when the active child has no hero, and only ONCE
 *     per session per child — hand-over must never become a nag;
 *  2. the child is never blocked: "Continue with Sprout" enters Kid Mode as
 *     today, and nothing about this step is reachable from inside Kid Mode.
 *
 * Storage is a Map-backed fake (the lib/kidModeGate pattern), so nothing here
 * depends on a browser.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KidModeStorage } from "../../lib/kidModeGate";
import {
  HERO_STEP_SS_KEY,
  markHeroStepOffered,
  resetHeroStepMemory,
  shouldOfferHeroStep,
  wasHeroStepOffered,
} from "./heroPromptGate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, "..", ...p), "utf8");

function fakeStorage(seed: Record<string, string> = {}): KidModeStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

beforeEach(() => resetHeroStepMemory());

describe("heroPromptGate — when the hero step is offered", () => {
  it("offers it for a child with NO hero", () => {
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: false }, fakeStorage())).toBe(true);
  });

  it("never offers it for a child who already has a hero", () => {
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: true }, fakeStorage())).toBe(false);
  });

  it("offers it once per session, then stops (no nag on the next hand-over)", () => {
    const storage = fakeStorage();
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: false }, storage)).toBe(true);
    markHeroStepOffered("c1", storage);
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: false }, storage)).toBe(false);
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: false }, storage)).toBe(false);
  });

  it("is per CHILD — a sibling with no hero is still offered the step", () => {
    const storage = fakeStorage();
    markHeroStepOffered("c1", storage);
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: false }, storage)).toBe(false);
    expect(shouldOfferHeroStep({ childId: "c2", hasHero: false }, storage)).toBe(true);
  });

  it("a fresh session forgets the offer (sessionStorage, not a stored decision)", () => {
    const storage = fakeStorage();
    markHeroStepOffered("c1", storage);
    resetHeroStepMemory();
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: false }, fakeStorage())).toBe(true);
  });

  it("writes ONE session key and nothing about the child beyond their id", () => {
    const storage = fakeStorage();
    markHeroStepOffered("c1", storage);
    expect([...storage.map.keys()]).toEqual([HERO_STEP_SS_KEY]);
    expect(storage.map.get(HERO_STEP_SS_KEY)).toBe(JSON.stringify(["c1"]));
  });

  it("garbage or blocked storage never blocks hand-over", () => {
    expect(wasHeroStepOffered("c1", fakeStorage({ [HERO_STEP_SS_KEY]: "{{{" }))).toBe(false);
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: false }, null)).toBe(true);
    // No child id at all (nothing loaded yet) → straight into Kid Mode.
    expect(shouldOfferHeroStep({ childId: "", hasHero: false }, fakeStorage())).toBe(false);
    expect(shouldOfferHeroStep({ childId: null, hasHero: false }, fakeStorage())).toBe(false);
  });

  it("suppresses the nag even when sessionStorage cannot be written (memory mirror)", () => {
    markHeroStepOffered("c1", null);
    expect(shouldOfferHeroStep({ childId: "c1", hasHero: false }, null)).toBe(false);
  });
});

describe("heroPromptGate — how the Kid Mode button uses it", () => {
  const button = read("layout", "KidModeButton.tsx");

  it("asks the gate with the HERO-FIRST rule, never a re-implementation of it", () => {
    expect(button).toContain('import { resolveHeroUrl } from "../ui/HeroAvatar"');
    expect(button).toMatch(/shouldOfferHeroStep\(\{ childId: child\.id, hasHero: Boolean\(resolveHeroUrl\(child\)\) \}\)/);
    // resolveHeroUrl is read, never redefined here.
    expect(button).not.toMatch(/const resolveHeroUrl|function resolveHeroUrl/);
  });

  it("records the offer when the step is shown, so it is asked once either way", () => {
    expect(button).toMatch(/markHeroStepOffered\(child\.id\);\s*\n\s*setStepOpen\(true\)/);
  });

  it("a child WITH a hero still goes straight into Kid Mode", () => {
    // The early return is the only branch that skips openKidMode().
    expect(button).toMatch(/setStepOpen\(true\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*onBeforeOpen\?\.\(\);\s*\n\s*openKidMode\(\);/);
  });

  it("the step hands over to Kid Mode itself — the child is never blocked", () => {
    expect(button).toMatch(/const enterKidMode = \(\) => \{ setStepOpen\(false\); onBeforeOpen\?\.\(\); openKidMode\(\); \}/);
    expect(button).toContain("onEnterKidMode={enterKidMode}");
  });
});

describe("HeroFirstStep — parent register, never inside Kid Mode", () => {
  const step = read("kidmode", "HeroFirstStep.tsx");

  it("is mounted by the parent-shell button only (not by the Kid Mode overlay)", () => {
    expect(read("kidmode", "KidModeOverlay.tsx")).not.toContain("HeroFirstStep");
    expect(read("layout", "KidModeButton.tsx")).toContain("<HeroFirstStep");
  });

  it("offers BOTH doors: create a hero, or continue with Sprout", () => {
    expect(step).toContain('t("elev.hero.step.create"');
    expect(step).toContain('t("elev.hero.step.continue")');
    expect(step).toMatch(/onClick=\{onEnterKidMode\}/);
  });

  it("reuses the existing creator and the existing gate wording family", () => {
    expect(step).toContain('import AvatarCreator from "../profile/AvatarCreator"');
    expect(step).toContain('t("elev.hero.step.title"');
    // Same phrasing as the ComicsTab / HeroJourneyTab gates, from the registry.
    const en = read("..", "lib", "i18nElevation", "heroCreate.ts");
    expect(en).toContain('"elev.hero.step.title": "First, create {name}\'s hero"');
  });

  it("carries no raw possessive or hand-rolled colour (register + token floors)", () => {
    expect(step).not.toMatch(/\$\{[^}]*name[^}]*\}'s/i);
    expect(step).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(step).not.toMatch(/rgba\(/);
  });
});
