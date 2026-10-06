/**
 * GP-15 / RUN-20 — the Profile hub hero's ONE CTA is the surface contract's
 * primary move (`capture-moment` since B-SHELL-26), and the child count is the family's real
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
  // B-SHELL-26 (framer default): the review queue is gone; the hub's one move
  // is telling Arbor one thing — capture-moment on the "Add a fact" door.
  it("the profile contract's primaryMove is capture-moment", () => {
    const c = SURFACE_CONTRACTS.find((x) => x.route === "profile")!;
    expect(c.primaryMove).toBe("capture-moment");
  });

  it("the stamped control is the one 'Add a fact' door, in every state; nothing routes away", () => {
    expect(hero).toContain('data-testid="profile-hero-cta"');
    expect(hero).toMatch(/\{\.\.\.CAPTURE_MOVE\}\s+onClick=\{\(\) => setEditingProfile\(true\)\}/);
    // one declaration, one spread (framework-check: exactly 1 stamp)
    expect(src).toContain('const CAPTURE_MOVE = { "data-primary-move": "capture-moment" } as const;');
    expect(src.match(/data-primary-move/g)?.length).toBe(1);
    expect(src.match(/\{\.\.\.CAPTURE_MOVE\}/g)?.length).toBe(1);
    expect(src).not.toMatch(/<div[^>]*\{\.\.\.CAPTURE_MOVE\}/);
    expect(hero).toContain('t("elev.growthTruth.profile.cta.addFact", { name: first })');
    expect(hero).toContain('t("elev.profile.knows.empty", { name: first })');
    // the door is not gated on an empty queue any more
    expect(hero).not.toContain("!hasPending &&");
    expect(src).not.toMatch(/data-primary-move="[^"]*"[^>]*setActiveTab\("memory"\)/);
    expect(src).not.toContain("APPROVE_MOVE");
  });

  it("B-SHELL-26: Profile lists what Arbor remembers with Forget only — no Keep, no 'Not quite', no queue", () => {
    const band = src.slice(src.indexOf('data-module="profile-remember"'), src.indexOf("</section>", src.indexOf('data-module="profile-remember"')));
    expect(band).toContain('t("elev.profile.remembers.title")');
    expect(band).toContain('data-testid="profile-remembered-forget"');
    expect(band).toContain('handleMemoryDecision(m.memoryId, "deleted")');
    expect(src).not.toContain('data-testid="profile-remember-keep"');
    expect(src).not.toContain('data-testid="profile-remember-notquite"');
    expect(src).not.toContain('"elev.profile.remember.keep"');
    expect(src).not.toContain('"elev.profile.remember.notQuite"');
    expect(src).not.toContain('"elev.profile.remember.title"');
    // an inference waiting is ONE quiet line to #/memory, never a list here
    expect(band).toContain('data-testid="profile-remember-check"');
    expect(band).not.toMatch(/pendingQueue\.(slice|map)\(/);
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

describe("NEXTLEVEL critic r1 (profile · design · P1) — one weight for the fact quote in both locales", () => {
  const css = readFileSync(path.join(here, "..", "..", "index.css"), "utf8");
  it("the remembered fact is the editorial face at weight 400", () => {
    // B-SHELL-26: the remembered list row — same face and weight; the B-GROWTH-35
    // written-date prefix precedes the parent's words.
    expect(src).toMatch(/style=\{\{ fontFamily: "var\(--font-editorial\)", fontWeight: 400, fontSize: "var\(--t-md\)", color: "var\(--arbor-ink\)" \}\}>\s*\{writtenPrefix\(toParentWords\(m\.fact\), m\.createdAt\)\}<FreeText text=\{toParentWords\(m\.fact\)\} \/>/);
  });
  it("on a Hebrew page Latin runs take Instrument Serif first; Hebrew falls through to Frank Ruhl Libre (both HE scopes)", () => {
    const he = css.match(/--font-editorial: [^;]*Frank Ruhl Libre[^;]*;/g) ?? [];
    expect(he.length).toBe(2);
    for (const decl of he) expect(decl).toBe(`--font-editorial: 'Instrument Serif', "Frank Ruhl Libre", "Heebo", Georgia, serif;`);
  });
});
