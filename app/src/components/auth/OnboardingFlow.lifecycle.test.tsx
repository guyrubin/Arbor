import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile } from "../../types";
import type { ActionLoopEntry } from "../../actionLoop/model";

// Actual mounted flow/controller/acceptance code, with synthetic profile,
// collection, storage and routing boundaries. No real auth or provider calls.
const h = vi.hoisted(() => ({ at: 0, slots: [] as any[], effects: [] as (() => void)[], uid: "A", lang: "en" as "en" | "he",
  profiles: new Map<string, ChildProfile[]>(), rows: new Map<string, ActionLoopEntry[]>(), hash: "#/setup", destinations: [] as string[],
  add: vi.fn(), update: vi.fn(), write: vi.fn(), selected: vi.fn(), tracked: vi.fn(), profileSession: { active: true }, selection: {},
  draft: vi.fn(), commit: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useRef: (initial: unknown) => { const i = h.at++; return h.slots[i] ??= { current: initial }; },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const i = h.at++, old = h.slots[i]; if (old && deps.every((d, n) => Object.is(d, old.deps[n]))) return;
    const slot = { deps, cleanup: undefined as any }; h.slots[i] = slot;
    h.effects.push(() => { old?.cleanup?.(); slot.cleanup = effect(); });
  },
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => {
  const owner = h.uid, session = h.profileSession;
  return { profiles: h.profiles.get(owner) ?? [], isCurrentSession: () => session.active,
    captureOnboardingLifetime: (childId: string | null) => { const selected = h.selection; return () => session.active && (childId === null || h.selection === selected); }, addChild: (input: unknown, options?: unknown) => h.add(owner, input, options),
    updateChild: (id: string, patch: unknown, options?: unknown) => h.update(owner, id, patch, options), setActiveChild: (id: string) => h.selected(owner, id) };
} }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (childId: string) => {
  const owner = h.uid, key = `${owner}:${childId}`;
  return { items: h.rows.get(key) ?? [], loaded: !!childId, error: false,
    upsert: (row: ActionLoopEntry, options: unknown) => {
      const rows = h.rows.get(key) ?? [], found = rows.findIndex(item => item.id === row.id);
      if (found < 0) rows.push(row); else rows[found] = row;
      h.rows.set(key, rows); return h.write(owner, childId, row, options);
    } };
} }));
vi.mock("../../lib/kpiEvents", () => ({ trackOnboardingCompleted: (...args: unknown[]) => h.tracked(...args) }));
vi.mock("../billing/LegalLinks", () => ({ LegalLinks: () => null }));
// B-SHELL-39: the describe readback's request and writes are the injected
// service; no network here. The default draft fails like a model outage, which
// keeps today's path (every pre-existing case below runs on it unchanged).
vi.mock("../../lib/describeChildClient", () => ({ describeServices: (deps: any) => ({
  profile: deps.profile,
  draft: (input: unknown) => h.draft(input),
  commit: (plan: any) => h.commit(deps, plan),
  undo: async (receipt: any) => { await deps.updateChild(deps.profile().id, receipt.plan.previous); },
}) }));
vi.mock("../behaviors/HardMomentsSection", () => ({ HardMomentGuideContent: () => null }));
import OnboardingFlow, { StepChild, StepDomains, StepReady } from "./OnboardingFlow";

