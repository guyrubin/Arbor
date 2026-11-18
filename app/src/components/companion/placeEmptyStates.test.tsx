/**
 * VIS-07 — one calm empty state per place: a picture, one sentence, one action.
 *
 * My child (ChildPortrait with no observations), Together (TogetherView with
 * no play and no kept moment) and Now's week (NowWeekSoFar on an empty week)
 * render their empty branch here, in EN and HE, through react-dom/server.
 *  - No empty branch says anything in numbers: no numeral (so no "0", no
 *    "n of m") and no "%". The scan reads the text a parent reads, not the
 *    markup, whose inline styles legitimately carry "100%" and "'FILL' 0".
 *  - The two place empty states carry exactly ONE action, Keep a moment, and
 *    it opens the capture sheet. Now's week line carries none: Now keeps its
 *    one primary move.
 *  - v10.1: Together › Routines dropped its empty branch (routines always
 *    exist); its first-time state is the day map itself, and no pending or
 *    failed read blanks it.
 *  - v3 F-CHILD-1: My child is the Milestones page, one scroll whose first-time
 *    state is the page itself: the cards say "Not told yet" and offer Tell
 *    Arbor (the kept-moment card opens the capture sheet), and every area row
 *    says "No record yet". Still nothing in numbers on the cards or the rows.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  observations: [] as unknown[],
  behaviorLogs: [] as unknown[], logsLoaded: true,
  playItems: [] as unknown[], loaded: true, failed: false,
  openCaptureSheet: vi.fn(), setActiveTab: vi.fn(), saveMoment: vi.fn(async () => true),
  buttons: [] as Record<string, any>[],
}));
vi.mock("../../context/ArborContext", () => {
  const value = () => ({
    childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], strengths: [], activeGoals: [] },
    milestones: [], milestonesLoaded: true, milestonesConfirmed: true, actionLoop: [], activeFamilyTopic: null,
    behaviorLogs: state.behaviorLogs, logsLoaded: state.logsLoaded,
    openCaptureSheet: state.openCaptureSheet, setActiveTab: state.setActiveTab, saveMoment: state.saveMoment,
    seedCoach: vi.fn(), requestJournalFocus: vi.fn(),
  });
  return { useArbor: value, useArborOptional: value };
});
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "account-invented" } }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
// My child: the record and the side panels have their own tests.
vi.mock("../../hooks/useObservationRecord", () => ({ useObservationRecord: () => ({
  observations: state.observations, loading: false, error: false, more: false, confirmed: true,
  sources: { behaviorLogs: [] }, reload: vi.fn(), loadMore: vi.fn(),
}) }));
vi.mock("./PortraitWatchRow", () => ({ default: () => null }));
vi.mock("./PortraitKeepsakes", () => ({ default: () => null }));
vi.mock("../describe/KeptDescription", () => ({ default: () => null }));
// v3 F-CHILD-1: the describe conversation and the first's keepsake sheet open
// only on a tap and have their own tests.
vi.mock("../describe/TellArborMore", () => ({ default: () => null }));
vi.mock("../milestones/FirstKeepsakeSheet", () => ({ default: () => null }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
// Together: play reads (hero runs stay empty; practice rows come from the state).
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: state.loaded, error: state.failed }) }));
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: () => {
  const collection = { items: state.playItems, loaded: state.loaded, error: state.failed };
  return { speech: collection, mimic: collection, adventures: collection, events: collection, missions: collection };
} }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: vi.fn(), step: null }) }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as Record<string, any>);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
import ChildPortrait from "./ChildPortrait";
import TogetherView from "./TogetherView";
import { NowWeekSoFar } from "./NowDayPanels";
import { NOW_COPY } from "./nowViewCopy";
import { milestonesV10Copy } from "./milestonesV10Copy";
import { translate } from "../../lib/i18n";

const LANGS = ["en", "he"] as const;
const t = (key: string) => translate(state.lang, key);
/** What a parent reads: the text nodes, entities decoded, whitespace collapsed. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const branch = (html: string, re: RegExp) => {
  const found = html.match(re);
  expect(found, `no empty branch matches ${re}`).not.toBeNull();
  return found![0];
};
const expectNoNumbers = (text: string) => {
  expect(text, "an empty state counts nothing").not.toMatch(/\d/);
  expect(text, "an empty state shows no percentage").not.toMatch(/%/);
};
const occurrences = (html: string, needle: string) => html.split(needle).length - 1;
const buttonsIn = (html: string) => (html.match(/<button\b/g) ?? []).length;

const renderTogether = () => renderToStaticMarkup(<TogetherView />);

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en"; state.observations = []; state.behaviorLogs = []; state.logsLoaded = true;
  state.playItems = []; state.loaded = true; state.failed = false; state.buttons = [];
});

/* v3 F-CHILD-1 RE-PIN: the brief makes My child one scroll (header, portrait
   cards, the areas table); the separate empty branch with its picture and one
   Keep a moment is gone, because the page's first-time state is the page
   itself. Was: one picture, one sentence, one Keep a moment. Now: the cards
   and the rows say what is not told yet, in words, and count nothing. */
