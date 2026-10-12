import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyTopic } from "../../lib/familyTopics";

const topic = (id: string, title: string, extra: Partial<FamilyTopic> = {}): FamilyTopic => ({
  id, childId: "child-a", title, intent: "understand", status: "active", observationIds: [],
  createdAt: "2026-10-01T08:00:00.000Z", updatedAt: "2026-10-01T08:00:00.000Z", ...extra,
} as FamilyTopic);

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  familyTopics: [] as FamilyTopic[], archivedFamilyTopics: [] as FamilyTopic[], activeFamilyTopic: null as FamilyTopic | null,
  updateFamilyTopic: vi.fn(async () => {}), createFamilyTopic: vi.fn(async () => ({})), selectFamilyTopic: vi.fn(),
  buttons: [] as Record<string, any>[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Noa" }, actionLoop: [], conversations: [], openConversation: vi.fn(), newConversation: vi.fn(), seedCoach: vi.fn(), setActiveTab: vi.fn(),
  ...state,
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => [] }));
vi.mock("../ui/Sheet", () => ({ Sheet: ({ title, children }: { title: string; children: React.ReactNode }) => <div data-sheet-title={title}>{children}</div> }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as Record<string, any>);
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
import FamilyTopicSheet from "./FamilyTopicSheet";
import NowQuestionRow from "./NowQuestionRow";
import { NOW_COPY } from "./nowViewCopy";

const byLabel = (label: string) => state.buttons.find(item => item["aria-label"] === label);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const MORNINGS = topic("t-1", "How could mornings feel easier?");
const SLEEP = topic("t-2", "Falling asleep alone", { asideAt: "2026-10-05T08:00:00.000Z", intent: "support" });
const BATH = topic("t-3", "Bath time", { status: "archived", intent: "enjoy" });

beforeEach(() => {
  state.lang = "en"; state.buttons = [];
  state.familyTopics = [MORNINGS, SLEEP]; state.archivedFamilyTopics = [BATH]; state.activeFamilyTopic = MORNINGS;
  state.updateFamilyTopic.mockClear(); state.createFamilyTopic.mockClear(); state.selectFamilyTopic.mockClear();
});

describe("v3 All questions sheet", () => {
  it("lists every open question with its state, keeps finished ones behind a toggle, and links only the active one", () => {
    const html = renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    expect(html).toContain(MORNINGS.title);
    expect(html).toContain(SLEEP.title);
    expect(html).not.toContain(BATH.title);
    expect(html).toContain(">Active<");
    expect(html).toContain(">Set aside<");
    expect(html).toContain("Show finished questions (1)");
    expect(html).toContain(`Linked to “${MORNINGS.title}”`);
    expect(html).not.toContain('id="family-question-title"');
  });

  it("sets aside, brings back and finishes a question in place — each through the store", () => {
    renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    byLabel(`Set aside “${MORNINGS.title}”`)!.onClick();
    expect(state.updateFamilyTopic).toHaveBeenLastCalledWith(MORNINGS.id, { aside: true });
    byLabel(`Bring back “${SLEEP.title}”`)!.onClick();
    expect(state.updateFamilyTopic).toHaveBeenLastCalledWith(SLEEP.id, { aside: false });
    byLabel(`Done with “${MORNINGS.title}”`)!.onClick();
    expect(state.updateFamilyTopic).toHaveBeenLastCalledWith(MORNINGS.id, { status: "archived" });
  });

  it("choosing a set-aside question brings it back before it becomes active", async () => {
    renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    state.buttons.find(item => item.className === "topic-row-pick" && React.Children.toArray(item.children).some(child => React.isValidElement(child) && (child.props as { children?: unknown }).children === SLEEP.title))!.onClick();
    await flush();
    expect(state.updateFamilyTopic).toHaveBeenCalledWith(SLEEP.id, { aside: false });
    expect(state.selectFamilyTopic).toHaveBeenCalledWith(SLEEP.id);
  });

  it("opens straight into a new question carrying the draft, and never shows a number score", () => {
    const html = renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} startNew draft="Why the shoes?" />);
    expect(html).toContain('id="family-question-title"');
    expect(html).toContain("Why the shoes?");
    expect(html).toContain("A new question, in your words");
    expect(html).not.toMatch(/\d+\s?%/);
  });

  it("renders Hebrew states in the RTL register", () => {
    state.lang = "he";
    const html = renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(">פעילה<");
    expect(html).toContain(">בצד<");
    expect(html).not.toContain(">Active<");
  });
});

describe("v3 Now question row", () => {
  it("shows the active question with Talk and Edit, other open questions as chips, and never a set-aside one", () => {
    const onTalk = vi.fn(), onOpen = vi.fn();
    state.familyTopics = [MORNINGS, SLEEP, topic("t-4", "Sharing toys")];
    const html = renderToStaticMarkup(<NowQuestionRow lang="en" topic={MORNINGS} onOpen={onOpen} onTalk={onTalk} />);
    expect(html).toContain('data-testid="now-question-active"');
    expect(html).toContain("Sharing toys");
    expect(html).not.toContain(SLEEP.title);
    expect(html).toContain(`${NOW_COPY.en.topics} (3)`);
    state.buttons.find(item => item.className === "now-question-talk")!.onClick();
    expect(onTalk).toHaveBeenCalledWith(MORNINGS.title);
    byLabel(NOW_COPY.en.editQuestion)!.onClick();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("with no question yet, the empty row starts a first question", () => {
    const onCreate = vi.fn();
    state.familyTopics = [];
    const html = renderToStaticMarkup(<NowQuestionRow lang="en" topic={null} onOpen={() => {}} onCreate={onCreate} onTalk={() => {}} />);
    expect(html).toContain('data-testid="now-question-empty"');
    expect(html).toContain(NOW_COPY.en.firstQuestionBody);
    state.buttons.find(item => item["data-testid"] === "now-question-empty")!.onClick();
    expect(onCreate).toHaveBeenCalledOnce();
  });
});
