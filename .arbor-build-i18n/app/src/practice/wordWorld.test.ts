/**
 * LANG-15 — Word World prompt-bank lint + unit tests.
 *
 * Gate requirement (clinical gate §6): build-time lint that asserts no
 * banned token appears in any exported string across the prompt bank,
 * module labels, descriptions, confirmations, and rail text.
 *
 * Banned token categories (from clinical gate):
 *   - effect-verbs: improves, builds, boosts, trains, strengthens, develops, reduces
 *   - comprehension-leak: understands, comprehends, follows directions
 *   - child-language-metric: word count, talking more, on track, not on track,
 *     delayed, behind, language score, accuracy %, intelligibility
 *   - branded-program: Hanen, It Takes Two to Talk, More Than Words, TalkAbility,
 *     OWL, Observe-Wait-Listen, dialogic reading program
 *   - clinical overclaim: clinically validated, clinician-reviewed, SLP-designed,
 *     SLP-approved, assesses, screens, evaluates, Arbor measured
 *   - diagnosis-adjacent: language delay, speech delay, apraxia, autism, ASD,
 *     dyslexia, disorder
 *   - milestone thresholds: words by 18 months, 50 words by 24 months,
 *     intelligibility %
 *   - effect-size / progress claim: language-growth chart, accuracy, percent
 *     intelligible, word count
 */
import { describe, expect, it } from "vitest";
import {
  LANG_MODULES,
  LANG_PROMPTS,
  REFERRAL_RAIL_TEXT,
  REFERRAL_SHARE_TEXT,
  LOG_CONFIRMATION,
  WE_TRIED_LABEL,
  THIS_WEEK_LABEL,
  SOURCE_FRAMING,
  MONITORING_NUDGE_TEXT,
  ageBandForAge,
  promptsForBand,
  type LangAgeBand,
  type LangModuleId,
} from "./wordWorld";

/* ─── Collect all exported strings for lint ─────────────────────────────── */
const ALL_STRINGS = [
  ...LANG_MODULES.map((m) => m.name),
  ...LANG_MODULES.map((m) => m.mechanism),
  ...LANG_PROMPTS.map((p) => p.text),
  ...LANG_PROMPTS.map((p) => p.context),
  REFERRAL_RAIL_TEXT,
  REFERRAL_SHARE_TEXT,
  LOG_CONFIRMATION,
  WE_TRIED_LABEL,
  THIS_WEEK_LABEL,
  SOURCE_FRAMING,
  MONITORING_NUDGE_TEXT,
];

/* ─── Banned token patterns (clinical gate §6) ───────────────────────────── */
const BANNED: Array<{ label: string; pattern: RegExp }> = [
  // Effect-verbs
  { label: "effect-verb: improves", pattern: /\bimproves?\b/i },
  { label: "effect-verb: builds language / builds vocab", pattern: /\bbuilds?\s+(?:language|vocab|vocabulary|speech)\b/i },
  { label: "effect-verb: boosts", pattern: /\bboosts?\b/i },
  { label: "effect-verb: trains", pattern: /\btrains?\b/i },
  { label: "effect-verb: strengthens", pattern: /\bstrengthens?\b/i },
  { label: "effect-verb: develops speech/language", pattern: /\bdevelops?\s+(?:speech|language|communication|vocabulary)\b/i },
  { label: "effect-verb: reduces", pattern: /\breduces?\b/i },
  // Comprehension-leak
  { label: "comprehension-leak: understands", pattern: /\bunderstands?\b/i },
  { label: "comprehension-leak: comprehends", pattern: /\bcomprehends?\b/i },
  { label: "comprehension-leak: follows directions", pattern: /\bfollows?\s+directions?\b/i },
  // Child-language-metric
  { label: "child-metric: word count", pattern: /\bword\s+count\b/i },
  { label: "child-metric: talking more", pattern: /\btalking\s+more\b/i },
  { label: "child-metric: on track", pattern: /\bon\s+track\b/i },
  { label: "child-metric: not on track", pattern: /\bnot\s+on\s+track\b/i },
  { label: "child-metric: delayed", pattern: /\bdelayed\b/i },
  { label: "child-metric: behind", pattern: /\bbehind\b/i },
  { label: "child-metric: language score", pattern: /\blanguage\s+score\b/i },
  { label: "child-metric: accuracy %", pattern: /\baccuracy\s*%\b/i },
  { label: "child-metric: intelligibility", pattern: /\bintelligib/i },
  { label: "child-metric: language-growth chart", pattern: /\blanguage.growth\s+chart\b/i },
  { label: "child-metric: percent intelligible", pattern: /\bpercent\s+intelligible\b/i },
  // Branded programs
  { label: "branded: Hanen", pattern: /\bHanen\b/i },
  { label: "branded: It Takes Two to Talk", pattern: /\bIt\s+Takes\s+Two\s+to\s+Talk\b/i },
  { label: "branded: More Than Words", pattern: /\bMore\s+Than\s+Words\b/i },
  { label: "branded: TalkAbility", pattern: /\bTalkAbility\b/i },
  { label: "branded: OWL method", pattern: /\bOWL\b/ },
  { label: "branded: Observe-Wait-Listen", pattern: /\bObserve.Wait.Listen\b/i },
  { label: "branded: dialogic reading program", pattern: /\bdialogic\s+reading\s+program\b/i },
  // Clinical overclaim
  { label: "overclaim: clinically validated", pattern: /\bclinically\s+validated\b/i },
  { label: "overclaim: clinician-reviewed", pattern: /\bclinician.reviewed\b/i },
  { label: "overclaim: SLP-designed", pattern: /\bSLP.designed\b/i },
  { label: "overclaim: SLP-approved", pattern: /\bSLP.approved\b/i },
  { label: "overclaim: assesses", pattern: /\bassesses?\b/i },
  { label: "overclaim: screens", pattern: /\bscreens?\b/i },
  { label: "overclaim: evaluates", pattern: /\bevaluates?\b/i },
  { label: "overclaim: Arbor measured", pattern: /\bArbor\s+measured\b/i },
  // Diagnosis-adjacent
  { label: "dx-adjacent: language delay", pattern: /\blanguage\s+delay\b/i },
  { label: "dx-adjacent: speech delay", pattern: /\bspeech\s+delay\b/i },
  { label: "dx-adjacent: apraxia", pattern: /\bapraxia\b/i },
  { label: "dx-adjacent: autism", pattern: /\bautism\b/i },
  { label: "dx-adjacent: ASD", pattern: /\bASD\b/ },
  { label: "dx-adjacent: dyslexia", pattern: /\bdyslexia\b/i },
  { label: "dx-adjacent: disorder", pattern: /\bdisorder\b/i },
  // Milestone numeric thresholds
  { label: "threshold: words by 18 months", pattern: /\bwords?\s+by\s+18\s+months?\b/i },
  { label: "threshold: 50 words by 24 months", pattern: /\b50\s+words?\s+by\s+24\s+months?\b/i },
];

