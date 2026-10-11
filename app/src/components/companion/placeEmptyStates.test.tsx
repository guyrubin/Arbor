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
 *  - Together says its sentence once and shows its picture once; the hero
 *    drops its own copy of the picture while the empty state carries it.
 *  - Together's empty state is a FIRST-TIME state: it waits for every read,
 *    never treats a failed read as empty, and leaves once anything is on record.
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
    milestones: [], actionLoop: [], activeFamilyTopic: null,
    behaviorLogs: state.behaviorLogs, logsLoaded: state.logsLoaded,
    openCaptureSheet: state.openCaptureSheet, setActiveTab: state.setActiveTab, saveMoment: state.saveMoment,
    seedCoach: vi.fn(), requestJournalFocus: vi.fn(),
  });
  return { useArbor: value, useArborOptional: value };
});
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
import { translate } from "../../lib/i18n";
import { TOGETHER_ART } from "../../lib/parentArt";

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
/** Rendered pictures of the Together art: <img> tags only (React 19 also emits a
 *  <link rel="preload"> carrying the same srcset for an eager image). */
const togetherPictures = (html: string) => (html.match(/<img[^>]*>/g) ?? []).filter((tag) => tag.includes(TOGETHER_ART.src)).length;
const buttonsIn = (html: string) => (html.match(/<button\b/g) ?? []).length;
const labelOf = (button: Record<string, any>) => React.Children.toArray(button.children).filter((child) => typeof child === "string").join("");

const TOGETHER_EMPTY = /<section[^>]*data-testid="together-empty"[^>]*>[\s\S]*?<\/section>/;
const renderTogether = () => renderToStaticMarkup(<TogetherView />);

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en"; state.observations = []; state.behaviorLogs = []; state.logsLoaded = true;
  state.playItems = []; state.loaded = true; state.failed = false; state.buttons = [];
});

describe("VIS-07 · My child: the picture starts with your life together", () => {
  it.each(LANGS)("%s: one picture, one sentence, one Keep a moment that opens the capture sheet, no numbers", (lang) => {
    state.lang = lang;
    const html = renderToStaticMarkup(<ChildPortrait />);
    const empty = branch(html, /<div class="portrait-empty">[\s\S]*?<\/button><\/div><\/div>/);
    expect(empty).toContain('data-testid="portrait-empty-art"');
    expect(textOf(empty)).toContain(t("companion.portrait.emptyAll"));
    expect(buttonsIn(empty), "exactly ONE action").toBe(1);
    expectNoNumbers(textOf(empty));
    const cta = state.buttons.filter((button) => button.className === "portrait-primary" && labelOf(button) === t("companion.portrait.capture"));
    expect(cta).toHaveLength(1);
    cta[0].onClick();
    expect(state.openCaptureSheet).toHaveBeenCalledOnce();
  });
});

describe("VIS-07 · Together: a good moment needs no other reason", () => {
  it.each(LANGS)("%s: the picture, the sentence once, one Keep a moment at 44 px, no numbers", (lang) => {
    state.lang = lang;
    const html = renderTogether();
    const empty = branch(html, TOGETHER_EMPTY);
    const sentence = t("companion.together-view.empty");
    expect(sentence).not.toBe("companion.together-view.empty");
    expect(textOf(empty)).toContain(sentence);
    expect(occurrences(html, sentence), "the sentence is said once on the page").toBe(1);
    // The hero never repeats it: its old subline is not on the page.
    expect(html).not.toContain(t("companion.together-view.a-story-to-get-lost-in-a-game-to-wonder-at"));
    expect(empty).toContain('data-testid="empty-state-art"');
    expect(togetherPictures(html), "the Together picture shows once").toBe(1);
    expect(buttonsIn(empty), "exactly ONE action").toBe(1);
    expectNoNumbers(textOf(empty));
    const cta = state.buttons.find((button) => button["data-testid"] === "together-empty-cta");
    expect(cta).toBeDefined();
    expect(labelOf(cta!)).toBe(t("companion.portrait.capture"));
    expect(String(cta!.className)).toContain("min-h-[44px]");
    cta!.onClick();
    expect(state.openCaptureSheet).toHaveBeenCalledOnce();
    expect(state.saveMoment).not.toHaveBeenCalled();
  });

  it.each(LANGS)("%s: it sits under the invitation, before the catalogue, centred, inside the page budget", (lang) => {
    state.lang = lang;
    const html = renderTogether();
    const at = html.indexOf('data-testid="together-empty"');
    expect(at).toBeGreaterThan(html.indexOf('class="together-suggestion"'));
    expect(at).toBeLessThan(html.indexOf('class="companion-filter-row"'));
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(branch(html, TOGETHER_EMPTY)).toMatch(/class="[^"]*items-center[^"]*text-center[^"]*together-empty"/);
    expect(branch(html, TOGETHER_EMPTY)).not.toContain("data-module=");
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html.match(/data-module=/g)).toHaveLength(4);
  });

  it("waits for every read, never calls a failed read empty, and leaves once anything is on record", () => {
    expect(renderTogether()).toContain('data-testid="together-empty"');
    state.loaded = false;
    expect(renderTogether()).not.toContain('data-testid="together-empty"');
    state.loaded = true; state.logsLoaded = false;
    expect(renderTogether()).not.toContain('data-testid="together-empty"');
    state.logsLoaded = true; state.failed = true;
    expect(renderTogether()).not.toContain('data-testid="together-empty"');
    state.failed = false; state.behaviorLogs = [{ id: "moment-1" }];
    const kept = renderTogether();
    expect(kept).not.toContain('data-testid="together-empty"');
    // Without the empty state the hero carries the picture again, once.
    expect(togetherPictures(kept)).toBe(1);
    // Play on record, even long ago, means this is not a first visit.
    state.behaviorLogs = []; state.playItems = [{ id: "event-1", timestamp: "2020-01-06T10:00:00.000Z", kind: "rhythm" }];
    expect(renderTogether()).not.toContain('data-testid="together-empty"');
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
