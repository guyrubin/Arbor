import { describe, expect, it } from "vitest";
import { recapWeekId, recapWeekStartMs } from "../hooks/useWeeklyRecap";
import { translate } from "./i18n";
import { en as foundationEn, he as foundationHe } from "./i18nElevation/foundation";
import type { DomainId } from "./domains/registry";
import type { Observation } from "./observations";
import { KID_ORIGINS, PARENT_SOURCES, WEEK_ORDER, glanceHasCounts, weekGlance, type WeekCountKey } from "./weekGlance";

/**
 * v3 EXTRA-WEEKLY — lib/weekGlance: the report week as counts. NowWeekSoFar
 * renders from it unchanged (the legacy copy below proves it), and the Weekly
 * glance reads its tiles, day strip, step outcomes and areas from it.
 * Invented examples only.
 */

/** A Wednesday afternoon; the report week opens on the Saturday before (recapWeekId's own turn-over). */
const NOW = new Date(2026, 9, 14, 15, 0);
const START = recapWeekStartMs(NOW);
const FIRST = new Date(START);
/** Local time on the i-th day of the report week (day 0 opens the week). */
const on = (day: number, hour: number, minute = 0) =>
  new Date(FIRST.getFullYear(), FIRST.getMonth(), FIRST.getDate() + day, hour, minute).toISOString();
/** Local midnight that opens the i-th day. */
const midnight = (day: number) => new Date(FIRST.getFullYear(), FIRST.getMonth(), FIRST.getDate() + day).getTime();

let seq = 0;
function obs(over: Partial<Observation> & { at: string }): Observation {
  seq += 1;
  return {
    id: `behaviorLogs:invented-${seq}`,
    childId: "child-invented",
    domains: [] as DomainId[],
    kind: "moment",
    value: { type: "moment", behaviorType: "Moment" },
    source: "parent_typed",
    origin: "behaviorLogs",
    ageAtObservationMonths: 40,
    pretermCorrected: false,
    ...over,
  } as unknown as Observation;
}
const moment = (at: string, domains: DomainId[] = [], source: Observation["source"] = "parent_typed") => obs({ at, domains, source });
const milestone = (at: string, domains: DomainId[] = ["moving"]) =>
  obs({ at, domains, kind: "milestone", origin: "milestones", value: { type: "milestone", milestoneId: "m-invented", title: "Hops on one foot" } });
const kid = (at: string, origin: Observation["origin"] = "practiceEvents", domains: DomainId[] = ["thinking"]) =>
  obs({ at, domains, kind: "practice", origin, source: "kid_practice", value: { type: "practice", activity: "memory" } });
/** A word the parent did not confirm: never a moment, so it feeds the words count. */
const word = (at: string) =>
  obs({ at, domains: ["talking"], kind: "moment", origin: "langObs", source: "unverified", value: { type: "word", language: "en", phrase: "ball" } });
const step = (outcome: "helped" | "somewhat" | "not_today", outcomeAt: string) => ({ outcome, outcomeAt });