describe("VIS-07 · My child: the first-time Milestones page (v3 F-CHILD-1)", () => {
  /** Text a parent reads, without the icon ligatures (a glyph name is not copy). */
  const readText = (html: string) => textOf(html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, " "));
  it.each(LANGS)("%s: the cards say Not told yet, every row says No record yet, nothing in numbers", (lang) => {
    state.lang = lang;
    const html = renderToStaticMarkup(<ChildPortrait />);
    const cards = branch(html, /<div class="portrait-cards" data-testid="portrait-cards">[\s\S]*?<\/button><\/article><\/div>/);
    // v10.1: the eight areas are territories on the map (a list), not rows.
    // v10.1: the eight areas are the index's segments (a list).
    const rows = branch(html, /<ul class="mci[^"]*" role="list"[^>]*>[\s\S]*?<\/ul>/);
    expect(occurrences(readText(cards), t("companion.milestones.notTold"))).toBe(2);
    // v10.1: the goal invitation is the rail's focus row.
    expect(readText(html.slice(html.indexOf('data-testid="portrait-goals-edit"')))).toContain(t("elev.goal.profile.empty"));
    expect(occurrences(rows, 'data-testid="dev-map-tile"')).toBe(8);
    // V77: the boards' "Nothing recorded yet" on every area.
    expect(occurrences(readText(rows), milestonesV10Copy(lang).nothingYet)).toBe(8);
    expect(occurrences(readText(rows), t("companion.devMap.none"))).toBe(0);
    expect(html).not.toContain('data-testid="dev-map-seen"');
    expect(html).not.toContain('data-testid="dev-map-last"');
    expectNoNumbers(readText(cards));
    expectNoNumbers(readText(rows));
  });
  it.each(LANGS)("%s: the kept-moment card's Tell Arbor opens the capture sheet, once", (lang) => {
    state.lang = lang;
    renderToStaticMarkup(<ChildPortrait />);
    const tell = state.buttons.filter((button) => button["data-testid"] === "portrait-card-kept-tell");
    expect(tell).toHaveLength(1);
    tell[0].onClick();
    expect(state.openCaptureSheet).toHaveBeenCalledOnce();
  });
});

/* v10.1 RE-PIN: Together › Routines (#/practice) is the day map of ready-made
   routines, which always exist at every age, so the first-time empty branch
   (picture, "A good moment needs no other reason.", one Keep a moment) was
   dropped on purpose: like My child, the first-time state is the page itself.
   What stays pinned: the first visit renders the routines and the doors, says
   nothing it cannot back up (no empty sentence, no stand-in CTA), writes
   nothing, and a pending or failed read never blanks the page. */
