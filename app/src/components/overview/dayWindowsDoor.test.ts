/**
 * B-TODAY-13 — Day Windows consolidates into the RhythmCue line.
 *
 * #/day-windows keeps at least one live in-app door at every width (law 6):
 *   - 390: the Settings row (always present);
 *   - 1280: the Today pill (navigation.ts tools, hidden below md) + Settings;
 *   - plus the rhythm line's quiet "See the hours" link whenever the
 *     coordinator renders a PREP or CALM cue.
 * The old row inside Today's `ov.dailyTools` drawer is gone (the drawer itself
 * goes with B-TODAY-17).
 *
 * SOURCE-BASED, in the house pattern (todayConsolidation.test.ts): the vitest
 * env is node-only, so the shape that makes the acceptance true at runtime is
 * what gets pinned. Comments are stripped first, so prose cannot make any
 * assertion pass.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he, translate } from "../../lib/i18n";
import { COMPACT_HIDDEN_TOOLS, SECTIONS } from "../../lib/navigation";
import { todayLiveSource } from "../../testTodaySource";

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string): string =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const OVERVIEW = stripComments(todayLiveSource());
const SETTINGS = stripComments(read("components/layout/SettingsModal.tsx"));
const CUE = stripComments(read("components/coach/RhythmCue.tsx"));

/** The `<button …>` tag that carries `marker`. */
function buttonTagWith(source: string, marker: string): string {
  const at = source.indexOf(marker);
  expect(at, `${marker} not found`).toBeGreaterThan(-1);
  const open = source.lastIndexOf("<button", at);
  const close = source.indexOf(">", source.indexOf("className", at));
  return source.slice(open, close);
}

describe("B-TODAY-13 — the rhythm line is the Day Windows door on Today", () => {
  it("RhythmCue renders the link only for a PREP or CALM cue", () => {
    expect(CUE).toMatch(/\(visible\.kind === "prep" \|\| visible\.kind === "calm"\) && \(/);
    expect(CUE).toContain('setActiveTab("day-windows")');
    expect(CUE).toContain('data-testid="rhythm-cue-day-windows"');
  });

  it("the link is a text link with the 44 px floor on the control, never a filled CTA", () => {
    const tag = buttonTagWith(CUE, 'data-testid="rhythm-cue-day-windows"');
    expect(tag).toContain("min-h-[44px]");
    expect(tag).toContain("underline");
    expect(tag).not.toMatch(/background|gradient/);
  });

  it("EN and HE copy, transcreated", () => {
    expect(CUE).toContain('t("elev.today.dw.link")');
    expect(translate("en", "elev.today.dw.link")).toBe("See the hours");
    expect(translate("he", "elev.today.dw.link")).toBe("לשעות היום");
  });

  it("Today's drawer no longer carries a Day Windows row", () => {
    expect(OVERVIEW).not.toContain('setActiveTab("day-windows")');
    expect(OVERVIEW).not.toContain("today-open-day-windows");
  });
});

describe("law 6 — #/day-windows keeps a door at 390 and at 1280", () => {
  it("390: the Settings row stays, with its own keys and 44 px", () => {
    expect(SETTINGS).toContain('setActiveTab("day-windows")');
    const tag = buttonTagWith(SETTINGS, 'data-testid="settings-open-day-windows"');
    expect(tag).toContain("min-h-11");
    for (const key of ["dw.title", "dw.cta"] as const) {
      expect(en[key], `EN ${key}`).toBeTruthy();
      expect(he[key], `HE ${key}`).toBeTruthy();
      expect(he[key]).not.toBe(en[key]);
    }
  });

  it("1280: the Today pill stays (hidden only below md)", () => {
    const today = SECTIONS.find((s) => s.id === "today");
    const tabs = JSON.stringify(today);
    expect(tabs).toContain('"day-windows"');
    expect(COMPACT_HIDDEN_TOOLS.today).toContain("day-windows");
  });
});

describe("negative control — the guard fails on the pre-fix shapes", () => {
  it("a cue without the link has no day-windows door", () => {
    const PRE = `<button type="button" onClick={() => { setActiveTab(visible.action); }} className="min-h-[44px]">{t(visible.ctaKey)}</button>`;
    expect(PRE).not.toContain('data-testid="rhythm-cue-day-windows"');
    expect(PRE).not.toMatch(/visible\.kind === "prep"/);
  });

  it("the pre-fix drawer row would trip the drawer assertion", () => {
    const PRE_DRAWER = `<button type="button" onClick={() => setActiveTab("day-windows")} data-testid="today-open-day-windows" className="flex w-full min-h-11">`;
    expect(PRE_DRAWER).toContain('setActiveTab("day-windows")');
  });
});
