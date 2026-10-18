import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* v3 F-TOG-1 — Together's hero, studio doors and question row (#/practice).
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
import { readTogetherView } from "./togetherNavigation";
import { translate } from "../../lib/i18n";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { latestPlayedWorldId, STUDIO_WORLDS, studioWorldsForChild, type StudioCountSource } from "../practice/studioWorlds";

beforeEach(() => {
  vi.clearAllMocks();
  state.childProfile = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };
  state.lang = "en"; state.loaded = true; state.failed = false; state.events = []; state.buttons = []; state.topic = null;
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});

const render = () => renderToStaticMarkup(<TogetherView />);
const esc = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const tr = (lang: "en" | "he", key: string, vars?: Record<string, string | number>) => esc(translate(lang, key, vars));
const buttonMarkup = (html: string, testId: string) => html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";
const button = (testId: string) => state.buttons.find((b) => b["data-testid"] === testId);
const DOORS = [
  ["together-door-story", "auto_stories", "companion.together-view.door-create-story"],
  ["together-door-continue", "replay", "companion.together-view.door-continue-favorite"],
  ["together-door-find", "extension", "companion.together-view.door-find-play"],
] as const;

for (const lang of ["en", "he"] as const) describe(`v3 F-TOG-1 · Together's hero · ${lang}`, () => {
  beforeEach(() => { state.lang = lang; });

  it("the kicker, the title with the child's name, the sub and ONE move with the heart", () => {
    const html = render();
    const at = html.indexOf('data-module="together-invitation"');
    const hero = html.slice(at, html.indexOf("</section>", at));
    expect(hero).toContain(`<span class="companion-eyebrow together-kicker">${tr(lang, "companion.together-view.kicker")}</span>`);
    expect(hero).toMatch(/<h1 id="[^"]+" class="arbor-type-hero">/);
    expect(hero).toContain(tr(lang, "companion.together-view.a-little-world-to-discover-with", { value0: "Noa" }));
    expect(hero).toContain(`<p class="together-hero-sub">${tr(lang, "companion.together-view.a-story-to-get-lost-in-a-game-to-wonder-at")}</p>`);
    const cta = buttonMarkup(hero, "together-cta");
    expect(cta).toContain('data-primary-move="choose-together"');
    expect(cta).toMatch(/^<button type="button" class="companion-primary together-hero-cta"/);
    expect(cta.replace(/<[^>]+>/g, "")).toBe(`favorite${tr(lang, "companion.together-view.one-small-idea-for-time-together")}arrow_forward`);
    // The arrow is the one directional glyph, mirrored once.
    expect(cta).toMatch(/class="msr companion-arrow rtl:-scale-x-100"[^>]*>arrow_forward<\/span>/);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    // The Together picture is decoration beside the copy: empty alt, hidden from AT.
    expect(hero).toMatch(/<figure class="companion-together-art" aria-hidden="true"><img [^>]*alt=""/);
    // Never a stand-in child: the title names this child only.
    expect(html).not.toMatch(/\bMia\b|(?<![֐-׿])מיה(?![֐-׿])/);
  });

  // v4 re-pin: each door's icon is the brand chip (pink, lavender, green), beside its label.
  it("three studio doors, each a brand chip and a label, inside the hero", () => {
    const html = render();
    const doors = html.slice(html.indexOf('data-testid="together-doors"'), html.indexOf("</section>", html.indexOf('data-testid="together-doors"')));
    const TONES = ["pink", "lav", "green"];
    DOORS.forEach(([testId, icon, key], i) => {
      const door = buttonMarkup(doors, testId);
      expect(door, testId).toMatch(/^<button type="button" class="together-door"/);
      expect(door.replace(/<[^>]+>/g, ""), testId).toBe(`${icon}${tr(lang, key)}`);
      expect(door, testId).toMatch(new RegExp(`<span aria-hidden="true" data-brand-chip="${TONES[i]}"[^>]*class="brand-chip"`));
    });
    expect(html.indexOf('data-testid="together-cta"')).toBeLessThan(html.indexOf('data-testid="together-doors"'));
    expect(html.indexOf('data-testid="together-doors"')).toBeLessThan(html.indexOf('class="companion-together-art"'));
  });

  it("under three only the story door shows; the games doors go with the games", () => {
    state.childProfile = { id: "child-a", name: "Noa", age: 2, interests: [], activeGoals: [] };
    const html = render();
    expect(html).toContain('data-testid="together-door-story"');
    expect(html).not.toContain('data-testid="together-door-continue"');
    expect(html).not.toContain('data-testid="together-door-find"');
    expect(html).not.toContain('data-module="together-games"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });

  // v4 re-pin: the filter row is Together's first level (above the hero), so
  // the question row now sits between the hero and the filter's catalogue.
  it("the question row sits under the hero and before the catalogue, with the enjoy note beside the chip", () => {
    state.topic = { id: "topic-a", title: "What helps mornings feel calmer?" };
    const html = render();
    const row = html.indexOf('data-testid="together-question-row"');
    const catalogue = html.indexOf('class="companion-collection"');
    expect(html.indexOf('class="companion-filter-row together-pills"')).toBeLessThan(html.indexOf('data-module="together-invitation"'));
    expect(row).toBeGreaterThan(html.indexOf('data-testid="together-cta"'));
    expect(row).toBeGreaterThan(html.indexOf("</section>", html.indexOf('data-module="together-invitation"')));
    expect(row).toBeLessThan(catalogue);
    expect(html.slice(row, catalogue)).toContain(tr(lang, "companion.together-view.here-it-is-also-enough-just-to-enjoy"));
    expect(html.match(/data-module=/g)).toHaveLength(5);
  });
});

describe("v3 F-TOG-1 · what the doors and the move do", () => {
  it("the move chooses the away ideas (v4: in Play); nothing is written and play does not start", () => {
    render();
    button("together-cta")!.onClick();
    expect(readTogetherView("child-a", true)).toEqual({ category: "games" });
    expect(state.saveMoment).not.toHaveBeenCalled(); expect(state.requestKidMode).not.toHaveBeenCalled(); expect(state.setActiveTab).not.toHaveBeenCalled();
  });

  it("Create a story opens the story maker and remembers its door for the way back", () => {
    render();
    button("together-door-story")!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith("bedtime-stories");
    expect(readTogetherView("child-a", true)).toEqual({ category: "routines", returnDoor: "story-bedtime" });
  });

  it("Find something to play chooses the games", () => {
    render();
    button("together-door-find")!.onClick();
    expect(readTogetherView("child-a", true)).toEqual({ category: "games" });
    expect(state.requestKidMode).not.toHaveBeenCalled();
  });

  it("Continue a favorite falls back to the games when nothing was played", () => {
    render();
    button("together-door-continue")!.onClick();
    expect(readTogetherView("child-a", true)).toEqual({ category: "games" });
  });

  it("Continue a favorite previews the latest world instead of moving the page", () => {
    // One record of a world this child is offered (an invented event).
    const KIND: Record<string, string> = { "word-world": "lang-strategy", feelings: "emotion-id", memory: "memory", reading: "phonics", beat: "rhythm", pose: "pose", pattern: "pattern" };
    const offered = studioWorldsForChild("en", state.childProfile as never).worlds.find((w) => KIND[w.id]);
    expect(offered).toBeDefined();
    state.events = [{ kind: KIND[offered!.id], timestamp: "2026-09-30T08:00:00.000Z" }];
    expect(latestPlayedWorldId({ speech: { items: [] }, mimic: { items: [] }, adventures: { items: [] }, events: { items: state.events as never[] } }, studioWorldsForChild("en", state.childProfile as never).worlds)).toBe(offered!.id);
    render();
    button("together-door-continue")!.onClick();
    // The preview opens in place: the category stays where it was and nothing starts.
    expect(readTogetherView("child-a", true)).toEqual({ category: "routines" });
    expect(state.requestKidMode).not.toHaveBeenCalled(); expect(state.setActiveTab).not.toHaveBeenCalled();
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

describe("v3 F-TOG-1 · the stylesheet and the copy", () => {
  const css = readFileSync(new URL("./togetherDiscovery.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const experience = readFileSync(new URL("./companionExperience.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  /** One top-level rule block, from its head to its closing brace ("" when absent). */
  const block = (source: string, head: string) => { const at = source.indexOf(head); return at < 0 ? "" : source.slice(at, source.indexOf("\n}", at)); };
  const wide = block(css, "@container together (min-width: 640px) {");
  const phone = css.slice(css.indexOf("v3 F-TOG-1: the hero"), css.indexOf("@container together (min-width: 640px) {"));

  it("the hero rules are phone first, with one wide container block", () => {
    expect(phone.length).toBeGreaterThan(400);
    expect(wide.length).toBeGreaterThan(400);
    expect(css.match(/@container together \(min-width: 640px\)/g)).toHaveLength(1);
  });

  it("phone first: the picture on top at 190px, a 48px full-width move, no doors", () => {
    expect(phone).toMatch(/\.companion-together \.companion-together-art \{ order: -1;/);
    expect(phone).toMatch(/\.companion-together \.companion-together-art img \{ block-size: 190px;/);
    expect(phone).toMatch(/\.companion-together \.together-hero-cta \{ inline-size: 100%; min-block-size: 48px;/);
    expect(phone).toMatch(/\.companion-together \.companion-together-hero h1 \{[^}]*font-size: var\(--t-2xl\)/);
    expect(phone).toContain(".companion-together .together-doors { display: none; }");
  });

  it("from a 640px content width: two columns (1.1fr / 1fr), a 300px picture, the doors in a row", () => {
    expect(wide).toContain("grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);");
    expect(wide).toMatch(/\.companion-together \.companion-together-art img \{ block-size: 300px; \}/);
    expect(wide).toMatch(/\.companion-together \.together-doors \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
    expect(wide).toMatch(/\.companion-together \.companion-together-hero h1 \{ font-size: var\(--t-hero\);/);
  });

  it("every door, the move and Start playing keep the 44px floor; tokens and logical sides only", () => {
    expect(css).toMatch(/\.companion-together \.together-door \{[^}]*min-block-size: var\(--touch-min\)/);
    expect(css).toMatch(/\.companion-together \.together-start \{[^}]*min-block-size: var\(--touch-min\)/);
    expect(wide).toMatch(/\.companion-together \.together-hero-cta \{[^}]*min-block-size: var\(--touch-min\)/);
    const gate = css.slice(css.indexOf("v3 F-TOG-1: the gate card"), css.indexOf("v3 FEAT-07"));
    for (const rules of [phone, wide, gate]) {
      expect(rules).not.toMatch(/\b(?:margin|padding|border)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)/);
      expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it("on a phone the question line stays one line and the enjoy note steps aside", () => {
    const narrow = block(experience, "@container together (max-width: 540px) {");
    expect(narrow).toContain(".companion-topic-context > .companion-caption { display: none; }");
    expect(narrow).toMatch(/\.companion-topic-context \.companion-topic-chip-text \{[^}]*text-overflow: ellipsis/);
    // The discovery sheet stays unclipped: the ellipsis lives with the shared chip rules.
    expect(css).not.toMatch(/text-overflow|line-clamp/);
  });

  it("the kicker and the three doors read in both languages, Hebrew without Latin", () => {
    const keys = ["companion.together-view.kicker", "companion.together-view.door-create-story", "companion.together-view.door-continue-favorite", "companion.together-view.door-find-play"];
    for (const key of keys) {
      const en = (companionEn as Record<string, string>)[key], he = (companionHe as Record<string, string>)[key];
      expect(en, key).toBeTruthy(); expect(he, key).toBeTruthy();
      expect(he, key).not.toBe(en);
      expect(he, key).not.toMatch(/[A-Za-z]/);
      expect(he, key).toMatch(/[֐-׿]/);
    }
  });
});
