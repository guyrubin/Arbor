import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { translate } from "../../../lib/i18n";
import { dayField } from "../../../lib/dayField";
import type { DayWindowsSummary } from "../../../growth/dayWindowsAgg";
import { weekInstrument } from "../../../lib/weekInstrument";
import type { Observation } from "../../../lib/observations";
import WeekInstrument from "./WeekInstrument";
import WhatHelped from "./WhatHelped";
import YourDay from "./YourDay";
import WeekReadGuide from "./WeekReadGuide";
import CarryNextWeek from "./CarryNextWeek";
import { WEEKLY_COPY } from "./weeklyCopy";

/* v10 Weekly report components, rendered with and without data, in both
   languages, against the clinical firewall. Invented records only. */

const LANGS = ["en", "he"] as const;
const t = (lang: "en" | "he") => (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, " ").replace(/\s+/g, " ");
const FIREWALL = /%|\d\s*\/\s*\d|\+\s*\d|\bscore\b|\blevel\b|\brisk\b|behind|delay/i;

describe("weeklyCopy", () => {
  it("EN and HE carry the same keys; Hebrew is Hebrew; no AI wording, no price words", () => {
    expect(Object.keys(WEEKLY_COPY.he).sort()).toEqual(Object.keys(WEEKLY_COPY.en).sort());
    for (const [key, value] of Object.entries(WEEKLY_COPY.he)) {
      const s = typeof value === "function" ? (value as (...a: unknown[]) => string)(2, "x") : value;
      if (s) expect(s, key).toMatch(/[֐-׿]/);
    }
    const all = JSON.stringify(WEEKLY_COPY) + Object.values(WEEKLY_COPY.en).map((v) => (typeof v === "function" ? (v as (...a: unknown[]) => string)(3, "Evening") : "")).join(" ");
    expect(all).not.toMatch(/\bAI\b|subscription|price/i);
  });

  it("the milestone line names the count and the day it was marked (V73: agrees with Milestones)", () => {
    expect(WEEKLY_COPY.en.milestonesChip(1, "Sat 14")).toBe("Milestones · 1 marked this week · Sat 14");
    expect(WEEKLY_COPY.en.milestonesChip(0, "")).toBe("Milestones · none marked this week");
    expect(WEEKLY_COPY.he.milestonesChip(2, "שבת 14")).toMatch(/2 .* · שבת 14$/);
  });

  it("the one legend line is the canvas sentence", () => {
    expect(WEEKLY_COPY.en.legend).toBe("Each mark is one thing you recorded.");
  });
});

const dayStarts = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 10 + i).getTime());
const obs = (id: string, iso: string) => ({
  id, childId: "c", at: iso, domains: [], kind: "moment", value: { type: "moment", behaviorType: "Moment" },
  source: "parent_typed", origin: "behaviorLogs", ageAtObservationMonths: 40, pretermCorrected: false,
}) as unknown as Observation;
const data = weekInstrument({
  observations: [obs("behaviorLogs:a", new Date(2026, 9, 10, 7).toISOString()), obs("behaviorLogs:b", new Date(2026, 9, 11, 18).toISOString())],
  actionLoop: [{ id: "s", outcome: "helped", outcomeAt: new Date(2026, 9, 11, 20).toISOString() }],
  logs: [{ id: "a", intensity: 5 }],
  dayStarts,
  endMs: new Date(2026, 9, 12, 15).getTime(),
  isCurrent: true,
});

describe("WeekInstrument", () => {
  for (const lang of LANGS) {
    for (const composition of ["desk", "phone"] as const) {
      it(`${lang} · ${composition}: kinds with a count are filter chips; the legend once; a table for screen readers`, () => {
        const copy = WEEKLY_COPY[lang];
        const html = renderToStaticMarkup(<WeekInstrument data={data} composition={composition} copy={copy} locale={lang === "he" ? "he-IL" : "en-US"} />);
        expect([...html.matchAll(/data-testid="weekly-kind-([a-z]+)"/g)].map((m) => m[1])).toEqual(["moment", "hard", "helped"]);
        expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
        expect(html.split(copy.legend).length - 1).toBe(1);
        expect(html).toContain("<table>");
        expect(text(html)).not.toMatch(FIREWALL);
      });
    }
  }
});

