import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { Focus } from "../../hooks/useTodaysFocus";
import { NOW_COPY } from "./nowViewCopy";

const KNOWN_AGE = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] } as Record<string, unknown>,
  actionLoop: [] as ActionLoopEntry[],
  focus: null as Focus | null,
  program: null as null | { week: number; program: { shelf: string }; enrolment: Record<string, string>; content: { skill: { en: string; he: string }; watchFor: string[] } },
  openCaptureSheet: vi.fn(), seedCoach: vi.fn(), setActiveTab: vi.fn(),
  openHardMomentNow: vi.fn(), saveTodayOutcome: vi.fn(async () => {}),
  acceptTodayAction: vi.fn(async () => {}), focusCalls: vi.fn(), recordPracticeDose: vi.fn(), noPractice: false,
  buttons: [] as { children?: React.ReactNode; onClick?: () => void; className?: string; "data-answer"?: string; "data-testid"?: string }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  ...state, behaviorLogs: [], playLogs: [], milestones: [], pendingCaptureMode: null, consumeCaptureRequest: vi.fn(),
  activeTodayAction: null, setMilestoneObservation: vi.fn(), restoreMilestone: vi.fn(), removeTodayAction: vi.fn(), addMoment: vi.fn(async () => null),
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: true, upsert: vi.fn() }) }));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => [] }));
vi.mock("../../hooks/useLastVisit", () => ({ useLastVisit: () => ({ previousVisitAt: null, isReturning: false }) }));
vi.mock("../overview/useLifecycleMoment", () => ({ useLifecycleMoment: () => ({ moment: null }) }));
vi.mock("../overview/useCompanionOffer", () => ({ useCompanionOffer: () => ({ offer: null }) }));
vi.mock("./NowMoreForToday", () => ({ default: () => null }));
vi.mock("../../lib/programs/enrolment", () => ({ activeProgramWeek: () => state.program, dayKey: (d: Date) => d.toISOString().slice(0, 10) }));
vi.mock("../../lib/timeOfDay", () => ({ bedtimeDoorOpen: () => false }));
vi.mock("../../lib/programs/measures", () => ({ programWeekDays: () => ({ from: "2026-10-05", to: "2026-10-11" }) }));
// A known-age child whose catalogue has nothing for today: the fallbacks lead.
vi.mock("../../lib/practice/choosePractice", async (original) => {
  const real = await original<typeof import("../../lib/practice/choosePractice")>();
  return { ...real, choosePractice: (input: Parameters<typeof real.choosePractice>[0]) => state.noPractice ? null : real.choosePractice(input) };
});
vi.mock("../../hooks/useTodaysFocus", () => ({ useTodaysFocus: (...args: unknown[]) => { state.focusCalls(...args); return { focus: state.focus, loading: false, error: false, regenerate: vi.fn() }; } }));
vi.mock("../trust/TrustLink", () => ({ TrustLink: () => null }));
// Hoisted: imported components build JSX while their modules load.
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as typeof state.buttons[number]);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return {
    ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
import NowView from "./NowView";

function button(label: string) {
  const found = state.buttons.find((item) => React.Children.toArray(item.children).includes(label));
  expect(found, `button ${label}`).toBeDefined();
  return found!;
}
const PROGRAM = { week: 2, program: { shelf: "words" }, enrolment: { programId: "talk-together", startedAt: "2026-10-05T00:00:00Z" }, content: { skill: { en: "Follow their story", he: "מקשיבים לסיפור שלהם" }, watchFor: [] } };

beforeEach(() => {
  vi.clearAllMocks(); state.buttons = []; state.lang = "en"; state.focus = null; state.program = null; state.actionLoop = []; state.childProfile = { ...KNOWN_AGE }; state.noPractice = false;
});

describe("Now leads with the milestone loop (parity 9 Oct)", () => {
  it("a known-age child gets today's practice as the lead, with Did it as the one primary move", () => {
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-module="today-practice"');
    expect(html).not.toContain('data-module="now-recommendation"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    const did = state.buttons.find((item) => item["data-answer"] === "did");
    expect(did, "the practice's Did it").toBeDefined();
    did!.onClick?.();
    expect(state.recordPracticeDose).toHaveBeenCalledTimes(1);
    expect(state.recordPracticeDose.mock.calls[0][0]).toMatchObject({ source: "practice", status: "completed" });
  });
  it("the practice lead makes ONE journal-grounded focus request (B-LOOP-13)", () => {
    renderToStaticMarkup(<NowView />);
    expect(state.focusCalls).toHaveBeenCalled();
    const [, , journal] = state.focusCalls.mock.calls[0] as [unknown, unknown, { dateKey?: string; candidatePracticeIds?: string[] } | undefined];
    expect(journal?.candidatePracticeIds?.length).toBeGreaterThan(0);
    expect(journal?.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("an active program is a line beside the practice, never a competing lead", () => {
    state.program = PROGRAM;
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-module="today-practice"');
    expect(html).toContain('data-testid="now-program-line"');
    expect(html).toContain("Follow their story");
  });
  it("Tonight's pointer is a line under the morning practice", () => {
    renderToStaticMarkup(<NowView />);
    expect(state.buttons.some((item) => item["data-testid"] === "today-tonight-pointer")).toBe(true);
  });
});

describe("Now's restored recommendations and one conversation entrance", () => {
  it("offers useful library content when no practice fits, and never an AI accept for fallback copy", () => {
    state.noPractice = true;
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-recommendation-source="library"');
    expect(html).toContain(NOW_COPY.en.curatedWhy);
    expect(html).toContain(NOW_COPY.en.begin);
    expect(html).not.toContain(NOW_COPY.en.choose);
    expect(html).not.toContain("<textarea");
    expect(state.acceptTodayAction).not.toHaveBeenCalled();
  });
  it("honours an open chosen step before making another AI request", () => {
    state.actionLoop = [{ id: "step-a", recommendation: "Sit together for one page.", source: "coach", status: "accepted", acceptedAt: "2026-10-01", capacity: "tiny" }];
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-module="now-step"');
    expect(html).toContain("Sit together for one page.");
    expect(html).not.toContain('data-module="now-recommendation"');
    expect(html).not.toContain('data-module="today-practice"');
    expect(state.focusCalls).not.toHaveBeenCalled();
  });
  it("keeps an active chosen program ahead of a new daily offer", () => {
    state.noPractice = true;
    state.program = PROGRAM;
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-module="now-program"');
    expect(html).toContain("Follow their story");
    expect(state.focusCalls).not.toHaveBeenCalled();
  });
  it("renders the screened AI step once and accepts the entire visible step", () => {
    state.noPractice = true;
    const step = "Before leaving home, pause together, offer a choice between two familiar shoes and give your child time to answer. Keep the choice small and repeat it gently if needed.";
    state.focus = { text: step, tryToday: step, focus: "You have been noticing mornings.", dateKey: "2026-10-09", generatedAt: "2026-10-09T09:00:00Z", lang: "en" };
    const html = renderToStaticMarkup(<NowView />);
    expect(html.split(step)).toHaveLength(2);
    button(NOW_COPY.en.choose).onClick?.();
    expect(state.acceptTodayAction).toHaveBeenCalledWith(step, "standard");
  });
  it("opens the shared contextual conversation without navigating to a separate chat", () => {
    const open = vi.fn();
    renderToStaticMarkup(<NowView onTalkOpen={open} topic={{ id: "topic-a", title: "Our mornings" }} />);
    button(NOW_COPY.en.talk).onClick?.();
    expect(open).toHaveBeenCalledWith("Our mornings");
    expect(state.seedCoach).not.toHaveBeenCalled();
  });
  it("has working explicit text, dictation and photo quick-capture doors", () => {
    renderToStaticMarkup(<NowView />);
    button(NOW_COPY.en.write).onClick?.(); button(NOW_COPY.en.dictate).onClick?.(); button(NOW_COPY.en.photo).onClick?.();
    expect(state.openCaptureSheet.mock.calls.map(([args]) => args.mode)).toEqual(["text", "voice", "photo"]);
  });
  it("renders native Hebrew labels with the RTL parent surface", () => {
    state.lang = "he";
    state.noPractice = true;
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(NOW_COPY.he.curatedWhy);
    expect(html).toContain(NOW_COPY.he.dictate);
    expect(html).not.toContain(NOW_COPY.en.curatedWhy);
    expect(html).not.toContain(NOW_COPY.en.talkTitle);
  });
  it("offers a deliberate weekly reflection door without adding a competing primary action", () => {
    const html = renderToStaticMarkup(<NowView />);
    const weekly = state.buttons.find(item => item.className === "now-weekly-door");
    expect(weekly).toBeDefined(); weekly!.onClick?.();
    expect(state.setActiveTab).toHaveBeenCalledWith("weekly");
    expect(html).toContain(NOW_COPY.en.weeklyTitle);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });
});
