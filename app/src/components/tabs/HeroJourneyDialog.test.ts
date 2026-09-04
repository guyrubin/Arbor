import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const source = readFileSync(path.join(__dirname, "HeroJourneyTab.tsx"), "utf8");

/** Extract production hook statements and the actual trigger/X JSX attributes.
 * The rest of Hero (AI, persistence, scene rendering) is outside this focus
 * transition. No second implementation of the close/restoration logic lives
 * here. DOM removal/ref attachment precede layout effects, as in a React commit.
 * These structural DOM/hook tests complement the parent's mounted browser gate.
 */
function focusSlice(input: string) {
  const file = ts.createSourceFile("HeroJourneyTab.tsx", input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = file.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "HeroJourneyTab");
  if (!component?.body) throw new Error("HeroJourneyTab body missing");
  const names = new Set(["immersive", "immersiveTriggerRef", "wasImmersive"]);
  const statements = component.body.statements.filter(node => {
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.some(declaration => {
      // `.elements` is NodeArray<BindingElement> | NodeArray<ArrayBindingElement>;
      // filtering a union of arrays drops the type predicate, so widen to Node[]
      // first and let isBindingElement do the narrowing (array patterns can hold
      // OmittedExpression holes, which have no `name`).
      const elements: readonly ts.Node[] = ts.isIdentifier(declaration.name) ? [] : declaration.name.elements;
      const bindings = ts.isIdentifier(declaration.name) ? [declaration.name.text] : elements
        .filter(ts.isBindingElement).map(element => element.name.getText(file));
      return bindings.some(name => names.has(name)) || (declaration.initializer && ts.isCallExpression(declaration.initializer)
        && declaration.initializer.expression.getText(file) === "useDialog");
    });
    return ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
      && node.expression.expression.getText(file) === "useLayoutEffect";
  });
  const all: ts.Node[] = [];
  const visit = (node: ts.Node) => { all.push(node); ts.forEachChild(node, visit); };
  visit(component.body);
  const attr = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) =>
    node.attributes.properties.find((value): value is ts.JsxAttribute => ts.isJsxAttribute(value) && value.name.getText(file) === name)?.initializer;
  const buttons = all.filter((node): node is ts.JsxElement => ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "button");
  // Locate by the existing fullscreen icon, so deleting its ref still reaches
  // the behavior test and fails restoration instead of silently skipping it.
  const trigger = buttons.filter(button => {
    let fullscreen = false;
    const find = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === "Icon") {
        const name = attr(node, "name");
        if (name && ts.isStringLiteral(name) && name.text === "fullscreen") fullscreen = true;
      }
      ts.forEachChild(node, find);
    };
    find(button); return fullscreen;
  });
  const close = buttons.filter(button => {
    const label = attr(button.openingElement, "aria-label");
    return label && ts.isJsxExpression(label) && label.expression && ts.isCallExpression(label.expression)
      && label.expression.arguments.some(arg => ts.isStringLiteral(arg) && arg.text === "aria.exitImmersive");
  });
  if (trigger.length !== 1 || close.length !== 1) throw new Error("Expected the actual immersive trigger and X");
  const opening = (button: ts.JsxElement) => button.openingElement.getText(file).replace(/>$/, " />");
  const body = statements.map(node => node.getText(file)).join("\n");
  return {
    statements,
    file,
    code: ts.transpileModule(`function FocusSlice(kidNav) {
      const activeStory = {}, render = {};
      ${body}
      return { immersive, trigger: ${opening(trigger[0])}, close: immersive ? ${opening(close[0])} : null };
    }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText,
  };
}

type View = { props: Record<string, any> };
type FocusView = { immersive: boolean; trigger: View; close: View | null };
class FocusNode {
  parent: FocusNode | null = null;
  constructor(readonly document: FocusDocument, readonly name: string) {}
  get isConnected(): boolean { return this === this.document.body || !!this.parent?.isConnected; }
  focus = vi.fn((_options?: FocusOptions) => { if (this.isConnected) this.document.activeElement = this; });
  remove() {
    if (this.document.activeElement === this) this.document.activeElement = this.document.body;
    this.parent = null;
  }
}
class FocusDocument {
  body = new FocusNode(this, "body");
  activeElement: FocusNode = this.body;
  kidRoot = this.append("kid-root", this.body);
  append(name: string, parent = this.kidRoot) {
    const node = new FocusNode(this, name); node.parent = parent; return node;
  }
}
function fixture(input = source, parentMode = false) {
  const document = new FocusDocument();
  const trigger = document.append("immersive-trigger"), close = new FocusNode(document, "immersive-X");
  const sibling = document.append("other-kid-control");
  const slots: any[] = [];
  let index = 0, jobs: (() => void)[] = [];
  let view: FocusView, attachedRef: { current: FocusNode | null } | undefined;
  let options: { open: boolean; onClose: () => void };
  const useRef = (initial: unknown) => { const slot = index++; return slots[slot] ??= { current: initial }; };
  const useState = (initial: unknown) => {
    const slot = index++;
    if (!(slot in slots)) slots[slot] = initial;
    return [slots[slot], (next: unknown) => { slots[slot] = next; }];
  };
  const useLayoutEffect = (setup: () => (() => void) | void, deps: unknown[]) => {
    const slot = index++, previous = slots[slot];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      const state = { deps, cleanup: undefined as void | (() => void) };
      slots[slot] = state;
      jobs.push(() => { previous?.cleanup?.(); state.cleanup = setup(); });
    }
  };
  const requestClose = vi.fn(() => options.onClose());
  const useDialog = (next: typeof options) => { options = next; return { ref: { current: null }, requestClose }; };
  const React = { createElement: (_type: unknown, props: Record<string, any>) => ({ props }) };
  const slice = focusSlice(input);
  const render = new Function("useRef", "useState", "useLayoutEffect", "useDialog", "React", "t", slice.code + "\nreturn FocusSlice;")(
    useRef, useState, useLayoutEffect, useDialog, React, (key: string) => key,
  ) as (kidNav: (() => void) | null) => FocusView;
  const kidNav = parentMode ? () => {} : null;
  const commit = (hasTrigger = true) => {
    index = 0; jobs = [];
    const next = render(kidNav);
    // Removing the focused X reproduces the browser's body fallback. The
    // production layout effect must repair that, after refs have committed.
    if (!next.close) close.remove(); else close.parent = document.kidRoot;
    if (attachedRef && (!hasTrigger || attachedRef !== next.trigger.props.ref)) attachedRef.current = null;
    if (hasTrigger) {
      trigger.parent = document.kidRoot;
      attachedRef = next.trigger.props.ref;
      if (attachedRef) attachedRef.current = trigger;
    } else { trigger.remove(); attachedRef = undefined; }
    view = next;
    jobs.forEach(run => run());
    return view;
  };
  commit();
  const open = () => { trigger.focus(); view.trigger.props.onClick(); commit(); trigger.focus.mockClear(); };
  const dismiss = (hasTrigger = true) => {
    if (!view.close) throw new Error("No immersive X to activate");
    close.focus(); view.close.props.onClick(); commit(hasTrigger);
  };
  return { document, trigger, close, sibling, open, dismiss, commit, requestClose,
    get dialogOpen() { return options.open; },
    get immersive() { return view.immersive; },
    unmount: () => { if (attachedRef) attachedRef.current = null; close.remove(); trigger.remove(); slots.forEach(slot => slot?.cleanup?.()); },
  };
}

describe("Hero Kid Mode immersive close focus", () => {
  it("actual X removes the focused overlay and returns focus to its invoking control before layout effects finish", () => {
    const f = fixture(); f.open();
    expect(f.immersive).toBe(true); expect(f.dialogOpen).toBe(false);
    f.dismiss();
    expect(f.immersive).toBe(false); expect(f.close.isConnected).toBe(false);
    expect(f.document.activeElement).toBe(f.trigger);
    expect(f.trigger.parent).toBe(f.document.kidRoot);
    expect(f.trigger.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(f.requestClose).not.toHaveBeenCalled();
  });
  it("does not steal focus on initial closed render, opening, or unrelated closed rerenders", () => {
    const f = fixture(); expect(f.trigger.focus).not.toHaveBeenCalled();
    f.open(); expect(f.trigger.focus).not.toHaveBeenCalled();
    f.dismiss(); f.trigger.focus.mockClear();
    f.sibling.focus(); f.commit();
    expect(f.document.activeElement).toBe(f.sibling); expect(f.trigger.focus).not.toHaveBeenCalled();
  });
  it("restores the same trigger on each later open/close cycle", () => {
    const f = fixture();
    for (let i = 0; i < 2; i++) {
      f.open(); f.dismiss(); expect(f.document.activeElement).toBe(f.trigger);
      expect(f.trigger.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    }
  });
  it("leaves parent-mode restoration to the shared dialog owner", () => {
    const f = fixture(source, true); f.open(); expect(f.dialogOpen).toBe(true);
    f.dismiss(); expect(f.requestClose).toHaveBeenCalledOnce();
    expect(f.trigger.focus).not.toHaveBeenCalled(); expect(f.dialogOpen).toBe(false);
  });
  it("does not try to restore an unmounted trigger when the player disappears", () => {
    const f = fixture(); f.open(); f.dismiss(false);
    expect(f.trigger.isConnected).toBe(false); expect(f.trigger.focus).not.toHaveBeenCalled();
    const g = fixture(); g.open(); g.unmount(); expect(g.trigger.focus).not.toHaveBeenCalled();
  });
  it("negative control: removing the production layout effect leaves focus on body", () => {
    const slice = focusSlice(source);
    const effect = slice.statements.find(node => ts.isExpressionStatement(node));
    if (!effect) throw new Error("Production restoration effect is missing");
    const mutant = source.slice(0, effect.getStart(slice.file)) + source.slice(effect.end);
    const f = fixture(mutant); f.open(); f.dismiss();
    expect(f.document.activeElement).toBe(f.document.body);
    expect(f.trigger.focus).not.toHaveBeenCalled();
  });
  it("negative control: dropping the actual trigger ref also loses focus to body", () => {
    const mutant = source.replace("ref={immersiveTriggerRef}", "");
    expect(mutant).not.toBe(source);
    const f = fixture(mutant); f.open(); f.dismiss();
    expect(f.document.activeElement).toBe(f.document.body);
    expect(f.trigger.focus).not.toHaveBeenCalled();
  });
});
