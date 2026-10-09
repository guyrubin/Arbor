import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** The invite gate surrounds ProfileGate, so it must pass through errors to
 * the profile Retry UI even when a pending invite would otherwise show loading. */
describe("co-parent invite profile errors", () => {
  it("exposes the inner profile Retry screen for an unreadable family", () => {
    const text = readFileSync(new URL("./CoParentGate.tsx", import.meta.url), "utf8");
    const ast = ts.createSourceFile("CoParentGate.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "CoParentSession")!;
    const source = ("export " + fn.getText(ast)).replace(/import\.meta\.env\.DEV/g, "false");
    const code = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    } }).outputText;
    const module = { exports: {} as { CoParentSession: (props: { children: React.ReactNode }) => React.ReactElement } };
    const state = { loading: true, needsOnboarding: false, loadError: true };
    const effects: (() => unknown)[] = [];
    let invalidations = 0, inviteReads = 0;
    class Requests {
      invalidate() { invalidations++; }
      begin() { return {}; }
      latest() { return true; }
    }
    new Function("module", "exports", "React", "useAuth", "useProfile", "useLanguage", "useState", "useRef", "useEffect", "useCallback", "coParentCopy", "CoParentRequests", "window", "button", "primary", "card", "Icon", "coParentApi", code)(
      module, module.exports, React, () => ({ user: { uid: "A" }, signOut: () => {} }), () => state, () => ({ uiLang: "en" }),
      (initial: unknown) => [typeof initial === "function" ? initial() : initial, () => {}], (value: unknown) => ({ current: value }),
      (callback: () => unknown) => { effects.push(callback); }, (callback: unknown) => callback, { en: { loading: "INVITE LOADING" } }, Requests, { location: { search: "?family-invite=synthetic-invite" } }, "", {}, {}, () => null, { invitations: async () => { inviteReads++; return { shares: [{ id: "synthetic-invite" }] }; } },
    );
    const render = () => renderToStaticMarkup(module.exports.CoParentSession({ children: "PROFILE RETRY" }));
    const flushEffects = () => { while (effects.length) effects.shift()!(); };
    expect(render()).toBe("PROFILE RETRY"); flushEffects();
    expect(invalidations).toBe(1); expect(inviteReads).toBe(0);
    // Negative control: retry still gates the invite while the profile read runs.
    state.loadError = false; expect(render()).toContain("INVITE LOADING"); flushEffects();
    expect(inviteReads).toBe(0);
    // Once profiles recover, the invite gate resumes its ordinary read.
    state.loading = false; expect(render()).not.toContain("PROFILE RETRY"); flushEffects();
    expect(inviteReads).toBe(1);
  });
});
