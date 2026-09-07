/**
 * OBJ-KID-02 (law 3) — the parent door shows EARNED effort badges and a count.
 *
 * `#/journey` used to render all twelve achievement cards, the unearned ones at
 * `opacity: 0.58`, each still carrying its requirement line. That is a greyed
 * silhouette wall: the same pressure mechanic law 3 bans in Kid Mode, moved onto
 * the parent door. The fix is the pattern already used for the earned chips —
 * render what was earned, and report the rest as a count ("N of 12 effort badges
 * earned"), which is also what the stat card above it already does.
 *
 * The Kid Mode half of the item (the 🔒 "All-rounder" locked-next chip in
 * HeroArcade) is guarded by the `lock-glyph` rule in lib/kidRegisterScan.test.ts.
 *
 * Source guard rather than a render: JourneyTab pulls ArborContext,
 * LanguageContext, useChildCollection and usePracticeData, so a jsdom mount
 * would assert against four layers of mocks rather than against the component.
 * Each rule below carries the pre-fix line as its negative control.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../../lib/i18nElevation/kidRegister";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "JourneyTab.tsx"), "utf8");

/** A fractional opacity written into an inline style — a dimmed card. */
const DIMMED = /opacity:\s*(?:0?\.\d+|[a-zA-Z][\w.]*\s*\?\s*1\s*:\s*0?\.\d+)/g;
/** Mapping the FULL achievement list into cards (rather than the earned subset). */
const RENDERS_ALL = /achievements\.map\(/g;

const PRE_FIX_CARD =
  '<div key={a.id} className={`${cardCls} p-4`} style={{ opacity: a.earned ? 1 : 0.58 }}>';
const PRE_FIX_LIST = "{achievements.map((a) => (";

describe("OBJ-KID-02 — journey effort badges: earned-only plus a count", () => {
  it("negative control: the rules catch the exact pre-fix lines", () => {
    expect([...PRE_FIX_CARD.matchAll(DIMMED)].length).toBe(1);
    expect([...PRE_FIX_LIST.matchAll(RENDERS_ALL)].length).toBe(1);
    // …and a full-opacity card is not a false positive.
    expect(
      [...'<div key={a.id} className={`${cardCls} p-4`}>'.matchAll(DIMMED)].length,
    ).toBe(0);
  });

  it("no achievement card is dimmed (the motion entrance opacity is not an inline style)", () => {
    const hits = [...src.matchAll(DIMMED)].map((m) => m[0]);
    expect(hits, `dimmed card style(s) in JourneyTab.tsx: ${hits.join(", ")}`).toEqual([]);
  });

  it("the achievements grid maps the EARNED subset, never the full list", () => {
    expect(src).toContain("earnedAchievements.map(");
    const hits = [...src.matchAll(RENDERS_ALL)].map((m) => m[0]);
    expect(hits, "JourneyTab still renders a card per unearned badge").toEqual([]);
  });

  it("the unearned remainder is reported as a count line, in EN and HE", () => {
    expect(src).toContain('t("elev.practice.journey.badgesEarned"');
    for (const dict of [en, he]) {
      const v = dict["elev.practice.journey.badgesEarned"];
      expect(v, "badgesEarned missing a locale").toBeTruthy();
      expect(v).toContain("{n}");
      expect(v).toContain("{total}");
      expect(v, "a count line never carries a percentage").not.toContain("%");
    }
  });

  it("law 3: the door names no next badge to chase", () => {
    for (const banned of ["Next badge", "Locked", "🔒", "coming soon", "Coming soon"]) {
      expect(src, `${banned} is a locked-next affordance`).not.toContain(banned);
    }
  });
});
