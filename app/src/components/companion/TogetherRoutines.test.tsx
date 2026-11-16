import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionPlan } from "../../types";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ firebaseEnabled: false, loading: false, user: null }) }));

/* v3 FEAT-07 — Routines on Together (#/practice), re-pinned to v10.1.
   #/practice is now only Together › Routines: the day map draws every
   ready-made routine offered at the child's age ONCE, on four bands (Morning ·
   Afternoon · Evening · When it comes up), and "Fits right now" is that same
   routine opened in place. v4's in-page filter, Today's rhythm, its tally,
   "Add a routine" and the library sheet were removed on purpose (the map now
   draws every routine once), so their assertions are gone.
   Part 1 renders the real TogetherView (static markup, the phone composition
   the server snapshot gives) and TogetherRoutines at the desk composition.
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
import { FITS_COPY } from "./nowV41Copy";
import RoutineRunSheet from "./RoutineRunSheet";
import RoutineRunBoard from "../plans/RoutineRunBoard";
import { PendingLine, Receipt } from "../ui/Receipt";
import { Modal } from "../ui/Modal";
import { Sheet } from "../ui/Sheet";
import { translate } from "../../lib/i18n";
import { localized, routineById } from "../../lib/routines";
import { routineDayKey, routineTemplatesForAge, routineToPlan, toggleRoutineStep } from "../../lib/routineTemplates";
import { RHYTHM_SLOTS, ROUTINE_SLOT, routineSlot, todaysRhythm } from "./togetherRhythm";
import { TOGETHER_COPY } from "../together/togetherCopy";

type El = React.ReactElement<Record<string, any>>;
const BANNED = /\bstars?\b|כוכב|Feeds|Kid Mode|%/;
/** Copy as renderToStaticMarkup escapes it. */
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const tr = (lang: "en" | "he", key: string, vars?: Record<string, string | number>) => esc(translate(lang, key, vars));
/** The day map's band of each part of the day (TogetherRoutines.BAND_OF). */
const BAND_OF: Record<string, string> = { morning: "morning", midday: "afternoon", afternoon: "afternoon", evening: "evening", night: "evening", anytime: "anytime" };

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
  vi.useRealTimers();
});

/* ── Part 1 · the rendered page ─────────────────────────────────────────── */

