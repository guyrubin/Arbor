import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Parity 9 Oct — the milestone loop lives on Now again. The companion rewrite
 * (7e25419e) left tabs/OverviewTab.tsx unmounted, and with it every seam below
 * had NO live caller in production (recordPracticeDose, scoreGoal,
 * recordFromRecordAnswer, the visit stamp, the today offer, the watch signal).
 * These pins tie each seam to the live Now tree, so a redesign cannot drop one
 * silently again: change the pin with the seam, never without it. v3 F-NOW-2
 * r2: the watch signal's Now line is retired with a named home (the guide
 * card's "Why this suggestion?"); its seam stays live on the Development check.
 */
const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const shell = read("components/layout/Shell.tsx");
const now = read("components/companion/NowView.tsx");
const loop = read("components/companion/useNowLoop.ts");
const blocks = read("components/companion/NowLoopBlocks.tsx");
// v3 F-NOW-2: "More for today" retired; its lines are the week card's (useNowChanges) and the glance's.
const changes = read("components/companion/useNowChanges.ts");
const panels = read("components/companion/NowDayPanels.tsx");

describe("the loop is mounted where parents land", () => {
  it("#/overview renders NowView, and NowView runs the loop (no door: v3 F-NOW-2)", () => {
    expect(shell).toContain('const OverviewTab = lazy(() => import("../companion/NowView"));');
    expect(now).toContain("useNowLoop({");
    expect(now).not.toContain("<NowMoreForToday");
    expect(now).not.toContain("<NowNoticeBlock");
    for (const block of ["<NowPracticeLead", "<NowTonightLead", "<NowNoticeLead", "<NowTonightPointer"]) expect(now).toContain(block);
    // The notice block's first notice is a week-card line (now-notice-block).
    expect(now).toContain("notice: showNotice ? loop.blockNotices[0] : null");
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
    expect(now).toContain("useLifecycleMoment({ previousVisitAt, now: now.getTime() })");
    expect(now).toContain('useCompanionOffer("today",');
    // v3 F-NOW-2 r2 re-pin: the offer stays on Now as the glance's ONE rhythm
    // line; the say-back, the family lines and the watch signal left Now
    // (homes: the guide card's "Why this suggestion?" and the Talk welcome).
    expect(now).toContain('{todayOffer.offer?.kind === "rhythm" && <CompanionOfferSlot surface="today"');
    expect(now).not.toContain("<TodaySayBackLine");
    expect(now).not.toContain("<FamilyOfferLines");
    // What changed is the week card's lines; the watch signal is not among them.
    expect(changes).toContain("composeWhatChanged({");
    expect(changes).not.toContain("todayNoticedSignal");
    expect(now).toContain("changedLines={changes.lines}");
  });
  it("no door and no module: the changed lines sit in the week card, the glance holds the rest", () => {
    expect(now).not.toContain('data-testid="today-door"');
    expect(now).not.toContain("<details");
    expect(panels).toContain('className="now-week-changed"');
    expect(changes).not.toMatch(/\bdata-module=/);
  });
  it("the loop blocks carry #/overview's contract move, never a move of their own", () => {
    expect(blocks).toContain('const MOVE = "choose-next-step";');
    expect(blocks).not.toContain("do-practice");
  });
  it("gates the hard-moment door like every door to the sheet (B-ASKJB-31)", () => {
    expect(now).toContain("availableHardMomentCards({ now: at, ageMonths: ageMonthsFromProfile(childProfile, at), locale: lang }).length > 0");
    expect(now).toContain('{hardMomentDoor && <button type="button" className="now-hard-moment" onClick={() => openHardMomentNow()}>');
  });
  it("keeps the night's story to ONE glance row (critic c2 r1; v3 F-NOW-2 tonight row)", () => {
    expect(blocks).not.toMatch(/onStory=/);
    expect(now).toContain("const eveningStory = !storyRun && !showPointer && loop.evening && loop.storyFits && reminderPrefs.types.story");
    expect((now.match(/data-testid="today-tonight-story"/g) ?? []).length).toBe(1);
    expect((now.match(/data-testid="now-glance-story"/g) ?? []).length).toBe(1);
    expect(blocks).toContain('<Icon name="bedtime" size={24} />');
  });
});
