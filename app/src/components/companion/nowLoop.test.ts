import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Parity 9 Oct — the milestone loop lives on Now again. The companion rewrite
 * (7e25419e) left tabs/OverviewTab.tsx unmounted, and with it every seam below
 * had NO live caller in production (recordPracticeDose, scoreGoal,
 * recordFromRecordAnswer, the visit stamp, the today offer, the watch signal).
 * These pins tie each seam to the live Now tree, so a redesign cannot drop one
 * silently again: change the pin with the seam, never without it.
 */
const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const shell = read("components/layout/Shell.tsx");
const now = read("components/companion/NowView.tsx");
const loop = read("components/companion/useNowLoop.ts");
const blocks = read("components/companion/NowLoopBlocks.tsx");
const more = read("components/companion/NowMoreForToday.tsx");

describe("the loop is mounted where parents land", () => {
  it("#/overview renders NowView, and NowView runs the loop and its door", () => {
    expect(shell).toContain('const OverviewTab = lazy(() => import("../companion/NowView"));');
    expect(now).toContain("useNowLoop({");
    expect(now).toContain("<NowMoreForToday");
    for (const block of ["<NowPracticeLead", "<NowTonightLead", "<NowNoticeBlock", "<NowNoticeLead", "<NowTonightPointer"]) expect(now).toContain(block);
  });

  it("the runtime module budget is real again: the loop decides its blocks with planToday", () => {
    expect(loop).toContain('import { planToday } from "../overview/todayModules";');
    expect(loop).toMatch(/const plan = planToday\(\{/);
  });
});

describe("every loop seam has a live caller", () => {
  it("practice: the dose (Did it / Not today, Tonight's outcome and line)", () => {
    expect(loop).toContain("recordPracticeDose(practiceDoseEntry(pick, answer, childProfile.id, sayText));");
    expect(loop).toContain("recordPracticeDose(tonightOutcomeEntry(row, outcome));");
    expect(loop).toContain("if (row) recordPracticeDose(row);");
  });
  it("notice: observations, undo and kept words (B-LOOP-04)", () => {
    expect(loop).toContain("setMilestoneObservation(m.id, status);");
    expect(loop).toContain("restoreMilestone(previous)");
    expect(loop).toContain("keepsakes.upsert(keepsakeDoc(");
  });
  it("the program: its week's watch-for first, and the week-end goal marks (B-PROG-03/07)", () => {
    expect(loop).toContain("selectNoticeWithProgram(");
    expect(loop).toContain("familyGoals.upsert(scoreGoal(goal, value, new Date()))");
  });
  it("the AI picks the practice from the journal (B-LOOP-13)", () => {
    expect(now).toContain("useTodaysFocus(childProfile, signals, journal)");
    expect(now).toContain('aiPracticeId: focus?.practiceVia === "ai" ? focus.practiceId : undefined');
  });
  it("return hooks: the visit stamp, a lifecycle note and the ONE today offer", () => {
    expect(now).toContain("useLastVisit(childProfile)");
    expect(now).toContain("useLifecycleMoment({ previousVisitAt })");
    expect(now).toContain('useCompanionOffer("today",');
    expect(more).toContain('<CompanionOfferSlot surface="today"');
    expect(more).toContain("<WhatChanged");
    expect(more).toContain("<TodaySayBackLine");
    expect(more).toContain("<ArborNoticedCard />");
    expect(more).toContain("<FamilyOfferLines");
  });
  it("the door is ONE collapsed disclosure, never a module", () => {
    expect(more).toContain('data-module-disclosure="now-more"');
    expect(more).not.toMatch(/\bdata-module=/);
  });
  it("the loop blocks carry #/overview's contract move, never a move of their own", () => {
    expect(blocks).toContain('const MOVE = "choose-next-step";');
    expect(blocks).not.toContain("do-practice");
  });
});
