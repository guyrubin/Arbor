/**
 * BD-54 — the per-pattern intent pages are DARK and in the lexicon: noindex,
 * no canonical, absent from the sitemap, disallowed in robots.txt, linked from
 * nowhere in public/; every line in the positioning lexicon (never a treatment
 * or a diagnosis noun, none of the pattern's own banned words); Hebrew is a
 * right-to-left page; the CTA carries the everyday_plans tag and forwards a
 * practitioner's incoming source.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPlanLandingPages, PLAN_LANDING_DIR, renderPlanLanding } from "./build-plan-landing";
import { authoredPatterns } from "../src/lib/library/plans/planBooks";

const PUBLIC = new URL("../public/", import.meta.url);
const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<script>[\s\S]*?<\/script>/, "").replace(/<[^>]*>/g, " ");

describe("the Everyday-plan intent pages", () => {
  const defs = authoredPatterns();

  it("renders every authored pattern in both languages, dark: noindex, no canonical, no hreflang, nothing indexable", () => {
    const dist = mkdtempSync(join(tmpdir(), "arbor-plan-landing-"));
    const written = buildPlanLandingPages(dist);
    expect(written).toHaveLength(defs.length * 2);
    for (const rel of written) {
      const html = readFileSync(join(dist, rel), "utf8");
      expect(html, rel).toContain('<meta name="robots" content="noindex, nofollow, noarchive" />');
      expect(html, rel).not.toContain('rel="canonical"');
      expect(html, rel).not.toContain("hreflang");
      expect(html, rel).not.toMatch(/application\/ld\+json/);
    }
  });

  it("is absent from the sitemap, disallowed in robots.txt, and linked from no public page", () => {
    expect(readFileSync(new URL("sitemap.xml", PUBLIC), "utf8")).not.toContain(PLAN_LANDING_DIR);
    const robots = readFileSync(new URL("robots.txt", PUBLIC), "utf8");
    const blocks = robots.split(/\n\s*\n/).filter((b) => /User-agent:/i.test(b));
    for (const b of blocks) expect(b, b).toContain(`Disallow: /${PLAN_LANDING_DIR}/`);
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(html|md|xml|txt|json)$/.test(n) ? [p] : []; });
    const linkers = walk(join(PUBLIC.pathname, "marketing")).filter((f) => readFileSync(f, "utf8").includes(`/${PLAN_LANDING_DIR}/`));
    expect(linkers.map((f) => f.split("/public/")[1])).toEqual(["marketing/utm-scheme.md"]); // the scheme documents the path; no page links it
  });

  it("every line is in the positioning lexicon — no treatment, cure, therapy or diagnosis word anywhere; the page's own voice (title, headline, lede, steps, red lines) never names a condition; the review note is on every page", () => {
    for (const def of defs) {
      for (const lang of ["en", "he"] as const) {
        const html = renderPlanLanding(def, lang);
        const t = text(html);
        expect(t, `${def.id} ${lang}`).not.toMatch(/\b(treats?|treatment|cure|therapy|diagnos\w*|disorder|syndrome)\b/i);
        expect(t, `${def.id} ${lang}`).not.toMatch(/מרפא|טיפול רפואי|אבחון|הפרעה|תסמונת/);
        // The pattern's own banned nouns (child-text rule §1 field 11) stay out of the page's own voice; a
        // cited source keeps its real title (e.g. a guideline named for the condition) — those are reviewed in the packet.
        const voice = text([/<title>[\s\S]*?<\/title>/, /<header>[\s\S]*?<\/header>/, /<ol>[\s\S]*?<\/ol>/, /<ul>[\s\S]*?<\/ul>/].map((re) => html.match(re)?.[0] ?? "").join(" ")).toLowerCase();
        for (const w of def.bannedWords[lang]) expect(voice, `${def.id} ${lang} bans "${w}" in its own voice`).not.toContain(w.toLowerCase());
        expect(t).toContain(lang === "he" ? "התבנית הזאת בבדיקה" : "This pattern is in review");
        expect(t).not.toMatch(/\d+\s?%/);
      }
    }
  });

  it("Hebrew is a right-to-left page in the pattern's Hebrew parent words; English left-to-right", () => {
    const def = defs[0];
    expect(renderPlanLanding(def, "he")).toContain('<html lang="he" dir="rtl">');
    expect(renderPlanLanding(def, "he")).toContain(def.parentWords.he);
    expect(renderPlanLanding(def, "en")).toContain('<html lang="en" dir="ltr">');
    expect(renderPlanLanding(def, "en")).toContain(def.parentWords.en);
  });

  it("the CTA carries the everyday_plans tag and forwards a practitioner's incoming source (incoming wins)", () => {
    const html = renderPlanLanding(defs[0], "en");
    expect(html).toContain(`href="/?utm_source=landing&utm_medium=organic&utm_campaign=everyday_plans&utm_content=plan_${defs[0].id.replace(/-/g, "_")}"`);
    expect(html).toContain('"utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref"');
    expect(html).toContain("u.searchParams.set(k,inc.get(k))");
  });
});