describe("WeekInstrument — the dates rail and today's step (N-Week-D/M)", () => {
  const withDates = weekInstrument({
    observations: [], actionLoop: [], logs: [], dayStarts, endMs: new Date(2026, 9, 12, 15).getTime(), isCurrent: true,
    dates: [{ id: "plan:a", startMs: new Date(2026, 9, 14, 0).getTime(), label: "Visit form", sub: "you", nobody: false }, { id: "plan:b", startMs: new Date(2026, 9, 15, 0).getTime(), label: "Group visit", sub: "nobody yet", nobody: true }],
  });
  for (const composition of ["desk", "phone"] as const) {
    it(`${composition}: each date on its day with who has it; nobody yet is dashed; the next item after the week ends the rail; today's step rings today`, () => {
      const html = renderToStaticMarkup(<WeekInstrument data={withDates} composition={composition} copy={WEEKLY_COPY.en} locale="en-GB" todayStep beyond={{ label: "Speech therapist", sub: "you", ms: new Date(2026, 9, 21, 10).getTime() }} />);
      for (const text of ["Visit form", "Group visit", "nobody yet", "Speech therapist"]) expect(html).toContain(text);
      expect(html.match(/class="tok date none/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(html).toContain(`aria-label="${WEEKLY_COPY.en.todaysStep}"`);
      expect(html).toMatch(/class="tok plan here/);
    });
  }
});

const summary = (enough: boolean): DayWindowsSummary => ({
  hasEnoughData: enough, daysLogged: enough ? 9 : 2, daysNeeded: enough ? 0 : 3,
  windows: enough ? [{ label: "often-trickier", startHour: 16, endHour: 18 }] : [],
  patternObservation: enough ? { peakHour: 17, hardDays: 3, daysLogged: 9 } : null,
  hourCounts: Array.from({ length: 15 }, (_, i) => ({ hour: 6 + i, count: enough && i === 11 ? 5 : 0 })),
});

describe("YourDay", () => {
  const now = new Date(2026, 10, 16, 18).getTime();
  const field = dayField([{ timestamp: new Date(2026, 10, 15, 18).toISOString() }, { timestamp: new Date(2026, 10, 15, 19).toISOString(), intensity: 4 }], now);
  for (const lang of LANGS) {
    it(`${lang}: below the floor → the low-data line and days so far; the guard once`, () => {
      const html = renderToStaticMarkup(<YourDay composition="desk" copy={WEEKLY_COPY[lang]} t={t(lang)} uiLang={lang} locale={lang} field={field} summary={summary(false)} onHardMoments={() => {}} />);
      expect(html).toContain('data-testid="dw-low-data"');
      expect(html).toContain('data-testid="dw-days-progress"');
      expect(html).not.toContain('data-testid="dw-pattern-observation"');
      expect(html.split(translate(lang, "dw.guard")).length - 1).toBe(1);
      expect(html.match(/data-testid="dw-hour-bar"/g)).toHaveLength(15);
      // The busiest part, with its unit in words.
      expect(text(html)).toContain(WEEKLY_COPY[lang].dayHead(WEEKLY_COPY[lang].eveningPart, WEEKLY_COPY[lang].eveningSpan, 2));
    });

    it(`${lang}: above the floor → the trickier window and the pattern line; overflow reads "n more", never "+n"`, () => {
      const html = renderToStaticMarkup(<YourDay composition="phone" copy={WEEKLY_COPY[lang]} t={t(lang)} uiLang={lang} locale={lang} field={field} summary={summary(true)} onHardMoments={() => {}} />);
      expect(html).toContain('data-testid="dw-pattern-observation"');
      expect(html).toContain(translate(lang, "dw.label.trickier"));
      expect(html).toContain(WEEKLY_COPY[lang].more(2));
      expect(text(html)).not.toMatch(/\+\s*\d/);
    });

    it(`${lang}: nothing logged → no figure, no since line; the grid stays blank`, () => {
      const html = renderToStaticMarkup(<YourDay composition="desk" copy={WEEKLY_COPY[lang]} t={t(lang)} uiLang={lang} locale={lang} field={dayField([], now)} summary={summary(false)} onHardMoments={() => {}} />);
      expect(html).not.toContain('class="fig');
      expect(html).not.toContain('class="tok ');
    });
  }
});

describe("WhatHelped (canvas V77)", () => {
  const steps = [{ step: "Name the feeling first", helped: 1, notThisTime: 0, helpedDays: [dayStarts[0]], latest: 1 }, { step: "Offer two choices", helped: 0, notThisTime: 1, helpedDays: [], latest: 0 }];
  for (const lang of LANGS) {
    it(`${lang}: the steps as reported; beside them the words used and one card to the week's hard moments`, () => {
      const html = renderToStaticMarkup(<WhatHelped composition="desk" copy={WEEKLY_COPY[lang]} t={t(lang)} uiLang={lang} locale={lang} childFirst="Noa" hardCount={2} steps={steps} heldWords={<p>held</p>} hasHeldWords words={["moon"]} onPlans={() => {}} onHardMoments={() => {}} />);
      for (const id of ["weekly-steps", "weekly-thread-words", "weekly-hard-card", "weekly-words"]) expect(html).toContain(`data-testid="${id}"`);
      expect(tagButton(html, "weekly-hard-card")).toBe(true);
      // One line and a link: the count lives once, in the instrument's legend.
      const card = html.slice(html.indexOf('data-testid="weekly-hard-card"'));
      expect(text(card.slice(0, card.indexOf("</button>")))).toContain(translate(lang, "nav.view.behaviors"));
      expect(text(card.slice(0, card.indexOf("</button>")))).not.toMatch(/\d/);
      expect(html.match(/data-testid="weekly-step"/g)).toHaveLength(2);
      // One "not this time" names its day, as N-Week-D writes it ("Not this time · Sun 15").
      expect(text(html)).toContain(WEEKLY_COPY[lang].notThisTimeOn(new Date(0).toLocaleDateString(lang, { weekday: "short", day: "numeric" })));
      // Negative control: the counted form shows only for more than one.
      expect(html).not.toContain(translate(lang, "elev.wk.helped.not", { n: 1 }));
      const twice = renderToStaticMarkup(<WhatHelped composition="desk" copy={WEEKLY_COPY[lang]} t={t(lang)} uiLang={lang} locale={lang} childFirst="Noa" hardCount={0} steps={[{ ...steps[1], notThisTime: 2 }]} heldWords={null} hasHeldWords={false} words={[]} onPlans={() => {}} onHardMoments={() => {}} />);
      expect(twice).toContain(translate(lang, "elev.wk.helped.not", { n: 2 }));
      expect(text(html)).not.toMatch(FIREWALL);
    });

    it(`${lang}: no hard moment → no card; nothing recorded → production's empty line`, () => {
      const html = renderToStaticMarkup(<WhatHelped composition="phone" copy={WEEKLY_COPY[lang]} t={t(lang)} uiLang={lang} locale={lang} childFirst="Noa" hardCount={0} steps={[]} heldWords={null} hasHeldWords={false} words={[]} onPlans={() => {}} onHardMoments={() => {}} />);
      expect(html).not.toContain('data-testid="weekly-hard-card"');
      expect(html).toContain(translate(lang, "elev.wk.helped.none"));
    });
  }
});

const tagButton = (html: string, id: string) => new RegExp(`<button [^>]*data-testid="${id}"`).test(html);

describe("WeekReadGuide — How to read this week (N-Week-D/M)", () => {
  for (const lang of LANGS) {
    for (const composition of ["desk", "phone"] as const) {
      it(`${lang} · ${composition}: four stops, each a drawing (decor) and one line; no record, no claim about the child`, () => {
        const c = WEEKLY_COPY[lang];
        const html = renderToStaticMarkup(<WeekReadGuide composition={composition} copy={c} />);
        expect(html).toContain(c.readTitle);
        for (const line of [c.readWeek, c.readHelped, c.readNext, c.readDay]) expect(text(html)).toContain(line.replace(/[’']/g, (m) => m));
        expect(html.match(/<svg [^>]*aria-hidden="true"/g)).toHaveLength(4);
        if (composition === "phone") expect(html).toContain(c.readOf(1, 4));
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(text(html)).not.toMatch(FIREWALL);
      });
    }
  }
});

describe("WeekInstrument — the join line (N-Week-D/M)", () => {
  const hardObs = obs("behaviorLogs:h", new Date(2026, 9, 10, 7).toISOString());
  const build = (source: string) => weekInstrument({
    observations: [hardObs], logs: [{ id: "h", intensity: 4 }], dayStarts, endMs: new Date(2026, 9, 12, 15).getTime(), isCurrent: true,
    actionLoop: [{ id: "s", source: source as "hard-moment", outcome: "helped", outcomeAt: new Date(2026, 9, 10, 9).toISOString() }],
  });
  for (const composition of ["desk", "phone"] as const) {
    it(`${composition}: a paired day draws one decorative line; an unpaired day draws none`, () => {
      const paired = renderToStaticMarkup(<WeekInstrument data={build("hard-moment")} composition={composition} copy={WEEKLY_COPY.en} locale="en-GB" />);
      const lines = paired.match(/<i class="wk10-join [hv]" data-testid="weekly-join" aria-hidden="true"/g) ?? [];
      expect(lines).toHaveLength(1);
      expect(paired).toContain(composition === "desk" ? 'class="wk10-join v"' : 'class="wk10-join h"');
      const unpaired = renderToStaticMarkup(<WeekInstrument data={build("digest")} composition={composition} copy={WEEKLY_COPY.en} locale="en-GB" />);
      expect(unpaired).not.toContain("weekly-join");
    });
  }
  it("the line uses logical sides only, so Hebrew mirrors it (arrow toward the row's end)", () => {
    const css = readFileSync(new URL("./weeklyV10.css", import.meta.url), "utf8");
    const rules = css.slice(css.indexOf(".ds .wk10-join {"));
    expect(rules).toMatch(/inset-inline-end/);
    expect(rules).not.toMatch(/\b(left|right):/);
  });
});

describe("Fidelity re-audit (N-Week-D/M)", () => {
  it("the dates rail gives the item after the week its own column past Friday (desktop)", () => {
    const data = weekInstrument({ observations: [], actionLoop: [], logs: [], dayStarts, endMs: new Date(2026, 9, 12, 15).getTime(), isCurrent: true });
    const html = renderToStaticMarkup(<WeekInstrument data={data} composition="desk" copy={WEEKLY_COPY.en} locale="en-GB" beyond={{ label: "Speech therapist", ms: new Date(2026, 9, 21, 10).getTime() }} />);
    expect(html).toContain('class="wk10-plot has-beyond"');
    expect(html).toContain('class="wk10-cell wk10-beyondcell"');
    const none = renderToStaticMarkup(<WeekInstrument data={data} composition="desk" copy={WEEKLY_COPY.en} locale="en-GB" />);
    expect(none).not.toContain("has-beyond");
  });

  it("phone: an empty day ahead is a short row; a dated day ahead keeps its height and shows the date as a pill", () => {
    const data = weekInstrument({ observations: [], actionLoop: [], logs: [], dayStarts, endMs: new Date(2026, 9, 12, 15).getTime(), isCurrent: true,
      dates: [{ id: "plan:x", startMs: new Date(2026, 9, 14).getTime(), label: "Visit form", sub: "you" }] });
    const html = renderToStaticMarkup(<WeekInstrument data={data} composition="phone" copy={WEEKLY_COPY.en} locale="en-GB" />);
    expect(html.match(/class="wk10-mr ahead short"/g)).toHaveLength(3);
    expect(html).toContain('<span class="wk-pill">Visit form · you</span>');
  });

  for (const lang of LANGS) {
    it(`${lang}: By area draws a hard moment's area in rust with "you marked it settled", a moment's with its day and the parent's words`, () => {
      const c = WEEKLY_COPY[lang];
      const areas = [
        { domain: "feelings", n: 1, milestones: [], latest: { kind: "moment", behaviorType: "Tantrum" } },
        { domain: "hands", n: 1, milestones: [], latest: { kind: "moment", behaviorType: "Moment" } },
      ] as unknown as Parameters<typeof CarryNextWeek>[0]["areas"];
      const html = renderToStaticMarkup(
        <CarryNextWeek composition="desk" copy={c} t={t(lang)} uiLang={lang} locale={lang} forNextWeek={null} areas={areas} visit={null} nowMs={0}
          areaDetail={{ feelings: { ms: dayStarts[0], text: "x", hard: true, settled: true }, hands: { ms: dayStarts[1], text: "“Put his shoes on”", hard: false, settled: false } }}
          onHardMoments={() => {}} onMoments={() => {}} onPrepare={() => {}} />,
      );
      expect(html).toContain('class="nx-area hard" data-area="feelings"');
      expect(text(html)).toContain(c.settledNote);
      expect(html).toContain("“Put his shoes on”");
      expect(html).toContain('class="nx-area" data-area="hands"');
    });

    it(`${lang}: Your day's lead line counts logs at home and the weekday most logged`, () => {
      expect(WEEKLY_COPY.en.dayFoot(12, 4, "Saturday")).toBe("12 at home, 4 on a Saturday.");
      expect(WEEKLY_COPY[lang].dayFoot(0, 3, "x")).not.toMatch(/^0/);
    });
  }
});
