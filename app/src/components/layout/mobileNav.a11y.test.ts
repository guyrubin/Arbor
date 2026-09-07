/**
 * IA-16 / IA-24 — the bottom bar is the one control surface that is always on
 * screen, and it was the least legible thing in the app.
 *
 * Measured at 390 (ledger-SHELL Screen A): the five labels rendered at 9–10 px
 * with `opacity: 0.72` on the four inactive slots — smaller than any other text
 * Arbor prints, dimmed on top of that, with no `aria-current` telling a screen
 * reader which tab is the current page and no sign of the unread coach count
 * the sidebar has always shown. IA-24: the More sheet is the only chrome a
 * parent can reach from any scroll position, and the Kid Mode door was not in
 * it — that door lived in the in-content strip, which is `position: static`.
 *
 * Source guards with pre-fix negative controls; the rendered sweep (contrast,
 * hit area at 390 EN and HE) stays the orchestrator's.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(path.join(here, file), "utf8").replace(/\r\n/g, "\n");
/** Prose about a banned pattern must not trip (or satisfy) a scan. */
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const nav = stripComments(read("MobileNav.tsx"));
/** The <nav> element only — the sheet below it has its own type scale. */
const bar = nav.slice(nav.indexOf("<nav"), nav.indexOf("</nav>"));

/** The pre-fix tab button, verbatim from 7208d0db — the negative control. */
const PRE_FIX_TAB = `
            <button
              key={sec.id}
              onClick={() => go(sec.id)}
              className={\`flex-1 flex flex-col items-center gap-0.5 py-2.5 font-bold transition \${emphasized ? "text-[10px]" : "text-[9px]"}\`}
              style={{
                color: on ? "var(--arbor-clay-deep)" : "var(--arbor-muted)",
                opacity: emphasized || on ? 1 : 0.72,
              }}
            >
`;

