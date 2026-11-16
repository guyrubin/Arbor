import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ firebaseEnabled: false, loading: false, user: null }) }));

/* v3 F-TOG-1 — Together's studio doors and question row (#/practice), re-pinned
   to v10.1. The v3 hero (kicker, title, "choose-together" move and picture)
   was removed on purpose: #/practice is now Together › Routines, whose one
   move is starting a routine, and the doors are its section 2 ("Stories and
   games"). The return-door memory (togetherNavigation) went with the in-page
   filter, so the doors now navigate: a story to the story maker, the games to
   Play (#/daily-play), a favorite to its preview there.
   The page renders as static markup under the TogetherView.test mocks; the
   doors' handlers are read from the captured button props. Invented child
   ("Noa") and invented records only. */

const state = vi.hoisted(() => ({
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] } as Record<string, unknown>,
  lang: "en" as "en" | "he", loaded: true, failed: false, events: [] as Record<string, unknown>[],
  saveMoment: vi.fn(async () => true), setActiveTab: vi.fn(), requestKidMode: vi.fn(), buttons: [] as Record<string, any>[],
  topic: null as null | { id: string; title: string },
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ ...state, activeFamilyTopic: state.topic }) }));
vi.mock("./familyTopicEvents", () => ({ openFamilyTopicSheet: vi.fn() }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: state.loaded, error: state.failed }) }));
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: () => {
  const empty = { items: [], loaded: state.loaded, error: state.failed };
  return { speech: empty, mimic: empty, adventures: empty, events: { ...empty, items: state.events }, missions: empty };
} }));
vi.mock("../../lib/kidExitRecap", () => ({ SINCE_LAST_PLAY_FALLBACK_MS: 7 * 86400000 }));
vi.mock("../../lib/kidModeGate", () => ({ lastKidSessionStartedAt: () => null }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: state.requestKidMode, step: null }) }));
vi.mock("../kidmode/parentGate", () => ({ readParentPin: () => null }));
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPlaceOpen: vi.fn(), trackPracticeStudioOpen: vi.fn(), trackPracticeTogetherDid: vi.fn() }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
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

import TogetherView from "./TogetherView";
import { TOGETHER_COPY } from "../together/togetherCopy";
import { translate } from "../../lib/i18n";
import { routeHash } from "../../lib/routes";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { latestPlayedWorldId, STUDIO_WORLDS, studioWorldsForChild, type StudioCountSource } from "../practice/studioWorlds";

const location = { hash: "" };
beforeEach(() => {
  vi.clearAllMocks();
  state.childProfile = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };
  state.lang = "en"; state.loaded = true; state.failed = false; state.events = []; state.buttons = []; state.topic = null;
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  // "Continue a favorite" moves the address; the page reads it too.
  location.hash = "#/practice";
  vi.stubGlobal("window", { location, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); });

const render = () => renderToStaticMarkup(<TogetherView />);
const esc = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const tr = (lang: "en" | "he", key: string, vars?: Record<string, string | number>) => esc(translate(lang, key, vars));
const buttonMarkup = (html: string, testId: string) => html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";
const button = (testId: string) => state.buttons.find((b) => b["data-testid"] === testId);
const DOORS = [
  ["together-door-story", "/visuals/worlds/v2/story-quest-v2-480.webp", "companion.together-view.door-create-story", (lang: "en" | "he") => TOGETHER_COPY[lang].doorStorySub("Noa")],
  ["together-door-continue", "/visuals/worlds/v2/play-together-v2-480.webp", "companion.together-view.door-continue-favorite", (lang: "en" | "he") => TOGETHER_COPY[lang].doorContinueSub("Noa")],
  ["together-door-find", "/visuals/worlds/v2/mood-mountain-v2-480.webp", "companion.together-view.door-find-play", (lang: "en" | "he") => TOGETHER_COPY[lang].doorFindSub],
] as const;
/** Section 2: from its module to the end of the page. */
const doorsSection = (html: string) => html.slice(html.indexOf('data-module="together-doors"'));

