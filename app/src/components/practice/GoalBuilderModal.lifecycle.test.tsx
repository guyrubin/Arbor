import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goalTileById, focusGoal, type ActiveGoal } from "../../practice/goalBuilder";
import { translate } from "../../lib/i18n";

// Real picker callbacks under deterministic hook lifetimes, without a browser,
// profile/provider writes, or invented successful persistence.
const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], effects: [] as (() => void)[], dirty: false,
  lang: "en" as "en" | "he", account: "parent-a", child: "child-a", open: true,
  session: {} as object, sessionAccount: "parent-a", attempts: new Map<string, any>(), readGoals: (() => [] as ActiveGoal[]),
  close: vi.fn(), closeDialog: (() => {}) as () => void, save: vi.fn(),
}));
vi.mock("react", async original => {
  const real = await original<typeof import("react")>();
  return { ...real,
    useState: (initial: any) => { const i = h.cursor++, slots = h.slots; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (next: any) => { const value = typeof next === "function" ? next(slots[i]) : next; if (!Object.is(slots[i], value)) { slots[i] = value; h.dirty = true; } }]; },
    useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
    useMemo: (fn: () => unknown) => fn(),
    useEffect: (fn: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, slots = h.slots, old = slots[i]; if (old && deps.every((d, n) => Object.is(d, old.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; slots[i] = slot; h.effects.push(() => { old?.cleanup?.(); slot.cleanup = fn(); }); },
  };
});
vi.mock("../../context/ProfileContext", async () => {
  const { selectFocusGoal } = await vi.importActual<typeof import("../../practice/goalBuilder")>("../../practice/goalBuilder");
  return { useProfile: () => {
    if (h.sessionAccount !== h.account) { h.sessionAccount = h.account; h.session = {}; h.attempts.clear(); }
    const session = h.session;
    return { goalSession: session, getGoalSelection: (id: string) => ({ goals: h.readGoals(), attempt: h.attempts.get(id) }),
      cancelGoalAttempt: (id: string) => { h.attempts.delete(id); },
      saveChildGoal: async (id: string, goal: any, basis: string) => {
        if (h.attempts.get(id)?.status === "pending") return "pending";
        if (JSON.stringify(h.readGoals()) !== basis) return "changed";
        h.attempts.set(id, { status: "pending", goal, basis });
        try {
          const ok = await h.save(selectFocusGoal(h.readGoals(), goal, new Date().toISOString()));
          if (h.session !== session) return "obsolete";
          if (ok) { h.attempts.delete(id); return "saved"; }
        } catch { if (h.session !== session) return "obsolete"; }
        h.attempts.set(id, { status: "failed", goal, basis }); return "failed";
      },
    };
  } };
});
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../hooks/useDialog", () => ({ useDialog: ({ onClose }: { onClose: () => void }) => {
  h.closeDialog = onClose; return { ref: { current: null }, requestClose: onClose, onBackdropClick: onClose };
} }));
vi.mock("react-dom", () => ({ createPortal: (children: React.ReactNode) => children }));
vi.mock("motion/react", () => ({ AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: (_, tag: string) => ({ children, initial, animate, exit, transition, ...props }: any) => React.createElement(tag, props, children) }) }));
import GoalBuilderModal from "./GoalBuilderModal";
const goal = (goalId: string, addedAt: string): ActiveGoal => {
  const tile = goalTileById(goalId)!;
  return { goalId, label: tile.label, domainId: tile.domainId, addedAt };
};
const earlier = goal("transitions", "2026-09-01T00:00:00Z");
const current = goal("early-talking", "2026-10-01T00:00:00Z");
let goals: ActiveGoal[];
type El = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): El[] {
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(elements)];
}
function render() {
  for (let i = 0; i < 12; i++) {
    h.cursor = 0; h.dirty = false;
    const tree = GoalBuilderModal({ open: h.open, onClose: h.close, childId: h.child, childName: "Noa", concernId: "sleep" });
    h.effects.splice(0).forEach(effect => effect());
    if (!h.dirty) return tree;
  }
  throw Error("Picker render did not settle");
}
const byId = (id: string) => { const el = elements(render()).find(e => e.props["data-testid"] === id); expect(el, id).toBeDefined(); return el!; };
const click = (id: string) => byId(id).props.onClick();
const text = () => renderToStaticMarkup(render()).replaceAll("&#x27;", "'");
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const dispose = () => { h.slots.forEach(slot => slot?.cleanup?.()); h.slots = []; h.effects = []; };
const deferred = () => { let resolve!: (ok: boolean) => void; let reject!: (e: Error) => void; const promise = new Promise<boolean>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
beforeEach(() => {
  vi.clearAllMocks(); h.cursor = 0; h.slots = []; h.effects = []; h.dirty = false;
  h.lang = "en"; h.account = "parent-a"; h.child = "child-a"; h.open = true; goals = [earlier, current];
  h.session = {}; h.sessionAccount = h.account; h.attempts.clear(); h.readGoals = () => goals;
  h.save.mockResolvedValue(true); vi.stubGlobal("document", { body: {} });
});
afterEach(() => { dispose(); vi.unstubAllGlobals(); });

for (const lang of ["en", "he"] as const) describe(`One goal picker · ${lang}`, () => {
  beforeEach(() => { h.lang = lang; });
  it("requires explicit replacement, preserves all old goals and appends the selected goal", async () => {
    expect(text()).not.toMatch(/focus|מיקוד/i);
    expect(h.save).not.toHaveBeenCalled();
    click("goal-choice-big-feelings");
    expect(byId("goal-confirm")).toBeDefined();
    expect(text()).toContain(translate(lang, "elev.goal.tile.early-talking"));
    expect(text()).toContain(translate(lang, "elev.goal.tile.big-feelings"));
    expect(h.save).not.toHaveBeenCalled();
    click("goal-save"); await flush();
    expect(h.save).toHaveBeenCalledOnce();
    const saved = h.save.mock.calls[0][0] as ActiveGoal[];
    expect(saved.slice(0, 2)).toEqual(goals); expect(saved).toHaveLength(3);
    expect(focusGoal(saved)?.goalId).toBe("big-feelings"); expect(h.close).toHaveBeenCalledOnce();
  });
  it("keeps concern highlighting unselected and allows first choice only after save", async () => {
    goals = []; expect(elements(render()).some(e => e.props["data-testid"] === "goal-confirm")).toBe(false);
    expect(h.save).not.toHaveBeenCalled();
    click("goal-choice-bedtime-wind-down"); click("goal-save"); await flush();
    expect(h.save.mock.calls[0][0]).toHaveLength(1);
  });
  it("cancel leaves every stored goal unchanged and Earlier is explicitly reselected", async () => {
    click("goal-choice-big-feelings"); const staleSave = byId("goal-save").props.onClick;
    click("goal-cancel"); staleSave(); await flush(); expect(h.save).not.toHaveBeenCalled();
    click("goal-earlier-transitions"); expect(h.save).not.toHaveBeenCalled();
    click("goal-save"); await flush();
    const saved = h.save.mock.calls[0][0] as ActiveGoal[];
    expect(saved).toHaveLength(2); expect(saved[0]).toEqual(current); expect(saved[1]).toMatchObject({ goalId: earlier.goalId, label: earlier.label, domainId: earlier.domainId });
    expect(goals).toEqual([earlier, current]);
  });
  it("waits for a real acknowledgement, blocks repeats, and retains a failed selection for retry", async () => {
    const first = deferred(); h.save.mockReturnValueOnce(first.promise);
    click("goal-choice-big-feelings"); const submit = byId("goal-save").props.onClick;
    submit(); submit(); expect(h.save).toHaveBeenCalledOnce();
    expect(byId("goal-save").props.disabled).toBe(true); expect(h.close).not.toHaveBeenCalled();
    first.resolve(false); await flush();
    expect(h.close).not.toHaveBeenCalled(); expect(text()).toContain(translate(lang, "elev.goal.modal.saveError"));
    expect(byId("goal-save").props.disabled).toBe(false);
    click("goal-save"); await flush(); expect(h.save).toHaveBeenCalledTimes(2); expect(h.close).toHaveBeenCalledOnce();
  });
  it("handles rejected writes without installing an unacknowledged goal", async () => {
    h.save.mockRejectedValueOnce(Error("offline"));
    click("goal-choice-big-feelings"); click("goal-save"); await flush();
    expect(text()).toContain(translate(lang, "elev.goal.modal.saveError")); expect(h.close).not.toHaveBeenCalled();
    h.save.mockResolvedValueOnce(false);
    click("goal-save"); await flush(); render(); expect(h.close).not.toHaveBeenCalled();
    click("goal-save"); await flush(); expect(h.close).toHaveBeenCalledOnce();
    expect(h.save.mock.calls.at(-1)![0]).toHaveLength(3);
  });
});

describe("picker owner and interruption boundaries", () => {
  it("close/reopen restores pending state without letting an old acknowledgement close the new dialog", async () => {
    const pending = deferred(); h.save.mockReturnValueOnce(pending.promise);
    click("goal-choice-big-feelings"); const oldSubmit = byId("goal-save").props.onClick; oldSubmit();
    h.closeDialog(); expect(h.close).toHaveBeenCalledOnce();
    h.open = false; render(); h.open = true; render();
    expect(byId("goal-save").props.disabled).toBe(true);
    oldSubmit(); pending.resolve(true); await flush();
    expect(h.save).toHaveBeenCalledOnce(); expect(h.close).toHaveBeenCalledOnce();
  });
  it.each(["child", "account"] as const)("%s A→B→A retires callbacks and pending acknowledgements", async field => {
    const pending = deferred(); h.save.mockReturnValueOnce(pending.promise);
    click("goal-choice-big-feelings"); const oldSubmit = byId("goal-save").props.onClick; oldSubmit();
    const original = h[field]; h[field] = `${field}-b`; render(); h[field] = original; render();
    oldSubmit(); pending.resolve(true); await flush();
    expect(h.save).toHaveBeenCalledOnce(); expect(h.close).not.toHaveBeenCalled();
    click("goal-choice-taking-turns"); click("goal-save"); await flush(); expect(h.save).toHaveBeenCalledTimes(2); expect(h.close).toHaveBeenCalledOnce();
  });
  it("unmount/reopen keeps the old completion out of the new picker", async () => {
    const pending = deferred(); h.save.mockReturnValueOnce(pending.promise);
    click("goal-choice-big-feelings"); click("goal-save"); dispose(); render();
    pending.resolve(true); await flush(); expect(h.close).not.toHaveBeenCalled();
  });
  it("a changed source asks for the new replacement before writing and keeps concurrent goals", async () => {
    click("goal-choice-big-feelings");
    goals = [...goals, goal("taking-turns", "2026-10-08T00:00:00Z")];
    click("goal-save"); await flush(); expect(h.save).not.toHaveBeenCalled();
    expect(text()).toContain(translate("en", "elev.goal.tile.taking-turns"));
    click("goal-save"); await flush();
    expect(h.save.mock.calls[0][0].slice(0, 3)).toEqual(goals);
  });
});
