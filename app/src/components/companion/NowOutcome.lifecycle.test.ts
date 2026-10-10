import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { isObservationAction } from "../../actionLoop/model";
const text = readFileSync("src/components/companion/NowView.tsx", "utf8");
const source = ts.createSourceFile("NowView.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let declaration = "";
const visit = (node: ts.Node) => { if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "saveOutcome")) declaration = node.getText(source); ts.forEachChild(node, visit); }; visit(source);
function setup(observation = false) {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const lease = { key: "child:topic-a" };
  const env = { action: { id: "step-a", source: observation ? "onboarding" : "coach", ...(observation ? { observation: true, recommendation: "The full question and details" } : {}) }, isObservationAction, retryAction: null, scopeLease: lease, currentOutcomeScope: { current: lease }, savingAction: { current: new Map() }, completedAction: { current: new Set() }, outcomeMounted: { current: true }, refreshSaving: vi.fn(), setSaveError: vi.fn(), setReceiptAction: vi.fn(), setRetryAction: vi.fn(), saveTodayOutcome: vi.fn(() => pending), saveTodayObservation: vi.fn((_id: string, words: string) => pending.then(() => ({ id: "step-a", source: "onboarding", observation: true, recommendation: "The full question and details", whatHappened: words, status: "completed" }))) };
  const code = ts.transpileModule(`${declaration}; return saveOutcome;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return { ...env, resolve, reject, call: new Function(...Object.keys(env), code)(...Object.values(env)) as (value: string | { whatHappened: string }) => Promise<void> };
}
describe("chosen outcome callback ownership", () => {
  it("uses a new lease on every scope transition, including topic A→B→A", async () => {
    expect(text).toContain('currentOutcomeScope.current.key !== outcomeScope');
    expect(text).toContain('currentOutcomeScope.current = { key: outcomeScope, action };');
    const h = setup(); const save = h.call("helped");
    h.currentOutcomeScope.current = { key: "child:topic-b" }; h.currentOutcomeScope.current = { key: "child:topic-a" };
    h.resolve(); await save; expect(h.setReceiptAction).not.toHaveBeenCalled();
    await h.call("not_today"); expect(h.saveTodayOutcome).toHaveBeenCalledTimes(1);
  });
  it("deduplicates rapid taps and keeps a retry after rejection without a receipt", async () => {
    const h = setup(); const save = h.call("helped"); await h.call("not_today"); expect(h.saveTodayOutcome).toHaveBeenCalledTimes(1);
    expect(h.saveTodayOutcome).toHaveBeenCalledWith("step-a", "helped", "card", undefined, { awaitServer: true });
    h.reject(Error("rules")); await save; expect(h.setReceiptAction).not.toHaveBeenCalled(); expect(h.setRetryAction).toHaveBeenCalledOnce(); expect(h.setSaveError).toHaveBeenLastCalledWith(true);
  });
  it("does not update disposed state after unmount", async () => {
    const h = setup(); const save = h.call("helped"); h.outcomeMounted.current = false;
    const calls = h.refreshSaving.mock.calls.length; h.resolve(); await save;
    expect(h.setReceiptAction).not.toHaveBeenCalled(); expect(h.refreshSaving).toHaveBeenCalledTimes(calls);
  });
});


describe("chosen observation callback ownership", () => {
  it("requires explicit nonblank words and cannot dispatch an efficacy outcome", async () => {
    const h = setup(true);
    await h.call("helped"); await h.call({ whatHappened: " " }); await h.call({ whatHappened: "x".repeat(241) });
    expect(h.saveTodayOutcome).not.toHaveBeenCalled(); expect(h.saveTodayObservation).not.toHaveBeenCalled();
  });
  it("deduplicates submits, pins the question, and gives a receipt only after confirmed recording", async () => {
    const h = setup(true); const one = h.call({ whatHappened: "He said bus." });
    await h.call({ whatHappened: "Another moment" });
    expect(h.saveTodayObservation).toHaveBeenCalledOnce(); expect(h.setReceiptAction).not.toHaveBeenCalled();
    expect(h.savingAction.current.get("step-a").action.recommendation).toBe("The full question and details");
    h.resolve(); await one;
    expect(h.setReceiptAction).toHaveBeenCalledWith({ scope: h.scopeLease, action: expect.objectContaining({ whatHappened: "He said bus.", status: "completed" }) });
    expect(h.saveTodayOutcome).not.toHaveBeenCalled();
    await h.call({ whatHappened: "He said bus." }); expect(h.saveTodayObservation).toHaveBeenCalledOnce();
  });
  it("failed recording keeps retry ownership without a receipt or a rating", async () => {
    const h = setup(true); const one = h.call({ whatHappened: "He said bus." });
    h.reject(Error("rules")); await one;
    expect(h.setReceiptAction).not.toHaveBeenCalled(); expect(h.setRetryAction).toHaveBeenCalledWith({ scope: h.scopeLease, action: h.action });
    expect(h.saveTodayOutcome).not.toHaveBeenCalled();
  });
  it.each(["unmount", "scope-return"])("%s retires the callback and its provider continuation", async boundary => {
    const h = setup(true); const one = h.call({ whatHappened: "He said bus." });
    const current = (h.saveTodayObservation.mock.calls[0] as unknown as [string, string, { isCurrent: () => boolean }])[2].isCurrent;
    if (boundary === "unmount") h.outcomeMounted.current = false;
    else { h.currentOutcomeScope.current = { key: "child:topic-b" }; h.currentOutcomeScope.current = { key: "child:topic-a" }; }
    expect(current()).toBe(false); h.resolve(); await one;
    expect(h.setReceiptAction).not.toHaveBeenCalled();
    await h.call({ whatHappened: "He said bus." }); expect(h.saveTodayObservation).toHaveBeenCalledOnce();
  });
});
