import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionPlan } from "../../types";

/* v3 FEAT-07 — Routines on Together (#/practice).
   Part 1 renders the real TogetherView (static markup, the TogetherView.test
   mocks): the pill order, the routines in their own module between the stories
   and the away ideas (v3 F-TOG-1: five modules, still one contract move), the
   filter show/hide, the age window and the "In your plan" state.
   Part 2 runs TogetherRoutines under deterministic hook slots (the
   RoutinesCard.receipt harness) to prove the start flow: one plan, and the
   "In your plan" receipt only after the write resolved. */

const state = vi.hoisted(() => ({
  harness: false, cursor: 0, slots: [] as any[], effects: [] as (() => void)[], dirty: false,
  childProfile: { id: "child-a", name: "Noa", age: 5, interests: [], activeGoals: [] } as Record<string, unknown>,
  lang: "en" as "en" | "he", loaded: true, failed: false,
  actionPlans: [] as ActionPlan[],
  startRoutinePlan: vi.fn(),
  saveMoment: vi.fn(async () => true), setActiveTab: vi.fn(), requestKidMode: vi.fn(), track: vi.fn(),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const memo = (calculate: () => unknown, deps: unknown[]) => {
    const i = state.cursor++, slots = state.slots, prev = slots[i];
    if (!prev || deps.some((d, n) => !Object.is(d, prev.deps[n]))) slots[i] = { deps, value: calculate() };
    return slots[i].value;
  };
  // Real hooks for the static render; numbered slots only in harness mode.
  return { ...actual,
    useState: (initial: any) => {
      if (!state.harness) return actual.useState(initial);
      const i = state.cursor++, slots = state.slots;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], (next: any) => { const value = typeof next === "function" ? next(slots[i]) : next; if (!Object.is(slots[i], value)) { slots[i] = value; state.dirty = true; } }];
    },
    useRef: (initial: any) => { if (!state.harness) return actual.useRef(initial); const i = state.cursor++; return state.slots[i] ??= { current: initial }; },
    useMemo: (calculate: () => unknown, deps: unknown[]) => (state.harness ? memo(calculate, deps) : actual.useMemo(calculate, deps)),
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      if (!state.harness) return actual.useEffect(effect, deps);
      const i = state.cursor++, slots = state.slots, prev = slots[i];
      if (prev && deps.every((d, n) => Object.is(d, prev.deps[n]))) return;
      const slot = { deps, cleanup: undefined as any }; slots[i] = slot;
      state.effects.push(() => { prev?.cleanup?.(); slot.cleanup = effect(); });
    },
  };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ ...state, activeFamilyTopic: null }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: state.loaded, error: state.failed }) }));
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: () => {
  const collection = { items: [], loaded: state.loaded, error: state.failed };
  return { speech: collection, mimic: collection, adventures: collection, events: collection, missions: collection };
} }));
vi.mock("../../lib/kidExitRecap", () => ({ SINCE_LAST_PLAY_FALLBACK_MS: 7 * 86400000 }));
vi.mock("../../lib/kidModeGate", () => ({ lastKidSessionStartedAt: () => null }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: state.requestKidMode, step: null }) }));
vi.mock("../kidmode/parentGate", () => ({ readParentPin: () => null }));
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPlaceOpen: vi.fn(), trackPracticeStudioOpen: vi.fn(), trackPracticeTogetherDid: vi.fn() }));
vi.mock("../../lib/analytics", async (original) => ({ ...(await original<typeof import("../../lib/analytics")>()), track: state.track }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));

import TogetherView from "./TogetherView";
import TogetherRoutines from "./TogetherRoutines";
import RoutineRunSheet from "./RoutineRunSheet";
import RoutineRunBoard from "../plans/RoutineRunBoard";
import { writeTogetherView } from "./togetherNavigation";
import { PendingLine, Receipt } from "../ui/Receipt";
import { translate } from "../../lib/i18n";
import { routineById } from "../../lib/routines";
import { routineDayKey, routineToPlan, toggleRoutineStep } from "../../lib/routineTemplates";

type El = React.ReactElement<Record<string, any>>;
const BANNED = /\bstars?\b|כוכב|Feeds|Kid Mode|%/;
/** Copy as renderToStaticMarkup escapes it. */
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const tr = (lang: "en" | "he", key: string, vars?: Record<string, string | number>) => esc(translate(lang, key, vars));

