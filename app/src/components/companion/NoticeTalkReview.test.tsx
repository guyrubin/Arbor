import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], effects: [] as (() => void)[], dirty: false, uid: "owner-a", current: true,
  request: { childId: "c1", milestoneId: "m1", ownerId: "owner-a", requestId: 1 } as any, source: {} as any, reload: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: any) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial; return [h.slots[i], (next: any) => { const value = typeof next === "function" ? next(h.slots[i]) : next; if (!Object.is(value, h.slots[i])) { h.slots[i] = value; h.dirty = true; } }]; },
  useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
  useEffect: (fn: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, old = h.slots[i]; if (old && deps.every((value, n) => Object.is(value, old.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; h.slots[i] = slot; h.effects.push(() => { old?.cleanup?.(); slot.cleanup = fn(); }); },
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../../hooks/useNoticeSource", () => ({ useNoticeSource: () => ({ ...h.source, isCurrent: () => h.current, reload: h.reload }) }));
vi.mock("../../lib/noticeHandoff", () => ({ readNoticeTalk: () => h.request, clearNoticeTalk: (request: unknown) => { if (h.request === request) h.request = null; } }));
import NoticeTalkReview, { type NoticeTalkController } from "./NoticeTalkReview";
import { reviewedPortraitDraft } from "./portraitEvidence";
const controller: React.MutableRefObject<NoticeTalkController | null> = { current: null };
const request = { childId: "c1", milestoneId: "m1", ownerId: "owner-a", requestId: 1 };
type Element = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
const find = (tree: React.ReactNode, id: string) => elements(tree).find(node => node.props["data-testid"] === id)!;
const render = (question = "What could we try together?", he = false) => { for (let n = 0; n < 10; n++) { h.cursor = 0; h.dirty = false; const tree = NoticeTalkReview({ request, question, he, controller }); h.effects.splice(0).forEach(effect => effect()); if (!h.dirty) return tree; } throw Error("render did not settle"); };
const selectAndReview = () => { find(render(), "notice-talk-source-answer").props.onClick(); find(render(), "notice-talk-approved").props.onClick(); return render(); };
beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.dirty = false; h.uid = "owner-a"; h.current = true; h.request = request; h.reload.mockReset(); controller.current = null;
  h.source = { state: "ready", title: "Points to ask", version: {}, sources: [
    { childId: "c1", id: "milestones:m1", kind: "answer", label: "Saved answer", source: "Parent response", at: "2026-10-16", text: "Points to ask · Not sure" },
    { childId: "c1", id: "keepsakes:m1", kind: "kept", label: "Kept words", source: "Words saved by the parent", at: "2026-10-15", text: "Pointed at the red cup" },
  ] };
});
afterEach(() => { h.slots.forEach(slot => slot?.cleanup?.()); });

describe("B-GROWTH-44 · Talk selection and final review", () => {
  it("starts with no excerpts and needs individual selection plus explicit review", () => {
    let tree = render(); expect(find(tree, "notice-talk-approved").props.disabled).toBe(true); expect(controller.current!.prepare("What could we try together?")).toBeNull();
    tree = selectAndReview(); expect(find(tree, "notice-talk-approved").props["aria-checked"]).toBe(true);
    const outgoing = controller.current!.prepare("What could we try together?")!;
    expect(outgoing.message).toBe(reviewedPortraitDraft("What could we try together?", "c1", [h.source.sources[0]], false));
    expect(outgoing.message).not.toContain("red cup"); expect(outgoing.isCurrent()).toBe(true);
  });
  it("retires the held outgoing guard on a source change before render and requires a new selection after render", () => {
    selectAndReview(); const old = controller.current!.prepare("What could we try together?")!;
    h.current = false; expect(old.isCurrent()).toBe(false);
    h.source = { ...h.source, version: {}, sources: [{ ...h.source.sources[0], text: "Points to ask · Not yet" }] }; h.current = true;
    const tree = render(); expect(find(tree, "notice-talk-source-answer").props["aria-checked"]).toBe(false); expect(find(tree, "notice-talk-approved").props["aria-checked"]).toBe(false); expect(old.isCurrent()).toBe(false);
  });
  it("withdraws approval when the question, selection, account or request changes", () => {
    selectAndReview(); const old = controller.current!.prepare("What could we try together?")!;
    controller.current!.revoke(); expect(old.isCurrent()).toBe(false);
    find(render(), "notice-talk-approved").props.onClick(); render("A different question"); expect(controller.current!.prepare("What could we try together?")).toBeNull();
    selectAndReview(); h.uid = "owner-b"; expect(find(render(), "notice-talk-approved")).toBeUndefined(); expect(controller.current!.prepare("What could we try together?")).toBeNull();
    h.uid = "owner-a"; h.request = { ...request, requestId: 2 }; expect(controller.current!.prepare("What could we try together?")).toBeNull();
  });
  it("does not append source quotes a second time when an unchanged, reviewed failed turn is retried", () => {
    selectAndReview(); const first = controller.current!.prepare("What could we try together?")!;
    expect(controller.current!.prepare(first.message)!.message).toBe(first.message);
    h.source = { ...h.source, version: {} }; render(); expect(controller.current!.prepare(first.message)).toBeNull();
  });
});
