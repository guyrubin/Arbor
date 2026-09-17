import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConversationProposalTray from "./ConversationProposalTray";
import type { ConversationChangeRecord, ConversationProposal } from "../../lib/conversationProposals";
import { en as journalEn, he as journalHe } from "../../lib/i18nElevation/journal";

const harness = vi.hoisted(() => ({
  callbackRender: false,
  changes: [] as unknown[],
  toast: vi.fn(),
  undoChange: vi.fn(),
  trackUndone: vi.fn(),
}));
// Static markup uses real React hooks. Callback tests inspect the component's
// element tree without a DOM, while exercising its real commit/Undo closure.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial: unknown) => harness.callbackRender ? { current: initial } : actual.useRef(initial),
    useEffect: (effect: () => void, deps: unknown[]) => {
      if (!harness.callbackRender) actual.useEffect(effect, deps);
    },
  };
});
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => harness.callbackRender ? {
    conversationChanges: harness.changes,
    undoConversationChange: harness.undoChange,
  } : null,
}));
vi.mock("../../context/ToastContext", () => ({
  useToastOptional: () => harness.callbackRender ? { toast: harness.toast } : null,
}));
vi.mock("../../lib/kpiEvents", () => ({
  trackKeepUndone: harness.trackUndone,
  trackKeepThis: vi.fn(),
}));

