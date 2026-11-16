import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* v3 F-NOW-3 — re-pin of v3 EXTRA-WEEKLY's #/weekly glance: the Weekly report
   IS the dashboard now, as the v3 mock draws it. The current week leads with
   it whenever the week holds a record or a report (the letter left the route),
   always four tiles and every area; with nothing to count and nothing stored,
   the honest empty card. The carry band follows in every state. Top-level
   modules: weekly-glance (or weekly-empty), then weekly-carry; the invite is
   demoted into the page's one disclosure. The header steps through the stored
   weeks (Previous / Next, no chip strip) and holds the summary door from md
   up; on phones the door closes the page. Invented examples only. */

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
vi.mock("../../lib/analytics", () => ({ track: () => undefined }));
const tab = vi.hoisted(() => ({
  reports: [] as unknown[],
  observations: [] as unknown[],
  actionLoop: [] as unknown[],
  appointments: [] as unknown[],
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "child-invented", name: "Noa", birthDate: "2022-05-01" },
    setActiveTab: () => undefined,
    acceptTodayAction: () => undefined,
    activeTodayAction: null,
    behaviorLogs: [], playLogs: [], milestones: [], checkedMilestones: 0,
    actionLoop: tab.actionLoop, approvedMemoryItems: [], keptInsights: [],
  }),
}));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => tab.observations }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: tab.appointments }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../../hooks/useWeeklyRecap", async () => {
  const actual = await vi.importActual<typeof import("../../hooks/useWeeklyRecap")>("../../hooks/useWeeklyRecap");
  return {
    ...actual,
    useWeeklyRecap: () => ({
      reports: tab.reports, generating: false, generate: async () => undefined,
      currentId: actual.recapWeekId(new Date()), currentLabel: "This week", labelFor: () => "Week of 3 October",
      languageRefreshPending: false, recapUnopened: false, markRecapOpened: () => undefined,
    }),
  };
});
vi.mock("../referral/InviteCard", () => ({ default: () => null }));
vi.mock("../overview/QuickLogModal", () => ({ default: () => null }));

import { recapWeekId, recapWeekStartMs } from "../../hooks/useWeeklyRecap";
import { DOMAIN_IDS } from "../../lib/domains/registry";
import { translate } from "../../lib/i18n";
import type { Observation } from "../../lib/observations";
import WeeklyTab from "./WeeklyTab";
import { WEEKLY_COPY } from "../weekly/v10/weeklyCopy";

const NOW = new Date(2026, 9, 14, 15, 0);
const FIRST = new Date(recapWeekStartMs(NOW));
const on = (day: number, hour: number) => new Date(FIRST.getFullYear(), FIRST.getMonth(), FIRST.getDate() + day, hour).toISOString();
const moment = (at: string, n: number) => ({
  id: `behaviorLogs:invented-${n}`, childId: "child-invented", at, domains: ["feelings"], kind: "moment",
  value: { type: "moment", behaviorType: "Moment", context: "Home" }, source: "parent_typed", origin: "behaviorLogs",
  ageAtObservationMonths: 52, pretermCorrected: false,
}) as unknown as Observation;
const RECORDS = [moment(on(0, 9), 1), moment(on(1, 18), 2), moment(on(3, 8), 3)];
const STEPS = [{ id: "step-invented", status: "completed", recommendation: "Name the feeling first", outcome: "helped", outcomeAt: on(1, 20) }];

const TRY = { en: "Name the next transition out loud, once, before it starts.", he: "אמרו בקול את המעבר הבא, פעם אחת, לפני שהוא מתחיל." } as const;
const stored = (lang: "en" | "he", digest: "ai" | "failed", id = recapWeekId(NOW)) => ({
  id, lang, weekStart: id === recapWeekId(NOW) ? "2026-10-10" : "2026-10-03", generatedAt: on(4, 6),
  summary: { count: 3, resolved: 1, topTrigger: "Transitions" }, milestoneWins: [], planProgress: { done: 0, total: 0 },
  insight: "insight",
  ...(digest === "ai" ? {
    digest: {
      title: "Week", subject: "Week", preheader: "", summary: "", highlights: [], watchFor: [],
      tryThisWeek: TRY[lang], generated: "ai",
      stats: { weekOf: "2026-10-10", daysCovered: 3, momentsLogged: 3, previousWeekMoments: 0, resolvedCount: 0, topContext: "Home", topBehavior: "", milestonesDone: 0, milestonesTotal: 0 },
    },
  } : {}),
});
const OLDER_ID = recapWeekId(new Date(2026, 9, 5, 12));

