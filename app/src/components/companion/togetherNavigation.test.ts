import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// Retain hook slots and respect effect dependencies/cleanup. Motion's presence
// boundary is controlled explicitly: mode="wait" keeps an exiting route mounted
// until the destination commits, and early Back makes that same route present.
// This executes the production hook, not browser layout or React scheduling.
const h = vi.hoisted(() => ({
  slots: [] as any[], cursor: 0, effects: [] as (() => void)[], present: true, query: "",
}));
vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = h.cursor++, previous = h.slots[index];
    if (previous && deps.length === previous.deps.length && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
    const slot = { deps, cleanup: undefined as void | (() => void) };
    h.slots[index] = slot;
    h.effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
  },
  useRef: (initial: unknown) => { const index = h.cursor++; return h.slots[index] ??= { current: initial }; },
  useState: (initial: () => unknown) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = initial();
    return [h.slots[index], (next: unknown) => { h.slots[index] = next; }];
  },
}));
vi.mock("motion/react", () => ({ useIsPresent: () => h.present }));
vi.mock("../../hooks/useHashQuery", () => ({
  useHashQuery: () => new URLSearchParams(h.query),
  goToRoute: vi.fn((_route: string, params: Record<string, string>) => { h.query = new URLSearchParams(params).toString(); }),
}));
import { readTogetherView, useTogetherNavigation, writeTogetherView } from "./togetherNavigation";

