/**
 * B-LOOP-02 — the Hebrew milestone catalogue's rejected words, in ONE place:
 * lib/milestoneI18n.test.ts scans the catalogue with it, the native-review
 * import (scripts/milestone-he-review.mts) refuses a reviewer fix that carries
 * one, and HE-REVIEW-README.md prints it for the reviewer.
 *
 * Verdict / norm words a parent must never read about their child. Substrings
 * (Hebrew glues particles to the word). The diagnosis-term list is
 * CLINICAL_DIAGNOSIS_TERMS_HE (lib/clinicalScan).
 */
export const HE_VERDICT_WORDS: readonly string[] = ["מאחר", "תקין", "מפגר", "בפיגור", "בקצב", "אמור", "אמורה", "נורמלי", "אחוזון", "בסיכון", "%"];
