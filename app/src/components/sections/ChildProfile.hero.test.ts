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
  const start = src.indexOf("<header data-module=\"profile-identity\"");
  const end = src.indexOf("</header>", start);
  return src.slice(start, end);
})();

describe("GP-15 — the hero CTA is the contract's primary move", () => {
  it("the profile contract's primaryMove is approve-memory", () => {
    const c = SURFACE_CONTRACTS.find((x) => x.route === "profile")!;
    expect(c.primaryMove).toBe("approve-memory");
  });

  // W2-GROWTH r1 / B-GROWTH-NEW-1E: the move is PERFORMED here. With pending
  // facts the stamp sits on the first Keep (handleMemoryDecision "approved");
  // with none it sits on the one "tell Arbor one thing" control (edit drawer).
  // Never again a button that routes away and calls itself approve-memory.
  it("with pending facts the stamped control is Keep on this page; otherwise it adds a fact", () => {
    const band = src.slice(src.indexOf('data-module="profile-remember"'), src.indexOf("</section>", src.indexOf('data-module="profile-remember"')));
    expect(band).toContain('data-testid="profile-remember-keep"');
    expect(band).toContain("{...(i === 0 ? APPROVE_MOVE : {})}");
    expect(band).toContain('void decide(m.memoryId, "approved")');
    expect(src).toMatch(/const ok = await handleMemoryDecision\(memoryId, status\);/);
    expect(hero).toContain('data-testid="profile-hero-cta"');
    expect(hero).toMatch(/\{\.\.\.APPROVE_MOVE\}\s+onClick=\{\(\) => setEditingProfile\(true\)\}/);
    // one declaration, spread into the three mutually exclusive states (framework-check: exactly 1 stamp)
    expect(src).toContain('const APPROVE_MOVE = { "data-primary-move": "approve-memory" } as const;');
    expect(src.match(/data-primary-move/g)?.length).toBe(1);
    expect(src).not.toMatch(/<div[^>]*\{\.\.\.APPROVE_MOVE\}/);
    expect(hero).toContain('t("elev.growthTruth.profile.cta.addFact", { name: first })');
    // no stamped control routes away
    expect(src).not.toMatch(/data-primary-move="approve-memory"[^>]*setActiveTab\("memory"\)/);
    expect(src).not.toMatch(/<div[^>]*data-primary-move="approve-memory"/);
  });

  it("NEGATIVE CONTROL: the pre-fix 'Add a family member' CTA is gone from the hero", () => {
    const old = 'label: t("elev.hero.profile.cta"),';
    expect(old).toMatch(/elev\.hero\.profile\.cta/); // the fixture is the banned shape
    expect(hero).not.toContain(old);
    expect(hero).not.toMatch(/onClick: \(\) => setActiveTab\("sharing"\)/);
  });
});

describe("GP-15 — the child count is the family's real count", () => {
  // W2-GROWTH r1: the telemetry row (children · members · moments) is CUT from
  // the identity band — no count can be a literal because no count is printed.
  it("the identity band prints no family/moment counts at all", () => {
    expect(hero).not.toContain("elev.wave2Knowledge.profile.child");
    expect(hero).not.toContain("elev.wave2Knowledge.profile.member");
    expect(hero).not.toContain("elev.wave2Knowledge.profile.moment");
  });

  it("NEGATIVE CONTROL: the literal `1` stat is gone", () => {
    const old = '{ value: 1, label: t("elev.stat.children") }';
    expect(/value:\s*1,\s*label:\s*t\("elev\.stat\.children"\)/.test(old)).toBe(true);
    expect(hero).not.toMatch(/value:\s*1,\s*label:\s*t\("elev\.stat\.children"\)/);
  });
});

describe("GP-26 / IA-09 — the strengths leaf is retired into Profile chapter 4", () => {
  // This block previously asserted the interim fix: give the orphaned
  // `#/strengths` leaf its one missing door. The item's actual decision is the
  // opposite and supersedes it — the leaf WAS chapter 4, and its only entry
  // point was a link inside that same chapter, so the door led out of a room
  // and back into it. The hash now resolves to this hub
  // (lib/routes.ts RETIRED_ROUTES, covered by routes.test.ts), and the content
  // assertions live in components/sections/profileMemoryOrder.test.ts.
  it("chapter 4 owns the content, and no longer links away to a copy of itself", () => {
    expect(src).not.toMatch(/setActiveTab\("strengths"\)/);
    expect(src).toContain('t("cp.ch.strengths")');
    expect(src).toContain('t("cp.ch.support")');
  });
});

describe("W2 — a useful identity header", () => {
  it("has one route h1, no empty identity banner or duplicate PageHeader", () => {
    expect(src.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(src).not.toContain("<PageHeader");
    expect(src).not.toContain('h-[90px]');
    expect(src.indexOf('data-module="profile-who"')).toBeLessThan(src.indexOf('t("cp.family.title")'));
  });
  it("keeps edit, Ask, and the existing drawer creation seam reachable", () => {
    // W2-GROWTH r2: Ask Arbor is a door in the jump strip, not a header action.
    expect(src).toContain('{ tab: "coach" as const');
    const header = src.slice(src.indexOf('data-module="profile-identity"'), src.indexOf("</header>"));
    expect(header).toBeTruthy();
    expect(header).not.toContain('"coach"');
    expect(header).not.toContain("!hasHero");
    expect(src).toContain('t("elev.wave2Knowledge.profile.edit")');
    // Create hero lives in the Who chapter now (W2-GROWTH r2).
    const who = src.slice(src.indexOf('data-module="profile-who"'));
    expect(who.indexOf("!hasHero")).toBeGreaterThan(-1);
    const create = who.slice(who.indexOf("!hasHero"), who.indexOf("!hasHero") + 400);
    expect(create).toContain("setEditingProfile(true)");
    expect(create).not.toContain('setActiveTab("profile")');
    expect(src).toContain("<ProfileEditDrawer");
  });
});

describe("B-SHELL-27 — one face on My Child", () => {
  it("the identity picture and the Create-hero gate read lib/childPicture (never the plant beside a hero)", () => {
    expect(src).toContain('import { asksForHero, childPicture } from "../../lib/childPicture";');
    expect(src).toContain("const hasHero = !asksForHero(childProfile);");
    expect(src).toMatch(/\{!hasHero && <button[^>]*>[\s\S]{0,200}cp\.hero\.create/);
    expect(src).not.toMatch(/const \{ hasHero[^}]*\} = useHeroAvatar\(\)/);
  });
});
