import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { StudioWorld } from "../practice/studioWorlds";
const state = vi.hoisted(() => ({
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] },
  previewWorld: null as StudioWorld | null, lang: "en" as "en" | "he", loaded: true, failed: false, pin: null as string | null,
  saveMoment: vi.fn(async () => true), setActiveTab: vi.fn(), requestKidMode: vi.fn(), buttons: [] as Record<string, any>[],
  topic: null as null | { id: string; title: string }, openSheet: vi.fn(), openSettings: vi.fn(),
  compact: false, surfaces: [] as { kind: "modal" | "sheet"; props: Record<string, any> }[],
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: (initial: any) => real.useState(state.previewWorld && initial && typeof initial === "object" && "value" in initial ? { ...initial, value: { kind: "world", world: state.previewWorld } } : initial) };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ ...state, activeFamilyTopic: state.topic }) }));
vi.mock("./familyTopicEvents", () => ({ openFamilyTopicSheet: (...args: unknown[]) => state.openSheet(...args) }));
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
vi.mock("../kidmode/parentGate", () => ({ readParentPin: () => state.pin }));
vi.mock("../layout/settingsBus", async (original) => ({ ...(await original<typeof import("../layout/settingsBus")>()), requestOpenSettings: (...args: unknown[]) => state.openSettings(...args) }));
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPlaceOpen: vi.fn(), trackPracticeStudioOpen: vi.fn(), trackPracticeTogetherDid: vi.fn() }));
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
import TogetherView from "./TogetherView";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { readTogetherView, writeTogetherView } from "./togetherNavigation";
import { translate } from "../../lib/i18n";
import { STUDIO_WORLDS } from "../practice/studioWorlds";
beforeEach(() => {
  vi.clearAllMocks(); state.childProfile = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };
  state.previewWorld = null; state.lang = "en"; state.loaded = true; state.failed = false; state.pin = null; state.buttons = []; state.topic = null; state.compact = false; state.surfaces = [];
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
const render = () => renderToStaticMarkup(<TogetherView />);
const esc = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function section(html: string, name: string) { return html.match(new RegExp(`<section[^>]*data-module="${name}"[^>]*>`))![0]; }
function hero(html: string) { const at = html.indexOf('data-module="together-invitation"'); return html.slice(at, html.indexOf("</section>", at)); }
/** The gate card closes the page (the entry step and the preview Modal render nothing here). */
function gate(html: string) { return html.slice(html.indexOf('data-testid="together-gate"')); }
const button = (testId: string) => state.buttons.find((b) => b["data-testid"] === testId);
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
    expect(html).not.toContain(translate(lang, "companion.together-view.together-room-for-curiosity-and-connection"));
  });
  // v3 F-TOG-3 re-pin: the gate card's PIN ask reads "Set a PIN" (the mock's words), not "Parent settings"; it still opens Settings at the PIN.
  it.each(["en", "he"] as const)("closes with one gate card: the PIN line, Set a PIN and Start playing (%s)", (lang) => {
    state.lang = lang; const card = gate(render());
    expect(card).toContain(">lock</span>"); expect(card).toContain(">play_arrow</span>");
    expect(card).toContain(esc(translate(lang, "companion.together-view.play-opens-in-the-child-area-set-a-pin-to")));
    expect(card).toContain(`<button type="button" class="companion-text-button" data-testid="together-gate-pin">${esc(translate(lang, "companion.together-view.set-a-pin"))}</button>`);
    expect(card).toContain(`data-testid="together-start-playing"`); expect(card).toContain(esc(translate(lang, "companion.together-view.start-playing")));
    // The Kid Mode promises, the practice note and the PIN nudge now live in Settings › PIN.
    for (const key of ["elev.practice.door.gated", "elev.practice.door.private", "elev.practice.door.stars", "practice.studio.note", "elev.gate.set.title"]) expect(card).not.toContain(esc(translate(lang, key)));
    state.pin = "0000"; const locked = gate(render());
    expect(locked).toContain(esc(translate(lang, "companion.together-view.you-choose-when-to-enter-play-your-pin-pro")));
    expect(locked).not.toContain('data-testid="together-gate-pin"'); expect(locked).toContain('data-testid="together-start-playing"');
  });
  it("opening the page writes nothing; the CTA chooses the away ideas and the gate starts play", () => {
    render(); expect(state.saveMoment).not.toHaveBeenCalled(); expect(state.requestKidMode).not.toHaveBeenCalled(); expect(state.setActiveTab).not.toHaveBeenCalled();
    button("together-cta")!.onClick();
    expect(readTogetherView("child-a", true).category).toBe("offscreen");
    button("together-gate-pin")!.onClick(); expect(state.openSettings).toHaveBeenCalledWith({ focus: "pin" });
    button("together-start-playing")!.onClick(); expect(state.requestKidMode).toHaveBeenCalledOnce(); expect(state.requestKidMode).toHaveBeenCalledWith();
    expect(state.saveMoment).not.toHaveBeenCalled();
  });
  it("keeps the selected filter and original story destination after a route remount", () => {
    render(); state.buttons.find((b) => b.className === "companion-filter" && React.Children.toArray(b.children).includes("Stories"))!.onClick();
    state.buttons = []; const selected = render();
    expect(section(selected, "together-stories")).not.toContain("hidden"); expect(section(selected, "together-games")).toContain("hidden");
    expect(section(selected, "together-routines")).toContain("hidden"); expect(section(selected, "together-offscreen")).toContain("hidden");
    state.buttons.find((b) => b["data-together-return"] === "story-comics")!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith("comics"); expect(readTogetherView("child-a", true)).toEqual({ category: "stories", returnDoor: "story-comics" });
    expect(section(render(), "together-stories")).not.toContain("hidden");
    state.childProfile.id = "child-b"; expect(section(render(), "together-games")).not.toContain("hidden");
  });
  it.each([["en", "word-world", "language"], ["he", "speech", "speech"]] as const)("returns to the chosen %s %s card after its parent tool", (lang, id, tab) => {
    state.lang = lang; state.childProfile.age = 6; state.previewWorld = STUDIO_WORLDS.find((world) => world.id === id)!;
    writeTogetherView("child-a", { category: "games" }); const html = render();
    expect(html).toContain(`data-together-return="world-${id}"`);
    const open = state.buttons.find((button) => button.className === "companion-primary" && React.Children.toArray(button.children).includes(translate(lang, "companion.together-view.open")));
    expect(open).toBeDefined(); open!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith(tab); expect(readTogetherView("child-a", true)).toEqual({ category: "games", returnDoor: `world-${id}` });
  });
  it("keeps age gates after restoring an obsolete games choice", () => {
    writeTogetherView("child-a", { category: "games" }); state.childProfile.age = 2; const html = render();
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

describe("v3 F-TOG-3 — Together at 390", () => {
  const css = readFileSync(new URL("./togetherDiscovery.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const item = css.slice(css.indexOf("v3 F-TOG-3: Together at 390"));
  const phone = item.slice(item.indexOf("@container together (max-width: 540px) {"), item.indexOf("\n}"));
  const world = () => STUDIO_WORLDS.find((w) => w.id === "word-world")!;

  it.each(["en", "he"] as const)("below lg a game preview is a bottom sheet with the same title; the wide answer stays the Modal (%s)", (lang) => {
    state.lang = lang; state.childProfile.age = 6; state.previewWorld = world();
    writeTogetherView("child-a", { category: "games" });
    state.compact = true; render();
    expect(state.surfaces.map((s) => s.kind)).toEqual(["sheet"]);
    expect(state.surfaces[0].props.open).toBe(true);
    expect(state.surfaces[0].props.title).toBe(translate(lang, world().kidNameKey));
    state.surfaces = []; state.compact = false; render();
    expect(state.surfaces.map((s) => s.kind)).toEqual(["modal"]);
    expect(state.surfaces[0].props.open).toBe(true);
    expect(state.surfaces[0].props.title).toBe(translate(lang, world().kidNameKey));
  });

  it("a closed preview is a closed sheet, and the page still has one move and five modules", () => {
    state.compact = true; const html = render();
    expect(state.surfaces.map((s) => [s.kind, s.props.open])).toEqual([["sheet", false]]);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1); expect(html.match(/data-module=/g)).toHaveLength(5);
  });

  it("the pills are one sideways row inside the 16px gutter; each keeps the shared 44px floor", () => {
    expect(phone.length).toBeGreaterThan(400);
    expect(phone).toMatch(/\.companion-together \.companion-filter-row \{ flex-wrap: nowrap;[^}]*margin-inline: -16px; padding-inline: 16px; overflow-x: auto;[^}]*scroll-snap-type: x proximity;/);
    expect(phone).toMatch(/\.companion-together \.companion-filter \{ flex: none; white-space: nowrap; scroll-snap-align: start; \}/);
    const experience = readFileSync(new URL("./companionExperience.css", import.meta.url), "utf8");
    expect(experience).toMatch(/\.companion-filter \{[^}]*min-block-size: 44px/);
  });

  it("games are rows with an 88px picture at the start edge, at least 78px tall; stories stay one column", () => {
    expect(phone).toMatch(/\.companion-together \.companion-world-grid \{ grid-template-columns: minmax\(0, 1fr\); gap: 8px; \}/);
    expect(phone).toMatch(/\.companion-together \.companion-world-card \{[^}]*min-block-size: 78px; padding-inline-start: 88px; \}/);
    expect(phone).toMatch(/\.companion-together \.companion-world-card > img \{ position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: 88px; block-size: 100%;/);
    expect(css).toMatch(/@container together[\s\S]*\.companion-story-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
    expect(phone).not.toContain("companion-story-grid");
  });

  it("on All together the routines are one sideways row of 124px tiles; the Routines pill keeps the grid", () => {
    expect(phone).toMatch(/\.companion-together \.together-routines\[data-mode="all"\] \.together-routine-grid \{ display: flex;[^}]*overflow-x: auto;/);
    expect(phone).toMatch(/\.companion-together \.together-routines\[data-mode="all"\] \.together-routine-grid > li \{ flex: none; inline-size: 124px; scroll-snap-align: start; \}/);
    expect(css).toMatch(/\.together-routine-grid \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(124px, 1fr\)\)/);
    // Counts and words only: no bar, no share of anything about the child.
    expect(item).not.toMatch(/progress|meter/);
  });

  it("the gate card holds the lock, the PIN line and Start playing on one row when the PIN is set", () => {
    expect(phone).toMatch(/\.companion-together \.together-gate-note \{ flex: 1 1 150px; min-inline-size: 0; \}/);
    expect(phone).toMatch(/\.companion-together \.together-gate-actions \{ margin-inline-start: auto;/);
  });

  it("logical sides and tokens only; nothing lowers the 44px floor or clips a name", () => {
    expect(item).not.toMatch(/\b(?:margin|padding|border|inset)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)/);
    expect(item).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(item).not.toMatch(/line-clamp|text-overflow|overflow:\s*hidden|font-family/);
    expect(item).not.toMatch(/min-block-size: (?:[0-3]?\d|4[0-3])px/);
  });

  it.each(["en", "he"] as const)("the PIN ask reads in both languages, Hebrew without Latin (%s)", (lang) => {
    const en = (companionEn as Record<string, string>)["companion.together-view.set-a-pin"], he = (companionHe as Record<string, string>)["companion.together-view.set-a-pin"];
    expect(en).toBe("Set a PIN"); expect(he).toBeTruthy(); expect(he).not.toMatch(/[A-Za-z]/); expect(he).toMatch(/[֐-׿]/);
    state.lang = lang; render();
    const pin = button("together-gate-pin")!;
    expect(React.Children.toArray(pin.children)).toEqual([translate(lang, "companion.together-view.set-a-pin")]);
  });
});
