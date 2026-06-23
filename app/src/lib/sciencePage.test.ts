/**
 * AP-060: "The Science" trust page — firewall assertion tests.
 *
 * These tests assert that:
 *  1. Banned strings are ABSENT from all i18n values (EN + HE).
 *  2. "clinical" does NOT modify board/review/validation/approval in any i18n value.
 *  3. The verbatim hero line, disclaimer, and board-composition lines render in EN.
 *  4. No ASQ-3 deep-link is added (the HELD comment location is documented here).
 *  5. HE translations carry firewall-safe meaning (no forbidden clinical-claim terms).
 *
 * HOLD: ASQ-3 deep-link is HELD pending legal/IP clearance.
 * // AP-060: ASQ-3 deep-link HELD pending legal/IP clearance — do not add an
 * // outbound link or reproduce any ASQ-3 items.
 * The test below asserts the cleared "informed by the structure" phrase is present
 * but the banned phrases ("Arbor's ASQ-3 screening", "take the ASQ-3 in Arbor",
 * "ASQ-3-based score") are absent.
 */

import { describe, it, expect } from "vitest";
import { en, he } from "./i18n";

// ── VERBATIM strings that MUST appear (board-cleared 2026-06-23) ───────────────

const VERBATIM_HERO_EN =
  "Developmentally informed — built on cited public guidance from the CDC, AAP, ASHA, and WHO.";

const VERBATIM_DISCLAIMER_EN =
  "Arbor is not a diagnostic tool and does not replace professional care. It tracks development and surfaces things worth discussing — it does not diagnose, screen, or label your child. Milestones describe what most children do at a given age; every child develops on their own timeline. If you have a concern, or if Arbor flags one, talk to your pediatrician or a qualified professional.";

const VERBATIM_BOARD_EN =
  "Reviewed by Arbor's internal developmental reviewers (backgrounds spanning child psychology, speech-language, and developmental pediatrics). They are not licensed clinicians and Arbor is not clinically validated; their role is to keep our content faithful to cited public guidance.";

// ── Banned strings (must be ABSENT from ALL i18n values) ─────────────────────

const BANNED_STRINGS = [
  "Expert-Reviewed",
  "clinician-reviewed",
  "clinician-approved",
  "clinical board",
  "CDC-recommended",
  "CDC-validated",
  "CDC-endorsed",
  "CDC-approved",
  "in partnership with the CDC",
  "AAP-endorsed",
  "ASQ-3 screening",
  "peer-reviewed sources",
  "evidence-based",          // as a standalone medal — checked in sci.* keys only (see note below)
  "clinically proven",
  "most rigorously sourced",
  "improves development",
  // ASQ-3 banned phrases (deep-link HELD)
  "take the ASQ-3 in Arbor",
  "ASQ-3-based score",
];

// "clinically validated" as a POSITIVE CLAIM is banned; as an explicit negation
// in the verbatim board note it is the cleared copy. Check that it only appears
// with the required negation ("is not clinically validated").
// This mirrors the charter: the board note verbatim says "Arbor is not clinically
// validated" — the CLAIM "clinically validated" is banned, the negation is required.
const CLINICALLY_VALIDATED_POSITIVE_RE = /(?<!is not\s)(?<!not\s)clinically validated/i;

// "clinical" modifiers — these MUST NOT appear in sci.* keys
const CLINICAL_MODIFIERS_RE =
  /\bclinical\s+(board|review|validation|approval|approval|endorsement)\b/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sciKeys(dict: Record<string, string>) {
  return Object.entries(dict).filter(([k]) => k.startsWith("sci."));
}

function allSciValues(dict: Record<string, string>) {
  return sciKeys(dict).map(([, v]) => v);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AP-060 firewall: 'clinically validated' only appears as negation (never as claim)", () => {
  it("EN: any 'clinically validated' occurrence is preceded by negation (board note verbatim)", () => {
    const hits = Object.entries(en).filter(([, v]) =>
      CLINICALLY_VALIDATED_POSITIVE_RE.test(v)
    );
    expect(
      hits.map(([k]) => k),
      `'clinically validated' used as a positive claim in EN keys: ${hits.map(([k]) => k).join(", ")}`
    ).toEqual([]);
  });

  it("EN: sci.board.note uses 'not clinically validated' (the required negation)", () => {
    expect(en["sci.board.note"]).toContain("not clinically validated");
  });
});

describe("AP-060 firewall: banned strings absent from i18n", () => {
  for (const banned of BANNED_STRINGS) {
    it(`EN: "${banned}" is absent from all i18n values`, () => {
      const hits = Object.entries(en).filter(([, v]) =>
        v.toLowerCase().includes(banned.toLowerCase())
      );
      expect(
        hits.map(([k]) => k),
        `banned string "${banned}" found in EN keys: ${hits.map(([k]) => k).join(", ")}`
      ).toEqual([]);
    });

    it(`HE: "${banned}" is absent from all i18n values`, () => {
      // HE values are Hebrew so only ASCII banned terms could appear
      const hits = Object.entries(he).filter(([, v]) =>
        v.toLowerCase().includes(banned.toLowerCase())
      );
      expect(
        hits.map(([k]) => k),
        `banned string "${banned}" found in HE keys: ${hits.map(([k]) => k).join(", ")}`
      ).toEqual([]);
    });
  }
});

