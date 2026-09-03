/**
 * GP-08 / GP-09 / RUN-02 — ONE age window app-wide.
 *
 * `milestoneAgeWindow(comparisonMonths)` = the child's current CDC band plus
 * the one before it (unanchored items count). Every parent-facing denominator
 * ("x of y noticed"), every "worth watching next" pick and the consult packet
 * window against it — never the whole 0–6y catalogue, which printed "0 of 133"
 * on day 0 and told a 5-year-old's parent to watch for "Smiles at people".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Milestone } from "../types";
import {
  ALL_MILESTONES,
  ageWindowMilestones,
  bandForAgeMonths,
  milestoneAgeWindow,
  selectNextMilestones,
  selectWeeklyFocus,
} from "./milestoneData";
import { milestoneInAgeWindow } from "../consult/packet";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** The 0–12-month titles a kindergartener's parent must never be pointed at. */
const infantTitles = new Set(ALL_MILESTONES.filter((m) => (m.ageMonths ?? 999) <= 12).map((m) => m.title));

/** The pre-fix "next" selector (ChildProfile.tsx before RUN-02). */
const unbandedNext = (ms: Milestone[]) => ms.filter((m) => !m.checked).slice(0, 3);

describe("milestoneAgeWindow — current band + one earlier", () => {
  it("a 60-month-old's window is the 5y band + the 4y band", () => {
    const w = milestoneAgeWindow(60);
    expect(w.currentBandMonths).toBe(60);
    expect(w.earlierBandMonths).toBe(48);
    expect(w.label).toBe("5 years");
    expect(w.includes(60)).toBe(true);
    expect(w.includes(50)).toBe(true); // 4y band
    expect(w.includes(36)).toBe(false); // 3y band — two back
    expect(w.includes(72)).toBe(false); // ahead
    expect(w.includes(2)).toBe(false);
  });

  it("unanchored (custom/legacy) items always count", () => {
    expect(milestoneAgeWindow(9).includes(undefined)).toBe(true);
    expect(milestoneAgeWindow(60).includes(Number.NaN)).toBe(true);
  });

  it("the first band has no earlier band — the window is just that band", () => {
    const w = milestoneAgeWindow(0);
    expect(w.currentBandMonths).toBe(bandForAgeMonths(0).months);
    expect(w.earlierBandMonths).toBe(w.currentBandMonths);
  });

  it("the consult packet's milestoneInAgeWindow IS the shared helper (single derivation)", () => {
    for (const m of ALL_MILESTONES) {
      for (const age of [0, 5, 9, 15, 30, 60, 84]) {
        expect(milestoneInAgeWindow(m.ageMonths, age)).toBe(milestoneAgeWindow(age).includes(m.ageMonths));
      }
    }
    const packet = stripComments(read("consult/packet.ts"));
    expect(packet).toMatch(/milestoneAgeWindow\(childAgeMonths\)\.includes\(milestoneAgeMonths\)/);
    expect(packet).not.toMatch(/const MILESTONE_BAND_MONTHS/);
  });
});

describe("GP-08 — the 60-month fixture: no 0–12-month title in any counted denominator", () => {
  it("ageWindowMilestones over the seeded catalogue carries no infant title", () => {
    const inWindow = ageWindowMilestones(ALL_MILESTONES, 60);
    expect(inWindow.length).toBeGreaterThan(0);
    expect(inWindow.length).toBeLessThan(ALL_MILESTONES.length);
    expect(inWindow.filter((m) => infantTitles.has(m.title))).toEqual([]);
  });

  it("a 6-month-old's denominator is bounded by the ≤12-month items", () => {
    const inWindow = ageWindowMilestones(ALL_MILESTONES, 6);
    expect(inWindow.length).toBeLessThanOrEqual(ALL_MILESTONES.filter((m) => (m.ageMonths ?? 0) <= 12).length);
    expect(inWindow.every((m) => (m.ageMonths ?? 0) <= 9)).toBe(true);
  });

  it("NEGATIVE CONTROL: the whole catalogue (the pre-fix denominator) DOES contain infant titles", () => {
    expect(ALL_MILESTONES.filter((m) => infantTitles.has(m.title)).length).toBeGreaterThan(10);
  });
});

