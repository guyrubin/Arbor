/** Actual game handlers with deterministic hook slots. These prove mechanics
 * and completion, not browser focus, paint, or physical speaker output. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: "en", muted: false, childId: "child-a", audio: { load: vi.fn(async () => true), play: vi.fn(() => true), stop: vi.fn(), dispose: vi.fn() } }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useState(initial: unknown) {
      const index = h.cursor++, slot = h.slots[index] ??= { value: typeof initial === "function" ? (initial as () => unknown)() : initial };
      return [slot.value, (next: unknown) => { slot.value = typeof next === "function" ? (next as (value: unknown) => unknown)(slot.value) : next; }];
    },
    useRef(initial: unknown) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useEffect(effect: () => void | (() => void), deps: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (old?.deps && old.deps.length === deps.length && old.deps.every((value, i) => Object.is(value, deps[i]))) return;
      const slot = h.slots[index] = { deps, cleanup: old?.cleanup };
      h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
    },
  };
});
vi.mock("../../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock("../../../../context/ArborContext", () => ({ useArborOptional: () => ({ childProfile: { id: h.childId } }) }));
vi.mock("../../game/GameShell", () => ({ GameShell: () => null, GameFinish: () => null }));
vi.mock("../../audio/kidAudio", () => ({ useKidReadAloudMuted: () => h.muted }));
vi.mock("../studioCreations", () => ({ useStudioCreations: () => ({ items: [], loaded: true, isCurrent: () => true }) }));
vi.mock("./explorerAudio", () => ({ createExplorerAudio: () => h.audio }));

import CalmBuilder from "./CalmBuilder";
import PuzzlePlanet from "./PuzzlePlanet";
import SoundExplorer from "./SoundExplorer";
import { GameFinish, GameShell } from "../../game/GameShell";
import * as artManifest from "../../../../lib/kidThemeManifest";

type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: unknown };
function elements(node: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const textOf = (node: unknown): string => typeof node === "string" ? node : Array.isArray(node) ? node.map(textOf).join("") : isValidElement<Props>(node) ? textOf(node.props.children) : "";
let component: () => ReactElement;
const render = () => {
  h.cursor = 0;
  const wrapper = component();
  const tree = (wrapper.type as (props: unknown) => ReactElement)(wrapper.props);
  const nodes = elements(tree);
  for (const effect of h.effects.splice(0)) effect();
  return nodes;
};
const labelButton = (label: string) => render().find(node => node.type === "button" && node.props["aria-label"] === label)!;
const textButton = (label: string) => render().find(node => node.type === "button" && textOf(node) === label)!;
const clickText = (label: string) => { const button = textButton(label); expect(button).toBeDefined(); expect(button.props.disabled).not.toBe(true); button.props.onClick!(); };
const clickLabel = (label: string) => { const button = labelButton(label); expect(button).toBeDefined(); expect(button.props.disabled).not.toBe(true); button.props.onClick!(); };
const finished = () => render().some(node => node.type === GameFinish);
const cleanup = () => { for (const slot of h.slots) slot.cleanup?.(); };
beforeEach(() => { h.cursor = 0; h.slots = []; h.effects = []; h.lang = "en"; h.muted = false; h.childId = "child-a"; vi.clearAllMocks(); h.audio.play.mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Calm Builder real play", () => {
  it("requires placement, permits moving/removing/undo, then finishes by choice", () => {
    component = CalmBuilder;
    expect(textButton("My corner is ready").props.disabled).toBe(true);
    clickText("Cushion"); clickLabel("Place 1"); expect(labelButton("Place 1: Cushion")).toBeDefined();
    clickText("Cushion"); clickLabel("Place 5"); expect(labelButton("Place 1")).toBeDefined(); expect(labelButton("Place 5: Cushion")).toBeDefined();
    clickText("Undo"); expect(labelButton("Place 1: Cushion")).toBeDefined();
    clickText("Cushion"); clickText("Put it away"); expect(textButton("My corner is ready").props.disabled).toBe(true);
    clickText("Plant"); clickLabel("Place 3"); clickText("My corner is ready"); expect(finished()).toBe(true);
  });
  it("offers the same choices in Hebrew and keys play state to the child", () => {
    component = CalmBuilder; h.lang = "he";
    clickText("ספרים"); clickLabel("מקום 2"); expect(labelButton("מקום 2: ספרים")).toBeDefined();
    expect(component().key).toBe("child-a"); h.childId = "child-b"; expect(component().key).toBe("child-b");
  });
});

describe("Puzzle Planet real play", () => {
  it("wrong placement cannot progress; all four correct fragments complete it", () => {
    component = PuzzlePlanet;
    clickLabel("Piece: bottom right"); clickLabel("Picture space: top left");
    expect(render().find(node => node.type === GameShell)!.props.progress).toEqual({ index: 0, total: 4 }); expect(finished()).toBe(false);
    for (const position of ["bottom right", "top left", "top right", "bottom left"]) { clickLabel(`Piece: ${position}`); clickLabel(`Picture space: ${position}`); }
    expect(finished()).toBe(false); clickText("My picture is ready"); expect(finished()).toBe(true);
  });
  it("switching to nine pieces resets partial play and keeps a whole-picture preview", () => {
    component = PuzzlePlanet; clickLabel("Piece: top left"); clickLabel("Picture space: top left"); clickText("Nine pieces");
    expect(render().find(node => node.type === GameShell)!.props.progress).toEqual({ index: 0, total: 9 });
    expect(render().filter(node => node.type === "button" && String(node.props["aria-label"]).startsWith("Piece:"))).toHaveLength(9);
    clickText("Whole picture"); expect(textButton("Hide picture").props["aria-expanded"]).toBe(true);
  });
  it("refuses a stock-child image if a future manifest assigns one to the neutral slot", () => {
    const art = artManifest.kidArt("film3d", "home.stage")!;
    vi.spyOn(artManifest, "kidArt").mockReturnValue({ ...art, hasHero: true }); component = PuzzlePlanet;
    expect(render().filter(node => node.type === "button" && String(node.props["aria-label"]).startsWith("Piece:"))).toHaveLength(0);
    expect(render().some(node => node.props.role === "status")).toBe(true);
  });
});

describe("Sound Explorer real play", () => {
  it("requires every correct source and supports an entirely silent session", () => {
    component = SoundExplorer; h.muted = true;
    expect(textButton("Hear the sound").props.disabled).toBe(true);
    expect(textOf(render().find(node => node.props.className === "studio-sound-clue"))).toContain("tiptoe");
    clickText("A bell"); expect(textButton("Next sound")).toBeUndefined();
    clickText("Footsteps"); clickText("Next sound"); clickText("A bell"); clickText("Next sound");
    clickText("A soft landing"); clickText("Finish exploring"); expect(finished()).toBe(true); expect(h.audio.play).not.toHaveBeenCalled();
  });
  it("plays only on request, offers a clue on failure, and disposes on exit", () => {
    component = SoundExplorer; render(); expect(h.audio.play).not.toHaveBeenCalled(); h.audio.play.mockReturnValue(false); clickText("Hear the sound");
    expect(h.audio.play).toHaveBeenCalledWith("steps"); expect(textOf(render().find(node => node.props.className === "studio-sound-clue"))).toContain("tiptoe");
    cleanup(); expect(h.audio.dispose).toHaveBeenCalled();
  });
});
