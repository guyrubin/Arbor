import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { Focus } from "../../hooks/useTodaysFocus";
import { NOW_COPY } from "./nowViewCopy";
import { learnCardById } from "../../learn/learnCards";

const KNOWN_AGE = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] } as Record<string, unknown>,
  actionLoop: [] as ActionLoopEntry[], actionLoopReady: true,
  actionPlans: [] as unknown[], approvedMemoryItems: [] as unknown[], behaviorLogs: [] as unknown[],
  appointments: [] as unknown[], recordFromRecordAnswer: vi.fn(async () => {}),
  evening: false, moreProps: null as any, readerProps: null as any,
  activeFamilyTopic: null as null | { id: string; title: string },
  focus: null as Focus | null,
  program: null as null | { week: number; program: { shelf: string }; enrolment: Record<string, string>; content: { skill: { en: string; he: string }; watchFor: string[]; lesson?: string } },
  openCaptureSheet: vi.fn(), seedCoach: vi.fn(), setActiveTab: vi.fn(),
  openHardMomentNow: vi.fn(), saveTodayOutcome: vi.fn(async () => {}),
  acceptTodayAction: vi.fn(async () => {}), focusCalls: vi.fn(), recordPracticeDose: vi.fn(), noPractice: false,
  requestLearnRead: vi.fn(), readIds: [] as string[],
  buttons: [] as { children?: React.ReactNode; onClick?: () => void; className?: string; "data-answer"?: string; "data-testid"?: string; "data-primary-move"?: string }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  ...state, playLogs: [], milestones: [], pendingCaptureMode: null, consumeCaptureRequest: vi.fn(),
  milestonesLoaded: true, milestonesConfirmed: true,
  activeTodayAction: null, setMilestoneObservation: vi.fn(), restoreMilestone: vi.fn(), removeTodayAction: vi.fn(), addMoment: vi.fn(async () => null),
}) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "local-sandbox" } }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, collection: string) => ({ items: collection === "appointments" ? state.appointments : [], loaded: true, confirmed: true, error: false, isCurrent: () => true, upsert: vi.fn() }) }));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => [] }));
vi.mock("../../hooks/useLastVisit", () => ({ useLastVisit: () => ({ previousVisitAt: null, isReturning: false }) }));
vi.mock("../overview/useLifecycleMoment", () => ({ useLifecycleMoment: () => ({ moment: null }) }));
vi.mock("../overview/useCompanionOffer", () => ({ useCompanionOffer: () => ({ offer: null, appointment: state.appointments[0] ?? null, ledger: {}, snooze: vi.fn() }) }));
// v4: "More for today" dissolved into its object homes (NowTodayLines); the agenda extras and Notice extras carry the props the door did.
vi.mock("./NowTodayLines", () => ({
  NowAgendaExtras: (props: unknown) => { state.moreProps = { ...(state.moreProps ?? {}), ...(props as object) }; return null; },
  NowNoticeExtras: (props: unknown) => { state.moreProps = { ...(state.moreProps ?? {}), ...(props as object) }; return null; },
  NowWhatChangedLines: () => null,
}));
// F-NOW-1: the guide reader is a sheet; its props are what the card hands it.
vi.mock("./NowGuideReader", () => ({ default: (props: unknown) => { state.readerProps = props; return null; } }));
// B-PROG-03: the chooser's program view is exercised in lib/programs/weekSelection.test (real weeks); this stub program has none.
vi.mock("../../lib/programs/enrolment", () => ({ activeProgramWeek: () => state.program, chooserProgram: () => null, dayKey: (d: Date) => d.toISOString().slice(0, 10) }));
vi.mock("../../lib/timeOfDay", () => ({ bedtimeDoorOpen: () => state.evening }));
// B-PROG-14: the parent's Learn read state (per child) decides whether the week's door shows.
vi.mock("../../learn/learnReadState", () => ({ readLearnReadIds: () => state.readIds }));
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
import NowRecommendation from "./NowRecommendation";
import { clearAcceptFailed } from "./nowGuideAccept";
import { todayFile } from "../../testTodaySource";

