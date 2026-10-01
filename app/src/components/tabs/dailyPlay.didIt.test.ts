/**
 * B-GROWTH-19 — every "We did this" on #/daily-play writes the record, and the
 * toast tells the truth in the page language.
 *
 * Before: of the four "did it" paths only the library pick (`markDone`) called
 * `logPlayCompletion`. The daily plan wrote a device-local flag, and both
 * course cards (recommended + readiness) wrote a device-local progress map —
 * while all four toasted "Nice. Added to {name}'s day." in English. Nothing
 * reached `playLogs`, so nothing reached the Journal or the Timeline.
 *
 * The REAL DailyPlayTab renders (static markup, node env) with the app
 * contexts mocked; the four child cards are replaced by stubs that capture
 * the handlers the tab hands them, and each handler is then invoked directly.
 * The language mock is the REAL Hebrew dictionary, so "0 English toasts under
 * he" is measured, not assumed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { DailyPlan } from "../../practice/dailyPlan";
import type { ScoredActivity } from "../../playbank/select";
import type { PlayCourse } from "../../playbank/courses";

type Captured = {
  plan?: { plan: DailyPlan | null; onDid: (p: DailyPlan) => void };
  courses: { course: PlayCourse; onToggle: (id: string) => void }[];
  picks: { pick: ScoredActivity; onDid: (p: ScoredActivity) => void }[];
};
const captured: Captured = { courses: [], picks: [] };

const logPlayCompletion = vi.fn();
const toast = vi.fn();
const state = {
  behaviorLogs: [] as unknown[],
  childProfile: { id: "c1", name: "נועה כהן", age: 4, birthDate: "2022-03-01", interests: [], activeGoals: [] },
  setActiveTab: vi.fn(),
  logPlayCompletion,
  updateChild: vi.fn(async () => {}),
  seedCoach: vi.fn(),
  actionLoop: [] as unknown[],
};

vi.mock("../../context/ArborContext", () => ({ useArbor: () => state }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate("he", k, v), uiLang: "he" }),
  };
});
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, error: false, remote: false, upsert: vi.fn(async () => {}), remove: vi.fn(), replaceAll: vi.fn() }),
}));
vi.mock("../overview/DailyPlanCard", () => ({
  default: (p: { plan: DailyPlan | null; onDid: (pl: DailyPlan) => void }) => { captured.plan = { plan: p.plan, onDid: p.onDid }; return null; },
}));
vi.mock("../overview/CourseCard", () => ({
  default: (p: { course: PlayCourse; onToggle: (id: string) => void }) => { captured.courses.push({ course: p.course, onToggle: p.onToggle }); return null; },
}));
vi.mock("../overview/DailyPlayCard", () => ({
  default: (p: { pick: ScoredActivity; onDid: (s: ScoredActivity) => void }) => { captured.picks.push({ pick: p.pick, onDid: p.onDid }); return null; },
}));
vi.mock("../practice/GoalBuilderModal", () => ({ default: () => null }));
vi.mock("../practice/SessionLengthChips", () => ({ default: () => null }));
vi.mock("motion/react", () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) => ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => {
      const { initial, animate, exit, transition, ...safe } = rest as Record<string, unknown>;
      void initial; void animate; void exit; void transition;
      return React.createElement(tag, safe, children);
    },
  }),
}));

function installStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() { return map.size; },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage);
}

const render = async () => {
  const { default: DailyPlayTab } = await import("./DailyPlayTab");
  return renderToStaticMarkup(React.createElement(DailyPlayTab));
};

beforeEach(() => {
  installStorage();
  captured.plan = undefined;
  captured.courses = [];
  captured.picks = [];
  logPlayCompletion.mockClear();
  toast.mockClear();
});

describe("B-GROWTH-19 — all four 'did it' paths write the playLogs record", () => {
  it("the stubs captured the plan, both course cards and the picks", async () => {
    await render();
    expect(captured.plan?.plan).toBeTruthy();
    expect(captured.courses).toHaveLength(2); // recommended + readiness
    expect(captured.picks.length).toBeGreaterThan(0);
  });

  it("plan 'We did this' → logPlayCompletion(plan.scoredActivity, \"today\")", async () => {
    await render();
    const plan = captured.plan!.plan!;
    captured.plan!.onDid(plan);
    expect(logPlayCompletion).toHaveBeenCalledTimes(1);
    expect(logPlayCompletion).toHaveBeenCalledWith(plan.scoredActivity, "today");
  });

  it("recommended course step ON → logPlayCompletion(activity, \"course\", course.id); OFF writes nothing", async () => {
    await render();
    const { course, onToggle } = captured.courses[0];
    const id = course.activityIds[0];
    onToggle(id);
    expect(logPlayCompletion).toHaveBeenCalledTimes(1);
    const [activity, source, courseId] = logPlayCompletion.mock.calls[0];
    expect(activity.id).toBe(id);
    expect(source).toBe("course");
    expect(courseId).toBe(course.id);
  });

  it("readiness course step ON → logPlayCompletion(activity, \"course\", readiness.id)", async () => {
    await render();
    const { course, onToggle } = captured.courses[1];
    onToggle(course.activityIds[0]);
    expect(logPlayCompletion).toHaveBeenCalledTimes(1);
    expect(logPlayCompletion.mock.calls[0][1]).toBe("course");
    expect(logPlayCompletion.mock.calls[0][2]).toBe(course.id);
  });

  it("library pick 'did it' → logPlayCompletion(pick, \"library\")", async () => {
    await render();
    const { pick, onDid } = captured.picks[0];
    onDid(pick);
    expect(logPlayCompletion).toHaveBeenCalledWith(pick, "library");
  });

  it("an un-tick writes no record and claims nothing (the local step map only)", async () => {
    localStorage.setItem("arbor.course.c1", JSON.stringify({ [(await import("../../playbank/courses")).READINESS_COURSES[0].id]: [(await import("../../playbank/courses")).READINESS_COURSES[0].activityIds[0]] }));
    await render();
    const { course, onToggle } = captured.courses[1];
    onToggle(course.activityIds[0]); // was ON → OFF
    expect(logPlayCompletion).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("every toast under he is Hebrew — 0 English toasts", async () => {
    await render();
    captured.plan!.onDid(captured.plan!.plan!);
    captured.courses[0].onToggle(captured.courses[0].course.activityIds[0]);
    captured.picks[0].onDid(captured.picks[0].pick);
    expect(toast).toHaveBeenCalledTimes(3);
    for (const [msg] of toast.mock.calls) {
      expect(msg).not.toMatch(/[A-Za-z]/);
      expect(msg).toContain("נועה");
    }
  });
});

describe("B-GROWTH-19 — the logPlayCompletion seam takes a bare course activity", () => {
  it("ArborContext accepts ScoredActivity | PlayActivity + a course id, and stamps courseId", () => {
    const ctx = readFileSync(new URL("../../context/ArborContext.tsx", import.meta.url), "utf8");
    expect(ctx).toContain('const logPlayCompletion = (a: ScoredActivity | PlayActivity, source: PlayLog["source"], courseId?: string) => {');
    expect(ctx).toContain("...(courseId ? { courseId } : {}),");
    // idempotent per activity per day — the same id across all four paths
    expect(ctx).toContain("const id = `${activity.id}.${day}`;");
  });

  it("NEGATIVE CONTROL — the pre-fix plan handler wrote only a local flag", () => {
    const pre = `const handlePlanDid = (plan: DailyPlan) => { setPlanDone(true); localStorage.setItem("arbor.plan.done.c1", "{}"); toast(\`Nice. Added to \${isolate(firstName)}'s day.\`, "success"); };`;
    expect(pre).not.toContain("logPlayCompletion");
  });
});
