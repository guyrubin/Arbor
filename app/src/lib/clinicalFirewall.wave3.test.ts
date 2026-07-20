import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Wave-3 clinical-firewall test (2026-06-26).
 *
 * Asserts that the demoted surfaces (DevScoreCard, DevScoreStrip,
 * OverviewTab dev-map card, StoryTimelineTab momentum strip, BehaviorsTab
 * per-type strip) + the prose paths (childStory, signalTimeline.deriveNextStep)
 * + their i18n keys NO LONGER emit any verdict-shaped primitive on a child
 * metric.
 *
 * "Verdict-shaped" = a score/percentage, a 0–100 ring, a trend glyph/rising-
 * easing verdict, a norm-cutoff, a "strong domain" dot, a condition name, or
 * an effect-size verb on the child.
 *
 * This is the test form of the clinical-firewall re-verify the orchestrator
 * runs after every Wave-3-class demotion. It is intentionally SOURCE-BASED
 * (string-scans the actual files) so a future re-wiring is caught at CI time.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}

// The surfaces demoted in Wave-3. None may render a verdict primitive anymore.
const DEMOTED_SURFACES = [
  // TrendsChart.tsx was deleted in the IA W6.3 dead-code sweep (zero importers).
  "components/overview/DevScoreStrip.tsx",
  "components/sections/DevScoreCard.tsx",
  // 2026-07-04 release audit: the sidebar milestone badge rendered
  // `milestonesPercent%` — parent-facing chrome is firewall scope too.
  // Badge is now a parent-noticed COUNT; keep the whole shell scanned.
  "components/layout/Sidebar.tsx",
];

