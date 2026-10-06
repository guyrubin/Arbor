/**
 * Wave L · Today's two open loops.
 *
 *  ENG-12 — `activeTodayAction` resolves through `todayActionId(childId)`,
 *  whose id embeds TODAY's date, so a step accepted at 21:00 and never
 *  reported on became unreachable at 00:01 and the outcome was never asked
 *  again. `selectCarryOverAction` is the selector that finds it.
 *
 *  ENG-18 — `predictRhythm().daysNeeded` was already computed on Today (it
 *  feeds the why-line) and already rendered by RhythmStrip — which Today does
 *  not mount. `coldStartLineKey` is the gate for showing it where the parent
 *  actually is.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_CARRY_DAYS,
  readSkippedCarryOvers,
  rememberSkippedCarryOver,
  selectCarryOverAction,
  type CarryOverEntry,
} from "./carryOverAction";
import { coldStartLineKey } from "./whatChangedEvents";
import { todayActionId } from "../../actionLoop/model";

const NOW = Date.parse("2026-09-04T08:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const entry = (over: Partial<CarryOverEntry> & { id: string }): CarryOverEntry => ({
  status: "accepted",
  acceptedAt: hoursAgo(12),
  recommendation: "Name the next transition five minutes ahead.",
  ...over,
});

const TODAY_ID = todayActionId("child-1", new Date(NOW));

describe("ENG-12 — the step that outlived its day", () => {
  it("finds a step accepted yesterday that was never reported on", () => {
    // 12 hours ago crosses midnight from 08:00, which is exactly the case
    // that used to disappear: a real record, keyed to yesterday's date.
    const yesterday = entry({ id: "today.child-1.2026-09-03" });
    expect(yesterday.id).not.toBe(TODAY_ID);
    expect(selectCarryOverAction([yesterday], TODAY_ID, NOW)?.id).toBe(yesterday.id);
  });

  it("never re-asks a step that already has an outcome", () => {
    const done = entry({ id: "today.child-1.2026-09-03", status: "completed" });
    expect(selectCarryOverAction([done], TODAY_ID, NOW)).toBeNull();
  });

  it("never competes with TODAY's own step (that one owns the live card)", () => {
    const live = entry({ id: TODAY_ID, acceptedAt: hoursAgo(1) });
    expect(selectCarryOverAction([live], TODAY_ID, NOW)).toBeNull();
  });

  it("asks about ONE step — the newest — never a queue of chores", () => {
    const entries = [
      entry({ id: "a", acceptedAt: daysAgo(3) }),
      entry({ id: "b", acceptedAt: daysAgo(1) }),
      entry({ id: "c", acceptedAt: daysAgo(2) }),
    ];
    const picked = selectCarryOverAction(entries, TODAY_ID, NOW);
    expect(picked?.id).toBe("b");
  });

  it("stops asking past the window — old questions are noise, not closure", () => {
    const stale = entry({ id: "old", acceptedAt: daysAgo(MAX_CARRY_DAYS + 1) });
    expect(selectCarryOverAction([stale], TODAY_ID, NOW)).toBeNull();
    const fresh = entry({ id: "recent", acceptedAt: daysAgo(MAX_CARRY_DAYS - 1) });
    expect(selectCarryOverAction([fresh], TODAY_ID, NOW)?.id).toBe("recent");
  });

  it("honours an explicit skip", () => {
    const e = entry({ id: "skipme", acceptedAt: daysAgo(1) });
    expect(selectCarryOverAction([e], TODAY_ID, NOW)?.id).toBe("skipme");
    expect(selectCarryOverAction([e], TODAY_ID, NOW, ["skipme"])).toBeNull();
  });

  it("ignores records with no step text (nothing to ask about)", () => {
    const blank = entry({ id: "blank", acceptedAt: daysAgo(1), recommendation: "   " });
    expect(selectCarryOverAction([blank], TODAY_ID, NOW)).toBeNull();
  });

  describe("skip marker", () => {
    // The repo's vitest env is node — stub the one storage API the marker
    // uses so these assertions are real rather than silently swallowed by the
    // helpers' best-effort try/catch.
    beforeEach(() => {
      const store = new Map<string, string>();
      (globalThis as { window?: unknown }).window = {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => void store.set(k, v),
        },
      };
    });

    it("remembers a waved-off step across reads", () => {
      expect(readSkippedCarryOvers()).not.toContain("s1");
      rememberSkippedCarryOver("s1");
      expect(readSkippedCarryOvers()).toContain("s1");
    });

    it("does not duplicate, and stays bounded", () => {
      rememberSkippedCarryOver("s1");
      const next = rememberSkippedCarryOver("s1");
      expect(next.filter((x) => x === "s1")).toHaveLength(1);
      for (let i = 0; i < 60; i++) rememberSkippedCarryOver(`k${i}`);
      const all = readSkippedCarryOvers();
      expect(all.length).toBe(50);
      expect(all[0]).toBe("k59");
    });
  });

  it("is mounted on Today, and NOT as a second primary CTA", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const overview = readFileSync(path.join(here, "../tabs/OverviewTab.tsx"), "utf8");
    // B-AI-06: mounted through the single-offer slot (kind "follow-up");
    // B-LOOP-07: that one slot instance sits behind Today's "More for today" door.
    expect(overview).toMatch(/<CompanionOfferSlot\s+surface="today"/);
    const door = overview.slice(overview.indexOf('data-testid="today-door"'), overview.indexOf("</details>"));
    expect(door).toContain("<CompanionOfferSlot");
    expect(readFileSync(path.join(here, "./CompanionOfferSlot.tsx"), "utf8")).toContain("<CarryOverActionAsk onSkip={controls.refresh} />");
    // Negative control: the shipped file had no such mount.
    expect("      {activeTodayAction ? (\n        <TodayActionLoop />").not.toContain("CarryOverActionAsk");

    const ask = readFileSync(path.join(here, "./CarryOverActionAsk.tsx"), "utf8");
    // Rule A: exactly one gradient primary above the fold — the strip uses none.
    expect(ask).not.toContain("--arbor-gradient-primary");
    // Non-destructive: skipping must not delete the record (and its thread row).
    expect(ask).not.toContain("removeTodayAction");
  });
});

describe("ENG-18 — the cold-start progress line", () => {
  it("names the countdown, with a singular form at one day", () => {
    expect(coldStartLineKey(3)).toBe("elev.closeloop.coldstart.many");
    expect(coldStartLineKey(1)).toBe("elev.closeloop.coldstart.one");
  });

  it("says nothing once the rhythm reads (no zero-day promise, no countdown to nowhere)", () => {
    expect(coldStartLineKey(0)).toBeNull();
    expect(coldStartLineKey(-2)).toBeNull();
    expect(coldStartLineKey(undefined)).toBeNull();
    expect(coldStartLineKey(Number.NaN)).toBeNull();
  });

  // B-TODAY-21: the line moved with ProgressNarrative into the ONE
  // "What changed since you left" card.
  it("Today passes predictRhythm's own daysNeeded into the What-changed card", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const overview = readFileSync(path.join(here, "../tabs/OverviewTab.tsx"), "utf8");
    expect(overview).toContain("rhythmDaysNeeded={rhythm.daysNeeded}");
    const narrative = readFileSync(path.join(here, "./WhatChanged.tsx"), "utf8");
    expect(narrative).toContain('data-testid="today-coldstart-line"');
    // FIREWALL: the line may only interpolate the days Arbor needs and the
    // child's NAME — never a count of the child's own behaviour.
    const line = /data-testid="today-coldstart-line"[\s\S]*?<\/p>/.exec(narrative)?.[0] ?? "";
    expect(line).toBeTruthy();
    expect(line).toContain("rhythmDaysNeeded ?? 0");
    expect(line).not.toMatch(/recentBehaviors|recentPlay|noticedMilestones|momentsLastWeek/);
  });
});

/**
 * B-ASKJB-04 — an Ask answer's first step enters the action loop with
 * source "coach": accept → Today's step → outcome → next-day carry-over.
 * The source union itself is B-AI-05's (actionLoop/model.test.ts).
 */
