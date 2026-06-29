import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = (...parts: string[]) => readFileSync(resolve(process.cwd(), "src", ...parts), "utf8");

describe("language settings canonical surface", () => {
  it("keeps the whole-app language switch inside Settings only", () => {
    const shell = src("components", "layout", "Shell.tsx");
    const coach = src("components", "tabs", "CoachTab.tsx");
    const settings = src("components", "layout", "SettingsModal.tsx");

    expect(shell).not.toContain("setUiLang(");
    expect(shell).not.toContain("Switch to English");
    expect(shell).not.toContain("Switch to Hebrew");
    expect(coach).not.toContain("setAiLang(");
    expect(coach).not.toContain("coach.aiLang.label");
    expect(settings).toContain("set.language.title");
    expect(settings).toContain("setUiLang(");
    // The advanced AI-language override must live INSIDE Settings (never a Coach/topbar switch).
    expect(settings).toContain("setAiLang(");
    expect(settings).toContain("set.aiLang.toggle");
  });

  it("makes Settings an explicit save/cancel system-control panel", () => {
    const settings = src("components", "layout", "SettingsModal.tsx");
    const i18n = src("lib", "i18n.ts");

    for (const key of [
      "set.section.languageAppearance",
      "set.section.notifications",
      "set.section.privacyTrust",
      "set.language.save",
      "set.language.saved",
    ]) {
      expect(i18n).toContain(key);
    }
    expect(settings).toContain("draftUiLang");
    // Dirty when the app language changed OR the effective AI language changed.
    expect(settings).toContain("draftUiLang !== uiLang || effectiveAiLang !== aiLang");
    expect(settings).toContain("min-h-[44px] min-w-[44px]");
    expect(settings).toContain("handleSaveLanguage");
    expect(settings).toContain("handleCancelLanguage");
  });

  it("offers an in-Settings advanced AI-language override (decoupled from app language)", () => {
    const settings = src("components", "layout", "SettingsModal.tsx");
    const i18n = src("lib", "i18n.ts");
    // Override state + effective-language derivation present.
    expect(settings).toContain("draftAiDifferent");
    expect(settings).toContain("effectiveAiLang");
    // Reuses the (previously orphaned) AI-language strings; toggle label exists in both dicts.
    expect(i18n).toContain("set.aiLang.toggle");
    expect(i18n).toContain("set.aiLang.title");
    // The dead Coach/topbar language keys are gone (consolidation stays clean).
    expect(i18n).not.toContain("coach.aiLang.label");
    expect(i18n).not.toContain('"top.language"');
  });
});
