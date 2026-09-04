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
import { coldStartLineKey } from "./ProgressNarrative";
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
    expect(overview).toContain("<CarryOverActionAsk />");
    // Negative control: the shipped file had no such mount.
    expect("      {activeTodayAction ? (\n        <TodayActionLoop />").not.toContain("CarryOverActionAsk");

    const ask = readFileSync(path.join(here, "./CarryOverActionAsk.tsx"), "utf8");
    // Rule A: exactly one gradient primary above the fold — the strip uses none.
    expect(ask).not.toContain("--arbor-gradient-primary");
    // Non-destructive: skipping must not delete the record (and its thread row).
    expect(ask).not.toContain("removeTodayAction");
    // One write path — the same seam the live card uses.
    expect(ask).toContain("recordTodayOutcome(entry.id, value)");
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

  it("Today passes predictRhythm's own daysNeeded into the narrative", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const overview = readFileSync(path.join(here, "../tabs/OverviewTab.tsx"), "utf8");
    expect(overview).toContain("rhythmDaysNeeded={rhythm.daysNeeded}");
    const narrative = readFileSync(path.join(here, "./ProgressNarrative.tsx"), "utf8");
    expect(narrative).toContain('data-testid="today-coldstart-line"');
    // FIREWALL: the line may only interpolate the days Arbor needs and the
    // child's NAME — never a count of the child's own behaviour.
    const line = /data-testid="today-coldstart-line"[\s\S]*?<\/p>/.exec(narrative)?.[0] ?? "";
    expect(line).toBeTruthy();
    expect(line).toContain("rhythmDaysNeeded ?? 0");
    expect(line).not.toMatch(/recentBehaviors|recentPlay|noticedMilestones|momentsLastWeek/);
  });
});
