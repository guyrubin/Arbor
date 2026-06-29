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
    expect(settings).toContain("draftUiLang !== uiLang || draftUiLang !== aiLang");
    expect(settings).toContain("min-h-[44px] min-w-[44px]");
    expect(settings).toContain("handleSaveLanguage");
    expect(settings).toContain("handleCancelLanguage");
  });
});
