import { describe, it, expect } from "vitest";
import { en, he, translate } from "./i18n";

// F7 / AR-UX-IDN-01 — a child's RTL name interpolated into a template must be wrapped
// in Unicode bidi isolates (FSI U+2068 … PDI U+2069) so mixed-direction text can't
// reorder. Pure-LTR/numeric values must stay untouched so nothing else shifts.
describe("bidi isolation of interpolated names", () => {
  it("wraps an RTL (Hebrew) value in FSI…PDI", () => {
    const out = translate("en", "nudge.log.headline", { name: "נועה" });
    expect(out).toContain("⁨נועה⁩");
  });
  // STILL A REAL INVARIANT after R22g, and now for a stated reason rather than
  // by accident: a Latin value in an ENGLISH template is same-script, so it is
  // laid out correctly by the paragraph it is already in and must not be
  // wrapped. What changed is that "unwrapped" is now a judgement about the
  // template's language, not a property of the value alone.
  it("leaves a plain LTR value unwrapped in an LTR template (same script)", () => {
    const out = translate("en", "nudge.log.headline", { name: "Dylan" });
    expect(out).not.toContain("⁨");
    expect(out).toContain("Dylan");
  });
  it("leaves a numeric value unwrapped", () => {
    const out = translate("en", "rhythm.daysToGo", { n: 8 });
    expect(out).not.toContain("⁨");
    expect(out).toContain("8");
  });

  /* R22g (Builder M) — the mirror case. isolate() wrapped RTL-bearing values
     only, so a LATIN value dropped into a HEBREW template was laid out by the
     RTL paragraph and glued to the preposition before it: `plan.phaseProgress`
     rendered "אתם בPhase 1" on #/plans and "על Dylan" on #/consult. translate()
     now passes its own `lang` to isolate(), so the foreign script is decided by
     the reader's paragraph direction in BOTH directions. */
  it("wraps a Latin value dropped into a Hebrew template (the אתם בPhase 1 bug)", () => {
    const out = translate("he", "plan.phaseProgress", { phase: "Phase 1", current: 1, total: 3 });
    expect(out).toContain("⁨Phase 1⁩");
  });

  it("leaves a Hebrew value unwrapped in a Hebrew template (same script)", () => {
    const out = translate("he", "nudge.log.headline", { name: "נועה" });
    expect(out).not.toContain("⁨");
    expect(out).toContain("נועה");
  });

  it("leaves a numeric value unwrapped in a Hebrew template too", () => {
    const out = translate("he", "rhythm.daysToGo", { n: 8 });
    expect(out).not.toContain("⁨");
  });

  /* NEGATIVE CONTROL — the pre-fix function, pasted. It is the one-directional
     `RTL_CHARS.test(value)` rule with no `lang`, and it FAILS the assertion
     above: proof the new case is really guarded and not passing for some other
     reason. */
  it("negative control: the pre-fix one-directional isolate leaves the Latin phase glued", () => {
    const RTL_CHARS = /[֐-׿؀-ۿ܀-ݏ]/;
    const preFixIsolate = (value: string) => (RTL_CHARS.test(value) ? `⁨${value}⁩` : value);
    const template = he["plan.phaseProgress"];
    expect(template, "the template this bug was measured on must still exist").toContain("{phase}");
    const preFix = template.replace("{phase}", preFixIsolate("Phase 1"));
    expect(preFix).not.toContain("⁨Phase 1⁩");
  });
});

// CIL build wave #5 — closes the Hebrew-leak class permanently.
// Root cause (CIL cycle 2026-06-21): later tabs were built with hard-coded EN
// strings; ~60 test files mock t() but NONE asserted en/he key parity, so a
// dropped HE key silently fell back to English and never failed CI. These
// assertions make that a hard build failure instead of a silent leak.
describe("i18n en/he dictionary parity", () => {
  const enKeys = Object.keys(en);
  const heKeys = Object.keys(he);

  it("every English key has a Hebrew translation (no silent EN fallback)", () => {
    const missingInHe = enKeys.filter((k) => !(k in he));
    expect(missingInHe, `Hebrew dictionary is missing ${missingInHe.length} key(s): ${missingInHe.join(", ")}`).toEqual([]);
  });

  it("every Hebrew key maps to a live English key (no orphan HE keys)", () => {
    const orphanInHe = heKeys.filter((k) => !(k in en));
    expect(orphanInHe, `Hebrew dictionary has ${orphanInHe.length} orphan key(s) with no English counterpart: ${orphanInHe.join(", ")}`).toEqual([]);
  });

  it("no key has an empty value in either language", () => {
    const emptyEn = enKeys.filter((k) => en[k].trim() === "");
    const emptyHe = heKeys.filter((k) => he[k].trim() === "");
    expect([...emptyEn, ...emptyHe], `empty values — en:[${emptyEn.join(", ")}] he:[${emptyHe.join(", ")}]`).toEqual([]);
  });
});
