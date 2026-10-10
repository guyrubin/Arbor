import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Actual component callbacks, deterministic hook lifetimes, and controlled write
// promises. This is offline contract evidence, not real Firestore/browser QA.
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], effects: [] as (() => void)[], disposed: false,
  child: "a", topic: "topic-a" as string | null, lang: "en" as "en" | "he", aiLang: "en", confirmed: true, acceptScopeRef: { current: { writer: null as any, sequence: 0 } }, loop: [] as any[], write: vi.fn(), toast: vi.fn() }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: any) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial; return [h.slots[i], (next: any) => { if (h.disposed) throw Error("setState after unmount"); h.slots[i] = typeof next === "function" ? next(h.slots[i]) : next; }]; },
  useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, prev = h.slots[i]; if (prev && deps.every((d, n) => Object.is(d, prev.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; h.slots[i] = slot; h.effects.push(() => { prev?.cleanup?.(); slot.cleanup = effect(); }); },
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.child, name: "Noa", age: 5 }, activeFamilyTopic: h.topic ? { id: h.topic } : null, actionLoop: h.loop, actionLoopConfirmed: h.confirmed, acceptTodayAction: h.write, selectedLens: null, setSelectedLens: vi.fn() }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.lang, aiLang: h.aiLang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) };
});
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: h.toast }) }));
import FamilyFormation from "./FamilyFormation";
import RitualTurnCard from "../nextopen/RitualTurnCard";
import { PendingLine, Receipt } from "../ui/Receipt";
import { FAMILY_RITUALS } from "../../lib/familyRituals";
import { translate } from "../../lib/i18n";
import { CoachTryIt } from "../coach/CoachAnswerCards";
import { settleOrQueue } from "../../lib/firestoreWrite";
import { acceptTodayAction as persistAcceptedTodayAction } from "../../actionLoop/accept";
import { activeActionFor, planAcceptedAction, todayActionId } from "../../actionLoop/model";