/** NowWeekSoFar's computation as it shipped at 3d21926b, verbatim, as the reference. */
function legacyWeek(observations: readonly Observation[], actionLoop: readonly { outcome?: string; outcomeAt?: string }[], now: Date) {
  const start = recapWeekStartMs(now);
  const first = new Date(start);
  const days = Array.from({ length: 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getTime());
  const counts: Record<WeekCountKey, number> = { moments: 0, helped: 0, milestones: 0, words: 0, kid: 0 };
  const perDay = days.map(() => ({ moments: 0, helped: 0, milestones: 0, words: 0, kid: 0 } as Record<WeekCountKey, number>));
  const add = (key: WeekCountKey, iso?: string) => {
    const ms = Date.parse(iso ?? "");
    if (!Number.isFinite(ms) || ms < start || ms > now.getTime()) return;
    counts[key] += 1;
    let index = 0;
    while (index < 6 && ms >= days[index + 1]) index += 1;
    perDay[index][key] += 1;
  };
  for (const item of observations) {
    if (item.kind === "moment" && PARENT_SOURCES.has(item.source)) add("moments", item.at);
    else if (item.kind === "milestone") add("milestones", item.at);
    else if (item.value.type === "word") add("words", item.at);
    else if (KID_ORIGINS.has(item.origin)) add("kid", item.at);
  }
  for (const entry of actionLoop) if (entry.outcome === "helped") add("helped", entry.outcomeAt);
  const max = Math.max(1, ...perDay.map(day => WEEK_ORDER.reduce((sum, key) => sum + day[key], 0)));
  return { counts, perDay, max };
}

const OBSERVATIONS: Observation[] = [
  moment(on(0, 9), ["feelings"]),
  moment(on(1, 8), [], "parent_voice"),
  moment(on(1, 19), ["family", "feelings"], "ai_proposed_parent_confirmed"),
  moment(on(2, 7), ["feelings"], "unverified"), // not the parent's own: counts nowhere
  milestone(on(3, 12)),
  word(on(2, 18)),
  kid(on(0, 17)),
  kid(on(3, 16), "mimicSessions", ["talking"]),
  kid(on(4, 9), "missionRecords", ["feelings"]),
  obs({ at: on(4, 10), domains: ["body"], kind: "measurement", origin: "growthEntries", value: { type: "measurement", heightCm: 101 } }), // not counted
  moment(on(-1, 20), ["feelings"]), // the week before
  moment(on(5, 9), ["feelings"]), // after now (a future day of this week)
];
const STEPS = [
  step("helped", on(0, 20)),
  step("not_today", on(1, 9)),
  step("helped", on(1, 21)),
  step("helped", on(2, 8)),
  step("somewhat", on(2, 20)),
  step("helped", on(-2, 9)), // the week before
];

describe("weekGlance — the report week as counts (v3 EXTRA-WEEKLY)", () => {
  const glance = weekGlance({ observations: OBSERVATIONS, actionLoop: STEPS, now: NOW, weekStartMs: START });

  it("the fixture's week is the report's week (the id the letter is filed under)", () => {
    expect(recapWeekId(new Date(START))).toBe(recapWeekId(NOW));
    expect(recapWeekId(new Date(START - 1))).not.toBe(recapWeekId(NOW));
    expect(Date.parse(on(0, 9))).toBeGreaterThanOrEqual(START);
  });

  it("counts per key: parent moments, steps that helped, milestones, words, Kid Mode sessions", () => {
    expect(glance.counts).toEqual({ moments: 3, helped: 3, milestones: 1, words: 1, kid: 3, tried: 3 });
  });

  it("buckets each record into its local day; the week's first instant counts, the instant before and anything after now do not", () => {
    expect(glance.perDay).toHaveLength(7);
    expect(glance.perDay.map((day) => day.startMs)).toEqual([0, 1, 2, 3, 4, 5, 6].map(midnight));
    expect(glance.perDay.map((day) => day.moments)).toEqual([1, 2, 0, 0, 0, 0, 0]);
    expect(glance.perDay.map((day) => day.kid)).toEqual([1, 0, 0, 1, 1, 0, 0]);
    expect(glance.perDay.map((day) => day.helped)).toEqual([1, 1, 1, 0, 0, 0, 0]);

    const edge = weekGlance({
      observations: [
        moment(new Date(START).toISOString()),
        moment(new Date(START - 1).toISOString()),
        moment(new Date(midnight(2)).toISOString()),
        moment(new Date(midnight(2) - 1).toISOString()),
        moment(new Date(NOW.getTime() + 1).toISOString()),
      ],
      actionLoop: [],
      now: NOW,
      weekStartMs: START,
    });
    expect(edge.counts.moments).toBe(3);
    expect(edge.perDay.map((day) => day.moments)).toEqual([1, 1, 1, 0, 0, 0, 0]);
  });

  it("a day's outcome is the last one recorded that day; anything but 'helped' reads 'not this time'", () => {
    expect(glance.perDay.map((day) => day.outcome)).toEqual(["helped", "helped", "not-this-time", null, null, null, null]);
    const alone = (outcome: "somewhat" | "not_today") =>
      weekGlance({ observations: [], actionLoop: [step(outcome, on(1, 9))], now: NOW, weekStartMs: START });
    expect(alone("somewhat").perDay[1].outcome).toBe("not-this-time");
    expect(alone("not_today").perDay[1].outcome).toBe("not-this-time");
    expect(alone("not_today").counts.helped).toBe(0);
    expect(alone("not_today").counts.tried).toBe(1);
  });

  it("by area: the parent's own moments only, once per area each carries; milestones, words, Kid Mode sessions and records outside the week add nothing", () => {
    // feelings: day 0 + day 1 (confirmed); family: day 1. The unverified moment,
    // the milestone (moving), the word and Kid Mode (talking, thinking, feelings),
    // the measurement and the moments before or after the week stay out.
    expect(glance.byDomain).toEqual({ feelings: 2, family: 1 });
    expect(glance.byDomain.moving).toBeUndefined();
    expect(glance.byDomain.thinking).toBeUndefined();
    expect(glance.byDomain.body).toBeUndefined();
  });

  it("today: the day of the strip that holds now; -1 before the strip opens, 7 once it lies behind", () => {
    expect(glance.today).toBe(4);
    const at = (now: Date) => weekGlance({ observations: [], actionLoop: [], now, weekStartMs: START }).today;
    expect(at(new Date(START))).toBe(0);
    expect(at(new Date(midnight(1) - 1))).toBe(0);
    expect(at(new Date(midnight(1)))).toBe(1);
    expect(at(new Date(midnight(6) + 3_600_000))).toBe(6);
    expect(at(new Date(midnight(7)))).toBe(7);
    expect(at(new Date(midnight(0) - 1))).toBe(-1);
  });

  it("scales: max over all five counts (Now's bars), stackMax over moments + Kid Mode sessions (the glance's strip)", () => {
    expect(glance.max).toBe(3);
    expect(glance.stackMax).toBe(2);
    const empty = weekGlance({ observations: [], actionLoop: [], now: NOW, weekStartMs: START });
    expect(empty.max).toBe(1);
    expect(empty.stackMax).toBe(1);
  });

  it("a zero week holds nothing to count; one step tried is something", () => {
    const empty = weekGlance({ observations: [], actionLoop: [], now: NOW, weekStartMs: START });
    expect(glanceHasCounts(empty)).toBe(false);
    expect(empty.byDomain).toEqual({});
    expect(empty.perDay.every((day) => day.outcome === null)).toBe(true);
    expect(glanceHasCounts(weekGlance({ observations: [], actionLoop: [step("not_today", on(0, 9))], now: NOW, weekStartMs: START }))).toBe(true);
    expect(glanceHasCounts(weekGlance({ observations: [], actionLoop: [step("helped", on(-1, 9))], now: NOW, weekStartMs: START }))).toBe(false);
  });

  it("NowWeekSoFar's numbers are unchanged: counts, per-day counts and max equal the shipped computation", () => {
    for (const now of [NOW, new Date(2026, 9, 10, 23, 30), new Date(2026, 9, 16, 21, 0), new Date(2026, 11, 31, 22, 0), new Date(2027, 0, 1, 9, 0)]) {
      const legacy = legacyWeek(OBSERVATIONS, STEPS, now);
      const next = weekGlance({ observations: OBSERVATIONS, actionLoop: STEPS, now, weekStartMs: recapWeekStartMs(now) });
      const five = (counts: Record<WeekCountKey, number>) => Object.fromEntries(WEEK_ORDER.map((key) => [key, counts[key]]));
      expect(five(next.counts), now.toISOString()).toEqual(legacy.counts);
      expect(next.perDay.map(five), now.toISOString()).toEqual(legacy.perDay);
      expect(next.max, now.toISOString()).toBe(legacy.max);
    }
  });
});

describe("weekGlance copy — counts, never a share, a ratio or a trend sign (EN + HE)", () => {
  const KEYS = Object.keys(foundationEn).filter((key) => key.startsWith("elev.wk.glance."));

  it("every glance key exists in both languages", () => {
    expect(KEYS.length).toBeGreaterThanOrEqual(12);
    for (const key of KEYS) expect(foundationHe[key], key).toBeTruthy();
    expect(Object.keys(foundationHe).filter((key) => key.startsWith("elev.wk.glance.")).sort()).toEqual([...KEYS].sort());
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: no '%', no '/', no '+N', no 'n of m' in any glance label, with a count filled in`, () => {
      for (const key of KEYS) {
        const text = translate(lang, key, { n: 4 });
        expect(text, key).not.toMatch(/%|\/|\+\s*\d|\d\s*(?:of|out of|מתוך)\s*\d/);
        if (lang === "he") expect(text, key).not.toMatch(/[A-Za-z]/);
      }
    });
  }

  it("the sub-line and the steps line read as written", () => {
    expect(translate("en", "elev.wk.glance.sub")).toBe("What you kept, what helped, and what to carry into next week. Counts, not scores.");
    expect(translate("he", "elev.wk.glance.sub")).toBe("מה שמרתם, מה עזר ומה לקחת לשבוע הבא. ספירות, לא ציונים.");
    expect(translate("en", "elev.wk.glance.tried", { n: 3 })).toBe("tried on 3 days");
    expect(translate("he", "elev.wk.glance.tried", { n: 3 })).toBe("נוסו ב-3 ימים");
  });
});
