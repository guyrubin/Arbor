/**
 * FEAT-06 (v3) — "Crisis wording routes to Safety & escalation".
 *
 * Typing crisis wording into the coach composer shows the helplines in place
 * (UrgentSupport, the same screen the server runs when the turn is sent) and
 * an "Open Safety & escalation" button that switches to the Safety tab.
 *
 * The slot below is CoachTab's own code, cut out of the source with the
 * TypeScript parser and executed, not a copy of its decision. The phrases are
 * invented test input (public repo: no real child data).
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import { screenForImmediateEscalation } from "../../safety/escalation";

const harness = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));

vi.mock("../../context/LanguageContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../context/LanguageContext")>()),
  useLanguage: () => ({ uiLang: harness.lang, t: (k: string, v?: Record<string, string | number>) => translate(harness.lang as UiLang, k, v) }),
}));

import { UrgentSupport } from "../safety/UrgentSupport";

const COACH_SRC = readFileSync(path.resolve(__dirname, "CoachTab.tsx"), "utf8").replace(/\r\n/g, "\n");
const coach = ts.createSourceFile("CoachTab.tsx", COACH_SRC, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function only(predicate: (node: ts.Node) => boolean): ts.Node {
  const hits: ts.Node[] = [];
  const visit = (node: ts.Node) => { if (predicate(node)) hits.push(node); ts.forEachChild(node, visit); };
  visit(coach);
  if (hits.length !== 1) throw new Error(`Expected one production node, got ${hits.length}`);
  return hits[0];
}

// The production decision (`const composerCrisis = …;`) and the production slot
// (`{composerCrisis && (<UrgentSupport … />)}`), verbatim.
const decision = only((n) => ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === "composerCrisis"));
const slot = only((n) => ts.isJsxExpression(n) && !!n.expression && ts.isBinaryExpression(n.expression) && n.expression.left.getText(coach) === "composerCrisis");

type SlotProps = {
  chatInput: string;
  setActiveTab: (tab: string) => void;
  UrgentSupport: typeof UrgentSupport;
  screenForImmediateEscalation: typeof screenForImmediateEscalation;
};
const slotSource = `import React from "react";
export default function Slot({ chatInput, setActiveTab, UrgentSupport, screenForImmediateEscalation }) {
  ${decision.getText(coach)}
  return <>${slot.getText(coach)}</>;
}`;
const compiled = ts.transpileModule(slotSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
} }).outputText;
const slotModule: { exports: { default?: (props: SlotProps) => React.ReactElement } } = { exports: {} };
new Function("require", "exports", "module", compiled)(
  (id: string) => { if (id === "react") return { __esModule: true, default: React }; throw new Error(`unexpected import ${id}`); },
  slotModule.exports,
  slotModule,
);
const Slot = slotModule.exports.default!;

const CRISIS: Record<"en" | "he", string> = { en: "I can't do this anymore", he: "אני לא יכולה יותר" };
const ORDINARY: Record<"en" | "he", string> = { en: "Bedtime took an hour tonight", he: "השינה לקחה שעה הערב" };
const escapeHtml = (text: string) => renderToStaticMarkup(<span>{text}</span>).slice(6, -7);
const props = (chatInput: string) => {
  const setActiveTab = vi.fn<(tab: string) => void>();
  return { chatInput, setActiveTab, UrgentSupport, screenForImmediateEscalation };
};

function findElement(node: unknown, match: (props: Record<string, any>, type: unknown) => boolean): React.ReactElement<any> | null {
  if (Array.isArray(node)) {
    for (const child of node) { const hit = findElement(child, match); if (hit) return hit; }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  const nodeProps = node.props as Record<string, any>;
  if (match(nodeProps, node.type)) return node as React.ReactElement<any>;
  return findElement(nodeProps.children, match);
}

beforeEach(() => { harness.lang = "en"; });

describe("FEAT-06 — crisis wording in the coach composer routes to Safety & escalation", () => {
  it("the test phrases are what the shared screen treats as crisis / not crisis", () => {
    for (const lang of ["en", "he"] as const) {
      expect(screenForImmediateEscalation({ message: CRISIS[lang] }), lang).not.toBeNull();
      expect(screenForImmediateEscalation({ message: ORDINARY[lang] }), lang).toBeNull();
    }
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: a crisis phrase shows the helplines and a ≥44 px 'Open Safety & escalation' button`, () => {
      harness.lang = lang;
      const html = renderToStaticMarkup(<Slot {...props(CRISIS[lang])} />);
      expect(html).toContain('data-testid="coach-composer-urgent-support"');
      expect(html).toContain('role="alert"');
      expect(html).toMatch(/href="tel:/);
      expect(html).toContain(escapeHtml(translate(lang, "elev.safety.crisis.danger")));
      expect(html).toMatch(/<button type="button" data-testid="coach-composer-urgent-support-safety" class="[^"]*min-h-11/);
      expect(html).toContain(escapeHtml(translate(lang, "elev.safety.open")));
      expect(html).toContain("gpp_maybe");
      // The door follows the lines.
      expect(html.indexOf('data-testid="coach-composer-urgent-support-safety"')).toBeGreaterThan(html.lastIndexOf('href="tel:'));
    });

    it(`${lang}: ordinary words and an empty composer show nothing`, () => {
      harness.lang = lang;
      expect(renderToStaticMarkup(<Slot {...props(ORDINARY[lang])} />)).toBe("");
      expect(renderToStaticMarkup(<Slot {...props("")} />)).toBe("");
    });
  }

  it("the button switches to the Safety tab (and only that)", () => {
    const p = props(CRISIS.en);
    const support = findElement(Slot(p), (_props, type) => type === UrgentSupport);
    expect(support).not.toBeNull();
    const inner = UrgentSupport(support!.props);
    const door = findElement(inner, (nodeProps) => nodeProps["data-testid"] === "coach-composer-urgent-support-safety");
    expect(door).not.toBeNull();
    expect(p.setActiveTab).not.toHaveBeenCalled();
    door!.props.onClick();
    expect(p.setActiveTab).toHaveBeenCalledTimes(1);
    expect(p.setActiveTab).toHaveBeenCalledWith("safety");
  });

  it("source: the slot sits in the ONE composer section, right after the composer (both positions)", () => {
    const start = COACH_SRC.indexOf("const composerSection = (");
    const section = COACH_SRC.slice(start, COACH_SRC.indexOf("</section>", start));
    const composer = section.indexOf("<CompanionComposer");
    const crisis = section.indexOf("{composerCrisis && (");
    expect(composer).toBeGreaterThan(-1);
    expect(crisis).toBeGreaterThan(composer);
    expect(crisis).toBeLessThan(section.indexOf('data-testid="coach-offline-note"'));
    expect(section).toContain('onSafety={() => setActiveTab("safety")}');
    expect(COACH_SRC).toContain("const composerCrisis = screenForImmediateEscalation({ message: chatInput }) !== null;");
  });
});
