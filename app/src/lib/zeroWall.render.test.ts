/**
 * RUN-08 (re-evidenced) — the zero walls, and the ONE week count.
 *
 * Five parent screens greeted a day-0 family with numerals that carry no
 * information: Behaviors "0 Events · 0 Contexts · 0/0 Resolved", the Journal
 * header's 3xl black "0", the Story density's "0 · 3/7 · 0/133" — the last
 * with an ALL-AGES milestone denominator beside Today's age-windowed "0 of 39"
 * for the same child. And "moments this week" meant three different things on
 * two screens.
 *
 * Guarded here:
 *  1. `weekMomentCount` is the one definition, and the three surfaces that say
 *     the phrase all call it (no local re-derivation).
 *  2. Behaviors' day-0 hero stats, fed through the REAL HubHero, render no
 *     numeral. Negative control: the pre-fix `${0}/${0}` string.
 *  3. Journal and Story have a zero branch, and neither prints a denominator
 *     before its numerator reaches 1.
 *  4. The Story milestone total comes from ArborContext's age-windowed
 *     counters, not from `momentum.milestones` (which counts every band).
 *
 * Node env (no jsdom): the pure component renders through react-dom/server;
 * the two tab components need providers, so their rules are read from source.
 * The rendered day-0 sweep across the six routes is the orchestrator's.
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HubHero } from "../components/ui/HubHero";
import { weekMomentCount, type TimelineSignal } from "./signalTimeline";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const textOf = (html: string) => html.replace(/<[^>]+>/g, " ");

const signal = (over: Partial<TimelineSignal>): TimelineSignal => ({
  id: "s", kind: "moment", at: new Date().toISOString(), tone: "coral", ...over,
} as TimelineSignal);

describe("RUN-08 · one week count, one definition", () => {
  const now = Date.UTC(2026, 8, 7, 12, 0, 0);
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();

  it("counts the trailing week's MOMENTS — not every signal kind, not a slice", () => {
    const signals = [
      signal({ id: "m1", at: iso(1) }),
      signal({ id: "m2", at: iso(6) }),
      signal({ id: "m3", at: iso(8) }),                       // outside the week
      signal({ id: "k1", kind: "milestone", at: iso(2) }),    // not a moment
      signal({ id: "p1", kind: "play", at: iso(2) }),         // not a moment
      signal({ id: "u1", at: null }),                         // undated
    ];
    expect(weekMomentCount(signals, now)).toBe(2);
  });

  it("is zero, not NaN or a slice length, on an empty stream", () => {
    expect(weekMomentCount([], now)).toBe(0);
  });

  it("the three surfaces that say 'moments this week' all read the selector", () => {
    const journal = read("components/tabs/JournalTab.tsx");
    const story = read("components/tabs/StoryTimelineTab.tsx");
    expect(journal).toMatch(/weekMomentCount\(signals, Date\.now\(\)\)/);
    expect(story).toMatch(/weekMomentCount\(signals, Date\.now\(\)\)/);
    // The Journal's story copy reads the SAME number as the stat beside it.
    expect(journal).toMatch(/t\("journal\.story\.body", \{ count: weekCount \}\)/);
    // NEGATIVE CONTROL: the two definitions this replaced are gone.
    expect(journal).not.toMatch(/const weekCount = weekSignals\.length/);
    expect(journal).not.toMatch(/count: recentSignals\.length/);
    expect(story).not.toMatch(/value=\{momentum\.momentsThisWeek\}/);
  });
});

describe("RUN-08 · the Behaviors hero at day 0", () => {
  /** The stat trio BehaviorsTab passes with an empty ledger, post-fix. */
  const dayZero = [
    { value: 0, label: "Events" },
    { value: 0, label: "Contexts" },
    { value: 0, label: "Resolved" },
  ];
  const TEACH = "Nothing noticed yet — one moment starts the picture.";

  const render = (stats: { value: number | string; label: string }[]) =>
    renderToStaticMarkup(
      React.createElement(HubHero, {
        eyebrow: "Behaviors", title: "Log what happened; see the pattern form",
        stats, zeroLine: TEACH, testId: "behaviors-hub-hero",
      }),
    );

  it("renders the teach line and NO numeral", () => {
    const html = render(dayZero);
    expect(html).toContain(TEACH);
    expect(textOf(html)).not.toMatch(/\d/);
  });

  it("NEGATIVE CONTROL: the pre-fix `${resolved}/${total}` string re-opens the wall", () => {
    const prefix = [dayZero[0], dayZero[1], { value: "0/0", label: "Resolved" }];
    // With the OLD Number() rule this trio was not all-zero…
    expect(prefix.every((s) => Number(s.value) === 0)).toBe(false);
    // …and the fix closes it from BOTH ends: the source no longer builds it,
    // and HubHero would now read it as zero anyway.
    expect(read("components/tabs/BehaviorsTab.tsx")).not.toMatch(/resolved: `\$\{resolvedWeek\}\/\$\{last7\.length\}`/);
    expect(textOf(render(prefix))).not.toMatch(/\d/);
  });

  it("the hero passes a translated zero line", () => {
    expect(read("components/tabs/BehaviorsTab.tsx")).toMatch(/zeroLine=\{t\("elev\.growthTruth\.hero\.empty"\)\}/);
  });
});

describe("RUN-08 · Journal and Story zero branches", () => {
  const journal = read("components/tabs/JournalTab.tsx");
  const story = read("components/tabs/StoryTimelineTab.tsx");

  it("the Journal week stat swaps the numeral for a teach line at zero", () => {
    expect(journal).toMatch(/weekCount === 0 \?/);
    expect(journal).toContain('data-testid="journal-week-zero-line"');
    expect(journal).toContain('t("elev.journal.week.zero")');
  });

  it("the Story stat grid collapses to one teach line when every stat is zero", () => {
    expect(story).toMatch(/statGrid\.allZero \?/);
    expect(story).toContain('data-testid="story-stats-zero-line"');
    expect(story).toContain('elev.childsignals.stat.zero');
  });

  it("never a denominator before its numerator reaches 1", () => {
    expect(story).toMatch(/momentum\.planSteps\.done === 0 \? 0 :/);
    expect(story).toMatch(/checkedMilestones === 0 \? 0 :/);
    // NEGATIVE CONTROL: the unconditional ratios that shipped.
    expect(story).not.toMatch(/\$\{momentum\.planSteps\.done\}\/\$\{momentum\.planSteps\.total \|\| 0\}/);
    expect(story).not.toMatch(/\$\{momentum\.milestones\.observed\}\/\$\{momentum\.milestones\.total \|\| 0\}/);
  });

  it("the milestone total is the AGE WINDOW, the same counter Today reads", () => {
    // ArborContext derives checkedMilestones/totalMilestones from
    // ageWindowMilestones(…comparisonAgeMonths…) — the Story tile now reads
    // those instead of momentum.milestones, which counts every band (133).
    expect(story).toMatch(/playLogs, checkedMilestones, totalMilestones,/);
    expect(read("context/ArborContext.tsx")).toMatch(/const windowedMilestones = useMemo\(/);
    expect(read("context/ArborContext.tsx")).toMatch(/ageWindowMilestones\(milestones, comparisonAgeMonths\(/);
  });
});
