import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real module and DOM-control callbacks with deterministic React hook slots.
// This is source/interaction evidence, not mounted-browser or screen-reader QA.
const hooks = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], dirty: false }));
const context = vi.hoisted(() => ({ child: { id: "child-a", name: "Noa" }, lang: "en" as "en" | "he", toast: vi.fn() }));
vi.mock("react", async (original) => {
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  return {
    ...await original<typeof import("react")>(),
    useState: (initial: any) => {
      const at = hooks.cursor++;
      if (!(at in hooks.slots)) hooks.slots[at] = typeof initial === "function" ? initial() : initial;
      return [hooks.slots[at], (next: any) => {
        const value = typeof next === "function" ? next(hooks.slots[at]) : next;
        if (!Object.is(value, hooks.slots[at])) { hooks.slots[at] = value; hooks.dirty = true; }
      }];
    },
    useRef: (initial: any) => { const at = hooks.cursor++; return hooks.slots[at] ??= { current: initial }; },
    useCallback: (callback: any, deps: unknown[]) => {
      const at = hooks.cursor++;
      if (!hooks.slots[at] || !same(hooks.slots[at].deps, deps)) hooks.slots[at] = { deps, callback };
      return hooks.slots[at].callback;
    },
    useMemo: (compute: () => unknown, deps: unknown[]) => {
      const at = hooks.cursor++;
      if (!hooks.slots[at] || !same(hooks.slots[at].deps, deps)) hooks.slots[at] = { deps, value: compute() };
      return hooks.slots[at].value;
    },
    useEffect: () => {},
  };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: context.child }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: context.toast }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: context.lang, t: (key: string, vars?: Record<string, string | number>) => translate(context.lang, key, vars) }) };
});
import RoutinesTab from "./RoutinesTab";
import { Receipt } from "../ui/Receipt";
import { ROUTINES } from "../../lib/routines";
import { translate } from "../../lib/i18n";

