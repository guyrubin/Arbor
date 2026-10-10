import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachAnswerCards, { CoachTryIt } from "./CoachAnswerCards";
import type { CoachContract } from "../../types";

// Real component callbacks with stable hook slots. This is state/interaction
// unit evidence, not a DOM, keyboard, focus, persistence or visual audit.
const hooks = vi.hoisted(() => ({ cursor: 0, slots: [] as any[] }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(), useId: () => "report-test",
  useState: (initial: any) => {
    const at = hooks.cursor++;
    if (!(at in hooks.slots)) hooks.slots[at] = typeof initial === "function" ? initial() : initial;
    return [hooks.slots[at], (next: any) => { hooks.slots[at] = typeof next === "function" ? next(hooks.slots[at]) : next; }];
  },
  useRef: (initial: any) => {
    const at = hooks.cursor++;
    if (!(at in hooks.slots)) hooks.slots[at] = { current: initial };
    return hooks.slots[at];
  },
}));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: vi.fn(), trackShareCompleted: vi.fn() }));
vi.mock("../../lib/analytics", () => ({ track: vi.fn() }));
const doc = { documentType: "school note", keyPoints: ["Document point"], questionsForProfessional: ["Document question?"], handoffNote: "Document handoff", suggestedMemory: ["Document fact"] };
function contract(over: Partial<CoachContract> = {}): CoachContract {
  return {
    text: "A small first step can help.", riskLevel: "low", ageBand: "", domains: [],
    nonDiagnosticHypotheses: [{ label: "Possible context", rationale: "Context rationale", confidence: "low" }],
    todayPlan: ["First exact step", "Second exact step", "Third exact step"], parentScript: "Exact usable words",
    observe: ["Exact observation"], avoid: ["Exact avoid"], escalateIf: ["Exact help threshold"], memoryProposals: [],
    frameRouting: { aim: "", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" },
    handoffNotes: { teacher: "Teacher exact note", professional: "Professional exact note" }, sourceCardsUsed: ["one-source"], document: doc, ...over,
  };
}
type Props = React.ComponentProps<typeof CoachAnswerCards>;
type El = React.ReactElement<Record<string, any>>;
const setup = (extra: Partial<Props> = {}) => ({ contract: contract(), onSaveToPlan: vi.fn(), onAddToHandoff: vi.fn(), onTryIt: vi.fn(), onUndoTryIt: vi.fn(), onGoDeeper: vi.fn(), onProposeMemory: vi.fn(async () => {}), ...extra });
function render(props: Props) { hooks.cursor = 0; return CoachAnswerCards(props); }
function elements(node: React.ReactNode): El[] {
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const e = node as El;
  // ReportDisclosure is hook-free; inspect its actual native controls.
  if (typeof e.type === "function" && e.props.onToggle) return elements((e.type as (p: any) => React.ReactNode)(e.props));
  return [e, ...React.Children.toArray(e.props.children).flatMap(elements)];
}
function byId(tree: React.ReactNode, id: string) { const e = elements(tree).find(e => e.props["data-testid"] === id); expect(e, id).toBeDefined(); return e!; }
function buttonIn(tree: React.ReactNode, id: string) { return elements(byId(tree, id)).find(e => e.type === "button")!; }
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<Record<string, any>>(node) ? text((node as El).props.children) : "";
}
function namedButton(tree: React.ReactNode, name: string) { const e = elements(tree).find(e => e.type === "button" && text(e.props.children) === name); expect(e, name).toBeDefined(); return e!; }
function deferred() { let resolve!: () => void; let reject!: (e: Error) => void; const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => { hooks.cursor = 0; hooks.slots = []; vi.clearAllMocks(); });
afterEach(() => vi.unstubAllGlobals());

