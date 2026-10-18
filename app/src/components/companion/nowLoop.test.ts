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
// v4: "More for today" dissolved; its lines live in their objects (NowTodayLines).
const more = read("components/companion/NowTodayLines.tsx");
const launcher = read("components/companion/CompanionWorkspace.tsx");

describe("the loop is mounted where parents land", () => {
  it("#/overview renders NowView, and NowView runs the loop and its door", () => {
    expect(shell).toContain('const OverviewTab = lazy(() => import("../companion/NowView"));');
    expect(now).toContain("useNowLoop({");
    for (const home of ["<NowWhatChangedLines", "<NowNoticeExtras", "<NowAgendaExtras"]) expect(now).toContain(home);
    expect(now).not.toContain("<NowMoreForToday");
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
    expect(loop).toContain("const notices = useNoticeActions();");
    expect(loop).toContain("const actions = notices.forMilestone(m);");
    expect(loop).toContain("return actions.onAnswer(status);");
    const shared = read("hooks/useNoticeActions.ts");
    expect(shared).toContain('setMilestoneObservation(milestone.id, status, { now: at, source: "parent_typed" }, ACKNOWLEDGED)');
    expect(shared).toContain("restoreMilestone(structuredClone(previous), ACKNOWLEDGED)");
    expect(shared).toContain("collection.upsert(doc, ACKNOWLEDGED)");
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
    expect(now).toContain("useLifecycleMoment({ previousVisitAt, now: now.getTime() })");
    expect(now).toContain('useCompanionOffer("today",');
    expect(more).toContain('<CompanionOfferSlot surface="today"');
    expect(more).toContain("<WhatChanged");
    expect(more).toContain("<TodaySayBackLine");
    expect(more).toContain("<ArborNoticedCard />");
    expect(more).toContain("<FamilyOfferLines");
  });
  it("v4: the door's lines live in their objects — never a module, never a second collapsed door", () => {
    expect(more).not.toMatch(/\bdata-module=/);
    expect(more).not.toContain("<details");
    expect(now).not.toContain('data-testid="today-door"');
  });
  it("the loop blocks carry #/overview's contract move, never a move of their own", () => {
    expect(blocks).toContain('const MOVE = "choose-next-step";');
    expect(blocks).not.toContain("do-practice");
  });
  it("v4: the hard-moment door is the launcher rail's, gated like every door to the sheet (B-ASKJB-31); Now has none of its own", () => {
    expect(launcher).toMatch(/availableHardMomentCards\(\{ now: at, ageMonths: ageMonthsFromProfile\(childProfile, at\), locale: uiLang === "he" \? "he" : "en" \}\)\.length > 0/);
    expect(launcher).toContain('{hardMomentDoor && <button type="button" className="companion-launch-save companion-launch-hard"');
    expect(now).not.toContain("openHardMomentNow");
  });
  it("keeps the night's story to ONE door line (critic c2 r1)", () => {
    expect(blocks).not.toMatch(/onStory=/);
    expect(more).toContain('{storyRow && evening && storyFits && <button type="button" className="now-weekly-door now-agenda-row" data-testid="today-agenda-story"');
  });
});
