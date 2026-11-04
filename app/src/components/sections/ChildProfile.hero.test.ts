/**
 * GP-15 / RUN-20 — the Profile hub hero's ONE CTA is the surface contract's
 * primary move (`capture-moment` since B-SHELL-26), and the child count is the family's real
 * count. Source pins with the verbatim pre-fix lines as negative controls.
 *
 * v3 F-CHILD-3 re-pin: #/profile is About {child}. The hero is the describe
 * card; the stamp moved from the "Add a fact" drawer door to "Tell Arbor by
 * voice", which opens the ONE guided conversation. The remembered list, the
 * Who chapter and the jump strip left the page (the memory door stays).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SURFACE_CONTRACTS } from "../../lib/surfaceContract";
import { ASPECT_IDS } from "../../lib/aboutAspects";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (raw: string) => raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const src = strip(readFileSync(path.join(here, "ChildProfile.tsx"), "utf8"));
const card = strip(readFileSync(path.join(here, "..", "about", "AspectCard.tsx"), "utf8"));
const memoryCard = strip(readFileSync(path.join(here, "..", "about", "AboutMemoryCard.tsx"), "utf8"));
const aboutCss = readFileSync(path.join(here, "..", "about", "about.css"), "utf8");

/** The describe card, so pins are scoped to the hero. */
const hero = (() => {
  const start = src.indexOf('<section data-module="about-describe"');
  const end = src.indexOf("</section>", start);
  return src.slice(start, end);
})();

