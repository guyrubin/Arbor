/**
 * B-BOOK-66 (fix round 2, P1-2) — "Log it" never loses the row. The real
 * component runs through a small hook harness (no DOM in this repo; the
 * B-BOOK-27 reader harness uses the same pattern) and is driven by its own
 * onClick handlers: Log it opens the ONE capture sheet with the ask-after as
 * its cue and leaves the row mounted, also after a reload (a cancelled sheet
 * writes nothing); Hide removes it, also after a reload. Synthetic data only.
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  hook: null as any,
  lang: "en" as "en" | "he",
  openCaptureSheet: vi.fn(),
  store: new Map<string, string>(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const hooks = {
    useState: (...args: any[]) => env.hook.state(...args),
    useMemo: (compute: () => unknown) => compute(),
  };
  return { ...real, ...hooks, default: { ...real, ...hooks } };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "kid-synthetic-1", name: "Mia Test", gender: "girl" }, openCaptureSheet: env.openCaptureSheet }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: env.lang, t: (key: string, vars?: Record<string, string | number>) => translate(env.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_id: string, name: string) => {
    const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(19, 0, 0, 0);
    return { items: name === "bookReads" ? [{ id: "read-1", bookId: "five-smooth-stones", lang: "en", finishedAt: y.toISOString() }] : [], loaded: true };
  },
}));

import NowKidHandback from "./NowKidHandback";
import { NOW_COPY } from "./nowViewCopy";

/** Mount the component with fresh hook slots (a reload) and re-render on state changes. */
function mount() {
  const slots: any[] = [];
  let index = 0;
  let tree: React.ReactNode = null;
  const render = () => {
    index = 0;
    env.hook = {
      state(initial: any) {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
        return [slots[slot], (next: any) => { slots[slot] = typeof next === "function" ? next(slots[slot]) : next; render(); }];
      },
    };
    tree = NowKidHandback();
  };
  render();
  return { get tree() { return tree; } };
}
type El = React.ReactElement<Record<string, any>>;
function elements(node: unknown): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  return [node as El, ...elements((node as El).props.children)];
}
const find = (tree: React.ReactNode, cls: string) => elements(tree).find((el) => typeof el.props.className === "string" && el.props.className.split(" ").includes(cls));
const bookRow = (tree: React.ReactNode) => elements(tree).find((el) => el.props["data-testid"] === "today-handback-book");

beforeEach(() => {
  env.openCaptureSheet.mockReset();
  env.store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => env.store.get(k) ?? null, setItem: (k: string, v: string) => void env.store.set(k, v), removeItem: (k: string) => void env.store.delete(k) });
});

describe("B-BOOK-66 · Log it keeps the row; Hide removes it", () => {
  it("Log it opens the capture sheet with the ask-after as its cue; cancelling leaves the row mounted, also after a reload", () => {
    const view = mount();
    expect(bookRow(view.tree)).toBeTruthy();
    find(view.tree, "now-handback-log")!.props.onClick();
    expect(env.openCaptureSheet).toHaveBeenCalledTimes(1);
    const opts = env.openCaptureSheet.mock.calls[0][0];
    expect(opts).toEqual({ mode: "text", cue: NOW_COPY.en.bookRowAsk("Why did David leave the king's armour in the tent?") });
    expect(opts).not.toHaveProperty("initialText"); // the question is a cue, never the parent's draft
    // the parent cancels the sheet: nothing was written, the row is still there
    expect(bookRow(view.tree)).toBeTruthy();
    expect(env.store.size).toBe(0);
    expect(bookRow(mount().tree)).toBeTruthy(); // after a reload
  });

  it("Hide removes the row, also after a reload", () => {
    const view = mount();
    const hide = elements(bookRow(view.tree)).find((el) => typeof el.props.className === "string" && el.props.className.includes("now-handback-hide"))!;
    hide.props.onClick();
    expect(bookRow(view.tree)).toBeFalsy();
    expect(bookRow(mount().tree)).toBeFalsy();
    expect(env.openCaptureSheet).not.toHaveBeenCalled();
  });
});
