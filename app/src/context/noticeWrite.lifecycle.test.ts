import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { buildMomentLog } from "../content/behaviorTaxonomy";
import { observeMilestoneDoc } from "../lib/milestones/observe";
import type { BehaviorLog, Milestone } from "../types";

// Exercise the actual context closures with storage replaced, avoiding a full
// app mount and all unrelated subscriptions/AI capabilities in this lifecycle test.
const sourceText = readFileSync("src/context/ArborContext.tsx", "utf8");
const source = ts.createSourceFile("ArborContext.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function closure(name: string, env: Record<string, unknown>): any {
  let found = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name)) found = node.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source); expect(found).not.toBe("");
  const js = ts.transpileModule(`${found}; return ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(env), js)(...Object.values(env));
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const milestone: Milestone = { id: "same-record", domain: "language_communication", title: "Two words", description: "What to notice", ageGroup: "2 years", checked: false };
const acknowledged = { requireAcknowledgement: true };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T12:00:00.000Z")); });
afterEach(() => { vi.useRealTimers(); });

describe("the actual context milestone acknowledgement seam", () => {
  it("returns the acknowledged writer promise for both answer and exact Undo", async () => {
    const write = deferred();
    const env = { milestones: [milestone], milestonesCol: { upsert: vi.fn(() => write.promise) }, observeMilestoneDoc };
    const answer = closure("setMilestoneObservation", env), undo = closure("restoreMilestone", env);
    let done = false;
    const pending = answer(milestone.id, "yes", { now: "2026-10-18T12:00:00.000Z" }, acknowledged).then(() => { done = true; });
    await Promise.resolve(); expect(done).toBe(false);
    expect(env.milestonesCol.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: milestone.id, checked: true, observationStatus: "yes" }), acknowledged);
    write.resolve(); await pending;
    await undo(milestone, acknowledged);
    expect(env.milestonesCol.upsert).toHaveBeenLastCalledWith(milestone, acknowledged);
  });
  it("missing sources and rejected persistence cannot resolve as a saved answer or Undo", async () => {
    const env = { milestones: [] as Milestone[], milestonesCol: { upsert: vi.fn() }, observeMilestoneDoc };
    await expect(closure("setMilestoneObservation", env)(milestone.id, "yes", {}, acknowledged)).rejects.toThrow("no longer available");
    await expect(closure("restoreMilestone", env)(milestone, acknowledged)).rejects.toThrow("no longer available");
    expect(env.milestonesCol.upsert).not.toHaveBeenCalled();
    env.milestones.push(milestone); env.milestonesCol.upsert.mockRejectedValue(Error("rules"));
    await expect(closure("restoreMilestone", env)(milestone, acknowledged)).rejects.toThrow("rules");
  });
});

function momentHarness() {
  const upsert = vi.fn<(row: BehaviorLog, opts?: unknown) => Promise<void>>().mockResolvedValue();
  const captureScope = { childId: "child-a", writer: upsert, momentRetries: new Map<string, BehaviorLog>(), momentWrites: new Set<string>() };
  const env = {
    childProfile: { id: "child-a" }, buildMomentLog,
    captureScope, captureScopeRef: { current: captureScope }, captureWritesRef: { current: new Set<string>() },
    logsCol: { upsert }, track: vi.fn(), trackCaptureSaved: vi.fn(), toast: vi.fn(), t: (key: string) => key,
  };
  return { ...env, call: closure("addMoment", env) as (text: string, opts?: Record<string, unknown>) => Promise<BehaviorLog | null> };
}

describe("Tonight's opt-in moment continuation", () => {
  const opts = { ...acknowledged, retryKey: "tonight:today:practice", shelf: "words", milestoneId: milestone.id };
  it("awaits acknowledgement and retries the same record ID after rejection, including a corrected draft", async () => {
    const h = momentHarness(), write = deferred(); h.logsCol.upsert.mockReturnValueOnce(write.promise);
    let complete = false; const pending = h.call("She said bus.", opts).then(row => { complete = true; return row; });
    await Promise.resolve(); expect(complete).toBe(false); expect(h.trackCaptureSaved).not.toHaveBeenCalled();
    expect(h.logsCol.upsert.mock.calls[0][1]).toEqual(acknowledged);
    const first = h.logsCol.upsert.mock.calls[0][0];
    write.reject(Error("not confirmed")); await expect(pending).resolves.toBeNull();
    expect(h.toast).toHaveBeenCalledOnce();
    vi.setSystemTime(new Date("2026-10-18T13:00:00.000Z"));
    const saved = await h.call("She said blue bus.", opts);
    expect(saved).toMatchObject({ id: first.id, timestamp: first.timestamp, trigger: "She said blue bus.", shelf: "words", milestoneId: milestone.id });
    expect(saved).not.toHaveProperty("retryKey"); expect(saved).not.toHaveProperty("requireAcknowledgement");
    expect(h.logsCol.upsert).toHaveBeenCalledTimes(2); expect(h.trackCaptureSaved).toHaveBeenCalledOnce();
    expect(h.captureScope.momentRetries.size).toBe(0);
  });
  it("blocks duplicate in-flight continuations without changing the acknowledged document", async () => {
    const h = momentHarness(), write = deferred(); h.logsCol.upsert.mockReturnValueOnce(write.promise);
    const pending = h.call("First draft", opts);
    await expect(h.call("Second tap", opts)).resolves.toBeNull();
    expect(h.logsCol.upsert).toHaveBeenCalledOnce(); write.resolve(); await pending;
    vi.setSystemTime(new Date("2026-10-18T13:00:00.000Z"));
    const next = await h.call("A separate later moment", opts);
    expect(next!.id).not.toBe(h.logsCol.upsert.mock.calls[0][0].id);
  });
  it.each(["scope", "unmount"] as const)("does not confirm or toast an old %s continuation", async boundary => {
    const h = momentHarness(), write = deferred(); h.logsCol.upsert.mockReturnValueOnce(write.promise);
    let current = true;
    const pending = h.call("One moment", { ...opts, isCurrent: () => current });
    if (boundary === "scope") h.captureScopeRef.current = { ...h.captureScope };
    else current = false;
    write.resolve(); await expect(pending).resolves.toBeNull();
    expect(h.trackCaptureSaved).not.toHaveBeenCalled(); expect(h.toast).not.toHaveBeenCalled();
    await expect(h.call("A stale retry", { ...opts, isCurrent: () => current })).resolves.toBeNull();
    expect(h.logsCol.upsert).toHaveBeenCalledOnce();
  });
  it("preserves ordinary queued-write callers' existing defaults", async () => {
    const h = momentHarness();
    const saved = await h.call("A regular moment");
    expect(saved?.trigger).toBe("A regular moment");
    expect(h.logsCol.upsert.mock.calls[0][1]).toBeUndefined();
    expect(h.captureScope.momentRetries.size).toBe(0);
  });
});