type El = React.ReactElement<Record<string, any>>;
const ritual = FAMILY_RITUALS[0], other = FAMILY_RITUALS[1];
const store = new Map<string, string>();
function elements(node: React.ReactNode): El[] {
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
const effects = () => h.effects.splice(0).forEach(fn => fn());
const render = () => { h.cursor = 0; const result = FamilyFormation(); effects(); return result; };
const turn = (tree = render()) => elements(tree).find(el => el.type === RitualTurnCard)!;
function library(r = ritual, tree = render()) {
  elements(tree).find(el => el.props["aria-controls"] === `ritual-${r.id}`)!.props.onClick();
  return elements(render()).find(el => el.props["data-testid"] === `ritual-start-${r.id}`)!;
}
const feedback = (r = ritual) => {
  const tree = render();
  // The turn and library use the same renderer, keeping feedback beside Start.
  return turn(tree).props.startFeedback?.(r) as React.ReactNode;
};
const receipt = (r = ritual) => elements(feedback(r)).find(el => el.type === Receipt);
const retry = (r = ritual) => elements(feedback(r)).find(el => el.props["data-testid"] === `ritual-retry-${r.id}`);
function deferred() { let resolve!: () => void, reject!: (error: unknown) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function isolated<T>(fn: () => T) { const prev = { cursor: h.cursor, slots: h.slots, effects: h.effects }; h.cursor = 0; h.slots = []; h.effects = []; try { return fn(); } finally { Object.assign(h, prev); } }
function expectReceipt(r = ritual) {
  const line = receipt(r); expect(line).toBeDefined();
  expect(line!.props.children).toBe(translate(h.lang, "elev.learnCare.ritual.added"));
  expect(line!.props.announce).not.toBe(false);
  expect(line!.props.link).toMatchObject({ href: "#/overview", where: translate(h.lang, "nav.today") });
  const markup = isolated(() => renderToStaticMarkup(line!));
  expect(markup).toContain('data-receipt="muted"');
  expect(markup).toContain(`dir="${h.lang === "he" ? "rtl" : "ltr"}"`);
  expect(markup).toContain(`lang="${h.lang}"`);
  expect(markup).not.toMatch(/role="status"|aria-live/); // shared announcer, not two live regions
}
beforeEach(() => { h.cursor = 0; h.slots = []; h.effects = []; h.disposed = false; h.child = "a"; h.topic = "topic-a"; h.lang = "en"; h.aiLang = "en"; h.confirmed = true; h.acceptScopeRef = { current: { writer: null, sequence: 0 } }; h.loop = []; h.write = vi.fn(); h.toast = vi.fn(); store.clear(); vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

for (const lang of ["en", "he"] as const) describe(`Family ritual receipt · ${lang}`, () => {
  beforeEach(() => { h.lang = lang; h.aiLang = lang; });
  it("keeps the first-step/tiny/provenance contract; only acknowledged acceptance gets a receipt", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise);
    const selected = other;
    const start = library(selected).props.onClick; const saving = start(); start();
    expect(h.write).toHaveBeenCalledTimes(1);
    expect(h.write).toHaveBeenCalledWith((lang === "he" ? selected.stepsHe : selected.steps)[0].trim(), "tiny", "family-ritual", undefined, expect.objectContaining({ awaitServer: true }));
    expect(receipt()).toBeUndefined(); expect(h.toast).not.toHaveBeenCalled();
    expect(turn().props.startDisabled).toBe(true);
    const optimistic = { id: "pending", source: "family-ritual", recommendation: (lang === "he" ? selected.stepsHe : selected.steps)[0].trim() };
    h.confirmed = false; h.loop = [optimistic]; expect(turn().props.started(selected)).toBe(false);
    pending.resolve(); await saving; expectReceipt(selected); expect(turn().props.started(selected)).toBe(true);
    expect(elements(render()).some(el => el.type === Receipt)).toBe(true);
    await start(); expect(h.write).toHaveBeenCalledTimes(1); expect(h.toast).not.toHaveBeenCalled();
  });
  it("both turn-card Start and settled Plan next wait without announcing success", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise);
    const host = turn(); const saving = host.props.onStart(ritual);
    const pendingHost = turn(); expect(pendingHost.props.startDisabled).toBe(true);
    const due = isolated(() => RitualTurnCard(pendingHost.props));
    expect(elements(due).find(el => el.props["data-testid"] === "ritual-turn-start")!.props.disabled).toBe(true);
    expect(elements(due).some(el => el.type === PendingLine)).toBe(true);
    store.set("arbor.familyRituals.practised", JSON.stringify(Object.fromEntries(FAMILY_RITUALS.map(r => [r.id, Date.now()]))));
    const settled = isolated(() => RitualTurnCard(pendingHost.props));
    expect(elements(settled).find(el => el.props["data-testid"] === "ritual-plan-next")!.props.disabled).toBe(true);
    expect(elements(settled).some(el => el.type === PendingLine)).toBe(true);
    pending.resolve(); await saving; expectReceipt();
  });
  it("rejects failed writes honestly and permits retry despite an optimistic row", async () => {
    const pending = deferred(); h.write.mockReturnValueOnce(pending.promise);
    const saving = turn().props.onStart(ritual);
    h.loop = [{ id: "unconfirmed", source: "family-ritual", recommendation: (lang === "he" ? ritual.stepsHe : ritual.steps)[0].trim() }];
    pending.reject(Error("rules")); await saving;
    expect(receipt()).toBeUndefined(); expect(turn().props.started(ritual)).toBe(false);
    expect(elements(feedback()).find(el => el.props.role === "alert")!.props.children).toBe(translate(lang, "elev.learnCare.ritual.failed"));
    expect(retry()!.props.children).toBe(translate(lang, "elev.learnCare.ritual.retry"));
    h.write.mockResolvedValue(undefined); await retry()!.props.onClick(); expectReceipt();
    expect(h.write).toHaveBeenCalledTimes(2); expect(h.toast).not.toHaveBeenCalled();
  });
});

