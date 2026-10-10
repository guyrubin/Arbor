import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
const text = readFileSync("src/components/companion/NowView.tsx", "utf8");
const source = ts.createSourceFile("NowView.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let declaration = "";
const visit = (node: ts.Node) => { if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "saveOutcome")) declaration = node.getText(source); ts.forEachChild(node, visit); }; visit(source);
function setup() {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const lease = { key: "child:topic-a" };
  const env = { action: { id: "step-a" }, retryAction: null, scopeLease: lease, currentOutcomeScope: { current: lease }, savingAction: { current: new Map() }, completedAction: { current: new Set() }, outcomeMounted: { current: true }, refreshSaving: vi.fn(), setSaveError: vi.fn(), setReceiptAction: vi.fn(), setRetryAction: vi.fn(), saveTodayOutcome: vi.fn(() => pending) };
  const code = ts.transpileModule(`${declaration}; return saveOutcome;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return { ...env, resolve, reject, call: new Function(...Object.keys(env), code)(...Object.values(env)) as (value: string) => Promise<void> };
}
describe("chosen outcome callback ownership", () => {
  it("uses a new lease on every scope transition, including topic A→B→A", async () => {
    expect(text).toContain('if (currentOutcomeScope.current.key !== outcomeScope) currentOutcomeScope.current = { key: outcomeScope };');
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
