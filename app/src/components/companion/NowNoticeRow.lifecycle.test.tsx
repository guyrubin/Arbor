import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { ALL_MILESTONES, milestoneText } from "../../lib/milestoneData";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { translate } from "../../lib/i18n";
import { shelfDef, shelfLabel } from "../../lib/shelves/registry";
import { OBSERVED_WHEN } from "../../lib/milestones/observe";
import { NOTICE_OBJECT_COPY } from "../loop/noticeObjectCopy";
import type { NowNoticeRowProps } from "./NowNoticeRow";

// v4 (Arbor v4 · NOTICE TODAY): the compact Notice row executes with the same
// deterministic hook harness as the full Notice object (NoticeCard.lifecycle):
// writes advance only on confirmation, failures keep the question or the draft,
// undo restores, and the stamp rides the answer group.
const SRC = readFileSync("src/components/companion/NowNoticeRow.tsx", "utf8");
const source = ts.createSourceFile("NowNoticeRow.tsx", SRC, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "NowNoticeRowContent")!.getText(source);
const code = ts.transpileModule(`${fn}; return NowNoticeRowContent;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
function nodes(node: React.ReactNode): React.ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [];
  const el = node as React.ReactElement<any>;
  return [el, ...React.Children.toArray(el.props.children).flatMap(nodes)];
}
function setup(lang: "en" | "he" = "en", overrides: Partial<NowNoticeRowProps> = {}) {
  let at = 0;
  const slots: any[] = [], effects: (() => void)[] = [];
  const props: NowNoticeRowProps = {
    milestone: { ...ALL_MILESTONES[0], observedAt: new Date().toISOString() }, shelf: "words", scopeKey: "parent:child-a", index: 0, childName: "Mia",
    onAnswer: vi.fn(async () => {}), onKeepQuote: vi.fn(async () => {}), onWhen: vi.fn(async () => {}), onUndo: vi.fn(async () => {}),
    onKeepPhoto: vi.fn(), onDetails: vi.fn(), ...overrides,
  };
  const env = {
    React, NOTICE_OBJECT_COPY, milestoneText, milestoneAgeLine, shelfDef, shelfLabel, OBSERVED_WHEN,
    NOTICE_ANSWER_KEYS: { yes: "elev.loop.notice.seen", not_yet: "ms.observe.notYet", not_sure: "ms.observe.notSure" },
    NOTICE_ANSWER_ORDER: ["yes", "not_yet", "not_sure"],
    NOTICE_ROW_ANSWER_ICON: { yes: { icon: "check", ink: "g" }, not_yet: { icon: "schedule", ink: "a" }, not_sure: { icon: "help", ink: "m" } },
    DOMAIN_CHIP_TONE: { talking: "sapphire" }, brandChipShape: () => "arch",
    useId: () => "r1",
    useState: (initial: any) => { const index = at++; if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial }; return [slots[index].value, (value: any) => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }]; },
    useRef: (value: any) => slots[at++] ??= { current: value },
    useEffect: (run: () => any, deps: unknown[]) => { const index = at++, old = slots[index]; if (old && deps.every((value, n) => Object.is(value, old.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; slots[index] = slot; effects.push(() => { old?.cleanup?.(); slot.cleanup = run(); }); },
    useLanguage: () => ({ uiLang: lang, t: (key: string, vars?: any) => translate(lang, key, vars) }),
    PendingLine: "pending-line", Icon: "icon", BrandChip: "brand-chip", FreeText: "free-text",
  };
  const renderContent = new Function(...Object.keys(env), code)(...Object.values(env));
  let tree: React.ReactNode;
  const render = () => { at = 0; tree = renderContent(props); effects.splice(0).forEach(run => run()); return nodes(tree); };
  const testId = (id: string) => nodes(tree).find(el => (el.props["data-testid"] ?? el.props.testId) === id)?.props;
  const answer = (status: string) => nodes(tree).find(el => el.props["data-answer"] === status && el.type === "button")?.props;
  const when = (value: string) => nodes(tree).find(el => el.props["data-when"] === value)?.props;
  const find = (type: string) => nodes(tree).find(el => el.type === type)?.props;
  const unmount = () => slots.forEach(slot => slot?.cleanup?.());
  return { props, render, testId, answer, when, find, unmount };
}
const deferred = () => {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }

describe("Notice today's compact row (v4)", () => {
  it.each(["en", "he"] as const)("%s: area chip, title over shelf, three named inline answers carrying the stamp", lang => {
    const h = setup(lang, { answersAttrs: { "data-primary-move": "choose-next-step" } });
    h.render();
    expect(h.find("brand-chip")).toMatchObject({ icon: shelfDef("words").glyph, size: 36 });
    expect(h.testId("notice-shelf").children).toBe(shelfLabel("words", (k: string) => translate(lang, k)));
    const group = h.testId("notice-answers");
    expect(group.role).toBe("group");
    expect(group["data-primary-move"]).toBe("choose-next-step");
    for (const [status, key] of [["yes", "elev.loop.notice.seen"], ["not_yet", "ms.observe.notYet"], ["not_sure", "ms.observe.notSure"]]) {
      expect(h.answer(status)["aria-label"]).toBe(translate(lang, key));
    }
    // What it looks like stays one tap away, folded by default.
    expect(h.testId("notice-info").hidden).toBe(true);
    h.testId("notice-info-toggle").onClick(); h.render();
    expect(h.testId("notice-info").hidden).toBe(false);
    expect(h.testId("notice-info-toggle")["aria-expanded"]).toBe(true);
    h.testId("notice-open").onClick();
    expect(h.props.onDetails).toHaveBeenCalledOnce();
  });

  it.each(["en", "he"] as const)("%s awaits one answer, keeps the answers on failure, then shows the pill with a real undo", async lang => {
    const write = deferred();
    const save = vi.fn().mockReturnValueOnce(write.promise).mockResolvedValue(undefined);
    const h = setup(lang, { onAnswer: save });
    h.render();
    h.answer("not_yet").onClick(); h.answer("yes").onClick(); h.render();
    expect(save).toHaveBeenCalledExactlyOnceWith("not_yet");
    expect(h.answer("yes").disabled).toBe(true);
    write.reject(new Error("offline")); await flush(); h.render();
    expect(h.testId("notice-answers")).toBeDefined();
    expect(h.testId("notice-write-error").children).toBe(NOTICE_OBJECT_COPY[lang].errors.answer);
    h.answer("not_yet").onClick(); await flush(); h.render();
    expect(h.testId("notice-answers")).toBeUndefined();
    expect(h.testId("notice-card")["data-phase"]).toBe("thanked");
    expect(h.testId("notice-thanks").children).toBe(translate(lang, "elev.loop.notice.thanks"));
    const undo = h.testId("notice-undo");
    expect(undo["aria-label"]).toBe(translate(lang, "elev.loop.notice.undo"));
    undo.onClick(); await flush(); h.render();
    expect(h.props.onUndo).toHaveBeenCalledOnce();
    expect(h.testId("notice-answers")).toBeDefined();
    expect(h.testId("notice-row-status").children).toBe(NOTICE_OBJECT_COPY[lang].undone);
    h.unmount();
  });

  it.each(["en", "he"] as const)("%s: Seen it opens When and Keep; the words save once and stay on failure", async lang => {
    const write = deferred();
    const note = vi.fn().mockReturnValueOnce(write.promise).mockResolvedValue(undefined);
    const h = setup(lang, { onKeepQuote: note });
    h.render();
    h.answer("yes").onClick(); await flush(); h.render();
    expect(h.testId("notice-card")["data-phase"]).toBe("seen");
    expect(h.when("today")["aria-pressed"]).toBe(true);
    h.when("this_week").onClick(); await flush(); h.render();
    expect(h.props.onWhen).toHaveBeenCalledExactlyOnceWith("this_week");
    h.when("today").onClick(); await flush(); h.render();
    expect(h.testId("notice-keep-open").children[1]).toBe(translate(lang, "elev.loop.today.notice.keep"));
    h.testId("notice-keep-open").onClick(); h.render();
    expect(h.testId("notice-keep-quote").placeholder).toBe(translate(lang, "elev.loop.today.notice.keepPlaceholder", { name: "Mia" }));
    h.testId("notice-keep-quote").onChange({ target: { value: "Shoes, then door!" } }); h.render();
    const submit = h.testId("notice-keep").onSubmit;
    submit({ preventDefault() {} }); submit({ preventDefault() {} }); h.render();
    expect(note).toHaveBeenCalledOnce();
    write.reject(new Error("permission")); await flush(); h.render();
    expect(h.testId("notice-keep-quote").value).toBe("Shoes, then door!");
    expect(h.testId("notice-write-error").children).toBe(NOTICE_OBJECT_COPY[lang].errors.note);
    h.testId("notice-keep").onSubmit({ preventDefault() {} }); await flush(); h.render();
    expect(h.testId("notice-keep")).toBeUndefined();
    expect(h.testId("notice-kept")).toBeDefined();
    expect(h.testId("notice-card")["data-phase"]).toBe("kept");
    h.unmount();
  });

  it("an undated Seen it sends the words to the observation instead of dating them today", async () => {
    const h = setup("en", { selected: "yes", observedWhen: "earlier", observedAt: null });
    h.render();
    h.testId("notice-keep-open").onClick(); h.render();
    expect(h.props.onKeepPhoto).toHaveBeenCalledOnce();
    expect(h.testId("notice-keep")).toBeUndefined();
  });

  it("an answer from an earlier visit reopens its three answers (the stored one pressed); the next tap writes", async () => {
    const h = setup("he", { selected: "not_sure" });
    h.render();
    const change = h.testId("notice-change");
    expect(change["aria-label"]).toBe(NOTICE_OBJECT_COPY.he.change);
    change.onClick(); h.render();
    expect(h.answer("not_sure")["aria-pressed"]).toBe(true);
    expect(h.answer("yes")["aria-pressed"]).toBe(false);
    h.answer("yes").onClick(); await flush(); h.render();
    expect(h.props.onAnswer).toHaveBeenCalledExactlyOnceWith("yes");
    expect(h.testId("notice-undo")).toBeDefined();
    h.unmount();
  });

  it("stays on the design system: tokens only, 44 px targets, labels named on a phone", () => {
    const css = readFileSync("src/components/companion/nowView.css", "utf8");
    const rows = css.slice(css.indexOf(".now-notice {"), css.indexOf(".now-notice-extras {"));
    expect(rows).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(rows).toMatch(/\.now-notice-head \{[^}]*min-block-size: 44px/);
    expect(rows).toMatch(/\.now-notice-answer \{[^}]*min-inline-size: 44px; min-block-size: 44px/);
    expect(rows).toMatch(/\.now-notice-undo \{[^}]*inline-size: 44px; block-size: 44px/);
    expect(rows).toMatch(/\.now-notice-when::after, \.now-notice-link::after \{[^}]*inset: -6px 0/);
    expect(rows).toMatch(/@container notice \(min-width: 600px\) \{[\s\S]*?\.now-notice-answer-label \{ display: inline; \}/);
    expect(SRC).toContain("aria-label={answerLabel(status)}");
  });
});