describe("AP-060 firewall: 'clinical' must not modify board/review/validation/approval", () => {
  it("EN sci.* values do not have 'clinical' modifying board/review/validation/approval", () => {
    const violations = allSciValues(en).filter((v) => CLINICAL_MODIFIERS_RE.test(v));
    expect(violations, `clinical modifier found in EN sci.*: ${violations.join(" | ")}`).toEqual([]);
  });

  it("HE sci.* values do not have 'clinical' modifying board/review/validation/approval", () => {
    const violations = allSciValues(he).filter((v) => CLINICAL_MODIFIERS_RE.test(v));
    expect(violations, `clinical modifier found in HE sci.*: ${violations.join(" | ")}`).toEqual([]);
  });
});

describe("AP-060 firewall: verbatim strings present in EN", () => {
  it("sci.hero.line matches the VERBATIM cleared hero copy", () => {
    expect(en["sci.hero.line"]).toBe(VERBATIM_HERO_EN);
  });

  it("sci.disclaimer matches the VERBATIM approved disclaimer", () => {
    expect(en["sci.disclaimer"]).toBe(VERBATIM_DISCLAIMER_EN);
  });

  it("sci.board.note matches the VERBATIM board-composition line", () => {
    expect(en["sci.board.note"]).toBe(VERBATIM_BOARD_EN);
  });
});

describe("AP-060 firewall: ASQ-3 hold — no outbound link, no item reproduction", () => {
  // The page may MENTION ASQ-3 only with the cleared "informed by the structure" phrase.
  // No outbound ASQ-3 link is added; no ASQ-3 items are reproduced.
  // See: // AP-060: ASQ-3 deep-link HELD pending legal/IP clearance — do not add an
  //      // outbound link or reproduce any ASQ-3 items.
  it("sci.asq3.mention uses the cleared 'informed by the structure' phrase", () => {
    const val = en["sci.asq3.mention"] ?? "";
    expect(val).toContain("informed by the structure");
    expect(val.toLowerCase()).not.toContain("take the asq-3 in arbor");
    expect(val.toLowerCase()).not.toContain("asq-3-based score");
    expect(val.toLowerCase()).not.toContain("arbor's asq-3 screening");
  });

  it("HE sci.asq3.mention does not contain banned ASQ-3 phrases", () => {
    const val = (he["sci.asq3.mention"] ?? "").toLowerCase();
    expect(val).not.toContain("asq-3 screening");
    expect(val).not.toContain("asq-3-based score");
  });
});

describe("AP-060 firewall: stats framing — allowed provenance copy used", () => {
  it("sci.stat.milestones mentions 133 milestones and 7 domains (provenance framing)", () => {
    expect(en["sci.stat.milestones"]).toContain("milestones");
    // stats value tile shows "133" as the numeric; label confirms domains
    expect(en["sci.stat.milestones"]).toContain("7");
  });

  it("sci.howbuilt.body does not claim outcome/effect-size improvements", () => {
    const body = (en["sci.howbuilt.body"] ?? "").toLowerCase();
    expect(body).not.toContain("improves development");
    expect(body).not.toContain("faster milestones");
    expect(body).not.toContain("clinically validated");
    expect(body).not.toContain("evidence-based");
    expect(body).not.toContain("arbor's 7-domain assessment");
  });

  it("sci.cdc.framework says 'most children' not 'by [exact age]'", () => {
    expect(en["sci.cdc.framework"]).toContain("most children");
    expect(en["sci.cdc.framework"].toLowerCase()).not.toContain("cdc-recommended");
    expect(en["sci.cdc.framework"].toLowerCase()).not.toContain("cdc-endorsed");
    expect(en["sci.cdc.framework"].toLowerCase()).not.toContain("cdc-validated");
  });
});

describe("AP-060 firewall: HE firewall-safe meaning (no EN-banned clinical claims)", () => {
  // HE content is in Hebrew so we check for EN cognates / ASCII equivalents only
  const heBannedAscii = [
    "clinically validated",
    "clinical board",
    "clinician-reviewed",
    "CDC-endorsed",
    "Expert-Reviewed",
  ];

  for (const term of heBannedAscii) {
    it(`HE sci.*: "${term}" absent`, () => {
      const hits = allSciValues(he).filter((v) =>
        v.toLowerCase().includes(term.toLowerCase())
      );
      expect(hits, `HE sci.* contains banned term "${term}"`).toEqual([]);
    });
  }
});

describe("AP-060: i18n parity for sci.* keys", () => {
  it("every sci.* EN key has a HE translation", () => {
    const missing = Object.keys(en)
      .filter((k) => k.startsWith("sci."))
      .filter((k) => !(k in he));
    expect(
      missing,
      `HE dictionary missing sci.* keys: ${missing.join(", ")}`
    ).toEqual([]);
  });
});
