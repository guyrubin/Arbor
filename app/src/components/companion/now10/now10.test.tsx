import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EVENING_START_HOUR } from "../../../lib/timeOfDay";
import type { Observation } from "../../../lib/observations";
import { ARC_DESK, arcFraction, arcPoint, clock24, EVENING_FROM_HOUR, eveningMoments, quietSegments } from "./dayArcModel";
import { NOW_V10_COPY } from "./nowV10Copy";
import NowDayArc from "./NowDayArc";
import NowWaiting, { NowNotebookBadge } from "./NowWaiting";
import { familyPlanLinesForNow, NOW_FAMILY_PLAN_ROWS } from "./familyPlanSlot";
import type { FamilyPlanDate } from "../../../lib/familyPlan/model";

vi.mock("../../../context/ArborContext", () => ({ useArbor: () => ({ actionLoop: [], actionPlans: [] }) }));
vi.mock("../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", t: (k: string) => k }) }));

import NowThisWeek from "./NowThisWeek";

/** Visible words only. */
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();

const moment = (at: string, source: Observation["source"] = "parent_typed"): Observation => ({
  id: `m-${at}`, kind: "moment", source, origin: "behaviorLogs", at, domains: [], value: { type: "note", text: "x" },
} as unknown as Observation);

describe("the day arc model (real things only)", () => {
  it("places the clock along 06:00 to 21:00 and clamps outside it", () => {
    expect(arcFraction(6 * 60)).toBe(0);
    expect(arcFraction(21 * 60)).toBe(1);
    expect(arcFraction(13 * 60 + 30)).toBeCloseTo(0.5);
    expect(arcFraction(2 * 60)).toBe(0);
    expect(arcFraction(23 * 60)).toBe(1);
    const p = arcPoint(ARC_DESK, arcFraction(17 * 60 + 40));
    // The board's sun at 17:40 sits at (574.5, 184).
    expect(p.x).toBeCloseTo(574.5, 0);
    expect(p.y).toBeCloseTo(184, 0);
  });

  it("draws the parent's quiet hours where they fall on the arc", () => {
    expect(quietSegments(21, 8)).toEqual([{ from: 0, to: arcFraction(8 * 60), edge: "start" }]);
    expect(quietSegments(20, 7)).toEqual([{ from: 0, to: arcFraction(7 * 60), edge: "start" }, { from: arcFraction(20 * 60), to: 1, edge: "end" }]);
    expect(quietSegments(22, 6)).toEqual([]);
  });

  it("the evening band starts at the evening door's hour", () => {
    expect(EVENING_FROM_HOUR).toBe(EVENING_START_HOUR);
  });

  it("counts the parent's own moments of the last four weeks and how many fell in the evening", () => {
    const now = new Date(2026, 10, 16, 17, 40);
    const at = (d: number, h: number) => new Date(2026, 10, d, h, 15).toISOString();
    const observations = [
      moment(at(15, 19)), moment(at(14, 18)), moment(at(13, 9)), moment(at(12, 20)),
      moment(at(10, 19), "kid_practice"), // a Kid Mode record: not the parent's moment
      moment(new Date(2026, 9, 1, 19).toISOString()), // older than four weeks
      moment(at(17, 19)), // after now
    ];
    expect(eveningMoments(observations, now)).toEqual({ inBand: 3, total: 4 });
    expect(eveningMoments([], now)).toEqual({ inBand: 0, total: 0 });
  });

  it("labels the clock in 24 hours in both languages", () => {
    expect(clock24(17 * 60 + 5)).toBe("17:05");
    expect(clock24(6 * 60)).toBe("6:00");
  });
});

