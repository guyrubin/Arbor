/**
 * B-SHELL-13 — Settings leads with "How Arbor works with you".
 *
 * Billing used to be section 1, so the first thing a parent met in Settings
 * was a price. The order is now: how Arbor works with you (language, AI
 * language, Reminders, Day Windows, What Arbor remembers) → Kid Mode & PIN →
 * plan → your data (Science, About, Your data) → admin → account. Every row
 * keeps its test id; the Reminders door moved, it was not duplicated.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../../lib/i18n";
import { formatBuildVersion } from "../../lib/buildVersion";

const here = path.dirname(fileURLToPath(import.meta.url));
const settings = readFileSync(path.join(here, "SettingsModal.tsx"), "utf8").replace(/\r\n/g, "\n");

const SECTION_ORDER = [
  "set.section.companion",
  "set.section.kidModePin",
  "set.section.billing",
  "set.section.childData",
  "set.section.admin",
  "elev.accountSettings.title",
];

/** Each section's source slice, by its title key. */
const sectionSlice = (key: string) => {
  const start = settings.indexOf(`<Section title={t("${key}")}`);
  const end = settings.indexOf("</Section>", start);
  return settings.slice(start, end);
};

describe("B-SHELL-13 · Settings section order", () => {
  it("the sections render in the pinned order, companion first", () => {
    const at = SECTION_ORDER.map((k) => settings.indexOf(`<Section title={t("${k}")}`));
    for (const [i, pos] of at.entries()) expect(pos, SECTION_ORDER[i]).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const first = settings.indexOf("<Section title={t(");
    expect(settings.slice(first, first + 60)).toContain('t("set.section.companion")');
  });

  it("section 1 holds language, AI language, Reminders, Day Windows and What Arbor remembers", () => {
    const s1 = sectionSlice("set.section.companion");
    for (const needle of [
      't("set.language.title")',
      't("set.aiLang.toggle")',
      'data-testid="settings-open-smart-reminders"',
      'data-testid="settings-open-day-windows"',
      'data-testid="settings-open-memory"',
    ]) expect(s1, needle).toContain(needle);
  });

  it("the Reminders door exists once (moved, not duplicated) and the old sections are gone", () => {
    expect(settings.match(/data-testid="settings-open-smart-reminders"/g)?.length).toBe(1);
    expect(settings).not.toContain('<Section title={t("set.section.notifications")}');
    expect(settings).not.toContain('<Section title={t("set.section.languageAppearance")}');
  });

  it("section 2 is the PIN row; section 4 is Science, About and Your data", () => {
    expect(sectionSlice("set.section.kidModePin")).toContain('data-testid="settings-pin-row"');
    const s4 = sectionSlice("set.section.childData");
    for (const id of ["settings-open-science", "settings-support-link", "settings-open-your-data"]) expect(s4).toContain(`data-testid="${id}"`);
  });

  it("every row keeps its test id", () => {
    for (const id of [
      "settings-pin-row", "settings-open-smart-reminders", "settings-open-day-windows",
      "settings-open-science", "settings-support-link", "settings-data-row", "settings-open-your-data",
      "plan-loading", "plan-unknown", "plan-unverified",
    ]) expect(settings, id).toContain(`data-testid="${id}"`);
  });

  it("What Arbor remembers counts pending + approved and opens the memory ledger", () => {
    expect(settings).toContain("const memoryCount = (pendingMemoryItems?.length ?? 0) + (approvedMemoryItems?.length ?? 0);");
    const s1 = sectionSlice("set.section.companion");
    expect(s1).toContain('setActiveTab("memory")');
  });

  it("the new keys exist in EN and HE, counts only", () => {
    for (const k of [
      "set.section.companion", "set.section.companionSub", "set.section.kidModePin", "set.section.kidModePinSub",
      "set.memory.title", "set.memory.sub.none", "set.memory.sub.one", "set.memory.sub.many", "set.memory.open",
    ]) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toBeTruthy();
      expect(he[k]).not.toBe(en[k]);
      expect(en[k]).not.toMatch(/%/);
    }
  });

  it("About shows the build-stamped version, never 0.0.0 (B-INF-05 define)", () => {
    expect(settings).toContain('t("elev.accountSettings.about.sub", { version: APP_BUILD })');
    expect(formatBuildVersion("9252c9c0a1b2c3d4")).toBe("9252c9c");
    expect(formatBuildVersion("9252c9c0a1b2c3d4")).not.toBe("0.0.0");
    const vite = readFileSync(path.join(here, "..", "..", "..", "vite.config.ts"), "utf8");
    expect(vite).toContain("__APP_VERSION__: JSON.stringify(formatBuildVersion(process.env.GITHUB_SHA))");
  });
});