const proposal: ConversationProposal = {
  id: "p1", sessionId: "s1", turnId: "t1", childId: "c1", target: "milestone",
  summary: "Climbed the stairs independently", sourceExcerpt: "she did the stairs alone",
  sourceLanguage: "en", confidence: 0.91, milestoneId: "m1", milestoneStatus: "yes",
  status: "draft", createdAt: "2026-07-27T12:00:00.000Z",
};
const noop = () => {};
const props = (overrides: Partial<React.ComponentProps<typeof ConversationProposalTray>> = {}) => ({
  proposals: [proposal], language: "en" as const, onEdit: noop, onConfirm: noop, onDiscard: noop, ...overrides,
});
function elements(node: React.ReactNode): React.ReactElement<Record<string, any>>[] {
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as React.ReactElement<Record<string, any>>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
function control(tree: React.ReactNode, label: string) {
  const button = elements(tree).find((element) => element.type === "button" && element.props.children === label);
  expect(button, `missing ${label} control`).toBeDefined();
  return button!.props;
}
function committed(item: ConversationProposal): ConversationChangeRecord {
  return { ...item, status: "committed", confirmedBy: "parent", confirmedAt: "2026-09-17T10:00:00.000Z", providerCanWrite: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.callbackRender = false;
  harness.changes = [];
  harness.undoChange.mockImplementation(async (id: string) => {
    const row = harness.changes.find((item) => (item as ConversationChangeRecord).id === id) as ConversationChangeRecord;
    row.status = "undone";
  });
});
afterEach(() => { vi.useRealTimers(); harness.callbackRender = false; });

describe("ConversationProposalTray consent and provenance", () => {
  it("states that nothing is saved and shows provenance without committing on render", () => {
    const confirm = vi.fn();
    const html = renderToStaticMarkup(<ConversationProposalTray {...props({ onConfirm: confirm })} />);
    expect(html).toContain("Nothing has been saved yet");
    expect(html).toContain("she did the stairs alone");
    expect(html).toContain("Review before saving");
    expect(html).toContain(">Save<");
    expect(confirm).not.toHaveBeenCalled();
  });
  it("renders native Hebrew review chrome with RTL direction", () => {
    const html = renderToStaticMarkup(<ConversationProposalTray {...props({ language: "he", proposals: [{ ...proposal, sourceLanguage: "he" }] })} />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("עדיין לא נשמר דבר");
    expect(html).toContain(">שמירה<");
  });
  it("prevents confirmation when the canonical milestone is missing", () => {
    const html = renderToStaticMarkup(<ConversationProposalTray {...props({ proposals: [{ ...proposal, conflict: { code: "missing_milestone", existing: "missing" } }] })} />);
    expect(html).toContain("This may change or repeat an existing record");
    expect(html).toMatch(/disabled=""[^>]*>Save</);
  });
  it.each([{ summary: "   " }, { busyId: proposal.id }])("disables Save for an empty summary or pending commit: %j", (state) => {
    harness.callbackRender = true;
    const tree = ConversationProposalTray(props({ ...state, proposals: [{ ...proposal, ...("summary" in state ? state : {}) }] }));
    expect(control(tree, "Save").disabled).toBe(true);
  });
  it("keeps edit and discard separate from confirmation", () => {
    harness.callbackRender = true;
    const edit = vi.fn(), discard = vi.fn(), confirm = vi.fn();
    const tree = ConversationProposalTray(props({ onEdit: edit, onDiscard: discard, onConfirm: confirm }));
    elements(tree).find((element) => element.type === "textarea")!.props.onChange({ target: { value: "Parent correction" } });
    control(tree, "Discard").onClick();
    expect(edit).toHaveBeenCalledWith(proposal.id, "Parent correction");
    expect(discard).toHaveBeenCalledWith(proposal.id);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("ConversationProposalTray Keep and Undo", () => {
  it.each(["en", "he"] as const)("offers localized Undo only after a committed audit row lands (%s)", async (language) => {
    vi.useFakeTimers();
    harness.callbackRender = true;
    const item = { ...proposal, target: "journal" as const };
    const confirm = vi.fn(async () => { harness.changes.push(committed(item)); });
    const tree = ConversationProposalTray(props({ proposals: [item], language, onConfirm: confirm }));
    const copy = language === "he" ? journalHe : journalEn;
    control(tree, language === "he" ? "שמירה" : "Save").onClick();
    expect(confirm).toHaveBeenCalledWith(item);
    expect(harness.toast).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(harness.toast).toHaveBeenCalledWith(copy["elev.keep.kept"], "success", expect.objectContaining({ label: copy["elev.keep.undo"] }));
    const action = harness.toast.mock.calls[0][2];
    action.onClick();
    await vi.runAllTimersAsync();
    expect(harness.undoChange).toHaveBeenCalledWith(item.id);
    expect(harness.changes).toHaveLength(1);
    expect((harness.changes[0] as ConversationChangeRecord).status).toBe("undone");
    expect(harness.trackUndone).toHaveBeenCalledWith("coach-voice-tray");
    expect(harness.toast).toHaveBeenLastCalledWith(copy["elev.keep.undone"], "info");
    action.onClick();
    await vi.runAllTimersAsync();
    expect(harness.undoChange).toHaveBeenCalledTimes(1);
    expect(harness.trackUndone).toHaveBeenCalledTimes(1);
  });
  it("waits for confirmation to settle even when its audit row already exists", async () => {
    vi.useFakeTimers();
    harness.callbackRender = true;
    const item = { ...proposal, target: "journal" as const };
    harness.changes.push(committed(item));
    let resolveCommit!: () => void;
    const confirm = vi.fn(() => new Promise<void>((resolve) => { resolveCommit = resolve; }));
    const tree = ConversationProposalTray(props({ proposals: [item], onConfirm: confirm }));
    control(tree, "Save").onClick();
    await vi.runAllTimersAsync();
    expect(harness.toast).not.toHaveBeenCalled();
    resolveCommit();
    await vi.runAllTimersAsync();
    expect(harness.toast).toHaveBeenCalledWith(journalEn["elev.keep.kept"], "success", expect.objectContaining({ label: journalEn["elev.keep.undo"] }));
  });
  it("does not claim Keep succeeded when a caller resolves without a committed row", async () => {
    vi.useFakeTimers();
    harness.callbackRender = true;
    const tree = ConversationProposalTray(props({ proposals: [{ ...proposal, target: "journal" }], onConfirm: vi.fn(async () => {}) }));
    control(tree, "Save").onClick();
    await vi.runAllTimersAsync();
    expect(harness.toast).not.toHaveBeenCalled();
  });
  it("does not offer cross-screen Undo for a milestone confirmation", async () => {
    vi.useFakeTimers();
    harness.callbackRender = true;
    const confirm = vi.fn(async () => { harness.changes.push(committed(proposal)); });
    const tree = ConversationProposalTray(props({ onConfirm: confirm }));
    control(tree, "Save").onClick();
    await vi.runAllTimersAsync();
    expect(confirm).toHaveBeenCalledWith(proposal);
    expect(harness.toast).not.toHaveBeenCalled();
    expect(harness.undoChange).not.toHaveBeenCalled();
  });
});