describe("RUN-02 — the 60-month fixture: no 0–12-month title in any 'next' pick", () => {
  it("selectNextMilestones returns only 4–5y items, current band first", () => {
    const next = selectNextMilestones(ALL_MILESTONES, 60, 3);
    expect(next).toHaveLength(3);
    for (const m of next) {
      expect(infantTitles.has(m.title), `infant title "${m.title}" surfaced as a next pick`).toBe(false);
      expect(bandForAgeMonths(m.ageMonths as number).months).toBe(60);
    }
  });

  it("NEGATIVE CONTROL: the pre-fix unbanded selector surfaces newborn milestones", () => {
    const old = unbandedNext(ALL_MILESTONES);
    expect(old.some((m) => infantTitles.has(m.title))).toBe(true);
    expect(old.map((m) => m.title)).toContain("Calms when comforted");
  });

  it("'not sure' in the current band ranks ahead of untouched, and the earlier band comes after", () => {
    const fx: Milestone[] = [
      { id: "a", domain: "language_communication", ageGroup: "4 years", ageMonths: 48, title: "earlier-open", description: "", checked: false },
      { id: "b", domain: "language_communication", ageGroup: "5 years", ageMonths: 60, title: "current-open", description: "", checked: false },
      { id: "c", domain: "language_communication", ageGroup: "5 years", ageMonths: 60, title: "current-not-sure", description: "", checked: false, observationStatus: "not_sure" },
      { id: "d", domain: "language_communication", ageGroup: "5 years", ageMonths: 60, title: "current-done", description: "", checked: true },
      { id: "e", domain: "language_communication", ageGroup: "2 months", ageMonths: 2, title: "infant-open", description: "", checked: false },
    ];
    expect(selectNextMilestones(fx, 60, 5).map((m) => m.title)).toEqual(["current-not-sure", "current-open", "earlier-open"]);
  });

  it("selectWeeklyFocus is the head of the same list (single derivation)", () => {
    for (const age of [9, 20, 36, 60]) {
      const focus = selectWeeklyFocus(ALL_MILESTONES, age);
      const [head] = selectNextMilestones(ALL_MILESTONES, age, 1);
      expect(focus?.milestone.id).toBe(head?.id);
    }
  });

  it("ChildProfile derives its 'worth watching next' from selectNextMilestones, never filter(!checked).slice", () => {
    const code = stripComments(read("components/sections/ChildProfile.tsx"));
    expect(code).toMatch(/selectNextMilestones\(milestones, comparisonMonths, 3\)/);
    expect(code).not.toMatch(/milestones\.filter\(\(m\) => !m\.checked\)\.slice\(0, 3\)/);
  });
});

describe("GP-08 — every denominator surface counts the window, not the catalogue", () => {
  it("Development hero, Milestones map, Copilot picture, useDevScore and ChildProfile go through ageWindowMilestones", () => {
    for (const rel of [
      "components/tabs/DevelopmentTab.tsx",
      "components/tabs/MilestonesTab.tsx",
      "components/practice/DevelopmentCopilot.tsx",
      "components/sections/ChildProfile.tsx",
      "hooks/useDevScore.ts",
    ]) {
      const code = stripComments(read(rel));
      expect(code, `${rel} does not window its denominator`).toMatch(/ageWindowMilestones\(milestones, comparisonMonths\)/);
    }
  });

  it("the pre-fix all-ages denominators are gone", () => {
    const dev = stripComments(read("components/tabs/DevelopmentTab.tsx"));
    expect(dev).not.toMatch(/total:\s*milestones\.length/);
    const ms = stripComments(read("components/tabs/MilestonesTab.tsx"));
    expect(ms).not.toMatch(/RadialProgress value=\{checkedMilestones\} total=\{totalMilestones\}/);
    const profile = stripComments(read("components/sections/ChildProfile.tsx"));
    expect(profile).not.toMatch(/total:\s*totalMilestones/);
    const score = stripComments(read("hooks/useDevScore.ts"));
    expect(score).not.toMatch(/computeDevScore\(milestones\.map/);
  });
});

describe("GP-09 — later bands collapse behind 'Show later milestones'", () => {
  it("MilestonesTab collapses bands beyond current + next and offers the later toggle (en + he)", () => {
    const code = stripComments(read("components/tabs/MilestonesTab.tsx"));
    expect(code).toMatch(/const isLater = band\.months !== -1 && band\.months > nextBandMonths;/);
    expect(code).toMatch(/\(isLater && !openLaterBands\[band\.months\]\)/);
    expect(code).toContain('t("elev.growthTruth.ms.showLater")');
    // Pre-fix rule: only earlier bands ever collapsed.
    expect(code).not.toMatch(/const collapsed = isEarlier && !openEarlierBands\[band\.months\];/);
    const dict = read("lib/i18nElevation/growthTruth.ts");
    expect((dict.match(/"elev\.growthTruth\.ms\.showLater":/g) ?? []).length).toBe(2);
  });
});