describe("ritual feedback and source lifetime", () => {
  it("uses the real PendingLine delay: quiet through 399 ms, visible at 400 ms, no success after six seconds", async () => {
    vi.useFakeTimers(); const pending = deferred(); h.write.mockReturnValue(pending.promise);
    const saving = turn().props.onStart(ritual); const line = elements(feedback()).find(el => el.type === PendingLine)!;
    expect(line.props.active).toBe(true);
    const prior = { cursor: h.cursor, slots: h.slots, effects: h.effects }; h.slots = []; h.effects = [];
    const draw = () => { h.cursor = 0; const tree = PendingLine(line.props as any); effects(); return tree; };
    expect(draw()).toBeNull(); await vi.advanceTimersByTimeAsync(399); expect(draw()).toBeNull();
    await vi.advanceTimersByTimeAsync(1); expect(draw()!.props["data-pending"]).toBe("");
    await vi.advanceTimersByTimeAsync(5600); Object.assign(h, prior); expect(receipt()).toBeUndefined();
    pending.resolve(); await saving; expectReceipt();
  });
  it("same-render different-ritual taps cannot overlap writes or replace the pending feedback", async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise); const onStart = turn().props.onStart;
    const saving = onStart(ritual); await onStart(other); expect(h.write).toHaveBeenCalledOnce();
    pending.resolve(); await saving; await onStart(ritual); expect(h.write).toHaveBeenCalledOnce();
    h.write.mockResolvedValue(undefined); await turn().props.onStart(other); expectReceipt(other);
    expect(h.write).toHaveBeenCalledTimes(2);
  });
  it("never reconstructs an action receipt from existing ledger rows or changes the local charter/cadence", () => {
    h.loop = [{ source: "family-ritual", recommendation: ritual.steps[0].trim() }];
    store.set("arbor.familyRituals.practised", '{"truth-practice-weekly":123}');
    expect(turn().props.started(ritual)).toBe(true); expect(receipt()).toBeUndefined();
    expect(h.write).not.toHaveBeenCalled(); expect(h.toast).not.toHaveBeenCalled();
    expect(store).toEqual(new Map([["arbor.familyRituals.practised", '{"truth-practice-weekly":123}']]));
  });
  for (const change of ["child", "topic", "lang", "aiLang"] as const) for (const outcome of ["resolve", "reject"] as const) {
    it(`retires ${outcome} and captured callbacks across ${change} A→B→A`, async () => {
      const pending = deferred(); h.write.mockReturnValue(pending.promise); const start = turn().props.onStart; const saving = start(ritual);
      const original = h[change]; (h as any)[change] = change === "lang" || change === "aiLang" ? "he" : "b";
      expect(receipt()).toBeUndefined(); expect(turn().props.startDisabled).not.toBe(true);
      (h as any)[change] = original; render(); if (outcome === "reject") pending.reject(Error("late")); else pending.resolve(); await saving;
      expect(receipt()).toBeUndefined(); expect(retry()).toBeUndefined(); await start(other); expect(h.write).toHaveBeenCalledOnce();
    });
  }
  it("retires an already-drawn receipt and an old retry callback on a scope change", async () => {
    h.write.mockResolvedValueOnce(undefined); await turn().props.onStart(ritual); expectReceipt();
    h.topic = "topic-b"; expect(receipt()).toBeUndefined();
    h.write.mockRejectedValueOnce(Error("rules")); await turn().props.onStart(other);
    const oldRetry = retry(other)!.props.onClick;
    h.topic = "topic-a"; expect(receipt()).toBeUndefined(); await oldRetry(); expect(h.write).toHaveBeenCalledTimes(2);
    h.topic = "topic-b"; expect(retry(other)).toBeUndefined(); await oldRetry(); expect(h.write).toHaveBeenCalledTimes(2);
  });
  it("keeps a failed ritual retryable after a different ritual succeeds", async () => {
    h.write.mockRejectedValueOnce(Error("rules")); await turn().props.onStart(ritual);
    h.loop = [{ source: "family-ritual", recommendation: ritual.steps[0].trim() }];
    h.write.mockResolvedValue(undefined); await turn().props.onStart(other); expectReceipt(other);
    expect(turn().props.started(ritual)).toBe(false); await retry()!.props.onClick(); expectReceipt();
    expect(h.write).toHaveBeenCalledTimes(3);
  });
  for (const outcome of ["resolve", "reject"] as const) it(`retires late ${outcome} on unmount`, async () => {
    const pending = deferred(); h.write.mockReturnValue(pending.promise); const start = turn().props.onStart; const saving = start(ritual);
    h.slots.forEach(slot => slot?.cleanup?.()); h.disposed = true;
    if (outcome === "reject") pending.reject(Error("late")); else pending.resolve(); await saving; await start(other);
    expect(h.write).toHaveBeenCalledOnce(); expect(h.toast).not.toHaveBeenCalled();
  });
});