beforeEach(() => {
  vi.clearAllMocks();
  state.harness = false; state.cursor = 0; state.slots = []; state.effects = []; state.dirty = false;
  state.childProfile = { id: "child-a", name: "Noa", age: 5, interests: [], activeGoals: [] };
  state.lang = "en"; state.loaded = true; state.failed = false; state.actionPlans = [];
  state.startRoutinePlan = vi.fn();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
afterEach(() => {
  state.slots.forEach((slot) => slot?.cleanup?.());
  state.harness = false; state.slots = []; state.effects = [];
  vi.unstubAllGlobals();
});

/* ── Part 1 · the rendered page ─────────────────────────────────────────── */

const page = () => renderToStaticMarkup(<TogetherView />);
const section = (html: string, name: string) => html.match(new RegExp(`<section[^>]*data-module="${name}"[^>]*>`))![0];
/** The routines block: everything inside the together-routines module. */
function routinesBlock(html: string): string {
  const at = html.indexOf('data-testid="together-routines"');
  expect(at, "the routines block renders").toBeGreaterThan(-1);
  return html.slice(at, html.indexOf("</section>", at));
}
const tiles = (html: string) => [...html.matchAll(/data-routine-tile="([a-z-]+)"/g)].map((m) => m[1]);
function filters(html: string) {
  const row = html.match(/<div class="companion-filter-row"[^>]*>([\s\S]*?)<\/div>/)![1];
  return [...row.matchAll(/<button[^>]*class="companion-filter"[^>]*aria-pressed="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => {
    const inner = m[2].match(/<span[^>]*>([a-z_]+)<\/span>([\s\S]*)$/)!;
    return { pressed: m[1] === "true", glyph: inner[1], label: inner[2] };
  });
}

for (const lang of ["en", "he"] as const) describe(`FEAT-07 · Together with routines · ${lang}`, () => {
  beforeEach(() => { state.lang = lang; });

  it("the pills read All together, Games, Stories, Routines, Away from the screen", () => {
    const row = filters(page());
    expect(row.map((f) => f.glyph)).toEqual(["interests", "extension", "auto_stories", "checklist", "wb_sunny"]);
    expect(row.map((f) => f.label)).toEqual([
      "companion.together-view.all-together", "companion.together-view.games", "companion.together-view.stories",
      "companion.together-view.routines", "companion.together-view.away-from-the-screen",
    ].map((key) => tr(lang, key)));
    expect(row.map((f) => f.pressed)).toEqual([true, false, false, false, false]);
    writeTogetherView("child-a", { category: "routines" });
    expect(filters(page()).map((f) => f.pressed)).toEqual([false, false, false, true, false]);
  });

  it("All together: four routine tiles in their own module, after the stories and before the away ideas; 5 modules and 1 move", () => {
    const html = page();
    expect(html.match(/data-module=/g)).toHaveLength(5);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(section(html, "together-routines")).not.toContain("hidden");
    expect(section(html, "together-offscreen")).not.toContain("hidden");
    expect(html).toContain(tr(lang, "companion.together-view.in-everyday-life"));
    expect(html.indexOf('data-module="together-stories"')).toBeLessThan(html.indexOf('data-module="together-routines"'));
    expect(html.indexOf('data-testid="together-routines"')).toBeLessThan(html.indexOf("companion-offscreen-grid"));
    const block = routinesBlock(html);
    expect(block).toContain('data-mode="all"');
    expect(tiles(block)).toHaveLength(4);
    expect(block).toContain(tr(lang, "companion.together-view.routines-kicker"));
    expect(block).toContain(tr(lang, "companion.together-view.routines-title"));
    expect(block).toContain('data-testid="together-routines-all"');
    // The module is named by its own heading.
    const labelledBy = section(html, "together-routines").match(/aria-labelledby="([^"]+)"/)![1];
    expect(block).toContain(`<h2 id="${labelledBy}">`);
    expect(block).not.toMatch(BANNED);
  });

  it("Routines: every routine for a 5-year-old (10, no nap, no potty) and no away cards", () => {
    writeTogetherView("child-a", { category: "routines" });
    const html = page();
    expect(html.match(/data-module=/g)).toHaveLength(5);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(section(html, "together-routines")).not.toContain("hidden");
    expect(section(html, "together-offscreen")).toContain("hidden");
    expect(section(html, "together-stories")).toContain("hidden");
    expect(section(html, "together-games")).toContain("hidden");
    expect(html).toContain(tr(lang, "companion.together-view.routines-kicker"));
    const block = routinesBlock(html);
    expect(block).toContain('data-mode="routines"');
    const ids = tiles(block);
    expect(ids).toHaveLength(10);
    expect(ids).not.toContain("nap");
    expect(ids).not.toContain("potty");
    expect(block).not.toContain('data-testid="together-routines-all"');
    expect(block).not.toMatch(BANNED);
  });

  it("Away from the screen and Stories leave the routines out", () => {
    writeTogetherView("child-a", { category: "offscreen" });
    const away = page();
    expect(away).toContain("companion-offscreen-grid");
    expect(section(away, "together-routines")).toContain("hidden");
    expect(away).not.toContain('data-testid="together-routines"');
    writeTogetherView("child-a", { category: "stories" });
    const stories = page();
    expect(section(stories, "together-offscreen")).toContain("hidden");
    expect(section(stories, "together-routines")).toContain("hidden");
    expect(stories).not.toContain('data-testid="together-routines"');
  });

  it("a routine already in a plan leads, says so, and counts today's run", () => {
    const plan = toggleRoutineStep(routineToPlan(routineById("calm"), lang, "Noa", Date.now() - 86_400_000), routineDayKey(Date.now()), 0);
    const other: ActionPlan = { id: "plan-1759000000000", title: "Calmer mornings", issue: "", phases: [{ name: "", description: "", steps: [{ text: "Lay out clothes", completed: false }] }], scripts: [], successIndicators: [] };
    state.actionPlans = [plan, other];
    const block = routinesBlock(page());
    expect(tiles(block)[0]).toBe("calm");
    expect(block.match(/data-in-plan="true"/g)).toHaveLength(1);
    expect(block.match(/data-testid="together-routine-in-plan"/g)).toHaveLength(1);
    expect(block).toContain(tr(lang, "companion.together-view.routines-in-plan"));
    expect(block).toContain(tr(lang, "elev.plans.routineRun.today", { done: 1, left: routineById("calm").steps.length - 1 }));
    expect(block).not.toMatch(BANNED);
  });
});

describe("FEAT-07 · the age window and the stylesheet", () => {
  const block = (profile: Record<string, unknown>) => { state.childProfile = profile; return tiles(renderToStaticMarkup(<TogetherRoutines mode="routines" />)); };

  it("10 at 60 months, 12 when the age is unknown, nap and potty for a 2-year-old", () => {
    expect(block({ id: "c", name: "Noa", age: 5 })).toHaveLength(10);
    expect(block({ id: "c", name: "Noa" })).toHaveLength(12);
    const toddler = block({ id: "c", name: "Noa", age: 2 });
    expect(toddler).toContain("nap");
    expect(toddler).toContain("potty");
  });

  it("44 px pills, a wrapping grid and logical sides only", () => {
    const experience = readFileSync(new URL("./companionExperience.css", import.meta.url), "utf8");
    expect(experience).toMatch(/\.companion-filter \{[^}]*min-block-size: 44px/);
    const css = readFileSync(new URL("./togetherDiscovery.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.together-routine-grid \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(124px, 1fr\)\)/);
    const feat = css.slice(css.indexOf("v3 FEAT-07"));
    expect(feat.length).toBeGreaterThan(100);
    expect(feat).not.toMatch(/\b(?:left|right)\b|line-clamp|text-overflow|overflow:\s*hidden/);
  });
});

/* ── Part 2 · the start flow under hook slots ───────────────────────────── */

type Write = { plan: ActionPlan; resolve: () => void; reject: (e: unknown) => void };
let writes: Write[];
function elements(node: React.ReactNode): El[] {
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
function render() {
  for (let n = 0; n < 12; n++) {
    state.cursor = 0; state.dirty = false;
    const tree = TogetherRoutines({ mode: "routines" });
    state.effects.splice(0).forEach((effect) => effect());
    if (!state.dirty) return tree;
  }
  throw Error("render did not settle");
}
const tile = (id: string) => elements(render()).find((el) => el.props["data-routine-tile"] === id)!;
const sheet = () => elements(render()).find((el) => el.type === RoutineRunSheet)!;
const inside = (props: Record<string, any>) => elements(RoutineRunSheet(props as Parameters<typeof RoutineRunSheet>[0]));
const find = (tree: El[], id: string) => tree.find((el) => el.props["data-testid"] === id || el.props.testId === id);
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const label = (el: El | undefined) => React.Children.toArray(el?.props.children).filter((c) => typeof c === "string");

for (const lang of ["en", "he"] as const) describe(`FEAT-07 · starting a routine as a plan · ${lang}`, () => {
  beforeEach(() => {
    state.harness = true; state.lang = lang; writes = [];
    state.startRoutinePlan = vi.fn((plan: ActionPlan) => new Promise<void>((resolve, reject) => { writes.push({ plan, resolve, reject }); }));
  });

  it("writes ONE plan; 'In your plan' only after the write resolves", async () => {
    tile("bedtime").props.onClick();
    expect(sheet().props.plan).toBeNull();
    expect(sheet().props.start).toBeNull();
    expect(find(inside(sheet().props), "together-routine-start")).toBeDefined();
    const onStart = sheet().props.onStart;
    onStart(); onStart();
    expect(state.startRoutinePlan).toHaveBeenCalledTimes(1);
    const plan = writes[0].plan;
    expect(plan.id).toMatch(/^plan-routine-bedtime-\d{10,}$/);
    // The store shows the optimistic row before the server acknowledged it.
    state.actionPlans = [plan];
    expect(sheet().props.start.status).toBe("pending");
    expect(sheet().props.plan).toBeNull();
    expect(tile("bedtime").props["data-in-plan"]).toBe("false");
    let tree = inside(sheet().props);
    expect(find(tree, "together-routine-start")!.props.disabled).toBe(true);
    const pending = find(tree, "together-routine-pending")!;
    expect(pending.type).toBe(PendingLine);
    expect(pending.props.active).toBe(true);
    expect(find(tree, "together-routine-started")).toBeUndefined();
    expect(state.track).not.toHaveBeenCalled();

    writes[0].resolve(); await flush();
    expect(sheet().props.start.status).toBe("saved");
    expect(sheet().props.plan).toBe(plan);
    tree = inside(sheet().props);
    const started = find(tree, "together-routine-started")!;
    expect(started.type).toBe(Receipt);
    expect(started.props.children).toBe(translate(lang, "companion.together-view.routines-in-plan"));
    expect(tree.some((el) => el.type === RoutineRunBoard && el.props.plan === plan)).toBe(true);
    expect(find(tree, "together-routine-start")).toBeUndefined();
    expect(tile("bedtime").props["data-in-plan"]).toBe("true");
    expect(state.track).toHaveBeenCalledWith("plan_template_start", { surface: "together", template: "bedtime" });
    sheet().props.onStart();
    expect(state.startRoutinePlan).toHaveBeenCalledTimes(1);
  });

  it("a rejected write offers a retry with the same plan id and never a receipt", async () => {
    tile("calm").props.onClick();
    sheet().props.onStart();
    const plan = writes[0].plan;
    state.actionPlans = [plan];
    writes[0].reject(new Error("offline")); await flush();
    // The store may still show the row until it rolls back: still not in the plan.
    expect(sheet().props.start.status).toBe("failed");
    expect(sheet().props.plan).toBeNull();
    state.actionPlans = [];
    let tree = inside(sheet().props);
    expect(find(tree, "together-routine-failed")!.props.role).toBe("alert");
    expect(find(tree, "together-routine-started")).toBeUndefined();
    expect(label(find(tree, "together-routine-start"))).toContain(translate(lang, "companion.together-view.routines-retry"));
    expect(state.track).not.toHaveBeenCalled();

    sheet().props.onStart();
    expect(writes).toHaveLength(2);
    expect(writes[1].plan.id).toBe(plan.id);
    writes[1].resolve(); await flush();
    // The snapshot has not caught up yet: the start's own plan stands in.
    expect(sheet().props.start.status).toBe("saved");
    expect(sheet().props.plan?.id).toBe(plan.id);
    tree = inside(sheet().props);
    expect(find(tree, "together-routine-started")!.type).toBe(Receipt);
  });

  it("a write that throws before it starts is a failure, not a receipt", async () => {
    state.startRoutinePlan = vi.fn(() => { throw new Error("quota"); });
    tile("goodbye").props.onClick();
    sheet().props.onStart(); await flush();
    expect(sheet().props.start.status).toBe("failed");
    expect(find(inside(sheet().props), "together-routine-started")).toBeUndefined();
    expect(find(inside(sheet().props), "together-routine-failed")).toBeDefined();
  });
});
