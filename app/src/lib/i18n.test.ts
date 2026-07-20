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
  it("leaves a plain LTR value unwrapped", () => {
    const out = translate("en", "nudge.log.headline", { name: "Dylan" });
    expect(out).not.toContain("⁨");
    expect(out).toContain("Dylan");
  });
  it("leaves a numeric value unwrapped", () => {
    const out = translate("en", "rhythm.daysToGo", { n: 8 });
    expect(out).not.toContain("⁨");
    expect(out).toContain("8");
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
