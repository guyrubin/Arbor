import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], page: null as any, state: undefined as any }));
vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => h.effects.push(effect), useRef: () => ({ current: h.page }),
  useState: (initial: () => unknown) => { h.state ??= initial(); return [h.state, (next: unknown) => { h.state = next; }]; },
}));
import { readTogetherView, useTogetherNavigation, writeTogetherView } from "./togetherNavigation";
beforeEach(() => {
  h.effects = []; h.page = null; h.state = undefined; const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());
describe("Together return presentation state", () => {
  it.each(["story-comics", "world-word-world", "world-speech"])("restores the specific visible door %s after the shell mounts and consumes it once", (returnDoor) => {
    const category = returnDoor.startsWith("world-") ? "games" : "stories";
    writeTogetherView("a", { category, returnDoor });
    const door = { closest: vi.fn(() => null), focus: vi.fn(), scrollIntoView: vi.fn() }; h.page = { querySelector: vi.fn(() => door) };
    let frame: () => void = () => {};
    vi.stubGlobal("requestAnimationFrame", vi.fn((next) => { frame = next; return 12; })); vi.stubGlobal("cancelAnimationFrame", vi.fn());
    expect(useTogetherNavigation("a", true).category).toBe(category); const cleanup = h.effects[0](); expect(door.focus).not.toHaveBeenCalled(); frame();
    expect(h.page.querySelector).toHaveBeenCalledWith(`[data-together-return="${returnDoor}"]`);
    expect(door.focus).toHaveBeenCalledWith({ preventScroll: true }); expect(door.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    expect(readTogetherView("a", true)).toEqual({ category }); if (typeof cleanup === "function") cleanup(); expect(cancelAnimationFrame).toHaveBeenCalledWith(12);
  });
  it("never borrows another child's category or queued return, even before effects", () => {
    writeTogetherView("a", { category: "stories", returnDoor: "story-library" }); writeTogetherView("b", { category: "offscreen" });
    expect(useTogetherNavigation("a", true).category).toBe("stories"); expect(useTogetherNavigation("b", true).category).toBe("offscreen"); expect(readTogetherView("b", true)).toEqual({ category: "offscreen" });
  });
  it("ignores unknown categories, untrusted selectors, obsolete games and broken storage", () => {
    sessionStorage.setItem("arbor.together.view.a", JSON.stringify({ category: "unknown", returnDoor: 'x"] button' })); expect(readTogetherView("a", true)).toEqual({ category: "all" });
    writeTogetherView("a", { category: "games" }); expect(readTogetherView("a", false)).toEqual({ category: "all" });
    sessionStorage.setItem("arbor.together.view.a", "{"); expect(readTogetherView("a", true)).toEqual({ category: "all" });
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("disabled"); }, setItem: () => { throw new Error("disabled"); } });
    const view = useTogetherNavigation("a", true); view.setCategory("stories"); expect(useTogetherNavigation("a", true).category).toBe("stories");
  });
});