describe("disclosure callbacks", () => {
  it("every named native button controls a mounted panel, toggles independently and retains identity", () => {
    const props = setup({ contract: contract({ text: "Long context. ".repeat(60), riskLevel: "urgent", governedEscalation: "Governed help first" }), council: [{ scholarId: "one", name: "Council name", concept: "Council concept", takeaway: "Council takeaway", suggestion: "Council suggestion" }] });
    for (const id of ["coach-report-opening", "coach-report-understanding", "coach-report-details", "coach-report-document", "coach-report-actions", "coach-report-council", "coach-report-sources"]) {
      const tree = render(props); const button = buttonIn(tree, id); const panelId = button.props["aria-controls"];
      const panel = elements(tree).find(e => e.props.id === panelId)!;
      expect(button.props.type).toBe("button"); expect(button.props["aria-expanded"]).toBe(false);
      expect(panel.props.hidden).toBe(true); expect(panel.props["aria-labelledby"]).toBe(button.props.id);
      expect(React.Children.count(panel.props.children)).toBeGreaterThan(0);
      button.props.onClick(); const opened = render(props);
      expect(buttonIn(opened, id).props["aria-expanded"]).toBe(true);
      expect(elements(opened).find(e => e.props.id === panelId)!.props.hidden).toBe(false);
      expect(text(byId(opened, "coach-report-urgent-help"))).toContain("Governed help first");
      buttonIn(opened, id).props.onClick(); const closed = render(props);
      expect(buttonIn(closed, id).props.id).toBe(button.props.id);
      expect(elements(closed).find(e => e.props.id === panelId)!.props.hidden).toBe(true);
    }
  });
  it("routine help can open without hiding the primary step", () => {
    const props = setup(); buttonIn(render(props), "coach-report-help").props.onClick();
    expect(buttonIn(render(props), "coach-report-help").props["aria-expanded"]).toBe(true);
    expect(text(byId(render(props), "coach-report-next"))).toContain("First exact step");
  });
  it("Keep/Edit slots remain present and source-associated through action-panel toggles", () => {
    const keep = vi.fn(); const edit = vi.fn();
    const props = setup({ renderKeepAction: (_field, original) => <div className="coach-report__keep"><button onClick={() => keep(original)}>Keep this advice</button><button onClick={() => edit(original)}>Edit</button></div> });
    let tree = render(props); const rows = () => elements(tree).filter(e => e.props.className === "coach-report__save-row");
    expect(rows()).toHaveLength(5);
    for (const row of rows()) expect(elements(tree).some(e => e.props.id === row.props["aria-describedby"])).toBe(true);
    expect(keep).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled();
    buttonIn(tree, "coach-report-actions").props.onClick(); tree = render(props);
    namedButton(rows()[0], "Keep this advice").props.onClick(); expect(keep).toHaveBeenCalledWith("First exact step");
    namedButton(rows()[3], "Edit").props.onClick(); expect(edit).toHaveBeenCalledWith("Exact usable words");
    buttonIn(tree, "coach-report-actions").props.onClick(); tree = render(props); expect(rows()).toHaveLength(5);
    expect(props.onTryIt).not.toHaveBeenCalled(); expect(props.onSaveToPlan).not.toHaveBeenCalled();
  });
  it("removing an earlier absent action preserves remaining row identity and exact source", () => {
    const hidden = new Set<string>();
    const calls = vi.fn((_field: string, original: string) => hidden.has(original) ? null : <div className="coach-report__keep"><button>Keep this advice</button></div>);
    const props = setup({ renderKeepAction: calls });
    const rows = (tree: React.ReactNode) => elements(tree).filter(e => e.props.className === "coach-report__save-row");
    const before = rows(render(props));
    expect(before).toHaveLength(5); expect(calls).toHaveBeenCalledTimes(5);
    hidden.add("First exact step"); calls.mockClear();
    const tree = render(props); const after = rows(tree);
    expect(after).toHaveLength(4); expect(calls).toHaveBeenCalledTimes(5);
    for (const [index, row] of after.entries()) {
      expect(row.key).toBe(before[index + 1].key);
      expect(row.props["aria-describedby"]).toBe(before[index + 1].props["aria-describedby"]);
      expect(row.props["aria-label"]).toBe(before[index + 1].props["aria-label"]);
    }
    expect(text(elements(tree).find(e => e.props.id === after[0].props["aria-describedby"]))).toBe("Second exact step");
  });

});

describe("document proposals belong to their answer", () => {
  it("prevents rapid duplicate proposals and retains pending state across disclosure close/reopen", async () => {
    const pending = deferred(); const propose = vi.fn(() => pending.promise); const props = setup({ onProposeMemory: propose });
    const button = buttonIn(render(props), "coach-doc-memory"); button.props.onClick(); button.props.onClick();
    expect(propose).toHaveBeenCalledTimes(1); expect(propose).toHaveBeenCalledWith("Document fact");
    expect(buttonIn(render(props), "coach-doc-memory").props.disabled).toBe(true);
    expect(buttonIn(render(props), "coach-doc-memory").props["aria-busy"]).toBe(true);
    buttonIn(render(props), "coach-report-document").props.onClick(); buttonIn(render(props), "coach-report-document").props.onClick();
    pending.resolve(); await settle(); const saved = buttonIn(render(props), "coach-doc-memory");
    expect(saved.props.disabled).toBe(true); expect(text(saved)).toBe("Waiting for your approval"); expect(propose).toHaveBeenCalledTimes(1);
  });
  it("shows failure and allows retry without implying approval", async () => {
    const pending = deferred(); const propose = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined); const props = setup({ onProposeMemory: propose });
    buttonIn(render(props), "coach-doc-memory").props.onClick(); pending.reject(new Error("offline")); await settle(); const failed = render(props);
    expect(text(buttonIn(failed, "coach-doc-memory"))).toBe("Try again");
    expect(elements(failed).some(e => e.props.role === "alert" && text(e).includes("not saved"))).toBe(true);
    buttonIn(failed, "coach-doc-memory").props.onClick(); await settle();
    expect(propose).toHaveBeenCalledTimes(2); expect(text(buttonIn(render(props), "coach-doc-memory"))).toBe("Waiting for your approval");
  });
  it("late success cannot save the same row of another answer or child's identical document", async () => {
    const pending = deferred(); const props = setup({ onProposeMemory: vi.fn(() => pending.promise) });
    buttonIn(render(props), "coach-doc-memory").props.onClick();
    // History/child changes can replace an identical contract at the same host index.
    const otherProps = { ...props, contract: contract(), onProposeMemory: vi.fn(async () => {}) };
    expect(text(buttonIn(render(otherProps), "coach-doc-memory"))).toBe("Save to memory"); pending.resolve(); await settle();
    const other = buttonIn(render(otherProps), "coach-doc-memory"); expect(other.props.disabled).toBe(false); expect(text(other)).toBe("Save to memory");
    other.props.onClick(); await settle(); expect(otherProps.onProposeMemory).toHaveBeenCalledWith("Document fact");
  });
  it("a saved receipt is not reused by a different contract in the same renderer", async () => {
    const props = setup(); buttonIn(render(props), "coach-doc-memory").props.onClick(); await settle();
    expect(text(buttonIn(render(props), "coach-doc-memory"))).toBe("Waiting for your approval");
    expect(text(buttonIn(render({ ...props, contract: contract({ document: { ...doc, suggestedMemory: ["Different fact"] } }) }), "coach-doc-memory"))).toBe("Save to memory");
  });
});

