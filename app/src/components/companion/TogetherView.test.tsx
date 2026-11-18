import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { StudioWorld } from "../practice/studioWorlds";
import type { ActionPlan } from "../../types";
const state = vi.hoisted(() => ({
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] },
  previewWorld: null as StudioWorld | null, previewIdea: null as string | null, lang: "en" as "en" | "he", loaded: true, failed: false, pin: null as string | null,
  saveMoment: vi.fn(async (..._args: unknown[]) => true), setActiveTab: vi.fn(), requestKidMode: vi.fn(), buttons: [] as Record<string, any>[],
  events: [] as Record<string, unknown>[], actionPlans: [] as ActionPlan[], startRoutinePlan: vi.fn(), togetherDid: vi.fn(),
  topic: null as null | { id: string; title: string }, openSheet: vi.fn(), openSettings: vi.fn(),
  compact: false, surfaces: [] as { kind: "modal" | "sheet"; props: Record<string, any> }[],
  composition: "phone" as "phone" | "desk", scrolled: [] as string[],
}));
// The server snapshot is the phone; a test may ask for the desk composition.
vi.mock("../../design/useComposition", () => ({ useComposition: () => state.composition }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  // Play's preview state ({ childId, value }) starts on the world or idea a test names.
  const preview = () => (state.previewWorld ? { kind: "world", world: state.previewWorld } : state.previewIdea ? { kind: "offscreen", id: state.previewIdea } : null);
  return { ...real, useState: (initial: any) => real.useState(preview() && initial && typeof initial === "object" && "value" in initial ? { ...initial, value: preview() } : initial) };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ ...state, activeFamilyTopic: state.topic }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ firebaseEnabled: false, loading: false, user: null }) }));
vi.mock("./familyTopicEvents", () => ({ openFamilyTopicSheet: (...args: unknown[]) => state.openSheet(...args) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: state.loaded, error: state.failed }) }));
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: () => {
  const collection = { items: [], loaded: state.loaded, error: state.failed };
  return { speech: collection, mimic: collection, adventures: collection, events: { ...collection, items: state.events }, missions: collection };
} }));
vi.mock("../../lib/kidExitRecap", () => ({ SINCE_LAST_PLAY_FALLBACK_MS: 7 * 86400000 }));
vi.mock("../../lib/kidModeGate", () => ({ lastKidSessionStartedAt: () => null }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: state.requestKidMode, step: null }) }));
vi.mock("../kidmode/parentGate", () => ({ readParentPin: () => state.pin }));
vi.mock("../layout/settingsBus", async (original) => ({ ...(await original<typeof import("../layout/settingsBus")>()), requestOpenSettings: (...args: unknown[]) => state.openSettings(...args) }));
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPlaceOpen: vi.fn(), trackPracticeStudioOpen: vi.fn(), trackPracticeTogetherDid: (...args: unknown[]) => state.togetherDid(...args) }));
// v3 F-TOG-3: the preview picks `useCompactSurface() ? Sheet : Modal`; both record what they were handed.
vi.mock("../ui/Modal", () => ({ Modal: (props: Record<string, any>) => { state.surfaces.push({ kind: "modal", props }); return null; } }));
vi.mock("../ui/Sheet", () => ({ useCompactSurface: () => state.compact, Sheet: (props: Record<string, any>) => { state.surfaces.push({ kind: "sheet", props }); return null; } }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => { if (type === "button") state.buttons.push(props as Record<string, any>); });
vi.mock("react/jsx-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-runtime")>();
  return { ...real,
    jsx: (...args: Parameters<typeof real.jsx>) => { capture(args[0], args[1]); return real.jsx(...args); },
    jsxs: (...args: Parameters<typeof real.jsxs>) => { capture(args[0], args[1]); return real.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...real, jsxDEV: (...args: Parameters<typeof real.jsxDEV>) => { capture(args[0], args[1]); return real.jsxDEV(...args); } };
});
import TogetherView, { togetherFilterRoute } from "./TogetherView";
import { PlayGames, PlayHandOver, PlayPreview, PlayTogetherIdeas, usePlayStudio } from "../together/PlayStudio";
import { TOGETHER_COPY } from "../together/togetherCopy";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { translate } from "../../lib/i18n";
import { routeHash } from "../../lib/routes";
import { routineById } from "../../lib/routines";
import { routineDayKey, routineToPlan, toggleRoutineStep } from "../../lib/routineTemplates";
import { STUDIO_WORLDS, studioCountKey, studioCountsSince, studioWorldsForChild } from "../practice/studioWorlds";
import type { Composition } from "../../design/useComposition";

