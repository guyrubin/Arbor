import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { completeObservation, isObservationAction, type ActionLoopEntry } from "../actionLoop/model";
const text = readFileSync("src/context/ArborContext.tsx", "utf8");
const source = ts.createSourceFile("ArborContext.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name: string) {
  let found = "";
  const visit = (node: ts.Node) => { if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === name)) found = node.getText(source); ts.forEachChild(node, visit); }; visit(source);
  expect(found).not.toBe(""); return found;
}
const row: ActionLoopEntry = { id: "today.a.2026-10-10", source: "onboarding", capacity: "tiny", status: "accepted", acceptedAt: "2026-10-10T10:00:00Z", recommendation: "What happened with Noa today?", observation: true };
function setup() {
  let resolve!: () => void, reject!: (reason: unknown) => void;
  const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const scope = { sequence: 0 };
  const env = { actionLoop: [row] as ActionLoopEntry[], actionLoopCol: { upsert: vi.fn(() => pending) }, acceptScopeRef: { current: scope }, acceptScope: scope, observationAcceptSequence: 0,
    observationLifetime: vi.fn(() => true), completeObservation };
  const code = ts.transpileModule(`${declaration("saveTodayObservation")}; return saveTodayObservation;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const call = new Function(...Object.keys(env), code)(...Object.values(env)) as (id: string, words: string, options?: { isCurrent: () => boolean }) => Promise<ActionLoopEntry>;
  return { ...env, call, resolve, reject };
}
describe("actual observation write acknowledgement/lifetime seam", () => {
  it("writes the same ID and full original question, waits for acknowledgement, and returns no efficacy outcome", async () => {
    const h = setup(); let done = false;
    const promise = h.call(row.id, "He said bus.").then(value => { done = true; return value; });
    expect(h.actionLoopCol.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: row.id, recommendation: row.recommendation, whatHappened: "He said bus.", status: "completed" }), { awaitServer: true });
    await Promise.resolve(); expect(done).toBe(false); h.resolve();
    const saved = await promise; expect(saved.outcome).toBeUndefined(); expect(saved.outcomeAt).toBeUndefined(); expect(saved.completedAt).toBeDefined();
  });
  it.each(["owner", "selection", "unmount", "new-choice"] as const)("%s retirement refuses stale starts and acknowledgements", async boundary => {
    const h = setup(); let current = true;
    const promise = h.call(row.id, "A moment", { isCurrent: () => current });
    if (boundary === "new-choice") h.acceptScope.sequence++;
    if (boundary === "owner") h.acceptScopeRef.current = { sequence: 0 };
    if (boundary === "selection") h.observationLifetime.mockReturnValue(false);
    if (boundary === "unmount") current = false;
    const rejected = expect(promise).rejects.toThrow("no longer current"); h.resolve(); await rejected;
    await expect(h.call(row.id, "Another moment", { isCurrent: () => current })).rejects.toThrow("no longer current");
    expect(h.actionLoopCol.upsert).toHaveBeenCalledOnce();
  });
  it("rejects a failed acknowledgement and retries an optimistic same-ID completion through a fresh barrier", async () => {
    const h = setup(); const promise = h.call(row.id, "A moment"); const rejected = expect(promise).rejects.toThrow("rules");
    h.reject(Error("rules")); await rejected;
    h.actionLoop[0] = completeObservation(row, "A moment");
    h.actionLoopCol.upsert.mockImplementation(async () => {});
    const saved = await h.call(row.id, "A moment");
    expect(saved.id).toBe(row.id); expect(h.actionLoopCol.upsert).toHaveBeenCalledTimes(2);
  });
  it("does not let the ordinary outcome seam rate an observation", async () => {
    const env = { actionLoop: [row], actionLoopCol: { upsert: vi.fn() }, isObservationAction };
    const code = ts.transpileModule(`${declaration("saveTodayOutcome")}; return saveTodayOutcome;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const call = new Function(...Object.keys(env), code)(...Object.values(env));
    await expect(call(row.id, "helped")).rejects.toThrow("not an efficacy outcome");
    expect(env.actionLoopCol.upsert).not.toHaveBeenCalled();
  });
});
