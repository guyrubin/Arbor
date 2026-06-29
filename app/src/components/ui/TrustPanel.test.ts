import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = (...parts: string[]) => readFileSync(resolve(process.cwd(), "src", ...parts), "utf8");

// P0.5 — reusable trust pattern. The repo runs tests in the `node` environment with
// no jsdom/RTL, so these are source-contract assertions (same style as
// languageSettingsCanonical.test.ts), backed by the i18n parity gate for the copy.

describe("TrustPanel — reusable trust/consent pattern", () => {
  const panel = src("components", "ui", "TrustPanel.tsx");

  it("exports both the TrustPanel and the ReviewBeforeShare primitives", () => {
    expect(panel).toContain("export function TrustPanel");
    expect(panel).toContain("export function ReviewBeforeShare");
  });

  it("renders the three trust questions via i18n keys (uses / stores / you control)", () => {
    expect(panel).toContain("trust.uses.title");
    expect(panel).toContain("trust.stores.title");
    expect(panel).toContain("trust.controls.title");
  });

  it("mirrors in RTL and introduces no raw hex literal (holds the check:floors hex floor)", () => {
    expect(panel).toContain('dir="auto"');
    const hex = panel.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex).toEqual([]);
  });

  it("ReviewBeforeShare fires onApprove ONLY from the explicit Approve button", () => {
    // Approve is wired to a click handler...
    expect(panel).toContain("onClick={onApprove}");
    // ...and never auto-invoked (no bare onApprove() call anywhere in the file).
    expect(panel).not.toMatch(/onApprove\(\)/);
  });
});

describe("Avatar trust copy is localized (closes the Hebrew trust-copy gap)", () => {
  const avatar = src("components", "profile", "AvatarCreator.tsx");
  const i18n = src("lib", "i18n.ts");

  it("AvatarCreator no longer hardcodes the English privacy/consent strings", () => {
    expect(avatar).not.toContain("not a real photo");
    expect(avatar).not.toContain("never stored and never used to train AI");
    // It now reads them through the trust.* keys.
    expect(avatar).toContain("trust.avatar.notRealPhoto");
    expect(avatar).toContain("trust.avatar.consent.claim");
    expect(avatar).toContain("<TrustPanel");
  });

  it("every trust.* key exists in BOTH the en and he dictionaries", () => {
    for (const key of [
      "trust.uses.title",
      "trust.stores.title",
      "trust.controls.title",
      "trust.avatar.notRealPhoto",
      "trust.avatar.uses.1",
      "trust.avatar.stores.1",
      "trust.avatar.controls.1",
      "trust.avatar.consent.pre",
      "trust.avatar.consent.claim",
    ]) {
      const occurrences = i18n.split(`"${key}"`).length - 1;
      expect(occurrences, `${key} should appear in both en + he`).toBe(2);
    }
  });
});
