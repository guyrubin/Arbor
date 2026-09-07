import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path, { resolve } from "node:path";
import { translate } from "./i18n";

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

/**
 * OBJ-SHELL-02 (item 30) — ONE language canon, whole tree.
 *
 * Two ran side by side: the sidebar account popover carried 35x25 EN / עב
 * buttons that flipped the entire app the instant they were touched, while
 * Settings asks for a draft and an explicit Save. Same decision, two mechanics,
 * two mental models — and the popover's was the one a parent hit by accident.
 *
 * The guard is no longer a three-file allow-list (Shell, CoachTab, Settings):
 * every leak so far lived just off whatever list somebody was maintaining, so
 * this walks src/** and permits a `setUiLang(` CALL in exactly one place: the
 * panel that owns the decision. (LanguageContext defines it and calls its own
 * state setter, so it is not a caller.)
 */
describe("OBJ-SHELL-02 — setUiLang has exactly two homes in the whole tree", () => {
  const SRC = resolve(process.cwd(), "src");
  // Exactly one. LanguageContext DEFINES setUiLang (and calls setUiLangState),
  // so it is not a caller; Settings is the only surface that invokes it.
  const CALLERS_ALLOWED = ["components/layout/SettingsModal.tsx"];

  const files: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(p);
    }
  })(SRC);

  const callers = files
    .filter((f) => /setUiLang\s*\(/.test(readFileSync(f, "utf8")))
    .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
    .sort();

  it("no surface outside Settings changes the app language", () => {
    expect(callers).toEqual(CALLERS_ALLOWED.slice().sort());
  });

  it("negative control: the Sidebar popover WAS such a caller, and its toggles are gone", () => {
    const sidebar = src("components", "layout", "Sidebar.tsx");
    // The shipped popover: `onClick={() => setUiLang(l)}` with EN / עב buttons
    // and hardcoded English aria labels.
    expect(sidebar).not.toContain("setUiLang(");
    expect(sidebar).not.toContain("Switch to English");
    expect(sidebar).not.toContain("Switch to Hebrew");
    expect(sidebar).not.toContain("nav.popover.language");
    // The door to the canonical panel stays.
    expect(sidebar).toContain("nav.popover.settings");
    expect(sidebar).toContain("setShowSettings(true)");
    // Proof the guard would catch a reintroduction: the file it does allow.
    expect(callers).toContain("components/layout/SettingsModal.tsx");
  });

  it("the save confirmation is written in the language being switched TO", () => {
    const settings = src("components", "layout", "SettingsModal.tsx");
    expect(settings).toContain('translate(draftUiLang, "set.language.saved")');
    // `t(...)` here would be bound to the outgoing language for this render.
    expect(settings).not.toContain('toast(t("set.language.saved")');
    expect(translate("he", "set.language.saved")).not.toBe(translate("en", "set.language.saved"));
  });
});