// Review regressions: pending/rejected snapshot echoes are not saved evidence
// after the presentation lifetime has retired. Exercise actual control props.
describe("confirmed ledger fallback after ritual scope retirement", () => {
  function expectStartAvailable() {
    const host = turn();
    expect(host.props.started(ritual)).toBe(false);
    const button = library();
    expect(button.props.disabled).toBe(false);
    expect(React.Children.toArray(button.props.children)).toContain(translate(h.lang, "elev.learnCare.ritual.start"));
    const due = isolated(() => RitualTurnCard(host.props));
    const dueButton = elements(due).find(el => el.props["data-testid"] === "ritual-turn-start")!;
    expect(dueButton.props.disabled).toBe(false);
    expect(React.Children.toArray(dueButton.props.children)).toContain(translate(h.lang, "elev.rh.ritual.startWeek"));
    // Make this ritual the next due one in the settled presentation.
    store.set("arbor.familyRituals.practised", JSON.stringify(Object.fromEntries(FAMILY_RITUALS.map(r => [r.id, Date.now()]))));
    const settled = isolated(() => RitualTurnCard(host.props));
    const nextButton = elements(settled).find(el => el.props["data-testid"] === "ritual-plan-next")!;
    expect(nextButton.props.disabled).toBe(false);
    expect(React.Children.toArray(nextButton.props.children)).not.toContain(translate(h.lang, "elev.learnCare.ritual.started"));
    expect(receipt()).toBeUndefined();
  }
  for (const lang of ["en", "he"] as const) for (const change of ["topic", "language-return", "remount"] as const) {
    it(`keeps unconfirmed ${lang} controls honest after ${change}`, async () => {
      h.lang = lang; h.aiLang = lang; h.confirmed = false;
      const pending = deferred(); h.write.mockReturnValue(pending.promise);
      const saving = turn().props.onStart(ritual);
      h.loop = [{ id: todayActionId("a"), status: "accepted", source: "family-ritual", recommendation: (lang === "he" ? ritual.stepsHe : ritual.steps)[0].trim() }];
      if (change === "topic") h.topic = "topic-b";
      if (change === "language-return") {
        h.lang = lang === "en" ? "he" : "en"; h.aiLang = h.lang; render();
        h.lang = lang; h.aiLang = lang;
      }
      if (change === "remount") { h.slots.forEach(slot => slot?.cleanup?.()); h.slots = []; h.effects = []; }
      // Assert while still pending; always drain, including failing baselines.
      try { expectStartAvailable(); }
      finally { pending.reject(Error("not acknowledged")); await saving; }
    });
  }
  it("does not promote a rejected echo before rollback when the topic changes", async () => {
    h.confirmed = false; h.write.mockRejectedValueOnce(Error("rules"));
    await turn().props.onStart(ritual);
    h.loop = [{ id: todayActionId("a"), status: "accepted", source: "family-ritual", recommendation: ritual.steps[0].trim() }];
    expect(retry()).toBeDefined(); h.topic = "topic-b";
    expectStartAvailable();
  });
  it("only a confirmed ledger restores the saved label after remount, without inventing a Receipt", () => {
    h.loop = [{ id: todayActionId("a"), status: "accepted", source: "family-ritual", recommendation: ritual.steps[0].trim() }];
    h.confirmed = false; expect(turn().props.started(ritual)).toBe(false);
    h.confirmed = true;
    const button = library();
    expect(button.props.disabled).toBe(true);
    expect(React.Children.toArray(button.props.children)).toContain(translate(h.lang, "elev.learnCare.ritual.started"));
    expect(receipt()).toBeUndefined(); expect(h.write).not.toHaveBeenCalled();
  });
  it("exposes the actual collection confirmation metadata at the context boundary", () => {
    const context = readFileSync("src/context/ArborContext.tsx", "utf8");
    expect(context).toContain("actionLoopConfirmed: actionLoopCol.confirmed");
    expect(context).toMatch(/const actionLoopCol = useChildCollection[\s\S]*?trackConfirmation: true/);
  });
});

