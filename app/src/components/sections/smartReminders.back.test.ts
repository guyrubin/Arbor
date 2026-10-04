/**
 * TJB-24 / IA-10 · OBJ-SHELL-07 · OBJ-SHELL-06 (item 29) — three controls that
 * did something other than what they said.
 *
 *  - Smart Reminders' "Back to Settings" called `setActiveTab("coach")`. Ask
 *    Arbor is neither where the parent came from nor what the label promised,
 *    and there is no Settings ROUTE to return to — Settings is a modal. The
 *    target is now the hub that owns the surface (Today, per navigation.ts
 *    SECTIONS `today.tools`) and the label says Today.
 *  - The Settings "Gentle Reminders" row borrowed `set.data.open`, so its
 *    button read "Open profile".
 *  - The "How Arbor helps" rail switch changed a value nothing could render
 *    below 2xl. B-SHELL-01 removed the rail and every switch for it.
 *
 * Source-level assertions: the vitest environment is node-only and these are
 * navigation targets, key identity and a Tailwind breakpoint — none of which a
 * server render would show more truthfully than the source does. Each has its
 * named negative control, written as the shipped expression.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";
import { SECTIONS } from "../../lib/navigation";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");
const panel = read("SmartRemindersPanel.tsx");
const settings = read("../layout/SettingsModal.tsx");
const shell = read("../layout/Shell.tsx");

describe("1 · the back control goes where its label says", () => {
  it("Smart Reminders returns to Today, not to Ask Arbor", () => {
    expect(panel).toContain('setActiveTab("overview")');
    expect(panel).not.toContain('setActiveTab("coach")');
  });

  it("Today is genuinely the hub that owns Smart Reminders", () => {
    const today = SECTIONS.find((s) => s.id === "today")!;
    const owns = [...today.items, ...(today.tools ?? [])].map((i) => i.tab);
    expect(owns).toContain("smart-reminders");
    // …and Ask Arbor does not.
    const ask = SECTIONS.find((s) => s.id === "ask")!;
    expect([...ask.items, ...(ask.tools ?? [])].map((i) => i.tab)).not.toContain("smart-reminders");
  });

  it("the label matches the destination, in both languages, and clears 44 px", () => {
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "elev.sr.back")).not.toBe("elev.sr.back");
    }
    expect(translate("en", "elev.sr.back")).toBe("Back to Today");
    expect(panel).toContain('t("elev.sr.back")');
    expect(panel).toMatch(/minHeight: 44, minWidth: 44/);
  });

  it("negative control: the shipped pair said Settings and went to coach", () => {
    expect(translate("en", "sr.back")).toBe("Back to Settings");
    // The old label is no longer read by this panel…
    expect(panel).not.toContain('t("sr.back")');
    // …and "Back to Settings" would have been a second lie against #/overview,
    // because no Settings route exists to return to.
    expect(shell).not.toMatch(/"settings":/);
  });
});

describe("2 · the Settings reminders row has its own verb", () => {
  it("the row opens reminders, and says so", () => {
    const row = /data-testid="settings-open-smart-reminders"[\s\S]{0,400}?<\/button>/.exec(settings)?.[0] ?? "";
    expect(row).not.toBe("");
    expect(row).toContain('t("elev.sr.open")');
    expect(row).not.toContain('t("set.data.open")');
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.sr.open")).not.toBe("elev.sr.open");
  });

  it("the borrowed key is gone with the row it was written for (B-CAREPRO-35)", () => {
    // The data row now opens Settings › Your data with its own verb; the
    // 'Open profile' key it used to carry is retired EN + HE.
    expect(translate("en", "set.data.open")).toBe("set.data.open");
    expect(translate("he", "set.data.open")).toBe("set.data.open");
    expect(settings).not.toContain('t("set.data.open")');
    expect(settings).toContain('t("elev.yourData.row.open")');
  });
});

describe("3 · the rail and its switch are gone (B-SHELL-01 supersedes PLAT-3)", () => {
  it("Settings has no rail row and the Shell grid has no rail track", () => {
    expect(settings).not.toContain("settings-rail-row");
    expect(settings).not.toContain('t("set.rail.title")');
    expect(shell).not.toMatch(/grid-cols-\[[^\]]*_320px\]/);
  });
});

/**
 * B-TODAY-02 — the contract line overclaimed delivery: "Arbor sends at most 2
 * nudges per day" while web delivers nothing outside the app and push has a
 * test route only. It now says "shows … inside the app".
 */
describe("B-TODAY-02 · the contract copy claims no sending", () => {
  const SEND = /\bsends?\b|\bsending\b|שולח|שולחת|שולחים/i;
  it("NEGATIVE CONTROL — the pre-fix copy trips the scan (EN + HE)", () => {
    expect(SEND.test("Arbor sends at most 2 nudges per day.")).toBe(true);
    expect(SEND.test("ארבור שולח לכל היותר 2 תזכורות ביום.")).toBe(true);
  });
  it("sr.max2 says 'inside the app' and contains no send verb", () => {
    for (const lang of ["en", "he"] as const) {
      const v = translate(lang, "sr.max2");
      expect(v).not.toBe("sr.max2");
      expect(v, `${lang}: ${v}`).not.toMatch(SEND);
    }
    expect(translate("en", "sr.max2")).toMatch(/inside the app/);
    expect(translate("he", "sr.max2")).toMatch(/בתוך האפליקציה/);
  });
  it("the switch copy names what each switch governs; the retired switches are gone", () => {
    for (const lang of ["en", "he"] as const) {
      for (const k of ["sr.types.moments.label", "sr.types.moments.desc", "sr.nextNudge.kind.bedtime"]) {
        expect(translate(lang, k), `${lang} ${k}`).not.toBe(k);
      }
      for (const k of ["sr.types.milestone.label", "sr.types.weekly.label"]) expect(translate(lang, k)).toBe(k);
    }
    expect(panel).toContain('bedtime:  "sr.nextNudge.kind.bedtime"');
    expect(panel).not.toMatch(/useNotifications|TopbarBell/);
  });
});
