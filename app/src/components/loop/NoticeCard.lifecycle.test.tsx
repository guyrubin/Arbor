import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { ALL_MILESTONES, milestoneText } from "../../lib/milestoneData";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { translate } from "../../lib/i18n";
import { SHELF_ART } from "../../lib/parentArt";
import { shelfLabel } from "../../lib/shelves/registry";
import { OBSERVED_WHEN } from "../../lib/milestones/observe";
import { routeHash } from "../../lib/routes";
import { NOTICE_OBJECT_COPY } from "./noticeObjectCopy";
import type { NoticeCardProps } from "./NoticeCard";

// Execute the actual component with the repository's deterministic hook harness.
// Deferred writes exercise UI transitions without depending on a cloud account.
const source = ts.createSourceFile("NoticeCard.tsx", readFileSync("src/components/loop/NoticeCard.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "NoticeContent")!.getText(source).replace(/^export /, "");
const code = ts.transpileModule(`${fn}; return NoticeContent;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
function nodes(node: React.ReactNode): React.ReactElement<any>[] {
  if (!React.isValidElement(node)) return [];
  const el = node as React.ReactElement<any>;
  return [el, ...React.Children.toArray(el.props.children).flatMap(nodes)];
}
function setup(lang: "en" | "he" = "en", overrides: Partial<NoticeCardProps> = {}) {
  let at = 0;
  const slots: any[] = [], effects: (() => void)[] = [];
  const props: NoticeCardProps = { milestone: { ...ALL_MILESTONES[0], observedAt: "2026-10-18T10:00:00Z" }, shelf: "words", scopeKey: "parent:child-a", answers: "segmented", onAnswer: vi.fn(async () => {}), onKeepQuote: vi.fn(async () => {}), onWhen: vi.fn(async () => {}), onUndo: vi.fn(async () => {}), ...overrides };
  const env = {
    React, NOTICE_OBJECT_COPY, SHELF_ART, milestoneText, milestoneAgeLine, shelfLabel, OBSERVED_WHEN, routeHash,
    NOTICE_ANSWER_KEYS: { yes: "elev.loop.notice.seen", not_yet: "ms.observe.notYet", not_sure: "ms.observe.notSure" },
    useState: (initial: any) => { const index = at++; if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial }; return [slots[index].value, (value: any) => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }]; },
    useRef: (value: any) => slots[at++] ??= { current: value },
    useEffect: (run: () => any, deps: unknown[]) => { const index = at++, old = slots[index]; if (old && deps.every((value, n) => Object.is(value, old.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; slots[index] = slot; effects.push(() => { old?.cleanup?.(); slot.cleanup = run(); }); },
    useLanguage: () => ({ uiLang: lang, t: (key: string, vars?: any) => translate(lang, key, vars) }),
    PendingLine: "pending-line", ShelfGlyph: "shelf-glyph", Icon: "icon", Receipt: "receipt", SegmentedAnswers: "answers", NoticeAnswers: "answers", FreeText: "free-text",
  };
  const renderContent = new Function(...Object.keys(env), code)(...Object.values(env));
  let tree: React.ReactNode;
  const render = () => { at = 0; tree = renderContent(props); effects.splice(0).forEach(run => run()); return nodes(tree); };
  const find = (type: string) => nodes(tree).find(el => el.type === type)?.props;
  const testId = (id: string) => nodes(tree).find(el => (el.props["data-testid"] ?? el.props.testId) === id)?.props;
  const unmount = () => slots.forEach(slot => slot?.cleanup?.());
  return { props, render, find, testId, unmount };
}
const deferred = () => {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }

describe("the actual observation object lifecycle", () => {
  it.each(["en", "he"] as const)("%s awaits the answer once and keeps the question on failure", async lang => {
    const write = deferred();
    const save = vi.fn().mockReturnValueOnce(write.promise).mockResolvedValue(undefined);
    const h = setup(lang, { onAnswer: save });
    h.render(); const answer = h.find("answers").onAnswer;
    answer("not_sure"); answer("yes"); h.render();
    expect(save).toHaveBeenCalledExactlyOnceWith("not_sure");
    expect(h.find("answers").disabled).toBe(true);
    expect(h.find("receipt")).toBeUndefined();
    write.reject(new Error("offline")); await flush(); h.render();
    expect(h.testId("notice-card")["data-phase"]).toBe("ask");
    expect(h.testId("notice-write-error").children).toBe(NOTICE_OBJECT_COPY[lang].errors.answer);
    h.find("answers").onAnswer("not_sure"); await flush(); h.render();
    expect(h.testId("notice-card")["data-phase"]).toBe("thanked");
    expect(h.testId("notice-stored-answer")).toBeDefined();
    expect(h.find("receipt")).toBeDefined();
    h.unmount();
  });
  it.each(["en", "he"] as const)("%s retains failed words and retries only that note", async lang => {
    const write = deferred(); const note = vi.fn().mockReturnValueOnce(write.promise).mockResolvedValue(undefined);
    const h = setup(lang, { selected: "yes", onKeepQuote: note });
    h.render(); h.find("input").onChange({ target: { value: "He said bus, then waved." } }); h.render();
    const submit = h.find("form").onSubmit;
    submit({ preventDefault() {} }); submit({ preventDefault() {} }); h.render();
    expect(note).toHaveBeenCalledOnce(); expect(h.find("input").disabled).toBe(true);
    write.reject(new Error("permission")); await flush(); h.render();
    expect(h.find("input").value).toBe("He said bus, then waved.");
    expect(h.testId("notice-write-error").children).toBe(NOTICE_OBJECT_COPY[lang].errors.note);
    expect(h.testId("notice-kept")).toBeUndefined();
    h.find("form").onSubmit({ preventDefault() {} }); await flush(); h.render();
    expect(note).toHaveBeenCalledTimes(2); expect(h.props.onAnswer).not.toHaveBeenCalled();
    expect(h.find("free-text").text).toContain("He said bus, then waved.");
    expect(h.testId("notice-write-error")).toBeUndefined(); h.unmount();
  });
  it("keeps an owned note retry visible when its old evidence loses confirmation", async () => {
    const write = deferred(); const h = setup("en", { selected: "not_sure", savedWords: "Earlier words", onKeepQuote: () => write.promise });
    h.render(); h.find("input").onChange({ target: { value: "Edited words stay here" } }); h.render();
    h.find("form").onSubmit({ preventDefault() {} });
    h.props.savedWords = null; h.render(); h.render();
    expect(h.find("input").value).toBe("Edited words stay here");
    expect(h.testId("notice-kept")).toBeUndefined();
    write.reject(new Error("ack timeout")); await flush(); h.render();
    expect(h.find("input").value).toBe("Edited words stay here");
    expect(h.find("form")).toBeDefined(); h.unmount();
  });
  it("only the new answer announces when older kept evidence is also visible", async () => {
    const h = setup("en", { savedWords: "Earlier words", savedAt: "2026-06-03T09:00:00Z" });
    h.render(); h.find("answers").onAnswer("yes"); await flush();
    const tree = h.render(); const receipts = tree.filter(el => el.type === "receipt");
    expect(receipts.find(el => el.props.testId === "notice-receipt")?.props.announce).toBe(true);
    expect(receipts.find(el => el.props.testId === "notice-kept-status")?.props.announce).toBe(false);
    h.props.savedAt = "2026-10-12T09:00:00Z"; h.render();
    expect(React.Children.toArray(h.testId("notice-kept-status").children).join("")).toContain("12 Oct 2026");
    h.unmount();
  });
  it("a late acknowledgement cannot update an unmounted child's object", async () => {
    const write = deferred(); const h = setup("en", { onAnswer: () => write.promise });
    h.render(); h.find("answers").onAnswer("yes"); h.render(); h.unmount();
    write.resolve(); await flush(); h.render();
    expect(h.testId("notice-card")["data-phase"]).toBe("ask");
    expect(h.find("receipt")).toBeUndefined();
    // The public wrapper remounts on account/child AND catalogue item.
    const wrapper = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "NoticeCard")!.getText(source);
    expect(wrapper).toContain('props.scopeKey ?? "legacy"'); expect(wrapper).toContain("props.milestone.id");
  });
  it("reopens a neutral answer and withdraws a removed source's words", () => {
    const h = setup("en", { selected: "not_yet", savedWords: "A separate kept moment", savedAt: "2026-06-03T09:00:00Z" });
    h.render(); expect(h.testId("notice-card")["data-phase"]).toBe("thanked");
    expect(h.find("free-text").text).toContain("A separate kept moment");
    h.props.savedWords = null; h.render(); h.render(); expect(h.testId("notice-kept")).toBeUndefined(); h.unmount();
  });
  it("an unconfirmed optimistic record never announces Saved or a receipt", () => {
    const h = setup("en", { selected: "yes", savedWords: "Cached words", confirmed: false });
    const tree = h.render();
    expect(tree.some(el => el.type === "receipt")).toBe(false);
    expect(h.testId("notice-write-status").children).toBe(NOTICE_OBJECT_COPY.en.unconfirmed);
    h.unmount();
  });
  it("requires the dated editor before an approximate answer becomes a kept event", () => {
    const h = setup("en", { selected: "yes", observedWhen: "earlier" }); h.render();
    expect(h.find("input")).toBeUndefined(); expect(h.find("form")).toBeUndefined(); h.unmount();
  });
  it("Undo restores the same previously saved answer after a same-answer change", async () => {
    const h = setup("en", { selected: "not_sure", onUndo: async () => ({ selected: "not_sure", observedWhen: null }) });
    h.render(); h.testId("notice-change").onClick(); h.render();
    h.find("answers").onAnswer("not_sure"); await flush(); h.render();
    h.find("receipt").undo.onUndo(); await flush(); h.render();
    expect(h.testId("notice-card")["data-phase"]).toBe("thanked");
    expect(h.testId("notice-stored-answer")).toBeDefined(); h.unmount();
  });
  it.each(["not_yet", "not_sure"] as const)("%s uses the explicit dated evidence editor", selected => {
    const h = setup("en", { selected }); h.render();
    expect(h.find("input")).toBeUndefined(); expect(h.find("form")).toBeUndefined(); h.unmount();
  });
  it("Undo waits for acknowledgement and leaves independently kept words", async () => {
    const write = deferred(); const h = setup("en", { selected: "yes", savedWords: "Still part of the story", onUndo: async () => { await write.promise; return { selected: null, observedWhen: null }; } });
    h.render(); h.find("receipt").undo.onUndo(); h.render();
    expect(h.testId("notice-card")["data-phase"]).toBe("seen");
    write.resolve(); await flush(); h.render();
    expect(h.testId("notice-card")["data-phase"]).toBe("ask");
    expect(h.find("free-text").text).toContain("Still part of the story"); h.unmount();
  });
});