for (const lang of ["en", "he"] as const) describe(`v10.1 · Together's doors · ${lang}`, () => {
  beforeEach(() => { state.lang = lang; });

  it("section 2 names itself and holds three doors, each a picture, a title, a line and a mirrored chevron", () => {
    const html = render();
    const doors = doorsSection(html);
    expect(doors).toContain(`>${esc(TOGETHER_COPY[lang].doorsTitle)}</h2>`);
    expect(doors).toContain(esc(TOGETHER_COPY[lang].doorsSub("Noa")));
    DOORS.forEach(([testId, art, key, sub]) => {
      const door = buttonMarkup(doors, testId);
      expect(door, testId).toMatch(/^<button type="button" class="dm-door"/);
      // The picture is decoration beside the words: empty alt.
      expect(door, testId).toMatch(new RegExp(`<img src="${art}" alt="" width="64" height="64"`));
      expect(door, testId).toContain(`<span class="nm">${tr(lang, key)}</span>`);
      expect(door, testId).toContain(`<span class="s">${esc(sub(lang))}</span>`);
      expect(door, testId).toMatch(/<span class="chev" aria-hidden="true"><span[^>]*class="[^"]*rtl:-scale-x-100[^"]*"[^>]*>chevron_right<\/span><\/span>/);
    });
    const order = DOORS.map(([testId]) => doors.indexOf(`data-testid="${testId}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The doors come after the routines and carry no move of their own.
    expect(html.indexOf('data-module="together-doors"')).toBeGreaterThan(html.indexOf('data-module="together-routines"'));
    expect(doors).not.toContain("data-primary-move");
    // Never a stand-in child: the doors name this child only.
    expect(html).not.toMatch(/\bMia\b|(?<![֐-׿])מיה(?![֐-׿])/);
  });

  it("under three only the story door shows; the games doors go with the games", () => {
    state.childProfile = { id: "child-a", name: "Noa", age: 2, interests: [], activeGoals: [] };
    const html = render();
    expect(html).toContain('data-testid="together-door-story"');
    expect(html).not.toContain('data-testid="together-door-continue"');
    expect(html).not.toContain('data-testid="together-door-find"');
    expect(html.match(/data-module=/g)).toHaveLength(2);
  });

  // v10.1 re-pin: the question row now sits under the guide and before the
  // chain strip and the routines (the hero and the filter row are gone).
  it("the question row sits under the guide and before the routines, with the enjoy note beside the chip", () => {
    state.topic = { id: "topic-a", title: "What helps mornings feel calmer?" };
    const html = render();
    const row = html.indexOf('data-testid="together-question-row"');
    expect(row).toBeGreaterThan(html.indexOf("</nav>"));
    expect(row).toBeLessThan(html.indexOf('data-testid="together-chain"'));
    expect(row).toBeLessThan(html.indexOf('data-module="together-routines"'));
    expect(html.slice(row, html.indexOf('data-testid="together-chain"'))).toContain(tr(lang, "companion.together-view.here-it-is-also-enough-just-to-enjoy"));
    expect(html.match(/data-module=/g)).toHaveLength(2);
  });
});

describe("v3 F-TOG-1 · what the doors do (v10.1: they navigate)", () => {
  it("Create a story opens the story maker; nothing is written and play does not start", () => {
    render();
    button("together-door-story")!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith("bedtime-stories");
    expect(state.saveMoment).not.toHaveBeenCalled(); expect(state.requestKidMode).not.toHaveBeenCalled();
  });

  it("Find something to play opens Play, without starting Kids Studio", () => {
    render();
    button("together-door-find")!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith("daily-play");
    expect(state.requestKidMode).not.toHaveBeenCalled();
  });

  it("Continue a favorite falls back to Play's games when nothing was played", () => {
    render();
    button("together-door-continue")!.onClick();
    expect(location.hash).toBe(routeHash("daily-play", { section: "games" }));
    expect(location.hash).toBe("/daily-play?section=games");
    expect(state.requestKidMode).not.toHaveBeenCalled(); expect(state.setActiveTab).not.toHaveBeenCalled();
  });

  it("Continue a favorite opens the latest world's preview on Play, and nothing starts", () => {
    // One record of a world this child is offered (an invented event).
    const KIND: Record<string, string> = { "word-world": "lang-strategy", feelings: "emotion-id", memory: "memory", reading: "phonics", beat: "rhythm", pose: "pose", pattern: "pattern" };
    const offered = studioWorldsForChild("en", state.childProfile as never).worlds.find((w) => KIND[w.id]);
    expect(offered).toBeDefined();
    state.events = [{ kind: KIND[offered!.id], timestamp: "2026-09-30T08:00:00.000Z" }];
    expect(latestPlayedWorldId({ speech: { items: [] }, mimic: { items: [] }, adventures: { items: [] }, events: { items: state.events as never[] } }, studioWorldsForChild("en", state.childProfile as never).worlds)).toBe(offered!.id);
    render();
    button("together-door-continue")!.onClick();
    expect(location.hash).toBe(routeHash("daily-play", { world: offered!.id }));
    expect(state.requestKidMode).not.toHaveBeenCalled(); expect(state.setActiveTab).not.toHaveBeenCalled();
  });

  it("Play opens that preview once by address and drops it, and lands on the games for ?section=games", () => {
    const studio = readFileSync(new URL("../together/PlayStudio.tsx", import.meta.url), "utf8");
    expect(studio).toContain('const requestedWorld = useHashQuery().get("world");');
    expect(studio).toContain("if (handledWorld.current === key) return;");
    expect(studio).toContain("if (!world || !kidAvailable) return;");
    expect(studio).toContain('window.history.replaceState(window.history.state, "", `#${routeHash("daily-play")}`)');
    const tab = readFileSync(new URL("../tabs/DailyPlayTab.tsx", import.meta.url), "utf8");
    expect(tab).toContain('const requestedSection = useHashQuery().get("section");');
    expect(tab).toContain("scrollToSection(requestedSection)");
  });
});

describe("v3 F-TOG-1 · latestPlayedWorldId", () => {
  const none: StudioCountSource = { speech: { items: [] }, mimic: { items: [] }, adventures: { items: [] }, events: { items: [] } };
  const source = (over: Partial<Record<keyof StudioCountSource, unknown[]>>): StudioCountSource => ({
    speech: { items: (over.speech ?? []) as never[] }, mimic: { items: (over.mimic ?? []) as never[] },
    adventures: { items: (over.adventures ?? []) as never[] }, events: { items: (over.events ?? []) as never[] },
  });

  it("the newest record across every ledger names its world", () => {
    const d = source({
      speech: [{ timestamp: "2026-09-28T09:00:00.000Z" }],
      mimic: [{ timestamp: "2026-09-29T09:00:00.000Z" }],
      events: [{ kind: "rhythm", timestamp: "2026-09-27T09:00:00.000Z" }, { kind: "pattern", timestamp: Date.parse("2026-09-30T09:00:00.000Z") }],
    });
    expect(latestPlayedWorldId(d, STUDIO_WORLDS)).toBe("pattern");
  });

  it("a world the child is not offered, and a record no world claims, are skipped", () => {
    const d = source({
      speech: [{ timestamp: "2026-09-28T09:00:00.000Z" }],
      events: [{ kind: "mood-checkin", timestamp: "2026-10-02T09:00:00.000Z" }, { kind: "rhythm", timestamp: "2026-10-01T09:00:00.000Z" }],
    });
    const offered = STUDIO_WORLDS.filter((w) => w.id !== "beat");
    expect(latestPlayedWorldId(d, offered)).toBe("speech");
  });

  it("no record, or no readable time, is no favourite", () => {
    expect(latestPlayedWorldId(none, STUDIO_WORLDS)).toBeUndefined();
    expect(latestPlayedWorldId(source({ mimic: [{ timestamp: "" }, {}] }), STUDIO_WORLDS)).toBeUndefined();
  });
});

/* v10.1 re-pin: the hero's togetherDiscovery.css rules (phone-first picture,
   48 px move, the 640 px two-column hero) styled the removed hero; the doors
   are now .dm-door in together/together.css. */
describe("v3 F-TOG-1 · the stylesheet and the copy (v10.1)", () => {
  const css = readFileSync(new URL("../together/together.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const experience = readFileSync(new URL("./companionExperience.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  /** One top-level rule block, from its head to its closing brace ("" when absent). */
  const block = (source: string, head: string) => { const at = source.indexOf(head); return at < 0 ? "" : source.slice(at, source.indexOf("\n}", at)); };

  it("every door is a full-width button, well above the 44 px floor, with a visible focus ring", () => {
    expect(css).toMatch(/\.ds \.dm-door\{[^}]*min-height:88px/);
    expect(css).toMatch(/\.ds \.dm-pm \.dm-door\{[^}]*min-height:0;[^}]*padding:8px 12px 8px 8px/);
    expect(css).toMatch(/\.ds \.dm-pm \.dm-door img\{width:52px;height:52px\}/);
    expect(css).toMatch(/\.ds button\.dm-c, \.ds button\.dm-door[^{]*\{ border: 0; font: inherit; text-align: start; cursor: pointer; width: 100%; \}/);
    expect(css).toMatch(/\.ds button\.dm-door:focus-visible/);
    const doors = css.split("\n").filter((line) => line.includes("dm-door")).join("\n");
    expect(doors).not.toMatch(/\b(?:margin|padding|border)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)/);
    expect(doors).not.toMatch(/line-clamp|text-overflow|overflow:\s*hidden/);
  });

  // NOTE (suspected v10.1 regression, reported): these rules are scoped to the
  // `together` container, which only togetherDiscovery.css established on
  // .companion-together; that stylesheet is no longer imported and the class is
  // no longer rendered, so on #/practice they do not currently apply.
  it("on a phone the question line stays one line and the enjoy note steps aside", () => {
    const narrow = block(experience, "@container together (max-width: 540px) {");
    expect(narrow).toContain(".companion-topic-context > .companion-caption { display: none; }");
    expect(narrow).toMatch(/\.companion-topic-context \.companion-topic-chip-text \{[^}]*text-overflow: ellipsis/);
  });

  it("the three doors and their lines read in both languages, Hebrew without Latin", () => {
    // (The kicker went with the hero.)
    const keys = ["companion.together-view.door-create-story", "companion.together-view.door-continue-favorite", "companion.together-view.door-find-play"];
    for (const key of keys) {
      const en = (companionEn as Record<string, string>)[key], he = (companionHe as Record<string, string>)[key];
      expect(en, key).toBeTruthy(); expect(he, key).toBeTruthy();
      expect(he, key).not.toBe(en);
      expect(he, key).not.toMatch(/[A-Za-z]/);
      expect(he, key).toMatch(/[֐-׿]/);
    }
    const lines = (lang: "en" | "he") => [TOGETHER_COPY[lang].doorsTitle, TOGETHER_COPY[lang].doorsSub("Noa"), TOGETHER_COPY[lang].doorStorySub("Noa"), TOGETHER_COPY[lang].doorContinueSub("Noa"), TOGETHER_COPY[lang].doorFindSub];
    lines("he").forEach((he, i) => {
      expect(he).not.toBe(lines("en")[i]);
      expect(he.replace("Noa", "")).not.toMatch(/[A-Za-z]/);
      expect(he).toMatch(/[֐-׿]/);
    });
  });
});
