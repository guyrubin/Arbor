/**
 * B-CAREPRO-42 — the OT / PT / psychology preset data: cloned from the
 * clinician template (same base sections + ceiling, term-scan exempt), one
 * evidence section each, a share scope each, an intake schema each whose
 * questions resolve in EN + HE and never ask the parent to grade the child.
 */
import { describe, expect, it } from "vitest";
import { translate } from "../lib/i18n";
import { CLINICIAN_BASE_SECTIONS, SPLIT_CLINICIAN_AUDIENCES, SPLIT_CLINICIAN_PRESETS, isSplitClinicianAudience } from "./consultPresets";

describe("B-CAREPRO-42 · the three presets", () => {
  it("each is the clinician template: base sections first, same ceiling, no term scan", () => {
    for (const a of SPLIT_CLINICIAN_AUDIENCES) {
      const p = SPLIT_CLINICIAN_PRESETS[a];
      expect(p.audience).toBe(a);
      expect(p.sections.slice(0, CLINICIAN_BASE_SECTIONS.length)).toEqual([...CLINICIAN_BASE_SECTIONS]);
      expect(p.dataCeiling).toEqual({ logDerivedPatterns: true, approvedMemoryFacts: true });
      expect(p.clinicalTermScan).toBe(false);
      expect(p.shareScope).toBe(`report_${a}`);
      expect(p.intake).toBe(a);
    }
  });
  it("the discipline evidence: PT reads the measurements, psychology the triggers, OT the base only", () => {
    expect(SPLIT_CLINICIAN_PRESETS.ot.sections).toHaveLength(CLINICIAN_BASE_SECTIONS.length);
    expect(SPLIT_CLINICIAN_PRESETS.pt.sections).toContain("growth-measurements");
    expect(SPLIT_CLINICIAN_PRESETS.psychology.sections).toContain("triggers");
    expect(SPLIT_CLINICIAN_PRESETS.ot.sections).not.toContain("language-observations");
  });
  it("labels and every intake question resolve in EN + HE; no question grades the child", () => {
    const grading = /\b(score|rate|scale|percent|behind|delay|normal|typical)\b|%|ציון|(?:^|\s)דרגו|עיכוב|תקין|נורמלי/i;
    for (const a of SPLIT_CLINICIAN_AUDIENCES) {
      const p = SPLIT_CLINICIAN_PRESETS[a];
      expect(p.intakeQuestions.length).toBeGreaterThanOrEqual(4);
      for (const k of [p.labelKey, ...p.intakeQuestions]) {
        for (const lang of ["en", "he"] as const) {
          const v = translate(lang, k, { name: "Dylan" });
          expect(v, `${lang}:${k}`).not.toBe(k);
          expect(grading.test(v), `${lang}:${k}`).toBe(false);
        }
      }
    }
  });
  it("isSplitClinicianAudience", () => {
    expect(isSplitClinicianAudience("ot")).toBe(true);
    expect(isSplitClinicianAudience("therapist")).toBe(false);
  });
});
