import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// Retain hook slots and respect effect dependencies/cleanup. Motion's presence
// boundary is controlled explicitly: mode="wait" keeps an exiting route mounted
// until the destination commits, and early Back makes that same route present.
// v3 F-TOG-2: the category is the hash (#/practice?f=…); the hash query is a
// test double here, and goToRoute moves it the way a hashchange would.
// This executes the production hook, not browser layout or React scheduling.
const h = vi.hoisted(() => ({
  slots: [] as any[], cursor: 0, effects: [] as (() => void)[], present: true,
  query: "", routes: [] as [string, Record<string, string>][],
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
  goToRoute: (route: string, params: Record<string, string>) => { h.routes.push([route, params]); h.query = new URLSearchParams(params).toString(); },
}));
import { categoryFromQuery, readTogetherReturn, TOGETHER_CATEGORIES, useTogetherNavigation, writeTogetherReturn } from "./togetherNavigation";

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
  h.slots = []; h.cursor = 0; h.effects = []; h.present = true; h.query = ""; h.routes = [];
  const data = new Map<string, string>(); frames = new Map(); scheduled = []; nextFrame = 0;
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback); scheduled.push(callback); return nextFrame;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

const WORLD_DOORS = ["world-word-world", "world-speech"] as const;

describe("v3 F-TOG-2 · the pill is the address", () => {
  it("the five pills, in the Shell row's order", () => {
    expect(TOGETHER_CATEGORIES).toEqual(["all", "games", "stories", "routines", "offscreen"]);
  });

  it.each(["all", "games", "stories", "routines", "offscreen"] as const)("f=%s names its pill", (category) => {
    expect(categoryFromQuery(category, true)).toBe(category);
    h.query = `f=${category}`;
    expect(render().category).toBe(category);
  });

  it("no f, an unknown f, and Games while play is closed are All together", () => {
    for (const value of [null, undefined, "", "unknown", "routine", "away", "GAMES"]) expect(categoryFromQuery(value, true), String(value)).toBe("all");
    expect(categoryFromQuery("games", false)).toBe("all");
    expect(categoryFromQuery("routines", false)).toBe("routines");
    h.query = "f=games"; expect(render("a", false).category).toBe("all");
    h.query = "world=speech"; expect(render().category).toBe("all");
  });

  it("a choice on the page goes to the same address a Shell pill does (a new history entry)", () => {
    const view = render();
    view.setCategory("stories");
    expect(h.routes).toEqual([["practice", { f: "stories" }]]);
    expect(render().category).toBe("stories");
    render("a", false).setCategory("games");
    expect(h.routes.at(-1)).toEqual(["practice", { f: "all" }]);
  });
});

