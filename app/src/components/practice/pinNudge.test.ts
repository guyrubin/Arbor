/**
 * B-PLAY-06 — the PIN ask on #/practice is a button. (Parity 9 Oct: #/practice
 * is Together. v3 F-TOG-1 re-pin: the one-time nudge folded into Together's gate
 * card, which says "set a PIN" and offers Parent settings while none is set.)
 *
 * It was a static <p> ending "… · Settings": a parent had to find Settings and
 * then the PIN row on their own. It is a 44 px button that asks the shell to
 * open Settings with the PIN row scrolled into view (settingsBus focus).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { consumeSettingsFocus, requestOpenSettings, SETTINGS_FOCUS_ANCHOR, SETTINGS_OPEN_EVENT } from "../layout/settingsBus";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");
const studio = read("../companion/TogetherView.tsx");
const css = read("../companion/companionExperience.css");
const settings = read("../layout/SettingsModal.tsx");

describe("B-PLAY-06 · the PIN ask is a button that lands on the PIN row", () => {
  const at = studio.indexOf('data-testid="together-gate-pin"');
  const tagStart = studio.lastIndexOf("<", at);
  const tag = studio.slice(tagStart, studio.indexOf("</button>", at));

  it("the gate card's PIN ask sits on a <button> (not a <p>), at the 44 px floor", () => {
    expect(at).toBeGreaterThan(-1);
    expect(tag).toMatch(/^<button\b/);
    expect(tag).toContain('type="button"');
    expect(tag).toContain('className="companion-text-button"');
    expect(css).toContain(".companion-page button, .companion-preview button { min-block-size: var(--touch-min);");
  });

  it("it opens Settings with the pin focus, only while no PIN is set", () => {
    expect(tag).toContain('onClick={() => requestOpenSettings({ focus: "pin" })}');
    expect(studio).toContain('{!pinSet && <button type="button" className="companion-text-button" data-testid="together-gate-pin"');
    expect(studio).not.toContain("markPinNudgeShown");
  });

  it("negative control: the pre-fix static line ended in '· Settings'", () => {
    const preFix = '{t("elev.gate.set.sub")} {t("elev.gate.set.cta")} · {t("nav.settings")}';
    expect(studio).not.toContain(preFix);
    expect(/^<p\b/.test('<p\n          data-testid="gate-pin-nudge"')).toBe(true);
  });

  it("Settings carries the anchor around the ParentalGatePanel and scrolls to it on open", () => {
    const anchor = settings.indexOf(`data-testid="${SETTINGS_FOCUS_ANCHOR.pin}"`);
    expect(anchor).toBeGreaterThan(-1);
    expect(settings.indexOf("<ParentalGatePanel />", anchor)).toBeGreaterThan(anchor);
    expect(settings).toContain("const focus = consumeSettingsFocus();");
    expect(settings).toContain("scrollIntoView(");
  });
});

describe("B-PLAY-06 · settingsBus focus is a one-shot slot", () => {
  it("requestOpenSettings({focus}) dispatches the open event and holds the focus until consumed once", () => {
    const dispatch = vi.fn();
    vi.stubGlobal("window", { dispatchEvent: dispatch });
    vi.stubGlobal("CustomEvent", class { type: string; constructor(type: string) { this.type = type; } });
    requestOpenSettings({ focus: "pin" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect((dispatch.mock.calls[0][0] as { type: string }).type).toBe(SETTINGS_OPEN_EVENT);
    expect(consumeSettingsFocus()).toBe("pin");
    expect(consumeSettingsFocus()).toBeNull();
    // A plain open (the More sheet's door) carries no focus.
    requestOpenSettings();
    expect(consumeSettingsFocus()).toBeNull();
    vi.unstubAllGlobals();
  });
});
