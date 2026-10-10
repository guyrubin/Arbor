/** B-BOOK-28: execute the real tab callbacks and page effects offline, including
 * every authored choice path twice. This is a hook/component boundary harness,
 * not a browser/layout claim. No source-regex substitution of the handlers. */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile, HeroJourneyRender, HeroStorySpec } from "../../types";

const env = vi.hoisted(() => ({
  kid: true, lang: "en" as "en" | "he", profile: {} as ChildProfile,
  listeners: new Set<() => void>(),
  hook: null as any,
  collections: [] as { childId: string; name: string }[],
  upsert: vi.fn(async (_item: unknown) => {}),
  text: vi.fn<(...args: any[]) => Promise<HeroJourneyRender>>(),
  image: vi.fn(async () => ({ key: "test-page", url: "/static-page.webp" })),
  speech: vi.fn(() => 7),
}));
vi.mock("react", async original => {
  const real = await original<typeof import("react")>();
  const hooks = {
    useState: (...args: any[]) => env.hook.state(...args),
    useRef: (...args: any[]) => env.hook.ref(...args),
    useMemo: (compute: () => unknown) => compute(),
    useEffect: (...args: any[]) => env.hook.effect(...args),
    useLayoutEffect: (...args: any[]) => env.hook.effect(...args),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  };
  return { ...real, ...hooks, default: { ...real, ...hooks } };
});
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: env.lang, aiLang: env.lang, t: (key: string) => key }) }));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: env.profile, behaviorLogs: [], setActiveTab: () => {} }),
  useArborOptional: () => ({ childProfile: env.profile }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../hooks/useDialog", () => ({ useDialog: () => ({ ref: { current: null }, requestClose: vi.fn() }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (childId: string, name: string) => {
  env.collections.push({ childId, name });
  return { items: [], loaded: true, upsert: env.upsert, remove: vi.fn() };
} }));
vi.mock("./useChildLibraryBooks", () => ({ useChildLibraryBooks: () => [] }));
vi.mock("../../lib/api", () => ({ api: { generateHeroJourney: env.text } }));
vi.mock("../../lib/heroComics", async original => ({ ...await original<typeof import("../../lib/heroComics")>(), generateJourneyPage: env.image }));
vi.mock("../../lib/kidModeGate", () => ({
  isKidModeActive: () => env.kid,
  subscribeKidMode: (listener: () => void) => { env.listeners.add(listener); return () => env.listeners.delete(listener); },
  noteKidActivity: vi.fn(),
}));
vi.mock("./audio/kidAudio", () => ({ kidSfx: vi.fn(), kidSay: env.speech }));
vi.mock("../../lib/voice", () => ({ speakText: env.speech, stopVoice: vi.fn(), voiceSupported: () => true, voiceState: () => ({ speaking: false, engine: "natural" }) }));
vi.mock("../../lib/tts", () => ({ stopSpeaking: vi.fn() }));
vi.mock("../../lib/celebrate", () => ({ celebrate: vi.fn() }));

import HeroJourneyTab, { authoredJourneyRender, clearJourneyMemo, journeyMemoKey, rememberJourney } from "../tabs/HeroJourneyTab";
import { HeroScenePlayer } from "../stories/HeroScenePlayer";
import { DecisionChoices } from "../stories/DecisionChoices";
import { StoryCard } from "../stories/StoryCard";
import { HERO_STORIES, KID_SHELF_STORIES, storyHasLanguage } from "../../lib/heroJourneys";
import { _setHeroRenderBackend, getSavedRender, renderSignature, saveRender, type SavedHeroRender } from "../../lib/heroRenderStore";

/** State/effect ordering mirrors a commit; production components and callbacks
 * remain unmodified. Unrendered decorative children have no boundary behavior. */