describe("Together return presentation state", () => {
  it.each(["all", "stories", "games", "routines", "offscreen"] as const)("never moves focus or scroll on an ordinary %s visit or rerender without a pending return", (category) => {
    h.query = `f=${category}`;
    const target = page();
    // Data arriving or a dock opening/closing rerenders the mounted page. None
    // is a request to restore a door or move the parent's viewport.
    for (let update = 0; update < 4; update++) {
      expect(render("a", true, target).category).toBe(category); paint();
    }
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(target.querySelector).not.toHaveBeenCalled();
    expect(target.door.focus).not.toHaveBeenCalled();
    expect(target.door.scrollIntoView).not.toHaveBeenCalled();
    expect(readTogetherReturn("a")).toBeNull();
  });

  it("does not replay a consumed return during later rerenders or presence changes", () => {
    h.query = "f=games";
    writeTogetherReturn("a", { category: "games", returnDoor: "world-word-world" });
    const target = page(); render("a", true, target); paint();
    expect(target.door.focus).toHaveBeenCalledOnce();
    expect(target.door.scrollIntoView).toHaveBeenCalledOnce();
    expect(readTogetherReturn("a")).toBeNull();
    render("a", true, target); paint();
    h.present = false; render("a", true, target); paint();
    h.present = true; render("a", true, target); paint();
    expect(target.door.focus).toHaveBeenCalledOnce();
    expect(target.door.scrollIntoView).toHaveBeenCalledOnce();
  });

  it.each(WORLD_DOORS)("restores the specific visible door %s after a normal destination-ready return, once", (returnDoor) => {
    h.query = "f=games";
    const outgoing = page(); const view = render("a", true, outgoing); view.rememberDoor(returnDoor);
    expect(readTogetherReturn("a")).toEqual({ category: "games", returnDoor });
    h.present = false; render("a", true, outgoing); paint();
    expect(outgoing.door.focus).not.toHaveBeenCalled();
    // The destination commits; Together unmounts. A later normal Back mounts it.
    unmount(); h.present = true; const returned = page();
    expect(render("a", true, returned).category).toBe("games");
    expect(returned.door.focus).not.toHaveBeenCalled(); paint();
    expect(returned.querySelector).toHaveBeenCalledWith(`[data-together-return="${returnDoor}"]`);
    expect(returned.door.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(returned.door.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    expect(readTogetherReturn("a")).toBeNull();
    render("a", true, returned); paint(); expect(returned.door.focus).toHaveBeenCalledOnce();
  });

  it.each(WORLD_DOORS)("restores %s on early Back while the outgoing Together is still mounted and the destination has not committed", (returnDoor) => {
    h.query = "f=games";
    const retained = page(); let view = render("a", true, retained); view.rememberDoor(returnDoor);
    const samePageRef = view.pageRef;
    h.present = false; render("a", true, retained); paint();
    expect(retained.door.focus).not.toHaveBeenCalled();
    expect(readTogetherReturn("a")).toEqual({ category: "games", returnDoor });
    // No unmount/remount: the Shell Back button reverses the pending exit.
    h.present = true; view = render("a", true, retained);
    expect(view.pageRef).toBe(samePageRef); expect(view.category).toBe("games");
    paint();
    expect(retained.querySelector).toHaveBeenCalledWith(`[data-together-return="${returnDoor}"]`);
    expect(retained.door.focus).toHaveBeenCalledOnce();
    expect(retained.door.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(retained.door.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    expect(readTogetherReturn("a")).toBeNull();
  });

  it("never borrows another child's queued return, even before effects", () => {
    h.query = "f=games";
    writeTogetherReturn("a", { category: "games", returnDoor: "world-word-world" });
    const previous = page(); render("a", true, previous);
    const stale = scheduled.at(-1)!;
    const current = page(); render("b", true, current);
    stale(0); paint();
    expect(previous.door.focus).not.toHaveBeenCalled(); expect(current.door.focus).not.toHaveBeenCalled();
    expect(readTogetherReturn("b")).toBeNull();
    expect(readTogetherReturn("a")).toEqual({ category: "games", returnDoor: "world-word-world" });
  });

  it("cancels a queued restoration on a newer departure even if the old frame is delivered late", () => {
    h.query = "f=games";
    writeTogetherReturn("a", { category: "games", returnDoor: "world-speech" });
    const target = page(); render("a", true, target); const stale = scheduled.at(-1)!;
    h.present = false; render("a", true, target); stale(0); paint();
    expect(target.door.focus).not.toHaveBeenCalled();
    expect(readTogetherReturn("a")).toEqual({ category: "games", returnDoor: "world-speech" });
    h.present = true; render("a", true, target); paint();
    expect(target.door.focus).toHaveBeenCalledOnce();
  });

  it.each(["pill", "same-door", "other-door"])("does not let a queued frame override a newer %s choice", (action) => {
    h.query = "f=games";
    writeTogetherReturn("a", { category: "games", returnDoor: "world-word-world" });
    const target = page(); const view = render("a", true, target); const stale = scheduled.at(-1)!;
    if (action === "pill") view.setCategory("offscreen");
    else view.rememberDoor(action === "same-door" ? "world-word-world" : "world-speech");
    stale(0); paint();
    expect(target.door.focus).not.toHaveBeenCalled();
    expect(readTogetherReturn("a")).toEqual(action === "pill" ? null : { category: "games", returnDoor: action === "same-door" ? "world-word-world" : "world-speech" });
  });

  it("a disposed session cannot focus or consume its replacement's pending return", () => {
    h.query = "f=games";
    writeTogetherReturn("a", { category: "games", returnDoor: "world-word-world" });
    const previous = page(); render("a", true, previous); const stale = scheduled.at(-1)!;
    unmount();
    const replacement = page(); render("a", true, replacement);
    stale(0);
    expect(previous.door.focus).not.toHaveBeenCalled(); expect(replacement.door.focus).not.toHaveBeenCalled();
    expect(readTogetherReturn("a")?.returnDoor).toBe("world-word-world");
    paint(); expect(replacement.door.focus).toHaveBeenCalledOnce();
  });

  it("does not consume or focus a door that is hidden", () => {
    h.query = "f=games";
    writeTogetherReturn("a", { category: "games", returnDoor: "world-speech" });
    const target = page(); target.door.closest.mockReturnValue({} as never);
    render("a", true, target); paint();
    expect(target.door.focus).not.toHaveBeenCalled(); expect(readTogetherReturn("a")?.returnDoor).toBe("world-speech");
  });

  it("a return to another pill spends the way back without moving focus (Games closed lands on All together)", () => {
    h.query = "f=games";
    writeTogetherReturn("a", { category: "games", returnDoor: "world-speech" });
    const target = page();
    expect(render("a", false, target).category).toBe("all"); paint();
    expect(target.door.focus).not.toHaveBeenCalled(); expect(target.querySelector).not.toHaveBeenCalled();
    expect(readTogetherReturn("a")).toBeNull();
  });

  it("ignores unknown categories, retired story doors, untrusted selectors and broken storage", () => {
    sessionStorage.setItem("arbor.together.return.a", JSON.stringify({ category: "unknown", returnDoor: "world-speech" })); expect(readTogetherReturn("a")).toBeNull();
    sessionStorage.setItem("arbor.together.return.a", JSON.stringify({ category: "games", returnDoor: 'x"] button' })); expect(readTogetherReturn("a")).toBeNull();
    // v3 F-TOG-2: the story doors and "More ideas" left Together; their returns are no longer kept.
    for (const retired of ["story-library", "story-bedtime", "story-comics", "story-family", "more-ideas", "world-nope"]) {
      writeTogetherReturn("a", { category: "stories", returnDoor: retired as never });
      expect(readTogetherReturn("a"), retired).toBeNull();
    }
    sessionStorage.setItem("arbor.together.return.a", "{"); expect(readTogetherReturn("a")).toBeNull();
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("disabled"); }, setItem: () => { throw new Error("disabled"); } });
    h.query = "f=games";
    const view = render(); view.rememberDoor("world-speech"); view.setCategory("stories");
    expect(render().category).toBe("stories");
    h.present = false; render(); h.present = true;
    expect(render().category).toBe("stories");
  });

  it("pins the actual retained-route boundary that supplies Motion presence", () => {
    const shell = readFileSync(new URL("../layout/Shell.tsx", import.meta.url), "utf8");
    expect(shell).toMatch(/<Suspense[\s\S]*<AnimatePresence[\s\S]*mode="wait"/);
    expect(shell).toContain('key={`${activeTab}@${childProfile.id}`}');
    expect(shell).toMatch(/practice: PracticeStudioTab/);
    expect(shell).toMatch(/const PracticeStudioTab = lazy\(\(\) => import\("\.\.\/companion\/TogetherView"\)\)/);
  });
});
