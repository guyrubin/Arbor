import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-PROG-07 (tonight) — on the LAST day of a program week Tonight asks ONE
   more question: how each of the family's goals went, answered with the
   family's OWN five words (the outcome-chip recipe). The chip writes
   scoreGoal (one per local day) through onGoalScore; a number never renders.
   Absent goals = the three-step flow exactly as before. The container passes
   the goals only on the week's last day and never while a coach step is open. EN + HE. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import TonightFlow, { type TonightStep } from "./TonightFlow";
import { PRACTICES } from "../../content/practices";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { scoreGoal, type FamilyGoal } from "../../lib/goals";
import { loopFirewallHits } from "../../lib/loop/firewall";
import type { PracticePick } from "../../lib/practice/choosePractice";

const here = path.dirname(fileURLToPath(import.meta.url));
const practice = PRACTICES.find((p) => p.shelf === "words")!;
const pick: PracticePick = { practice, milestone: ALL_MILESTONES.find((m) => m.id === practice.milestoneId)!, shelf: "words", via: "chooser" };
const noticeMs = ALL_MILESTONES.find((m) => m.id === "cdc-24m-9")!;
const scale = { "-2": "Still every day", "-1": "Most days", "0": "A few times", "1": "Once", "2": "Not at all" };
const heScale = { "-2": "עדיין כל יום", "-1": "רוב הימים", "0": "כמה פעמים", "1": "פעם אחת", "2": "בכלל לא" };
const goal = (id: string, text: string, s: Record<string, string> = scale): FamilyGoal =>
  ({ id, text, setAt: "2026-09-01T08:00:00.000Z", scale: s, scores: [], updatedAt: "2026-09-01T08:00:00.000Z" }) as FamilyGoal;
const g1 = goal("g1", "Gentle hands with his sister");
const g2 = goal("g2", "Stays in bed after the story");

const render = (step: TonightStep, lang: "en" | "he" = "en", over: Record<string, unknown> = {}) => {
  state.lang = lang;
  return renderToStaticMarkup(
    <TonightFlow
      childName="Noa"
      gender="girl"
      practice={pick}
      onPracticeAnswer={() => undefined}
      onOutcome={() => undefined}
      onWhatHappened={() => undefined}
      dayQuestion={{ key: "elev.loop.tonight.day.generic", vars: {} }}
      onQuote={() => undefined}
      notice={{ milestone: noticeMs, shelf: "moving" }}
      onNotice={() => undefined}
      initialStep={step}
      {...over}
    />,
  );
};
const withGoals = (goals: FamilyGoal[]) => ({ weeklyGoals: goals, onGoalScore: () => undefined });
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const progressOf = (html: string) => text(html.match(/data-testid="tonight-progress"[^>]*>([^<]*)</)![1]);

describe("B-PROG-07 Tonight — the weekly goal question", () => {
  it("one goal: the heading asks about it in the family's words; five chips = the family's five words, min-h-12, no digit anywhere (EN + HE)", () => {
    const en = render(4, "en", withGoals([g1]));
    expect(en).toContain('data-testid="tonight-step-4"');
    expect(text(en)).toContain("How did “Gentle hands with his sister” go this week?");
    const chips = en.match(/<button[^>]*data-testid="tonight-goal-chip"[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(chips.map(text)).toEqual(["Still every day", "Most days", "A few times", "Once", "Not at all"]);
    for (const c of chips) expect(c).toContain("min-h-12");
    expect(text(en).replace(progressOf(en), "")).not.toMatch(/\d|%/);
    expect(loopFirewallHits(text(en))).toEqual([]);

    const he = render(4, "he", withGoals([goal("g1", "ידיים עדינות", heScale)]));
    expect(text(he)).toContain("איך הלך השבוע עם „ידיים עדינות”?");
    expect((he.match(/data-testid="tonight-goal-chip"/g) ?? []).length).toBe(5);
    expect(text(he)).toContain("עדיין כל יום");
    expect(progressOf(he)).toBe("4 מתוך 4");
    expect(text(he).replace(progressOf(he), "")).not.toMatch(/\d|%/);
  });

  it("several goals: one heading, each goal in the family's words above its own five chips", () => {
    const html = render(4, "en", withGoals([g1, g2]));
    expect(text(html)).toContain("How did your hopes go this week?");
    expect((html.match(/data-testid="tonight-goal"/g) ?? []).length).toBe(2);
    expect((html.match(/data-testid="tonight-goal-chip"/g) ?? []).length).toBe(10);
    expect(text(html)).toContain("Gentle hands with his sister");
    expect(text(html)).toContain("Stays in bed after the story");
  });

  it("the progress counts the extra step only on that day; without goals the flow is the three steps as before", () => {
    expect(progressOf(render(3, "en", withGoals([g1])))).toBe("3 of 4");
    expect(progressOf(render(1, "en", withGoals([g1])))).toBe("1 of 4");
    const plain3 = render(3, "en");
    expect(progressOf(plain3)).toBe("3 of 3");
    expect(plain3).toContain('data-testid="tonight-finish"');
    // with goals step 3 moves forward (Next), it does not finish
    const goals3 = render(3, "en", withGoals([g1]));
    expect(goals3).toContain('data-testid="tonight-next"');
    expect(goals3).not.toContain('data-testid="tonight-finish"');
    // no goals (or no writer) → step 4 never renders
    expect(render(4, "en")).toContain('data-testid="tonight-done"');
    expect(render(4, "en", { weeklyGoals: [g1] })).toContain('data-testid="tonight-done"');
    expect(render(4, "en", withGoals([]))).toContain('data-testid="tonight-done"');
  });

  it("Law 7: step 4 carries exactly one stamp (on the first goal's chips)", () => {
    const html = render(4, "en", { ...withGoals([g1, g2]), stampMove: "tonight" });
    expect((html.match(/data-primary-move="tonight"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/data-testid="tonight-goal-answers"[^>]*data-primary-move="tonight"|data-primary-move="tonight"[^>]*data-testid="tonight-goal-answers"/);
  });

  it("source: the chip writes through onGoalScore; steps 2/3 route to 4 only with goals; the packet number is never read", () => {
    const src = readFileSync(path.join(here, "TonightFlow.tsx"), "utf8");
    expect(src).toContain("props.onGoalScore!(goal.id, v)");
    expect(src).toMatch(/\(from === 2 \|\| from === 3\) && hasGoals \? 4 : "done"/);
    expect(src).not.toMatch(/goalForPacket|goals\.packet\./);
    expect(src).toContain("{goal.scale[String(v) as GoalScaleKey]}");
  });

  it("container: goals only on the program week's LAST day, never while a coach step is open; the chip upserts scoreGoal", () => {
    const ov = readFileSync(path.join(here, "..", "tabs", "OverviewTab.tsx"), "utf8");
    expect(ov).toContain('if (activeTodayAction?.status === "accepted") return undefined;');
    expect(ov).toContain("programDayKey(now) !== programWeekDays(active.enrolment, active.week).to");
    expect(ov).toContain("void familyGoals.upsert(scoreGoal(goal, value, new Date()))");
    expect(ov).toMatch(/<TonightFlow[\s\S]*weeklyGoals=\{weeklyGoals\}/);
  });

  it("scoreGoal keeps one mark per local day (a later chip that evening replaces it)", () => {
    const a = scoreGoal(g1, -1, new Date(2026, 9, 7, 20, 0));
    const b = scoreGoal(a, 1, new Date(2026, 9, 7, 21, 0));
    expect(b.scores).toHaveLength(1);
    expect(b.scores[0].value).toBe(1);
  });
});
