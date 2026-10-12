import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { StudioWorld } from "../practice/studioWorlds";
const state = vi.hoisted(() => ({
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] },
  previewWorld: null as StudioWorld | null, kept: [] as string[], lang: "en" as "en" | "he", loaded: true, failed: false, pin: null as string | null,
  saveMoment: vi.fn(async () => true), setActiveTab: vi.fn(), requestKidMode: vi.fn(), buttons: [] as Record<string, any>[],
  topic: null as null | { id: string; title: string }, openSheet: vi.fn(), openSettings: vi.fn(),
  // v3 F-TOG-2: the pill is the hash query (#/practice?f=…); goToRoute is how the page moves it.
  query: "", goToRoute: vi.fn(), sheets: [] as Record<string, any>[], events: [] as Record<string, unknown>[],
  // v3 F-TOG-2: true stands in the Shell's own Together row (PLACE_PILLS.together, F-SHELL-1).
  shellRow: false,
  // The child's story runs (heroRuns); invented, empty unless a test says otherwise.
  runs: [] as Record<string, unknown>[],
}));
// The Shell draws a row when pillRowFor gives it more than one pill; shellRow lends Together one.
vi.mock("../../lib/navigation", async (original) => {
  const real = await original<typeof import("../../lib/navigation")>();
  return { ...real, pillRowFor: (...args: Parameters<typeof real.pillRowFor>) => (state.shellRow && args[1] === "practice" ? real.PLACE_PILLS.now : real.pillRowFor(...args)) };
});
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: (initial: any) => {
    if (state.previewWorld && initial && typeof initial === "object" && "value" in initial) return real.useState({ ...initial, value: { kind: "world", world: state.previewWorld } });
    if (state.kept.length && initial && typeof initial === "object" && "ids" in initial) return real.useState({ ...initial, ids: state.kept });
    return real.useState(initial);
  } };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ ...state, activeFamilyTopic: state.topic }) }));
