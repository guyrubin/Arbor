/**
 * GP-15 / RUN-20 — the Profile hub hero's ONE CTA is the surface contract's
 * primary move (`approve-memory`), and the child count is the family's real
 * count. Source pins with the verbatim pre-fix lines as negative controls.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SURFACE_CONTRACTS } from "../../lib/surfaceContract";

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(path.join(here, "ChildProfile.tsx"), "utf8");
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** The hero's <HubHero … /> block, so pins are scoped to the CTA/stats. */
const hero = (() => {
  const start = src.indexOf("<HubHero");
  const end = src.indexOf('testId="profile-hub-hero"', start);
  return src.slice(start, end);
})();

describe("GP-15 — the hero CTA is the contract's primary move", () => {
  it("the profile contract's primaryMove is approve-memory", () => {
    const c = SURFACE_CONTRACTS.find((x) => x.route === "profile")!;
    expect(c.primaryMove).toBe("approve-memory");
  });

  it("with pending proposals the CTA reviews what Arbor remembers (→ memory); otherwise it adds a fact", () => {
    expect(hero).toMatch(/pendingMemoryItems\.length > 0\s*\?/);
    expect(hero).toContain('t("elev.growthTruth.profile.cta.review")');
    expect(hero).toMatch(/onClick: \(\) => setActiveTab\("memory"\)/);
    expect(hero).toContain('t("elev.growthTruth.profile.cta.addFact", { name: first })');
    expect(hero).toMatch(/onClick: \(\) => setEditingProfile\(true\)/);
    expect(hero).toContain('testId: "profile-hero-cta"');
  });

  it("NEGATIVE CONTROL: the pre-fix 'Add a family member' CTA is gone from the hero", () => {
    const old = 'label: t("elev.hero.profile.cta"),';
    expect(old).toMatch(/elev\.hero\.profile\.cta/); // the fixture is the banned shape
    expect(hero).not.toContain(old);
    expect(hero).not.toMatch(/onClick: \(\) => setActiveTab\("sharing"\)/);
  });
});

describe("GP-15 — the child count is the family's real count", () => {
  it("reads profiles.length from useProfile()", () => {
    expect(src).toMatch(/const \{ profiles \} = useProfile\(\);/);
    expect(hero).toMatch(/\{ value: profiles\.length, label: t\("elev\.stat\.children"\) \}/);
  });

  it("NEGATIVE CONTROL: the literal `1` stat is gone", () => {
    const old = '{ value: 1, label: t("elev.stat.children") }';
    expect(/value:\s*1,\s*label:\s*t\("elev\.stat\.children"\)/.test(old)).toBe(true);
    expect(hero).not.toMatch(/value:\s*1,\s*label:\s*t\("elev\.stat\.children"\)/);
  });
});

describe("GP-26 / IA-09 — the strengths leaf has one live door from the Development Profile", () => {
  it("chapter 4 links to #/strengths", () => {
    expect(src).toMatch(/setActiveTab\("strengths"\)/);
    expect(src).toContain('t("elev.growthTruth.profile.openStrengths")');
  });
});