const render = (lang: "en" | "he", reports: unknown[], records: unknown[] = RECORDS, steps: unknown[] = STEPS, appointments: unknown[] = []) => {
  state.lang = lang;
  tab.reports = reports;
  tab.observations = records;
  tab.actionLoop = steps;
  tab.appointments = appointments;
  return renderToStaticMarkup(<WeeklyTab />);
};
const stamps = (html: string) => html.match(/data-primary-move="accept-recap-recommendation"/g) ?? [];
/** Top-level modules = stamped modules that are not demoted (surfaceContract moduleBudget). */
const topModules = (html: string) =>
  [...html.matchAll(/<[a-z]+ [^>]*data-module="([a-z-]+)"[^>]*>/g)].filter((m) => !m[0].includes("data-module-demoted")).map((m) => m[1]);
const tagOf = (html: string, testId: string) => [...html.matchAll(new RegExp(`<[a-z]+ [^>]*data-testid="${testId}"[^>]*>`, "g"))].map((m) => m[0]);
const read = (html: string) => html
  .replace(/<span class="msr[^"]*"[^>]*>[a-z0-9_]+<\/span>/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, " ").replace(/\s+/g, " ");

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe("#/weekly — the v10 Weekly report (boards N-Week-D/M), the week drawn from the real record", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: records, nothing stored → the week, what helped, the band, your day; one stamp`, () => {
      const html = render(lang, []);
      expect(topModules(html)).toEqual(["weekly-glance", "weekly-helped", "weekly-carry", "weekly-day"]);
      // The figures are counts with their unit in words; a zero gets no figure.
      expect(read(html)).toContain(`3 ${WEEKLY_COPY[lang].momentsKept(3)}`);
      expect(read(html)).toContain(`1 ${WEEKLY_COPY[lang].stepsHelped(1)}`);
      // One token per counted moment in the instrument, one step token in the no-time lane.
      const inst = html.slice(html.indexOf('data-testid="weekly-instrument"'), html.indexOf('data-module="weekly-helped"'));
      expect(inst.match(new RegExp(`aria-label="${WEEKLY_COPY[lang].tokenMoment}[,"]`, "g"))?.length ?? 0).toBe(3);
      expect(inst.split(`aria-label="${WEEKLY_COPY[lang].tokenMomentNew},`).length - 1).toBe(1);
      expect(inst).toContain(`aria-label="${WEEKLY_COPY[lang].tokenHelped}"`);
      // By area lists only the areas that hold a record, and names the rest once.
      expect(html.match(/data-area="/g)).toHaveLength(1);
      expect(html).toContain(WEEKLY_COPY[lang].otherAreas(DOMAIN_IDS.length - 1));
      expect(stamps(html)).toHaveLength(1);
      // The Milestones door to the milestones page, as a button.
      expect(tagOf(html, "weekly-tile-milestones")[0]).toMatch(/^<button /);
      // The one legend line, once.
      expect(html.split(WEEKLY_COPY[lang].legend).length - 1).toBe(1);
    });

    it(`${lang}: nothing to count, nothing stored → the empty card, then the band and your day`, () => {
      const html = render(lang, [], [], []);
      expect(topModules(html)).toEqual(["weekly-empty", "weekly-carry", "weekly-day"]);
      expect(html).not.toContain('data-module="weekly-glance"');
      expect(html).not.toContain('data-module="weekly-helped"');
      expect(stamps(html)).toHaveLength(1);
    });

    it(`${lang}: a stored AI digest → the same report, the suggestion in the band as Arbor's draft; the letter is gone`, () => {
      const html = render(lang, [stored(lang, "ai")]);
      expect(topModules(html)).toEqual(["weekly-glance", "weekly-helped", "weekly-carry", "weekly-day"]);
      expect(html).not.toMatch(/weekly-recap|recap-next|recap-accept|weekly-insight|weekly-after-story/);
      expect(html).toContain(TRY[lang]);
      expect(html).toContain(WEEKLY_COPY[lang].arborDraft);
      expect(stamps(html)).toHaveLength(1);
    });

    it(`${lang}: the digest call failed → the same report; no insight card, no draft label`, () => {
      const html = render(lang, [stored(lang, "failed")]);
      expect(topModules(html)).toEqual(["weekly-glance", "weekly-helped", "weekly-carry", "weekly-day"]);
      expect(html).not.toContain("weekly-insight");
      expect(html).not.toContain(WEEKLY_COPY[lang].arborDraft);
      expect(stamps(html)).toHaveLength(1);
    });

    it(`${lang}: a stored week with nothing in it still renders the report, with no zero figures`, () => {
      const html = render(lang, [stored(lang, "ai")], [], []);
      expect(topModules(html)).toEqual(["weekly-glance", "weekly-helped", "weekly-carry", "weekly-day"]);
      expect(html).not.toContain('class="wk10-figs"');
      expect(html).toContain(WEEKLY_COPY[lang].noAreas);
    });

    it(`${lang}: the counts line shows at every width; no avatar, no chip strip`, () => {
      const html = render(lang, []);
      const line = /<p data-testid="weekly-glance-sub"([^>]*)>([^<]*)<\/p>/.exec(html);
      expect(line?.[1]).not.toMatch(/\bhidden\b/);
      expect(line?.[2]).toBe(translate(lang, "elev.wk.glance.sub"));
      const empty = render(lang, [], [], []);
      expect(empty).toContain('data-testid="weekly-glance-sub"');
      expect(html).not.toMatch(/hero-avatar/);
    });

    it(`${lang}: Previous week steps to the stored week before; the current week has no Next`, () => {
      const html = render(lang, [stored(lang, "ai"), stored(lang, "ai", OLDER_ID)]);
      const prev = tagOf(html, "weekly-prev");
      expect(prev).toHaveLength(1);
      expect(prev[0]).toContain(`aria-label="${translate(lang, "elev.wk.prev.aria", { week: "Week of 3 October" })}"`);
      expect(prev[0]).toContain('class="btn ghost sm');
      expect(html).toContain(translate(lang, "elev.wk.prev"));
      expect(html).not.toContain('data-testid="weekly-next"');
      // Nothing older stored → no Previous, and no empty action row.
      const single = render(lang, [stored(lang, "ai")]);
      expect(single).not.toContain('data-testid="weekly-prev"');
      expect(single).not.toContain('data-testid="weekly-header-actions"');
    });

    it(`${lang}: one Visit summary door, an outline secondary that opens the summary; never the primary`, () => {
      for (const html of [render(lang, []), render(lang, [], [], [])]) {
        const door = tagOf(html, "weekly-snapshot-door");
        expect(door).toHaveLength(1);
        expect(door[0]).toContain('class="btn ghost');
        expect(door[0]).not.toContain("data-primary-move");
        expect(html.split(WEEKLY_COPY[lang].addToSummary).length - 1).toBe(1);
      }
    });

    it(`${lang}: the next visit in its Prepare window shows its days to go, by profession`, () => {
      const visit = { id: "appt-invented", who: "Invented clinic", role: "", profession: "slp", when: "", mode: "in-person", whenIso: new Date(2026, 9, 17, 10).toISOString(), status: "confirmed" };
      const booked = render(lang, [], RECORDS, STEPS, [visit]);
      const block = booked.slice(booked.indexOf('data-testid="weekly-next-visit"'));
      expect(read(block)).toContain(WEEKLY_COPY[lang].visitCard(3));
      // The whole card is the door to Care › Visits.
      expect(tagOf(booked, "weekly-next-visit")[0]).toMatch(/^<button /);
      expect(block).toContain(translate(lang, "elev.careNet.appt.profession.slp"));
      expect(render(lang, [])).toContain(WEEKLY_COPY[lang].noVisitSub);
    });

    it(`${lang}: no share, no ratio, no gain sign anywhere on the page`, () => {
      for (const html of [render(lang, [stored(lang, "ai")]), render(lang, []), render(lang, [], [], [])]) {
        expect(read(html)).not.toMatch(/%|\d\s*\/\s*\d|\+\s*\d/);
        expect(html).not.toMatch(/role="progressbar"|aria-valuenow/);
      }
    });
  }

  it("source: WeeklyTab places and stamps every stop; the invite stays demoted", () => {
    const src = readFileSync(new URL("./WeeklyTab.tsx", import.meta.url), "utf8");
    expect([...src.matchAll(/data-module="([a-z-]+)"/g)].map((m) => m[1])).toEqual(["weekly-helped", "weekly-carry", "weekly-day", "weekly-invite"]);
    // The week and the empty card exclude each other and share one stamp.
    expect(src).toContain('const stage: "weekly-glance" | "weekly-empty" | null = dashboardShown && week ? "weekly-glance" : !selected ? "weekly-empty" : null;');
    expect(src.match(/\{\.\.\.stageStamp\}/g)).toHaveLength(2);
    expect(src).toContain("const dashboardShown = !!week && (glanceHasCounts(week.glance) || !!selected);");
    // A past week renders over its own bounds (reportWeekBounds), with no today.
    expect(src).toContain("reportWeekBounds(viewId, weekAnchorDate(selected), { weekId: recapWeekId, weekStartMs: recapWeekStartMs })");
    expect(src).toContain("const glance = isCurrent ? counts : { ...counts, today: 7 };");
    expect(src).toMatch(/onClick=\{\(\) => setSelectedId\(id\)\}/);
  });
});
