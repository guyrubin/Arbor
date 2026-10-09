import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "./i18n";

/**
 * AIX-S4 — "coach me on this" seeds are localized on every listed surface.
 *
 * The shipped standard is bilingual (hardMomentSurface.ts per-language seeds,
 * SpeechCoachTab's t("prac.speech.progress.coachPrompt")), yet ~10 call sites
 * built raw English template-literal prompts into seedCoach — an HE parent
 * tapped "coach me on this" and watched an English paragraph appear in their
 * own chat box. This grep-test (hardMomentSurfaces.test.ts style) locks the
 * t() pattern so the class cannot regress.
 *
 * Deliberately NOT covered: ScholarTab's seeds, which are documented in-source
 * as intentionally-English AI-input prompts ("Do not translate").
 */

const SRC_ROOT = path.resolve(__dirname, "..");

const SEED_SURFACES = [
  "components/tabs/DailyPlayTab.tsx",
  "components/tabs/LanguageLabTab.tsx",
  "components/tabs/OverviewTab.tsx",
  "components/tabs/MilestonesTab.tsx",
  "components/tabs/PlansTab.tsx",
];

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("AIX-S4 — no raw-English template literal reaches a coach seed", () => {
  for (const rel of SEED_SURFACES) {
    it(`${rel} builds every seed prompt through t() — no template-literal prompt`, () => {
      const code = stripComments(read(rel));
      // Banned shape 1: seedCoach({ prompt: `...` }) — a raw template prompt.
      expect(code, `${rel}: raw template literal in seedCoach prompt`).not.toMatch(
        /seedCoach\(\s*\{[\s\S]{0,120}?prompt:\s*`/,
      );
      // Banned shape 2: prompt: `...` or prompt: cond ? `...` anywhere (these
      // files' only prompt-bearing calls are coach seeds).
      expect(code, `${rel}: template literal bound to a prompt field`).not.toMatch(/prompt:\s*(?:[\w.]+\s*\?\s*)?`/);
      // Banned shape 3: a template literal passed straight into a seed helper.
      expect(code, `${rel}: template literal passed to a seed helper`).not.toMatch(
        /(?:onSeedCoach|askCoach|coachActivity)\s*\(\s*`/,
      );
    });
  }

  it("every surface consumes its localized seed key", () => {
    expect(read("components/tabs/DailyPlayTab.tsx")).toContain('t("seed.play"');
    expect(read("components/tabs/DailyPlayTab.tsx")).toContain('t("seed.play.withGoal"');
    // B-LOOP-07: Today seeds no coach prompt (the practice is the move); the
    // seed.todayFocus key stays for the step card wherever it renders.
    expect(read("components/tabs/OverviewTab.tsx")).not.toMatch(/seedCoach\(/);
    // B-GROWTH-12: the gap-analysis seed left with its analyzer; the ONE door seeds this key.
    expect(read("components/tabs/MilestonesTab.tsx")).toContain('t("seed.milestone.ask"');
    expect(read("components/tabs/PlansTab.tsx")).toContain('t("seed.planCoreg"');
    expect(read("components/tabs/LanguageLabTab.tsx")).toContain('t("seed.langWeekPlan"');
    expect(read("components/tabs/LanguageLabTab.tsx")).toContain('t("seed.langActivity"');
  });
});

describe("AIX-S4 — seed keys exist in BOTH dictionaries with matching placeholders", () => {
  const SEED_KEYS = [
    "seed.play",
    "seed.play.withGoal",
    "seed.todayFocus",
    "seed.milestoneGaps",
    "seed.milestone.ask",
    "seed.planCoreg",
    "seed.langWeekPlan",
    "seed.langActivity",
  ];

  it("every seed key has a non-empty en + he value", () => {
    for (const key of SEED_KEYS) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
  });

  it("HE carries the exact placeholder set of EN (no dropped interpolation)", () => {
    for (const key of SEED_KEYS) {
      const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(holes(he[key]), `${key}: placeholder mismatch`).toEqual(holes(en[key]));
    }
  });
});