function unmount() { h.slots.forEach(slot => slot?.cleanup?.()); h.slots = []; h.effects = []; h.at = 0; }
function nodes(node: React.ReactNode): React.ReactElement<any>[] {
  if (!React.isValidElement(node)) return [];
  const el = node as React.ReactElement<any>;
  return [el, ...React.Children.toArray(el.props.children).flatMap(nodes)];
}
function render() { h.at = 0; const tree = OnboardingFlow(); h.effects.splice(0).forEach(run => run()); return tree; }
const step = (type: unknown) => nodes(render()).find(el => el.type === type)!.props;
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function deferred() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
async function ready() {
  const about = step(StepChild); about.onEdit({ name: "Noa", birthMonth: "2022-04", languages: ["English"], consent: true });
  about.onNext(); await flush();
  const worry = step(StepDomains); worry.onWorry({ choice: "talking", words: "Our own words", quote: "bus" });
  worry.onNext(); await flush(); return step(StepReady);
}
beforeEach(() => {
  h.at = 0; h.slots = []; h.effects = []; h.uid = "A"; h.lang = "en"; h.profiles.clear(); h.rows.clear(); h.hash = "#/setup"; h.destinations = []; h.profileSession = { active: true }; h.selection = {};
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
  h.add = vi.fn(async (owner: string, input: Omit<ChildProfile, "id">) => {
    const child = { ...input, id: `${owner}-child` }; h.profiles.set(owner, [...(h.profiles.get(owner) ?? []), child]); return child;
  });
  h.update = vi.fn(async (owner: string, id: string, patch: Partial<ChildProfile>) => {
    const child = h.profiles.get(owner)?.find(p => p.id === id); if (!child) return false;
    Object.assign(child, patch); return true;
  });
  h.write = vi.fn(async () => {}); h.selected = vi.fn(); h.tracked = vi.fn();
  h.draft = vi.fn(async () => { throw new Error("model unavailable"); });
  h.commit = vi.fn(async (deps: any, plan: any) => {
    if (Object.keys(plan.patch).length && !(await deps.updateChild(deps.profile().id, plan.patch))) throw new Error("not saved");
    return { plan, memoryIds: [], milestonesBefore: [] };
  });
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Network forbidden"); }));
  vi.stubGlobal("window", { location: { get hash() { return h.hash; }, set hash(value: string) { h.hash = value; h.destinations.push(value); } } });
});
afterEach(() => { unmount(); expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("mounted authored first-run release seam", () => {
  it.each(["en", "he"] as const)("%s: explicit acceptance lands on Now once after one child and confirmed action", async lang => {
    h.lang = lang; const card = await ready(); card.onSubmit(); card.onSubmit(); await flush();
    expect(h.add).toHaveBeenCalledOnce(); expect(h.write).toHaveBeenCalledOnce();
    expect(h.write.mock.calls[0][2]).toMatchObject({ observation: true, recommendation: card.card.recommendation });
    expect(h.write.mock.calls[0][2].outcome).toBeUndefined();
    expect(h.write.mock.calls[0][3]).toEqual({ requireAcknowledgement: true });
    expect(h.profiles.get("A")?.[0]).toMatchObject({ onboardingComplete: true, challenges: ["Our own words"] });
    expect(h.selected).toHaveBeenCalledExactlyOnceWith("A", "A-child");
    expect(h.destinations).toEqual(["#/overview"]); expect(h.tracked).toHaveBeenCalledOnce();
  });
  it("interrupted worry restores the exact draft without creating another child", async () => {
    await ready(); unmount();
    const restored = step(StepReady); expect(restored.state.worry).toMatchObject({ words: "Our own words", quote: "bus", choice: "talking" });
    restored.onSubmit(); await flush(); expect(h.add).toHaveBeenCalledOnce(); expect(h.destinations).toEqual(["#/overview"]);
  });
  it("completion failure stays on the card and retry confirms the same action ID", async () => {
    const card = await ready(), persist = h.update.getMockImplementation()!;
    h.update.mockImplementationOnce(persist).mockImplementationOnce(async () => false);
    card.onSubmit(); await flush(); expect(h.destinations).toEqual([]);
    expect(step(StepReady).state).toMatchObject({ complete: false, error: true });
    step(StepReady).onSubmit(); await flush();
    expect(h.write).toHaveBeenCalledTimes(2); expect(h.write.mock.calls[1][2].id).toBe(h.write.mock.calls[0][2].id);
    expect(h.destinations).toEqual(["#/overview"]); expect(h.add).toHaveBeenCalledOnce();
  });
  it("rapid close/reopen retires the old pending action and only the new accept may finish", async () => {
    const card = await ready(), old = deferred(), newer = deferred();
    h.write.mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
    card.onSubmit(); await flush(); unmount();
    const restored = step(StepReady); restored.onSubmit(); await flush();
    old.resolve(); await flush(); expect(h.destinations).toEqual([]); expect(h.profiles.get("A")?.[0].onboardingComplete).toBe(false);
    newer.resolve(); await flush(); expect(h.destinations).toEqual(["#/overview"]);
    expect(h.write.mock.calls[0][2].id).toBe(h.write.mock.calls[1][2].id); expect(h.add).toHaveBeenCalledOnce();
  });
  it("account A→B→A remount cannot let the original late response complete either session", async () => {
    const card = await ready(), old = deferred(); h.write.mockReturnValueOnce(old.promise);
    card.onSubmit(); await flush(); unmount(); h.uid = "B";
    expect(step(StepChild).state.name).toBe(""); unmount(); h.uid = "A";
    expect(step(StepReady).state.name).toBe("Noa"); old.resolve(); await flush();
    expect(h.destinations).toEqual([]); expect(h.selected).not.toHaveBeenCalled();
    step(StepReady).onSubmit(); await flush(); expect(h.destinations).toEqual(["#/overview"]);
    expect(h.profiles.has("B")).toBe(false); expect(h.add).toHaveBeenCalledOnce();
  });
  it.each(["unmount", "raw-profile-session", "selection-return"] as const)("%s retires every unissued acceptance write after a pending superseded row", async boundary => {
    await ready();
    h.rows.set("A:A-child", [{ id: "today.A-child.2026-10-09", recommendation: "Earlier choice", status: "accepted", source: "coach", capacity: "tiny", acceptedAt: "2026-10-09T08:00:00Z" }]);
    const pending = deferred(); h.write.mockReturnValueOnce(pending.promise);
    step(StepReady).onSubmit(); await flush(); expect(h.write).toHaveBeenCalledOnce();
    if (boundary === "unmount") unmount(); else if (boundary === "selection-return") { h.selection = {}; h.selection = {}; } else h.profileSession.active = false;
    pending.resolve(); await flush();
    expect(h.write).toHaveBeenCalledOnce(); expect(h.destinations).toEqual([]);
    expect(h.profiles.get("A")?.[0].onboardingComplete).toBe(false);
  });

  it("B-SHELL-39 model failure: the words go to challenges[0] exactly as today, with no retry", async () => {
    const card = await ready(); expect(h.draft).toHaveBeenCalledOnce();
    expect(card.state.describe).toMatchObject({ status: "failed", error: "model" });
    expect(h.update.mock.calls.at(-1)![2]).toMatchObject({ challenges: ["Our own words"], onboardingDraft: { words: "Our own words", step: 3 } });
    card.onSubmit(); await flush();
    expect(h.profiles.get("A")?.[0]).toMatchObject({ onboardingComplete: true, challenges: ["Our own words"] });
    expect(h.draft).toHaveBeenCalledOnce();
  });

  it("the acknowledged completion callback navigates before ProfileGate-driven unmount, never twice", async () => {
    const card = await ready();
    const persist = h.update.getMockImplementation()!;
    h.update.mockImplementation(async (owner, id, patch, options: any) => {
      if (patch.onboardingComplete) {
        expect(h.destinations).toEqual([]);
        options.onPersisted();
        expect(h.destinations).toEqual(["#/overview"]);
        const saved = await persist(owner, id, patch, options);
        unmount(); // ProfileGate sees the published completed profile.
        return saved;
      }
      return persist(owner, id, patch, options);
    });
    card.onSubmit(); await flush();
    expect(h.destinations).toEqual(["#/overview"]); expect(h.selected).toHaveBeenCalledOnce();
    expect(h.profiles.get("A")?.[0].onboardingComplete).toBe(true);
  });

});

describe("B-SHELL-39 — 'Tell Arbor about {name}' in step 2", () => {
  const TEXT = "Noa is funny. Mornings are hard, she won't get dressed. Please keep ideas short.";
  async function about() {
    const first = step(StepChild); first.onEdit({ name: "Noa", birthMonth: "2022-04", languages: ["English"], consent: true });
    first.onNext(); await flush(); return step(StepDomains);
  }
  const patches = () => h.update.mock.calls.map(call => call[2]);

  it("Skip writes exactly what today's path writes (and asks nothing)", async () => {
    const worry = await about(); worry.onWorry({ choice: "talking", words: TEXT }); worry.onSkip(); await flush();
    const skipped = patches(); const card = step(StepReady); card.onSubmit(); await flush();
    const skippedAll = patches();
    expect(h.draft).not.toHaveBeenCalled();
    unmount(); h.profiles.clear(); h.rows.clear(); h.update.mockClear(); h.destinations = [];
    const today = await about(); today.onWorry({ choice: "talking", words: "" }); today.onNext(); await flush();
    expect(patches()).toEqual(skipped);
    step(StepReady).onSubmit(); await flush();
    expect(patches().map(p => ({ ...p, onboardingCompletedAt: undefined }))).toEqual(skippedAll.map(p => ({ ...p, onboardingCompletedAt: undefined })));
    expect(JSON.stringify(skippedAll)).not.toContain("Mornings");
  });

  it("readback: nothing is written before Keep these, the raw words never reach the child doc, kept items carry provenance", async () => {
    h.draft = vi.fn(async () => ({ items: [
      { id: "i0", kind: "strength", text: "Is funny", quote: "Noa is funny", op: "add" },
      { id: "i1", kind: "worry", text: "Mornings are hard, won't get dressed", quote: "Mornings are hard, she won't get dressed", op: "add", domainId: "body" },
      { id: "i2", kind: "preference", text: "Keep ideas short", quote: "Please keep ideas short", op: "add" },
    ], nextQuestion: null }));
    const worry = await about(); worry.onWorry({ choice: "nothing", words: TEXT }); worry.onNext(); await flush();
    expect(h.draft).toHaveBeenCalledOnce();
    const card = step(StepReady); expect(card.state.describe.status).toBe("ready"); expect(card.describe).toBeTruthy();
    expect(JSON.stringify(patches())).not.toContain("Mornings");
    expect(h.commit).not.toHaveBeenCalled();
    await card.describe.keep(); await flush();
    expect(h.commit).toHaveBeenCalledOnce();
    const child = h.profiles.get("A")![0];
    expect(child.strengths).toEqual(["Is funny"]); expect(child.challenges).toEqual(["Mornings are hard, won't get dressed"]);
    expect(child.parentPreferences).toEqual([expect.objectContaining({ words: "Keep ideas short", source: "describe", confirmedAt: expect.any(String) })]);
    expect(child.describedItems).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "worry", domainId: "body", source: "describe" })]));
    step(StepReady).onSubmit(); await flush();
    // Completion keeps the kept worry beside today's (empty) one-worry line; the words never landed.
    expect(h.profiles.get("A")![0]).toMatchObject({ onboardingComplete: true, challenges: ["Mornings are hard, won't get dressed"] });
    expect(JSON.stringify(h.profiles.get("A")![0])).not.toContain(TEXT);
  });

  it("Undo after Keep these restores the prior child doc with zero residue", async () => {
    h.draft = vi.fn(async () => ({ items: [{ id: "i0", kind: "focus", text: "Getting dressed", quote: "won't get dressed", op: "add", domainId: "body" }], nextQuestion: null }));
    const worry = await about(); worry.onWorry({ choice: "nothing", words: TEXT }); worry.onNext(); await flush();
    const before = JSON.parse(JSON.stringify(h.profiles.get("A")![0]));
    const card = step(StepReady); await card.describe.keep(); await flush();
    expect(h.profiles.get("A")![0].focusAreas).toHaveLength(1);
    await step(StepReady).describe.undo(); await flush();
    const after = JSON.parse(JSON.stringify(h.profiles.get("A")![0]));
    expect(after).toEqual(before);
  });

  it("the conversation: one question at a time stays in step 2, carries the question and every item so far, and ends in the step-3 readback", async () => {
    h.draft = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: "i0", kind: "worry", text: "Mornings are hard", quote: "Mornings are hard", op: "add" }], nextQuestion: "What helps on a good morning?" })
      .mockResolvedValueOnce({ items: [{ id: "i0", kind: "context", text: "Breakfast before getting dressed", quote: "breakfast before getting dressed", op: "add" }], nextQuestion: null });
    const worry = await about(); worry.onWorry({ choice: "nothing", words: TEXT }); await worry.onNext(); await flush();
    const asking = step(StepDomains);
    expect(asking.state.describe.status).toBe("asking");
    expect(asking.state.describe.thread.map((turn: any) => turn.question)).toEqual(["", "What helps on a good morning?"]);
    expect(JSON.stringify(patches())).not.toContain("Mornings");
    await asking.onAnswer("We do breakfast before getting dressed."); await flush();
    expect(h.draft.mock.calls[1][0]).toMatchObject({ text: "We do breakfast before getting dressed.", question: "What helps on a good morning?", askedQuestions: ["What helps on a good morning?"] });
    expect(h.draft.mock.calls[1][0].keptItems).toEqual([expect.objectContaining({ kind: "worry", words: "Mornings are hard" })]);
    const card = step(StepReady);
    expect(card.state.describe.status).toBe("ready");
    expect(card.state.describe.items.map((i: any) => i.text)).toEqual(["Mornings are hard", "Breakfast before getting dressed"]);
    expect(h.commit).not.toHaveBeenCalled();
  });

  it("Done on an open question goes straight to the readback with no further request", async () => {
    h.draft = vi.fn(async () => ({ items: [{ id: "i0", kind: "strength", text: "Is funny", quote: "Noa is funny", op: "add" }], nextQuestion: "What makes her laugh?" }));
    const worry = await about(); worry.onWorry({ choice: "nothing", words: TEXT }); await worry.onNext(); await flush();
    expect(step(StepDomains).state.describe.status).toBe("asking");
    await step(StepDomains).onFinish(); await flush();
    expect(step(StepReady).state.describe).toMatchObject({ status: "ready" });
    expect(h.draft).toHaveBeenCalledOnce();
  });

  it("crisis words show the escalation card and run no extraction", async () => {
    const worry = await about(); worry.onWorry({ choice: "nothing", words: "Some nights I want to hurt myself." }); worry.onNext(); await flush();
    expect(h.draft).not.toHaveBeenCalled();
    expect(step(StepReady).card.urgent).toBe(true);
  });
});