function harness<P>(component: (props: P) => React.ReactNode, props: P) {
  const slots: any[] = [];
  let index = 0, dirty = true, jobs: (() => void)[] = [], tree: React.ReactNode;
  const hook = {
    state(initial: any) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], (next: any) => {
        const value = typeof next === "function" ? next(slots[slot]) : next;
        if (!Object.is(slots[slot], value)) { slots[slot] = value; dirty = true; }
      }];
    },
    ref(initial: any) { const slot = index++; return slots[slot] ??= { current: initial }; },
    effect(setup: () => void | (() => void), deps?: unknown[]) {
      const slot = index++, previous = slots[slot];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        const state = { deps, cleanup: undefined as void | (() => void) };
        slots[slot] = state;
        jobs.push(() => { previous?.cleanup?.(); state.cleanup = setup(); });
      }
    },
  };
  const commit = (beforeEffects?: (tree: React.ReactNode) => void) => {
    dirty = true;
    for (let tries = 0; dirty; tries++) {
      if (tries > 30) throw new Error("Unsettled hook render");
      dirty = false; index = 0; jobs = []; env.hook = hook;
      tree = component(props);
      beforeEffects?.(tree);
      jobs.forEach(run => run());
    }
    return tree;
  };
  commit();
  return { commit, get tree() { return tree; }, update(next: P) { props = next; return commit(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
type Element = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children), ...elements(element.props.aside)];
}
const find = (tree: React.ReactNode, match: (node: Element) => boolean) => elements(tree).find(match);
const page = (tree: React.ReactNode) => find(tree, node => node.type === HeroScenePlayer);
const marker = (tree: React.ReactNode, name: string) => find(tree, node => name in node.props);
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const switchGate = (kid: boolean) => { env.kid = kid; env.listeners.forEach(listener => listener()); };
const fixtures = [
  { lang: "en" as const, gender: "boy" as const, name: "Test Hero" },
  { lang: "he" as const, gender: "boy" as const, name: "נועם" },
  { lang: "he" as const, gender: "girl" as const, name: "דנה" },
];
let backend: Map<string, SavedHeroRender>;
let reads: ReturnType<typeof vi.fn<() => void>>;
let fetchSpy: ReturnType<typeof vi.fn<() => never>>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T18:00:00Z"));
  env.kid = true; env.lang = "en"; env.collections = []; env.listeners.clear();
  env.profile = { id: "synthetic-child", name: "Test Hero", age: 6, gender: "boy", avatar: { style: "comichero" }, photoUrl: "data:image/png;base64,c3ludGhldGlj" } as unknown as ChildProfile;
  env.text.mockReset(); env.image.mockClear(); env.speech.mockClear(); env.upsert.mockClear();
  clearJourneyMemo(); backend = new Map(); reads = vi.fn();
  _setHeroRenderBackend({ get: async id => { reads(); return backend.get(id); }, put: async row => { backend.set(row.id, row); }, getAll: async () => { reads(); return [...backend.values()]; }, delete: async id => { backend.delete(id); }, clear: async () => backend.clear() });
  fetchSpy = vi.fn(() => { throw new Error("Unexpected network request"); });
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
});
afterEach(() => { _setHeroRenderBackend(null); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function readPath(tab: ReturnType<typeof harness<any>>, story: HeroStorySpec, choiceId: string | undefined) {
  const words: string[] = [];
  for (let steps = 0; steps <= story.beats.length + 1; steps++) {
    await vi.advanceTimersByTimeAsync(500); // includes any delayed read-aloud attempt
    const title = marker(tab.tree, "data-kid-book-title");
    if (title) words.push(String(title.props.children));
    const currentPage = page(tab.tree);
    if (currentPage) {
      const player = harness(HeroScenePlayer, currentPage.props as any);
      expect(marker(player.tree, "data-kid-book-page")).toBeTruthy();
      words.push(currentPage.props.scene.narration);
      player.unmount();
    }
    const decision = find(tab.tree, node => node.type === DecisionChoices);
    if (decision) {
      expect(marker(tab.tree, "data-kid-book-next")?.props.disabled).toBe(true);
      words.push(...decision.props.choices.map((choice: any) => `${choice.label}: ${choice.consequence}`));
      decision.props.onChoose(choiceId ?? decision.props.choices[0].id);
    } else {
      const next = marker(tab.tree, "data-kid-book-next");
      if (!next) break;
      next.props.onClick();
    }
    await settle(); tab.commit();
    if (marker(tab.tree, "data-kid-book-ending")) break;
  }
  expect(marker(tab.tree, "data-kid-book-ending"), story.id).toBeTruthy();
  expect(words.length).toBeGreaterThanOrEqual(story.beats.length);
  return words;
}

describe("B-BOOK-28: actual legacy kid open/page/choice/ending boundaries", () => {
  for (const fixture of fixtures) it(`${fixture.lang}/${fixture.gender}: every legacy book and choice reads twice without text, image or network calls; the read-aloud speaks authored words`, async () => {
    env.lang = fixture.lang;
    for (const story of KID_SHELF_STORIES.filter(value => storyHasLanguage(value, fixture.lang))) {
      env.profile = { ...env.profile, ...fixture, age: story.ageRange[0] };
      const choices = story.beats.find(beat => beat.id === "decision")?.choices ?? [];
      for (const choice of choices.length ? choices : [undefined]) {
        const tab = harness(HeroJourneyTab, { initialStoryId: story.id, pinNonce: 1 });
        expect(marker(tab.tree, "data-kid-book-reader"), story.id).toBeTruthy();
        const first = await readPath(tab, story, choice?.id);
        const again = elements(tab.tree).find(node => node.type === "button" && !node.props["aria-label"]);
        expect(again).toBeTruthy(); again!.props.onClick(); tab.commit();
        expect(await readPath(tab, story, choice?.id)).toEqual(first);
        tab.unmount();
      }
    }
    expect(env.collections.some(value => value.name === "heroRenders" && value.childId)).toBe(false);
    expect(reads).not.toHaveBeenCalled();
    expect(env.text).not.toHaveBeenCalled();
    expect(env.image).not.toHaveBeenCalled();
    // Guy, 10 Oct 2026: the read-aloud is back (PR 118 had removed it). It
    // speaks the AUTHORED words through the one kid voice path, in the
    // story's language; the read itself makes no text, image or network call.
    expect(env.speech).toHaveBeenCalled();
    for (const [, lines, lang] of env.speech.mock.calls as unknown as [string, string | string[], string][]) {
      const said = Array.isArray(lines) ? lines : [lines];
      expect(said.length).toBeGreaterThan(0);
      for (const line of said) expect(typeof line === "string" && line.trim().length > 0).toBe(true);
      expect(lang).toBe(fixture.lang);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("ignores poisoned parent memo/store, still reads without a hero, and repins the same mounted tab", async () => {
    const story = HERO_STORIES[0];
    env.profile = { ...env.profile, age: story.ageRange[0], avatar: undefined, photoUrl: undefined } as ChildProfile;
    const poison = authoredJourneyRender(story, "en"); poison.scenes[0].narration = "PARENT WORDS";
    saveRender(env.profile.id, story.id, "en", renderSignature("Test", story), poison);
    rememberJourney(journeyMemoKey(env.profile.id, story.id, "en", "2026-10-09"), poison);
    await settle(); reads.mockClear();
    const tab = harness(HeroJourneyTab, { initialStoryId: story.id, pinNonce: 1 });
    expect(page(tab.tree)?.props.scene.narration).not.toBe("PARENT WORDS");
    await readPath(tab, story, undefined);
    tab.update({ initialStoryId: story.id, pinNonce: 2 });
    expect(page(tab.tree)?.props.scene.beatId).toBe(story.beats[0].id);
    expect(getSavedRender(env.profile.id, story.id, "en", renderSignature("Test", story))?.scenes[0].narration).toBe("PARENT WORDS");
    expect(reads).not.toHaveBeenCalled(); expect(env.text).not.toHaveBeenCalled(); expect(env.image).not.toHaveBeenCalled();
    tab.unmount();
  });
  it("parent positive control still generates and keeps words and cover/page art", async () => {
    switchGate(false);
    const story = HERO_STORIES[0]; env.profile.age = story.ageRange[0];
    const generated = authoredJourneyRender(story, "en", "parent art");
    generated.scenes[0].narration = "KEPT PARENT SENTENCE";
    env.text.mockResolvedValue(generated);
    const tab = harness(HeroJourneyTab, { initialStoryId: story.id, pinNonce: 1 });
    await settle(); tab.commit(); await settle(); tab.commit();
    expect(env.text).toHaveBeenCalledOnce(); expect(env.image).toHaveBeenCalled();
    expect(env.text.mock.calls[0][1]).toEqual(expect.any(Function)); // forwards retirement through auth refresh
    expect(backend.size).toBe(1); expect(env.upsert).toHaveBeenCalled();
    // The real page effect remains enabled for the parent card.
    const player = harness(HeroScenePlayer, { scene: authoredJourneyRender(story, "en", "parent art").scenes[0], seed: story.id, storyId: story.id, beatNumber: 1, beatTotal: 8, heroAvatarUrl: "data:image/png;base64,c3ludGhldGlj", layout: "card" as const });
    await settle(); expect(env.image.mock.calls.length).toBeGreaterThanOrEqual(2);
    player.unmount(); tab.unmount();
    clearJourneyMemo();
    env.profile = { ...env.profile, avatar: undefined, photoUrl: undefined } as ChildProfile;
    const reopened = harness(HeroJourneyTab, { initialStoryId: story.id, pinNonce: 2 });
    await settle(); reopened.commit();
    expect(page(reopened.tree)?.props.scene.narration).toBe("KEPT PARENT SENTENCE");
    expect(env.text).toHaveBeenCalledOnce();
    reopened.unmount();
  });
  it("late parent generation is discarded after parent→kid→parent, with no late persistence", async () => {
    switchGate(false);
    const story = HERO_STORIES[0]; env.profile.age = story.ageRange[0];
    let release!: (render: HeroJourneyRender) => void;
    env.text.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const tab = harness(HeroJourneyTab, { initialStoryId: story.id, pinNonce: 1 });
    await settle(); expect(env.text).toHaveBeenCalledOnce();
    switchGate(true); tab.update({ initialStoryId: story.id, pinNonce: 2 });
    switchGate(false); tab.commit();
    release(authoredJourneyRender(story, "en", "late art"));
    await settle(); tab.commit();
    expect(backend.size).toBe(0); expect(env.upsert).not.toHaveBeenCalled();
    tab.unmount();
  });
  it("entering Kid Mode cannot paint already-loaded parent words, even before effects run", async () => {
    switchGate(false);
    const story = KID_SHELF_STORIES[0];
    env.profile = { ...env.profile, age: story.ageRange[0], avatar: undefined, photoUrl: undefined } as ChildProfile;
    const parentRender = authoredJourneyRender(story, "en");
    parentRender.scenes[0].narration = "PARENT ONLY WORDS";
    env.text.mockResolvedValueOnce(parentRender);
    const tab = harness(HeroJourneyTab, { initialStoryId: story.id, pinNonce: 1 });
    await settle(); tab.commit();
    expect(page(tab.tree)?.props.scene.narration).toBe("PARENT ONLY WORDS");
    switchGate(true);
    tab.commit(tree => {
      expect(page(tree)?.props.scene.narration).not.toBe("PARENT ONLY WORDS");
      expect(page(tree)?.props.scene.imagePrompt).toBe("");
    });
    expect(env.text).toHaveBeenCalledOnce(); tab.unmount();
  });
  it("a pending parent page cannot report or display generated art after the kid gate closes", async () => {
    switchGate(false);
    const story = KID_SHELF_STORIES[0];
    let release!: (value: { key: string; url: string }) => void;
    env.image.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const onPageResolved = vi.fn();
    const player = harness(HeroScenePlayer, { scene: authoredJourneyRender(story, "en", "parent art").scenes[0], seed: story.id, storyId: story.id, beatNumber: 1, beatTotal: 8, heroAvatarUrl: "data:image/png;base64,c3ludGhldGlj", onPageResolved });
    expect(env.image).toHaveBeenCalledOnce();
    switchGate(true); release({ key: "late", url: "/late-generated.webp" });
    await settle(); player.commit();
    expect(onPageResolved).not.toHaveBeenCalled();
    expect(elements(player.tree).some(node => node.props.src === "/late-generated.webp")).toBe(false);
    player.unmount();
  });
  it("a newer parent open retires the older request before it can replace or persist the new book", async () => {
    switchGate(false);
    const [first, second] = KID_SHELF_STORIES;
    env.profile.age = first.ageRange[0];
    let release!: (render: HeroJourneyRender) => void;
    env.text.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
      .mockResolvedValueOnce(authoredJourneyRender(second, "en", "new art"));
    const tab = harness(HeroJourneyTab, { initialStoryId: first.id, pinNonce: 1 });
    await settle();
    env.profile.age = second.ageRange[0];
    tab.update({ initialStoryId: second.id, pinNonce: 2 });
    await settle(); tab.commit();
    release(authoredJourneyRender(first, "en", "old art"));
    await settle(); tab.commit();
    expect(getSavedRender(env.profile.id, first.id, "en", renderSignature("Test", first))).toBeUndefined();
    expect(getSavedRender(env.profile.id, second.id, "en", renderSignature("Test", second))).toBeTruthy();
    expect(env.upsert).toHaveBeenCalledTimes(1);
    tab.unmount();
  });
  it("closing while a parent rewrite is pending prevents the old book from reopening", async () => {
    switchGate(false);
    const story = KID_SHELF_STORIES[0]; env.profile.age = story.ageRange[0];
    env.text.mockResolvedValueOnce(authoredJourneyRender(story, "en", "parent art"));
    const tab = harness(HeroJourneyTab, { initialStoryId: story.id, pinNonce: 1 });
    await settle(); tab.commit();
    let release!: (render: HeroJourneyRender) => void;
    env.text.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    find(tab.tree, node => node.props["data-testid"] === "stories-rewrite")!.props.onClick();
    await settle();
    const back = elements(tab.tree).find(node => node.type === "button" && elements(node.props.children).some(child => child.props.name === "arrow_back"));
    expect(back).toBeTruthy(); back!.props.onClick(); tab.commit();
    release(authoredJourneyRender(story, "en", "late rewrite"));
    await settle(); tab.commit();
    expect(find(tab.tree, node => node.props["data-testid"] === "stories-rewrite")).toBeUndefined();
    expect(env.upsert).toHaveBeenCalledTimes(1);
    tab.unmount();
  });
  it("a stale parent Play callback routes into authored child reading without generation", async () => {
    switchGate(false);
    const story = HERO_STORIES[0]; env.profile.age = story.ageRange[0];
    const tab = harness(HeroJourneyTab, {});
    const card = find(tab.tree, node => node.type === StoryCard && node.props.story.id === story.id);
    expect(card).toBeTruthy(); switchGate(true); card!.props.onOpen();
    await settle(); tab.commit();
    expect(marker(tab.tree, "data-kid-book-reader")).toBeTruthy();
    expect(env.text).not.toHaveBeenCalled(); expect(env.image).not.toHaveBeenCalled();
    tab.unmount();
  });
});
