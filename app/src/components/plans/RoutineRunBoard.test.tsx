import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionPlan } from "../../types";

/* v3 FEAT-07 — the routine run board (the ONE place a routine plan's steps are
   ticked). The actual component runs under deterministic React hook/effect
   slots (the RoutinesCard.receipt harness): this proves its callbacks, the
   order of write → receipt → celebration, and the props it renders — not
   browser layout. setRoutineRun is a deferred promise the test settles. */

const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], effects: [] as (() => void)[], dirty: false,
  lang: "en" as "en" | "he",
  writes: [] as { plan: ActionPlan; resolve: () => void; reject: (e: unknown) => void }[],
  celebrate: vi.fn(),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const memo = (calculate: () => unknown, deps: unknown[]) => {
    const i = h.cursor++, slots = h.slots, prev = slots[i];
    if (!prev || deps.some((d, n) => !Object.is(d, prev.deps[n]))) slots[i] = { deps, value: calculate() };
    return slots[i].value;
  };
  return { ...actual,
    useState: (initial: any) => { const i = h.cursor++, slots = h.slots; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (next: any) => { const value = typeof next === "function" ? next(slots[i]) : next; if (!Object.is(slots[i], value)) { slots[i] = value; h.dirty = true; } }]; },
    useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
    useMemo: memo, useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, slots = h.slots, prev = slots[i]; if (prev && deps.every((d, n) => Object.is(d, prev.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; slots[i] = slot; h.effects.push(() => { prev?.cleanup?.(); slot.cleanup = effect(); }); },
  };
});
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    setRoutineRun: (plan: ActionPlan) => new Promise<void>((resolve, reject) => { h.writes.push({ plan, resolve, reject }); }),
  }),
}));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../lib/celebrate", () => ({ celebrate: h.celebrate }));

import RoutineRunBoard from "./RoutineRunBoard";
import { PendingLine, Receipt } from "../ui/Receipt";
import { translate } from "../../lib/i18n";
import { localized, routineById } from "../../lib/routines";
import { routineRunToday, routineToPlan, toggleRoutineStep } from "../../lib/routineTemplates";

type El = React.ReactElement<Record<string, any>>;
const NOW = new Date(2026, 9, 12, 8, 0).getTime();
const TODAY = "2026-10-12";
const STAMP = { "data-primary-move": "advance-plan-step", style: { background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)" } };
let seq = 0;
/** A fresh invented routine plan per test (the once-a-day celebration is per plan). */
function routinePlan(ticked: number[] = []): ActionPlan {
  const plan = routineToPlan(routineById("bedtime"), h.lang, "Noa", NOW - 86_400_000 * 3 + ++seq * 1000);
  return ticked.reduce((p, i) => toggleRoutineStep(p, TODAY, i), plan);
}
let props: { plan: ActionPlan; primaryProps?: typeof STAMP; now: number };
/** The component under test (a remount test swaps in a freshly imported module). */
let Board: typeof RoutineRunBoard = RoutineRunBoard;
const bedtimeTitle = (lang: "en" | "he") => localized(routineById("bedtime").title, lang);

function elements(node: React.ReactNode): El[] {
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
function render() {
  for (let n = 0; n < 12; n++) {
    h.cursor = 0; h.dirty = false;
    const tree = Board(props as Parameters<typeof RoutineRunBoard>[0]);
    h.effects.splice(0).forEach((effect) => effect());
    if (!h.dirty) return tree;
  }
  throw Error("render did not settle");
}
function findId(id: string, tree = render()) { return elements(tree).find((el) => el.props["data-testid"] === id || el.props.testId === id); }
function byId(id: string, tree = render()) { const el = findId(id, tree); expect(el, id).toBeDefined(); return el!; }
const tap = (i: number) => byId(`routine-run-step-${i}`).props.onClick();
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function dispose() { h.slots.forEach((slot) => slot?.cleanup?.()); h.slots = []; h.effects = []; }
const steps = () => elements(render()).filter((el) => typeof el.props["data-testid"] === "string" && el.props["data-testid"].startsWith("routine-run-step-"));

beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.dirty = false; h.lang = "en"; h.writes = []; h.celebrate.mockClear();
  Board = RoutineRunBoard;
  props = { plan: routinePlan(), now: NOW };
});
afterEach(() => { dispose(); });