vi.mock("./familyTopicEvents", () => ({ openFamilyTopicSheet: (...args: unknown[]) => state.openSheet(...args) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_childId: string, name: string) => ({ items: name === "heroRuns" ? state.runs : [], loaded: state.loaded, error: state.failed }) }));
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams(state.query), goToRoute: (...args: unknown[]) => state.goToRoute(...args) }));
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: () => {
  const collection = { items: [], loaded: state.loaded, error: state.failed };
  return { speech: collection, mimic: collection, adventures: collection, events: { ...collection, items: state.events }, missions: collection };
} }));
vi.mock("../../lib/kidExitRecap", () => ({ SINCE_LAST_PLAY_FALLBACK_MS: 7 * 86400000 }));
vi.mock("../../lib/kidModeGate", () => ({ lastKidSessionStartedAt: () => null }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: state.requestKidMode, step: null }) }));
vi.mock("../kidmode/parentGate", () => ({ readParentPin: () => state.pin }));
vi.mock("../layout/settingsBus", async (original) => ({ ...(await original<typeof import("../layout/settingsBus")>()), requestOpenSettings: (...args: unknown[]) => state.openSettings(...args) }));
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPlaceOpen: vi.fn(), trackPracticeStudioOpen: vi.fn(), trackPracticeTogetherDid: vi.fn() }));
// The sheet portals in the browser; here it renders its content in place and records its props.
// (React's dev build also calls a component with no props to read its stack frame when a child suspends.)
vi.mock("../ui/Sheet", () => ({ Sheet: (props?: Record<string, any>) => { if (!props) return null; state.sheets.push(props); return props.children; } }));
// The story maker loads lazily; once loaded it shows as a marker carrying its embedded flag.
vi.mock("../tabs/BedtimeStoriesTab", async () => {
  const { createElement } = await import("react");
  return { BedtimeStoryBody: (props: { embedded?: boolean }) => createElement("div", { "data-testid": "story-maker", "data-embedded": String(Boolean(props.embedded)) }) };
});
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
import { readTogetherReturn, TOGETHER_ARRIVAL_QUERY } from "./togetherNavigation";
import { translate } from "../../lib/i18n";
import { opensInKidMode, STUDIO_WORLDS, studioCountKey, studioWorldsForChild, worksInLanguage } from "../practice/studioWorlds";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { pillRowFor, sectionForTab } from "../../lib/navigation";
import { ageYearsOf } from "../../lib/age/forChild";
import { localizeActivity } from "../../playbank/content";
import { daySeedFor, selectDailyPlay } from "../../playbank/select";
beforeEach(() => {
  vi.clearAllMocks(); state.childProfile = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };
  state.previewWorld = null; state.kept = []; state.lang = "en"; state.loaded = true; state.failed = false; state.pin = null; state.buttons = []; state.topic = null;
  state.query = ""; state.sheets = []; state.events = []; state.shellRow = false; state.runs = [];
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
const render = () => renderToStaticMarkup(<TogetherView />);
const esc = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function section(html: string, name: string) { return html.match(new RegExp(`<section[^>]*data-module="${name}"[^>]*>`))![0]; }
function sectionBody(html: string, name: string) { const at = html.indexOf(`data-module="${name}"`); return html.slice(at, html.indexOf("</section>", at)); }
function hero(html: string) { const at = html.indexOf('data-module="together-invitation"'); return html.slice(at, html.indexOf("</section>", at)); }
/** The gate card closes the page (the entry step renders nothing here; a sheet, when one is open, follows it). */
function gate(html: string) { return html.slice(html.indexOf('data-testid="together-gate"')); }
const button = (testId: string) => state.buttons.find((b) => b["data-testid"] === testId);
const awayCard = (html: string, id: string) => html.match(new RegExp(`<li class="together-away-card" data-testid="together-away-${id}">[\\s\\S]*?</li>`))?.[0] ?? "";
/** A Daily play pick's card: its steps are a list inside it, so it ends at its keep button. */
const playCard = (html: string, id: string) => html.match(new RegExp(`<li class="together-away-card" data-testid="together-away-play-${id}">[\\s\\S]*?</button></li>`))?.[0] ?? "";
const PLAY_CARDS = /<li class="together-away-card" data-testid="together-away-play-[\s\S]*?<\/button><\/li>/g;
/** Text a parent reads: markup stripped, so a picture's path is not read as a number. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ");
const VERDICT = /\d\s*%|\b\d+\s*\/\s*\d+\b|\b\d+\s+(?:of|out of)\s+\d+\b|מתוך|role="progressbar"|<progress/;
describe("Together's compact discovery", () => {
  it.each(["en", "he"] as const)("leads with the kicker, the title, the sub and one move, then the sections in the mock's order (%s)", (lang) => {
    state.lang = lang; const html = render();
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    const top = hero(html);
    expect(top).toContain(esc(translate(lang, "companion.together-view.kicker")));
    expect(top).toContain(esc(translate(lang, "companion.together-view.a-little-world-to-discover-with", { value0: "Noa" })));
    expect(top).toContain(esc(translate(lang, "companion.together-view.a-story-to-get-lost-in-a-game-to-wonder-at")));
    expect(top).toMatch(/<button type="button" class="companion-primary together-hero-cta" data-primary-move="choose-together" data-testid="together-cta">/);
    expect(top).toContain(esc(translate(lang, "companion.together-view.one-small-idea-for-time-together")));
    expect(html.match(/data-primary-move=/g)).toHaveLength(1); expect(html.match(/data-module=/g)).toHaveLength(5);
    expect(html.split(esc(translate(lang, "companion.offscreen.build.title")))).toHaveLength(2);
    const order = ['data-module="together-invitation"', 'data-module="together-games"', 'data-module="together-stories"', 'data-module="together-routines"', 'data-module="together-offscreen"', 'data-testid="together-gate"'].map((mark) => html.indexOf(mark));
    expect(order.every((at) => at >= 0)).toBe(true); expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const gone of ["together-suggestion", "together-handover", "together-play-history", "together-since", "<details", "companion-together-footer"]) expect(html).not.toContain(gone);
    expect("companion.together-view.together-room-for-curiosity-and-connection" in (lang === "he" ? companionHe : companionEn)).toBe(false);
    // v3 F-TOG-2: the five pills are one row (the page's own until the Shell draws one); no filter row, no sheet open.
    expect(html).not.toContain("companion-filter"); expect(state.sheets).toHaveLength(0);
    expect(html.includes('data-testid="together-pill-row"')).toBe(pillRowFor(sectionForTab("practice"), "practice").length <= 1);
  });
  it.each(["en", "he"] as const)("closes with one gate card: the PIN line, Parent settings and Start playing (%s)", (lang) => {
    state.lang = lang; const card = gate(render());
    expect(card).toContain(">lock</span>"); expect(card).toContain(">play_arrow</span>");
    expect(card).toContain(esc(translate(lang, "companion.together-view.play-opens-in-the-child-area-set-a-pin-to")));
    expect(card).toContain(`<button type="button" class="companion-text-button" data-testid="together-gate-pin">${esc(translate(lang, "companion.together-view.parent-settings"))}</button>`);
    expect(card).toContain(`data-testid="together-start-playing"`); expect(card).toContain(esc(translate(lang, "companion.together-view.start-playing")));
    // The Kid Mode promises, the practice note and the PIN nudge now live in Settings › PIN.
    for (const key of ["elev.practice.door.gated", "elev.practice.door.private", "elev.practice.door.stars", "practice.studio.note", "elev.gate.set.title"]) expect(card).not.toContain(esc(translate(lang, key)));
    state.pin = "0000"; const locked = gate(render());
    expect(locked).toContain(esc(translate(lang, "companion.together-view.you-choose-when-to-enter-play-your-pin-pro")));
    expect(locked).not.toContain('data-testid="together-gate-pin"'); expect(locked).toContain('data-testid="together-start-playing"');
  });
  it("opening the page writes nothing; the CTA chooses the away ideas and the gate starts play", () => {
    render(); expect(state.saveMoment).not.toHaveBeenCalled(); expect(state.requestKidMode).not.toHaveBeenCalled(); expect(state.setActiveTab).not.toHaveBeenCalled();
    expect(state.goToRoute).not.toHaveBeenCalled();
    button("together-cta")!.onClick();
    expect(state.goToRoute).toHaveBeenCalledWith("practice", { f: "offscreen" });
    button("together-gate-pin")!.onClick(); expect(state.openSettings).toHaveBeenCalledWith({ focus: "pin" });
    button("together-start-playing")!.onClick(); expect(state.requestKidMode).toHaveBeenCalledOnce(); expect(state.requestKidMode).toHaveBeenCalledWith();
    expect(state.saveMoment).not.toHaveBeenCalled();
  });
  it("the pill is the address: f=stories shows the stories alone, per child, and an unknown f is All together", () => {
    state.query = "f=stories"; const selected = render();
    expect(section(selected, "together-stories")).not.toContain("hidden"); expect(section(selected, "together-games")).toContain("hidden");
    expect(section(selected, "together-routines")).toContain("hidden"); expect(section(selected, "together-offscreen")).toContain("hidden");
    expect(selected.match(/data-module=/g)).toHaveLength(5);
    state.query = "f=nope"; const all = render();
    for (const name of ["together-games", "together-stories", "together-routines", "together-offscreen"]) expect(section(all, name), name).not.toContain("hidden");
    state.query = "f=offscreen"; state.childProfile.id = "child-b"; const other = render();
    expect(section(other, "together-offscreen")).not.toContain("hidden"); expect(section(other, "together-games")).toContain("hidden");
  });
  it("Word World opens its parent tool and remembers its card on the Games pill (en)", () => {
    state.childProfile.age = 6; state.query = "f=games"; state.previewWorld = STUDIO_WORLDS.find((world) => world.id === "word-world")!;
    const html = render();
    expect(html).toContain('data-together-return="world-word-world"');
    expect(html).toContain('data-testid="together-world-preview"');
    expect(state.sheets.map((sheet) => sheet.title)).toEqual([translate("en", "elev.practice.world.kid.words")]);
    const open = button("together-world-open");
    expect(React.Children.toArray(open!.children)).toContain(translate("en", "companion.together-view.open"));
    open!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith("language"); expect(readTogetherReturn("child-a")).toEqual({ category: "games", returnDoor: "world-word-world" });
    expect(state.requestKidMode).not.toHaveBeenCalled();
  });
  it("in Hebrew the English voice game stays a preview: the note, no open button, no drill page (he)", () => {
    state.lang = "he"; state.childProfile.age = 6; state.query = "f=games"; state.previewWorld = STUDIO_WORLDS.find((world) => world.id === "speech")!;
    const html = render();
    expect(html).toContain('data-together-return="world-speech"');
    expect(html).toContain(esc(translate("he", "companion.together-view.this-voice-game-is-currently-in-english-op")));
    expect(html).not.toContain('data-testid="together-world-open"'); expect(button("together-world-open")).toBeUndefined();
    expect(state.setActiveTab).not.toHaveBeenCalled(); expect(state.requestKidMode).not.toHaveBeenCalled();
    expect(readTogetherReturn("child-a")).toBeNull();
  });
  it.each(["en", "he"] as const)("an old drill link arrives as ?world= and opens that world's preview; play starts only through the Kid Mode gate (%s)", (lang) => {
    state.lang = lang; state.childProfile.age = 6;
    const world = studioWorldsForChild(lang, state.childProfile as never).worlds.find((w) => worksInLanguage(w, lang) && opensInKidMode(w))!;
    state.query = `f=games&world=${world.id}`;
    const html = render();
    expect(html).toContain(`data-testid="together-world-preview" data-world="${world.id}"`);
    expect(state.sheets.map((sheet) => sheet.title)).toEqual([translate(lang, world.kidNameKey)]);
    expect(section(html, "together-games")).not.toContain("hidden");
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    button("together-world-open")!.onClick();
    expect(state.requestKidMode).toHaveBeenCalledWith({ view: "arcade", worldId: world.id });
    expect(state.setActiveTab).not.toHaveBeenCalled(); expect(state.goToRoute).not.toHaveBeenCalled();
    // An unknown world, or a world this child is not offered, opens nothing.
    state.sheets = []; state.query = "f=games&world=nope"; render(); expect(state.sheets).toHaveLength(0);
    state.childProfile.age = 2; state.query = `f=games&world=${world.id}`; render(); expect(state.sheets).toHaveLength(0);
  });
  it.each(["en", "he"] as const)("?sheet=create-story (the old story-maker page) opens Create a story in a sheet over the Stories pill (%s)", async (lang) => {
    state.lang = lang; state.query = "f=stories&sheet=create-story";
    const maker = '<div data-testid="story-maker" data-embedded="true"></div>';
    const first = render();
    expect(first).toContain('data-testid="together-create-sheet"');
    expect(state.sheets.map((sheet) => sheet.title)).toEqual([translate(lang, "companion.together-view.door-create-story")]);
    // While the story maker loads, the sheet says so; then it is the maker, embedded (no page header).
    expect(first.includes(esc(translate(lang, "companion.together-view.story-opening"))) || first.includes(maker)).toBe(true);
    await vi.waitFor(() => expect(render()).toContain(maker));
    const html = render();
    expect(section(html, "together-stories")).not.toContain("hidden");
    expect(html.match(/data-primary-move=/g)).toHaveLength(1); expect(html.match(/data-module=/g)).toHaveLength(5);
  });
  it("Create a story opens its sheet in place: no page, no new address", () => {
    render();
    button("together-door-story")!.onClick();
    button("together-create-story")!.onClick();
    expect(state.setActiveTab).not.toHaveBeenCalled(); expect(state.goToRoute).not.toHaveBeenCalled();
    expect(readTogetherReturn("child-a")).toBeNull();
  });
  it("keeps age gates after restoring an obsolete games choice", () => {
    state.query = "f=games"; state.childProfile.age = 2; const html = render();
    expect(html).not.toContain('data-testid="together-start-playing"'); expect(html).not.toContain('data-module="together-games"');
    expect(html).not.toContain('data-testid="together-door-continue"'); expect(html).not.toContain('data-testid="together-door-find"');
    expect(html).toContain('data-testid="together-door-story"');
    const card = gate(html);
    expect(card).not.toContain("<button"); expect(card).not.toContain(">lock</span>");
    expect(card).toContain(esc(translate("en", "elev.ages.practice.fromThree", { name: "Noa" })));
    expect(html).toContain(translate("en", "elev.ages.together.copy-faces.title")); expect(section(html, "together-stories")).not.toContain("hidden");
    expect(html.match(/data-module=/g)).toHaveLength(4); expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });
  it("uses real content-width queries and no clipped activity copy", () => {
    const css = readFileSync(new URL("./togetherDiscovery.css", import.meta.url), "utf8");
    expect(css).toContain("container-name: together"); expect(css).toContain("@container together (max-width: 540px)");
    expect(css).toMatch(/@container together[\s\S]*\.companion-story-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
    expect(css).not.toMatch(/line-clamp|text-overflow|overflow:\s*hidden/);
    expect(css.match(/font-family:/g)).toHaveLength(1);
    expect(css).toMatch(/\.companion-together \.companion-say,\s*\.companion-preview \.companion-say \{ font-family: var\(--font-sans\); font-size: var\(--t-base\); font-style: normal; line-height: 1\.6 !important;/);
  });
});

describe("v3 F-TOG-2 — the five pills' cards", () => {
  const KIND: Record<string, string> = { "word-world": "lang-strategy", feelings: "emotion-id", memory: "memory", reading: "phonics", beat: "rhythm", pose: "pose", pattern: "pattern" };

  it.each(["en", "he"] as const)("every game in All together: its picture, name and area chip, its count since the last play, and Preview first (%s)", (lang) => {
    state.lang = lang;
    const worlds = studioWorldsForChild(lang, state.childProfile as never).worlds;
    const played = worlds.find((w) => KIND[w.id])!;
    expect(played).toBeDefined();
    state.events = [{ kind: KIND[played.id], timestamp: new Date().toISOString() }];
    const games = sectionBody(render(), "together-games");
    expect(games.match(/<button type="button" data-together-return="world-[^"]+" class="together-game-card">/g)).toHaveLength(worlds.length);
    expect(games.match(/class="together-game-art"/g)).toHaveLength(worlds.length);
    // A game that does not speak this language yet says so instead of Preview first.
    const speaks = worlds.filter((w) => worksInLanguage(w, lang)).length;
    expect(games.split(esc(translate(lang, "companion.together-view.preview-first")))).toHaveLength(speaks + 1);
    expect(games.split(esc(translate(lang, "companion.together-view.english-only")))).toHaveLength(worlds.length - speaks + 1);
    for (const world of worlds) {
      expect(games).toContain(esc(translate(lang, world.kidNameKey)));
      expect(games).toContain(`>${esc(translate(lang, `elev.domains.${world.domains[0]}`))}</span>`);
    }
    // Area chips draw from the domain tokens, never a verdict colour.
    expect(games).toMatch(/class="together-domain-chip" style="background:var\(--arbor-domain-[a-z]+-soft\);color:var\(--arbor-domain-[a-z]+-ink\)"/);
    const count = games.match(/<span class="companion-world-count" data-testid="together-world-count">([^<]*)<\/span>/g);
    expect(count).toHaveLength(1);
    expect(count![0]).toContain(esc(translate(lang, studioCountKey(played.unit, 1), { n: 1 })));
    // The same count on the Games pill; no "All games" link.
    state.query = "f=games";
    const pill = sectionBody(render(), "together-games");
    expect(pill.match(/data-testid="together-world-count"/g)).toHaveLength(1);
    expect(pill).not.toContain("data-together-return=\"all-games\"");
    expect(text(games)).not.toMatch(VERDICT);
  });

  it("no count until every play record has loaded, and none for a world not played", () => {
    state.loaded = false; const loading = sectionBody(render(), "together-games");
    expect(loading).not.toContain("together-world-count"); expect(loading).toContain('aria-busy="true"');
    state.loaded = true; const quiet = sectionBody(render(), "together-games");
    expect(quiet).not.toContain("together-world-count"); expect(quiet).not.toContain('aria-busy="true"');
  });

  it.each(["en", "he"] as const)("every away idea is whole on its card: what to do, what to say and Keep the moment, in place (%s)", (lang) => {
    state.lang = lang; state.query = "f=offscreen";
    const html = render();
    for (const [id, icon] of [["build", "toys"], ["listen", "hearing"], ["story", "auto_stories"]] as const) {
      const card = awayCard(html, id);
      expect(card, id).not.toBe("");
      expect(card).toContain(`>${icon}</span>`);
      expect(card).toContain(`<h3>${esc(translate(lang, `companion.offscreen.${id}.title`))}</h3>`);
      expect(card).toContain(`<p class="together-away-detail">${esc(translate(lang, `companion.offscreen.${id}.detail`))}</p>`);
      expect(card).toContain(`<p class="companion-say" dir="auto">${esc(translate(lang, "elev.loop.ms.quoted", { text: translate(lang, `companion.offscreen.${id}.say`) }))}</p>`);
      expect(card).toMatch(/<button type="button" class="together-keep" data-testid="together-keep">/);
      expect(card).toContain(">bookmark_add</span>"); expect(card).toContain(esc(translate(lang, "companion.together-view.we-already-tried-it-keep-the-moment")));
      expect(card).not.toContain(esc(translate(lang, "companion.together-view.a-moment-from-your-time-together-is-saved")));
    }
    // The preview step, "How to begin" and "More ideas" are gone (their copy left the dictionary); nothing opens a sheet.
    const away = sectionBody(html, "together-offscreen");
    expect(html).not.toContain('data-together-return="more-ideas"'); expect(state.sheets).toHaveLength(0);
    // Daily play's picks are activity copy, read on their own below; the rest of the section as before.
    expect(text(away.replace(PLAY_CARDS, ""))).not.toMatch(VERDICT);
  });

  it.each(["en", "he"] as const)("Daily play's three picks follow the ideas, whole: what it builds, the steps, Keep the moment; no reason, no done, no plan (%s)", async (lang) => {
    state.lang = lang; state.query = "f=offscreen";
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-12T09:00:00.000Z"));
    try {
      const html = render();
      const picks = selectDailyPlay({ ageYears: ageYearsOf(state.childProfile as never), concernDomains: [], goalDomains: [], recentlyDoneIds: [], daySeed: daySeedFor(Date.now()), interests: [], sessionLength: "standard" }, 3)
        .map((pick) => localizeActivity(pick.activity, lang));
      expect(picks).toHaveLength(3);
      const away = sectionBody(html, "together-offscreen");
      expect(away.match(/data-testid="together-away-play-/g)).toHaveLength(3);
      // After the three ideas, in the selection's order.
      const at = picks.map((pick) => away.indexOf(`data-testid="together-away-play-${pick.id}"`));
      expect(at.every((n) => n > away.indexOf('data-testid="together-away-story"'))).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      for (const pick of picks) {
        const card = playCard(html, pick.id);
        expect(card, pick.id).not.toBe("");
        expect(card).toContain(">eco</span>");
        expect(card).toContain(`<h3>${esc(pick.title)}</h3>`);
        expect(card).toContain(`<p class="together-away-detail">${esc(pick.whatItBuilds)}</p>`);
        expect(card).toContain(`<ol class="together-away-steps">${pick.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>`);
        expect(card).toMatch(/<button type="button" class="together-keep" data-testid="together-keep">/);
        // Counts only: no reason line, no done or plan state, no number about the child.
        const tags = card.replace(/>[^<]*</g, "><");
        for (const gone of ["dp-reason", "dp-done", "plan-", "progress", "aria-valuenow"]) expect(tags).not.toContain(gone);
        expect(text(card)).not.toMatch(/\d\s*%|\b\d+\s*\/\s*\d+\b|\b\d+\s+(?:of|out of)\s+\d+\b|\d+\s*מתוך\s*\d+/);
      }
      expect(state.buttons.filter((b) => b["data-testid"] === "together-keep")).toHaveLength(6);
      // Keeping a pick saves the same moment an idea saves, through the caller-owned save.
      state.buttons.filter((b) => b["data-testid"] === "together-keep")[3].onClick(); await Promise.resolve();
      expect(state.saveMoment).toHaveBeenCalledOnce();
      expect(state.saveMoment).toHaveBeenCalledWith(translate(lang, "companion.together-view.we-tried-together", { value0: picks[0].title }), { callerShowsFailure: true });
    } finally { vi.useRealTimers(); }
  });

  it.each(["en", "he"] as const)("Keep the moment writes once through the caller-owned save, and only a kept idea says saved (%s)", async (lang) => {
    state.lang = lang; state.query = "f=offscreen";
    render();
    const keeps = state.buttons.filter((b) => b["data-testid"] === "together-keep");
    // v3 F-TOG-2 re-pin: three ideas and Daily play's three picks, each with its own keep.
    expect(keeps).toHaveLength(6);
    keeps[0].onClick(); await Promise.resolve();
    expect(state.saveMoment).toHaveBeenCalledOnce();
    expect(state.saveMoment).toHaveBeenCalledWith(translate(lang, "companion.together-view.we-tried-together", { value0: translate(lang, "companion.offscreen.build.title") }), { callerShowsFailure: true });
    // Once the write resolved, the card turns (the kept list is what the resolved write sets).
    state.kept = ["build"]; state.buttons = [];
    const html = render();
    const kept = awayCard(html, "build");
    expect(kept).toMatch(/<button type="button" class="together-keep" data-testid="together-keep" data-kept="true" disabled="">/);
    expect(kept).toContain(">check_circle</span>"); expect(kept).toContain(esc(translate(lang, "companion.together-view.a-moment-from-your-time-together-is-saved")));
    expect(awayCard(html, "listen")).toContain(">bookmark_add</span>"); expect(awayCard(html, "listen")).not.toContain("disabled");
    const source = readFileSync(new URL("./TogetherView.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    expect(source).toContain("if (await saveMoment(moment, { callerShowsFailure: true })) { setKeptState({ childId: childProfile.id, ids: [...kept, id] });");
  });

  it("under three the away cards are the age's together cards, each whole, with the same keep", () => {
    state.childProfile.age = 2; const html = render();
    const card = awayCard(html, "copy-faces");
    expect(card).toContain(esc(translate("en", "elev.ages.together.copy-faces.title")));
    expect(card).toContain(esc(translate("en", "elev.ages.together.copy-faces.do")));
    expect(card).toContain('data-testid="together-keep"');
  });

  it.each(["en", "he"] as const)("the Stories pill lists real story cards and Create a story; no story doors, no family door (%s)", (lang) => {
    state.lang = lang; state.query = "f=stories";
    const stories = sectionBody(render(), "together-stories");
    expect(stories).toContain('data-testid="together-stories"');
    expect(stories.match(/class="together-story-card" data-story="/g)?.length ?? 0).toBeGreaterThan(0);
    expect(stories).toContain('data-testid="together-create-story"');
    expect(stories).not.toContain("companion-story-card"); expect(stories).not.toContain("data-together-return");
    expect(text(stories)).not.toMatch(VERDICT);
  });

  it.each(["en", "he"] as const)("a story started and not finished leads, chipped Continues tonight; tonight's pick follows it (%s)", (lang) => {
    state.lang = lang; state.query = "f=stories";
    const before = [...sectionBody(render(), "together-stories").matchAll(/data-story="([^"]+)"/g)].map((m) => m[1]);
    expect(before.length).toBeGreaterThan(1);
    const pick = before[before.length - 1];
    // Invented runs: the last story on the shelf started and not finished; the first one read to its end.
    state.runs = [
      { id: "run-b", storyId: pick, startedAt: "2026-10-10T18:00:00.000Z" },
      { id: "run-a", storyId: before[0], startedAt: "2026-10-01T18:00:00.000Z", completedAt: "2026-10-01T18:20:00.000Z" },
    ];
    const stories = sectionBody(render(), "together-stories");
    const order = [...stories.matchAll(/data-story="([^"]+)"/g)].map((m) => m[1]);
    expect(order[0]).toBe(pick);
    const lead = stories.slice(stories.indexOf(`data-story="${pick}"`), stories.indexOf("</button>", stories.indexOf(`data-story="${pick}"`)));
    expect(lead).toContain(`data-testid="together-story-continue">${esc(translate(lang, "companion.together-view.story-continue"))}</span>`);
    expect(stories.match(/data-testid="together-story-continue"/g)).toHaveLength(1);
    const tonight = stories.indexOf('data-testid="together-story-tonight"');
    if (tonight >= 0) expect(stories.lastIndexOf("data-story=", tonight)).toBe(stories.indexOf(`data-story="${order[1]}"`));
    expect(text(stories)).not.toMatch(VERDICT);
  });

  it("the Stories module renders only where its pill shows it", () => {
    state.query = "f=games"; state.childProfile.age = 6;
    const html = render();
    expect(html).toContain('data-module="together-stories"');
    expect(html).not.toContain('data-testid="together-stories"'); expect(html).not.toContain("together-story-card");
    expect(html.match(/data-module=/g)).toHaveLength(5);
  });

  it("the copy of the retired doors, links and steps left both dictionaries", () => {
    const GONE = [
      ...["library", "bedtime", "comics", "family"].flatMap((k) => [`companion.story.${k}.title`, `companion.story.${k}.detail`]),
      ...["at-this-age-shared-time-is-led-by-you-the", "explore", "illustration-of-an-open-book-building-bloc", "preview-before-playing",
        "routines-all", "routines-areas", "routines-start", "routines-close", "story-read", "back-to-stories",
        "you-can-put-the-screen-down-and-try-it-the", "what-feels-right-now", "all-games", "all-stories", "choose-and-preview",
        "how-to-begin", "let-s-give-it-a-try", "more-ideas", "together-room-for-curiosity-and-connection"].map((k) => `companion.together-view.${k}`),
    ];
    for (const key of GONE) { expect(key in companionEn, key).toBe(false); expect(key in companionHe, key).toBe(false); }
    // The voice-game note and the Feeds chip stay, in both languages; Hebrew "feeds" agrees with "routine" (feminine).
    expect(companionHe["companion.together-view.routines-feeds"]).toBe("מזינה: {areas}");
    expect(companionEn["companion.together-view.english-only"]).toBe("English only for now");
    expect(companionHe["companion.together-view.english-only"]).toBe("כרגע רק באנגלית");
  });

  it("in Hebrew a voice game that speaks only English says so on its card, never Preview first", () => {
    state.lang = "he"; state.childProfile.age = 6;
    const worlds = studioWorldsForChild("he", state.childProfile as never).worlds;
    const games = sectionBody(render(), "together-games");
    for (const world of worlds) {
      const card = games.match(new RegExp(`<button type="button" data-together-return="world-${world.id}" class="together-game-card">[\\s\\S]*?</button>`))?.[0] ?? "";
      expect(card, world.id).not.toBe("");
      expect(card).toContain(esc(translate("he", worksInLanguage(world, "he") ? "companion.together-view.preview-first" : "companion.together-view.english-only")));
    }
  });
});

describe("v3 F-TOG-2 — the five pills while the Shell draws no Together row", () => {
  const pillRow = (html: string) => html.match(/<div role="group" class="together-pill-row" data-testid="together-pill-row"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? "";
  const PILLS = [["all", "all-together"], ["games", "games"], ["stories", "stories"], ["routines", "routines"], ["offscreen", "away-from-the-screen"]] as const;

  it.each(["en", "he"] as const)("exactly one row of pills shows: the page's own until the Shell draws one (%s)", (lang) => {
    state.lang = lang;
    const shell = pillRowFor(sectionForTab("practice"), "practice").length > 1;
    const html = render();
    // The guard: neither row would leave a phone with no way between the pills.
    expect(shell || html.includes('data-testid="together-pill-row"')).toBe(true);
    expect(html.includes('data-testid="together-pill-row"')).toBe(!shell);
    state.shellRow = true; state.buttons = [];
    const withShell = render();
    expect(pillRowFor(sectionForTab("practice"), "practice").length).toBeGreaterThan(1);
    expect(withShell).not.toContain('data-testid="together-pill-row"'); expect(withShell).not.toContain("together-pill");
    expect(withShell.match(/data-module=/g)).toHaveLength(5); expect(withShell.match(/data-primary-move=/g)).toHaveLength(1);
  });

  it.each(["en", "he"] as const)("the five pills, in order, the address's pill pressed, each a 44px button outside the budget (%s)", (lang) => {
    state.lang = lang; state.query = "f=stories";
    const html = render();
    const row = pillRow(html);
    expect(row).toContain(`aria-label="${esc(translate(lang, "nav.pills.aria", { place: translate(lang, "companion.place.together") }))}"`);
    const pills = [...row.matchAll(/<button type="button" class="together-pill" data-pill="([a-z]+)" aria-pressed="(true|false)">([^<]*)<\/button>/g)];
    expect(pills.map((m) => m[1])).toEqual(PILLS.map(([id]) => id));
    expect(pills.map((m) => m[3])).toEqual(PILLS.map(([, key]) => esc(translate(lang, `companion.together-view.${key}`))));
    expect(pills.filter((m) => m[2] === "true").map((m) => m[1])).toEqual(["stories"]);
    expect(row).not.toContain("data-primary-move"); expect(row).not.toContain("data-module"); expect(row).not.toContain("msr");
    expect(html.match(/data-module=/g)).toHaveLength(5); expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    // The row comes first, before the hero.
    expect(html.indexOf('data-testid="together-pill-row"')).toBeLessThan(html.indexOf('data-module="together-invitation"'));
    const css = readFileSync(new URL("./togetherDiscovery.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.companion-together \.together-pill \{[^}]*min-block-size: var\(--touch-min\)/);
  });

  it("a pill moves the address; the pressed pill does nothing; under three there is no Games pill", () => {
    state.query = "f=games"; render();
    const pill = (id: string) => state.buttons.find((b) => b["data-pill"] === id);
    pill("games")!.onClick(); expect(state.goToRoute).not.toHaveBeenCalled();
    pill("routines")!.onClick(); expect(state.goToRoute).toHaveBeenCalledWith("practice", { f: "routines" });
    pill("offscreen")!.onClick(); expect(state.goToRoute).toHaveBeenLastCalledWith("practice", { f: "offscreen" });
    state.childProfile.age = 2; state.query = ""; state.buttons = [];
    const html = render();
    expect([...pillRow(html).matchAll(/data-pill="([a-z]+)"/g)].map((m) => m[1])).toEqual(["all", "stories", "routines", "offscreen"]);
  });
});

describe("v3 F-TOG-2 — every retired address that lands on Together carries its pill (TOGETHER_ARRIVAL_QUERY)", () => {
  it.each(["en", "he"] as const)("a world link opens that world's preview over its pill; the story maker link opens the maker (%s)", (lang) => {
    state.lang = lang; state.childProfile.age = 6;
    const offered = studioWorldsForChild(lang, state.childProfile as never).worlds;
    for (const [route, arrival] of Object.entries(TOGETHER_ARRIVAL_QUERY)) {
      state.sheets = []; state.buttons = [];
      state.query = new URLSearchParams(Object.entries(arrival).filter(([, v]) => v !== undefined) as [string, string][]).toString();
      const html = render();
      const pillModule = { all: null, games: "together-games", stories: "together-stories", routines: "together-routines", offscreen: "together-offscreen" }[arrival.f];
      if (pillModule) expect(section(html, pillModule), route).not.toContain("hidden");
      const world = arrival.world ? offered.find((w) => w.id === arrival.world) : undefined;
      if (world) expect(html, route).toContain(`data-testid="together-world-preview" data-world="${world.id}"`);
      else if (arrival.sheet === "create-story") expect(html, route).toContain('data-testid="together-create-sheet"');
      else expect(state.sheets, route).toHaveLength(0);
    }
  });
});

  it("the stylesheet: horizontal game cards from a 700px content width (110 x 104), 88 x 78 thumbs on a phone, four story columns wide, the say rule on the start side", () => {
    const css = readFileSync(new URL("./togetherDiscovery.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const block = css.slice(css.indexOf("v3 F-TOG-2: the five pills' cards"));
    expect(block.length).toBeGreaterThan(400);
    expect(block).toMatch(/\.together-game-art \{ inline-size: 88px; block-size: 78px;/);
    expect(block).toMatch(/@container together \(min-width: 700px\) \{[^}]*\}\n {2}\.companion-together \.together-game-card \{ grid-template-columns: 110px minmax\(0, 1fr\);[^}]*\}\n {2}\.together-game-art \{ inline-size: 110px; block-size: 104px; \}/);
    expect(block).toMatch(/@container together \(min-width: 1000px\) \{[^]*?\.together-story-grid \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
    expect(block).toMatch(/\.together-story-art \{[^}]*block-size: 140px;/);
    expect(block).toMatch(/\.together-away-card \.companion-say \{[^}]*padding-inline-start: 12px; border-inline-start: 2px solid var\(--arbor-ink\);/);
    expect(block).toMatch(/\.together-keep \{[^}]*min-block-size: var\(--touch-min\)/);
    expect(block).not.toMatch(/\b(?:margin|padding|border|inset)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)/);
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css.match(/@container together \(min-width: 640px\)/g)).toHaveLength(1);
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
    expect(html.match(/data-primary-move=/g)).toHaveLength(1); expect(html.match(/data-module=/g)).toHaveLength(5);
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
