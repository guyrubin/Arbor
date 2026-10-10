import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { isObservationAction } from "../actionLoop/model";
import { answeredToday, fromRecordEntry, fromRecordRowId, type FromRecordOpener } from "../lib/today/fromRecord";
const source = ts.createSourceFile("ArborContext.tsx", readFileSync("src/context/ArborContext.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let declaration = "";
const visit = (node: ts.Node) => { if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "recordFromRecordAnswer")) declaration = node.getText(source); ts.forEachChild(node, visit); }; visit(source);
const opener: FromRecordOpener = { key: "note:n", kind: "note", topic: null, quote: "The parent's exact words.", quoteAt: "2026-07-09", quoteSource: "parent" };
function setup(upsert = vi.fn(async () => {})) {
  const env = { actionLoopCol: { upsert, confirmed: true }, actionLoop: [] as any[], childProfile: { id: "a" }, currentChildRef: { current: "a" }, recordWritesRef: { current: new Map() }, answeredToday, fromRecordEntry, fromRecordRowId, track: vi.fn(), setRecordAnswerWrites: vi.fn() };
  const code = ts.transpileModule(`${declaration}; return recordFromRecordAnswer;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return { ...env, call: new Function(...Object.keys(env), code)(...Object.values(env)) as (opener: FromRecordOpener, answer: string, at?: Date) => Promise<void> };
}
describe("actual record write seam", () => {
  it("returns a persistence promise and serializes repeated answers to one row", async () => {
    let resolve!: () => void; const pending = new Promise<void>(yes => { resolve = yes; });
    const h = setup(vi.fn(() => pending)); const at = new Date(2026, 9, 12, 8);
    const one = h.call(opener, "easier", at), two = h.call(opener, "hard_again", at);
    expect(one).toBeInstanceOf(Promise); expect(h.actionLoopCol.upsert).toHaveBeenCalledTimes(1);
    expect(h.actionLoopCol.upsert).toHaveBeenCalledWith(expect.any(Object), { awaitServer: true });
    expect(h.track).not.toHaveBeenCalled(); resolve(); await Promise.all([one, two]);
    expect(h.track).toHaveBeenCalledTimes(1); await h.call(opener, "other", at); expect(h.actionLoopCol.upsert).toHaveBeenCalledTimes(1);
  });
  it("surfaces failures without success tracking, then permits retry", async () => {
    const h = setup(vi.fn().mockRejectedValueOnce(Error("quota")).mockResolvedValueOnce(undefined));
    await expect(h.call(opener, "easier")).rejects.toThrow("quota"); expect(h.track).not.toHaveBeenCalled();
    h.actionLoop.push(fromRecordEntry(opener, "easier", "a")); // rejected optimistic snapshot has not rolled back yet
    await h.call(opener, "easier"); expect(h.actionLoopCol.upsert).toHaveBeenCalledTimes(2); expect(h.track).toHaveBeenCalledTimes(1);
  });
  it("refuses a new daily write until the initial answer ledger is confirmed", async () => {
    const h = setup(); h.actionLoopCol.confirmed = false;
    await expect(h.call(opener, "easier")).rejects.toThrow("not confirmed"); expect(h.actionLoopCol.upsert).not.toHaveBeenCalled();
    h.actionLoopCol.confirmed = true; await h.call(opener, "easier"); expect(h.actionLoopCol.upsert).toHaveBeenCalledOnce();
  });
  it("will not execute a callback captured for an old child", async () => {
    const h = setup(); h.currentChildRef.current = "b";
    await expect(h.call(opener, "easier")).rejects.toThrow(); expect(h.actionLoopCol.upsert).not.toHaveBeenCalled();
  });
});

describe("chosen outcome acknowledgement remains opt-in", () => {
  it("forwards strict acknowledgement only for receipt callers and waits through delayed rejection", async () => {
    let outcomeDeclaration = "";
    const find = (node: ts.Node) => { if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "saveTodayOutcome")) outcomeDeclaration = node.getText(source); ts.forEachChild(node, find); }; find(source);
    let reject!: (error: unknown) => void;
    const pending = new Promise<void>((_yes, no) => { reject = no; });
    const env = { isObservationAction, actionLoop: [{ id: "step", source: "coach" }], actionLoopCol: { upsert: vi.fn(() => pending) }, setPlanStepStatus: vi.fn(), planStepStatusAfter: vi.fn(), track: vi.fn(), todayOutcomeProps: vi.fn() };
    const code = ts.transpileModule(`${outcomeDeclaration}; return saveTodayOutcome;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const call = new Function(...Object.keys(env), code)(...Object.values(env));
    const save = call("step", "helped", "card", undefined, { awaitServer: true });
    expect(env.actionLoopCol.upsert).toHaveBeenCalledWith(expect.objectContaining({ outcome: "helped" }), { awaitServer: true });
    expect(env.track).not.toHaveBeenCalled(); const rejected = expect(save).rejects.toThrow("rules"); reject(Error("rules")); await rejected;
    env.actionLoopCol.upsert.mockImplementation(async () => {}); await call("step", "not_today");
    expect(env.actionLoopCol.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "not_today" }), undefined);
  });
});
