import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Milestone } from "../../types";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { hydrateMilestones } from "../../context/milestoneHydration";
import { translate } from "../../lib/i18n";

// Run the real reader, history hooks, item/month triggers and SendSheet. This
// deterministic host separates effects, renders and held callbacks so writes
// can occur between review and the native share boundary, without a browser.
const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as unknown[], instances: new Map<string, unknown[]>(),
  pending: [] as (() => void)[], dirty: false,
  nodes: [] as { type: string; props: Record<string, unknown> }[],
  storage: new Map<string, string>(), rawMilestones: [] as Milestone[],
  lang: "en" as "en" | "he", compact: true, child: "child-a",
  send: vi.fn(async (_payload: { text: string; surface: string; artifact: string }) => "shared"),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const slots = h.slots, index = h.cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (next: unknown) => {
      const value = typeof next === "function" ? next(slots[index]) : next;
      if (!Object.is(slots[index], value)) { slots[index] = value; h.dirty = true; }
    }];
  },
  useRef: (initial: unknown) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown, deps: unknown[]) => {
    const index = h.cursor++;
    const previous = h.slots[index] as { deps: unknown[]; callback: unknown } | undefined;
    if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return previous.callback;
    h.slots[index] = { deps, callback }; return callback;
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = h.cursor++;
    const previous = h.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
    const slot = { deps, cleanup: previous?.cleanup }; h.slots[index] = slot;
    h.pending.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
  },
}));
vi.mock("../../context/ArborContext", async () => {
  const { hydrateMilestones } = await import("../../context/milestoneHydration");
  const { ALL_MILESTONES } = await import("../../lib/milestoneData");
  return { useArbor: () => {
    const milestones = hydrateMilestones(h.rawMilestones, ALL_MILESTONES);
    return { childProfile: { id: h.child, name: "Noa", gender: "girl" }, behaviorLogs: [], milestones,
      milestoneHistory: { items: milestones, sourceItems: h.rawMilestones }, setActiveTab: vi.fn() };
  } };
});
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "local-sandbox" } }) }));
vi.mock("../../lib/firebase", () => ({ db: null, firebaseEnabled: false }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../lib/share", () => ({ sendTextShare: h.send }));
vi.mock("../ui/Icon", () => ({ default: () => null }));
vi.mock("../ui/Sheet", () => ({ useCompactSurface: () => h.compact, Sheet: (props: Record<string, unknown>) => <section {...props} data-testid="review-shell" /> }));
vi.mock("../ui/Modal", () => ({ Modal: (props: Record<string, unknown>) => <section {...props} data-testid="review-shell" /> }));
import KeptThingsPage from "./KeptThingsPage";

function render(flush = true) {
  h.nodes = []; h.dirty = false;
  const visited = new Set<string>();
  const walk = (node: React.ReactNode, path: string) => {
    if (Array.isArray(node)) { node.forEach((child, i) => walk(child, `${path}.${i}`)); return; }
    if (!React.isValidElement(node)) return;
    const element = node as React.ReactElement<Record<string, unknown>>;
    if (typeof element.type === "function") {
      const key = `${path}:${element.key ?? element.type.name}`;
      visited.add(key); h.slots = h.instances.get(key) ?? []; h.instances.set(key, h.slots); h.cursor = 0;
      walk((element.type as (props: Record<string, unknown>) => React.ReactNode)(element.props), key);
    } else {
      if (typeof element.type === "string") h.nodes.push({ type: element.type, props: element.props });
      walk(element.props.children as React.ReactNode, `${path}.children`);
    }
  };
  walk(<KeptThingsPage />, "reader");
  for (const [key, slots] of h.instances) if (!visited.has(key)) {
    for (const slot of slots) (slot as { cleanup?: () => void } | null)?.cleanup?.();
    h.instances.delete(key);
  }
  if (flush) h.pending.splice(0).forEach(effect => effect());
}
const settle = () => { for (let i = 0; i < 12; i++) { render(); if (!h.dirty) return; } throw new Error("Reader did not settle"); };
const node = (id: string) => h.nodes.find(row => row.props["data-testid"] === id)?.props;
const click = (id: string) => { const props = node(id); expect(props, id).toBeDefined(); expect(props!.disabled).not.toBe(true); (props!.onClick as () => void)(); };
const key = (name: string) => `arbor.${name}.${h.child}`;
const seedMilestones = (rows: Milestone[]) => { h.rawMilestones = rows; h.storage.set(key("milestones"), JSON.stringify(rows)); };
const quote = { id: "quote", kind: "quote", milestoneId: "", note: "The moon follows us", noticedOn: "2026-10-05", createdAt: "2026-10-05", updatedAt: "2026-10-05" };
const finish = async () => { click("send-sheet-send"); await Promise.resolve(); settle(); };
beforeEach(() => {
  h.cursor = 0; h.slots = []; h.instances.clear(); h.pending = []; h.nodes = []; h.storage.clear(); h.dirty = false;
  h.lang = "en"; h.compact = true; h.child = "child-a"; h.send.mockClear();
  seedMilestones([]); h.storage.set(key("keepsakes"), JSON.stringify([quote]));
  vi.stubGlobal("localStorage", { getItem: vi.fn((name: string) => h.storage.get(name) ?? null), setItem: vi.fn() });
});

describe("Kept raw source and hydrated display freshness", () => {
  for (const lang of ["en", "he"] as const) for (const compact of [true, false]) for (const surface of ["item", "month"]) {
    it(`${lang}/${compact ? "sheet" : "modal"}/${surface}: empty stored milestones allow first review, cancel and repeated reviewed Send`, async () => {
      h.lang = lang; h.compact = compact;
      expect(hydrateMilestones([], ALL_MILESTONES).length).toBeGreaterThan(0);
      settle(); click(`kept-${surface}-send`); settle();
      expect(node("send-sheet")).toBeDefined(); expect(h.send).not.toHaveBeenCalled();
      (node("review-shell")!.onClose as () => void)(); settle();
      expect(node("send-sheet")).toBeUndefined(); expect(h.send).not.toHaveBeenCalled();
      for (let i = 1; i <= 2; i++) {
        click(`kept-${surface}-send`); settle(); expect(node("send-sheet")).toBeDefined();
        await finish(); expect(h.send).toHaveBeenCalledTimes(i); expect(node("send-sheet")).toBeUndefined();
      }
      expect(h.send).toHaveBeenLastCalledWith(expect.objectContaining({ surface: `kept_${surface}`, text: expect.stringContaining(quote.note) }));
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(h.storage.get(key("milestones"))).toBe("[]");
    });
  }

  it.each(["empty", "retired"])("does not confuse the %s projection with raw source ownership", async mode => {
    if (mode === "retired") seedMilestones([{ ...ALL_MILESTONES[0], id: "m-3", checked: true }]);
    settle(); click("kept-item-send"); settle(); expect(node("send-sheet")).toBeDefined();
    await finish(); expect(h.send).toHaveBeenCalledOnce();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it.each(["behaviorLogs", "milestones", "keepsakes", "langObs"])("rejects a real subsequent %s edit at final Send before rerender", async name => {
    settle(); click("kept-item-send"); settle(); expect(node("send-sheet")).toBeDefined();
    h.storage.set(key(name), JSON.stringify([{ id: "changed-source", note: "Changed after review" }]));
    await finish(); expect(h.send).not.toHaveBeenCalled(); expect(node("send-sheet")).toBeUndefined();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("requires a fresh review after a real edit, then sends only the refreshed words", async () => {
    settle(); click("kept-item-send"); settle();
    const corrected = { ...quote, note: "The stars came with us" };
    h.storage.set(key("keepsakes"), JSON.stringify([corrected]));
    await finish(); expect(h.send).not.toHaveBeenCalled(); expect(node("send-sheet")).toBeUndefined();
    click("kept-item-send"); settle();
    await finish();
    expect(h.send).toHaveBeenCalledOnce();
    const sent = h.send.mock.calls[0][0];
    expect(sent.text).toContain(corrected.note); expect(sent.text).not.toContain(quote.note);
  });

  it("rejects a held review after a raw-context change before the new display commits", async () => {
    settle(); click("kept-item-send"); settle();
    const send = node("send-sheet-send")!.onClick as () => void;
    h.rawMilestones = [{ ...ALL_MILESTONES[0], checked: true, observedAt: "2026-10-06" }];
    render(false);
    send(); await Promise.resolve(); expect(h.send).not.toHaveBeenCalled();
  });

  it("never revives a held approval after a child A to B to A switch", async () => {
    settle(); click("kept-item-send"); settle();
    const send = node("send-sheet-send")!.onClick as () => void;
    h.child = "child-b"; render(false); h.child = "child-a"; render(false);
    send(); await Promise.resolve(); expect(h.send).not.toHaveBeenCalled();
  });
});
