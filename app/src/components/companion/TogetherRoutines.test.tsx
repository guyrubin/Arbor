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
  compact: false,
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
// v3 F-TOG-3: RoutineRunSheet (and the preview) pick `useCompactSurface() ? Sheet : Modal`. The
// hook-slot harness calls RoutineRunSheet as a plain function, so the seam is a plain value here.
vi.mock("../ui/Sheet", () => ({ Sheet: () => null, useCompactSurface: () => state.compact }));

import TogetherView from "./TogetherView";
import TogetherRoutines from "./TogetherRoutines";
import RoutineRunSheet from "./RoutineRunSheet";
import RoutineRunBoard from "../plans/RoutineRunBoard";
import { writeTogetherView } from "./togetherNavigation";
import { PendingLine, Receipt } from "../ui/Receipt";
import { Modal } from "../ui/Modal";
import { Sheet } from "../ui/Sheet";
import { translate } from "../../lib/i18n";
import { localized, routineById } from "../../lib/routines";
import { routineDayKey, routineTemplatesForAge, routineToPlan, toggleRoutineStep } from "../../lib/routineTemplates";
import { RHYTHM_SLOTS, ROUTINE_SLOT, routineSlot, todaysRhythm } from "./togetherRhythm";

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
  state.compact = false;
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
/** v4: the filters are label-only pills (Routines · Play · Stories). */
function filters(html: string) {
  const row = html.match(/<div class="companion-filter-row together-pills"[^>]*>([\s\S]*?)<\/div>/)![1];
  return [...row.matchAll(/<button[^>]*class="companion-filter"[^>]*aria-pressed="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ pressed: m[1] === "true", label: m[2] }));
}
const DAY = () => routineDayKey(Date.now());
/** A routine started yesterday (the epoch keeps the plan id valid), with `ticks` of today's steps ticked. */
function started(id: string, lang: "en" | "he", ticks: number[] = []): ActionPlan {
  let plan = routineToPlan(routineById(id), lang, "Noa", Date.now() - 86_400_000);
  for (const i of ticks) plan = toggleRoutineStep(plan, DAY(), i);
  return plan;
}
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

for (const lang of ["en", "he"] as const) describe(`v4 · Together's Routines · ${lang}`, () => {
  beforeEach(() => { state.lang = lang; });

  // v4 re-pin (was: All together · Games · Stories · Routines · Away from the screen).
  it("the pills read Routines, Play, Stories; Routines is the default", () => {
    const row = filters(page());
    expect(row.map((f) => f.label)).toEqual(["routines", "play", "stories"].map((k) => tr(lang, `companion.together-view.${k}`)));
    expect(row.map((f) => f.pressed)).toEqual([true, false, false]);
    writeTogetherView("child-a", { category: "games" });
    expect(filters(page()).map((f) => f.pressed)).toEqual([false, true, false]);
  });

  it("nothing started: the filter is the library itself — every routine for a 5-year-old (10, no nap, no potty); 5 modules and 1 move", () => {
    const html = page();
    expect(html.match(/data-module=/g)).toHaveLength(5);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(section(html, "together-routines")).not.toContain("hidden");
    for (const name of ["together-offscreen", "together-stories", "together-games"]) expect(section(html, name), name).toContain("hidden");
    const block = routinesBlock(html);
    expect(block).toContain('data-mode="library"');
    const ids = tiles(block);
    expect(ids).toHaveLength(10);
    expect(ids).not.toContain("nap");
    expect(ids).not.toContain("potty");
    expect(block).toContain(tr(lang, "companion.together-view.routines-kicker"));
    expect(block).toContain(tr(lang, "companion.together-view.routines-title"));
    // No rhythm, no tally and no "Add a routine" before anything is started.
    for (const id of ["together-rhythm", "together-rhythm-tally", "together-rhythm-add", "together-rhythm-why"]) expect(block, id).not.toContain(`data-testid="${id}"`);
    // The module is named by its own heading.
    const labelledBy = section(html, "together-routines").match(/aria-labelledby="([^"]+)"/)![1];
    expect(block).toContain(`<h2 id="${labelledBy}">`);
    expect(block).not.toMatch(BANNED);
  });

  it("Play and Stories leave the routines out", () => {
    writeTogetherView("child-a", { category: "games" });
    const play = page();
    expect(play).toContain("companion-offscreen-grid");
    expect(section(play, "together-routines")).toContain("hidden");
    expect(play).not.toContain('data-testid="together-routines"');
    writeTogetherView("child-a", { category: "stories" });
    const stories = page();
    expect(section(stories, "together-offscreen")).toContain("hidden");
    expect(section(stories, "together-routines")).toContain("hidden");
    expect(stories).not.toContain('data-testid="together-routines"');
  });

  it("a started routine turns the filter into Today's rhythm: its card counts today's ticks, names the next step and leads as Next up", () => {
    const plan = started("calm", lang, [0]);
    const other: ActionPlan = { id: "plan-1759000000000", title: "Calmer mornings", issue: "", phases: [{ name: "", description: "", steps: [{ text: "Lay out clothes", completed: false }] }], scripts: [], successIndicators: [] };
    state.actionPlans = [plan, other];
    const block = routinesBlock(page());
    expect(block).toContain('data-mode="rhythm"');
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-title"));
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-sub", { name: "Noa" }));
    // Only the started routine is in the rhythm; a plan not started from a routine never is.
    expect(tiles(block)).toEqual(["calm"]);
    expect(block.match(/data-in-plan="true"/g)).toHaveLength(1);
    const calm = routineById("calm");
    expect(block.match(/data-ticked="true"/g)).toHaveLength(1);
    expect(block.match(/data-ticked="false"/g)).toHaveLength(calm.steps.length - 1);
    expect(block).toContain(`aria-label="${tr(lang, "companion.together-view.rhythm-steps-aria", { done: 1, total: calm.steps.length })}"`);
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-next-step", { step: localized(calm.steps[1].label, lang) }));
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-slot-anytime"));
    expect(block).toContain(esc(localized(calm.time, lang)));
    expect(block.match(/data-testid="together-rhythm-next-up"/g)).toHaveLength(1);
    // The tally counts routines finished today, in words; "Add a routine" opens the library.
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-done", { done: 0, total: 1 }));
    expect(block).toContain('data-testid="together-rhythm-add"');
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-why", { name: "Noa" }));
    expect(block).toContain('data-brand-chip=');
    // The words a parent reads (the chip's colour mix carries a % inside a style attribute, never in copy).
    expect(block.replace(/<[^>]+>/g, " ")).not.toMatch(BANNED);
    // Never an invented clock time.
    expect(block).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it("the rhythm reads in the order of the day; Next up is the first one not finished; a finished one is checked", () => {
    const morning = routineById("morning");
    state.actionPlans = [started("bedtime", lang), started("meal", lang), started("morning", lang, morning.steps.map((_, i) => i))];
    const block = routinesBlock(page());
    expect(tiles(block)).toEqual(["morning", "meal", "bedtime"]);
    const cards = [...block.matchAll(/data-routine-tile="([a-z-]+)"[^>]*data-next-up="(true|false)"[^>]*data-complete="(true|false)"/g)].map((m) => [m[1], m[2], m[3]]);
    expect(cards).toEqual([["morning", "false", "true"], ["meal", "true", "false"], ["bedtime", "false", "false"]]);
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-all-done"));
    expect(block).toContain(`aria-label="${tr(lang, "companion.together-view.rhythm-done-aria")}"`);
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-done", { done: 1, total: 3 }));
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-slot-morning"));
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-slot-evening"));
    expect(block).toContain(tr(lang, "companion.together-view.rhythm-slot-night"));
  });
});

describe("v4 · the rhythm's order of the day (togetherRhythm)", () => {
  it("every library routine has a part of the day, and the parts run morning → night, then when needed", () => {
    expect(RHYTHM_SLOTS).toEqual(["morning", "midday", "afternoon", "evening", "night", "anytime"]);
    for (const routine of routineTemplatesForAge(null)) expect(Object.keys(ROUTINE_SLOT), routine.id).toContain(routine.id);
    expect(routineSlot("not-a-routine")).toBe("anytime");
  });

  it("a plan whose steps no longer line up with the template reads its own step words", () => {
    const routine = routineById("goodbye");
    const plan = started("goodbye", "en");
    plan.phases[0].steps.push({ text: "An extra step the parent added", completed: false });
    const [card] = todaysRhythm([routine], () => plan, DAY(), "he");
    expect(card.total).toBe(routine.steps.length + 1);
    expect(card.nextStep).toBe(plan.phases[0].steps[0].text);
    expect(card.nextIcon).toBeNull();
    // NEGATIVE CONTROL: aligned, the template's words in the reader's language win.
    const [aligned] = todaysRhythm([routine], () => started("goodbye", "en"), DAY(), "he");
    expect(aligned.nextStep).toBe(localized(routine.steps[0].label, "he"));
  });
});

describe("FEAT-07 · the age window and the stylesheet", () => {
  const block = (profile: Record<string, unknown>) => { state.childProfile = profile; return tiles(renderToStaticMarkup(<TogetherRoutines />)); };

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

  it("v4: the rhythm's stylesheet — tokens and logical sides only, nothing clipped, a mark per step and never a bar or a meter", () => {
    const rhythm = strip(readFileSync(new URL("./togetherRhythm.css", import.meta.url), "utf8"));
    expect(rhythm.length).toBeGreaterThan(1000);
    expect(rhythm).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(rhythm).not.toMatch(/\b(?:margin|padding|border|inset)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)/);
    expect(rhythm).not.toMatch(/line-clamp|text-overflow|overflow:\s*hidden/);
    expect(rhythm).not.toMatch(/progress|meter|%\s*;|width:\s*\d+%/);
    expect(rhythm).toMatch(/\.together-rhythm-add \{[^}]*min-block-size: var\(--touch-min\)/);
    expect(rhythm).toMatch(/\.together-library-item \{[^}]*min-block-size: var\(--touch-min\)/);
    const source = readFileSync(new URL("./TogetherRoutines.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/progressbar|Math\.round\([^)]*100|toFixed/);
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
    const tree = TogetherRoutines({});
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

  it("v3 F-TOG-3: below lg the routine opens as a bottom sheet with its name; the wide answer stays the Modal", () => {
    tile("bedtime").props.onClick();
    const props = sheet().props as Parameters<typeof RoutineRunSheet>[0];
    state.compact = true;
    const compact = RoutineRunSheet(props);
    expect(compact.type).toBe(Sheet);
    expect(compact.props.open).toBe(true);
    expect(compact.props.title).toBe(localized(routineById("bedtime").title, lang));
    expect(compact.props.onClose).toBe(props.onClose);
    expect(find(inside(props), "together-routine-start")).toBeDefined();
    state.compact = false;
    const wide = RoutineRunSheet(props);
    expect(wide.type).toBe(Modal);
    expect(wide.props.title).toBe(localized(routineById("bedtime").title, lang));
  });

  it("v4: Add a routine opens the library (started ones checked); a routine opens its sheet on top of it", () => {
    state.actionPlans = [routineToPlan(routineById("bedtime"), lang, "Noa", Date.now() - 86_400_000)];
    const add = elements(render()).find((el) => el.props["data-testid"] === "together-rhythm-add")!;
    expect(add.props["aria-haspopup"]).toBe("dialog");
    expect(elements(render()).some((el) => el.props["data-testid"] === "together-library")).toBe(false);
    add.props.onClick();
    const library = elements(render());
    const surface = library.find((el) => el.props.title === translate(lang, "companion.together-view.library-title"))!;
    expect(surface.type).toBe(Modal);
    const items = library.filter((el) => el.props["data-library-routine"]);
    expect(items.map((el) => el.props["data-library-routine"])).toHaveLength(10);
    expect(items.filter((el) => el.props["data-in-plan"] === "true").map((el) => el.props["data-library-routine"])).toEqual(["bedtime"]);
    items.find((el) => el.props["data-library-routine"] === "morning")!.props.onClick();
    expect(sheet().props.routine.id).toBe("morning");
    expect(sheet().props.plan).toBeNull();
    // The library stays beneath: closing the routine returns to it.
    expect(elements(render()).some((el) => el.props["data-testid"] === "together-library")).toBe(true);
    sheet().props.onClose();
    expect(elements(render()).some((el) => el.type === RoutineRunSheet)).toBe(false);
    expect(elements(render()).some((el) => el.props["data-testid"] === "together-library")).toBe(true);
    expect(state.startRoutinePlan).not.toHaveBeenCalled();
  });

  it("v4: the routine sheet names the routine with its brand chip beside the why-line", () => {
    tile("bedtime").props.onClick();
    const tree = inside(sheet().props);
    const chip = find(tree, "together-routine-chip")!;
    expect(chip.props.icon).toBe(routineById("bedtime").ms);
    expect(chip.props.tone).toBe("lav");
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
