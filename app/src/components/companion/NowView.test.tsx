import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { Focus } from "../../hooks/useTodaysFocus";
import { NOW_COPY } from "./nowViewCopy";

const KNOWN_AGE = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] } as Record<string, unknown>,
  actionLoop: [] as ActionLoopEntry[], actionLoopReady: true,
  actionPlans: [] as unknown[], approvedMemoryItems: [] as unknown[], behaviorLogs: [] as unknown[],
  appointments: [] as unknown[], recordFromRecordAnswer: vi.fn(async () => {}),
  evening: false, moreProps: null as any,
  focus: null as Focus | null,
  program: null as null | { week: number; program: { shelf: string }; enrolment: Record<string, string>; content: { skill: { en: string; he: string }; watchFor: string[] } },
  openCaptureSheet: vi.fn(), seedCoach: vi.fn(), setActiveTab: vi.fn(),
  openHardMomentNow: vi.fn(), saveTodayOutcome: vi.fn(async () => {}),
  acceptTodayAction: vi.fn(async () => {}), focusCalls: vi.fn(), recordPracticeDose: vi.fn(), noPractice: false,
  buttons: [] as { children?: React.ReactNode; onClick?: () => void; className?: string; "data-answer"?: string; "data-testid"?: string }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  ...state, playLogs: [], milestones: [], pendingCaptureMode: null, consumeCaptureRequest: vi.fn(),
  activeTodayAction: null, setMilestoneObservation: vi.fn(), restoreMilestone: vi.fn(), removeTodayAction: vi.fn(), addMoment: vi.fn(async () => null),
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, collection: string) => ({ items: collection === "appointments" ? state.appointments : [], loaded: true, upsert: vi.fn() }) }));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => [] }));
vi.mock("../../hooks/useLastVisit", () => ({ useLastVisit: () => ({ previousVisitAt: null, isReturning: false }) }));
vi.mock("../overview/useLifecycleMoment", () => ({ useLifecycleMoment: () => ({ moment: null }) }));
vi.mock("../overview/useCompanionOffer", () => ({ useCompanionOffer: () => ({ offer: null, appointment: state.appointments[0] ?? null, ledger: {}, snooze: vi.fn() }) }));
vi.mock("./NowMoreForToday", () => ({ default: (props: unknown) => { state.moreProps = props; return null; } }));
vi.mock("../../lib/programs/enrolment", () => ({ activeProgramWeek: () => state.program, dayKey: (d: Date) => d.toISOString().slice(0, 10) }));
vi.mock("../../lib/timeOfDay", () => ({ bedtimeDoorOpen: () => state.evening }));
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
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 12, 8));
  state.actionPlans = []; state.approvedMemoryItems = []; state.behaviorLogs = []; state.appointments = []; state.evening = false; state.moreProps = null;
  vi.clearAllMocks(); state.actionLoopReady = true; state.setActiveTab.mockReset(); state.buttons = []; state.lang = "en"; state.focus = null; state.program = null; state.actionLoop = []; state.childProfile = { ...KNOWN_AGE }; state.noPractice = false;
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
    button(NOW_COPY.en.continueTopic).onClick?.();
    expect(open).toHaveBeenCalledWith("Our mornings");
    expect(state.seedCoach).not.toHaveBeenCalled();
  });
  it("leaves general conversation and capture to the persistent launcher", () => {
    const html = renderToStaticMarkup(<NowView />);
    expect(html).not.toContain('class="now-conversation"');
    expect(html).not.toContain('class="now-capture"');
    expect(html).not.toContain(NOW_COPY.en.talkTitle);
    expect(html).not.toContain(NOW_COPY.en.captureBody);
    expect(html).toContain('data-presentation="action-first"');
    expect(html.indexOf('data-testid="practice-answers"')).toBeLessThan(html.indexOf('data-testid="practice-details"'));
  });
  it("keeps saved questions reachable without a duplicate general Ask card", () => {
    const open = vi.fn();
    const html = renderToStaticMarkup(<NowView onTopicOpen={open} />);
    button(NOW_COPY.en.topics).onClick?.();
    expect(open).toHaveBeenCalledOnce();
    expect(html).not.toContain('class="now-conversation"');
  });
  it("renders native Hebrew labels with the RTL parent surface", () => {
    state.lang = "he";
    state.noPractice = true;
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(NOW_COPY.he.curatedWhy);
    expect(html).not.toContain(NOW_COPY.en.continueTopic);
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


describe("Now record and visit leads", () => {
  const note = { id: "parent-note", timestamp: "2026-07-09T08:10:00", behaviorType: "Moment", trigger: "Calmed and put shoes on within eight minutes.", notes: "", response: "Never quote this generated response." };
  const appointment = { id: "visit-specific", who: "", role: "Speech therapist", profession: "slp", when: "", whenIso: "2026-10-14T10:00:00", mode: "In person", status: "confirmed" };
  it.each(["en", "he"] as const)("%s: opens with the real parent note and three touch answers, with no model call", lang => {
    state.lang = lang; state.behaviorLogs = [note];
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-module="now-record"');
    expect(html).toContain(note.trigger);
    expect(html).not.toContain(note.response);
    expect(html.match(/data-answer=/g)).toHaveLength(3);
    expect(html.match(/data-primary-move="choose-next-step"/g)).toHaveLength(1);
    expect(html).not.toContain('data-module="today-practice"');
    expect(state.focusCalls).not.toHaveBeenCalled();
  });
  it("opens the actual visit in two days without another visit offer or a focus call", () => {
    state.appointments = [appointment]; state.behaviorLogs = [note];
    let hash = "#/overview"; const history = [hash];
    const location = { get hash() { return hash; }, set hash(value: string) { hash = value.startsWith("#") ? value : `#${value}`; history.push(hash); } }; vi.stubGlobal("window", { location });
    state.setActiveTab.mockImplementationOnce((tab: string) => { location.hash = `/${tab}`; });
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-module="now-visit"');
    expect(html).toContain("Speech therapist");
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    button("Look over the page").onClick?.();
    expect(location.hash).toBe("#/consult?appointment=visit-specific");
    expect(history).toEqual(["#/overview", "#/consult?appointment=visit-specific"]);
    expect(state.setActiveTab).not.toHaveBeenCalled();
    expect(state.moreProps.suppressVisit).toBe(true);
    expect(state.focusCalls).not.toHaveBeenCalled();
  });
  it("the existing evening Tonight flow precedes a record opener", () => {
    state.evening = true; state.noPractice = true; state.behaviorLogs = [note];
    vi.setSystemTime(new Date(2026, 9, 12, 20, 30));
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-module="today-tonight"');
    expect(html).not.toContain('data-module="now-record"');
    expect(state.focusCalls).not.toHaveBeenCalled();
  });
  it("an unanswered prior step outranks visit, record and evening", () => {
    state.evening = true; state.appointments = [appointment]; state.behaviorLogs = [note];
    state.actionLoop = [{ id: "pending", recommendation: "A step I chose yesterday.", status: "accepted", acceptedAt: "2026-10-11T21:00:00", source: "coach", capacity: "tiny" }];
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-module="now-step"');
    expect(html).not.toContain('data-module="now-visit"');
    expect(html).not.toContain('data-module="now-record"');
  });
  it("an already-saved record answer stays a quiet receipt after re-entry without a second question", () => {
    state.behaviorLogs = [note];
    state.actionLoop = [{ id: "record.child-a.2026-10-12", recommendation: note.trigger, recordKey: "note:parent-note", reflection: "easier", source: "from-record", capacity: "tiny", status: "completed", acceptedAt: "2026-10-12T07:00:00", outcomeAt: "2026-10-12T07:00:00" }];
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('data-testid="today-record-receipt"');
    expect(html).not.toContain('data-testid="today-record-answers"');
    expect(state.focusCalls).not.toHaveBeenCalled();
  });
  it("does not send a chosen outcome twice on rapid taps before a render", async () => {
    let resolve!: () => void;
    state.saveTodayOutcome.mockReturnValueOnce(new Promise<void>(yes => { resolve = yes; }));
    state.actionLoop = [{ id: "chosen", recommendation: "Read one page together.", source: "coach", status: "accepted", acceptedAt: "2026-10-11T20:00:00", capacity: "tiny" }];
    renderToStaticMarkup(<NowView />);
    button(NOW_COPY.en.helped).onClick?.(); button(NOW_COPY.en.helped).onClick?.();
    expect(state.saveTodayOutcome).toHaveBeenCalledTimes(1);
    resolve(); await Promise.resolve();
  });
  it("uses the loop clock in the visible identity, including a date override", () => {
    vi.setSystemTime(new Date(2026, 9, 14, 20, 30));
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain(new Date(2026, 9, 14, 20, 30).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
    expect(state.moreProps.now.getTime()).toBe(Date.now());
  });
});

describe("B-SHELL-36 first-run handoff", () => {
  it("waits for the accepted-action snapshot before mounting any automatic focus", () => {
    state.actionLoopReady = false;
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('role="status"'); expect(html).not.toContain('data-module="today-practice"');
    expect(state.focusCalls).not.toHaveBeenCalled();
  });
  it.each(["en", "he"] as const)("an accepted onboarding step leads with the tomorrow line and zero focus calls (%s)", lang => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
    try {
      state.lang = lang;
      state.actionLoop = [{ id: "today.child-a.2026-10-09", recommendation: "Notice one moment together.", source: "onboarding", status: "accepted", acceptedAt: "2026-10-09T11:00:00Z", capacity: "tiny", acceptanceKey: "onboarding-v1.child-a.test" }];
      const html = renderToStaticMarkup(<NowView />);
      expect(html).toContain('data-module="now-step"'); expect(html).toContain("Notice one moment together.");
      expect(html).toContain(lang === "he" ? "מחר נשאל איך היה." : "Tomorrow we&#x27;ll ask how it went.");
      expect(html).not.toContain("1 of 4"); expect(html).not.toContain("First steps"); expect(state.focusCalls).not.toHaveBeenCalled();
      vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
      expect(renderToStaticMarkup(<NowView />)).not.toContain(lang === "he" ? "מחר נשאל איך היה." : "Tomorrow we&#x27;ll ask how it went.");
    } finally { vi.useRealTimers(); }
  });
});
