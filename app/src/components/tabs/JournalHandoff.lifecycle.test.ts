import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { hashQuery, routeHash } from "../../lib/routes";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const parse = (file: string) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const ctx = parse("context/ArborContext.tsx");
const journal = parse("components/tabs/JournalTab.tsx");
function find(source: ts.SourceFile, predicate: (node: ts.Node) => boolean) {
  const matches: ts.Node[] = [];
  const visit = (node: ts.Node) => { if (predicate(node)) matches.push(node); ts.forEachChild(node, visit); };
  visit(source);
  expect(matches.length).toBe(1);
  return matches[0].getText(source);
}
function compile(code: string, env: Record<string, unknown>) {
  const output = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} as any };
  new Function("module", "exports", ...Object.keys(env), output)(module, module.exports, ...Object.values(env));
  return module.exports;
}
const declaration = (name: string) => find(ctx, (node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name));
const rootFunction = find(journal, (node) => ts.isFunctionDeclaration(node) && node.name?.text === "JournalTab");
const filterEffect = find(journal, (node) => ts.isCallExpression(node) && node.expression.getText(journal) === "useEffect" && node.arguments[0]?.getText(journal).includes("setJournalQuery"));

afterEach(() => vi.unstubAllGlobals());

describe("B-ASKJB-23 Journal handoff: actual production callbacks", () => {
  it("the latest filter and row-focus requests replace one another, then consume once", () => {
    let filter: string | null = null, focus: string | null = "moment-older";
    const api = compile(`${["requestJournalFilter", "requestJournalFocus", "consumeJournalFilter"].map(declaration).join("\n")}\nexports.api = { requestJournalFilter, requestJournalFocus, consumeJournalFilter };`, {
      setPendingJournalFilter: (value: string | null) => { filter = value; },
      setPendingJournalFocusId: (value: string | null) => { focus = value; },
    }).api;
    api.requestJournalFilter("hard");
    expect([filter, focus]).toEqual(["hard", null]);
    api.requestJournalFocus("moment-new");
    expect([filter, focus]).toEqual([null, "moment-new"]);
    api.requestJournalFilter("hard"); api.consumeJournalFilter();
    expect([filter, focus]).toEqual([null, null]);
  });

  it("opens the feed immediately and replaces the shelves URL, preserving the child remount key", () => {
    const effects: (() => void)[] = [];
    const replaceState = vi.fn();
    vi.stubGlobal("window", { location: { hash: "#/journal?shelf=words" }, history: { replaceState }, dispatchEvent: vi.fn() });
    vi.stubGlobal("HashChangeEvent", class { constructor(public type: string) {} });
    const api = compile(rootFunction, {
      React: { createElement: (type: unknown, props: unknown) => ({ type, props }) },
      useEffect: (fn: () => void) => effects.push(fn),
      useArbor: () => ({ pendingJournalFilter: "hard", pendingJournalFocusId: null, childProfile: { id: "child-a" } }),
      useHashQuery: () => new URLSearchParams("shelf=words"),
      shelfFromQuery: (value: string) => value,
      JournalFeed: "feed", JournalShelves: "shelves", hashQuery, routeHash,
    });
    const tree = api.default({});
    expect(tree).toMatchObject({ type: "feed", props: { key: "child-a" } });
    effects.forEach((fn) => fn());
    expect(replaceState).toHaveBeenCalledWith(null, "", "#/journal?view=all");
  });

  for (const request of [{ filter: "hard", focus: null }, { filter: null, focus: "moment-new" }]) {
    it(`clears stale search, facets and open record for a newer ${request.filter ? "filter" : "focus"} request`, () => {
      const setters = Object.fromEntries(["JournalFilter", "JournalQuery", "TypeFilter", "IntensityFilter", "ResolvedFilter", "OpenSignal"].map((key) => [`set${key}`, vi.fn()]));
      const consume = vi.fn();
      compile(filterEffect, { ...setters, pendingJournalFilter: request.filter, pendingJournalFocusId: request.focus, consumeJournalFilter: consume, useEffect: (fn: () => void) => fn() });
      expect(setters.setJournalFilter).toHaveBeenCalledWith(request.filter ?? "all");
      expect(setters.setJournalQuery).toHaveBeenCalledWith("");
      for (const key of ["TypeFilter", "IntensityFilter", "ResolvedFilter"]) expect(setters[`set${key}`]).toHaveBeenCalledWith("all");
      expect(setters.setOpenSignal).toHaveBeenCalledWith(null);
      expect(consume).toHaveBeenCalledTimes(request.filter ? 1 : 0);
    });
  }

  it("leaves a parent's in-session filters alone without a new handoff", () => {
    const setter = vi.fn();
    compile(filterEffect, { pendingJournalFilter: null, pendingJournalFocusId: null, useEffect: (fn: () => void) => fn(), setJournalFilter: setter });
    expect(setter).not.toHaveBeenCalled();
  });
});