for (const lang of ["en", "he"] as const) describe(`FEAT-07 · the routine run board · ${lang}`, () => {
  beforeEach(() => { h.lang = lang; props = { plan: routinePlan(), now: NOW }; });

  it("the receipt appears only after the deferred write resolves", async () => {
    render();
    expect(findId("routine-run-saved")).toBeUndefined();
    tap(1);
    expect(h.writes).toHaveLength(1);
    expect(routineRunToday(h.writes[0].plan, TODAY)).toEqual([1]);
    // Still on its way: a pending line, never a receipt.
    const pending = byId("routine-run-pending");
    expect(pending.type).toBe(PendingLine);
    expect(pending.props.active).toBe(true);
    expect(findId("routine-run-saved")).toBeUndefined();
    await flush();
    expect(findId("routine-run-saved")).toBeUndefined();
    h.writes[0].resolve(); await flush();
    const saved = byId("routine-run-saved");
    expect(saved.type).toBe(Receipt);
    expect(saved.props.children).toBe(translate(lang, "elev.plans.routineRun.saved"));
    expect(byId("routine-run-pending").props.active).toBe(false);
    expect(byId("routine-run-count").props.children).toBe(translate(lang, "elev.plans.routineRun.today", { done: 1, left: 3 }));
  });

  it("a rejected write shows the retry, never a receipt, and the step reads as not done", async () => {
    render(); tap(0);
    h.writes[0].reject(new Error("offline")); await flush();
    expect(findId("routine-run-saved")).toBeUndefined();
    expect(byId("routine-run-failed").props.role).toBe("alert");
    expect(byId("routine-run-failed").props.children).toBe(translate(lang, "elev.plans.routineRun.failed"));
    expect(byId("routine-run-step-0").props["aria-checked"]).toBe(false);
    // Retry rewrites exactly the failed run, then the receipt follows its ack.
    byId("routine-run-retry").props.onClick();
    expect(h.writes).toHaveLength(2);
    expect(h.writes[1].plan.id).toBe(props.plan.id);
    expect(routineRunToday(h.writes[1].plan, TODAY)).toEqual([0]);
    expect(findId("routine-run-saved")).toBeUndefined();
    h.writes[1].resolve(); await flush();
    expect(byId("routine-run-saved").type).toBe(Receipt);
    expect(findId("routine-run-failed")).toBeUndefined();
  });

  it("celebrates once, on the write that finishes today's run, and only after it resolves", async () => {
    props = { plan: routinePlan([0, 1, 2]), now: NOW };
    render(); tap(3);
    expect(h.celebrate).not.toHaveBeenCalled();
    h.writes[0].resolve(); await flush();
    expect(h.celebrate).toHaveBeenCalledTimes(1);
    expect(h.celebrate).toHaveBeenCalledWith({ kind: "routine" });
    expect(h.writes[0].plan.routineCelebratedOn).toBe(TODAY);
    expect(byId("routine-run-saved").props.children).toBe(translate(lang, "elev.plans.routineRun.doneToday", { routine: bedtimeTitle(lang) }));
    // Unticking and ticking the last step again the same day: no second burst.
    tap(3); h.writes[1].resolve(); await flush();
    tap(3); h.writes[2].resolve(); await flush();
    expect(h.writes).toHaveLength(3);
    expect(h.celebrate).toHaveBeenCalledTimes(1);
  });
});