function button(label: string) {
  const found = state.buttons.find((item) => React.Children.toArray(item.children).includes(label));
  expect(found, `button ${label}`).toBeDefined();
  return found!;
}
const PROGRAM = { week: 2, program: { shelf: "words", weeks: [{}, {}, {}, {}] }, enrolment: { programId: "talk-together", startedAt: "2026-10-05T00:00:00Z" }, content: { skill: { en: "Follow their story", he: "מקשיבים לסיפור שלהם" }, watchFor: [] } };

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 12, 8));
  state.readIds = []; state.requestLearnRead.mockClear();
  state.actionPlans = []; state.approvedMemoryItems = []; state.behaviorLogs = []; state.appointments = []; state.evening = false; state.moreProps = null; state.readerProps = null; state.activeFamilyTopic = null;
  clearAcceptFailed("child-a");
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
    expect(did, "the practice's Done").toBeDefined();
    expect(React.Children.toArray(did!.children)).toContain(NOW_COPY.en.done);
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
    // v4: the agenda row carries where the family is in the program, counts only.
    expect(html).toContain(`data-testid="now-program-week">${NOW_COPY.en.programWeekOf(2, 4)}</span>`);
  });
  it("B-PROG-14: the week's one Learn read is a door on Now until the parent opens it, EN + HE", () => {
    state.program = { ...PROGRAM, content: { ...PROGRAM.content, lesson: "serve-and-return" } };
    for (const lang of ["en", "he"] as const) {
      state.lang = lang; state.buttons = [];
      const html = renderToStaticMarkup(<NowView />);
      expect(html).toContain('data-testid="now-week-lesson"');
      expect(html).toContain(NOW_COPY[lang].weekIdea);
      expect(html).toContain(learnCardById("serve-and-return")!.title[lang].replace(/'/g, "&#x27;"));
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    }
    state.lang = "en"; state.buttons = [];
    renderToStaticMarkup(<NowView />);
    state.buttons.find((b) => b["data-testid"] === "now-week-lesson")!.onClick?.();
    expect(state.requestLearnRead).toHaveBeenCalledWith({ cardId: "serve-and-return", source: "now-week-lesson" });
    // Read → the door is gone for the rest of the week (the next week names another read).
    state.readIds = ["serve-and-return"];
    expect(renderToStaticMarkup(<NowView />)).not.toContain('data-testid="now-week-lesson"');
    // A week with no lesson, or no program, shows no door.
    state.readIds = []; state.program = PROGRAM;
    expect(renderToStaticMarkup(<NowView />)).not.toContain('data-testid="now-week-lesson"');
    state.program = null;
    expect(renderToStaticMarkup(<NowView />)).not.toContain('data-testid="now-week-lesson"');
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
    // F-NOW-1: Begin is the card's one move; the step is chosen in the reader it opens.
    expect(button(NOW_COPY.en.begin)["data-primary-move"]).toBe("choose-next-step");
    expect(state.readerProps.open).toBe(false);
    state.readerProps.onChoose();
    expect(state.acceptTodayAction).toHaveBeenCalledWith(step, "standard");
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
    expect(html).not.toContain(NOW_COPY.en.curatedWhy);
    expect(html).not.toContain(NOW_COPY.en.talkTitle);
  });
  it("offers a deliberate weekly reflection door without adding a competing primary action", () => {
    const html = renderToStaticMarkup(<NowView />);
    // v3: the door is the week card's Report link.
    const weekly = state.buttons.find(item => item["data-testid"] === "now-week-report");
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
    button(NOW_COPY.en.done).onClick?.(); button(NOW_COPY.en.done).onClick?.();
    expect(state.saveTodayOutcome).toHaveBeenCalledTimes(1);
    resolve(); await Promise.resolve();
  });
  it("leads with the Now kicker (no date, no picture, no age) and still hands the loop clock on", () => {
    vi.setSystemTime(new Date(2026, 9, 14, 20, 30));
    const html = renderToStaticMarkup(<NowView />);
    const heading = html.slice(html.indexOf('<header class="now-heading"'), html.indexOf("</header>"));
    expect(heading).toContain(`data-testid="now-kicker">${NOW_COPY.en.kicker}</p>`);
    expect(heading).not.toContain(new Date(2026, 9, 14, 20, 30).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
    expect(heading).not.toContain("4 years");
    expect(heading).not.toMatch(/<img|today-identity/);
    expect(state.moreProps.now.getTime()).toBe(Date.now());
  });
  it.each(["en", "he"] as const)("%s: tonight is one step, and the week sits behind More for tonight", (lang) => {
    state.lang = lang;
    const copy = NOW_COPY[lang];
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain(copy.title("Noa"));
    expect(html).toContain(copy.subtitle);
    expect(NOW_COPY.en.title("Noa")).toBe("One thing tonight with Noa");
    expect(NOW_COPY.he.title("נועה")).toBe("הערב, דבר אחד עם נועה");
    expect(NOW_COPY.he.pickedWhy.tonight).toBe("הערב הוא זמן שקט לחזור על היום");
    const practice = html.indexOf('data-module="today-practice"');
    const more = html.indexOf('data-testid="now-more-tonight"');
    const grid = html.indexOf('class="now-day-grid"');
    expect(practice).toBeGreaterThan(-1);
    expect(more).toBeGreaterThan(practice);
    expect(grid).toBeGreaterThan(more);
    expect(html).toContain('class="now-tonight-more"');
    const at = html.indexOf('data-testid="now-more-tonight"');
    const details = html.slice(html.lastIndexOf("<details", at), at + 80);
    expect(details).not.toMatch(/\sopen(?:=|>|\s)/);
    expect(html).toContain(copy.moreTonight);
    expect(html).toContain(copy.moreTonightSub);
  });
});

describe("B-SHELL-36 first-run handoff", () => {
  it("waits for the accepted-action snapshot before mounting any automatic focus", () => {
    state.actionLoopReady = false;
    const html = renderToStaticMarkup(<NowView />);
    expect(html).toContain('role="status"'); expect(html).not.toContain('data-module="today-practice"');
    expect(state.focusCalls).not.toHaveBeenCalled();
  });
  it.each(["en", "he"] as const)("an accepted onboarding observation leads with an explicit record form and zero focus calls (%s)", lang => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
    try {
      state.lang = lang;
      state.actionLoop = [{ id: "today.child-a.2026-10-09", recommendation: "Notice one moment together.", source: "onboarding", status: "accepted", acceptedAt: "2026-10-09T11:00:00Z", capacity: "tiny", acceptanceKey: "onboarding-v1.child-a.test" }];
      const html = renderToStaticMarkup(<NowView />);
      expect(html).toContain('data-module="now-step"'); expect(html).toContain("Notice one moment together.");
      expect(html).toContain('data-testid="now-observation-answer"');
      const save = html.match(/<button[^>]*class="companion-primary now-observation-save"[^>]*>[\s\S]*?<\/button>/)?.[0];
      expect(save).toBeDefined(); expect(save).toContain('disabled=""'); expect(save).toContain("aria-describedby=");
      expect(save).not.toContain(">check</span>");
      expect(html).toContain('data-testid="now-observation-required"');
      expect(html).toContain(lang === "he" ? "כדי לשמור, כתבו רגע אחד למעלה." : "Write a moment above to keep it.");
      expect(html).not.toContain(lang === "he" ? "מחר נשאל איך היה." : "Tomorrow we&#x27;ll ask how it went.");
      expect(html).not.toContain(NOW_COPY[lang].helped);
      expect(html).not.toContain(NOW_COPY[lang].notToday);
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect(html).not.toContain("1 of 4"); expect(html).not.toContain("First steps"); expect(state.focusCalls).not.toHaveBeenCalled();
      vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
      expect(renderToStaticMarkup(<NowView />)).not.toContain(lang === "he" ? "מחר נשאל איך היה." : "Tomorrow we&#x27;ll ask how it went.");
    } finally { vi.useRealTimers(); }
  });
});

