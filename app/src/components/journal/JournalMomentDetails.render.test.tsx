import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { translate } from "../../lib/i18n";
import { contextLabel } from "../behaviors/contextLabel";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import { explainAnswerText } from "../../lib/explainAnswer";

const source = readFileSync(resolve(process.cwd(), "src/components/journal/JournalMomentDetails.tsx"), "utf8");
type View = { type: string; props: Record<string, any> };
const nodes = (tree: any): View[] => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = (tree: any): string => Array.isArray(tree) ? tree.map(text).join(" ") : tree?.props ? text(tree.props.children) : tree == null || typeof tree === "boolean" ? "" : String(tree);
function render(lang: "en" | "he", log: any, script?: any) {
  const generate = vi.fn(), seed = vi.fn();
  const imports: Record<string, any> = {
    react: { __esModule: true, default: { createElement: (type: string, props: any, ...children: any[]) => ({ type, props: { ...props, children } }) } },
    "motion/react": { motion: { div: "div" }, AnimatePresence: "presence" },
    "../../context/ArborContext": { useArbor: () => ({ inlineCoRegulationScripts: script ? { [log.id]: script } : {}, isGeneratingInlineScript: {}, handleGetInlineCoRegulationScript: generate, seedCoach: seed }) },
    "../../context/LanguageContext": { useLanguage: () => ({ uiLang: lang, t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars) }) },
    "../ui/Icon": { Icon: "icon" }, "../ui/AiBlock": { SayThis: "say-this" }, "../ui/ExplainAnswer": { ExplainAnswerBlock: "explain" },
    "../../lib/explainAnswer": { explainAnswerText }, "../behaviors/contextLabel": { contextLabel }, "../../content/behaviorTaxonomy": { isIncidentType },
  };
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", compiled)((name: string) => { if (!(name in imports)) throw new Error(`Unmocked boundary: ${name}`); return imports[name]; }, module, module.exports);
  return { tree: module.exports.default({ log }), generate, seed };
}
const log = { id: "parent-log", behaviorType: "Transition Refusal", trigger: "Shoes", response: "Offered two choices", notes: "By the door", context: "Home", durationMinutes: 4, intensity: 3 };

describe("B-ASKJB-23: actual Journal log-detail controls", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: preserves the full parent's record and starts the existing script handler only on tap`, () => {
      const h = render(lang, log);
      for (const words of [log.trigger, log.response, log.notes, translate(lang, "beh.duration"), translate(lang, "beh.intensity")]) expect(text(h.tree)).toContain(words);
      expect(h.generate).not.toHaveBeenCalled();
      const buttons = nodes(h.tree).filter((node) => node.type === "button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0].props.className).toContain("min-h-11");
      buttons[0].props.onClick();
      expect(h.generate).toHaveBeenCalledExactlyOnceWith(log);
    });
    it(`${lang}: keeps SayThis copy/read-aloud, the next step, and the quoted coach handoff`, () => {
      const script = { explanation: "I am here with you.", tryToday: "Offer one small choice." };
      const h = render(lang, log, script);
      const say = nodes(h.tree).find((node) => node.type === "say-this")!;
      expect(say.props).toMatchObject({ text: script.explanation, lang, copyLabel: translate(lang, "coach.action.copy"), copiedLabel: translate(lang, "coach.cards.copied") });
      expect(nodes(h.tree).find((node) => node.type === "explain")?.props.answer.tryToday).toBe(script.tryToday);
      const handoff = nodes(h.tree).filter((node) => node.type === "button").at(-1)!;
      expect(h.seed).not.toHaveBeenCalled(); handoff.props.onClick();
      expect(h.seed).toHaveBeenCalledTimes(1);
      expect(h.seed.mock.calls[0][0]).toMatchObject({ source: "behavior-coreg" });
      expect(h.seed.mock.calls[0][0].prompt).toContain(log.trigger);
      expect(h.seed.mock.calls[0][0].prompt).toContain(log.response);
    });
  }
  it("never grades a plain Moment, even when a legacy row has intensity", () => {
    const h = render("en", { ...log, behaviorType: "Moment" });
    expect(text(h.tree)).not.toContain(translate("en", "beh.intensity"));
    expect(nodes(h.tree).some((node) => node.props.role === "progressbar")).toBe(false);
  });
  it("retains the existing structured failure/escalation renderer without a generated script shortcut", () => {
    const answer = { explanation: "Resources: call 101.", tryToday: "" };
    const h = render("en", log, answer);
    expect(nodes(h.tree).some((node) => node.type === "say-this")).toBe(false);
    expect(nodes(h.tree).find((node) => node.type === "explain")?.props.answer).toBe(answer);
  });
});
