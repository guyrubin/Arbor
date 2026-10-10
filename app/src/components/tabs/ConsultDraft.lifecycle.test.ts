import React from "react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { visitForConsult } from "../../lib/today/dayCard";
import { consultAudienceForProfession } from "../../lib/careTrack";
const source = ts.createSourceFile("ConsultTab.tsx", readFileSync("src/components/tabs/ConsultTab.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ConsultContent")!.getText(source);
const code = ts.transpileModule(`${declaration}; return ConsultContent;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
let cursor = 0, slots: any[] = [];
let child = "a", query = new URLSearchParams("appointment=visit"), rows: any[] = [], status = { loaded: true, error: false, confirmed: true };
const AskSpecialist = () => null;
const env = {
  React, AskSpecialist, visitForConsult, consultAudienceForProfession,
  useRef: (initial: unknown) => slots[cursor++] ??= { current: initial },
  useState: (initial: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value: unknown) => { slots[i] = value; }]; },
  useMemo: (calculate: () => unknown) => calculate(),
  useAuth: () => ({ user: null }), useArbor: () => ({ childProfile: { id: child, name: "Synthetic" }, activeTab: "consult", setActiveTab: vi.fn() }),
  useLanguage: () => ({ uiLang: "en", t: (key: string) => key }), useToast: () => ({ toast: vi.fn() }),
  useChildCollection: (_child: string, name: string) => ({ items: name === "appointments" ? rows : [], ...status }),
  visitAwaitingOutcome: () => null, isIntakeProfession: () => false, consultHeading: () => "visit", activeHomeEnrolments: () => [], guidedTierOn: () => false,
  appointmentRoleLabel: () => "Stored profession", fmtDay: () => "date", lowerFor: (_lang: string, value: string) => value,
};
const component = new Function(...Object.keys(env), code)(...Object.values(env));
function render() { cursor = 0; return component({ query, isOwnerCurrent: () => true }); }
function find(node: React.ReactNode, type: unknown, path = "", ancestors: React.ReactElement<any>[] = []): { element: React.ReactElement<any>; path: string; ancestors: React.ReactElement<any>[] } | null {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const found = find(node[i], type, `${path}/${i}`, ancestors); if (found) return found; } }
  else if (React.isValidElement(node)) { const element = node as React.ReactElement<any>; if (element.type === type) return { element, path, ancestors }; return find(element.props.children, type, `${path}/children`, [...ancestors, element]); }
  return null;
}
const visit = { id: "visit", whenIso: new Date(Date.now() + 86400000).toISOString(), status: "confirmed", profession: "slp" };
beforeEach(() => { cursor = 0; slots = []; child = "a"; query = new URLSearchParams("appointment=visit"); rows = [visit]; status = { loaded: true, error: false, confirmed: true }; });
describe("targeted Consult retains the mounted editor while blocking stale egress", () => {
  it("does not mount an editor before the first confirmed target read", () => {
    status.confirmed = false; expect(find(render(), AskSpecialist)).toBeNull();
    status.confirmed = true; expect(find(render(), AskSpecialist)).not.toBeNull();
  });
  it("preserves the editor's reconciliation identity through cache, pending, error, deletion and recovery", () => {
    const initial = find(render(), AskSpecialist)!; expect(initial).not.toBeNull();
    for (const state of [{ loaded: false, confirmed: false, error: false }, { loaded: true, confirmed: false, error: false }, { loaded: true, confirmed: false, error: true }]) {
      status = state; const current = find(render(), AskSpecialist);
      expect(current, "keep the existing editor mounted rather than losing its unsaved reason").not.toBeNull();
      expect(current!.path).toBe(initial.path); expect(current!.element.key).toBe(initial.element.key);
      expect(current!.ancestors.some(el => el.props.hidden === true && el.props.inert === true)).toBe(true);
    }
    status = { loaded: true, confirmed: true, error: false }; rows = [];
    expect(find(render(), AskSpecialist)!.ancestors.some(el => el.props.hidden && el.props.inert)).toBe(true);
    rows = [{ ...visit, profession: "ot" }]; const recovered = find(render(), AskSpecialist)!;
    expect(recovered.path).toBe(initial.path); expect(recovered.element.key).toBe(initial.element.key);
    expect(recovered.ancestors.some(el => el.props.hidden || el.props.inert)).toBe(false);
  });
  it("does not retain a previous child's or target's editor after its keyed owner changes", () => {
    expect(find(render(), AskSpecialist)).not.toBeNull();
    expect(source.getFullText()).toContain('JSON.stringify([user?.uid ?? "local", childProfile.id, query.get("appointment")])');
    expect(source.getFullText()).toContain('key={scope}');
    // The outer keyed ConsultContent owns this state; a new key receives fresh hooks.
    slots = []; child = "b"; rows = []; status.confirmed = false;
    expect(find(render(), AskSpecialist)).toBeNull();
  });
});
