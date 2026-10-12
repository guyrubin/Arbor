import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* v3 EXTRA-WEEKLY — #/weekly with a week that holds records. The glance (the
   week as counts) renders for the current week only, under the letter and its
   Retell row, or in the empty card's place when nothing is stored yet; with
   nothing to count the empty card stays. The route keeps ONE data-primary-move
   and at most three top-level modules in every state. Invented examples. */

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
vi.mock("../ui/ShareButton", () => ({ default: () => null, ShareButton: () => null }));
const tab = vi.hoisted(() => ({
  reports: [] as unknown[],
  observations: [] as unknown[],
  actionLoop: [] as unknown[],
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
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../../hooks/useWeeklyRecap", async () => {
  const actual = await vi.importActual<typeof import("../../hooks/useWeeklyRecap")>("../../hooks/useWeeklyRecap");
  return {
    ...actual,
    useWeeklyRecap: () => ({
      reports: tab.reports, generating: false, generate: async () => undefined,
      currentId: actual.recapWeekId(new Date()), currentLabel: "This week", labelFor: () => "Week of October 10",
      languageRefreshPending: false, recapUnopened: false, markRecapOpened: () => undefined,
    }),
  };
});
vi.mock("../weekly/recapEmail", () => ({
  fetchDigestEmailStatus: () => new Promise(() => undefined),
  readEmailOptIn: () => false,
  writeEmailOptIn: () => undefined,
}));
vi.mock("../referral/InviteCard", () => ({ default: () => null }));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => null }));
vi.mock("../overview/QuickLogModal", () => ({ default: () => null }));

import { recapWeekId, recapWeekStartMs } from "../../hooks/useWeeklyRecap";
import { translate } from "../../lib/i18n";
import type { Observation } from "../../lib/observations";
import WeeklyTab from "./WeeklyTab";

const NOW = new Date(2026, 9, 14, 15, 0);
const FIRST = new Date(recapWeekStartMs(NOW));
const on = (day: number, hour: number) => new Date(FIRST.getFullYear(), FIRST.getMonth(), FIRST.getDate() + day, hour).toISOString();
const moment = (at: string, n: number) => ({
  id: `behaviorLogs:invented-${n}`, childId: "child-invented", at, domains: ["feelings"], kind: "moment",
  value: { type: "moment", behaviorType: "Moment" }, source: "parent_typed", origin: "behaviorLogs",
  ageAtObservationMonths: 52, pretermCorrected: false,
}) as unknown as Observation;
const RECORDS = [moment(on(0, 9), 1), moment(on(1, 18), 2), moment(on(3, 8), 3)];
const STEPS = [{ id: "step-invented", outcome: "helped", outcomeAt: on(1, 20) }];