/* v10.1 re-pin. #/practice (TogetherView) is now only Together › Routines:
   the guide, the chain strip, (1) the day map and (2) the doors with the
   "Done together this week" line. The v3 hero ("choose-together"), v4's
   in-page filter (Routines · Play · Stories, now the shell's pills), the
   story sheets and the togetherNavigation memory (selected filter and return
   door) were removed on purpose, so their assertions are gone.
   The games, the previews, the away-from-the-screen ideas and the gate card
   moved to Together › Play (#/daily-play): their behaviour is pinned below
   against PlayStudio.tsx, composed the way DailyPlayTab composes it. */

beforeEach(() => {
  vi.clearAllMocks(); state.childProfile = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };
  state.previewWorld = null; state.previewIdea = null; state.lang = "en"; state.loaded = true; state.failed = false; state.pin = null; state.buttons = []; state.topic = null; state.compact = false; state.surfaces = [];
  state.events = []; state.actionPlans = []; state.composition = "phone"; state.scrolled = [];
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
afterEach(() => { vi.unstubAllGlobals(); });
const render = () => renderToStaticMarkup(<TogetherView />);
const esc = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const button = (testId: string) => state.buttons.find((b) => b["data-testid"] === testId);
const label = (b: Record<string, any> | undefined) => React.Children.toArray(b?.children).filter((c) => typeof c === "string");
const tiles = (html: string) => (html.match(/data-routine-tile="/g) ?? []).length;

/** Together › Play's Kids Studio side, composed as DailyPlayTab composes it. */
function Play({ composition = "phone" }: { composition?: Composition }) {
  const studio = usePlayStudio();
  return <>
    {studio.kidAvailable && <PlayGames studio={studio} composition={composition} />}
    <PlayHandOver studio={studio} composition={composition} />
    <PlayTogetherIdeas studio={studio} onMoreIdeas={() => undefined} />
    <PlayPreview studio={studio} />
  </>;
}
const play = (composition?: Composition) => renderToStaticMarkup(<Play composition={composition} />);
/** The hand-over card (the gate), up to its own closing tag. */
function gate(html: string) {
  const start = html.indexOf('data-testid="together-gate"');
  expect(start, "the gate card renders").toBeGreaterThan(-1);
  return html.slice(start, html.indexOf(html.lastIndexOf("<section", start) > html.lastIndexOf("<div", start) ? "</section>" : "</div>", start));
}

describe("Together › Routines, the page (v10.1)", () => {
  it.each(["en", "he"] as const)("the guide, the chain, then (1) the routines and (2) the doors; two modules and only the routine move (%s)", (lang) => {
    state.lang = lang; const html = render();
    const copy = TOGETHER_COPY[lang];
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(html).toContain('data-testid="together-routines-screen"');
    expect(html).toContain(`<nav class="guide mini ds-guide-scroll" aria-label="${esc(copy.onThisPage)}">`);
    // V77 re-pin: the guide's stops are the two sections, Time of day (#times) and Ready-made routines (#routines).
    expect([...html.matchAll(/<a class="gstop[^"]*" href="#([a-z]+)"/g)].map((m) => m[1])).toEqual(["times", "routines"]);
    // The mini (phone) guide names the stops without their subs (the desk guide's subs are pinned below).
    expect(html).toContain(`<span class="gnum">1</span><span>${esc(copy.stopTimes)}</span>`);
    expect(html).toContain(`<span class="gnum soft">2</span><span>${esc(translate(lang, "companion.together-view.routines"))}</span>`);
    expect(html).toContain(`aria-label="${esc(copy.chainLabel("Noa"))}" data-testid="together-chain"`);
    // Guide → #times (kicker, the one h1, the figure, the index of the four bands, the chain) → #routines (the module, then the rail: read guide, doors).
    const order = [
      'class="guide', '<section class="rsec" id="times"', `<span class="kicker">${esc(copy.routinesKicker)}</span>`, '<h1 class="hero">', '<div class="fig md">',
      'data-testid="together-index-morning"', 'data-testid="together-chain"', '<section class="rsec" id="routines"', '<div data-module="together-routines">',
      `<h3 class="h3">${esc(copy.howToRead)}</h3>`, '<section class="vt" id="doors" data-module="together-doors"',
    ].map((mark) => html.indexOf(mark));
    expect(order.every((at) => at >= 0), JSON.stringify(order)).toBe(true); expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain(`<span class="next1">${esc(copy.startHere)}</span>`);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain(`<h1 class="hero"><span id="`);
    expect(html).toContain(`${esc(translate(lang, "companion.together-view.routines-title"))}</span></h1>`);
    expect(html).toContain(`<section class="rsec" id="routines" aria-label="${esc(copy.byTimeOfDay)}">`);
    // NEGATIVE CONTROL: doors are no longer a guide stop, and the v10.1 module section with its id is gone.
    expect(html).not.toContain('href="#doors"');
    expect(html).not.toContain('id="routines" data-module="together-routines"');
    expect(html).toContain(`<h2 class="h3" id="`);
    expect(html).toContain(esc(copy.doorsTitle));
    expect(html).toContain(esc(copy.doorsSub("Noa")));
    expect(html.match(/data-module=/g)).toHaveLength(2);
    expect(tiles(html)).toBeGreaterThan(0);
    expect(html.match(/data-primary-move=/g)).toHaveLength(tiles(html));
    expect(html.match(/data-primary-move="start-routine"/g)).toHaveLength(tiles(html));
    // REMOVED on purpose: the v3 hero, the in-page filter row and the games,
    // stories and away-idea modules; the gate card and the games live on Play.
    for (const gone of ["together-invitation", "together-cta", "choose-together", "companion-filter-row", "together-games", "together-stories", "together-offscreen", "together-gate", "together-start-playing", "together-world-count", "<details"]) expect(html, gone).not.toContain(gone);
    expect(html).not.toContain(esc(translate(lang, "companion.together-view.kicker")));
  });

  it.each(["phone", "desk"] as const)("the index of the four times of day: counts, the part of the day marked, a tap scrolls to that band and writes nothing (%s)", (composition) => {
    state.composition = composition;
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 12, 19, 0));
    try {
      const html = render();
      const bands = ["morning", "afternoon", "evening", "anytime"] as const;
      const index = bands.map((band) => button(`together-index-${band}`)!);
      expect(index.every(Boolean)).toBe(true);
      expect(html).toContain(`<div class="mci${composition === "phone" ? " m" : ""}" style="--n:4" role="group" aria-label="${esc(TOGETHER_COPY.en.timesOfDay)}">`);
      // 19:00 is the evening: only that band is pressed.
      expect(index.map((b) => b["aria-pressed"])).toEqual([false, false, true, false]);
      // Each tile's count is the number of routine cards drawn in its band (counts, never a share).
      for (const band of bands) {
        const section = html.slice(html.indexOf(`id="band-${band}"`), html.indexOf("</section>", html.indexOf(`id="band-${band}"`)));
        const cards = (section.match(/data-routine-tile="|data-testid="together-fits"/g) ?? []).length;
        expect(html, band).toMatch(new RegExp(`data-testid="together-index-${band}"[^>]*>[\\s\\S]*?<b class="arbor-num">${cards}</b>`));
      }
      vi.stubGlobal("document", { getElementById: (id: string) => ({ scrollIntoView: () => state.scrolled.push(id) }) });
      for (const b of index) b.onClick();
      expect(state.scrolled).toEqual(bands.map((band) => `band-${band}`));
      expect(state.setActiveTab).not.toHaveBeenCalled(); expect(state.startRoutinePlan).not.toHaveBeenCalled(); expect(state.saveMoment).not.toHaveBeenCalled();
      // The index tiles are not the route's move.
      expect(index.every((b) => !("data-primary-move" in b))).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it("old filter addresses land on Play or Stories; Routines (or no filter) stays", () => {
    expect(togetherFilterRoute("games")).toBe("daily-play");
    expect(togetherFilterRoute("offscreen")).toBe("daily-play");
    expect(togetherFilterRoute("stories")).toBe("stories");
    expect(togetherFilterRoute("routines")).toBeNull();
    expect(togetherFilterRoute(null)).toBeNull();
    const location = { hash: "", replace: vi.fn() };
    vi.stubGlobal("window", { location, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    for (const f of ["games", "offscreen", "stories"]) {
      location.hash = `#/practice?f=${f}`;
      expect(render(), f).toBe("");
    }
    for (const hash of ["#/practice?f=routines", "#/practice"]) {
      location.hash = hash;
      expect(render(), hash).toContain('data-testid="together-routines-screen"');
    }
    // The hop replaces the history entry, so Back skips it (the effect runs in the browser only).
    const source = readFileSync(new URL("./TogetherView.tsx", import.meta.url), "utf8");
    expect(source).toContain("if (moved && typeof window !== \"undefined\") window.location.replace(`#${routeHash(moved)}`);");
    expect(`#${routeHash("daily-play")}`).toBe("#/daily-play");
  });

  it("opening the page writes nothing and starts nothing", () => {
    render();
    expect(state.saveMoment).not.toHaveBeenCalled(); expect(state.requestKidMode).not.toHaveBeenCalled();
    expect(state.setActiveTab).not.toHaveBeenCalled(); expect(state.startRoutinePlan).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("Done together this week shows only once a routine step was ticked this week, in counts and days (%s)", (lang) => {
    state.lang = lang;
    const copy = TOGETHER_COPY[lang];
    expect(render()).not.toContain('data-testid="together-done-week"');
    // A plan not started from a routine, and a routine with nothing ticked, are not "done together".
    const other = { id: "plan-1759000000000", title: "Calmer mornings", issue: "", phases: [{ name: "", description: "", steps: [{ text: "Lay out clothes", completed: false }] }], scripts: [], successIndicators: [] } as ActionPlan;
    const calm = routineToPlan(routineById("calm"), lang, "Noa", Date.now() - 86_400_000);
    state.actionPlans = [other, calm];
    expect(render()).not.toContain('data-testid="together-done-week"');
    state.actionPlans = [other, toggleRoutineStep(toggleRoutineStep(calm, routineDayKey(new Date()), 0), routineDayKey(new Date()), 1)];
    state.buttons = [];
    const html = render();
    const line = html.slice(html.indexOf('data-testid="together-done-week"'), html.indexOf("</button>", html.indexOf('data-testid="together-done-week"')));
    expect(line).toContain(esc(copy.doneTitle));
    // V77: the tile is .tgdone (.m on a phone), in the rail after the read guide and before the doors.
    expect(html).toContain('<section class="tgdone m" data-testid="together-done-week">');
    const at = (mark: string) => html.indexOf(mark);
    expect(at(`<h3 class="h3">${esc(copy.howToRead)}</h3>`)).toBeLessThan(at('data-testid="together-done-week"'));
    expect(at('data-testid="together-done-week"')).toBeLessThan(at('data-module="together-doors"'));
    // V77: dates are the boards' day-first short form ("Sat 14"), so English uses en-GB.
    expect(line).toContain(`<b class="strong" style="color:var(--ink)">${esc(copy.doneSteps(2))}</b> ${esc(copy.doneDays(new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { weekday: "short", day: "numeric" }).format(new Date())))}`);
    // Negative control: never the US day-after-weekday order ("16 Mon").
    if (lang === "en") expect(line).not.toContain(esc(new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric" }).format(new Date())));
    // The days are plan tokens labelled with the day, one per day ticked.
    expect(line.match(/class="tok plan/g)).toHaveLength(1);
    expect(line.replace(/<[^>]+>/g, " ")).not.toMatch(/%|\bof\b|מתוך/);
    // The line's one link goes to the week (the MoreLink button closes the line's markup).
    expect(line).toMatch(new RegExp(`<button type="button" class="ds-link">${esc(translate(lang, "nav.tab.weekly"))}`));
    const links = state.buttons.filter((b) => b.className === "ds-link");
    expect(links).toHaveLength(1);
    links[0].onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith("weekly");
  });
});

describe("FEAT-05 — the question line on Together opens the question sheet", () => {
  const QUESTION = { id: "topic-a", title: "What helps bedtime feel calmer?" };
  const chipMarkup = (html: string) => html.match(/<button[^>]*data-testid="together-topic-chip"[\s\S]*?<\/button>/)?.[0] ?? "";

  it.each(["en", "he"] as const)("is one button carrying the lead-in and the question, outside the module budget (%s)", (lang) => {
    state.lang = lang; state.topic = QUESTION;
    const html = render();
    const chip = state.buttons.find((b) => b["data-testid"] === "together-topic-chip");
    expect(chip).toBeDefined();
    expect(chip!.type).toBe("button");
    expect(chip!["aria-haspopup"]).toBe("dialog");
    // Text only: the bookmark glyph, the lead-in and the question — never a count, dot or state.
    expect(chipMarkup(html).replace(/<[^>]+>/g, "")).toBe(`bookmark${translate(lang, "companion.together-view.your-question-stays-with-you")}${QUESTION.title}`);
    // The "enough to enjoy" caption stays a sentence beside the button, not inside it.
    const caption = translate(lang, "companion.together-view.here-it-is-also-enough-just-to-enjoy");
    expect(chipMarkup(html)).not.toContain(caption);
    expect(html).toContain(caption);
    expect(html.match(/data-primary-move=/g)).toHaveLength(tiles(html)); expect(html.match(/data-module=/g)).toHaveLength(2);
    chip!.onClick();
    expect(state.openSheet).toHaveBeenCalledOnce();
    expect(state.openSheet).toHaveBeenCalledWith();
    expect(state.saveMoment).not.toHaveBeenCalled(); expect(state.setActiveTab).not.toHaveBeenCalled();
  });

  it("renders no chip and no empty pill without an active question", () => {
    const html = render();
    expect(html).not.toContain("companion-topic-context");
    expect(html).not.toContain("companion-topic-chip");
    expect(state.buttons.some((b) => b["data-testid"] === "together-topic-chip")).toBe(false);
  });

  it("draws the line with logical properties on the shared 44px chip", () => {
    expect(readFileSync(new URL("./TogetherView.tsx", import.meta.url), "utf8")).toContain('import "./companionWorkspace.css";');
    const workspace = readFileSync(new URL("./companionWorkspace.css", import.meta.url), "utf8");
    expect(/\.companion-topic-chip \{([^}]*)\}/.exec(workspace)?.[1] ?? "").toMatch(/min-block-size: 44px/);
    const experience = readFileSync(new URL("./companionExperience.css", import.meta.url), "utf8");
    const rules = experience.split("\n").filter((line) => line.includes(".companion-topic-context")).join("\n");
    expect(rules).not.toBe("");
    expect(rules).not.toMatch(/\b(?:left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

/* v3 F-TOG-3 re-pin: the 390 px rules of togetherDiscovery.css (the pills row,
   the 88 px game rows, the gate card's phone row) styled the removed
   in-page catalogue; the phone is now its own composition of the same page. */
describe("v10.1 — Together › Routines on a phone", () => {
  it("the phone composition: the mini guide, the stacked chain, a one-column map and the doors stacked", () => {
    const html = render();
    // V77: the Routines root carries the shared frame (.ds-mychild) as well as together-v10.
    expect(html).toContain('class="ds ds-phone ds-mychild together-v10"');
    expect(html).toContain('class="guide mini ds-guide-scroll"');
    expect(html).toContain('<div class="mch m">');
    expect(html).toContain('<div class="mci m" style="--n:4"');
    expect(html).toContain('class="chn m"');
    expect(html).toContain('class="tg-stack dm-pm"');
    // The phone stacks: the .mcst card with the routines, then the read guide, then the doors (no desk row or rail).
    const routines = html.slice(html.indexOf('<section class="rsec" id="routines"'));
    expect(routines).toMatch(/^<section class="rsec" id="routines"[^>]*><span class="rstop"[^>]*>2<\/span><div class="tg-stack" style="gap:12px"><div class="mcst" style="padding:14px 12px"><div data-module="together-routines">/);
    expect(routines.indexOf('<div data-module="together-routines">')).toBeLessThan(routines.indexOf('<section class="vt">'));
    expect(routines.indexOf('<section class="vt">')).toBeLessThan(routines.indexOf('data-module="together-doors"'));
    for (const desk of ['class="rowa"', 'class="stg"', 'class="rlc"', "together-stage", '<div class="mch">']) expect(html, desk).not.toContain(desk);
    // NEGATIVE CONTROL: the v10.1 map wrapper and root class are gone.
    expect(html).not.toContain('class="dm dm-pm"');
    expect(html).not.toContain('class="ds ds-phone together-v10"');
    const doors = html.slice(html.indexOf('data-module="together-doors"'));
    expect(doors).not.toContain('class="g12"');
    const css = readFileSync(new URL("../together/together.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.ds \.dm-pm \.tgg\{grid-template-columns:minmax\(0,1fr\)/);
    expect(css).toMatch(/\.ds \.dm-pm \.tgg\.two \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(css).not.toMatch(/\.dm-g\b/);
    expect(css).toMatch(/\.ds \.dm-pm \.dm-door\{[^}]*grid-template-columns:52px minmax\(0,1fr\) auto/);
    // The doors stay real buttons with a visible focus ring.
    expect(css).toMatch(/\.ds button\.dm-door:focus-visible/);
  });

  it.each(["en", "he"] as const)("the desk composition: the header band, then the stage (every routine, by time of day) beside the rail (guide, this week, doors) (%s)", (lang) => {
    state.lang = lang; state.composition = "desk";
    const copy = TOGETHER_COPY[lang];
    const calm = routineToPlan(routineById("calm"), lang, "Noa", Date.now() - 86_400_000);
    state.actionPlans = [toggleRoutineStep(calm, routineDayKey(new Date()), 0)];
    const html = render();
    expect(html).toContain('class="ds ds-desk ds-mychild together-v10"');
    expect(html).not.toContain("ds-phone");
    // The desk guide: Time of day and Ready-made routines, each with its sub.
    expect(html).toContain(`<nav class="guide" aria-label="${esc(copy.onThisPage)}">`);
    expect([...html.matchAll(/<a class="gstop[^"]*" href="#([a-z]+)"/g)].map((m) => m[1])).toEqual(["times", "routines"]);
    for (const text of [copy.stopTimes, copy.stopTimesSub, copy.stopRoutines, copy.stopRoutinesV77Sub]) expect(html, text).toContain(esc(text));
    expect(html).toContain(`<div class="mch"><div class="mcl"><span class="gsec"><span class="kicker">${esc(copy.routinesKicker)}</span><span class="next1">${esc(copy.startHere)}</span></span><h1 class="hero">`);
    expect(html).toContain('<div class="mci" style="--n:4"');
    // The stage: one StageCard titled "By time of day" holding the single routines module (desk map, no phone wrapper).
    const desk = html.slice(html.indexOf('<div class="rowa">'));
    expect(desk).toMatch(new RegExp(`^<div class="rowa"><div class="stg"><section class="mcst together-stage"><div class="mcsh"><i class="tg" aria-hidden="true">[\\s\\S]*?</i><h2 class="tt">${esc(copy.byTimeOfDay)}</h2></div><div data-module="together-routines"><div class="tg-stack" style="gap:14px" data-testid="together-routines"`));
    expect(html.match(/data-module="together-routines"/g)).toHaveLength(1);
    expect(html).not.toContain("dm-pm");
    // The rail: the read guide, Done together this week (desk tile, not .m), then the doors.
    const rail = html.slice(html.indexOf('<div class="rlc"'));
    const marks = [`<h3 class="h3">${esc(copy.howToRead)}</h3>`, '<section class="tgdone" data-testid="together-done-week">', '<section class="vt" id="doors" data-module="together-doors"'].map((m) => rail.indexOf(m));
    expect(marks.every((m) => m >= 0), JSON.stringify(marks)).toBe(true); expect([...marks].sort((a, b) => a - b)).toEqual(marks);
    expect(rail.indexOf('data-module="together-routines"')).toBe(-1);
    // Two modules, and the move is only on the routine cards.
    expect(html.match(/data-module=/g)).toHaveLength(2);
    expect(tiles(html)).toBeGreaterThan(0);
    expect(html.match(/data-primary-move="start-routine"/g)).toHaveLength(tiles(html));
    expect(html.match(/data-primary-move=/g)).toHaveLength(tiles(html));
  });
});

/* ── Together › Play: the Kids Studio side (moved from #/practice) ──────── */

describe("Together › Play keeps the games, the previews, the ideas and the gate (PlayStudio)", () => {
  it("DailyPlayTab renders them: the games only when Kids Studio is open at this age, the hand-over, the ideas and the preview", () => {
    const tab = readFileSync(new URL("../tabs/DailyPlayTab.tsx", import.meta.url), "utf8");
    expect(tab).toContain("const studio = usePlayStudio();");
    expect(tab).toMatch(/\{studio\.kidAvailable && \(\s*<RouteSection id="games"[^>]*>\s*<PlayGames studio=\{studio\}/);
    expect(tab.match(/<PlayHandOver studio=\{studio\}/g)).toHaveLength(2);
    expect(tab).toContain("<PlayTogetherIdeas studio={studio}");
    expect(tab).toContain("<PlayPreview studio={studio} />");
  });

  // v3 F-TOG-3 re-pin kept: the PIN ask reads "Set a PIN"; it still opens Settings at the PIN.
  it.each(["en", "he"] as const)("one gate card: the PIN line, Set a PIN and Start playing (%s)", (lang) => {
    state.lang = lang; const card = gate(play());
    expect(card).toContain(">lock</span>"); expect(card).toContain(">play_arrow</span>");
    expect(card).toContain(esc(TOGETHER_COPY[lang].handOver));
    expect(card).toContain(esc(translate(lang, "companion.together-view.play-opens-in-the-child-area-set-a-pin-to")));
    expect(card).toMatch(new RegExp(`<button type="button" class="pl-btn ghost" data-testid="together-gate-pin">.*${esc(translate(lang, "companion.together-view.set-a-pin"))}</button>`));
    expect(card).toContain(`data-testid="together-start-playing"`); expect(card).toContain(esc(translate(lang, "companion.together-view.start-playing")));
    // The Kid Mode promises, the practice note and the PIN nudge now live in Settings › PIN.
    for (const key of ["elev.practice.door.gated", "elev.practice.door.private", "elev.practice.door.stars", "practice.studio.note", "elev.gate.set.title"]) expect(card).not.toContain(esc(translate(lang, key)));
    state.pin = "0000"; const locked = gate(play());
    expect(locked).toContain(esc(translate(lang, "companion.together-view.you-choose-when-to-enter-play-your-pin-pro")));
    expect(locked).not.toContain('data-testid="together-gate-pin"'); expect(locked).toContain('data-testid="together-start-playing"');
  });

  it("the PIN ask is a 44 px button that opens Settings at the PIN; Start playing hands over; nothing is written", () => {
    play();
    expect(state.saveMoment).not.toHaveBeenCalled(); expect(state.requestKidMode).not.toHaveBeenCalled(); expect(state.setActiveTab).not.toHaveBeenCalled();
    const pin = button("together-gate-pin")!;
    expect(pin.type).toBe("button");
    expect(String(pin.className).split(" ")).toContain("pl-btn");
    const css = readFileSync(new URL("../together/together.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.ds \.pl-btn\{[^}]*min-height:44px/);
    pin.onClick(); expect(state.openSettings).toHaveBeenCalledWith({ focus: "pin" });
    button("together-start-playing")!.onClick(); expect(state.requestKidMode).toHaveBeenCalledOnce(); expect(state.requestKidMode).toHaveBeenCalledWith();
    expect(state.saveMoment).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("the PIN ask reads in both languages, Hebrew without Latin (%s)", (lang) => {
    const en = (companionEn as Record<string, string>)["companion.together-view.set-a-pin"], he = (companionHe as Record<string, string>)["companion.together-view.set-a-pin"];
    expect(en).toBe("Set a PIN"); expect(he).toBeTruthy(); expect(he).not.toMatch(/[A-Za-z]/); expect(he).toMatch(/[֐-׿]/);
    state.lang = lang; play();
    expect(label(button("together-gate-pin"))).toEqual([translate(lang, "companion.together-view.set-a-pin")]);
  });

  it.each(["en", "he"] as const)("below lg a game preview is a bottom sheet with the same title; the wide answer stays the Modal (%s)", (lang) => {
    const world = STUDIO_WORLDS.find((w) => w.id === "word-world")!;
    state.lang = lang; state.childProfile.age = 6; state.previewWorld = world;
    state.compact = true; play();
    expect(state.surfaces.map((s) => s.kind)).toEqual(["sheet"]);
    expect(state.surfaces[0].props.open).toBe(true);
    expect(state.surfaces[0].props.title).toBe(translate(lang, world.kidNameKey));
    state.surfaces = []; state.compact = false; play();
    expect(state.surfaces.map((s) => s.kind)).toEqual(["modal"]);
    expect(state.surfaces[0].props.open).toBe(true);
    expect(state.surfaces[0].props.title).toBe(translate(lang, world.kidNameKey));
  });

  it("a closed preview is a closed sheet", () => {
    state.compact = true; play();
    expect(state.surfaces.map((s) => [s.kind, s.props.open])).toEqual([["sheet", false]]);
  });

  // (The way back to the chosen card after a parent tool was togetherNavigation's
  // return door, removed with it; opening the tool is what stays.)
  it.each([["en", "word-world", "language"], ["he", "speech", "speech"]] as const)("a %s %s preview opens its parent tool directly", (lang, id, tab) => {
    state.lang = lang; state.childProfile.age = 6; state.previewWorld = STUDIO_WORLDS.find((world) => world.id === id)!;
    const html = play();
    expect(html).toContain(`data-world="${id}"`);
    const open = state.buttons.find((b) => b.className === "companion-primary" && label(b).includes(translate(lang, "companion.together-view.open")));
    expect(open).toBeDefined(); open!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith(tab); expect(state.requestKidMode).not.toHaveBeenCalled();
  });

  it("per-world counts show on each game's own card, in its own unit, once the reads are in (B-PLAY-02)", () => {
    state.childProfile.age = 6;
    const now = Date.now();
    state.events = [{ kind: "lang-strategy", timestamp: new Date(now - 3_600_000).toISOString() }, { kind: "lang-strategy", timestamp: new Date(now - 7_200_000).toISOString() }];
    const { worlds } = studioWorldsForChild("en", state.childProfile as never);
    const { byWorld } = studioCountsSince({ speech: { items: [] }, mimic: { items: [] }, adventures: { items: [] }, events: { items: state.events as never[] } }, now - 7 * 86400000);
    const counted = worlds.filter((w) => (byWorld[w.id] ?? 0) > 0);
    expect(counted.map((w) => w.id)).toEqual(["word-world"]);
    const html = play();
    expect(html.match(/data-testid="together-world-count"/g)).toHaveLength(1);
    const card = html.slice(html.indexOf('data-world="word-world"'), html.indexOf("</button>", html.indexOf('data-world="word-world"')));
    expect(card).toContain(`data-testid="together-world-count">${esc(translate("en", studioCountKey(counted[0].unit, 2), { n: 2 }))}</span>`);
    // Still reading: no count is shown, never a zero.
    state.loaded = false;
    expect(play()).not.toContain('data-testid="together-world-count"');
  });

  it("keeping an away idea saves ONE moment through the seam, which stays quiet: the preview owns the failure", async () => {
    state.previewIdea = "build"; play();
    const keep = state.buttons.find((b) => b.className === "companion-text-button")!;
    expect(label(keep)).toEqual([translate("en", "companion.together-view.we-already-tried-it-keep-the-moment")]);
    keep.onClick(); keep.onClick();
    await Promise.resolve(); await Promise.resolve();
    expect(state.saveMoment).toHaveBeenCalledTimes(1);
    expect(state.saveMoment).toHaveBeenCalledWith(
      translate("en", "companion.together-view.we-tried-together", { value0: translate("en", "companion.offscreen.build.title") }),
      { callerShowsFailure: true, requireAcknowledgement: true, retryKey: "together-offscreen:build", isCurrent: expect.any(Function) },
    );
    expect(state.togetherDid).toHaveBeenCalledWith("build");
    // A save that did not land counts nothing.
    state.saveMoment.mockResolvedValueOnce(false); state.togetherDid.mockClear(); state.buttons = [];
    play();
    state.buttons.find((b) => b.className === "companion-text-button")!.onClick();
    await Promise.resolve(); await Promise.resolve();
    expect(state.saveMoment).toHaveBeenCalledTimes(2);
    expect(state.togetherDid).not.toHaveBeenCalled();
  });

  it("under three Play holds only the together cards and the from-three line, with no game, button or lock", () => {
    state.childProfile.age = 2; const html = play();
    expect(html).not.toContain('data-testid="together-start-playing"'); expect(html).not.toContain('data-module="play-games"');
    const card = gate(html);
    expect(card).not.toContain("<button"); expect(card).not.toContain(">lock</span>");
    expect(card).toContain(esc(translate("en", "elev.ages.practice.fromThree", { name: "Noa" })));
    expect(html).toContain(esc(translate("en", "elev.ages.together.copy-faces.title")));
    expect(html).not.toContain(esc(translate("en", "companion.offscreen.build.title")));
  });
});