describe("IA-16 — nav labels are legible at 390", () => {
  it("the guard actually found the bar (stays honest)", () => {
    expect(bar.length).toBeGreaterThan(400);
    expect(bar).toContain("nav.short.");
  });

  it("every declared label size in the bar is at least 11 px", () => {
    // The tab/More BUTTON classNames only — the count badge riding the glyph
    // is a chip, not a label, and is measured by its own rule below.
    const labelClasses = [...bar.matchAll(/className=[{"`][^\n]*py-2\.5[^\n]*/g)].map((m) => m[0]);
    expect(labelClasses.length, "tab label classNames not found — update this guard").toBe(2);
    const sizes = labelClasses.flatMap((c) => [...c.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1])));
    // three: emphasized tabs, quiet tabs, and More.
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(12);
  });

  it("negative control: the pre-fix sizes fail the same assertion", () => {
    const sizes = [...PRE_FIX_TAB.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(sizes).toEqual([10, 9]);
    expect(Math.min(...sizes)).toBeLessThan(11);
  });

  it("no opacity dimming anywhere in the bar — emphasis is size and weight", () => {
    const DIMMED = /opacity:[^,}]*0\.\d|\bopacity-\d/;
    expect(DIMMED.test(bar)).toBe(false);
    // negative control: the scan does fire on the shipped expression.
    expect(DIMMED.test(PRE_FIX_TAB)).toBe(true);
  });
});

describe("IA-16 — the current tab announces itself", () => {
  it("both the primary tabs and More carry aria-current=page when active", () => {
    const current = [...bar.matchAll(/aria-current=\{[^}]*\?\s*"page"\s*:\s*undefined\}/g)];
    expect(current.length).toBe(2);
    expect(bar).toContain('aria-current={on ? "page" : undefined}');
    expect(bar).toContain('aria-current={overflowActive ? "page" : undefined}');
  });

  it("negative control: the pre-fix button had no aria-current at all", () => {
    expect(PRE_FIX_TAB).not.toContain("aria-current");
  });
});

describe("IA-16 — the unread coach count reaches the tab that opens the coach", () => {
  it("MobileNav imports the sidebar's own badge derivation, it does not fork one", () => {
    expect(nav).toContain('import { badgeText } from "./Sidebar";');
    expect(nav).toContain("badgeText(sec.badge, { milestonesNoticed, plansCount: actionPlans.length, unreadCoachCount })");
    expect(read("Sidebar.tsx")).toContain("export function badgeText(");
  });

  it("only the count badge renders — milestone/plan counts stay off the bar", () => {
    expect(bar).toContain('typeof sec.badge === "object" && sec.badge.kind === "count" && badge !== ""');
  });

  it("Ask Arbor is the section carrying the count badge (the source of the number)", () => {
    const navigation = readFileSync(path.join(here, "..", "..", "lib", "navigation.ts"), "utf8");
    const ask = navigation.slice(navigation.indexOf('id: "ask"'), navigation.indexOf('id: "behaviors"'));
    expect(ask).toContain('badge: { kind: "count" }');
  });

  it("CLINICAL FIREWALL: the badge renders the count and nothing else", () => {
    const badge = bar.slice(bar.indexOf("{showBadge &&"), bar.indexOf("{t(\"nav.short."));
    // the only interpolation inside the chip is the count string itself
    expect([...badge.matchAll(/\{([a-zA-Z.]+)\}/g)].map((m) => m[1])).toEqual(["badge"]);
    expect(badge).not.toMatch(/score|risk|verdict|percentile|behind|flagged/i);
    // and the number is a count of messages to the PARENT, never child data
    expect(bar).not.toContain("milestonesNoticed}");
  });
});

describe("IA-24 / IA-03 — the More sheet header holds the doors the strip cannot", () => {
  const header = nav.slice(nav.indexOf('aria-label={t("nav.popover.more")}'), nav.indexOf("grid grid-cols-2"));

  it("Kid Mode is reachable from the sheet (reuses KidModeButton, not a new door)", () => {
    expect(nav).toContain('import KidModeButton from "./KidModeButton";');
    expect(header).toContain("<KidModeButton compact />");
  });

  it("Settings is reachable from the sheet and asks the shell, which owns the state", () => {
    expect(nav).toContain('import { requestOpenSettings } from "./settingsBus";');
    expect(header).toContain("requestOpenSettings()");
    expect(header).toContain('aria-label={t("aria.settings")}');
    // …and it closes the sheet on the way, like every other row here.
    expect(header).toContain("setMoreOpen(false); requestOpenSettings()");
  });

  it("Shell no longer mounts a Settings button in the in-content strip", () => {
    const shell = stripComments(read("Shell.tsx"));
    const strip = shell.slice(shell.indexOf("actions={"), shell.indexOf("actions={") + 2200);
    expect(strip).not.toContain('aria-label={t("aria.settings")}');
    expect(strip).not.toContain("setSettingsOpen(true)");
  });

  it("every header control keeps the 44 px floor", () => {
    const buttons = header.split("<button").slice(1);
    expect(buttons.length, "sheet header buttons not found").toBeGreaterThanOrEqual(2);
    for (const b of buttons) {
      const open = b.slice(0, b.indexOf(">\n") + 1 || b.length);
      expect(open, open.replace(/\s+/g, " ").slice(0, 90)).toMatch(/w-11 h-11|min-h-11|min-h-\[44px\]|touch-target/);
    }
    // SafetyRing and KidModeButton carry their own floors, asserted in their
    // own guards (chromeLayout IA-01; KidModeButton compact is w-11 h-11).
    expect(read("KidModeButton.tsx")).toContain("w-11 h-11");
  });
});

describe("the settings seam is a one-way event, not a second owner of the state", () => {
  const bus = read("settingsBus.ts");

  it("requestOpenSettings dispatches; nothing in the bus holds open state", () => {
    expect(bus).toContain("window.dispatchEvent(new CustomEvent(SETTINGS_OPEN_EVENT))");
    expect(bus).not.toContain("useState");
    expect(bus).toContain('typeof window === "undefined"');
  });

  it("Shell re-checks the Kid Mode gate on the listener, exactly as it does for search", () => {
    const shell = stripComments(read("Shell.tsx"));
    expect(shell).toMatch(/const onSettingsRequest = \(\) => \{\s*\n\s*if \(isKidModeActive\(\)\) return;\s*\n\s*setSettingsOpen\(true\);/);
    expect(shell).toContain("window.addEventListener(SETTINGS_OPEN_EVENT, onSettingsRequest)");
    expect(shell).toContain("window.removeEventListener(SETTINGS_OPEN_EVENT, onSettingsRequest)");
  });
});