describe("actual acceptTodayAction acknowledgement seam", () => {
  const source = ts.createSourceFile("ArborContext.tsx", readFileSync("src/context/ArborContext.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration = "";
  const visit = (node: ts.Node) => { if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "acceptTodayAction")) declaration = node.getText(source); ts.forEachChild(node, visit); }; visit(source);
  function setup(upsert: ReturnType<typeof vi.fn>, loop: any[] = [], topic = "original-topic") {
    if (h.acceptScopeRef.current.writer !== upsert) h.acceptScopeRef.current = { writer: upsert, sequence: 0 };
    const env = { acceptScopeRef: h.acceptScopeRef, acceptScope: h.acceptScopeRef.current, actionLoop: loop, actionLoopCol: { upsert }, childProfile: { id: "a" }, activeFamilyTopic: { id: topic }, planAcceptedAction, todayActionId, persistAcceptedTodayAction, track: vi.fn() };
    const code = ts.transpileModule(`${declaration}; return acceptTodayAction;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return { ...env, call: new Function(...Object.keys(env), code)(...Object.values(env)) };
  }
  it("forwards opt-in acknowledgement to superseded rows and the new first step, in order", async () => {
    const older = { id: todayActionId("a"), status: "accepted", source: "coach", recommendation: "Old step", capacity: "tiny" };
    const superseded = deferred(), entry = deferred(); const upsert = vi.fn().mockReturnValueOnce(superseded.promise).mockReturnValueOnce(entry.promise);
    const env = setup(upsert, [older]); const save = env.call("First step", "tiny", "family-ritual", undefined, { awaitServer: true });
    expect(upsert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ ...older, status: "superseded" }), { awaitServer: true });
    superseded.resolve(); await Promise.resolve(); expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ recommendation: "First step", capacity: "tiny", source: "family-ritual", topicId: "original-topic" }), { awaitServer: true });
    expect(env.track).not.toHaveBeenCalled(); entry.resolve(); await save; expect(env.track).toHaveBeenCalledOnce();
  });
  it("does not write the new entry after a superseding-write rejection; preserves optional plan references", async () => {
    const older = { id: todayActionId("a"), status: "accepted", source: "coach", recommendation: "Old step", capacity: "tiny" };
    const upsert = vi.fn().mockRejectedValueOnce(Error("rules")); const env = setup(upsert, [older]);
    await expect(env.call("First step", "tiny", "family-ritual", undefined, { awaitServer: true })).rejects.toThrow("rules");
    expect(upsert).toHaveBeenCalledOnce(); expect(env.track).not.toHaveBeenCalled();
    const legacy = setup(vi.fn().mockResolvedValue(undefined));
    await legacy.call("Plan step", "standard", "plan", { planId: "plan-a", phaseIdx: 1, stepIdx: 2 });
    expect(legacy.actionLoopCol.upsert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ planId: "plan-a", phaseIdx: 1, stepIdx: 2, source: "plan" }), undefined);
  });
  it("propagates rejection and leaves other accept callers on the original queued-write path", async () => {
    const pending = deferred(); const upsert = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined); const env = setup(upsert);
    const save = env.call("First step", "tiny", "family-ritual", undefined, { awaitServer: true }); const rejected = expect(save).rejects.toThrow("rules");
    pending.reject(Error("rules")); await rejected; expect(env.track).not.toHaveBeenCalled();
    await env.call("Normal", "standard", "coach"); expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ source: "coach" }), undefined);
  });

  for (const change of ["topic", "language-return", "remount"] as const) it(`protects a newer acknowledged ritual from a delayed retired accept after ${change}`, async () => {
    const old = { id: todayActionId("a"), status: "accepted", source: "coach", recommendation: "Old", capacity: "tiny" };
    const firstSupersede = deferred(), saved = new Map<string, any>([[old.id, old]]);
    h.loop = [...saved.values()];
    const upsert = vi.fn((item: any) => {
      saved.set(item.id, item); h.loop = [...saved.values()];
      return upsert.mock.calls.length === 1 ? firstSupersede.promise : Promise.resolve();
    });
    h.write.mockImplementation((...args: any[]) => setup(upsert, h.loop, h.topic!).call(...args));
    const original = turn().props.onStart(ritual);
    expect(upsert).toHaveBeenCalledTimes(1);
    if (change === "topic") h.topic = "topic-b";
    if (change === "language-return") { h.lang = "he"; h.aiLang = "he"; render(); h.lang = "en"; h.aiLang = "en"; }
    if (change === "remount") { h.slots.forEach(slot => slot?.cleanup?.()); h.slots = []; h.effects = []; }
    await turn().props.onStart(other); expectReceipt(other);
    const acknowledged = upsert.mock.calls[1][0];
    firstSupersede.resolve(); await original;
    expect(saved.get(acknowledged.id)?.recommendation).toBe(other.steps[0].trim());
    expect(upsert).toHaveBeenCalledTimes(2);
    expectReceipt(other); expect(receipt(ritual)).toBeUndefined();
  });
  for (const retireAt of [0, 1, 2, 3]) it(`guards every unissued continuation when retired at write ${retireAt}`, async () => {
    const older = (suffix = "") => ({ id: `${todayActionId("a")}${suffix}`, status: "accepted", source: "coach", recommendation: "Old", capacity: "tiny" });
    let current = retireAt !== 0;
    const upsert = vi.fn(async () => { if (upsert.mock.calls.length === retireAt) current = false; });
    const env = setup(upsert, [older(), older(".2")]);
    await expect(env.call("First step", "tiny", "family-ritual", undefined, { awaitServer: true, isCurrent: () => current })).rejects.toThrow("no longer current");
    expect(upsert).toHaveBeenCalledTimes(retireAt);
    expect(env.track).not.toHaveBeenCalled();
    for (const call of upsert.mock.calls as any[]) expect(call[1]).toEqual({ awaitServer: true });
  });


  function crossCallerLedger() {
    vi.stubGlobal("navigator", { onLine: false });
    const older = { id: todayActionId("a"), status: "accepted", source: "coach", recommendation: "Old", capacity: "tiny", acceptedAt: new Date().toISOString() };
    const saved = new Map<string, any>([[older.id, older]]);
    h.loop = [...saved.values()];
    const writes: { item: any; ack: ReturnType<typeof deferred> }[] = [];
    const upsert = vi.fn((item: any, options?: { awaitServer?: boolean }) => {
      saved.set(item.id, item); h.loop = [...saved.values()];
      const ack = deferred(); writes.push({ item, ack });
      return options?.awaitServer ? ack.promise : settleOrQueue(ack.promise);
    });
    // Same provider ref and collection writer survive snapshot rerenders.
    h.write.mockImplementation((...args: any[]) => setup(upsert, h.loop, h.topic!).call(...args));
    const coach = (step: string) => {
      const tree = CoachTryIt({ step, today: activeActionFor(h.loop, todayActionId("a")), lang: "en", onTryIt: text => h.write(text, "standard", "coach"), onUndo: vi.fn() });
      return elements(tree).find(el => el.type === "button")!.props.onClick();
    };
    const drain = async () => {
      for (let i = 0; i < writes.length; i++) {
        writes[i].ack.resolve();
        // Let both the queue wrapper and accept continuation settle before
        // draining any next issued write. Server ack order is never reversed.
        for (let n = 0; n < 6; n++) await Promise.resolve();
      }
    };
    return { saved, writes, upsert, coach, drain };
  }
  it("keeps the newer actual Coach choice while Family stays mounted in the same scope", async () => {
    const ledger = crossCallerLedger();
    const family = turn().props.onStart(ritual);
    expect(ledger.writes).toHaveLength(1);
    const familyScope = h.write.mock.calls[0][4].isCurrent;
    render(); await ledger.coach("Newer Coach step");
    expect(familyScope()).toBe(true); expect(ledger.writes).toHaveLength(2);
    const newer = ledger.writes[1].item;
    await ledger.drain(); await family;
    expect(ledger.saved.get(newer.id)?.recommendation).toBe("Newer Coach step");
    expect(ledger.writes).toHaveLength(2);
    expect(receipt()).toBeUndefined(); expect(retry()).toBeDefined();
  });
  it("observes ignored legacy cancellations without turning their returned Promise into success", async () => {
    const ledger = crossCallerLedger();
    const older = ledger.coach("Older Coach step"); // live callback has no catch
    const newer = ledger.coach("Newer Coach step");
    await ledger.drain(); await newer;
    // One event-loop turn without a caller catch: a rejected legacy event
    // promise must not escape as an unhandled rejection. Vitest guards this.
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(older).rejects.toThrow("no longer current");
    expect(ledger.writes).toHaveLength(2);
    expect([...ledger.saved.values()].some(row => row.recommendation === "Older Coach step")).toBe(false);
    expect([...ledger.saved.values()].some(row => row.recommendation === "Newer Coach step")).toBe(true);
    expect(ledger.upsert.mock.calls.every(call => call[1] === undefined)).toBe(true);
  });
  it("keeps a newer acknowledged Family choice over an older fire-and-forget Coach request", async () => {
    const ledger = crossCallerLedger();
    const older = ledger.coach("Older Coach step");
    const family = turn().props.onStart(ritual);
    await ledger.drain(); await family;
    await expect(older).rejects.toThrow("no longer current");
    expectReceipt(); expect(ledger.writes).toHaveLength(2);
    expect([...ledger.saved.values()].some(row => row.recommendation === "Older Coach step")).toBe(false);
  });
  it("does not revive the older choice when the newer request fails", async () => {
    const first = deferred();
    const upsert = vi.fn().mockReturnValueOnce(first.promise).mockRejectedValueOnce(Error("rules"));
    const env = setup(upsert);
    const older = env.call("Older", "tiny", "family-ritual", undefined, { awaitServer: true });
    const olderFailure = expect(older).rejects.toThrow("no longer current");
    const newer = env.call("Newer", "standard", "coach");
    await expect(newer).rejects.toThrow("rules");
    first.resolve(); await olderFailure;
    expect(env.track).not.toHaveBeenCalled(); expect(upsert).toHaveBeenCalledTimes(2);
  });
  it("a retired collection callback cannot cancel the current collection's pending accept", async () => {
    const old = setup(vi.fn().mockResolvedValue(undefined));
    const pending = deferred(), upsert = vi.fn().mockReturnValue(pending.promise);
    const current = setup(upsert);
    const saving = current.call("Current child step", "tiny", "family-ritual", undefined, { awaitServer: true });
    await expect(old.call("Old child step", "standard", "coach")).rejects.toThrow("no longer current");
    expect(old.actionLoopCol.upsert).not.toHaveBeenCalled();
    pending.resolve(); await expect(saving).resolves.toBeUndefined();
    expect(current.track).toHaveBeenCalledOnce();
  });

});
