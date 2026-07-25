import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { recognitionLangFor, autoListenSupported } from "../../lib/speechScorer";
import { en, he } from "../../lib/i18n";

/**
 * AIX-S2 — the speech scorer must never render an en-US mis-transcript verdict
 * about a Hebrew child's speech.
 *
 * SpeechCoachTab hardcoded recog.lang = "en-US" while the app standard is
 * bilingual (CoachTab: aiLang === "he" ? "he-IL" : "en-US"). For an HE
 * household the child's real utterance was transcribed as English noise and
 * the card confidently showed "sounds different" — a machine verdict about a
 * child that it provably could not hear. The fix derives the recognition
 * language exactly as CoachTab does AND suppresses the whole auto-verdict
 * path (on-device recognition + cloud scoring) for non-EN sessions, falling
 * to the parent-scoring floor with honest copy.
 *
 * Component assertions are SOURCE-BASED structural guards in the house
 * pattern (hardMomentSurfaces.test.ts / clinicalFirewall.wave3.test.ts).
 */

const TAB_PATH = path.resolve(__dirname, "SpeechCoachTab.tsx");
const code = fs.readFileSync(TAB_PATH, "utf8");
const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("AIX-S2 — recognition language derivation (unit)", () => {
  it("derives he-IL / en-US exactly as the CoachTab dictation seam", () => {
    expect(recognitionLangFor("he")).toBe("he-IL");
    expect(recognitionLangFor("en")).toBe("en-US");
  });

  it("auto-listen verdicts are supported ONLY for English sessions (EN targets)", () => {
    expect(autoListenSupported("en")).toBe(true);
    expect(autoListenSupported("he")).toBe(false);
  });
});

describe("AIX-S2 — SpeechCoachTab wiring (source-pinned)", () => {
  it("uses recognitionLangFor(aiLang), never a hardcoded en-US literal", () => {
    expect(stripped).toContain("recognitionLangFor(aiLang)");
    expect(stripped).not.toMatch(/lang\s*=\s*["']en-US["']/);
  });

  it("the on-device recognition path is gated on autoVerdictOk", () => {
    expect(stripped).toMatch(/if\s*\(Ctor\s*&&\s*level\s*!==\s*"story"\s*&&\s*autoVerdictOk\)/);
  });

  it("the cloud scoring path is gated on autoVerdictOk too", () => {
    expect(stripped).toMatch(/if\s*\(level\s*!==\s*"story"\s*&&\s*autoVerdictOk\)/);
  });

  it("autoResult can only be set inside an autoVerdictOk-gated block (stays null for non-EN)", () => {
    // Every non-null setAutoResult call must sit shortly after its gate — the
    // two verdict writes live inside the gated recognition/cloud blocks.
    const writes = [...stripped.matchAll(/setAutoResult\(\s*(?!null)/g)];
    expect(writes.length).toBeGreaterThan(0);
    for (const m of writes) {
      const before = stripped.slice(Math.max(0, m.index! - 900), m.index!);
      expect(before, "a verdict write escaped the autoVerdictOk gate").toContain("autoVerdictOk");
    }
  });

  it("suppression is visible, never silent: honest parent-judged copy renders", () => {
    expect(stripped).toContain('t("prac.speech.parentJudged")');
    expect(stripped).toMatch(/!recognitionAvailable\s*\|\|\s*!autoVerdictOk/);
  });

  it("parent scoring (the universal floor) is untouched", () => {
    expect(stripped).toContain('saveAttempt(b.result, "parent")');
  });
});

describe("AIX-S2 — honest copy exists in both languages", () => {
  it("prac.speech.parentJudged is present, non-empty, and verdict-free", () => {
    for (const dict of [en, he]) {
      const s = dict["prac.speech.parentJudged"];
      expect(s).toBeTruthy();
      expect(s.trim()).not.toBe("");
    }
    // Calm register: the notice explains, it never blames or grades the child.
    expect(en["prac.speech.parentJudged"]).not.toMatch(/\b(fail|wrong|error|unable)\b/i);
  });
});