describe("v3 F-NOW-1 · the plan card's body and the guide reader", () => {
  const STEP = "Before leaving home, offer a choice between two familiar shoes. Wait for the answer. Keep it small.";
  const aiFocus = (extra: Partial<Focus> = {}): Focus => ({ text: STEP, tryToday: STEP, focus: "You have been noticing mornings.", dateKey: "2026-10-12", generatedAt: "2026-10-12T07:00:00Z", lang: "en", ...extra });
  /** The recommendation's own plan card: its frame through the end of its section. */
  const card = (html: string) => {
    const at = html.indexOf('data-plan="recommendation"');
    expect(at, "the recommendation's plan card").toBeGreaterThan(-1);
    return html.slice(html.lastIndexOf("<div", at), html.indexOf("</section>", at) + "</section>".length);
  };
  const picked = (html: string) => {
    const line = html.match(/<div class="now-picked" data-testid="now-picked-because">[\s\S]*?<\/div>/)?.[0];
    expect(line, "the Picked because line").toBeDefined();
    return line!;
  };
  /** Visible words only: icon ligatures, tags and SSR text separators removed, entities decoded. */
  const words = (html: string) => html
    .replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

  it.each(["en", "he"] as const)("%s: a library guide - kicker, an always-visible Picked line with the name isolated, its size in words, one Begin into a read-only reader", lang => {
    state.lang = lang; state.noPractice = true;
    const copy = NOW_COPY[lang];
    const html = renderToStaticMarkup(<NowView />);
    const plan = card(html);
    expect(plan).toContain(`<p class="now-plan-kicker">${copy.stepKicker}</p>`);
    expect(plan).toContain(copy.planTag.recommendation);
    const line = picked(plan);
    expect(line).toContain(`<b>${copy.pickedBecause}</b>`);
    expect(line).toContain("<bdi>Noa</bdi>");
    expect(line).toContain(copy.curatedWhy);
    expect(line).not.toContain(" dir=");
    expect(plan).toContain('<ul class="now-guide-meta">');
    expect(plan).toContain(copy.oneAction);
    // Kept: Another idea. Dropped: the library door.
    expect(plan).not.toContain(lang === "he" ? "לספריית הפעילויות" : "Browse activities");
    // Clinical firewall: no ratio, percentage or bar anywhere on the card.
    expect(plan).not.toMatch(/\d\s*\/\s*\d|\d\s*%|role="progressbar"|<progress/);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(button(copy.begin)["data-primary-move"]).toBe("choose-next-step");
    expect(state.readerProps).toMatchObject({ open: false, lang, crumb: copy.planTag.recommendation, note: copy.putDown });
    expect(state.readerProps.onChoose).toBeUndefined();
    expect(state.readerProps.how.length).toBeGreaterThan(0);
    // Phone and desktop alike: the next step in words, never a count of steps.
    expect(words(plan)).toContain(copy.nextStep(state.readerProps.how[0]));
    if (lang === "he") expect(words(line).replace("Noa", "")).not.toMatch(/[A-Za-z]/);
    expect(state.acceptTodayAction).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("%s: an AI step on day 0 says it is a first idea, never a bare age, and stays unchosen until the reader", lang => {
    state.lang = lang; state.noPractice = true;
    state.focus = aiFocus({ sayThis: "Red shoes or blue shoes today?" });
    const copy = NOW_COPY[lang];
    const html = renderToStaticMarkup(<NowView />);
    const plan = card(html);
    expect(plan).toContain('data-recommendation-source="ai"');
    const line = picked(plan);
    expect(line).toContain(copy.pickedFirstLook);
    expect(words(line)).not.toMatch(lang === "he" ? /גיל/ : /\bage\b/);
    expect(plan).toContain(`<p class="now-plan-meta">${copy.noStepYet}</p>`);
    expect(plan).toContain(copy.readMinutes(1));
    expect(plan).toContain(copy.oneAction);
    expect(plan).toContain("Red shoes or blue shoes today?");
    expect(state.readerProps).toMatchObject({ open: false, title: STEP, error: false });
    expect(state.readerProps.words).toContain("Red shoes or blue shoes today?");
    expect(state.readerProps.how).toEqual(["Before leaving home, offer a choice between two familiar shoes.", "Wait for the answer.", "Keep it small."]);
    expect(typeof state.readerProps.onChoose).toBe("function");
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(state.acceptTodayAction).not.toHaveBeenCalled();
  });

  it("with recent moments the AI line names them and says the age once, up front, never again in the list", () => {
    state.focus = aiFocus();
    state.behaviorLogs = [{ id: "m1", timestamp: "2026-10-11T09:00:00", behaviorType: "Moment", trigger: "Put on shoes after one choice.", notes: "", response: "" }];
    const line = words(picked(renderToStaticMarkup(<NowRecommendation name="Noa" onTalkOpen={vi.fn()} />)));
    expect(line).toContain(`${NOW_COPY.en.pickedBecause} Noa, 4 years · recent moments`);
    expect(line).not.toMatch(/\bage\b/);
  });

  it("a choice that fails to save says so after the remount its optimistic write causes, and never shows a receipt", async () => {
    state.noPractice = true; state.focus = aiFocus();
    state.acceptTodayAction.mockRejectedValueOnce(new Error("offline"));
    renderToStaticMarkup(<NowView />);
    state.readerProps.onChoose();
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(state.acceptTodayAction).toHaveBeenCalledTimes(1);
    const plan = card(renderToStaticMarkup(<NowView />));
    expect(plan).toContain(`role="alert">${NOW_COPY.en.saveError}</p>`);
    expect(plan).not.toContain(`>${NOW_COPY.en.saved}<`);
    expect(state.readerProps.error).toBe(true);
    // Another step is not that failure.
    state.focus = aiFocus({ text: "Read one page together before the bus.", tryToday: "Read one page together before the bus." });
    expect(card(renderToStaticMarkup(<NowView />))).not.toContain('role="alert"');
  });

  it("the active question gives the card its guide glyph and is never quoted on it", () => {
    state.noPractice = true; state.focus = aiFocus();
    state.activeFamilyTopic = { id: "topic-a", title: "Our mornings" };
    const plan = card(renderToStaticMarkup(<NowView topic={state.activeFamilyTopic} />));
    expect(plan).toContain('data-guide="mornings"');
    expect(plan).toMatch(/class="now-plan-medallion"[^>]*><span[^>]*>wb_sunny<\/span>/);
    expect(plan).not.toContain("Our mornings");
    expect(plan).not.toContain("<img");
  });

  // Re-pin (F-NOW-1 r2, FEAT-02): the question is quoted where the pick was made
  // for it - a library idea ranked for its area - and nowhere else.
  it.each(["en", "he"] as const)("%s: a library idea picked for the active question quotes it, isolated; an AI pick or an unmatched question never does", lang => {
    state.lang = lang; state.noPractice = true;
    const copy = NOW_COPY[lang];
    const question = lang === "he" ? "מילים חדשות בבית" : "New words at home";
    state.activeFamilyTopic = { id: "topic-w", title: question };
    const page = renderToStaticMarkup(<NowView topic={state.activeFamilyTopic} />);
    const plan = card(page);
    expect(plan).toContain('data-guide="new-words"');
    expect(plan).toContain('data-recommendation-source="library"');
    const line = picked(plan);
    const runs: string[] = line.match(/<bdi>[^<]*<\/bdi>/g) ?? [];
    expect(runs.some(run => run.includes(question)), "the question in its own bdi").toBe(true);
    expect(runs).toContain("<bdi>Noa</bdi>");
    expect(words(line)).toContain(`${copy.pickedQuestion} `);
    expect(words(line)).toContain(copy.topicWhy);
    expect(words(line)).not.toContain(copy.curatedWhy);
    expect(line).not.toContain(" dir=");
    if (lang === "he") expect(words(line).replace("Noa", "")).not.toMatch(/[A-Za-z]/);
    expect(page.match(/data-primary-move=/g)).toHaveLength(1);
    // An AI pick the model made without the question never quotes it.
    state.focus = aiFocus();
    const ai = picked(card(renderToStaticMarkup(<NowView topic={state.activeFamilyTopic} />)));
    expect(words(ai)).not.toContain(question);
    expect(words(ai)).not.toContain(copy.pickedQuestion);
    // A question with no guide area leaves the library's own order and reason.
    state.focus = null;
    state.activeFamilyTopic = { id: "topic-h", title: "Why does he hum?" };
    const plain = picked(card(renderToStaticMarkup(<NowView topic={state.activeFamilyTopic} />)));
    expect(words(plain)).not.toContain("Why does he hum?");
    expect(words(plain)).not.toContain(copy.pickedQuestion);
    expect(words(plain)).not.toContain(copy.topicWhy);
  });

  it.each(["en", "he"] as const)("%s: the face carries the guide's title as the card's h2 and the say line as a plain line unless it is words to say", lang => {
    state.lang = lang; state.noPractice = true;
    const library = card(renderToStaticMarkup(<NowView />));
    const title = library.match(/<h2 class="now-plan-title" id="([^"]+)" dir="auto">[^<]+<\/h2>/);
    expect(title, "the guide's title on the face").not.toBeNull();
    expect(library).toContain(`aria-labelledby="${title![1]}"`);
    expect(library.match(/<h2/g)).toHaveLength(1);
    expect(library).toMatch(/<p class="now-plan-say" dir="auto">/);
    expect(library).not.toContain("<blockquote");
    state.focus = aiFocus({ sayThis: "Red shoes or blue shoes today?" });
    const ai = card(renderToStaticMarkup(<NowView />));
    expect(ai).toMatch(/<blockquote class="now-plan-say" dir="auto">[^<]*Red shoes or blue shoes today\?/);
    expect(ai).toContain(`<h2 class="now-plan-title" id="`);
  });

  it.each(["en", "he"] as const)("%s: every lead speaks through the one plan body - an always-visible Picked line, its time and size in words, one primary move", lang => {
    state.lang = lang;
    const copy = NOW_COPY[lang];
    const note = { id: "parent-note", timestamp: "2026-07-09T08:10:00", behaviorType: "Moment", trigger: "Calmed and put shoes on within eight minutes.", notes: "", response: "" };
    const appointment = { id: "visit-specific", who: "", role: "Speech therapist", profession: "slp", when: "", whenIso: "2026-10-14T10:00:00", mode: "In person", status: "confirmed" };
    const lead = (page: string, kind: "step" | "visit" | "record" | "practice") => {
      const at = page.indexOf(`data-plan="${kind}"`);
      expect(at, `the ${kind} plan card`).toBeGreaterThan(-1);
      // The card runs from its frame to the end of its one plan body, which closes it.
      const end = page.indexOf("</div>", page.indexOf('data-testid="now-picked-because"', at)) + "</div>".length;
      const plan = page.slice(at, end);
      const foot = plan.slice(plan.indexOf('class="now-plan-foot"'));
      expect(foot).toContain('<ul class="now-guide-meta">');
      const line = picked(plan);
      expect(line).toContain(`<b>${copy.pickedBecause}</b>`);
      if (kind !== "practice") expect(words(line)).toContain(copy.pickedWhy[kind]);
      expect(line).not.toContain(" dir=");
      expect(page.match(/data-testid="now-picked-because"/g)).toHaveLength(1);
      expect(page.match(/data-primary-move=/g)).toHaveLength(1);
      expect(words(foot)).toContain(copy.planTime[kind]);
      expect(words(foot)).toContain(copy.planSize[kind]);
      expect(foot).not.toMatch(/\d\s*\/\s*\d|\d\s*%|role="progressbar"|<progress/);
      // The practice's own reason may name the child; nothing else is Latin in Hebrew.
      if (lang === "he") expect(words(line).replace(/Noa/g, "")).not.toMatch(/[A-Za-z]/);
      return plan;
    };
    lead(renderToStaticMarkup(<NowView />), "practice");
    state.actionLoop = [{ id: "step-a", recommendation: "Sit together for one page.", source: "coach", status: "accepted", acceptedAt: "2026-10-01", capacity: "tiny" }];
    const step = lead(renderToStaticMarkup(<NowView />), "step");
    expect(step).toMatch(/<h2 id="[^"]+-step" class="now-plan-title" dir="auto">Sit together for one page\.<\/h2>/);
    expect(step.match(/<h2/g)).toHaveLength(1);
    expect(step).toContain('class="companion-text-button now-plan-how"');
    expect(state.readerProps).toMatchObject({ open: false, title: "Sit together for one page.", crumb: copy.planTag.step });
    expect(state.readerProps.onChoose).toBeUndefined();
    expect(words(picked(step))).not.toContain(copy.pickedQuestion);
    // A step chosen under the active question quotes it.
    state.actionLoop = [{ id: "step-w", recommendation: "Name one thing you see on the walk.", source: "coach", status: "accepted", acceptedAt: "2026-10-02", capacity: "tiny", topicId: "topic-w" }];
    const topic = { id: "topic-w", title: lang === "he" ? "מילים חדשות בבית" : "New words at home" };
    const under = picked(lead(renderToStaticMarkup(<NowView topic={topic} />), "step"));
    const underRuns: string[] = under.match(/<bdi>[^<]*<\/bdi>/g) ?? [];
    expect(underRuns.some(run => run.includes(topic.title))).toBe(true);
    state.actionLoop = []; state.appointments = [appointment]; state.behaviorLogs = [note];
    const visit = lead(renderToStaticMarkup(<NowView />), "visit");
    expect(visit).toMatch(/<h2 id="[^"]+-visit" class="now-plan-title" dir="auto">/);
    state.appointments = [];
    lead(renderToStaticMarkup(<NowView />), "record");
  });

  it("phones: the question note hides, the art band is 190px with a 72px medallion and a 23px say line; desktop leads with the wider art", () => {
    const css = todayFile("nowView.css");
    expect(css).toContain("@media (max-width: 767.98px) { .now-question-note { display: none; } }");
    expect(css).toMatch(/\.now-plan \{[^}]*grid-template-columns: minmax\(0, 1\.25fr\) minmax\(0, 1fr\)/);
    const phone = css.slice(css.indexOf("@container now (max-width: 860px)") + 1);
    expect(phone).toMatch(/^[^@]*\.now-plan-art \{ min-block-size: 190px; \}/);
    expect(phone).toMatch(/^[^@]*\.now-plan-medallion \{[^}]*inline-size: 72px; block-size: 72px;/);
    expect(phone).toMatch(/^[^@]*\.now-plan-say \{[^}]*font-size: 23px;/);
    expect(css).not.toContain(".now-question-talk");
  });

  it("the guide picture is 16:9 from the inline-start edge, mirrored once in RTL with its scrim on the words' side; the phone medallion sits top-end, clear of the words", () => {
    const css = todayFile("nowView.css");
    expect(css).toMatch(/\.now-plan-img \{[^}]*inset-inline-start: 0;[^}]*aspect-ratio: 16 \/ 9;/);
    expect(css.match(/\.now-plan-img:dir\(rtl\) \{ transform: scaleX\(-1\); \}/g)).toHaveLength(1);
    expect(css.match(/scaleX\(-1\)/g)).toHaveLength(1);
    expect(css).toMatch(/\.now-plan-scrim \{[^}]*linear-gradient\(90deg, /);
    expect(css).toMatch(/\.now-plan-scrim:dir\(rtl\) \{[^}]*linear-gradient\(270deg, /);
    expect(css).toMatch(/\.now-plan-face \{[^}]*max-inline-size: 52%;/);
    const phone = css.slice(css.indexOf("@container now (max-width: 860px)") + 1);
    expect(phone).toMatch(/^[^@]*\.now-plan-medallion \{[^}]*inset-block-start: 18px;[^}]*inset-inline-end: 18px;/);
    expect(phone).toMatch(/^[^@]*\.now-plan-face \{ max-inline-size: calc\(100% - 96px\); \}/);
    expect(css).not.toMatch(/(?:^|[\s;{-])(?:left|right)\s*:/m);
  });
});

describe("B-TODAY-37 · 'Record a moment' on an older question opens that question's form on Now", () => {
  const older: ActionLoopEntry = { id: "today.child-a.2026-10-09", recommendation: "What did Noa notice outside?", source: "onboarding", status: "accepted", acceptedAt: "2026-10-09T11:00:00Z", capacity: "tiny", acceptanceKey: "onboarding-v1.child-a.test" };
  const newer: ActionLoopEntry = { id: "today.child-a.2026-10-10", recommendation: "Read one book together.", source: "coach", status: "accepted", acceptedAt: "2026-10-10T09:00:00Z", capacity: "tiny" };
  const at = (hash: string) => vi.stubGlobal("window", { location: { hash }, addEventListener: vi.fn(), removeEventListener: vi.fn() });

  it.each(["en", "he"] as const)("without the request Now leads with the newer step; with it, the older question's form (%s)", (lang) => {
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    state.lang = lang;
    state.actionLoop = [older, newer];
    at("#/overview");
    const plain = renderToStaticMarkup(<NowView />);
    expect(plain).toContain("Read one book together.");
    expect(plain).not.toContain('data-testid="now-observation-answer"');

    at(`#/overview?observe=${older.id}`);
    const asked = renderToStaticMarkup(<NowView />);
    expect(asked).toContain('data-module="now-step"');
    expect(asked).toContain("What did Noa notice outside?");
    expect(asked).toContain('data-testid="now-observation-answer"');
    expect(asked).toContain(lang === "he" ? "השאלה שבחרתם" : "The question you chose");
    expect(asked.match(/data-primary-move=/g)).toHaveLength(1);
    // Critic r1: the deep link scrolls to the QUESTION, clear of the sticky place pills.
    expect(asked).toMatch(/<h2 id="[^"]+-step" class="now-plan-title" dir="auto" style="[^"]*scroll-margin-block-start:calc\(var\(--sticky-offset\) \+ 12px\)/);
  });

  it("an answered, unknown or non-observation id is ignored: Now keeps its own choice", () => {
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    for (const [rows, id] of [
      [[{ ...older, status: "completed" as const, whatHappened: "Birds." }, newer], older.id],
      [[older, newer], "today.child-a.1999-01-01"],
      [[older, newer], newer.id],
    ] as const) {
      state.actionLoop = [...rows];
      at(`#/overview?observe=${id}`);
      const html = renderToStaticMarkup(<NowView />);
      expect(html).toContain("Read one book together.");
      expect(html).not.toContain('data-testid="now-observation-answer"');
    }
  });
});
