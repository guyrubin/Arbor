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
 *  - The "How Arbor helps" rail toggle rendered at every width while AiRail is
 *    `hidden 2xl:flex` and Shell only opens the third grid column at 2xl — a
 *    switch that changed a value nothing could render. PLAT-3 already pins the
 *    Topbar toggle to that breakpoint; this row was the site it missed.
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
const aiRail = read("../layout/AiRail.tsx");
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

  it("negative control: the borrowed key still reads 'Open profile'", () => {
    expect(translate("en", "set.data.open")).toBe("Open profile");
    // Which is still correct on the row it was written for.
    expect(settings).toContain('t("set.data.open")');
  });
});

describe("3 · the rail toggle exists only where the rail can render (PLAT-3)", () => {
  const railBp = aiRail.match(/hidden (2?xl|lg|md):flex/)?.[1];
  const gridBp = shell.match(/(2?xl|lg|md):grid-cols-\[[^\]]*_320px\]/)?.[1];
  const rowBp = settings.match(/hidden (2?xl|lg|md):block" data-testid="settings-rail-row"/)?.[1];

  it("the guard finds all three breakpoints (it stays honest)", () => {
    expect(railBp, "AiRail breakpoint not found").toBeDefined();
    expect(gridBp, "Shell third-column breakpoint not found").toBeDefined();
    expect(rowBp, "Settings rail-row breakpoint not found").toBeDefined();
  });

  it("the Settings row shares the rail's breakpoint exactly", () => {
    expect(rowBp).toBe(railBp);
    expect(rowBp).toBe(gridBp);
    expect(rowBp).toBe("2xl");
  });

  it("negative control: the shipped row carried no breakpoint at all", () => {
    // As shipped the Row was a bare sibling of the other Section rows, so it
    // rendered at 390 and 1280 where the rail cannot exist.
    const bare = '<Row icon={<Icon name="auto_awesome" size={18} />} title={t("set.rail.title")}';
    const idx = settings.indexOf(bare);
    expect(idx).toBeGreaterThan(-1);
    // …and it is now wrapped: the 2xl gate opens within the preceding lines.
    expect(settings.slice(Math.max(0, idx - 400), idx)).toContain('hidden 2xl:block" data-testid="settings-rail-row"');
  });
});