let frames: Map<number, FrameRequestCallback>;
let scheduled: FrameRequestCallback[];
let nextFrame: number;
function page() {
  const door = { closest: vi.fn(() => null), focus: vi.fn(), scrollIntoView: vi.fn() };
  return { door, querySelector: vi.fn(() => door) };
}
function render(childId = "a", gamesAvailable = true, target = page()) {
  h.cursor = 0; h.effects = [];
  const result = useTogetherNavigation(childId, gamesAvailable);
  result.pageRef.current = target as unknown as HTMLDivElement;
  h.effects.forEach((run) => run());
  return result;
}
function unmount() {
  h.slots.forEach((slot) => slot?.cleanup?.());
  h.slots = []; h.effects = [];
}
function paint() {
  const ready = [...frames.values()]; frames.clear();
  ready.forEach((callback) => callback(0));
}
beforeEach(() => {
  h.slots = []; h.cursor = 0; h.effects = []; h.present = true; h.query = "";
  const data = new Map<string, string>(); frames = new Map(); scheduled = []; nextFrame = 0;
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback); scheduled.push(callback); return nextFrame;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

/* v4 re-pin: Together is three filters — Routines (the default) · Play
   (`games`: the games and the away ideas) · Stories. The former ids still
   arrive by link and stored choice and land on the filter they became:
   all → routines, offscreen → games. */
describe("Together return presentation state", () => {
  it.each([["stories", "stories"], ["games", "games"], ["routines", "routines"], ["offscreen", "games"], ["all", "routines"]] as const)("opens the %s link over a saved category on the first render (as %s)", (param, category) => {
    writeTogetherView("a", { category: "stories" });
    h.query = `f=${param}`;
    expect(render().category).toBe(category);
    expect(readTogetherView("a", true)).toEqual({ category });
  });

  it("a stored former id reads as the filter it became", () => {
    sessionStorage.setItem("arbor.together.view.a", JSON.stringify({ category: "all" }));
    expect(readTogetherView("a", true)).toEqual({ category: "routines" });
    sessionStorage.setItem("arbor.together.view.a", JSON.stringify({ category: "offscreen", returnDoor: "more-ideas" }));
    expect(readTogetherView("a", true)).toEqual({ category: "games", returnDoor: "more-ideas" });
  });

  it("follows query-only navigation and Back/Forward while mounted, cancelling an old return door", () => {
    writeTogetherView("a", { category: "stories", returnDoor: "story-library" });
    const target = page(); render("a", true, target);
    const stale = scheduled.at(-1)!;
    h.query = "f=routines";
    expect(render("a", true, target).category).toBe("routines");
    stale(0); paint(); expect(target.door.focus).not.toHaveBeenCalled();
    h.query = "f=stories"; expect(render().category).toBe("stories");
    h.query = "f=routines"; expect(render().category).toBe("routines");
    // A former id chosen in code writes the filter it became.
    render().setCategory("offscreen");
    expect(h.query).toBe("f=games"); expect(render().category).toBe("games");
  });

  it("rejects unknown filters; Play stays Play when no world is listed (it holds the away ideas)", () => {
    h.query = "f=unknown"; expect(render().category).toBe("routines");
    h.query = "f=games"; expect(render("a", false).category).toBe("games");
    h.query = "f=routines"; expect(render("a", false).category).toBe("routines");
  });

  it("preserves the starting category in the previous history entry before the first filter change", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", { location: { hash: "#/practice" }, history: { state: { existing: true }, replaceState } });
    render().setCategory("stories");
    expect(replaceState).toHaveBeenCalledWith({ existing: true }, "", "#/practice?f=routines");
    h.query = "f=routines"; expect(render().category).toBe("routines");
  });
  it.each(["routines", "games", "stories"] as const)("never moves focus or scroll on an ordinary %s visit or rerender without a pending return", (category) => {
    writeTogetherView("a", { category });
    const target = page();
    // Data arriving or a dock opening/closing rerenders the mounted page. None
    // is a request to restore a catalogue door or move the parent's viewport.
    for (let update = 0; update < 4; update++) {
      expect(render("a", true, target).category).toBe(category); paint();
    }
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(target.querySelector).not.toHaveBeenCalled();
    expect(target.door.focus).not.toHaveBeenCalled();
    expect(target.door.scrollIntoView).not.toHaveBeenCalled();
    expect(readTogetherView("a", true)).toEqual({ category });
  });

  it("does not replay a consumed return during later rerenders or presence changes", () => {
    writeTogetherView("a", { category: "stories", returnDoor: "story-library" });
    const target = page(); render("a", true, target); paint();
    expect(target.door.focus).toHaveBeenCalledOnce();
    expect(target.door.scrollIntoView).toHaveBeenCalledOnce();
    expect(readTogetherView("a", true)).toEqual({ category: "stories" });
    render("a", true, target); paint();
    h.present = false; render("a", true, target); paint();
    h.present = true; render("a", true, target); paint();
    expect(target.door.focus).toHaveBeenCalledOnce();
    expect(target.door.scrollIntoView).toHaveBeenCalledOnce();
  });

  it.each(["story-library", "story-bedtime", "story-comics", "story-family", "world-word-world", "world-speech", "more-ideas"])("restores the specific visible door %s after a normal destination-ready return, once", (returnDoor) => {
    const category = returnDoor.startsWith("world-") ? "games" : returnDoor === "more-ideas" ? "games" : "stories";
    const outgoing = page(); let view = render("a", true, outgoing);
    view.setCategory(category); view = render("a", true, outgoing); view.rememberDoor(returnDoor);
    h.present = false; render("a", true, outgoing); paint();
    expect(outgoing.door.focus).not.toHaveBeenCalled();
    // The destination commits; Together unmounts. A later normal Back mounts it.
    unmount(); h.present = true; const returned = page();
    expect(render("a", true, returned).category).toBe(category);
    expect(returned.door.focus).not.toHaveBeenCalled(); paint();
    expect(returned.querySelector).toHaveBeenCalledWith(`[data-together-return="${returnDoor}"]`);
    expect(returned.door.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(returned.door.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    expect(readTogetherView("a", true)).toEqual({ category });
    render("a", true, returned); paint(); expect(returned.door.focus).toHaveBeenCalledOnce();
  });

  it.each(["story-library", "story-bedtime", "story-comics", "story-family", "world-word-world", "world-speech", "more-ideas"])("restores %s on early Back while the outgoing Together is still mounted and the destination has not committed", (returnDoor) => {
    const category = returnDoor.startsWith("world-") ? "games" : returnDoor === "more-ideas" ? "games" : "stories";
    const retained = page(); let view = render("a", true, retained);
    view.setCategory(category); view = render("a", true, retained); view.rememberDoor(returnDoor);
    const samePageRef = view.pageRef;
    h.present = false; render("a", true, retained); paint();
    expect(retained.door.focus).not.toHaveBeenCalled();
    expect(readTogetherView("a", true)).toEqual({ category, returnDoor });
    // No unmount/remount: the Shell Back button reverses the pending exit.
    h.present = true; view = render("a", true, retained);
    expect(view.pageRef).toBe(samePageRef); expect(view.category).toBe(category);
    paint();
    expect(retained.querySelector).toHaveBeenCalledWith(`[data-together-return="${returnDoor}"]`);
    expect(retained.door.focus).toHaveBeenCalledOnce();
    expect(retained.door.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(retained.door.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    expect(readTogetherView("a", true)).toEqual({ category });
  });

  it("never borrows another child's category or queued return, even before effects", () => {
    writeTogetherView("a", { category: "stories", returnDoor: "story-library" });
    writeTogetherView("b", { category: "games" });
    const previous = page(); expect(render("a", true, previous).category).toBe("stories");
    const stale = scheduled.at(-1)!;
    const current = page(); expect(render("b", true, current).category).toBe("games");
    stale(0); paint();
    expect(previous.door.focus).not.toHaveBeenCalled(); expect(current.door.focus).not.toHaveBeenCalled();
    expect(readTogetherView("b", true)).toEqual({ category: "games" });
    expect(readTogetherView("a", true)).toEqual({ category: "stories", returnDoor: "story-library" });
  });

  it("cancels a queued restoration on a newer departure even if the old frame is delivered late", () => {
    writeTogetherView("a", { category: "stories", returnDoor: "story-library" });
    const target = page(); render("a", true, target); const stale = scheduled.at(-1)!;
    h.present = false; render("a", true, target); stale(0); paint();
    expect(target.door.focus).not.toHaveBeenCalled();
    expect(readTogetherView("a", true)).toEqual({ category: "stories", returnDoor: "story-library" });
    h.present = true; render("a", true, target); paint();
    expect(target.door.focus).toHaveBeenCalledOnce();
  });

  it.each(["filter", "same-door", "other-door"])("does not let a queued frame override a newer %s choice", (action) => {
    writeTogetherView("a", { category: "stories", returnDoor: "story-library" });
    const target = page(); const view = render("a", true, target); const stale = scheduled.at(-1)!;
    if (action === "filter") view.setCategory("offscreen");
    else view.rememberDoor(action === "same-door" ? "story-library" : "story-comics");
    stale(0); paint();
    expect(target.door.focus).not.toHaveBeenCalled();
    expect(readTogetherView("a", true)).toEqual(action === "filter" ? { category: "games" } : { category: "stories", returnDoor: action === "same-door" ? "story-library" : "story-comics" });
  });

  it("a disposed session cannot focus or consume its replacement's pending return", () => {
    writeTogetherView("a", { category: "stories", returnDoor: "story-library" });
    const previous = page(); render("a", true, previous); const stale = scheduled.at(-1)!;
    unmount();
    const replacement = page(); render("a", true, replacement);
    stale(0);
    expect(previous.door.focus).not.toHaveBeenCalled(); expect(replacement.door.focus).not.toHaveBeenCalled();
    expect(readTogetherView("a", true).returnDoor).toBe("story-library");
    paint(); expect(replacement.door.focus).toHaveBeenCalledOnce();
  });

  it("does not consume or focus an unavailable door", () => {
    writeTogetherView("a", { category: "games", returnDoor: "world-speech" });
    const target = page(); target.door.closest.mockReturnValue({} as never);
    expect(render("a", false, target).category).toBe("games"); paint();
    expect(target.door.focus).not.toHaveBeenCalled(); expect(readTogetherView("a", false).returnDoor).toBe("world-speech");
  });

  it("ignores unknown categories, untrusted selectors, obsolete games and broken storage", () => {
    sessionStorage.setItem("arbor.together.view.a", JSON.stringify({ category: "unknown", returnDoor: 'x"] button' })); expect(readTogetherView("a", true)).toEqual({ category: "routines" });
    writeTogetherView("a", { category: "games" }); expect(readTogetherView("a", false)).toEqual({ category: "games" });
    sessionStorage.setItem("arbor.together.view.a", "{"); expect(readTogetherView("a", true)).toEqual({ category: "routines" });
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("disabled"); }, setItem: () => { throw new Error("disabled"); } });
    const view = render(); view.setCategory("stories"); expect(render().category).toBe("stories");
    h.present = false; render(); h.present = true;
    expect(render().category).toBe("stories"); expect(render().category).toBe("stories");
  });

  it("FEAT-07: the routines category round-trips per child and survives games being unavailable", () => {
    writeTogetherView("a", { category: "routines" });
    expect(readTogetherView("a", true)).toEqual({ category: "routines" });
    expect(readTogetherView("a", false)).toEqual({ category: "routines" });
    expect(readTogetherView("b", true)).toEqual({ category: "routines" });
    const view = render("a", false); expect(view.category).toBe("routines");
    view.setCategory("offscreen"); expect(render("a", false).category).toBe("games");
    render("a", false).setCategory("routines"); expect(render("a", false).category).toBe("routines");
    expect(readTogetherView("a", false)).toEqual({ category: "routines" });
    // An unknown or retired value still falls back to the default (v4: Routines).
    sessionStorage.setItem("arbor.together.view.a", JSON.stringify({ category: "routine" }));
    expect(readTogetherView("a", true)).toEqual({ category: "routines" });
  });

  it("pins the actual retained-route boundary that supplies Motion presence", () => {
    const shell = readFileSync(new URL("../layout/Shell.tsx", import.meta.url), "utf8");
    expect(shell).toMatch(/<Suspense[\s\S]*<AnimatePresence[\s\S]*mode="wait"/);
    expect(shell).toContain('key={`${activeTab}@${childProfile.id}`}');
    expect(shell).toMatch(/practice: PracticeStudioTab/);
    expect(shell).toMatch(/const PracticeStudioTab = lazy\(\(\) => import\("\.\.\/companion\/TogetherView"\)\)/);
  });
});