describe("distinct action destinations", () => {
  it("prepares exact teacher, professional and document notes for existing editable audiences", () => {
    const props = setup(); const tree = render(props);
    namedButton(tree, "Teacher note").props.onClick(); byId(tree, "coach-professional-note").props.onClick(); byId(tree, "coach-doc-handoff").props.onClick();
    expect(vi.mocked(props.onAddToHandoff).mock.calls).toEqual([["Teacher exact note"], ["Professional exact note", "pediatrician"], ["Document handoff\n- Document question?", "pediatrician"]]);
    expect(props.onProposeMemory).not.toHaveBeenCalled();
  });
  it("Plan and Go deeper invoke only their respective host callbacks", () => {
    const props = setup(); const tree = render(props); byId(tree, "coach-plan-door").props.onClick(); byId(tree, "coach-go-deeper").props.onClick();
    expect(props.onSaveToPlan).toHaveBeenCalledWith("Possible context"); expect(props.onGoDeeper).toHaveBeenCalledOnce();
    expect(props.onTryIt).not.toHaveBeenCalled(); expect(props.onAddToHandoff).not.toHaveBeenCalled(); expect(props.onProposeMemory).not.toHaveBeenCalled();
  });
  it("Try it, replacement and Undo preserve actions; a completed step cannot be replaced", () => {
    const onTryIt = vi.fn(); const onUndo = vi.fn(); const props = { step: "First exact step", lang: "en" as const, onTryIt, onUndo };
    for (const today of [null, { id: "existing", recommendation: "Other step", status: "accepted" as const }]) elements(CoachTryIt({ ...props, today })).find(e => e.type === "button")!.props.onClick();
    expect(onTryIt.mock.calls).toEqual([["First exact step"], ["First exact step"]]);
    namedButton(CoachTryIt({ ...props, today: { id: "accepted-id", recommendation: "First exact step", status: "accepted" } }), "Undo").props.onClick();
    expect(onUndo).toHaveBeenCalledWith("accepted-id"); expect(CoachTryIt({ ...props, today: { id: "completed-id", recommendation: "Other step", status: "completed" } })).toBeNull();
  });
  it("script copy confirms only success; denial exposes the exact manual-copy fallback", async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied")); vi.stubGlobal("navigator", { clipboard: { writeText } });
    const props = setup(); const script = () => elements(render(props)).find(e => e.props.title === "Say this")!;
    expect(script().props.text).toBe("Exact usable words"); expect(script().props.lang).toBe("en"); script().props.onCopy(); await settle();
    expect(writeText).toHaveBeenLastCalledWith("Exact usable words"); expect(script().props.copied).toBe(true); script().props.onCopy(); await settle(); expect(script().props.copied).toBe(false);
    const fallback = elements(render(props)).find(e => e.type === "textarea")!; expect(fallback.props.value).toBe("Exact usable words"); expect(fallback.props.readOnly).toBe(true);
    const select = vi.fn(); fallback.props.onFocus({ currentTarget: { select } }); expect(select).toHaveBeenCalledOnce();
  });
  it("does not carry a failed copy or late clipboard result into another answer", async () => {
    const pending = deferred();
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockReturnValueOnce(pending.promise);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const props = setup();
    const script = (p: Props) => elements(render(p)).find(e => e.props.title === "Say this")!;
    script(props).props.onCopy(); await settle();
    expect(elements(render(props)).some(e => e.type === "textarea")).toBe(true);
    script(props).props.onCopy();
    const other = { ...props, contract: contract({ parentScript: "Another child's exact words" }) };
    expect(elements(render(other)).some(e => e.type === "textarea")).toBe(false);
    pending.resolve(); await settle();
    expect(script(other).props.copied).toBe(false);
    expect(elements(render(other)).some(e => e.type === "textarea")).toBe(false);
  });

});
