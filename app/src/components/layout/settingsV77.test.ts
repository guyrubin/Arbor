import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";

/** V77 fidelity audit (N-Settings-D/M). */
const src = readFileSync(new URL("./SettingsModal.tsx", import.meta.url), "utf8");
const section = (key: string) => {
  const at = src.indexOf(`<Section title={t("${key}")}`);
  return src.slice(at, src.indexOf("</Section>", at));
};

describe("Settings · V77 audit", () => {
  it("Cancel / Save language show only while a language choice waits", () => {
    expect(src).toContain("{languageDirty && <div className=\"flex items-center gap-2\">");
    // negative control: the pair is never rendered unconditionally
    expect(src).not.toMatch(/\n\s{12}<div className="flex items-center gap-2">\n\s+<button\n\s+onClick=\{handleCancelLanguage\}/);
  });
  it("the tone row reads the short 'Change' and keeps the full sentence as its name", () => {
    const row = src.slice(src.indexOf('data-testid="settings-tone-row"'), src.indexOf("</button>", src.indexOf('data-testid="settings-tone-row"')));
    expect(row).toContain('aria-label={t("coach.tone.change")}');
    expect(row).toContain('{t("elev.coachcontract.notice.change")}');
    expect(translate("he", "elev.coachcontract.notice.change")).not.toBe(translate("en", "elev.coachcontract.notice.change"));
  });
  it("the lock leads the Kid Mode & PIN section", () => {
    const s = section("set.section.kidModePin");
    const pin = s.indexOf('data-testid="settings-pin-row"');
    expect(pin).toBeGreaterThan(-1);
    // negative controls: the look and the bedtime rows come after it
    expect(s.indexOf('data-testid="settings-kid-look"')).toBeGreaterThan(pin);
    expect(s.indexOf('data-testid="settings-bedtime"')).toBeGreaterThan(pin);
  });
});