describe("FEAT-07 · persistence boundaries", () => {
  it("a rejected finishing write never celebrates", async () => {
    props = { plan: routinePlan([0, 1, 2]), now: NOW };
    render(); tap(3); h.writes[0].reject(new Error("denied")); await flush();
    expect(h.celebrate).not.toHaveBeenCalled();
    expect(findId("routine-run-done-today")).toBeUndefined();
  });

  it("an older write resolving late never shows a receipt for the newer one", async () => {
    render(); tap(0); tap(1);
    expect(h.writes).toHaveLength(2);
    // The second write builds on the first (both ticks), not on a stale snapshot.
    expect(routineRunToday(h.writes[1].plan, TODAY)).toEqual([0, 1]);
    h.writes[0].resolve(); await flush();
    expect(findId("routine-run-saved")).toBeUndefined();
    h.writes[1].resolve(); await flush();
    expect(findId("routine-run-saved")).toBeDefined();
  });

  it("a reload (fresh module state, the plan as stored) never celebrates the same day again", async () => {
    props = { plan: routinePlan([0, 1, 2]), now: NOW };
    render(); tap(3);
    // The finishing write carries the celebrated day with the run.
    expect(h.writes[0].plan.routineCelebratedOn).toBe(TODAY);
    h.writes[0].resolve(); await flush();
    expect(h.celebrate).toHaveBeenCalledTimes(1);
    // Reload: the page and this module start over; the plan comes back as stored.
    dispose();
    vi.resetModules();
    Board = (await import("./RoutineRunBoard")).default;
    expect(Board).not.toBe(RoutineRunBoard);
    props = { plan: h.writes[0].plan, now: NOW + 3_600_000 };
    expect(byId("routine-run-step-3").props["aria-checked"]).toBe(true);
    tap(3); h.writes[1].resolve(); await flush();
    tap(3); h.writes[2].resolve(); await flush();
    expect(routineRunToday(h.writes[2].plan, TODAY)).toEqual([0, 1, 2, 3]);
    expect(h.celebrate).toHaveBeenCalledTimes(1);
  });

  it("a day already celebrated on another device never celebrates here", async () => {
    props = { plan: { ...routinePlan([0, 1, 2]), routineCelebratedOn: TODAY }, now: NOW };
    render(); tap(3);
    expect(h.writes[0].plan.routineCelebratedOn).toBe(TODAY);
    h.writes[0].resolve(); await flush();
    expect(h.celebrate).not.toHaveBeenCalled();
    expect(byId("routine-run-saved").props.children).toBe(translate("en", "elev.plans.routineRun.doneToday", { routine: bedtimeTitle("en") }));
  });

  it("the days line reads the stored record: it moves only after the write resolved", async () => {
    props = { plan: routinePlan([0, 1, 2]), now: NOW };
    expect(findId("routine-run-days")).toBeUndefined();
    tap(3);
    expect(findId("routine-run-days")).toBeUndefined(); // on its way
    h.writes[0].reject(new Error("offline")); await flush();
    expect(findId("routine-run-days")).toBeUndefined(); // not saved
    byId("routine-run-retry").props.onClick();
    expect(h.writes[1].plan.routineCelebratedOn).toBe(TODAY);
    expect(findId("routine-run-days")).toBeUndefined();
    h.writes[1].resolve(); await flush();
    expect(byId("routine-run-days").props.children).toBe(translate("en", "elev.plans.routineRun.days.one"));
    expect(h.celebrate).toHaveBeenCalledTimes(1);
  });

  it("runs older than the last two weeks never count, even before a write prunes them", () => {
    const full = [0, 1, 2, 3];
    props = { plan: { ...routinePlan(), routineRuns: { "2026-09-12": full, "2026-09-17": full, "2026-09-22": full } }, now: NOW };
    expect(findId("routine-run-days")).toBeUndefined();
    props = { plan: { ...routinePlan(), routineRuns: { "2026-09-22": full, "2026-09-29": full } }, now: NOW };
    expect(byId("routine-run-days").props.children).toBe(translate("en", "elev.plans.routineRun.days.one"));
  });

  it("the done-for-today line names the routine in the reader's language, not the one it was started in", async () => {
    h.lang = "en";
    const started = routinePlan([0, 1, 2]);
    expect(started.title).toBe(bedtimeTitle("en"));
    h.lang = "he";
    props = { plan: started, now: NOW };
    render(); tap(3); h.writes[0].resolve(); await flush();
    expect(byId("routine-run-saved").props.children).toBe(translate("he", "elev.plans.routineRun.doneToday", { routine: bedtimeTitle("he") }));
    expect(String(byId("routine-run-saved").props.children)).not.toContain(started.title);
  });

  it("a write that resolves after the board is gone changes nothing", async () => {
    props = { plan: routinePlan([0, 1, 2]), now: NOW };
    render(); tap(3); dispose();
    h.writes[0].resolve(); await flush();
    expect(h.celebrate).not.toHaveBeenCalled();
  });

  it("the next local day starts at zero; step.completed is never written", async () => {
    props = { plan: routinePlan([0, 1, 2, 3]), now: NOW + 86_400_000 };
    expect(byId("routine-run-count").props.children).toBe(translate("en", "elev.plans.routineRun.today", { done: 0, left: 4 }));
    expect(byId("routine-run-days").props.children).toBe(translate("en", "elev.plans.routineRun.days.one"));
    tap(0);
    expect(h.writes[0].plan.phases.flatMap((ph) => ph.steps).every((s) => s.completed === false)).toBe(true);
  });
});