const TRY = { en: "Name the next transition out loud, once, before it starts.", he: "אמרו בקול את המעבר הבא, פעם אחת, לפני שהוא מתחיל." } as const;
const stored = (lang: "en" | "he", digest: "ai" | "failed") => ({
  id: recapWeekId(NOW), lang, weekStart: "2026-10-14", generatedAt: on(4, 6),
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

const render = (lang: "en" | "he", reports: unknown[], records: unknown[] = RECORDS, steps: unknown[] = STEPS) => {
  state.lang = lang;
  tab.reports = reports;
  tab.observations = records;
  tab.actionLoop = steps;
  return renderToStaticMarkup(<WeeklyTab />);
};
const stamps = (html: string) => html.match(/data-primary-move="accept-recap-recommendation"/g) ?? [];
/** Top-level modules = stamped modules that are not demoted (surfaceContract moduleBudget). */
const topModules = (html: string) =>
  [...html.matchAll(/<[a-z]+ [^>]*data-module="([a-z-]+)"[^>]*>/g)].filter((m) => !m[0].includes("data-module-demoted")).map((m) => m[1]);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe("#/weekly — the week's glance (v3 EXTRA-WEEKLY)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: records, nothing stored → the glance in the empty card's place, "Create this week's story" stays the one move above it`, () => {
      const html = render(lang, []);
      expect(html).toContain('data-module="weekly-glance"');
      expect(html).not.toContain('data-module="weekly-empty"');
      expect(stamps(html)).toHaveLength(1);
      expect(/<button[^>]*data-primary-move="accept-recap-recommendation"[^>]*>/.exec(html)?.[0]).toContain('data-testid="weekly-generate"');
      expect(html.indexOf('data-testid="weekly-generate"')).toBeLessThan(html.indexOf('data-module="weekly-glance"'));
      expect(topModules(html)).toEqual(["weekly-glance"]);
      expect(html).toContain(`<b>3</b><span>${translate(lang, "elev.wk.glance.moments")}</span>`);
    });

    it(`${lang}: nothing to count, nothing stored → the empty card, no glance`, () => {
      const html = render(lang, [], [], []);
      expect(html).toContain('data-module="weekly-empty"');
      expect(html).not.toContain('data-module="weekly-glance"');
      expect(stamps(html)).toHaveLength(1);
    });

    it(`${lang}: the AI letter → the glance under the letter and its Retell row; one stamp; three modules at most`, () => {
      const html = render(lang, [stored(lang, "ai")]);
      expect(html).toContain('data-module="weekly-recap"');
      expect(html.indexOf('data-module="weekly-recap"')).toBeLessThan(html.indexOf('data-testid="weekly-after-story"'));
      expect(html.indexOf('data-testid="weekly-after-story"')).toBeLessThan(html.indexOf('data-module="weekly-glance"'));
      expect(stamps(html)).toHaveLength(1);
      expect(topModules(html)).toEqual(["weekly-recap", "weekly-glance"]);
    });

    it(`${lang}: the digest call failed → Retell carries the stamp and sits above the glance`, () => {
      const html = render(lang, [stored(lang, "failed")]);
      expect(html).toContain('data-module="weekly-insight"');
      expect(stamps(html)).toHaveLength(1);
      expect(html.indexOf('data-testid="weekly-generate"')).toBeLessThan(html.indexOf('data-module="weekly-glance"'));
      expect(topModules(html)).toEqual(["weekly-insight", "weekly-glance"]);
      expect(topModules(html).length).toBeLessThanOrEqual(3);
    });

    it(`${lang}: the header line says what the page holds, from md up (at 375 the letter keeps its place)`, () => {
      const html = render(lang, []);
      const line = /<p data-testid="weekly-glance-sub"[^>]*>([^<]*)<\/p>/.exec(html);
      expect(line?.[0]).toContain('class="hidden md:block');
      expect(line?.[1]).toBe(translate(lang, "elev.wk.glance.sub"));
    });

    it(`${lang}: no share, no ratio, no trend sign on the page`, () => {
      const html = render(lang, [stored(lang, "ai")]);
      const glance = html.slice(html.indexOf('data-module="weekly-glance"'));
      const read = glance.replace(/<span class="msr"[^>]*>[a-z0-9_]+<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, " ");
      expect(read).not.toMatch(/%|\d\s*\/\s*\d|\+\s*\d/);
    });
  }

  it("source: the glance is placed by WeeklyTab, stamped by WeekGlance — the tab's own stamps are unchanged", () => {
    const src = readFileSync(new URL("./WeeklyTab.tsx", import.meta.url), "utf8");
    expect(src.match(/<WeekGlance glance=\{glance\} \/>/g)).toHaveLength(2);
    expect(src).not.toContain('data-module="weekly-glance"');
    expect(src).toContain("const glanceShown = (selectedId ?? currentId) === currentId && glanceHasCounts(glance);");
    const letterAfter = src.indexOf("{afterStory}", src.indexOf("<RecapStoryCards"));
    expect(letterAfter).toBeGreaterThan(0);
    expect(src.lastIndexOf("<WeekGlance glance={glance} />")).toBeGreaterThan(letterAfter);
  });
});