describe("VIS-07 · Together: the first-time Routines page is the routines (v10.1)", () => {
  it.each(LANGS)("%s: nothing on record still draws every routine and the doors, with no empty branch and no Keep a moment", (lang) => {
    state.lang = lang;
    const html = renderTogether();
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(html).not.toContain('data-testid="together-empty"');
    expect(html).not.toContain(t("companion.together-view.empty"));
    expect(state.buttons.some((button) => button["data-testid"] === "together-empty-cta")).toBe(false);
    expect(html).toContain('data-testid="together-routines"');
    const tiles = html.match(/data-routine-tile="/g) ?? [];
    expect(tiles.length).toBeGreaterThan(0);
    // Each routine card carries the route's one declared move, and only those.
    expect(html.match(/data-primary-move="start-routine"/g)).toHaveLength(tiles.length);
    expect(html.match(/data-primary-move=/g)).toHaveLength(tiles.length);
    expect(html.match(/data-module=/g)).toHaveLength(2);
    expect(html).toContain('data-testid="together-door-story"');
    // Nothing ticked this week: no "Done together this week" line.
    expect(html).not.toContain('data-testid="together-done-week"');
    // Seeing the page writes nothing and opens nothing.
    expect(state.saveMoment).not.toHaveBeenCalled();
    expect(state.openCaptureSheet).not.toHaveBeenCalled();
  });

  it("a pending or failed read never blanks the routines and never brings back an empty branch", () => {
    const routines = (html: string) => (html.match(/data-routine-tile="/g) ?? []).length;
    const baseline = routines(renderTogether());
    expect(baseline).toBeGreaterThan(0);
    state.loaded = false;
    expect(routines(renderTogether())).toBe(baseline);
    state.loaded = true; state.logsLoaded = false;
    expect(routines(renderTogether())).toBe(baseline);
    state.logsLoaded = true; state.failed = true;
    const failed = renderTogether();
    expect(routines(failed)).toBe(baseline);
    expect(failed).not.toContain('data-testid="together-empty"');
    state.failed = false; state.behaviorLogs = [{ id: "moment-1" }];
    state.playItems = [{ id: "event-1", timestamp: "2020-01-06T10:00:00.000Z", kind: "rhythm" }];
    const kept = renderTogether();
    expect(routines(kept)).toBe(baseline);
    expect(kept).not.toContain('data-testid="together-empty"');
  });
});

describe("VIS-07 · Now: an empty week says so in words", () => {
  it.each(LANGS)("%s: no count tiles, no numeral, no %, no action inside the line", (lang) => {
    state.lang = lang;
    const html = renderToStaticMarkup(<NowWeekSoFar observations={[]} now={new Date(2026, 9, 7, 12)} onReport={() => undefined} />);
    expect(html).not.toContain("now-week-tiles");
    const empty = branch(html, /<p class="now-week-empty">[\s\S]*?<\/p>/);
    expect(textOf(empty)).toBe(NOW_COPY[lang].weekEmpty);
    expect(buttonsIn(empty)).toBe(0);
    expectNoNumbers(textOf(empty));
  });
});

describe("VIS-07 · the copy and the frame", () => {
  it("the Together sentence exists in EN and HE; Hebrew carries no Latin; no empty-state line carries a number", () => {
    expect(translate("en", "companion.together-view.empty")).toBe("A good moment needs no other reason.");
    const he = translate("he", "companion.together-view.empty");
    expect(he).not.toBe("companion.together-view.empty");
    expect(he).not.toMatch(/[A-Za-z]/);
    for (const lang of LANGS) {
      for (const key of ["companion.together-view.empty", "companion.portrait.capture", "companion.portrait.emptyAll", "companion.portrait.emptyAllSub"]) {
        expectNoNumbers(translate(lang, key));
      }
      expectNoNumbers(NOW_COPY[lang].weekEmpty);
    }
  });

  it("the empty-state card is framed with logical sides only, so RTL centres the same", () => {
    const css = readFileSync(new URL("./togetherDiscovery.css", import.meta.url), "utf8");
    const rules = css.split("\n").filter((line) => line.includes(".together-empty"));
    expect(rules.length).toBeGreaterThanOrEqual(3);
    for (const rule of rules) expect(rule).not.toMatch(/\b(?:left|right)\b/);
    // The page's `button { font: inherit }` outranks the layered utilities; the one action keeps its weight.
    expect(css).toMatch(/\.companion-together \.together-empty button \{[^}]*font-weight: 600/);
  });
});