describe("NowDayArc", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: names itself, marks the clock now, draws quiet hours, and no invented times`, () => {
      const copy = NOW_V10_COPY[lang];
      const html = renderToStaticMarkup(<NowDayArc composition="desk" now={new Date(2026, 10, 16, 17, 40)} quietStart={21} quietEnd={8} evening copy={copy}><p>face</p></NowDayArc>);
      expect(html).toContain(`aria-label="${copy.arcAria("6:00", "21:00")}"`);
      expect(html).toContain(copy.nowAt("17:40"));
      expect(html).toContain('class="g-win"');
      expect(html).toContain('class="nw-quiet"');
      expect(html).toContain(copy.quietHours);
      expect(html).toContain("<p>face</p>");
      // Hour labels and the clock now only: no event times appear on the arc.
      const times = [...words(html).matchAll(/\b\d{1,2}:\d{2}\b/g)].map((m) => m[0]);
      expect(new Set(times)).toEqual(new Set(["9:00", "12:00", "15:00", "18:00", "6:00", "21:00", "8:00", "17:40"]));
      expect(words(html)).not.toMatch(/\d\s*%/);
    });
  }
  it("without moments in the evening there is no band", () => {
    const html = renderToStaticMarkup(<NowDayArc composition="phone" now={new Date(2026, 10, 16, 9, 0)} quietStart={21} quietEnd={8} evening={false} copy={NOW_V10_COPY.en} />);
    expect(html).not.toContain('class="g-win"');
  });
});

describe("NowThisWeek (counts, never verdicts)", () => {
  const labels = { moments: "Moments", helped: "Steps that helped", milestones: "Milestones", words: "Words kept", kid: "In Kid Mode" };
  const render = (observations: Observation[], composition: "desk" | "phone" = "desk", lang: "en" | "he" = "en") => renderToStaticMarkup(
    <NowThisWeek composition={composition} observations={observations} actionLoop={[]} now={new Date(2026, 10, 16, 17, 40)} lang={lang} copy={NOW_V10_COPY[lang]}
      title="This week so far" labels={labels} emptyLine="Nothing kept yet this week." reportLabel="Weekly report" onReport={() => {}} titleId="w" />);

  it("draws this week's moments as figures and marks, one column per day, with the link to Weekly report", () => {
    const html = render([moment(new Date(2026, 10, 15, 10).toISOString()), moment(new Date(2026, 10, 14, 19).toISOString())]);
    expect(html).toContain("This week so far");
    expect(html).toContain('data-testid="now-week-report"');
    expect(html.match(/class="wd/g)).toHaveLength(7);
    expect(html.match(/class="tok moment md"/g)).toHaveLength(2);
    expect(words(html)).toContain("2 Moments");
    expect(html).toContain(`aria-label="${NOW_V10_COPY.en.weekStripAria}"`);
    expect(words(html)).not.toMatch(/\d\s*%|\d\s*\/\s*\d|score|level/i);
  });

  it("a new family sees production's empty line and empty columns, never a zero tile", () => {
    for (const composition of ["desk", "phone"] as const) {
      const html = render([], composition);
      expect(html).toContain('data-testid="now-week-empty"');
      expect(html).not.toMatch(/<b>0<\/b>/);
      expect(html.match(/class="tok /g)).toBeNull();
    }
  });

  it("Hebrew: the days and range in Hebrew", () => {
    const html = render([moment(new Date(2026, 10, 15, 10).toISOString())], "phone", "he");
    expect(words(html)).toMatch(/[֐-׿]/);
    expect(words(html)).toContain(" עד ");
  });
});

describe("Waiting for you", () => {
  it("draws only the steps it is given, each with its when mark", () => {
    const html = renderToStaticMarkup(<NowWaiting composition="phone" steps={[
      { key: "now", when: "Now", sub: "Worth noticing", current: true, body: <p>notice</p> },
      { key: "later", when: "Later", body: <p>notebook</p> },
    ]} />);
    expect(html).toContain('class="nw-seq m"');
    expect(html.match(/class="nw-step/g)).toHaveLength(2);
    expect(html).toContain('class="nw-step nw-now"');
    expect(words(html)).toContain("Now Worth noticing");
    expect(html).not.toContain('data-step="tonight"');
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the notebook is a count and a link to About, never inline approval`, () => {
      const copy = NOW_V10_COPY[lang];
      const onOpen = vi.fn();
      const element = <NowNotebookBadge waiting={4} copy={copy} notebook="Arbor’s notebook" label="4 notes waiting for you" onOpen={onOpen} />;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('data-testid="now-notebook-badge"');
      expect(html).toContain("<b>4</b>");
      expect(html).toContain(copy.notesWaiting(4));
      expect(html.match(/<button/g)).toHaveLength(1);
      expect(html).not.toMatch(/That.s right|Not quite|Remember|Not this/);
      element.props.onOpen();
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  }
});

