import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { PRACTICES } from "../../content/practices";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { translate } from "../../lib/i18n";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { shelfLabel } from "../../lib/shelves/registry";
import { routeHash } from "../../lib/routes";
import { SELF_COUNT_CHOICES, SELF_COUNT_MAX, TONIGHT_STEPS } from "../../lib/loop/tonight";
import { practiceText } from "./PracticeCard";
import type { TonightFlowProps } from "./TonightFlow";

const source = ts.createSourceFile("TonightFlow.tsx", readFileSync("src/components/loop/TonightFlow.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const body = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "TonightFlowBody")!.getText(source);
const code = ts.transpileModule(`${body}; return TonightFlowBody;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
function nodes(node: React.ReactNode): React.ReactElement<any>[] {
  if (!React.isValidElement(node)) return [];
  const element = node as React.ReactElement<any>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}
function setup(overrides: Partial<TonightFlowProps> = {}, lang: "en" | "he" = "en") {
  let cursor = 0, disposed = false;
  const slots: any[] = [], effects: (() => void)[] = [];
  const props: TonightFlowProps = {
    scopeKey: "owner:child-a", childName: "Noa", gender: "girl", practice: null,
    onPracticeAnswer: vi.fn(), onOutcome: vi.fn(), onWhatHappened: vi.fn(async () => true), onQuote: vi.fn(async () => {}),
    onNotice: vi.fn(async () => {}), notice: null, dayQuestion: { key: "elev.loop.tonight.day.generic", vars: {} },
    ...overrides,
  };
  const env = {
    React, TONIGHT_STEPS, SELF_COUNT_CHOICES, SELF_COUNT_MAX, resolveHebrewSlash, shelfLabel, routeHash, practiceText,
    pillBase: "button", Icon: "icon", FreeText: "free-text", ShelfGlyph: "shelf-glyph", Receipt: "receipt", NoticeCard: "notice-card",
    useLanguage: () => ({ uiLang: lang, t: (key: string, vars?: any) => translate(lang, key, vars) }),
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (value: any) => {
        if (disposed) throw Error("setState after unmount");
        slots[index].value = typeof value === "function" ? value(slots[index].value) : value;
      }];
    },
    useRef: (initial: any) => slots[cursor++] ??= { current: initial },
    useEffect: (run: () => any, deps: unknown[]) => {
      const index = cursor++, old = slots[index];
      if (old && deps.every((value, n) => Object.is(value, old.deps[n]))) return;
      const slot = { deps, cleanup: undefined as any }; slots[index] = slot;
      effects.push(() => { old?.cleanup?.(); slot.cleanup = run(); });
    },
  };
  const component = new Function(...Object.keys(env), code)(...Object.values(env));
  let tree: React.ReactNode;
  const render = () => { cursor = 0; tree = component(props); effects.splice(0).forEach(run => run()); return nodes(tree); };
  const byId = (id: string) => nodes(tree).find(element => element.props["data-testid"] === id)?.props;
  const byType = (type: string) => nodes(tree).find(element => element.type === type)?.props;
  const unmount = () => { slots.forEach(slot => slot?.cleanup?.()); disposed = true; };
  return { props, render, byId, byType, unmount };
}
const deferred = () => {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }

describe("Tonight keeps the shared object's persistence promise intact", () => {
  it.each(["en", "he"] as const)("%s does not show Kept before acknowledgement and retains failed words for retry", async lang => {
    const write = deferred(), onQuote = vi.fn().mockReturnValueOnce(write.promise).mockResolvedValue(undefined);
    const h = setup({ onQuote }, lang);
    h.render(); h.byId("tonight-quote").onChange({ target: { value: "She said blue bus." } }); h.render();
    const submit = h.byId("tonight-quote-form").onSubmit;
    submit({ preventDefault() {} }); submit({ preventDefault() {} }); h.render();
    expect(onQuote).toHaveBeenCalledOnce(); expect(h.byId("tonight-quote").disabled).toBe(true);
    expect(h.byId("tonight-skip").disabled).toBe(true); expect(h.byType("receipt")).toBeUndefined();
    write.reject(Error("unconfirmed")); await flush();
    expect(h.render().filter(element => element.props.role === "alert")).toHaveLength(1);
    expect(h.byId("tonight-quote").value).toBe("She said blue bus.");
    h.byId("tonight-quote-form").onSubmit({ preventDefault() {} }); await flush(); h.render();
    expect(onQuote).toHaveBeenCalledTimes(2); expect(h.byType("receipt").testId).toBe("tonight-kept");
    h.unmount();
  });
  it("keeps the practice's moment step and text when the existing seam reports failure", async () => {
    const practice = PRACTICES[0];
    const onWhatHappened = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const h = setup({ practice: { practice, shelf: practice.shelf, milestone: ALL_MILESTONES[0], via: "chooser" }, doseAnswer: "did", onWhatHappened });
    h.render(); h.byId("tonight-what").onChange({ target: { value: "We tried it on the bus." } }); h.render();
    h.byId("tonight-how").onSubmit({ preventDefault() {} }); await flush(); h.render();
    expect(h.byId("tonight-step-1")).toBeDefined(); expect(h.byId("tonight-what").value).toBe("We tried it on the bus.");
    expect(h.render().filter(element => element.props.role === "alert")).toHaveLength(0); // existing seam owns its toast
    h.byId("tonight-how").onSubmit({ preventDefault() {} }); await flush(); h.render();
    expect(h.byId("tonight-step-2")).toBeDefined(); h.unmount();
  });
  it("retires pending receipt updates when the flow's account/child lifetime unmounts", async () => {
    const write = deferred(); const h = setup({ onQuote: () => write.promise });
    h.render(); h.byId("tonight-quote").onChange({ target: { value: "A private line" } }); h.render();
    h.byId("tonight-quote-form").onSubmit({ preventDefault() {} }); h.unmount();
    write.resolve(); await flush(); h.render();
    expect(h.byType("receipt")).toBeUndefined();
    const wrapper = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "TonightFlow")!.getText(source);
    expect(wrapper).toContain('key={props.scopeKey ?? "tonight"}');
  });
  it("forwards persisted response/date/kept evidence and Promise-valued actions to the exact Notice object", () => {
    const write = deferred(); const onNotice = vi.fn(() => write.promise);
    const h = setup({ initialStep: 3, onNotice, notice: { milestone: ALL_MILESTONES[0], shelf: "words" }, noticeActions: {
      scopeKey: "owner:child-a", selected: "not_sure", observedWhen: null, observedAt: null, savedWords: "Separate parent words", savedAt: "2026-09-01T12:00:00Z", confirmed: true,
      onAnswer: onNotice, onWhen: vi.fn(async () => {}), onKeepQuote: vi.fn(async () => {}), onOpen: vi.fn(), onDetails: vi.fn(),
    } });
    h.render(); const notice = h.byType("notice-card");
    expect(notice).toMatchObject({ scopeKey: "owner:child-a", selected: "not_sure", observedAt: null, savedWords: "Separate parent words", confirmed: true });
    expect(notice.onAnswer("yes")).toBe(write.promise);
    expect(notice.onOpen).toBe(h.props.noticeActions!.onOpen); write.resolve(); h.unmount();
  });
});

describe("B-PROG-03 — the parent proxy tap writes at once, through its own seam", () => {
  const practice = PRACTICES.find(p => p.shelf === "words")!;
  const pick = { practice, milestone: ALL_MILESTONES.find(m => m.id === practice.milestoneId)!, shelf: "words" as const, via: "program" as const, programId: "talk-together" };
  it("turns: a tap calls onCount with the number (5+ = 5) and readies Save & next", () => {
    const onCount = vi.fn();
    const h = setup({ practice: pick, doseAnswer: "did", initialStep: 1, parentProxy: { kind: "turns", value: null, onCount } });
    h.render();
    expect(h.byId("tonight-save-next")["data-ready"]).toBe("false");
    const tree = h.render();
    const choices = tree.filter(e => e.props["data-testid"] === "tonight-proxy-choice");
    expect(choices.map(c => c.props["data-value"])).toEqual(["0", "1", "2", "3", "4", "5"]);
    choices[5].props.onClick();
    expect(onCount).toHaveBeenCalledWith(5);
    const after = h.render();
    expect(after.find(e => e.props["data-testid"] === "tonight-save-next")!.props["data-ready"]).toBe("true");
    expect(after.filter(e => e.props["data-testid"] === "tonight-proxy-choice" && e.props["aria-pressed"]).map(e => e.props["data-value"])).toEqual(["5"]);
    h.unmount();
  });
  it("routine: a tap calls onRoutine with the answer", () => {
    const onRoutine = vi.fn();
    const h = setup({ practice: { ...pick, programId: "steady-nights" }, doseAnswer: "did", initialStep: 1, parentProxy: { kind: "routine", value: null, onRoutine } }, "he");
    const choices = h.render().filter(e => e.props["data-testid"] === "tonight-proxy-choice");
    expect(choices.map(c => c.props["data-value"])).toEqual(["done_in_order", "not_tonight"]);
    choices[0].props.onClick();
    expect(onRoutine).toHaveBeenCalledWith("done_in_order");
    h.unmount();
  });
});
