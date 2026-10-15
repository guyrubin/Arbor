/** Real game callbacks and hook state in the existing no-DOM test environment.
 * These prove mechanics and lifecycle, not browser paint or device playback. */
import React, { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Effect = () => void | (() => void);
const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], stores: new Map<string, Slot[]>(),
  lang: "en" as "en" | "he", child: { id: "child-a", name: "Aya", age: 5, ageMonths: 62, ageMonthsAsOf: "2026-10-13" },
  uid: "owner-a", session: null as null | { playOnly: true; onComplete: () => void },
  upsert: vi.fn(), log: vi.fn(), track: vi.fn(), note: vi.fn(), capture: vi.fn(), sound: vi.fn(),
  click: vi.fn(), closeAudio: vi.fn(), allowed: true, hush: null as null | (() => void),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const equal = (a?: readonly unknown[], b?: readonly unknown[]) => !!a && !!b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memo = (factory: () => unknown, deps: readonly unknown[]) => {
    const index = h.cursor++, old = h.slots[index];
    if (equal(old?.deps, deps)) return old!.value;
    const value = factory(); h.slots[index] = { value, deps }; return value;
  };
  return { ...actual,
    useState(initial: unknown) {
      const index = h.cursor++, slot = h.slots[index] ??= { value: typeof initial === "function" ? (initial as () => unknown)() : initial };
      return [slot.value, (next: unknown) => { slot.value = typeof next === "function" ? (next as (value: unknown) => unknown)(slot.value) : next; }];
    },
    useRef(initial: unknown) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useMemo: memo,
    useCallback: (callback: unknown, deps: readonly unknown[]) => memo(() => callback, deps),
    useContext: () => null,
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
    useEffect(effect: Effect, deps?: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (equal(old?.deps, deps)) return;
      const slot: Slot = h.slots[index] = { deps, cleanup: old?.cleanup };
      h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
    },
  };
});
vi.mock("../../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: h.child }), useArborOptional: () => ({ childProfile: h.child }) }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string) => key }) }));
vi.mock("../../../lib/kidModeGate", () => ({ isKidModeActive: () => true, subscribeKidMode: () => () => {}, noteKidActivity: h.note }));
vi.mock("../../../lib/analytics", () => ({ track: h.track }));
vi.mock("../../../lib/native", () => ({ selectionHaptic: vi.fn() }));
vi.mock("../../../practice/usePracticeData", () => ({ usePracticeData: () => ({ events: { items: [], upsert: h.upsert } }) }));
vi.mock("../../../practice/useArcadeLogger", () => ({ useArcadeLogger: () => ({ first: "Aya", log: h.log }) }));
vi.mock("../../../practice/beatAudio", () => ({ beatClick: h.click, closeBeatAudio: h.closeAudio }));
vi.mock("../audio/kidAudio", () => ({ kidSfx: h.sound, kidAudioAllowed: () => h.allowed, onKidHush: (fn: () => void) => { h.hush = fn; return () => { h.hush = null; }; } }));
vi.mock("../game/GameSessionContext", () => ({ useGameSession: () => h.session, GameCompletionProvider: (props: { children: React.ReactNode }) => props.children }));
vi.mock("../kidChrome", () => ({ useKidHome: () => null, setKidHearIt: vi.fn(), setKidStage: vi.fn() }));
vi.mock("../kidReadAloud", () => ({ autoReadPage: vi.fn(), KidHearItButton: () => null }));
vi.mock("../../../lib/voice", () => ({ stopVoice: vi.fn(), speakText: vi.fn(), voiceSupported: () => false }));
vi.mock("../KidStageFallback", () => ({ KidStageFallback: () => null }));
vi.mock("../useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: vi.fn(), step: null }) }));
vi.mock("../rewards/KidSouvenir", () => ({ KidFinishMoment: () => null }));
vi.mock("../../ui/HeroAvatar", () => ({ HeroAvatar: () => null, resolveHeroUrl: () => null }));
vi.mock("../../ui/playkit", () => ({
  PlayHeader: "play-header", ChoiceTile: "choice-tile", PlayButton: "play-button", PlayPanel: "play-panel", Celebrate: "celebrate",
  MascotSay: "mascot-say", ProgressPips: "progress-pips", RegisterShell: "register-shell", celebrateBurst: vi.fn(),
}));

import { StudioGame, StudioGameSession, CameraFreeMimic, STUDIO_GAME_COMPONENTS } from "./StudioGame";
import { studioCopy } from "./studioCopy";
import * as artManifest from "../../../lib/kidThemeManifest";
import { StudioPortrait } from "./StudioPortrait";
import { studioLegacyRoute, type StudioActivityId } from "./studioCatalog";
import { KID_WORLDS } from "../kidWorlds";
import { GameCompletionProvider } from "../game/GameSessionContext";
import { GameFinish } from "../game/GameShell";
import { KidFinishMoment } from "../rewards/KidSouvenir";
import MemoryMatch from "../../practice/MemoryMatch";
import FeelingsLabTab, { MOOD_CLIMB } from "../../practice/FeelingsLabTab";
import PatternPowerWorld, { PatternDoneView, PatternRoundView } from "../../practice/PatternPowerWorld";
import BeatKeeperWorld from "../../practice/BeatKeeperWorld";
import type { PracticeData } from "../../../practice/usePracticeData";
import { BEAT_SETS } from "../../../practice/newGames";

type Props = { children?: unknown; [key: string]: unknown };
function nodes(node: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function render(key: string, component: () => unknown): ReactElement<Props>[] {
  h.slots = h.stores.get(key) ?? []; h.stores.set(key, h.slots); h.cursor = 0;
  const tree = nodes(component());
  for (const effect of h.effects.splice(0)) effect();
  return tree;
}
function cleanup(key: string) { for (const slot of h.stores.get(key) ?? []) slot.cleanup?.(); h.stores.delete(key); }
function click(node: ReactElement<Props> | undefined) { expect(node, "actual actionable game node").toBeDefined(); (node!.props.onClick as () => void)(); }
const isButton = (node: ReactElement<Props>) => node.type === "button" || node.type === ("play-button" as unknown);
const data = { events: { items: [], upsert: h.upsert } } as unknown as PracticeData;

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  h.stores.clear(); h.slots = []; h.effects = []; h.cursor = 0; h.lang = "en"; h.uid = "owner-a";
  h.child = { id: "child-a", name: "Aya", age: 5, ageMonths: 62, ageMonthsAsOf: "2026-10-13" };
  h.session = { playOnly: true, onComplete: vi.fn() }; h.allowed = true; h.hush = null;
  vi.stubGlobal("window", { setTimeout, clearTimeout, setInterval, clearInterval });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: h.capture } });
});
afterEach(() => { for (const key of [...h.stores.keys()]) cleanup(key); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("V2 entry, identity and persistent result", () => {
  const ids = ["memory", "feelings", "mimic", "pattern", "beat", "sound-explorer", "calm-builder", "puzzle", "sneak"] as const;
  it.each(ids)("%s starts its real registered mechanic under the canonical EN/HE title", id => {
    for (const lang of ["en", "he"] as const) {
      h.lang = lang;
      const draw = () => render(`${id}:${lang}`, () => StudioGameSession({ activityId: id, onBack: vi.fn() }));
      let tree = draw();
      expect(tree[0].props["aria-label"]).toBe(studioCopy(lang).activities[id].title);
      expect(tree.some(node => node.type === STUDIO_GAME_COMPONENTS[id])).toBe(false);
      click(tree.find(node => node.props["data-studio-start"] === "")); tree = draw();
      expect(tree.some(node => node.type === STUDIO_GAME_COMPONENTS[id])).toBe(true);
      expect(tree[0].props["aria-label"]).toBe(studioCopy(lang).activities[id].title);
    }
  });
  it("intro uses neutral world imagery with one profile hero and refuses a stock-child replacement", () => {
    const draw = () => render("visual", () => StudioGameSession({ activityId: "memory", onBack: vi.fn() }));
    let tree = draw();
    expect(tree.filter(node => node.type === StudioPortrait)).toHaveLength(1);
    expect(tree.filter(node => node.type === "img").map(node => node.props.src)).toEqual([
      artManifest.kidArt("film3d", "studio.portal.playbank")!.src480,
      artManifest.kidArt("film3d", "studio.portal.playbank")!.src480,
    ]);
    // The overlay already owns Back; the intro only adds its primary action.
    expect(tree.filter(isButton)).toHaveLength(1);
    const art = artManifest.kidArt("film3d", "studio.portal.playbank")!;
    const spy = vi.spyOn(artManifest, "kidArt").mockReturnValue({ ...art, hasHero: true });
    try {
      tree = draw();
      expect(tree.filter(node => node.type === "img")).toHaveLength(0);
      expect(tree.filter(node => node.type === StudioPortrait)).toHaveLength(1);
      click(tree.find(node => node.props["data-studio-start"] === ""));
      expect(draw().some(node => node.type === STUDIO_GAME_COMPONENTS.memory)).toBe(true);
    } finally { spy.mockRestore(); }
  });
  it("new games are Studio routes, never false legacy arcade destinations", () => {
    for (const id of ["sound-explorer", "calm-builder", "puzzle"] as const) {
      expect(KID_WORLDS.some(world => (world.worldId as string) === id)).toBe(false);
      expect(studioLegacyRoute(id)).toBeNull(); expect(STUDIO_GAME_COMPONENTS[id]).toBeDefined();
    }
  });
  it("GameFinish reports actual completion once; result stays mounted and Replay rejects stale callbacks", () => {
    const draw = () => render("session", () => StudioGameSession({ activityId: "memory", onBack: vi.fn() }));
    click(draw().find(node => node.props["data-studio-start"] === ""));
    const playing = draw(), firstGame = playing.find(node => node.type === STUDIO_GAME_COMPONENTS.memory)!;
    const complete = playing.find(node => node.type === GameCompletionProvider)!.props.onComplete as () => void;
    h.session = { playOnly: true, onComplete: complete };
    expect(render("finish", () => GameFinish({ title: "Done", onPlayAgain: vi.fn(), playAgainLabel: "Again", homeLabel: "Home" }))).toEqual([]);
    let tree = draw(); expect(tree[0].props["data-studio-phase"]).toBe("result");
    expect(tree.find(node => node.type === KidFinishMoment)?.props).toMatchObject({ childId: "child-a", kind: "world", refId: "memory", hero: false });
    expect(tree.filter(node => node.type === StudioPortrait)).toHaveLength(1);
    expect(draw().find(node => node.type === KidFinishMoment)).toBeDefined();
    expect(h.sound).toHaveBeenCalledWith("finish");
    click(tree.find(node => node.props["data-studio-replay"] === "")); tree = draw();
    expect(tree.find(node => node.type === STUDIO_GAME_COMPONENTS.memory)?.key).not.toBe(firstGame.key);
    complete(); expect(draw()[0].props["data-studio-phase"]).toBe("play");
    const nextComplete = tree.find(node => node.type === GameCompletionProvider)!.props.onComplete as () => void;
    cleanup("session"); nextComplete(); expect(h.sound).toHaveBeenCalledTimes(1);
  });
  it("owner, child and activity changes use different mounted session keys", () => {
    const draw = (activityId: StudioActivityId = "memory") => render("outer", () => StudioGame({ activityId, onBack: vi.fn() }))[0].key;
    const keys = [draw()]; h.uid = "owner-b"; keys.push(draw()); h.child.id = "child-b"; keys.push(draw()); keys.push(draw("beat"));
    expect(new Set(keys).size).toBe(4);
  });
  it("age-ineligible and preserved legacy entries never mount the wrong game", () => {
    h.child.age = 2; h.child.ageMonths = 24;
    expect(render("young", () => StudioGameSession({ activityId: "memory", onBack: vi.fn() }))[0].props["data-studio-game-unavailable"]).toBe("");
    for (const activityId of ["reading", "adventures", "pose", "speech"] as const) {
      expect(render(activityId, () => StudioGameSession({ activityId, onBack: vi.fn() })).some(node => node.props["data-studio-start"] === "")).toBe(false);
    }
  });
});

describe("existing mechanics keep answers local only inside V2", () => {
  it.each([true, false])("Memory solves actual pairs; playOnly=%s retains legacy recording defaults", playOnly => {
    h.session = playOnly ? { playOnly: true, onComplete: vi.fn() } : null;
    const draw = () => render("memory", () => MemoryMatch({ data, childAge: 5, embedded: true }));
    let tree = draw(); const groups = new Map<string, string[]>();
    for (const card of tree.filter(node => node.props.className === "kid-card")) {
      const face = nodes(card).find(node => node.props.className === "kid-coin-glyph")!.props.children as string;
      groups.set(face, [...(groups.get(face) ?? []), card.key!]);
    }
    expect(groups.size).toBeGreaterThanOrEqual(3);
    for (const keys of groups.values()) {
      for (const key of keys) { click(tree.find(node => node.props.className === "kid-card" && node.key === key)); tree = draw(); }
      vi.advanceTimersByTime(320); tree = draw();
    }
    tree = draw(); expect(tree.some(node => node.type === GameFinish)).toBe(true);
    expect(h.upsert).toHaveBeenCalledTimes(playOnly ? 0 : 1); expect(h.track).toHaveBeenCalledTimes(playOnly ? 0 : 1); expect(h.note).toHaveBeenCalledOnce();
  });
  it.each([true, false])("Feelings completes actual scenes and self-check; playOnly=%s", playOnly => {
    h.session = playOnly ? { playOnly: true, onComplete: vi.fn() } : null;
    const draw = () => render("feelings", FeelingsLabTab);
    let tree = draw(); click(tree.find(node => node.type === "button" && node.props["aria-pressed"] !== undefined));
    for (let i = 0; i < MOOD_CLIMB; i++) {
      tree = draw(); click(tree.find(node => node.type === ("choice-tile" as unknown)));
      tree = draw(); click(tree.find(node => node.type === ("play-button" as unknown))); tree = draw();
    }
    expect(tree.some(node => node.type === GameFinish)).toBe(true);
    expect(h.upsert).toHaveBeenCalledTimes(playOnly ? 0 : MOOD_CLIMB + 1); expect(h.track).toHaveBeenCalledTimes(playOnly ? 0 : MOOD_CLIMB + 1); expect(h.note).toHaveBeenCalledOnce();
  });
  it.each([true, false])("Pattern answers its real six-puzzle session; playOnly=%s", playOnly => {
    h.session = playOnly ? { playOnly: true, onComplete: vi.fn() } : null;
    const draw = () => render("pattern", PatternPowerWorld);
    for (let i = 0; i < 6; i++) {
      const round = draw().find(node => node.type === PatternRoundView)!;
      (round.props.onChoose as (choice: string) => void)((round.props.puzzle as { answer: string }).answer);
      if (playOnly) (draw().find(node => node.type === PatternRoundView)!.props.onNext as () => void)();
      else vi.advanceTimersByTime(1050);
    }
    const ending = draw().find(node => node.type === PatternDoneView)!;
    expect(ending).toBeDefined();
    expect(nodes(PatternDoneView(ending.props as unknown as Parameters<typeof PatternDoneView>[0])).some(node => node.type === GameFinish)).toBe(true);
    expect(h.log).toHaveBeenCalledTimes(playOnly ? 0 : 6); expect(h.note).toHaveBeenCalledOnce();
  });
  it.each([true, false])("Beat completes real timed rounds; playOnly=%s", playOnly => {
    h.session = playOnly ? { playOnly: true, onComplete: vi.fn() } : null;
    const draw = () => render("beat", BeatKeeperWorld);
    click(draw().find(node => node.type === ("choice-tile" as unknown)));
    for (const round of BEAT_SETS[0].rounds) {
      click(draw().find(node => node.type === "button"));
      vi.advanceTimersByTime(round.beats * round.intervalMs + 1);
      click(draw().find(node => node.type === ("play-button" as unknown)));
    }
    expect(draw().some(node => node.type === GameFinish)).toBe(true);
    expect(h.log).toHaveBeenCalledTimes(playOnly ? 0 : BEAT_SETS[0].rounds.length); expect(h.click).toHaveBeenCalled(); expect(h.note).toHaveBeenCalledOnce();
  });
  it("Beat honours V2 mute and hush releases its audio", () => {
    h.allowed = false; const draw = () => render("beat", BeatKeeperWorld);
    click(draw().find(node => node.type === ("choice-tile" as unknown))); click(draw().find(node => node.type === "button"));
    vi.advanceTimersByTime(1000); expect(h.click).not.toHaveBeenCalled();
    h.allowed = true; vi.advanceTimersByTime(1000); expect(h.click).toHaveBeenCalled();
    h.hush?.(); expect(h.closeAudio).toHaveBeenCalledOnce(); cleanup("beat"); expect(h.hush).toBeNull();
  });
  it("Mimic follows the authored finite pack without camera, rating or per-prompt writes", () => {
    const draw = () => render("mimic", CameraFreeMimic); const visited: string[] = [];
    for (let i = 0; i < 6; i++) {
      const tree = draw(); visited.push(tree.find(node => node.props["data-mimic-prompt"])!.props["data-mimic-prompt"] as string);
      click(tree.filter(isButton)[i % 2]);
    }
    expect(new Set(visited).size).toBe(6); expect(visited[0]).toBe("tongue-out");
    expect(draw().some(node => node.type === GameFinish)).toBe(true); expect(h.note).toHaveBeenCalledOnce();
    expect(h.capture).not.toHaveBeenCalled(); expect(h.upsert).not.toHaveBeenCalled(); expect(h.track).not.toHaveBeenCalled(); expect(h.log).not.toHaveBeenCalled();
  });
  it("passing every Mimic prompt offers replay/return without a completion", () => {
    const onBack = vi.fn(); const draw = () => render("mimic", () => CameraFreeMimic({ onBack }));
    for (let i = 0; i < 6; i++) click(draw().filter(isButton)[1]);
    let tree = draw(); expect(tree.some(node => node.props["data-mimic-passed"] === "")).toBe(true);
    expect(tree.some(node => node.type === GameFinish)).toBe(false); expect(h.note).not.toHaveBeenCalled(); expect(h.session?.onComplete).not.toHaveBeenCalled();
    click(tree.filter(isButton)[1]); expect(onBack).toHaveBeenCalledOnce();
    click(tree.find(node => node.props["data-mimic-replay"] === ""));
    for (let i = 0; i < 6; i++) click(draw().filter(isButton)[i === 0 ? 0 : 1]);
    tree = draw(); expect(tree.some(node => node.type === GameFinish)).toBe(true); expect(h.note).toHaveBeenCalledOnce();
  });
});