// 2026-07-09: TrustSafetyBar in the shared kit rendered a graded child verdict
// ("Risk: Low/Moderate/High") onto 8 parent surfaces. The kit hosts legitimate
// non-child rings (course progress = parent effort), so it gets a TARGETED
// assertion instead of the full demoted-surface token scan: no component may
// interpolate a risk grade into visible text.
describe("shared kit — no graded child verdict text", () => {
  const code = stripComments(read("components/ui/kit.tsx"));
  it("TrustSafetyBar renders no 'Risk: <grade>' text", () => {
    expect(code, "kit.tsx interpolates a risk grade into visible text").not.toMatch(/Risk:\s*\{|Risk:\s*[LMH]/);
  });
});

// 2026-07-20 (product council): the Wave-3 guard scanned only the demoted dev-score
// surfaces + kit, so a graded child RISK verdict survived on three surfaces it never
// looked at — the coach answer card ("Risk: <grade>" chip), the Safety banner
// ("Current risk level"), and the rendered coach markdown ("Risk level: **X**").
// These are the highest-severity firewall leaks (a verdict on the child, parent- and
// clinician-facing). Removed, and pinned here: the riskLevel FIELD may exist for
// internal reasoning, but no visible text on these surfaces may render it as a grade.
describe("coach & safety surfaces — no graded child risk verdict in visible text", () => {
  const VERDICT_TEXT = [
    /Risk level:\s*\*\*/i,        // rendered coach markdown
    /Current risk level/i,        // Safety banner
    /Risk:\s*\{/,                 // JSX-interpolated grade chip
    /Risk:\s*\$\{/,               // template-interpolated grade
    /Risk:\s*[LMH][a-z]+/,        // literal "Risk: Low/Moderate/High"
  ];
  for (const rel of [
    "components/coach/CoachAnswerCards.tsx",
    "components/tabs/SafetyTab.tsx",
    "contracts/coach.ts",
  ]) {
    it(`${rel} renders no risk-grade verdict text`, () => {
      const code = stripComments(read(rel));
      for (const pat of VERDICT_TEXT) {
        expect(code, `${rel} emits a graded risk verdict (${pat}) into visible text`).not.toMatch(pat);
      }
    });
  }
});

// Tokens that NEVER belong on a child metric in the demoted surfaces. (Accent-
// safe word-boundary checks; we allow these words to appear in COMMENTS only —
// the test scans code lines, stripping /* … */ and // comments first.)
const VERDICT_TOKENS = [
  "score.overall",
  "ProgressRing",
  "DevRadarRing",
  "milestonesPercent",
  "conic-gradient",
  "TrendingUp",
  "TrendingDown",
  "intensityTrend",
  "avgIntensityThisWeek",
  "readiness",
];

/** Strip line comments and block comments so the lint only sees code. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

describe("Wave-3 clinical firewall — demoted surfaces emit no verdict primitive", () => {
  for (const rel of DEMOTED_SURFACES) {
    describe(rel, () => {
      const raw = read(rel);
      const code = stripComments(raw);

      it("does not reference the 0–100 score / ProgressRing / radar / readiness %", () => {
        for (const tok of [
          "score.overall",
          "ProgressRing",
          "DevRadarRing",
          "milestonesPercent",
          "conic-gradient",
          "readiness",
        ]) {
          expect(code, `${rel} still references verdict token "${tok}"`).not.toContain(tok);
        }
      });

      it("does not render TrendingUp / TrendingDown intensity-trend glyphs", () => {
        expect(code, `${rel} still imports a trend glyph`).not.toMatch(/\b(TrendingUp|TrendingDown)\b/);
      });
    });
  }
});

describe("Wave-3 clinical firewall — prose paths emit no intensity-trend verdict", () => {
  it("childStory.ts no longer emits the easing/rising intensity clauses", () => {
    const code = stripComments(read("lib/childStory.ts"));
    expect(code).not.toMatch(/harder moments have felt a little calmer/);
    expect(code).not.toMatch(/some moments have felt bigger lately/);
    // And the field may be on the input type but is never read in the composer body.
    expect(code).not.toMatch(/if\s*\(i\.intensityTrend\s*===\s*"(easing|rising)"/);
  });

  it("signalTimeline.deriveNextStep no longer emits the easing/rising trend line", () => {
    const code = stripComments(read("lib/signalTimeline.ts"));
    expect(code).not.toMatch(/Intensity is easing/);
    expect(code).not.toMatch(/Intensity is rising this week/);
    expect(code).not.toMatch(/momentum\.intensityTrend\s*===\s*"(easing|rising)"/);
  });

  it("StoryTimelineTab.tsx no longer renders the Avg-intensity StatTile nor color-coded momentTrend", () => {
    const code = stripComments(read("components/tabs/StoryTimelineTab.tsx"));
    expect(code).not.toContain("Avg intensity");
    expect(code).not.toContain("avgIntensityThisWeek");
    expect(code).not.toContain("momentum.intensityTrend");
    // The story call must pass intensityTrend: "none" (never the live value).
    expect(code).toMatch(/intensityTrend:\s*"none"/);
  });

  it("BehaviorsTab.tsx no longer renders a per-type intensity sparkline", () => {
    const code = stripComments(read("components/tabs/BehaviorsTab.tsx"));
    expect(code).not.toContain("Sparkline");
    expect(code).not.toContain("sparkSeries");
    expect(code).not.toContain("beh.trendLabel");
  });
});

describe("Wave-3 clinical firewall — i18n keys are non-diagnostic", () => {
  const i18n = read("lib/i18n.ts");

  it("drops the verdict-shaped devscore.* keys (score/ring/trend/radar/focus/today.aria)", () => {
    for (const key of [
      "devscore.overall",
      "devscore.focus",
      "devscore.todayLine",
      "devscore.todayLineSteady",
      "devscore.today.aria",
      "devscore.bar.aria",
      "devscore.radar.caption",
      "devscore.radar.aria",
    ]) {
      expect(i18n, `verdict key "${key}" still present in i18n`).not.toContain(`"${key}":`);
    }
  });

  it("drops the verdict-shaped trends.* keys (readiness %, intensity tooltip)", () => {
    for (const key of [
      "trends.readiness",
      "trends.tooltip.label",
      "trends.tooltip.fmt",
    ]) {
      expect(i18n, `verdict key "${key}" still present in i18n`).not.toContain(`"${key}":`);
    }
  });

  it("drops the verdict-shaped beh.trendLabel key", () => {
    expect(i18n).not.toContain('"beh.trendLabel":');
  });

  it("no effect-verb / age-norm / condition-name sneaks into the new copy", () => {
    // Scan only the new/changed key values for the CI-28 / Blueprint #91 banned
    // tokens. (Matches the values of devscore.*, trends.recall*, beh.count*,
    // beh.countLabel keys in both EN and HE blocks.)
    const banned = /\b(improves|boosts?|reduces?|on[\s-]?track|behind|clinically|therapeutically|autism|adhd|anxiety|spd|arfid|dyslexia)\b/i;
    const lines = i18n.split(/\r?\n/);
    const suspectLines = lines.filter((l) =>
      /"(devscore\.|trends\.recall|beh\.count)/.test(l) && l.includes(":") && !l.trim().startsWith("//"),
    );
    for (const l of suspectLines) {
      expect(l, `banned token in i18n line: ${l}`).not.toMatch(banned);
    }
  });
});
