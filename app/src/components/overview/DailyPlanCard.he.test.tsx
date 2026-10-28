import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* B-PLAY-25 — the daily-plan rationale is Hebrew in the Hebrew interface.

   Located (Codex PR 128 named it and never found it): DailyPlanCard on
   #/daily-play renders `plan.whyLine` when there is no goal or the record is
   sparse, and always in its done state. The line came from
   practice/dailyPlan.ts WHY_LINE_TEMPLATES, English only, so a Hebrew parent
   read "Gets more personalized as you log more days." under a Hebrew card.
   buildDailyPlan now writes the line in the page's language (DailyPlayTab
   passes uiLang; the route-level check is in tabs/dailyPlay.didIt.test.ts).
   This renders the REAL card under uiLang "he" for every branch that shows
   the line and reads what a parent sees. */

const state = vi.hoisted(() => ({ lang: "he" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v), uiLang: state.lang }) };
});

import DailyPlanCard from "./DailyPlanCard";
import { buildDailyPlan, type DailyPlan } from "../../practice/dailyPlan";
import type { ScoredActivity } from "../../playbank/select";
import type { ActiveGoal } from "../../practice/goalBuilder";
import { PLAY_ACTIVITIES } from "../../playbank/content";

const activity = PLAY_ACTIVITIES.find((a) => a.bands.includes("toddler") && a.domain === "regulation") ?? PLAY_ACTIVITIES[0];
const pick = (reason: ScoredActivity["reason"], matchedInterest?: string): ScoredActivity =>
  ({ activity, score: 1, reason, ...(matchedInterest ? { matchedInterest } : {}) }) as ScoredActivity;
const GOAL: ActiveGoal = { goalId: "big-feelings", label: "Naming and managing big feelings", domainId: activity.domain as ActiveGoal["domainId"], addedAt: "2026-10-01T00:00:00Z" };
const TUESDAY = new Date("2026-10-27T09:00:00Z").getTime();
const SATURDAY = new Date("2026-10-24T09:00:00Z").getTime();
const SOURCES = /CDC\/AAP\/ASHA\/WHO/g;
const bare = (s: string) => s.replace(/[⁦-⁩]/g, "").replace(SOURCES, "");

const CASES: { name: string; plan: (lang: "en" | "he") => DailyPlan }[] = [
  { name: "sparse record (under five logged days)", plan: (lang) => buildDailyPlan({ picks: [pick("stage-match")], activeGoals: [], childName: "נועה", loggedDayCount: 1, nowMs: TUESDAY, lang })! },
  { name: "sparse record with a goal", plan: (lang) => buildDailyPlan({ picks: [pick("goal-match")], activeGoals: [GOAL], childName: "נועה", loggedDayCount: 2, nowMs: TUESDAY, lang })! },
  { name: "no goal, fits the stage", plan: (lang) => buildDailyPlan({ picks: [pick("stage-match")], activeGoals: [], childName: "נועה", loggedDayCount: 9, nowMs: TUESDAY, lang })! },
  { name: "no goal, the child's interest", plan: (lang) => buildDailyPlan({ picks: [pick("interest-match", "דינוזאורים")], activeGoals: [], childName: "נועה", loggedDayCount: 9, nowMs: TUESDAY, lang })! },
  { name: "weekend, no goal", plan: (lang) => buildDailyPlan({ picks: [pick("stage-match")], activeGoals: [], childName: "נועה", loggedDayCount: 9, nowMs: SATURDAY, lang })! },
];

const render = (plan: DailyPlan, done = false) => renderToStaticMarkup(
  <DailyPlanCard plan={plan} noGoal={!plan.goal} childName="נועה" done={done} onDid={() => undefined} onCoach={() => undefined}
    onObservationSubmit={async () => undefined} sessionLength={plan.defaultSessionLength} onSessionLengthChange={() => undefined} ageYears={2} onSetGoal={() => undefined} />,
);

describe("B-PLAY-25 · DailyPlanCard (#/daily-play) renders a Hebrew rationale under uiLang he", () => {
  it.each(CASES)("$name", ({ plan }) => {
    state.lang = "he";
    const he = plan("he");
    const html = render(he);
    expect(html).toContain(he.whyLine.replace(/'/g, "&#x27;"));
    expect(bare(he.whyLine)).toMatch(/[֐-׿]/);
    expect(bare(he.whyLine)).not.toMatch(/[A-Za-z]/);
    // The English line this card used to print is gone from the Hebrew page.
    expect(html).not.toContain(plan("en").whyLine.split(".")[0]);
    expect(html).not.toMatch(/personalized|A good fit|weekend plan|Chosen because|Picked because/);
  });

  it("the done state's rationale is Hebrew too", () => {
    state.lang = "he";
    const he = CASES[0].plan("he");
    const html = render(he, true);
    expect(html).toContain(he.whyLine);
    expect(html).not.toContain("Gets more personalized");
  });

  it("a Latin name or interest inside the Hebrew line is bidi-isolated, the rest stays Hebrew", () => {
    const he = buildDailyPlan({ picks: [pick("interest-match", "Trains")], activeGoals: [], childName: "Maya", loggedDayCount: 9, nowMs: TUESDAY, lang: "he" })!;
    expect(he.whyLine).toContain("⁨Maya⁩");
    expect(he.whyLine).toContain("⁨Trains⁩");
    expect(bare(he.whyLine).replace(/Maya|Trains/g, "")).not.toMatch(/[A-Za-z]/);
  });

  it("English is unchanged under uiLang en", () => {
    state.lang = "en";
    const en = CASES[0].plan("en");
    expect(en.whyLine).toBe("Gets more personalized as you log more days. Developmentally informed, grounded in CDC/AAP/ASHA/WHO.");
    expect(render(en)).toContain(en.whyLine);
  });

  it("NEGATIVE CONTROL — a plan built without the page language prints the English line on the Hebrew card", () => {
    state.lang = "he";
    const legacy = buildDailyPlan({ picks: [pick("stage-match")], activeGoals: [], childName: "נועה", loggedDayCount: 1, nowMs: TUESDAY })!;
    expect(render(legacy)).toContain("Gets more personalized as you log more days.");
  });
});
