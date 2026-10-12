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
  setActiveTab: vi.fn(),
  activeTab: "overview" as string,
  seedCoach: vi.fn(), newConversation: vi.fn(),
  buttons: [] as Record<string, any>[],
  forms: [] as Record<string, any>[],
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
  if (type === "form" && props && typeof props === "object") state.forms.push(props as Record<string, any>);
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
import { translate } from "../../lib/i18n";
import { clearFamilyTopicEdit, pendingFamilyTopicEdit, requestFamilyTopicEdit } from "./familyTopicEvents";

const byLabel = (label: string) => state.buttons.find(item => item["aria-label"] === label);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const MORNINGS = topic("t-1", "How could mornings feel easier?");
const SLEEP = topic("t-2", "Falling asleep alone", { asideAt: "2026-10-05T08:00:00.000Z", intent: "support" });
const BATH = topic("t-3", "Bath time", { status: "archived", intent: "enjoy" });

beforeEach(() => {
  state.lang = "en"; state.buttons = []; state.forms = [];
  state.familyTopics = [MORNINGS, SLEEP]; state.archivedFamilyTopics = [BATH]; state.activeFamilyTopic = MORNINGS;
  state.updateFamilyTopic.mockClear(); state.createFamilyTopic.mockClear(); state.selectFamilyTopic.mockClear();
  state.seedCoach.mockClear(); state.newConversation.mockClear();
  clearFamilyTopicEdit();
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

  it("IA-06: every way out goes through the sheet's one close; a row that leaves navigates after it", () => {
    const order: string[] = [];
    const onClose = vi.fn(() => { order.push("close"); });
    state.setActiveTab = vi.fn((tab: string) => { order.push(`go:${tab}`); });
    const byText = (key: string) => state.buttons.find(item => item.children === translate("en", key));
    renderToStaticMarkup(<FamilyTopicSheet onClose={onClose} />);
    byText("companion.family-topic-sheet.see-the-whole-picture")!.onClick();
    expect(order).toEqual(["close", "go:development"]);
    byText("companion.family-topic-sheet.close")!.onClick();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(state.setActiveTab).toHaveBeenCalledTimes(1);
  });

  it("IA-06: the crumb is the first line of the sheet's body and says where the sheet sits, in both languages", () => {
    const crumbOf = (html: string) => {
      const nav = html.match(/<nav [^>]*data-testid="sheet-crumb"[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? "";
      return { nav, labels: [...nav.matchAll(/dir="auto"[^>]*>([^<]*)</g)].map(m => m[1]) };
    };
    let html = renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    expect(html.indexOf('data-testid="sheet-crumb"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="sheet-crumb"')).toBeLessThan(html.indexOf('class="topic-sheet"'));
    expect(crumbOf(html).labels).toEqual(["Now", MORNINGS.title]);
    expect(crumbOf(html).nav).toContain('aria-label="Location"');
    state.lang = "he";
    html = renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    expect(crumbOf(html).labels).toEqual(["עכשיו", MORNINGS.title]);
    expect(crumbOf(html).nav).toContain('aria-label="נתיב ניווט"');
  });

  it("IA-06: the crumb's Now goes out through the same one close, then to its route", () => {
    const order: string[] = [];
    const onClose = vi.fn(() => { order.push("close"); });
    state.setActiveTab = vi.fn((tab: string) => { order.push(`go:${tab}`); });
    renderToStaticMarkup(<FamilyTopicSheet onClose={onClose} />);
    const now = state.buttons.find(item => React.isValidElement(item.children) && (item.children.props as { children?: unknown }).children === "Now");
    now!.onClick();
    expect(order).toEqual(["close", "go:overview"]);
  });

  it("renders Hebrew states in the RTL register", () => {
    state.lang = "he";
    const html = renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(">פעילה<");
    expect(html).toContain(">בצד<");
    expect(html).not.toContain(">Active<");
    expect(html).toContain(translate("he", "companion.family-topic-sheet.intent.support"));
  });

  it("F-NOW-1: talking a question through starts from the sheet's own entry, seeded with the active question", () => {
    const onClose = vi.fn();
    renderToStaticMarkup(<FamilyTopicSheet onClose={onClose} />);
    state.buttons.find(item => item.children === translate("en", "companion.family-topic-sheet.talk-this-through-with-arbor"))!.onClick();
    expect(state.newConversation).toHaveBeenCalledOnce();
    expect(state.seedCoach).toHaveBeenCalledWith({ prompt: MORNINGS.title, source: "family-topic" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("F-NOW-1: what the parent wants from the active question is one always-visible pressed row, saved through the store as it is tapped", async () => {
    const html = renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    expect(html).not.toContain('id="family-question-title"');
    const row = html.match(/<fieldset class="topic-intent-row" data-testid="topic-intent-row">[\s\S]*?<\/fieldset>/)?.[0] ?? "";
    expect(row).toContain(translate("en", "companion.family-topic-sheet.what-would-you-like"));
    expect(row.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(row.match(/aria-pressed="false"/g)).toHaveLength(2);
    const intent = (key: string) => state.buttons.find(item => item["aria-pressed"] !== undefined && React.Children.toArray(item.children).includes(translate("en", key)))!;
    intent("companion.family-topic-sheet.intent.understand").onClick();
    expect(state.updateFamilyTopic).not.toHaveBeenCalled();
    intent("companion.family-topic-sheet.intent.support").onClick();
    await flush();
    expect(state.updateFamilyTopic).toHaveBeenCalledWith(MORNINGS.id, { intent: "support" });
  });

  it("F-NOW-1: Now's edit glyph opens the sheet on that question's words; the form holds the title only and saves only the title", async () => {
    requestFamilyTopicEdit(SLEEP.id);
    const html = renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />);
    expect(html).toMatch(new RegExp(`<textarea id="family-question-title"[^>]*>${SLEEP.title}</textarea>`));
    const form = html.match(/<form class="topic-edit"[\s\S]*?<\/form>/)?.[0] ?? "";
    expect(form).not.toContain("<fieldset");
    expect(form).not.toContain("aria-pressed");
    expect(state.forms).toHaveLength(1);
    state.forms[0].onSubmit({ preventDefault: () => {} });
    await flush();
    expect(state.updateFamilyTopic).toHaveBeenCalledWith(SLEEP.id, { title: SLEEP.title });
  });

  it("F-NOW-1: an edit request for a question that is gone, or one gone stale, opens the plain list", () => {
    requestFamilyTopicEdit("t-gone");
    expect(renderToStaticMarkup(<FamilyTopicSheet onClose={() => {}} />)).not.toContain('id="family-question-title"');
    requestFamilyTopicEdit(MORNINGS.id);
    expect(pendingFamilyTopicEdit()).toBe(MORNINGS.id);
    expect(pendingFamilyTopicEdit(Date.now() + 10_000)).toBeNull();
    clearFamilyTopicEdit();
    expect(pendingFamilyTopicEdit()).toBeNull();
  });
});

describe("v3 Now question row", () => {
  it("shows the active question with its guide glyph and Edit, other open questions as chips, and never a set-aside one", () => {
    const onOpen = vi.fn();
    state.familyTopics = [MORNINGS, SLEEP, topic("t-4", "Sharing toys")];
    const html = renderToStaticMarkup(<NowQuestionRow lang="en" topic={MORNINGS} onOpen={onOpen} />);
    expect(html).toContain('data-testid="now-question-active"');
    expect(html).toContain("Sharing toys");
    expect(html).not.toContain(SLEEP.title);
    expect(html).toContain(`${NOW_COPY.en.topics} (3)`);
    // F-NOW-1: Talk left the row (the launcher and the sheet's own entry carry it).
    expect(html).not.toContain("now-question-talk");
    expect(html).toMatch(/<span class="msr now-question-icon"[^>]*>wb_sunny<\/span>/);
    expect(html).toMatch(/<button type="button" class="now-question-chip">[\s\S]*?>diversity_1<\/span>/);
    byLabel(NOW_COPY.en.editQuestion)!.onClick();
    expect(pendingFamilyTopicEdit()).toBe(MORNINGS.id);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("F-NOW-1: a Hebrew question wears its guide's glyph too; one no guide matches keeps its intent's", () => {
    state.familyTopics = [topic("t-6", "איך הבקרים יהיו קלים יותר?")];
    expect(renderToStaticMarkup(<NowQuestionRow lang="he" topic={state.familyTopics[0]} onOpen={() => {}} />)).toMatch(/<span class="msr now-question-icon"[^>]*>wb_sunny<\/span>/);
    const counting = topic("t-5", "Counting to ten", { intent: "enjoy" });
    state.familyTopics = [counting];
    expect(renderToStaticMarkup(<NowQuestionRow lang="en" topic={counting} onOpen={() => {}} />)).toMatch(/<span class="msr now-question-icon"[^>]*>favorite<\/span>/);
  });

  it("with no question yet, the empty row starts a first question", () => {
    const onCreate = vi.fn();
    state.familyTopics = [];
    const html = renderToStaticMarkup(<NowQuestionRow lang="en" topic={null} onOpen={() => {}} onCreate={onCreate} />);
    expect(html).toContain('data-testid="now-question-empty"');
    expect(html).toContain(NOW_COPY.en.firstQuestionBody);
    state.buttons.find(item => item["data-testid"] === "now-question-empty")!.onClick();
    expect(onCreate).toHaveBeenCalledOnce();
  });
});
