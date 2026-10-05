/**
 * B-KID-70 (R-5) — the Kid Mode "Look" picker: parent Settings › Kid Mode,
 * single-select over the SELECTABLE themes only, hidden while one passes the
 * coverage gate, persisted per child (ChildProfile.kidTheme), EN + HE.
 * Static (no jsdom in this repo); the rendered check is Fable's pass.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { en, he } from "../../lib/i18n";
import { KID_THEME_IDS, selectableThemes } from "../../lib/kidThemeManifest";

const settings = readFileSync(path.join(__dirname, "SettingsModal.tsx"), "utf8");
const kidSection = settings.slice(settings.indexOf('t("set.section.kidModePin")'), settings.indexOf('t("set.section.billing")'));

describe("R-5: the Look picker", () => {
  it("lives in the Kid Mode section, gated on a real choice", () => {
    expect(kidSection).toContain('data-testid="settings-kid-look"');
    expect(kidSection).toContain("{kidLooks.length > 1 && childProfile && (");
    expect(settings).toContain("const kidLooks = selectableThemes();");
  });
  it("is a single-select radiogroup that writes the active child's kidTheme", () => {
    expect(kidSection).toContain('role="radiogroup"');
    expect(kidSection).toContain('role="radio"');
    expect(kidSection).toContain("aria-checked={kidLook === look}");
    expect(kidSection).toContain("updateChild(childProfile.id, { kidTheme: look })");
    expect(kidSection).toContain('className="px-3 min-h-11'); // 44 px target
  });
  it("today both themes cover every rendered slot, so the row shows", () => {
    expect(selectableThemes().length).toBeGreaterThan(1);
  });
  it("EN + HE for the row and every theme name; HE is Hebrew", () => {
    const keys = ["set.kidLook.title", "set.kidLook.sub", ...KID_THEME_IDS.map((t) => `set.kidLook.${t}`)];
    for (const k of keys) {
      expect((en as Record<string, string>)[k], `en ${k}`).toBeTruthy();
      expect((he as Record<string, string>)[k], `he ${k}`).toMatch(/[֐-׿]/);
    }
    expect((en as Record<string, string>)["set.kidLook.title"]).toContain("{name}");
    expect((he as Record<string, string>)["set.kidLook.title"]).toContain("{name}");
  });
});
