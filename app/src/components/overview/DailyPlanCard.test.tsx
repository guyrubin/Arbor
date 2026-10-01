import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";

/* B-GROWTH-20 — today's plan shows without a goal. A new child with 0 goals
   used to get the dead-end "Set a focus goal to get today's plan." although
   buildDailyPlan returns a plan whenever picks exist. Now the no-plan state
   renders only when there is no plan; a plan without a goal renders its
   title, why-line and "We did this", with ONE optional "Set a focus" line. */

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

import DailyPlanCard from "./DailyPlanCard";
import { PLAY_ACTIVITIES, localizeActivity } from "../../playbank/content";
import type { DailyPlan } from "../../practice/dailyPlan";

const activity = PLAY_ACTIVITIES.find((a) => a.bands.includes("toddler"))!;
const plan: DailyPlan = {
  scoredActivity: { activity, score: 1, reason: "stage-match" } as DailyPlan["scoredActivity"],
  goal: null,
  matchedInterest: null,
  whyLine: "Picked for this age — developmentally informed.",
  sparse: true,
  isWeekend: false,
  defaultSessionLength: "standard" as DailyPlan["defaultSessionLength"],
};

const render = (p: DailyPlan | null, noGoal: boolean, lang: "en" | "he" = "en") => {
  state.lang = lang;
  return renderToStaticMarkup(
    <DailyPlanCard
      plan={p}
      noGoal={noGoal}
      childName="Maya"
      done={false}
      onDid={() => undefined}
      onCoach={() => undefined}
      onObservationSubmit={async () => undefined}
      sessionLength={plan.defaultSessionLength}
      onSessionLengthChange={() => undefined}
      ageYears={2}
      onSetGoal={() => undefined}
    />,
  );
};

describe("B-GROWTH-20 — DailyPlanCard without a goal", () => {
  it("noGoal=true with a plan renders the plan title, the why-line and 'We did this'", () => {
    const html = render(plan, true);
    expect(html).toContain(activity.title.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
    expect(html).toContain(plan.whyLine);
    expect(html).toContain("We did this");
    expect(html).not.toContain("Set a focus goal to get today&#x27;s plan.");
    expect(html).toContain('data-testid="plan-set-focus-optional"');
    expect(html).toContain("Set a focus to match it to what you&#x27;re working on");
  });

  it("Hebrew: the plan renders with the Hebrew optional-focus line", () => {
    const html = render(plan, true, "he");
    expect(html).toContain(localizeActivity(activity, "he").title.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"));
    expect(html).toContain("עשינו את זה");
    expect(html).toContain("הגדירו מיקוד כדי להתאים אותה למה שאתם עובדים עליו");
  });

  it("with a goal: no optional-focus line", () => {
    expect(render(plan, false)).not.toContain("plan-set-focus-optional");
  });

  it("no plan: the empty state stays (and offers the goal)", () => {
    const html = render(null, true);
    expect(html).toContain("Set a focus goal to get today&#x27;s plan.");
    expect(html).not.toContain("We did this");
  });
});
