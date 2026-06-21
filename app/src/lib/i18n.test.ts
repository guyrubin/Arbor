import { describe, it, expect } from "vitest";
import { en, he } from "./i18n";

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
