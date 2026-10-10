import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { selectNowLead } from "../../lib/today/dayCard";
const source = ts.createSourceFile("NowView.tsx", readFileSync("src/components/companion/NowView.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let lead = "", open = "", currentError = "";
const walk = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    if (node.name.text === "lead") lead = node.initializer!.getText(source);
    if (node.name.text === "currentSaveError") currentError = node.initializer!.getText(source);
  }
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "NowTonightPointer") {
    const attr = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === "onOpen") as ts.JsxAttribute;
    open = (attr.initializer as ts.JsxExpression).expression!.getText(source);
  }
  ts.forEachChild(node, walk);
}; walk(source);
const execute = (code: string, env: Record<string, unknown>) => new Function(...Object.keys(env), ts.transpileModule(`return (${code});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(env));
function environment(initial: "step" | "visit" = "step") {
  return { selectNowLead, chosen: initial === "step", saving: false, saveError: false,
    retryAction: null as { scope: object } | null, scopeLease: { key: "child:topic-a" }, tonightOpen: false,
    visit: initial === "visit" ? { id: "visit" } : null,
    record: { opener: null as { id: string } | null, receipt: null, saving: false, error: false },
    loop: { plan: { order: ["practice"] }, pick: {}, setTonightEarly: vi.fn() }, program: null };
}
// Evaluate the real scope guard as well as the lead. A fixture-provided boolean
// would miss an old failed answer trapping navigation after the choice changes.
const visibleLead = (env: ReturnType<typeof environment>, error = currentError) =>
  execute(lead, { ...env, currentSaveError: execute(error, env) });

describe("the visible Tonight pointer is functioning navigation", () => {
  it("reads the actual lead, scope guard and pointer handler", () => {
    expect(lead).toContain("selectNowLead(");
    expect(lead).toContain("chosenPending: saving || currentSaveError");
    expect(currentError).toBe("saveError && retryAction?.scope === scopeLease");
    expect(open).toContain("loop.setTonightEarly(true)");
    expect(open).toContain("setTonightOpen(true)");
  });
  for (const initial of ["step", "visit"] as const) it(`opens Tonight after clicking from ${initial}, then preserves pending answer ownership`, () => {
    const env = environment(initial);
    expect(visibleLead(env)).toBe(initial);
    execute(open, { loop: env.loop, setTonightOpen: (value: boolean) => { env.tonightOpen = value; } })();
    expect(env.loop.setTonightEarly).toHaveBeenCalledWith(true); expect(visibleLead(env)).toBe("tonight");
    env.saving = true; env.chosen = true; expect(visibleLead(env)).toBe("step");
    env.saving = false; env.saveError = true; env.retryAction = { scope: env.scopeLease };
    expect(visibleLead(env)).toBe("step");
    env.saveError = false; expect(visibleLead(env)).toBe("tonight");
  });
  it("does not let a retired retry trap Tonight, including a topic A→B→A return", () => {
    const env = environment(); env.tonightOpen = true; env.saveError = true;
    env.retryAction = { scope: env.scopeLease }; expect(visibleLead(env)).toBe("step");
    env.scopeLease = { key: "child:topic-b" }; expect(visibleLead(env)).toBe("tonight");
    env.scopeLease = { key: "child:topic-a" }; expect(visibleLead(env)).toBe("tonight");
    env.retryAction = null; expect(visibleLead(env)).toBe("tonight");
  });
  it("NEGATIVE CONTROL: an unscoped error would steal navigation from the current lease", () => {
    const env = environment(); env.tonightOpen = true; env.saveError = true;
    env.retryAction = { scope: { key: env.scopeLease.key } };
    expect(visibleLead(env)).toBe("tonight");
    expect(visibleLead(env, "saveError")).toBe("step");
  });
  it.each(["saving", "error"] as const)("preserves a record answer's %s ownership after opening Tonight", pending => {
    const env = environment("visit"); env.tonightOpen = true;
    env.record.opener = { id: "record" }; env.record[pending] = true;
    expect(visibleLead(env)).toBe("record");
  });
});