describe("B-ASKJB-04 — a coach-sourced step through accept → outcome → carry-over", () => {
  it("accept writes today's row with source 'coach'; the card shows it as accepted; a different step offers replace", async () => {
    const { planAcceptedAction, activeActionFor } = await import("../../actionLoop/model");
    const { tryItState } = await import("../coach/CoachAnswerCards");
    const step = "Name the feeling before the transition.";
    const { entry } = planAcceptedAction([], { recommendation: step, source: "coach", capacity: "standard" }, TODAY_ID, new Date(NOW));
    expect(entry.source).toBe("coach");
    expect(entry.status).toBe("accepted");
    const active = activeActionFor([entry], TODAY_ID);
    expect(active?.id).toBe(entry.id); // Today renders it as today's step
    expect(tryItState(step, active)).toBe("accepted");
    expect(tryItState("Another step.", active)).toBe("replace");
    expect(tryItState(step, null)).toBe("accept");
    // Replace: B-AI-05 supersedes today's unrated row; one step per day.
    const second = planAcceptedAction([entry], { recommendation: "Another step.", source: "coach", capacity: "standard" }, TODAY_ID, new Date(NOW + 60_000));
    expect(second.superseded.map((r) => r.status)).toEqual(["superseded"]);
    expect(activeActionFor([...second.superseded, second.entry], TODAY_ID)?.recommendation).toBe("Another step.");
    // A rated step today hides the control (never a second step that day).
    expect(tryItState(step, { ...entry, status: "completed" })).toBe("hidden");
  });

  it("next day the carry-over asks about the unrated coach step; after the outcome it never re-asks", () => {
    const yesterdayCoach = entry({ id: "today.child-1.2026-09-03", recommendation: "Name the feeling before the transition." });
    const coach = { ...yesterdayCoach, source: "coach" as const };
    expect(selectCarryOverAction([coach], TODAY_ID, NOW)?.recommendation).toBe("Name the feeling before the transition.");
    expect(selectCarryOverAction([{ ...coach, status: "completed", outcome: "helped" }], TODAY_ID, NOW)).toBeNull();
  });

  it("CoachTab wires the card to the one accept seam with source 'coach', and the event carries the source", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const coachTab = readFileSync(path.resolve(here, "../tabs/CoachTab.tsx"), "utf8");
    expect(coachTab).toContain('onTryIt={(step) => acceptTodayAction(step, "standard", "coach")}');
    expect(coachTab).toContain("onUndoTryIt={(id) => removeTodayAction(id)}");
    const ctx = readFileSync(path.resolve(here, "../../context/ArborContext.tsx"), "utf8");
    expect(ctx).toMatch(/track\("today_action_accepted", \{ capacity, source \}\)/);
    // Today names where the step came from.
    const loop = readFileSync(path.resolve(here, "TodayActionLoop.tsx"), "utf8");
    expect(loop).toContain('activeTodayAction.source === "coach" ? t("today.action.eyebrow.coach")');
  });

  it("the try-it copy exists in EN and HE", async () => {
    const { en, he } = await import("../../lib/i18n");
    for (const k of ["coach.tryIt", "coach.tryIt.replace", "coach.tryIt.replaces", "coach.tryIt.accepted", "coach.tryIt.undo", "today.action.eyebrow.coach"]) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toBeTruthy();
      expect(he[k].replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe("B-ASKJB-26 — a plan-sourced step through accept → Today → outcome → next step", () => {
  const st = (text: string, status: "todo" | "doing" | "done") => ({ text, completed: status === "done", status });
  const created = NOW - 7 * 86_400_000;
  const basePlan = {
    id: `plan-${created}`, title: "Calmer exits", issue: "Leaving the park",
    phases: [{ name: "Week 1", description: "", steps: [st("Give a two-minute warning.", "todo"), st("Hand over the coat as the cue.", "todo")] }],
    scripts: [], successIndicators: ["Fewer tears at the gate"],
  };
  const TODAY_KEY = TODAY_ID.split(".").pop()!;

  it("accept → Today shows it → 'helped' marks it done → the next step is today's, one step per day holds", async () => {
    const { planAcceptedAction, activeActionFor } = await import("../../actionLoop/model");
    const { todaysPlanStep, planStepStatusAfter } = await import("../../lib/plans");
    const { tryItState } = await import("../coach/CoachAnswerCards");

    const step = todaysPlanStep(basePlan, [], TODAY_KEY)!;
    expect(step).toMatchObject({ text: "Give a two-minute warning.", day: 1, phaseIdx: 0, stepIdx: 0 });

    const { entry } = planAcceptedAction([], { recommendation: step.text, source: "plan", capacity: "standard", planStep: step }, TODAY_ID, new Date(NOW));
    expect(entry).toMatchObject({ source: "plan", planId: basePlan.id, phaseIdx: 0, stepIdx: 0, status: "accepted" });
    const active = activeActionFor([entry], TODAY_ID);
    expect(active?.recommendation).toBe(step.text); // Today renders the plan step
    expect(tryItState(step.text, active)).toBe("accepted");

    // Outcome "helped" → the context writes the step done (planStepStatusAfter).
    const rated = { ...entry, status: "completed" as const, outcome: "helped" as const, outcomeAt: new Date(NOW + 3600_000).toISOString() };
    const status = planStepStatusAfter("helped")!;
    const after = { ...basePlan, phases: [{ ...basePlan.phases[0], steps: basePlan.phases[0].steps.map((s, i) => (i === 0 ? { ...s, status, completed: true } : s)) }] };
    const next = todaysPlanStep(after, [rated], TODAY_KEY)!;
    expect(next.text).toBe("Hand over the coat as the cue.");
    // One step per day: today's step already has an outcome, so no second accept today.
    expect(tryItState(next.text, activeActionFor([rated], TODAY_ID))).toBe("hidden");
    // Tomorrow it is offered, as day 2.
    const tomorrowKey = "2099-01-01";
    expect(todaysPlanStep(after, [rated], tomorrowKey)!.day).toBe(2);
  });

  it("replace-confirm (B-ASKJB-04) holds: a different step already accepted today offers replace", async () => {
    const { planAcceptedAction } = await import("../../actionLoop/model");
    const { tryItState } = await import("../coach/CoachAnswerCards");
    const { entry: coachRow } = planAcceptedAction([], { recommendation: "Name the feeling.", source: "coach", capacity: "standard" }, TODAY_ID, new Date(NOW));
    expect(tryItState("Give a two-minute warning.", coachRow)).toBe("replace");
    const second = planAcceptedAction([coachRow], { recommendation: "Give a two-minute warning.", source: "plan", capacity: "standard", planStep: { planId: basePlan.id, phaseIdx: 0, stepIdx: 0 } }, TODAY_ID, new Date(NOW + 60_000));
    expect(second.superseded.map((r) => r.status)).toEqual(["superseded"]);
  });

  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] the plan card renders Day n + the step + I'll try it, and the weekly check-in on day 7`, async () => {
      const React = (await import("react")).default;
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { default: PlanTrackCard } = await import("../plans/PlanTrackCard");
      const { todaysPlanStep } = await import("../../lib/plans");
      const noop = () => {};
      const r = (plan: typeof basePlan & { weeklyChecks?: { at: string; answer: "yes" | "little" | "not_yet" }[] }, now: number) =>
        renderToStaticMarkup(React.createElement(PlanTrackCard, {
          plan, step: todaysPlanStep(plan, [], TODAY_KEY), today: null, lang, now,
          onTryIt: noop, onUndo: noop, onCheck: noop, onAdjust: noop,
        }));
      const html = r(basePlan, NOW);
      // Plans critic r1 (d52e5e7): no "Day 1" beside done steps — the day
      // count shows from Day 2; Day 1 reads "Today's step".
      expect(html).toContain(lang === "he" ? "הצעד של היום · " : "Today&#x27;s step · ");
      expect(html).not.toMatch(/Day 1 of|יום 1 בתוכנית/);
      expect(html).toContain("Give a two-minute warning.");
      expect(html).toContain(lang === "he" ? "אנסה את זה" : "I&#x27;ll try it");
      expect(html).toContain('data-testid="plan-weekly-check"');
      for (const a of ["yes", "little", "not_yet"]) expect(html).toContain(`data-check-answer="${a}"`);
      expect(html).toContain(lang === "he" ? "יש סימנים שזה עובד?" : "Signs it&#x27;s working?");
      expect(html).toContain("Fewer tears at the gate");
      // Day 6: no check-in yet. No percentage anywhere.
      expect(r(basePlan, NOW - 86_400_000)).not.toContain('data-testid="plan-weekly-check"');
      expect(html).not.toMatch(/\d\s*%/);
      // Every control ≥44 px.
      for (const b of html.match(/<button\b[^>]*>/g) ?? []) expect(b).toMatch(/min-h-11/);
      // "Not yet" twice → the adjust door.
      const at = new Date(NOW).toISOString();
      const twice = r({ ...basePlan, weeklyChecks: [{ at, answer: "not_yet" }, { at, answer: "not_yet" }] }, NOW);
      expect(twice).toContain('data-testid="plan-adjust"');
      expect(twice).toContain(lang === "he" ? "לכוונן את התוכנית" : "Adjust the plan in Ask");
    });
  }

  it("the adjust seed carries the title and step outcomes only, in the parent's language", async () => {
    const { planAdjustSeed } = await import("../plans/PlanTrackCard");
    const en = planAdjustSeed("en", "Calmer exits", [{ step: "Give a two-minute warning.", outcome: "not_today" }]);
    expect(en).toContain("Calmer exits");
    expect(en).toContain("Give a two-minute warning.");
    expect(en).toContain("not today");
    const he = planAdjustSeed("he", "יציאות רגועות", [{ step: "אזהרה של שתי דקות.", outcome: "somewhat" }]);
    expect(he.replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
    expect(he).toContain("עזר קצת");
  });

  it("wiring: Plans accepts with source 'plan' + the step ref; the context moves the step on the outcome; Today names the source", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const plansTab = readFileSync(path.resolve(here, "../tabs/PlansTab.tsx"), "utf8");
    expect(plansTab).toContain('onTryIt={(text, ref) => acceptTodayAction(text, "standard", "plan", ref)}');
    const ctx = readFileSync(path.resolve(here, "../../context/ArborContext.tsx"), "utf8");
    expect(ctx).toMatch(/if \(item\.source === "plan" && item\.planId[^\n]*\r?\n\s*const next = planStepStatusAfter\(outcome\);\r?\n\s*if \(next\) setPlanStepStatus\(item\.planId, item\.phaseIdx, item\.stepIdx, next\);/);
    const loop = readFileSync(path.resolve(here, "TodayActionLoop.tsx"), "utf8");
    expect(loop).toContain('activeTodayAction.source === "plan" ? t("elev.plans.today.eyebrow")');
  });
});