describe("FEAT-07 · the rows and the contract stamp", () => {
  it("every row is a 44 px switch with its state, and the count is counts only", () => {
    props = { plan: routinePlan([0]), now: NOW };
    const rows = steps();
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.type).toBe("button");
      expect(row.props.role).toBe("switch");
      expect(typeof row.props["aria-checked"]).toBe("boolean");
      expect(row.props.style.minBlockSize).toBe("var(--touch-min)");
    }
    expect(rows.map((r) => r.props["aria-checked"])).toEqual([true, false, false, false]);
    const count = String(byId("routine-run-count").props.children);
    expect(count).not.toMatch(/%|\{\w+\}\s*(of|\/|מתוך)\s*\{\w+\}|\d+\s*(of|\/|מתוך)\s*\d+/);
  });

  it("the host's stamp lands on the first step still to do, and moves with it", () => {
    props = { plan: routinePlan([0]), primaryProps: STAMP, now: NOW };
    const stamped = () => steps().filter((r) => r.props["data-primary-move"] === "advance-plan-step").map((r) => r.props["data-testid"]);
    expect(stamped()).toEqual(["routine-run-step-1"]);
    expect(byId("routine-run-step-1").props.style.background).toBe("var(--arbor-gradient-primary)");
    tap(1);
    expect(stamped()).toEqual(["routine-run-step-2"]);
    // Without a host stamp the board carries no move at all.
    dispose(); props = { plan: routinePlan(), now: NOW };
    expect(steps().some((r) => "data-primary-move" in r.props)).toBe(false);
  });

  it("the file never names a contract move itself, and holds no share or bar", () => {
    const src = readFileSync(new URL("./RoutineRunBoard.tsx", import.meta.url), "utf8");
    expect(src).not.toContain("data-primary-move");
    // No module-level memory: once-a-day lives on the plan, not in this session.
    expect(src).not.toMatch(/^(?:const|let|var)\s+\w+\s*=\s*new\s+(?:Set|Map)\b/m);
    expect(src).not.toMatch(/ProgressBar|progressbar|Math\.round\([^)]*100|%`|toFixed/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(src).not.toMatch(/\b(?:margin|padding)(?:Left|Right)\b|\b(?:left|right):/);
  });
});