describe("GP-15 — the hero CTA is the contract's primary move", () => {
  it("the profile contract's primaryMove is capture-moment", () => {
    const c = SURFACE_CONTRACTS.find((x) => x.route === "profile")!;
    expect(c.primaryMove).toBe("capture-moment");
  });

  it("the stamped control is the one 'Tell Arbor by voice' door, in every state; nothing routes away", () => {
    expect(hero).toContain('data-testid="about-voice"');
    expect(hero).toMatch(/\{\.\.\.CAPTURE_MOVE\}\s+onClick=\{\(\) => openSheet\(null, "voice"\)\}/);
    // one declaration, one spread (framework-check: exactly 1 stamp)
    expect(src).toContain('const CAPTURE_MOVE = { "data-primary-move": "capture-moment" } as const;');
    expect(src.match(/data-primary-move/g)?.length).toBe(1);
    expect(src.match(/\{\.\.\.CAPTURE_MOVE\}/g)?.length).toBe(1);
    expect(src).not.toMatch(/<div[^>]*\{\.\.\.CAPTURE_MOVE\}/);
    expect(hero).toContain('t("companion.about.voice")');
    expect(hero).toContain('t("companion.about.write")');
    // the door is not gated on anything
    expect(hero).not.toContain("!hasPending &&");
    expect(src).not.toMatch(/data-primary-move="[^"]*"[^>]*setActiveTab\("memory"\)/);
    expect(src).not.toContain("APPROVE_MOVE");
    expect(card).not.toContain("data-primary-move");
  });

  // v4 re-pin: About now carries What Arbor remembers (AboutMemoryCard): the
  // proposals NO area shows, with Remember / Not this, and the newest facts.
  // Every decision is still the #/memory seam (handleMemoryDecision), an area
  // still decides its own proposal, and the page has one door to #/memory.
  it("a proposal is decided with the #/memory decision — in its area, or in the memory card when no area shows it; one door to #/memory", () => {
    expect(card).toContain('handleMemoryDecision(pending.memoryId, status)');
    expect(card).toContain('data-testid="about-pending-confirm"');
    expect(card).toContain('data-testid="about-pending-dismiss"');
    expect(memoryCard).toContain("handleMemoryDecision(memoryId, status)");
    expect(memoryCard).toContain("pending.filter((m) => !inAreas.has(m.memoryId))");
    expect(memoryCard).not.toMatch(/fetch\(|\/api\//);
    expect(src).not.toContain('data-testid="profile-remember-keep"');
    expect(src).not.toContain('data-testid="profile-remember-notquite"');
    expect(src).not.toContain('"elev.profile.remember.keep"');
    expect(src).not.toContain('"elev.profile.remember.notQuite"');
    expect(src).not.toMatch(/pendingQueue\.(slice|map)\(/);
    // B-CAREPRO-38: the card's door opens the ledger IN PLACE (#/memory retired into About).
    expect(src).toContain("<AboutMemoryCard areas={aspects} ledgerOpen={ledgerOpen} onLedger={toggleLedger} />");
    expect(memoryCard).toContain('data-testid="profile-remember-check"');
    expect(memoryCard).toContain('onClick={() => (onLedger ? onLedger() : setActiveTab("memory"))}');
  });

  it("NEGATIVE CONTROL: the pre-fix 'Add a family member' CTA is gone from the hero", () => {
    const old = 'label: t("elev.hero.profile.cta"),';
    expect(old).toMatch(/elev\.hero\.profile\.cta/); // the fixture is the banned shape
    expect(hero).not.toContain(old);
    expect(src).not.toMatch(/setActiveTab\("sharing"\)/);
  });
});

describe("GP-15 — the child count is the family's real count", () => {
  // W2-GROWTH r1: the telemetry row (children · members · moments) is CUT —
  // no count can be a literal because no count is printed.
  it("the page prints no family/moment counts at all", () => {
    expect(src).not.toContain("elev.wave2Knowledge.profile.child");
    expect(src).not.toContain("elev.wave2Knowledge.profile.member");
    expect(src).not.toContain("elev.wave2Knowledge.profile.moment");
  });

  it("NEGATIVE CONTROL: the literal `1` stat is gone", () => {
    const old = '{ value: 1, label: t("elev.stat.children") }';
    expect(/value:\s*1,\s*label:\s*t\("elev\.stat\.children"\)/.test(old)).toBe(true);
    expect(src).not.toMatch(/value:\s*1,\s*label:\s*t\("elev\.stat\.children"\)/);
  });
});

describe("GP-26 / IA-09 — the strengths leaf lives in About's strengths area", () => {
  // #/strengths resolves to this hub; its content is the strengths area, and
  // nothing links away to a copy of it.
  it("the strengths area owns the content, and nothing links to #/strengths", () => {
    expect(src).not.toMatch(/setActiveTab\("strengths"\)/);
    expect(ASPECT_IDS).toContain("strengths");
    expect(src).toContain("<AspectCard");
  });
});

describe("W2 — a useful identity header", () => {
  it("has one route h1, no empty identity banner or duplicate PageHeader", () => {
    expect(src.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(src).not.toContain("<PageHeader");
    expect(src).not.toContain('h-[90px]');
    expect(hero).toContain('<h1 id="about-title">');
  });
  it("keeps edit and the existing drawer creation seam reachable from Details", () => {
    const details = src.slice(src.indexOf('data-module="about-details"'));
    expect(details).toContain('t("companion.about.detailsEdit")');
    expect(hero).not.toContain("!hasHero");
    expect(details.indexOf("!hasHero")).toBeGreaterThan(-1);
    const create = details.slice(details.indexOf("!hasHero"), details.indexOf("!hasHero") + 400);
    // F-TALK-1 (v3 integration): the Ask door that opened the conversation panel
    // lived in the footer jump strip, which F-CHILD-3 removed from About. Its
    // guarantee holds for the whole page: nothing here routes to the coach page.
    expect(src).not.toContain('setActiveTab("coach")');
    expect(src).not.toMatch(/tab:\s*"coach"/);
    expect(create).toContain("setEditingProfile(true)");
    expect(create).not.toContain('setActiveTab("profile")');
    expect(src).toContain("<ProfileEditDrawer");
  });
});

describe("B-SHELL-27 — one face on My Child", () => {
  it("the Details picture and the Create-hero gate read lib/childPicture (never the plant beside a hero)", () => {
    expect(src).toContain('import { asksForHero, childPicture } from "../../lib/childPicture";');
    expect(src).toContain("const hasHero = !asksForHero(childProfile);");
    expect(src).toMatch(/\{!hasHero && <button[^>]*>[\s\S]{0,200}cp\.hero\.create/);
    expect(src).not.toMatch(/const \{ hasHero[^}]*\} = useHeroAvatar\(\)/);
  });
  it("the art panel shows only a hero render or the initial — never an uploaded photo", () => {
    expect(hero).toContain('picture.kind === "hero" && picture.url');
    expect(hero).toContain("picture.initial");
  });
});

describe("NEXTLEVEL critic r1 (profile · design · P1) — one weight for the fact quote in both locales", () => {
  const css = readFileSync(path.join(here, "..", "..", "index.css"), "utf8");
  it("the quoted fact is the editorial face at weight 400", () => {
    expect(card).toMatch(/<p className="about-aspect-quote"[^>]*><FreeText text=\{known\.words\} \/><\/p>/);
    expect(aboutCss).toMatch(/\.about-aspect-quote \{[^}]*font-family: var\(--font-editorial\);[^}]*font-weight: 400;/);
  });
  it("on a Hebrew page Latin runs take Instrument Serif first; Hebrew falls through to Frank Ruhl Libre (both HE scopes)", () => {
    const he = css.match(/--font-editorial: [^;]*Frank Ruhl Libre[^;]*;/g) ?? [];
    expect(he.length).toBe(2);
    for (const decl of he) expect(decl).toBe(`--font-editorial: 'Instrument Serif', "Frank Ruhl Libre", "Heebo", Georgia, serif;`);
  });
});
