import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ slot: null as any, effects: [] as (() => void)[] }));
vi.mock("react", () => ({ useRef: (initial: unknown) => h.slot ??= { current: initial }, useEffect: (fn: () => void) => h.effects.push(fn) }));
import { useBookProgress } from "./useBookProgress";
import { fiveSmoothStones as book } from "../../lib/library/books/fiveSmoothStones";
import { bookFlowReducer, END, initialBookFlow, readPath, type BookFlowState } from "../../lib/library/bookFlow";
const progress = vi.fn(), complete = vi.fn();
const render = (state: BookFlowState) => { useBookProgress(book, state, progress, complete); h.effects.splice(0).forEach(fn => fn()); };
beforeEach(() => { h.slot = null; h.effects = []; vi.clearAllMocks(); });
describe("bounded reader callbacks", () => {
  it("mount and cosmetic re-renders never write a position", () => { render(initialBookFlow()); render(initialBookFlow()); expect(progress).not.toHaveBeenCalled(); });
  it("reports page navigation, not selected cards or repair taps", () => {
    const state = { ...initialBookFlow(), at: book.decision.pageId };
    render(state); render({ ...state, selected: book.decision.choices[0].id, repaired: ["temporary-tap"] });
    expect(progress).not.toHaveBeenCalled();
    render(bookFlowReducer(book, initialBookFlow(), { type: "open" }));
    expect(progress).toHaveBeenCalledTimes(1);
    expect(Object.keys(progress.mock.calls[0][0]).sort()).toEqual(["at", "choiceId"]);
  });
  it("only the final page to END completes; repeated effects and mounting a saved END do not", () => {
    const branch = book.decision.choices[0].id;
    const last = { ...initialBookFlow(), at: readPath(book, branch).at(-1)!.id, choiceId: branch };
    render(last); render(bookFlowReducer(book, last, { type: "next" })); render({ ...last, at: END });
    expect(complete).toHaveBeenCalledTimes(1);
    h.slot = null; complete.mockClear(); render({ ...last, at: END });
    expect(complete).not.toHaveBeenCalled();
  });
});