describe("Coming up's Family plan slot (synthetic dates)", () => {
  const date = (id: string, day: string, extra: Partial<FamilyPlanDate> = {}): FamilyPlanDate => ({
    id, kind: "event", title: `Date ${id}`, date: day, origin: "manual", version: 1, status: "open",
    history: [], createdBy: "parent-a", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...extra,
  } as FamilyPlanDate);
  const onOpen = vi.fn();

  it("draws no line for a family with no dates", () => {
    expect(familyPlanLinesForNow([], "2026-11-16", "en", "parent-a", onOpen)).toEqual([]);
  });

  it("lists open dates from today on, soonest first, at most three, each opening Family plan", () => {
    const lines = familyPlanLinesForNow([
      date("late", "2026-11-25"),
      date("past", "2026-11-12"),
      date("today", "2026-11-16", { time: "08:30", holder: { uid: "parent-a", role: "owner" } }),
      date("done", "2026-11-17", { status: "done" }),
      date("next", "2026-11-18", { holder: { uid: "co-1", role: "co_parent", email: "dana@example.com" } }),
      date("later", "2026-11-20"),
    ], "2026-11-16", "en", "parent-a", onOpen);
    expect(lines).toHaveLength(NOW_FAMILY_PLAN_ROWS);
    expect(lines.map((l) => l.id)).toEqual(["today", "next", "later"]);
    expect(lines[0]).toMatchObject({ day: 16, nobody: false, title: "Date today", sub: "08:30 · You" });
    expect(lines[1]).toMatchObject({ day: 18, nobody: false, sub: "dana" });
    expect(lines[2]).toMatchObject({ day: 20, nobody: true, sub: NOW_V10_COPY.en.familyPlanNobody });
    lines[1].onOpen();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("speaks Hebrew for a Hebrew reader", () => {
    const [line] = familyPlanLinesForNow([date("x", "2026-11-18")], "2026-11-16", "he", "parent-a", onOpen);
    expect(line.sub).toBe(NOW_V10_COPY.he.familyPlanNobody);
    expect(/[\u0590-\u05FF]/.test(line.weekday)).toBe(true);
  });

  it("NEGATIVE CONTROL: past, done and cancelled dates never reach Now", () => {
    const lines = familyPlanLinesForNow([
      date("past", "2026-11-10"), date("done", "2026-11-18", { status: "done" }), date("gone", "2026-11-19", { status: "cancelled" }),
    ], "2026-11-16", "en", "parent-a", onOpen);
    expect(lines).toEqual([]);
  });
});

describe("Now v10 copy", () => {
  const shape = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? shape(v).map((x) => `${k}.${x}`) : [k])).sort();
  it("says the same things in English and Hebrew, and the Hebrew is Hebrew", () => {
    expect(shape(NOW_V10_COPY.he)).toEqual(shape(NOW_V10_COPY.en));
    const flat = (o: object): unknown[] => Object.values(o).flatMap((v) => (v && typeof v === "object" ? flat(v) : [v]));
    for (const value of flat(NOW_V10_COPY.he)) {
      const text = typeof value === "function" ? (value as (...a: unknown[]) => string)(2, "21:00") : String(value);
      expect(text).toMatch(/[֐-׿]/);
    }
  });
  it("no rhetorical questions, no AI wording, no score words", () => {
    const flat = (o: object): unknown[] => Object.values(o).flatMap((v) => (v && typeof v === "object" ? flat(v) : [v]));
    for (const lang of ["en", "he"] as const) for (const value of flat(NOW_V10_COPY[lang])) {
      const text = typeof value === "function" ? (value as (...a: unknown[]) => string)(3, "9:00") : String(value);
      expect(text).not.toMatch(/\?|\bAI\b|score|percent|%/i);
    }
  });
});

describe("the record lead on the stage (N-Now V77)", () => {
  it("is the three worded answers, outlined, in one row, carrying the one primary move; the question and quote ride the arc", async () => {
    const { default: FromRecordCard } = await import("../../overview/FromRecordCard");
    const opener = { key: "note:n1", kind: "plan", topic: null, quote: "Put his shoes on by himself", quoteSource: "parent", quoteAt: "2026-11-14T08:00:00" } as unknown as Parameters<typeof FromRecordCard>[0]["opener"];
    const stage = renderToStaticMarkup(<FromRecordCard stage opener={opener} childName="Noa" stampMove="choose-next-step" onAnswer={() => {}} />);
    expect(stage).toContain('class="ans3 flat"');
    expect(stage.match(/<button/g)).toHaveLength(3);
    expect(stage.match(/data-primary-move="choose-next-step"/g)).toHaveLength(1);
    expect(stage).not.toContain("today-record-quote");
    expect(stage).not.toContain("today-record-question");
    // Negative control: the card form still carries its own quote and question.
    const card = renderToStaticMarkup(<FromRecordCard opener={opener} childName="Noa" onAnswer={() => {}} />);
    expect(card).toContain('data-testid="today-record-quote"');
    expect(card).toContain('data-testid="today-record-question"');
  });
});