type El = React.ReactElement<Record<string, any>>;
const morning = ROUTINES[0];
const keys = morning.steps.map(step => step.key);
const store = new Map<string, string>();
const storage = { getItem: vi.fn((key: string) => store.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { store.set(key, value); }) };
const storageKey = (child = "child-a") => `arbor.routines.done.${child}`;
function elements(node: React.ReactNode): El[] {
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(elements)];
}
function render() {
  for (let attempt = 0; attempt < 10; attempt++) {
    hooks.cursor = 0; hooks.dirty = false;
    const tree = RoutinesTab();
    if (!hooks.dirty) return tree;
  }
  throw new Error("Unbounded rerender");
}
function byId(id: string, tree = render()) { const element = elements(tree).find(el => el.props["data-testid"] === id); expect(element, id).toBeDefined(); return element!; }
const click = (id: string) => byId(id).props.onClick();
const receipt = (tree = render()) => elements(tree).find(el => el.type === Receipt);
const complete = () => keys.forEach(key => click(`routine-step-${key}`));
const savedMap = (child = "child-a") => JSON.parse(store.get(storageKey(child)) ?? "{}");
function expectReceipt(key: string) {
  const line = receipt(); expect(line).toBeDefined();
  expect(line!.props.testId).toBe("routines-completion-receipt");
  expect(line!.props.announce).not.toBe(false);
  expect(line!.props.children).toBe(translate(context.lang, key));
  const markup = renderToStaticMarkup(line!);
  expect(markup).toContain(`dir="${context.lang === "he" ? "rtl" : "ltr"}"`);
  expect(markup).toContain(`lang="${context.lang}"`);
  expect(markup).toContain('data-receipt="muted"');
}
beforeEach(() => {
  hooks.cursor = 0; hooks.slots = []; hooks.dirty = false;
  context.child = { id: "child-a", name: "Noa" }; context.lang = "en";
  store.clear(); vi.clearAllMocks();
  storage.setItem.mockImplementation((key, value) => { store.set(key, value); });
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => vi.unstubAllGlobals());

for (const lang of ["en", "he"] as const) describe(`Routines action receipt · ${lang}`, () => {
  beforeEach(() => { context.lang = lang; });
  it("only the final step shows the shared in-place receipt and keeps local checklist semantics", () => {
    keys.slice(0, -1).forEach(key => click(`routine-step-${key}`));
    expect(receipt()).toBeUndefined(); expect(context.toast).not.toHaveBeenCalled();
    click(`routine-step-${keys.at(-1)}`);
    expectReceipt("routines.doneReceipt");
    expect(savedMap()).toEqual({ [morning.id]: keys });
    expect(storage.setItem.mock.calls.every(([key]) => key === storageKey())).toBe(true);
    expect(context.toast).not.toHaveBeenCalled();
    for (const key of keys) expect(byId(`routine-step-${key}`).props["aria-pressed"]).toBe(true);
  });
  it("tells the truth when storage throws, keeps the checklist usable, and retries on a new completion", () => {
    storage.setItem.mockImplementation(() => { throw new Error("quota exceeded"); });
    complete(); expectReceipt("routines.doneReceiptUnsaved");
    expect(store.size).toBe(0); expect(context.toast).not.toHaveBeenCalled();
    click(`routine-step-${keys.at(-1)}`); expect(receipt()).toBeUndefined();
    storage.setItem.mockImplementation((key, value) => { store.set(key, value); });
    click(`routine-step-${keys.at(-1)}`); expectReceipt("routines.doneReceipt");
    expect(savedMap()).toEqual({ [morning.id]: keys });
  });
  it("receipt wording names local persistence and claims no reward or child-world transfer", () => {
    for (const key of ["routines.doneReceipt", "routines.doneReceiptUnsaved"]) {
      const value = translate(lang, key);
      expect(value).not.toBe(key);
      expect(value).not.toMatch(/⭐|★|star|world|כוכב|בעולם|assigned|שויכה/i);
      expect(value).toMatch(lang === "en" ? /device/ : /מכשיר/);
    }
    expect(translate(lang, "routines.doneReceiptUnsaved")).toMatch(lang === "en" ? /couldn.t be saved/ : /לא.*נשמרה/);
  });
});

describe("Routines receipt lifetime", () => {
  it("never reconstructs an action receipt from an already-complete stored checklist", () => {
    store.set(storageKey(), JSON.stringify({ [morning.id]: keys }));
    expect(receipt()).toBeUndefined();
    keys.forEach(key => expect(byId(`routine-step-${key}`).props["aria-pressed"]).toBe(true));
    expect(context.toast).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("clears on deselection and cannot revive on returning to the completed routine", () => {
    complete(); expect(receipt()).toBeDefined();
    const staleFinalStep = byId(`routine-step-${keys.at(-1)}`).props.onClick;
    click(`routine-tile-${ROUTINES[1].id}`); expect(receipt()).toBeUndefined();
    click(`routine-step-${ROUTINES[1].steps[0].key}`);
    click(`routine-tile-${morning.id}`); staleFinalStep();
    expect(receipt()).toBeUndefined(); expect(savedMap()[morning.id]).toEqual(keys);
    expect(savedMap()[ROUTINES[1].id]).toEqual([ROUTINES[1].steps[0].key]);
  });
  it("Reset invalidates prior callbacks and receipt while preserving other routines", () => {
    store.set(storageKey(), JSON.stringify({ [ROUTINES[1].id]: [ROUTINES[1].steps[0].key] }));
    complete(); const staleFinalStep = byId(`routine-step-${keys.at(-1)}`).props.onClick;
    click("routines-reset"); staleFinalStep();
    expect(receipt()).toBeUndefined();
    expect(savedMap()).toEqual({ [ROUTINES[1].id]: [ROUTINES[1].steps[0].key] });
    keys.forEach(key => expect(byId(`routine-step-${key}`).props["aria-pressed"]).toBe(false));
    complete(); expectReceipt("routines.doneReceipt");
  });
  it("repeated calls before rerender toggle latest state and cannot leave a completion receipt on an undone step", () => {
    keys.slice(0, -1).forEach(key => click(`routine-step-${key}`));
    const finalStep = byId(`routine-step-${keys.at(-1)}`).props.onClick;
    finalStep(); finalStep();
    expect(receipt()).toBeUndefined();
    expect(savedMap()[morning.id]).toEqual(keys.slice(0, -1));
    expect(context.toast).not.toHaveBeenCalled();
    finalStep(); expectReceipt("routines.doneReceipt");
  });
  it("different step callbacks in one render preserve both checklist changes", () => {
    const tree = render();
    byId(`routine-step-${keys[0]}`, tree).props.onClick();
    byId(`routine-step-${keys[1]}`, tree).props.onClick();
    expect(savedMap()[morning.id]).toEqual(keys.slice(0, 2));
  });
  it("defensively scopes forced same-instance child changes and rejects old-child callbacks", () => {
    // Shell normally keys this surface by child ID. Deliberately retain the
    // instance to verify the component boundary too; not an ordinary-route leak.
    complete(); const oldStep = byId(`routine-step-${keys.at(-1)}`).props.onClick;
    const oldReset = byId("routines-reset").props.onClick;
    store.set(storageKey("child-b"), JSON.stringify({ [morning.id]: [keys[1]] }));
    context.child = { id: "child-b", name: "Eli" };
    expect(receipt()).toBeUndefined();
    expect(byId(`routine-step-${keys[0]}`).props["aria-pressed"]).toBe(false);
    expect(byId(`routine-step-${keys[1]}`).props["aria-pressed"]).toBe(true);
    oldStep(); oldReset(); click(`routine-step-${keys[0]}`);
    expect(savedMap("child-b")[morning.id]).toEqual([keys[1], keys[0]]);
    expect(savedMap()[morning.id]).toEqual(keys);
    context.child = { id: "child-a", name: "Noa" };
    expect(receipt()).toBeUndefined(); oldStep();
    expect(savedMap()[morning.id]).toEqual(keys);
  });
  it("only counts real steps when legacy storage includes unknown keys", () => {
    store.set(storageKey(), JSON.stringify({ [morning.id]: [...keys.slice(0, -2), "retired-step"] }));
    click(`routine-step-${keys.at(-2)}`); expect(receipt()).toBeUndefined();
    click(`routine-step-${keys.at(-1)}`); expectReceipt("routines.doneReceipt");
  });
  it("leaves no receipt after Reset even when local persistence fails", () => {
    complete(); storage.setItem.mockImplementation(() => { throw new Error("unavailable"); });
    click("routines-reset"); expect(receipt()).toBeUndefined();
    keys.forEach(key => expect(byId(`routine-step-${key}`).props["aria-pressed"]).toBe(false));
  });
});