/* ─── Lint: no banned token in any exported string ───────────────────────── */
describe("LANG-15 Word World — clinical gate string lint", () => {
  for (const { label, pattern } of BANNED) {
    it(`no "${label}" in any exported prompt-bank or label string`, () => {
      const violations = ALL_STRINGS.filter((s) => pattern.test(s));
      expect(violations).toEqual([]);
    });
  }
});

/* ─── Structural integrity ───────────────────────────────────────────────── */
describe("LANG-15 Word World — prompt bank structure", () => {
  it("has exactly 3 modules", () => {
    expect(LANG_MODULES).toHaveLength(3);
  });

  it("all module ids are distinct", () => {
    const ids = LANG_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("every prompt has a non-empty text", () => {
    for (const p of LANG_PROMPTS) {
      expect(p.text.trim().length).toBeGreaterThan(10);
    }
  });

  it("every module has at least one prompt per age band", () => {
    const bands: LangAgeBand[] = ["0-12m", "12-36m", "3-5y"];
    const moduleIds: LangModuleId[] = ["serve-and-return", "narrated-play", "shared-reading"];
    for (const moduleId of moduleIds) {
      for (const band of bands) {
        const prompts = promptsForBand(moduleId, band);
        expect(prompts.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("ageBandForAge maps correctly", () => {
    expect(ageBandForAge(0)).toBe("0-12m");
    expect(ageBandForAge(0.9)).toBe("0-12m");
    expect(ageBandForAge(1)).toBe("12-36m");
    expect(ageBandForAge(2.9)).toBe("12-36m");
    expect(ageBandForAge(3)).toBe("3-5y");
    expect(ageBandForAge(5)).toBe("3-5y");
  });

  it("referral rail text contains the CI-25 required phrase", () => {
    expect(REFERRAL_RAIL_TEXT).toContain("always worth raising with your pediatrician or an SLP");
  });

  it("referral share text is the CI-25 approved string verbatim", () => {
    // The gate spec phrase with trailing period (as designed in the UX spec).
    expect(REFERRAL_SHARE_TEXT).toBe(
      "I would like to discuss my child's language development at our next visit."
    );
  });

  it("log confirmation matches allowed copy", () => {
    expect(LOG_CONFIRMATION).toBe("Logged. Great moment.");
  });

  it("source framing does not contain 'clinically validated'", () => {
    expect(SOURCE_FRAMING).not.toMatch(/clinically\s+validated/i);
    expect(SOURCE_FRAMING).toContain("CDC");
    expect(SOURCE_FRAMING).toContain("AAP");
    expect(SOURCE_FRAMING).toContain("ASHA");
    expect(SOURCE_FRAMING).toContain("WHO");
  });
});
