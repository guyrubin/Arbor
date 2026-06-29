import { describe, expect, it } from "vitest";
import { translate } from "./i18n";

/* CI-08 — the canonical non-diagnostic honesty line. One string every
 * developmental surface inherits, present in EN + HE, and never claiming
 * "clinically validated" (clinical board / arbor-safety, 2026-06-21). */

const KEYS = ["honesty.signal", "honesty.grounded"] as const;

describe("CI-08 canonical honesty line", () => {
  it("exists in English (not falling back to the key)", () => {
    for (const k of KEYS) expect(translate("en", k)).not.toBe(k);
  });

  it("has a real Hebrew translation (parity, distinct from English)", () => {
    for (const k of KEYS) {
      const he = translate("he", k);
      expect(he, k).not.toBe(k); // present
      expect(he, k).not.toBe(translate("en", k)); // actually translated, not EN fallback
    }
  });

  it("frames a signal-to-discuss, not a diagnosis", () => {
    expect(translate("en", "honesty.signal").toLowerCase()).toContain("not a diagnosis");
  });

  it("says grounded-in, never 'clinically validated' / 'clinician-endorsed'", () => {
    for (const k of KEYS) {
      const en = translate("en", k).toLowerCase();
      expect(en).not.toMatch(/clinically validated|clinician[- ]endorsed|clinically proven/);
    }
    expect(translate("en", "honesty.grounded").toLowerCase()).toContain("grounded in");
  });
});
