/**
 * Task 4 — #/day-windows has a canonical door on Today.
 *
 * TJB-25/IA-07 recorded the finding and fixed the symptom: Today's pill row
 * collapses below `md`, and that pill was the ONLY door to #/day-windows in the
 * whole app, so the route was unreachable at 390 (law 6). The repair was a
 * Settings row — reachable, but two levels deep and in the wrong hub for the
 * question the surface answers ("when is today likely calm?").
 *
 * The canonical door belongs on Today, inside the `ov.dailyTools` drawer, which
 * is the surface whose job is exactly "your daily tools". This guard pins it.
 *
 * SOURCE-BASED, in the house pattern (todayConsolidation.test.ts): the vitest
 * env is node-only, so the shape that makes the acceptance true at runtime is
 * what gets pinned. Comments are stripped first, so the prose above — which
 * names every string this file scans for — cannot make any assertion pass.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const OVERVIEW = stripComments(read("components/tabs/OverviewTab.tsx"));
const SETTINGS = stripComments(read("components/layout/SettingsModal.tsx"));

/** The drawer body: everything the `showTools` disclosure renders. */
function toolsDrawer(source: string): string {
  const open = source.indexOf("{showTools && (");
  expect(open, "the ov.dailyTools drawer was not found in OverviewTab").toBeGreaterThan(-1);
  // The drawer is the last block of the non-dayZero <section>; the QuickLogModal
  // that follows it is the honest terminator (it is outside the section).
  const end = source.indexOf("<QuickLogModal", open);
  expect(end).toBeGreaterThan(open);
  return source.slice(open, end);
}

describe("task 4 — the Day Windows door lives in Today's daily-tools drawer", () => {
  const drawer = toolsDrawer(OVERVIEW);

  it("the drawer opens the route itself, not a pill and not a settings hop", () => {
    expect(drawer).toContain('setActiveTab("day-windows")');
    expect(drawer).toContain('data-testid="today-open-day-windows"');
  });

  it("the row carries the 44 px floor on the control, not on a child of it", () => {
    const row = drawer.slice(drawer.indexOf('data-testid="today-open-day-windows"'));
    // The className sits on the same <button> as the testid; `min-h-11` is the
    // repo's 44 px floor (index.css --touch-min), and it must be on the button.
    const buttonOpen = drawer.lastIndexOf("<button", drawer.indexOf('data-testid="today-open-day-windows"'));
    const buttonTag = drawer.slice(buttonOpen, drawer.indexOf(">", drawer.indexOf("text-start", buttonOpen)));
    expect(buttonTag).toContain("min-h-11");
    expect(row.length).toBeGreaterThan(0);
  });

  it("it reuses the route's own shipped keys — no new copy, both locales", () => {
    expect(drawer).toContain('t("dw.title")');
    expect(drawer).toContain('t("dw.cta")');
    for (const key of ["dw.title", "dw.cta"] as const) {
      expect(en[key], `EN ${key}`).toBeTruthy();
      expect(he[key], `HE ${key}`).toBeTruthy();
      // Transcreated, not copied: the Hebrew must not be the English string.
      expect(he[key]).not.toBe(en[key]);
    }
  });

  it("the earlier doors are NOT removed — law 6, the route only gains a door", () => {
    expect(SETTINGS).toContain('setActiveTab("day-windows")');
    expect(SETTINGS).toContain('data-testid="settings-open-day-windows"');
  });

  it("the drawer is still not a budgeted module (it receives demoted ones)", () => {
    // Adding a row must not have turned the overflow container into a module:
    // todayModules.ts counts sibling modules, and the drawer is deliberately
    // outside that count. A data-module stamp inside it would corrupt the
    // rendered sweep for #/overview.
    expect(drawer).not.toContain("data-module");
  });
});

describe("negative control — the guard fails on the pre-task-4 drawer", () => {
  /** The drawer exactly as it shipped before this change: feed, play, check-in. */
  const PRE_FIX = `{showTools && (
            <div className="space-y-4">
              {activityFeed.length > 0 ? (
                <ul className="space-y-2.5" aria-label={t("today.feed.title", { name: firstName })}>
                </ul>
              ) : (
                <p className="px-1 text-[12px]">{t("today.feed.empty", { name: firstName })}</p>
              )}
              {!showPlayInline && todayChoice.kind !== "play" && playSection}
              <div className="max-w-[520px]">
                <DailyCheckinCard />
              </div>
            </div>
          )}
        </section>
      )}
      <QuickLogModal`;

  it("has no day-windows door, no testid and no 44 px row", () => {
    const drawer = toolsDrawer(PRE_FIX);
    expect(drawer).not.toContain('setActiveTab("day-windows")');
    expect(drawer).not.toContain('data-testid="today-open-day-windows"');
    expect(drawer).not.toContain('t("dw.title")');
  });

  it("the extractor is not vacuous — it returns the pre-fix drawer's real body", () => {
    const drawer = toolsDrawer(PRE_FIX);
    expect(drawer).toContain("DailyCheckinCard");
    expect(drawer).toContain("playSection");
  });
});