/** A fixed local clock, so "Fits right now" never depends on when the suite runs. */
const at = (hour: number, minute = 0) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 12, hour, minute)); };
const page = () => renderToStaticMarkup(<TogetherView />);
const desk = () => renderToStaticMarkup(<TogetherRoutines composition="desk" />);
const moduleTag = (html: string, name: string) => html.match(new RegExp(`<section[^>]*data-module="${name}"[^>]*>`))![0];
/** The day map: everything inside the together-routines block. */
function routinesBlock(html: string): string {
  const start = html.indexOf('data-testid="together-routines"');
  expect(start, "the routines block renders").toBeGreaterThan(-1);
  const end = html.indexOf('data-module="together-doors"', start);
  return html.slice(start, end < 0 ? undefined : end);
}
const tiles = (html: string) => [...html.matchAll(/data-routine-tile="([a-z-]+)"/g)].map((m) => m[1]);
/** Each band in page order, with the routine cards (and the fitting routine) it draws. */
function bands(html: string) {
  return [...html.matchAll(/<section[^>]*data-band="([a-z]+)"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => ({
    band: m[1],
    body: m[2],
    ids: [...m[2].matchAll(/data-routine-tile="([a-z-]+)"|data-testid="together-fits" data-routine="([a-z-]+)"/g)].map((r) => r[1] ?? r[2]),
  }));
}
const DAY = () => routineDayKey(Date.now());
/** A routine started yesterday (the epoch keeps the plan id valid), with `ticks` of today's steps ticked. */
function started(id: string, lang: "en" | "he", ticks: number[] = []): ActionPlan {
  let plan = routineToPlan(routineById(id), lang, "Noa", Date.now() - 86_400_000);
  for (const i of ticks) plan = toggleRoutineStep(plan, DAY(), i);
  return plan;
}
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

for (const lang of ["en", "he"] as const) describe(`v10.1 · Together's Routines, the day map · ${lang}`, () => {
  beforeEach(() => { state.lang = lang; at(13); });

  it("nothing started: every routine for a 5-year-old once (10, no nap, no potty) on the four bands; 2 modules, the move on every card", () => {
    const html = page();
    expect(html.match(/data-module=/g)).toHaveLength(2);
    expect(html).toContain('data-module="together-routines"');
    const block = routinesBlock(html);
    expect(block).toContain('data-mode="library"');
    const ids = tiles(block);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    expect(ids).not.toContain("nap");
    expect(ids).not.toContain("potty");
    expect([...ids].sort()).toEqual(routineTemplatesForAge(60).map((r) => r.id).sort());
    // Every card is the route's one move (surfaceContract "start-routine"), and nothing else is.
    expect(html.match(/data-primary-move="start-routine"/g)).toHaveLength(10);
    expect(html.match(/data-primary-move=/g)).toHaveLength(10);
    expect(block.match(/<button type="button" class="dm-c"/g)).toHaveLength(10);
    expect(block.match(/data-in-plan="false"/g)).toHaveLength(10);
    expect(block).not.toContain('data-in-plan="true"');
    expect(block.match(/aria-haspopup="dialog"/g)).toHaveLength(10);
    // Nothing started, so nothing fits right now.
    expect(block).not.toContain('data-testid="together-fits"');
    // Each card offers the start in words.
    expect(block.split(tr(lang, "companion.together-view.routines-start")).length - 1).toBe(10);
    // The section is named by its own heading.
    const labelledBy = moduleTag(html, "together-routines").match(/aria-labelledby="([^"]+)"/)![1];
    expect(html).toContain(`<h1 class="h3 tg-routines-h1" id="${labelledBy}">${esc(TOGETHER_COPY[lang].routinesTitle)}</h1>`);
    expect(html).toContain(tr(lang, "companion.together-view.routines-sub"));
    // REMOVED on purpose in v10.1 (the map draws every routine once): Today's rhythm, its tally, Add a routine, the why-note and the library sheet.
    for (const id of ["together-rhythm", "together-rhythm-tally", "together-rhythm-add", "together-rhythm-why", "together-library"]) expect(html, id).not.toContain(`data-testid="${id}"`);
    expect(block.replace(/<[^>]+>/g, " ")).not.toMatch(BANNED);
    // Never an invented clock time.
    expect(block.replace(/<[^>]+>/g, " ")).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it("the bands read Morning, Afternoon, Evening, When it comes up; each routine sits in its part of the day, counted in words", () => {
    const copy = TOGETHER_COPY[lang];
    const drawn = bands(routinesBlock(page()));
    expect(drawn.map((b) => b.band)).toEqual(["morning", "afternoon", "evening", "anytime"]);
    const names = [copy.bandMorning, copy.bandAfternoon, copy.bandEvening, copy.bandAnytime];
    drawn.forEach(({ band, body, ids }, i) => {
      expect(body, band).toContain(`role="heading" aria-level="3">${esc(names[i])}</b>`);
      expect(body, band).toContain(`<span class="n">${esc(copy.bandCount(ids.length))}</span>`);
      for (const id of ids) expect(BAND_OF[routineSlot(id)], id).toBe(band);
    });
    expect(drawn.flatMap((b) => b.ids)).toHaveLength(10);
  });

  it("a started routine stays one card on the map: In your plan, today's ticks as marks and in words; a plan not started from a routine marks nothing", () => {
    const plan = started("calm", lang, [0]);
    const other: ActionPlan = { id: "plan-1759000000000", title: "Calmer mornings", issue: "", phases: [{ name: "", description: "", steps: [{ text: "Lay out clothes", completed: false }] }], scripts: [], successIndicators: [] };
    state.actionPlans = [plan, other];
    const calm = routineById("calm");
    for (const html of [page(), desk()]) {
      const block = routinesBlock(html);
      expect(block).toContain('data-mode="rhythm"');
      expect(tiles(block)).toHaveLength(10);
      expect(tiles(block).filter((id) => id === "calm")).toHaveLength(1);
      expect(block.match(/data-in-plan="true"/g)).toHaveLength(1);
      expect(block).toMatch(/data-routine-tile="calm" data-in-plan="true"/);
      expect(block).toContain(`aria-label="${tr(lang, "companion.together-view.rhythm-steps-aria", { done: 1, total: calm.steps.length })}"`);
      const card = block.slice(block.indexOf('data-routine-tile="calm"'), block.indexOf("</button>", block.indexOf('data-routine-tile="calm"')));
      expect(card.match(/<i class="d"><\/i>/g)).toHaveLength(1);
      expect(card.match(/<i><\/i>/g)).toHaveLength(calm.steps.length - 1);
      expect(card).toContain(tr(lang, "companion.together-view.routines-in-plan"));
      expect(card).toContain(esc(localized(calm.time, lang)));
      expect(block.replace(/<[^>]+>/g, " ")).not.toMatch(BANNED);
    }
    // The desk card names the next step; the phone card keeps to the marks.
    expect(desk()).toContain(tr(lang, "companion.together-view.rhythm-next-step", { step: localized(calm.steps[1].label, lang) }));
    expect(page()).not.toContain(tr(lang, "companion.together-view.rhythm-next-step", { step: localized(calm.steps[1].label, lang) }));
  });

  it("a routine finished today is checked as complete and says so", () => {
    const morning = routineById("morning");
    state.actionPlans = [started("morning", lang, morning.steps.map((_, i) => i)), started("bedtime", lang)];
    const html = desk();
    expect(html).toMatch(/data-routine-tile="morning" data-in-plan="true" data-complete="true"/);
    expect(html).toMatch(/data-routine-tile="bedtime" data-in-plan="true" data-complete="false"/);
    expect(html).toContain(tr(lang, "companion.together-view.rhythm-all-done"));
    expect(html).toContain(`aria-label="${tr(lang, "companion.together-view.rhythm-steps-aria", { done: morning.steps.length, total: morning.steps.length })}"`);
  });

  it("v4.1 Fits right now: the started routine of this part of the day opens in place, first in its band, with the clock, its numbered steps and one Start; none for another part", () => {
    at(7, 30);
    const morning = routineById("morning");
    state.actionPlans = [started("morning", lang), started("bedtime", lang)];
    for (const html of [page(), desk()]) {
      const drawn = bands(routinesBlock(html));
      const band = drawn.find((b) => b.band === "morning")!;
      expect(band.ids[0]).toBe("morning");
      // Still drawn once: the fitting routine is the expanded card, not also a tile.
      expect(drawn.flatMap((b) => b.ids)).toHaveLength(10);
      expect(tiles(html)).not.toContain("morning");
      const fits = html.slice(html.indexOf('data-testid="together-fits"'), html.indexOf("</article>", html.indexOf('data-testid="together-fits"')));
      expect(fits).toContain('data-routine="morning"');
      expect(fits).toContain(esc(FITS_COPY[lang].label("07:30")));
      expect(fits).toContain(`<h3 dir="auto">${esc(localized(morning.title, lang))}</h3>`);
      expect(fits.match(/data-ticked="false"/g)).toHaveLength(morning.steps.length);
      for (const step of morning.steps) expect(fits).toContain(esc(localized(step.label, lang)));
      expect(fits).toMatch(new RegExp(`<button type="button" class="btn primary nowrap" data-testid="together-fits-start" aria-haspopup="dialog">.*${esc(FITS_COPY[lang].start)}</button>`));
      expect(fits.replace(/<[^>]+>/g, " ")).not.toMatch(BANNED);
    }
    // A step already ticked reads Continue, and the tick shows.
    state.actionPlans = [started("morning", lang, [0]), started("bedtime", lang)];
    const ticked = page();
    expect(ticked.match(/data-ticked="true"/g)).toHaveLength(1);
    expect(ticked).toContain(esc(FITS_COPY[lang].continue));
    at(13);
    expect(routinesBlock(page())).not.toContain('data-testid="together-fits"');
    expect(tiles(page())).toContain("morning");
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
  const block = (profile: Record<string, unknown>) => { state.childProfile = profile; return tiles(renderToStaticMarkup(<TogetherRoutines composition="phone" />)); };

  it("10 at 60 months, 12 when the age is unknown, nap and potty for a 2-year-old", () => {
    at(13);
    expect(block({ id: "c", name: "Noa", age: 5 })).toHaveLength(10);
    expect(block({ id: "c", name: "Noa" })).toHaveLength(12);
    const toddler = block({ id: "c", name: "Noa", age: 2 });
    expect(toddler).toContain("nap");
    expect(toddler).toContain("potty");
  });

  // v10.1 re-pin: the routine tiles moved from togetherDiscovery.css's 124px
  // grid (and the filter pills) to the day map in together/together.css.
  it("the day map: three cards a row on the desk, one column on a phone, cards above the 44 px floor, logical sides and nothing clipped", () => {
    const css = strip(readFileSync(new URL("../together/together.css", import.meta.url), "utf8"));
    expect(css).toMatch(/\.ds \.dm-g\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
    expect(css).toMatch(/\.ds \.dm-pm \.dm-g\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
    expect(css).toMatch(/\.ds \.dm-c \{ min-height: 88px; \}/);
    expect(css).toMatch(/\.ds button\.dm-c, \.ds button\.dm-door[^{]*\{[^}]*text-align: start;/);
    expect(css).toMatch(/\.ds button\.dm-c:focus-visible[^{]*\{ outline: 3px solid var\(--sapphire\)/);
    const map = css.slice(css.indexOf(".ds .dm{"), css.indexOf(".ds{--pl-idea"));
    expect(map.length).toBeGreaterThan(1000);
    expect(map).not.toMatch(/\b(?:margin|padding|border|inset)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)/);
    expect(map).not.toMatch(/line-clamp|text-overflow|overflow:\s*hidden/);
    expect(map).not.toMatch(/progress|meter|width:\s*\d+%/);
  });

  it("v4: the routine sheet's stylesheet — tokens and logical sides only, nothing clipped, a mark per step and never a bar or a meter", () => {
    const rhythm = strip(readFileSync(new URL("./togetherRhythm.css", import.meta.url), "utf8"));
    expect(rhythm.length).toBeGreaterThan(1000);
    expect(rhythm).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(rhythm).not.toMatch(/\b(?:margin|padding|border|inset)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)/);
    expect(rhythm).not.toMatch(/line-clamp|text-overflow|overflow:\s*hidden/);
    expect(rhythm).not.toMatch(/progress|meter|%\s*;|width:\s*\d+%/);
    // (The .together-rhythm-add / .together-library-item 44 px pins went with Add a routine and the library, removed in v10.1.)
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
    const tree = TogetherRoutines({ composition: "phone" });
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
    // Midday: no started routine fits right now, so every routine stays a card.
    at(13);
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

  // v10.1 re-pin (was: "Add a routine opens the library"). The library sheet is
  // gone because the map itself draws every routine once; what it proved stays:
  // with one routine started, any other card opens its own unstarted sheet, and
  // closing it writes nothing and leaves the map as it was.
  it("v10.1: with one routine started, another card opens its own sheet; closing returns to the map and writes nothing", () => {
    state.actionPlans = [routineToPlan(routineById("bedtime"), lang, "Noa", Date.now() - 86_400_000)];
    const tree = elements(render());
    const cards = tree.filter((el) => el.props["data-routine-tile"]);
    expect(cards).toHaveLength(10);
    expect(cards.filter((el) => el.props["data-in-plan"] === "true").map((el) => el.props["data-routine-tile"])).toEqual(["bedtime"]);
    for (const card of cards) {
      expect(card.type).toBe("button");
      expect(card.props["aria-haspopup"]).toBe("dialog");
    }
    expect(tree.some((el) => el.type === RoutineRunSheet)).toBe(false);
    tile("morning").props.onClick();
    expect(sheet().props.routine.id).toBe("morning");
    expect(sheet().props.plan).toBeNull();
    sheet().props.onClose();
    expect(elements(render()).some((el) => el.type === RoutineRunSheet)).toBe(false);
    expect(elements(render()).filter((el) => el.props["data-routine-tile"])).toHaveLength(10);
    // The started routine opens on its stored plan.
    tile("bedtime").props.onClick();
    expect(sheet().props.plan).toBe(state.actionPlans[0]);
    expect(state.startRoutinePlan).not.toHaveBeenCalled();
  });

  it("v4.1: Fits right now's Start opens that routine's sheet, and nothing is written until Start as a plan", () => {
    at(7, 30);
    state.actionPlans = [routineToPlan(routineById("morning"), lang, "Noa", Date.now() - 86_400_000)];
    const start = elements(render()).find((el) => el.props["data-testid"] === "together-fits-start")!;
    expect(start.type).toBe("button");
    expect(start.props["aria-haspopup"]).toBe("dialog");
    start.props.onClick();
    expect(sheet().props.routine.id).toBe("morning");
    expect(sheet().props.plan).toBe(state.actionPlans[0]);
    expect(state.startRoutinePlan).not.toHaveBeenCalled();
  });

  it("v4.1: #/practice?routine=<id> opens that routine's sheet once; closing replaces the address with #/practice", () => {
    const replaceState = vi.fn();
    const location = { hash: "#/practice?routine=calm" };
    vi.stubGlobal("window", { location, history: { state: null, replaceState }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    expect(sheet().props.routine.id).toBe("calm");
    expect(replaceState).not.toHaveBeenCalled();
    sheet().props.onClose();
    expect(replaceState).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith(null, "", "#/practice");
    // Opened once: the same address does not open it again.
    expect(elements(render()).some((el) => el.type === RoutineRunSheet)).toBe(false);
    // A routine this child is not offered is no address.
    state.slots = [];
    location.hash = "#/practice?routine=nap";
    expect(elements(render()).some((el) => el.type === RoutineRunSheet)).toBe(false);
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
