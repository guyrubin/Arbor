import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOW_V10_COPY } from "../companion/now10/nowV10Copy";

/**
 * V73-V77 (N-Settings-D/M): the Gentle reminders row shows the reminders'
 * state (Now's own line: shown today, quiet hours) and one link out; the
 * controls live only on the Gentle reminders page.
 */
const src = readFileSync(new URL("./SettingsModal.tsx", import.meta.url), "utf8");
const row = src.slice(src.indexOf('title={t("sr.title")}') - 80, src.indexOf('data-testid="settings-open-smart-reminders"') + 60);

describe("Settings › Gentle reminders row", () => {
  it("prints the reminders' state, not the page's description", () => {
    expect(row).toContain("sub={reminderState}");
    expect(src).toMatch(/remindersSub\(shownNudgesToday\(\)\.length, clock24\(loadPrefs\(\)\.quietStart \* 60\)\)/);
    // negative control: the old static description no longer stands in for the state
    expect(row).not.toContain('sub={t("sr.subtitle")}');
  });
  it("keeps only the link out on the row (no switches or hour pickers in Settings)", () => {
    expect(row).toContain('data-testid="settings-open-smart-reminders"');
    expect(src).not.toMatch(/HourSelect|sr-quiet-start|prefs\.types\[/);
  });
  it("the state line exists in both languages and counts, never judges", () => {
    for (const lang of ["en", "he"] as const) {
      const line = NOW_V10_COPY[lang].remindersSub(0, "21:00");
      expect(line).toContain("21:00");
      expect(NOW_V10_COPY[lang].remindersSub(2, "21:00")).toContain("2");
    }
  });
});
