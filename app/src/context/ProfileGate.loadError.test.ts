import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { translate } from "../lib/i18n";

/** Execute the actual gate with synthetic state, without mounting app services. */
function gateHarness() {
  const text = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("App.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ProfileGate")!;
  const code = ts.transpileModule("export " + fn.getText(ast), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
  } }).outputText;
  let retries = 0;
  const state = { loading: true, loadError: true, needsOnboarding: true, retryProfiles: () => { retries++; } };
  const module = { exports: {} as { ProfileGate: (props: { children: React.ReactNode }) => React.ReactElement } };
  new Function("module", "exports", "React", "useProfile", "useLanguage", "Icon", "OnboardingFlow", "forceOnboardingPreview", code)(
    module, module.exports, React, () => state, () => ({ t: (key: string) => translate("en", key) }),
    () => React.createElement("span", null, "LOADING ICON"), () => React.createElement("div", null, "ONBOARDING"), false,
  );
  return { state, get retries() { return retries; }, render: () => module.exports.ProfileGate({ children: "OWN CONTENT" }) };
}
function findButton(node: React.ReactNode): React.ReactElement<{ onClick: () => void }> | undefined {
  if (!React.isValidElement<{ children?: React.ReactNode; onClick: () => void }>(node)) return;
  if (node.type === "button") return node;
  return React.Children.toArray(node.props.children).map(findButton).find(Boolean);
}
describe("profile load error boundary", () => {
  it("renders an executable retry before loading, onboarding, or private app content", () => {
    const h = gateHarness(), tree = h.render(), html = renderToStaticMarkup(tree);
    expect(html).toContain('role="alert"'); expect(html).not.toContain('role="status"');
    expect(html).not.toContain("ONBOARDING"); expect(html).not.toContain("OWN CONTENT");
    const button = findButton(tree); expect(button).toBeDefined(); button!.props.onClick(); expect(h.retries).toBe(1);
    h.state.loadError = false; h.state.loading = false; h.state.needsOnboarding = false;
    expect(renderToStaticMarkup(h.render())).toBe("OWN CONTENT");
  });
  it("keeps pending loads gated and confirms empty remote profiles before onboarding", () => {
    const h = gateHarness(); h.state.loadError = false;
    expect(renderToStaticMarkup(h.render())).toContain('role="status"');
    h.state.loading = false; expect(renderToStaticMarkup(h.render())).toContain("ONBOARDING");
  });
  it("has English and Hebrew profile-error copy", () => {
    expect(translate("en", "err.profiles.load")).toContain("profiles");
    expect(translate("he", "err.profiles.load")).toMatch(/[א-ת]/);
  });
});
