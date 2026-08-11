/**
 * Trust Center page guard — masterplan 3.3/3.4/3.1 (Maytal Row-2, six frames).
 * SOURCE scan of SciencePage.tsx (Screening.firewall.test.ts style; node env).
 *
 * Asserts:
 *  1. The six-section Trust Center IA is present (how/data/signs/not/sources/more)
 *     with the hub quick-nav (Maytal frame 6).
 *  2. Analytics: track("trustcenter_open") + track("trustcenter_section", {id}).
 *  3. FIREWALL: no banned verdict/trend vocabulary in the page source (both
 *     languages), no graded tone pairs, no alarm-colored X-list (muted close
 *     glyphs only — a red "needs attention" tier must not be invented).
 *  4. PRESERVATION: all six AP-060 citations, the verbatim disclaimer/hero/
 *     board renders, the ASQ-3 hold and the stat tiles survive the rebuild.
 *  5. GD-10 fail-closed: "Reviewed by"/"expert team" exist ONLY inside the
 *     commented seam — nothing renders a reviewer claim.
 *  6. Deep-link validity: every setActiveTab target is a real ROUTE_IDS route.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_IDS } from "../../lib/routes";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "SciencePage.tsx"), "utf8");

describe("trust center — six-section IA + hub nav", () => {
  const sections = ["how", "data", "signs", "not", "sources", "more"] as const;

  it("renders all six section anchors", () => {
    for (const id of sections) {
      expect(src, `missing trust-section-${id}`).toContain(`data-testid="trust-section-${id}"`);
      expect(src, `missing DOM anchor trust-${id}`).toContain(`id="trust-${id}"`);
    }
  });

  it("renders the hub quick-nav (Maytal frame 6 listing)", () => {
    expect(src).toContain('data-testid="trust-hub-nav"');
    expect(src).toContain("trust-nav-");
  });

  it("resolves copy from i18nElevation/trustcenter (module-local, en+he)", () => {
    expect(src).toContain('from "../../lib/i18nElevation/trustcenter"');
    expect(src).toContain("elev.trust.");
  });

  it("mounts the lock line and the SpineRibbon (3.3: the spine lives here too)", () => {
    expect(src).toContain('data-testid="trust-lock-line"');
    expect(src).toContain('elev.trust.how.lock');
    expect(src).toMatch(/<SpineRibbon\b/);
    expect(src).toContain('elev.trust.spine');
  });
});

describe("trust center — analytics", () => {
  it('fires track("trustcenter_open") once (ref-guarded)', () => {
    expect(src).toContain('track("trustcenter_open")');
    expect(src).toMatch(/opened\.current\s*=\s*true/);
  });
  it('fires track("trustcenter_section", { id }) on section navigation', () => {
    expect(src).toContain('track("trustcenter_section", { id })');
  });
});

describe("trust center — firewall (page source)", () => {
  // Banned verdict/trend/graded vocabulary, both languages. The page's own
  // source must be clean everywhere — the ONLY sanctioned occurrences live in
  // the i18n module's `.never` negation keys (tested in trustcenter.test.ts).
  const BANNED = ["score", "on track", "high risk", "ציון", "אחוז", "סיכון גבוה", "%"];
  // Fold Hebrew final letters so inflected forms ("ציונים") can't slip past.
  const FINALS: Record<string, string> = { "ן": "נ", "ם": "מ", "ך": "כ", "ף": "פ", "ץ": "צ" };
  const norm = (s: string) => s.toLowerCase().replace(/[ןםךףץ]/g, (c) => FINALS[c]);
  for (const token of BANNED) {
    it(`page source does not contain "${token}"`, () => {
      expect(norm(src).includes(norm(token)), `found banned token "${token}"`).toBe(false);
    });
  }

  it("X-list uses muted close glyphs — never alarm colors or graded tones", () => {
    expect(src).toContain('name="close"');
    expect(src).not.toContain("--arbor-danger");
    expect(src).not.toMatch(/tone="yellow"|tone="pink"/);
    // No conditional graded tone pair anywhere (the UND-1 survivor pattern).
    expect(src).not.toMatch(/\?\s*["']yellow["']\s*:\s*["']mint["']|\?\s*["']mint["']\s*:\s*["']yellow["']/);
  });
});

describe("trust center — AP-060 content preserved (never delete factual content)", () => {
  const URLS = [
    "https://www.cdc.gov/ncbddd/actearly/milestones/index.html",
    "https://www.aap.org/en/patient-care/developmental-surveillance-and-screening/",
    "https://www.asha.org/public/speech/development/",
    "https://www.who.int/health-topics/child-development",
    "https://www.drdansiegel.com/books/the-whole-brain-child/",
    "https://www.gottman.com/blog/raising-an-emotionally-intelligent-child/",
  ];
  it("all six citation URLs survive, under the sources section", () => {
    for (const url of URLS) expect(src, `citation lost: ${url}`).toContain(url);
  });

  it("verbatim firewall strings still render: disclaimer, hero, board note", () => {
    expect(src).toContain('t("sci.disclaimer")');
    expect(src).toContain('t("sci.hero.line")');
    expect(src).toContain('t("sci.board.note")');
    expect(src).toContain('data-testid="science-disclaimer"');
    expect(src).toContain('data-testid="science-hero-line"');
    expect(src).toContain('data-testid="science-board-note"');
  });

  it("ASQ-3 hold + citation notes + stat tiles survive", () => {
    expect(src).toContain('t("sci.asq3.mention")');
    expect(src).toContain('t("sci.cdc.framework")');
    expect(src).toMatch(/StatTile value="133"/);
    expect(src).not.toMatch(/ages-and-stages|asq3?\.com|agesandstages/i);
  });
});

describe("trust center — GD-10 fail-closed (no reviewer claims)", () => {
  // The seam comment may name the future row; NOTHING outside it may.
  const seamStart = src.indexOf("GD-10 SEAM");
  const seamEnd = src.indexOf("*/", seamStart);
  const outsideSeam = src.slice(0, seamStart) + src.slice(seamEnd);

  it("the commented GD-10 seam exists in the sources section", () => {
    expect(seamStart).toBeGreaterThan(-1);
    expect(seamEnd).toBeGreaterThan(seamStart);
  });

  it('"Reviewed by" and "expert team" appear ONLY inside the seam comment', () => {
    expect(outsideSeam.toLowerCase()).not.toContain("reviewed by");
    expect(outsideSeam.toLowerCase()).not.toContain("expert team");
    expect(outsideSeam).not.toContain("צוות מומחים");
  });
});

describe("trust center — deep-link validity", () => {
  it("every setActiveTab target is a registered route id", () => {
    const targets = [...src.matchAll(/setActiveTab\("([a-z-]+)"\)/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(ROUTE_IDS.includes(target as (typeof ROUTE_IDS)[number]), `dead route: ${target}`).toBe(true);
    }
  });

  it("links land on the intended surfaces: Profile (data controls) + Consult (contact)", () => {
    expect(src).toContain('setActiveTab("profile")');
    expect(src).toContain('setActiveTab("consult")');
  });
});
