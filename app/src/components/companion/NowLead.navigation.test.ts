import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { selectNowLead } from "../../lib/today/dayCard";
const source = ts.createSourceFile("NowView.tsx", readFileSync("src/components/companion/NowView.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let lead = "", open = "";
const walk = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "lead") lead = node.initializer!.getText(source);
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "NowTonightPointer") {
    const attr = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === "onOpen") as ts.JsxAttribute;
    open = (attr.initializer as ts.JsxExpression).expression!.getText(source);
  }
  ts.forEachChild(node, walk);
}; walk(source);
const execute = (code: string, env: Record<string, unknown>) => new Function(...Object.keys(env), ts.transpileModule(`return (${code});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(env));
describe("the visible Tonight pointer is functioning navigation", () => {
  for (const initial of ["step", "visit"]) it(`opens Tonight after clicking from ${initial}, then preserves pending answer ownership`, () => {
    const env = { selectNowLead, chosen: initial === "step", saving: false, saveError: false, tonightOpen: false, visit: initial === "visit" ? { id: "visit" } : null, record: { opener: null, receipt: null, saving: false, error: false }, loop: { plan: { order: ["practice"] }, pick: {}, setTonightEarly: vi.fn() }, program: null };
    expect(execute(lead, env)).toBe(initial);
    execute(open, { loop: env.loop, setTonightOpen: (value: boolean) => { env.tonightOpen = value; } })();
    expect(env.loop.setTonightEarly).toHaveBeenCalledWith(true); expect(execute(lead, env)).toBe("tonight");
    env.saving = true; env.chosen = true; expect(execute(lead, env)).toBe("step");
  });
});
