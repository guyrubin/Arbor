import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DOMAIN_META } from "../practice/content";
import { DOMAINS, DOMAIN_COUNT } from "./domains/registry";
import { translate } from "./i18n";
import { resolvePlural } from "../context/LanguageContext";
import { ALL_MILESTONES, MILESTONE_AGE_BANDS, ageWindowMilestones } from "./milestoneData";
import { domainCountsIn } from "./domainCount";

/* OBJ-GROWTH-01 — one screen, four different answers to "how many areas does
   Arbor track": the Development hero said "1 areas (of 7)" from a hard-coded
   literal in the dictionary, six domain rows rendered beneath it, the Full
   Picture teaser said "5 areas covered", and #/science said "7 developmental
   domains". The count is now derived from DOMAIN_META everywhere it is named.

   Guarded structurally rather than by render, because the number's source is
   the point: a render test passes just as happily against a second hard-coded
   literal. */

const SRC = path.resolve(__dirname, "..");
const read = (...rel: string[]) => readFileSync(path.join(SRC, ...rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("OBJ-GROWTH-01 — one domain count, derived once", () => {
  it("the dictionary no longer carries a literal total in either language", () => {
    const growth = read("lib", "i18nElevation", "growth.ts");
    for (const line of growth.split("\n").filter((l) => l.includes("elev.hero.growth.stat.domains"))) {
      expect(line).not.toMatch(/\d/);
      expect(line).toContain("{total}");
    }
  });

  it("EN and HE both interpolate the count and read singular at 1", () => {
    const t = (lang: "en" | "he", vars: Record<string, string | number>) =>
      resolvePlural(lang, translate(lang, "elev.hero.growth.stat.domains", vars), vars);
    const total = DOMAIN_COUNT;
    for (const lang of ["en", "he"] as const) {
      expect(t(lang, { n: 1, total })).toContain(String(total));
      expect(t(lang, { n: total, total })).toContain(String(total));
    }
    expect(t("en", { n: 1, total })).toBe(`area of ${total}`);
    expect(t("en", { n: 3, total })).toBe(`areas of ${total}`);
  });

  /* B-GROWTH-01 — the hero's numerator counted DevelopmentalDomainId over ALL
     checked milestones (six ids) while the denominator was DOMAIN_META (five
     PracticeDomains): "6 areas of 5" was reachable. Both now derive from the
     SAME ageWindowMilestones(...) array, so n ≤ total by construction. */
  describe("B-GROWTH-01 — hero numerator and denominator share one array", () => {
    const dev = stripComments(read("components", "tabs", "DevelopmentTab.tsx"));

    it("source scan: both numbers come from the one windowed array", () => {
      expect(dev).toMatch(/const inWindow = ageWindowMilestones\(milestones, comparisonMonths\);/);
      expect(dev).toMatch(/const \{ active: domainsActive, total: domainsTotal \} = domainCountsIn\(inWindow\);/);
      expect(dev).toMatch(/elev\.hero\.growth\.stat\.domains[^)]*n: heroStats\.domainsActive, total: heroStats\.domainsTotal/);
      // the second vocabulary is gone from this surface
      expect(dev).not.toContain("DOMAIN_META");
      expect(dev).not.toContain("DOMAIN_COUNT");
      expect(dev).not.toMatch(/milestones\.filter\(\(m\) => m\.checked\)\.map\(\(m\) => m\.domain\)/);
      const helper = stripComments(read("lib", "domainCount.ts"));
      expect(helper).toContain("new Set(inWindow.map((m) => m.domain)).size");
      expect(helper).toContain("new Set(inWindow.filter((m) => m.checked).map((m) => m.domain)).size");
    });

    it("the Full Picture teaser renders without a number in EN and HE", () => {
      expect(dev).toContain('{t("elev.fullpicture.card.teaser")}');
      for (const lang of ["en", "he"] as const) {
        const s = translate(lang, "elev.fullpicture.card.teaser", {});
        expect(s).not.toBe("elev.fullpicture.card.teaser");
        expect(s).not.toMatch(/\d|\{n\}/);
      }
    });

    it("property: n ≤ total at every catalogue band age (2–72 m), any check pattern", () => {
      expect(MILESTONE_AGE_BANDS.length).toBe(13);
      for (const { months } of MILESTONE_AGE_BANDS) {
        const window = ageWindowMilestones(ALL_MILESTONES, months);
        for (const pattern of [() => true, () => false, (i: number) => i % 2 === 0, (i: number) => i % 3 === 1]) {
          const marked = window.map((m, i) => ({ ...m, checked: pattern(i) }));
          const { active, total } = domainCountsIn(marked);
          expect(active, `${months} m`).toBeLessThanOrEqual(total);
        }
        // a checked milestone OUTSIDE the window never inflates the numerator
        const outside = ALL_MILESTONES.map((m) => ({ ...m, checked: !window.includes(m) }));
        const { active } = domainCountsIn(ageWindowMilestones(outside, months));
        expect(active).toBe(0);
      }
    });

    it("a 5-year-old with every window milestone checked reads \"6 areas of 6\" (EN) and HE", () => {
      const all = ageWindowMilestones(ALL_MILESTONES, 60).map((m) => ({ ...m, checked: true }));
      const { active, total } = domainCountsIn(all);
      expect([active, total]).toEqual([6, 6]);
      const vars = { n: active, total };
      expect(`${active} ${resolvePlural("en", translate("en", "elev.hero.growth.stat.domains", vars), vars)}`).toBe("6 areas of 6");
      const he = resolvePlural("he", translate("he", "elev.hero.growth.stat.domains", vars), vars);
      expect(he).toContain("6");
      expect(he).not.toMatch(/\{(total|plural)\}/);
    });

    it("NEGATIVE CONTROL — the pre-fix shape (all-checked numerator over DOMAIN_META) breaks n ≤ total", () => {
      const all = ALL_MILESTONES.map((m) => ({ ...m, checked: true }));
      const preFixNumerator = new Set(all.filter((m) => m.checked).map((m) => m.domain)).size;
      expect(preFixNumerator).toBeGreaterThan(Object.keys(DOMAIN_META).length);
    });
  });

  it("B-GROWTH-26: DOMAIN_COUNT is the registry's length — 8 domains (Guy D1)", () => {
    expect(DOMAIN_COUNT).toBe(DOMAINS.length);
    expect(DOMAIN_COUNT).toBe(8);
  });

  it("the remaining surfaces derive the total from the registry's DOMAIN_COUNT, never a literal", () => {
    const sci = stripComments(read("components", "tabs", "SciencePage.tsx"));
    expect(sci).toContain('value={String(DOMAIN_COUNT)} label={t("sci.stat.domains")}');
    expect(sci).toContain('import { DOMAINS, DOMAIN_COUNT, domainName } from "../../lib/domains/registry";');
    expect(sci).not.toMatch(/value="7"\s+label=\{t\("sci\.stat\.domains"\)\}/);

    // The Full Picture's own domain list already walks the same source.
    const copilot = stripComments(read("components", "practice", "DevelopmentCopilot.tsx"));
    expect(copilot).toContain('domainLabel("practice", b.domain, t)');
  });

  /* R1 (round-1 rejection) — the derivation landed but two of the three
     rendered surfaces still disagreed with it in the running app: the Full
     Picture teaser resolved through the module-local `tFP`, which interpolates
     {var} but cannot resolve {plural}; the Copilot's two pulse tiles printed a
     bare, hard-coded English "0 domains" with no total behind it; and the
     professional preview — which the PARENT reads — printed "0 domain(s)."
     All four now name DOMAIN_COUNT and resolve their own plural. */
  describe("R1 — the rendered strings name the same total", () => {
    const dev = stripComments(read("components", "tabs", "DevelopmentTab.tsx"));
    const copilot = stripComments(read("components", "practice", "DevelopmentCopilot.tsx"));
    const fp = read("lib", "i18nElevation", "fullpicture.ts");

    it("the teaser resolves through the shared t(), not the local tFP", () => {
      expect(dev).toContain('{t("elev.fullpicture.card.teaser")}');
      expect(dev).not.toContain('tFP(uiLang, "elev.fullpicture.card.teaser"');
    });

    it("the teaser key carries no count at all (B-GROWTH-01)", () => {
      for (const line of fp.split("\n").filter((l) => l.includes("elev.fullpicture.card.teaser"))) {
        expect(line).not.toMatch(/\d/);
        expect(line).not.toContain("{n}");
      }
    });

    it("the Copilot takes DOMAIN_COUNT from the registry and prints no bare total", () => {
      expect(copilot).toMatch(/import \{ DOMAIN_COUNT, [^}]*\} from "\.\.\/\.\.\/lib\/domains\/registry";/);
      expect(copilot).not.toMatch(/const DOMAIN_COUNT = /);
      expect(copilot).toMatch(/elev\.fullpicture\.pulse\.moments"[^)]*total: DOMAIN_COUNT/);
      expect(copilot).toContain('"elev.fullpicture.pulse.week", { n: distinctDomains("practice", data.week.domainsTouched).length, total: DOMAIN_COUNT }');
      // the hard-coded English tile and the manual plural suffix are both gone
      expect(copilot).not.toContain("Practice interactions in 7 days, across {");
      expect(copilot).not.toContain("kPlural");
    });

    it("no surface on this screen prints an unresolved \"(s)\"", () => {
      expect(copilot).not.toContain("domain(s)");
      expect(copilot).not.toContain("day(s)");
      // the professional line names the same total and pluralizes its days
      expect(copilot).toContain('${distinctDomains("practice", data.week.domainsTouched).length} of ${DOMAIN_COUNT} domains.');
      expect(copilot).toMatch(/plural\(data\.week\.activeDays, "day"\)/);
      expect(copilot).toMatch(/plural\(data\.streak, "day"\)/);
    });

    it("both pulse keys land in EN and HE and interpolate both numbers", () => {
      for (const key of ["elev.fullpicture.pulse.moments", "elev.fullpicture.pulse.week"]) {
        for (const lang of ["en", "he"] as const) {
          const s = translate(lang, key, { n: 0, total: 5 });
          expect(s, `${lang} ${key}`).not.toBe(key);
          expect(s).toContain("5");
          expect(s).not.toContain("{n}");
          expect(s).not.toContain("{total}");
          expect(s).not.toContain("{k}");
        }
      }
    });

    it("NEGATIVE CONTROL — the pre-fix teaser, tile and preview line all trip", () => {
      const preFixTeaser = '"elev.fullpicture.card.teaser": "{n} areas covered",';
      expect(preFixTeaser).not.toContain("{plural}");
      const preFixTile =
        "Practice interactions in 7 days, across {data.week.domainsTouched.length} domain{...}";
      expect(preFixTile).toContain("Practice interactions in 7 days, across {");
      expect(copilot).not.toContain(preFixTile.slice(0, 45));
      const preFixPreview =
        "`Home practice, last 7 days: ${data.week.sessions} interactions on ${data.week.activeDays} day(s) across ${data.week.domainsTouched.length} domain(s).`";
      expect(preFixPreview).toContain("domain(s)");
      expect(preFixPreview).toContain("day(s)");
      expect(copilot).not.toContain(preFixPreview);
      const preFixMoments = '{ k: skillAreas, kPlural: skillAreas === 1 ? "" : "s" }';
      expect(preFixMoments).toContain("kPlural");
      expect(copilot).not.toContain(preFixMoments);
    });
  });

  it("NEGATIVE CONTROL — the pre-fix shapes fail every check above", () => {
    const preFixDict = '  "elev.hero.growth.stat.domains": "areas (of 7)",';
    expect(preFixDict).toMatch(/\d/);
    expect(preFixDict).not.toContain("{total}");
    const preFixSci = '<StatTile value="7" label={t("sci.stat.domains")} />';
    expect(/value="7"\s+label=\{t\("sci\.stat\.domains"\)\}/.test(preFixSci)).toBe(true);
    // and the two literals disagreed with each other and with DOMAIN_META
    expect(7).not.toBe(Object.keys(DOMAIN_META).length);
  });

  /* RUN-08 / item 19 (Copilot half) — the Full Picture printed a row per
     PracticeDomain whether or not the child's age window held any milestone
     for it, so "Speech sounds — 0 of 0 milestones noticed" taught a parent
     that a zero meant something. Same rule as the HubHero zero-line: never a
     denominator before the numerator can exist. */
  it("the Full Picture hides domains with nothing to count", () => {
    const copilot = stripComments(read("components", "practice", "DevelopmentCopilot.tsx"));
    expect(copilot).toMatch(/visibleDomains = useMemo\(\s*\(\) => bands\.filter\(\(b\) => \(domainCounts\.get\(b\.domain\)\?\.total \?\? 0\) > 0\)/);
    // the live list, the weekly snapshots and the clinician export all obey it
    expect(copilot).toContain("{visibleDomains.map((b) => {");
    expect(copilot).toContain("...visibleDomains.map((b) => {");
    expect(copilot).toContain("if (total === 0) return null;");
    // …and an all-empty window gets the teach line, not a wall of zeros
    expect(copilot).toContain('data-testid="copilot-domains-empty"');
    expect(copilot).toContain('t("elev.growthTruth.hero.empty")');
    // nothing iterates the unfiltered band list into a "x of y" row any more
    expect(copilot).not.toContain("{bands.map((b) => {");
  });

  it("NEGATIVE CONTROL — the pre-fix Copilot list is unfiltered", () => {
    const preFix = `
        <ul className="space-y-2.5">
          {bands.map((b) => {
            const c = domainCounts.get(b.domain) ?? { reached: 0, total: 0 };
            return <li>{c.reached} of {c.total} milestones noticed</li>;
          })}
        </ul>`;
    expect(preFix).toContain("{bands.map((b) => {");
    expect(preFix).not.toContain("visibleDomains");
  });
});
