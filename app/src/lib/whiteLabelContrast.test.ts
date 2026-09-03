/**
 * CR-01 / CR-08: white-label SOURCE ratchet, not a computed-CSS contrast audit.
 *
 * Scan every production TS/TSX/JS/JSX string/template (including standalone
 * literals), grouping JSX occurrences by their owning opening tag. Only a
 * static intrinsic element with a direct approved opaque fill is proved here.
 * Dynamic classes/styles, inherited fills, components, alpha and other tokens
 * are debt, never implicit passes. Token luminance/theme coverage belongs to
 * tokens.contrast.test.ts; browser/CSS cascade and cross-module runtime values
 * still need consumer verification. disabled:opacity is an inactive-state
 * exemption, not permission for reduced opacity on an enabled label.
 *
 * Frozen debt is an immutable, sealed inventory. To remove an obsolete case,
 * add its exact key to RETIRED_DEBT; never regenerate fingerprints to accept a
 * changed unresolved case. New copies consume additional occurrences and fail.
 * Fingerprints ignore line numbers/trivia but include the owning tag, ancestor
 * presentation attributes and local presentation dependencies. Thus changing
 * the background of an existing legacy label invalidates its exemption.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_FILLS = new Set([
  "--arbor-clay", "--arbor-clay-deep", "--arbor-ink",
  "--arbor-subtab-active", "--arbor-gradient-primary", "--gradient-cta",
  // tokens.contrast.test.ts checks FUNCTIONAL ink against opaque white
  // --arbor-paper-elevated in root, theme and flat scopes at >= 4.5:1.
  // Contrast is symmetric for these opaque colours: white-on-ink has the
  // same ratio. This approval does NOT extend to peach/pink accent fills.
  "--arbor-peach-ink", "--arbor-pink-ink",
]);
const WHITE = /\btext-white\b/;
type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;
type Case = { file: string; line: number; fingerprint: string; reason: string };
type Debt = Case & { note: string };

function opening(node: ts.Node): node is Opening {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
}

function unwrap(node: ts.Node): ts.Node {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
         ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node) ||
         (ts.isJsxExpression(node) && node.expression)) {
    node = (node as ts.ParenthesizedExpression).expression;
  }
  return node;
}

/** Bounded static strings only. Branches are checked conservatively as a union;
 * no guesses about correlation between a class condition and a style condition. */
function strings(input: ts.Node | undefined): string[] | undefined {
  if (!input) return undefined;
  const node = unwrap(input);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  const join = (a?: string[], b?: string[]) =>
    a && b && a.length * b.length <= 16 ? a.flatMap(x => b.map(y => x + y)) : undefined;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return join(strings(node.left), strings(node.right));
  }
  if (ts.isConditionalExpression(node)) {
    const a = strings(node.whenTrue), b = strings(node.whenFalse);
    return a && b && a.length + b.length <= 16 ? [...a, ...b] : undefined;
  }
  if (ts.isTemplateExpression(node)) {
    let values: string[] | undefined = [node.head.text];
    for (const span of node.templateSpans) {
      values = join(join(values, strings(span.expression)), [span.literal.text]);
    }
    return values;
  }
  return undefined;
}

function attr(node: Opening, name: string): ts.JsxAttribute | undefined {
  return node.attributes.properties.find((a): a is ts.JsxAttribute =>
    ts.isJsxAttribute(a) && a.name.getText() === name);
}

function staticNames(name: ts.PropertyName): string[] | undefined {
  if (ts.isComputedPropertyName(name)) return strings(name.expression);
  return [ts.isStringLiteral(name) ? name.text : name.getText()];
}

function safeFill(value: string, property = "background"): boolean {
  const token = value.trim().match(/^var\((--[\w-]+)\)$/)?.[1];
  if (!token || !SAFE_FILLS.has(token)) return false;
  const gradient = token === "--arbor-gradient-primary" || token === "--gradient-cta";
  return property === "backgroundImage" ? gradient : property === "backgroundColor" ? !gradient : true;
}

function classify(node: ts.Node): string {
  if (!opening(node)) return "standalone literal/template: consuming background not proved";
  if (!/^[a-z][a-z0-9-]*$/.test(node.tagName.getText())) return "component-owned/inherited background";
  if (node.attributes.properties.some(ts.isJsxSpreadAttribute)) return "JSX spread may override presentation";
  const classes = strings(attr(node, "className")?.initializer);
  if (!classes) return "dynamic className/template";
  if (node.attributes.properties.filter(a => ts.isJsxAttribute(a) && a.name.getText() === "className").length !== 1) {
    return "ambiguous className";
  }
  const styleAttrs = node.attributes.properties.filter(a => ts.isJsxAttribute(a) && a.name.getText() === "style");
  if (styleAttrs.length > 1) return "ambiguous style";
  const fills: { property: string; value: string }[] = [];
  const style = attr(node, "style")?.initializer;
  if (style) {
    const object = unwrap(style);
    if (!ts.isObjectLiteralExpression(object)) return "dynamic style/background";
    for (const prop of object.properties) {
      if (!ts.isPropertyAssignment(prop)) return "style spread/method: background not proved";
      const names = staticNames(prop.name);
      if (!names) return "computed style key";
      for (const name of names) {
        if (name.startsWith("--")) return "local token override";
        if (["opacity", "filter", "backdropFilter", "mixBlendMode", "backgroundBlendMode", "mask", "maskImage"].includes(name)) {
          if (name === "opacity" && prop.initializer.getText() === "1") continue;
          return "opacity/filter/compositing requires rendered verification";
        }
        if (["background", "backgroundColor", "backgroundImage"].includes(name)) {
          const values = strings(prop.initializer);
          if (!values) return "dynamic background value";
          fills.push(...values.map(value => ({ property: name, value })));
        }
      }
    }
  }
  if (fills.some(fill => !safeFill(fill.value, fill.property))) {
    return "unapproved background: " + [...new Set(fills.filter(fill => !safeFill(fill.value, fill.property)).map(fill => fill.value))].join(" | ");
  }
  if (!classes.some(value => WHITE.test(value))) return "white literal outside static className";
  for (const value of classes) {
    const tokens = value.trim().split(/\s+/);
    const whites = tokens.filter(token => WHITE.test(token));
    if (!whites.length) continue;
    if (whites.some(token => token !== "text-white")) return "white-text variant/alpha needs state proof";
    let baseFill = fills.length > 0;
    for (const token of tokens) {
      // Disabled controls are exempt; all enabled opacity/filter variants fail.
      if (/^disabled:opacity-\d+$/.test(token) || token === "opacity-100") continue;
      if (/(?:^|:)(?:opacity-|text-opacity-|brightness-|contrast-|filter|backdrop-|mix-blend-|mask-|animate-)/.test(token) ||
          /\[(?:opacity|filter|background|color|--)/.test(token)) {
        return "class opacity/filter/arbitrary presentation";
      }
      if (/(?:^|:)(?:bg-|from-|via-|to-)/.test(token)) {
        const fill = token.match(/^((?:(?:hover|focus|focus-visible|active|disabled|sm|md|lg|xl|2xl):)*)bg-\[(?:(image|color):)?var\((--[\w-]+)\)\]$/);
        if (!fill || !safeFill("var(" + fill[3] + ")", fill[2] === "image" ? "backgroundImage" : "backgroundColor")) return "unapproved background class: " + token;
        if (!fill[1]) baseFill = true;
      }
    }
    if (!baseFill) return "no direct approved background (inheritance unverified)";
  }
  return "";
}

const printer = ts.createPrinter({ removeComments: true });
function normalized(node: ts.Node, source: ts.SourceFile): string {
  return printer.printNode(ts.EmitHint.Unspecified, node, source).replace(/\s+/g, " ").trim();
}
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

function presentation(node: Opening): ts.Node[] {
  return node.attributes.properties.filter(a => ts.isJsxSpreadAttribute(a) ||
    (ts.isJsxAttribute(a) && ["className", "style", "initial", "animate", "variants"].includes(a.name.getText())));
}

/** Capture local value definitions used by presentation, without a type checker
 * or CSS evaluator. Shadowed local names are conservatively all fingerprinted.
 * Imported runtime values remain explicitly unverified; imports are captured. */
function dependencies(source: ts.SourceFile): (roots: ts.Node[]) => string[] {
  const definitions = new Map<string, ts.Node[]>();
  const add = (name: string, node: ts.Node) => definitions.set(name, [...(definitions.get(name) ?? []), node]);
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) add(node.name.text, node.initializer);
    if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node);
    if (ts.isImportDeclaration(node) && node.importClause) {
      if (node.importClause.name) add(node.importClause.name.text, node);
      const bindings = node.importClause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) add(bindings.name.text, node);
      if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach(e => add(e.name.text, node));
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  return roots => {
    const seen = new Set<string>();
    const result = new Set<string>();
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) &&
          !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
          !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) &&
          !ts.isImportSpecifier(node.parent) && !ts.isImportClause(node.parent) &&
          !ts.isNamespaceImport(node.parent)) {
        const name = node.text;
        if (!seen.has(name)) {
          seen.add(name);
          for (const definition of definitions.get(name) ?? []) {
            result.add(name + "=" + normalized(definition, source));
            if (!ts.isImportDeclaration(definition)) visit(definition);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    roots.forEach(visit);
    return [...result].sort();
  };
}

export function scanWhiteLabels(file: string, text: string): { cases: Case[]; literalCount: number } {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const owners = new Map<number, ts.Node>();
  let literalCount = 0;
  const visit = (node: ts.Node) => {
    const isLiteral = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ||
      node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle ||
      node.kind === ts.SyntaxKind.TemplateTail;
    const literalWhite = isLiteral && WHITE.test((node as ts.StringLiteral).text);
    const foldedWhite = (ts.isTemplateExpression(node) || ts.isBinaryExpression(node)) &&
      strings(node)?.some(value => WHITE.test(value));
    if (literalWhite) literalCount++;
    if (literalWhite || foldedWhite) {
      let owner = node;
      while (owner.parent && !opening(owner) && !ts.isVariableDeclaration(owner) &&
             !ts.isReturnStatement(owner) && !ts.isPropertyAssignment(owner)) owner = owner.parent;
      // Property assignments inside a JSX style/class expression belong to that tag.
      let ancestor: ts.Node | undefined = owner;
      while (ancestor && !ts.isStatement(ancestor)) {
        if (opening(ancestor)) { owner = ancestor; break; }
        ancestor = ancestor.parent;
      }
      owners.set(owner.getStart(source), owner);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const localDependencies = dependencies(source);
  const cases = [...owners.values()].map(node => {
    const roots = opening(node) ? presentation(node) : [node];
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent) && parent.openingElement !== node) roots.push(...presentation(parent.openingElement));
    }
    const fingerprint = digest(JSON.stringify([
      normalized(node, source), roots.map(root => normalized(root, source)), localDependencies(roots),
    ]));
    return { file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      fingerprint, reason: classify(node) };
  });
  return { cases, literalCount };
}

export function productionFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return productionFiles(file);
    return /\.[jt]sx?$/.test(entry.name) && !/\.(?:test|spec)\.[jt]sx?$|\.d\.ts$/.test(entry.name) ? [file] : [];
  }).sort();
}

const keyOf = (item: Pick<Case, "file" | "fingerprint">) => item.file + "#" + item.fingerprint;

// 2026-09-03 baseline: 86 literal sites; 61 direct approved fills; 25 unresolved.
// Two entries document known AA failures. The other entries are UNVERIFIED,
// not failed contrast measurements. CR-01/CR-08 legacy cleanup stays open.
const FROZEN_DEBT: readonly Debt[] = [
  {
    "file": "components/coach/ArborVision.tsx",
    "line": 123,
    "fingerprint": "3c6c769def467ed1f0ae02ffc8225084821ff1983576805498f80e2df2418985",
    "reason": "unapproved background: rgba(41,51,63,0.7)",
    "note": "Translucent camera/image overlay (and optional backdrop filter); backdrop/compositing verification remains open."
  },
  {
    "file": "components/coach/CoachAnswerCards.tsx",
    "line": 199,
    "fingerprint": "6f5ae7331ee0c4cd4ab9ba4ce41eb4324d6760b68103cbfb3e7f57ce288d3ced",
    "reason": "component-owned/inherited background",
    "note": "Conditional Coach check icon inherits the selected parent's fill; component/state proof required."
  },
  {
    "file": "components/layout/Shell.tsx",
    "line": 386,
    "fingerprint": "2b4b7497e9d0d5200019ce8fa4a82065f35f4897e8f823224067aea6296b2fd4",
    "reason": "unapproved background: var(--arbor-peach)",
    "note": "KNOWN AA FAIL: sandbox Learn how, white on peach #f97316; 2.80:1."
  },
  {
    "file": "components/practice/DevelopmentCopilot.tsx",
    "line": 277,
    "fingerprint": "8688478d081145140374c20431733d8af9351cdc852cc163b42173d3df5030fd",
    "reason": "unapproved background: var(--arbor-peach-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/practice/EarlyReadingTrack.tsx",
    "line": 327,
    "fingerprint": "fdd0195af37357fb31860dcd0f7a18ee6c7a796dcc65177912f10ecb27152f8a",
    "reason": "unapproved background: var(--arbor-sky-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/practice/JourneyTab.tsx",
    "line": 172,
    "fingerprint": "72eccb627b4fabd4d8372482875af04e75183706048ba317a3686155aabf8b82",
    "reason": "unapproved background: var(--arbor-peach-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/practice/MimicMatch.tsx",
    "line": 156,
    "fingerprint": "12d04a865941eabc6b0292d66aa3178b51dfc8a8e88a3bf60801ef9292d0b944",
    "reason": "opacity/filter/compositing requires rendered verification",
    "note": "Translucent camera/image overlay (and optional backdrop filter); backdrop/compositing verification remains open."
  },
  {
    "file": "components/practice/MimicMatch.tsx",
    "line": 176,
    "fingerprint": "c3e8ee3756e1a6724c13dc647c8053ad1c399f7721217ee434285047cf73cfac",
    "reason": "no direct approved background (inheritance unverified)",
    "note": "Mimic win label inherits a translucent overlay over live imagery."
  },
  {
    "file": "components/practice/MimicMatch.tsx",
    "line": 187,
    "fingerprint": "e9fc0fd23c785889e977b093d46b63b0918da914c8bf1562b38cf2f97a7ebb9b",
    "reason": "unapproved background: var(--arbor-lav-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/practice/MimicStudioTab.tsx",
    "line": 197,
    "fingerprint": "f355de3b3049893bfd46464ada8ab949cb7a1e25c104e23c4d1931fef7e23048",
    "reason": "unapproved background: rgba(28,34,43,0.75)",
    "note": "Translucent camera/image overlay (and optional backdrop filter); backdrop/compositing verification remains open."
  },
  {
    "file": "components/practice/SpeechCoachTab.tsx",
    "line": 425,
    "fingerprint": "2c80687e6ffee2abfc63797c7c99e7e4c768e6d06a6c24e9bee913d20ab78ef6",
    "reason": "unapproved background: var(--arbor-sky-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/practice/SpeechCoachTab.tsx",
    "line": 500,
    "fingerprint": "dee171a8915221d21a04170bff8fe8feb4d0365e1408829fb179942e3c22581a",
    "reason": "unapproved background: var(--arbor-sky-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/practice/SpeechCoachTab.tsx",
    "line": 603,
    "fingerprint": "be61a9b94915f387dc6ac9a27559c77e75e8d6c16354ac2c5bc473f430faa3b6",
    "reason": "unapproved background: var(--arbor-sky-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/practice/SpeechCoachTab.tsx",
    "line": 625,
    "fingerprint": "9fe1a33dbc88aef910aa8a9a4fe0f649dd7c692bf0aa99e924e121e324cefe9d",
    "reason": "unapproved background: var(--arbor-peach-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/tabs/BedtimeStoriesTab.tsx",
    "line": 445,
    "fingerprint": "8920128b8d23cf5e9323cc1faf8a5c9b5c9b0dbb5ee51375bcb27ee9677d4c6d",
    "reason": "unapproved background: linear-gradient(135deg, var(--arbor-clay) 0%, var(--arbor-green-ink) 100%)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/tabs/BehaviorsTab.tsx",
    "line": 632,
    "fingerprint": "8b452571960310c432957976d7376fa0523d0e3ae9f79481aa533f6f919d4973",
    "reason": "dynamic background value",
    "note": "T.gradientCta alias; imported runtime value not resolved by this bounded source guard."
  },
  {
    "file": "components/tabs/BehaviorsTab.tsx",
    "line": 691,
    "fingerprint": "9310d04be3f5fee2724fc8f0010827ce17ea1d626659f05d943f3e90facc40c4",
    "reason": "dynamic background value",
    "note": "T.gradientCta alias; imported runtime value not resolved by this bounded source guard."
  },
  {
    "file": "components/tabs/BehaviorsTab.tsx",
    "line": 1083,
    "fingerprint": "ad487194a455b193ab089a9df6abb7e88ecc187012882afdf8eea61acf994c7b",
    "reason": "unapproved background: var(--arbor-pink-ink)",
    "note": "Functional-ink fill: this reverse white-on-ink pair is outside the approved fill set; verify before retiring."
  },
  {
    "file": "components/tabs/BehaviorsTab.tsx",
    "line": 1123,
    "fingerprint": "1ebb89eab19856a7e0493ce2d36e3ee9f57b5f8f8700889da80e4a98d089396d",
    "reason": "dynamic background value",
    "note": "T.gradientCta alias; imported runtime value not resolved by this bounded source guard."
  },
  {
    "file": "components/tabs/CoachTab.tsx",
    "line": 665,
    "fingerprint": "73a2721b6eb29afc6471ceb14d34b66a4869efe758e18562221d3a4871b3c980",
    "reason": "dynamic background value",
    "note": "T.gradientCta alias; imported runtime value not resolved by this bounded source guard."
  },
  {
    "file": "components/tabs/CoachTab.tsx",
    "line": 1012,
    "fingerprint": "2b0a267a4d10ce4825e01f7eb82daedfb4c9fa74705a90e4c6b96eec34c78c6d",
    "reason": "dynamic style/background",
    "note": "Coach user/assistant class and fill branches need correlated-state proof."
  },
  {
    "file": "components/tabs/HeroJourneyTab.tsx",
    "line": 511,
    "fingerprint": "9befbd35e2ca987d66a6b7e6f8cce856f91a81c7e45b8012e009c4476f156d42",
    "reason": "unapproved background: var(--arbor-pink)",
    "note": "KNOWN AA FAIL: ORIGINAL badge, white on pink #ec4899; 3.53:1."
  },
  {
    "file": "components/tabs/HeroJourneyTab.tsx",
    "line": 672,
    "fingerprint": "a8ac8f3af3b7d2d06ffa8093b41042c2c74e979e9146077970b347c15fe53c44",
    "reason": "unapproved background: var(--arbor-rule-strong)",
    "note": "Question checkbox: white mark and conditional clay/rule fill need state-aware proof."
  },
  {
    "file": "components/tabs/HeroJourneyTab.tsx",
    "line": 686,
    "fingerprint": "4fbbb9b7bbfd18809289404c121d1e3e4836a79c98f24af23b41c500209dc919",
    "reason": "dynamic background value",
    "note": "T.gradientCta alias; imported runtime value not resolved by this bounded source guard."
  },
  {
    "file": "components/ui/Avatar.tsx",
    "line": 50,
    "fingerprint": "401210d34e62158d500c7d4604fe8d72d5f7139f8ac00e6152a1760806fb7e3b",
    "reason": "dynamic className/template",
    "note": "Generated initials palette plus caller classes/style spreads; shared-component consumer verification remains open."
  }
];
const FROZEN_SEAL = "66b8a7891677ed44216437abe0176e245b554deb40754e7f1d747688e6af5ee6";
// Retire exact keys only after fixing/removing their consumer; never rewrite the snapshot.
const RETIRED_DEBT: readonly string[] = [
  // Parent fixes the two simple failing fills to their verified ink tokens.
  "components/layout/Shell.tsx#2b4b7497e9d0d5200019ce8fa4a82065f35f4897e8f823224067aea6296b2fd4",
  "components/tabs/HeroJourneyTab.tsx#9befbd35e2ca987d66a6b7e6f8cce856f91a81c7e45b8012e009c4476f156d42",
  // Existing direct peach-ink / pink-ink cases now have the same AA proof.
  "components/practice/DevelopmentCopilot.tsx#8688478d081145140374c20431733d8af9351cdc852cc163b42173d3df5030fd",
  "components/practice/JourneyTab.tsx#72eccb627b4fabd4d8372482875af04e75183706048ba317a3686155aabf8b82",
  "components/practice/SpeechCoachTab.tsx#9fe1a33dbc88aef910aa8a9a4fe0f649dd7c692bf0aa99e924e121e324cefe9d",
  "components/tabs/BehaviorsTab.tsx#ad487194a455b193ab089a9df6abb7e88ecc187012882afdf8eea61acf994c7b",
];

export function ratchet(cases: Case[], allowed: readonly Case[]): { introduced: Case[]; stale: string[] } {
  const remaining = new Map<string, number>();
  for (const item of allowed) remaining.set(keyOf(item), (remaining.get(keyOf(item)) ?? 0) + 1);
  const introduced: Case[] = [];
  for (const item of cases.filter(item => item.reason)) {
    const key = keyOf(item), count = remaining.get(key) ?? 0;
    if (count > 0) remaining.set(key, count - 1);
    else introduced.push(item);
  }
  return { introduced, stale: [...remaining].flatMap(([key, count]) => count ? [key] : []) };
}

describe("CR-01 white-label source ratchet — future regressions, not legacy contrast sign-off", () => {
  it("keeps the original inventory sealed and retirement strictly within it", () => {
    expect(digest(JSON.stringify(FROZEN_DEBT))).toBe(FROZEN_SEAL);
    expect(new Set(RETIRED_DEBT).size).toBe(RETIRED_DEBT.length);
    for (const key of RETIRED_DEBT) expect(FROZEN_DEBT.some(item => keyOf(item) === key)).toBe(true);
  });

  // Parse every production source to retain escaped-string/template/concat coverage.
  // This whole-tree AST scan can exceed 5s under host memory/browser pressure;
  // bound only this audit at 20s, leaving fast controls and global timeouts unchanged.
  it("rejects new/changed unresolved labels and requires stale debt to be retired", () => {
    const files = productionFiles();
    expect(files.length).toBeGreaterThan(100);
    const scanned = files.map(file => scanWhiteLabels(path.relative(SRC, file).split(path.sep).join("/"), readFileSync(file, "utf8")));
    const cases = scanned.flatMap(result => result.cases);
    const debt = FROZEN_DEBT.filter(item => !RETIRED_DEBT.includes(keyOf(item)));
    const result = ratchet(cases, debt);
    const report = result.introduced.map(item => item.file + ":" + item.line + " — " + item.reason + " [" + item.fingerprint + "]");
    expect(report, "Use a direct approved fill or resolve the consumer; never grow/reset frozen debt.").toEqual([]);
    expect(result.stale, "Resolved/removed case: add its exact key to RETIRED_DEBT.").toEqual([]);
  }, 20_000);
});

describe("CR-01 white-label negative controls", () => {
  const scan = (source: string) => scanWhiteLabels("fixture.tsx", source).cases;
  const label = (fill: string) => '<button className="text-white" style={{ background: "' + fill + '" }}>Save</button>';

  it.each([...SAFE_FILLS])("accepts canonical opaque %s labels", token => {
    expect(scan(label("var(" + token + ")"))).toHaveLength(1);
    expect(scan(label("var(" + token + ")"))[0].reason).toBe("");
  });

  it("accepts static JSX expressions and template/concatenation classes", () => {
    for (const source of [
      '<button className={"text-white bg-[var(--arbor-clay)]"}>Save</button>',
      '<button className={`text-white bg-[var(--arbor-ink)]`}>Save</button>',
      '<button className={`text-${"white"} bg-[var(--arbor-clay)]`}>Save</button>',
      '<button className={"text-" + "white bg-[var(--arbor-clay)]"}>Save</button>',
      '<button className="text-white bg-[var(--arbor-clay)] hover:bg-[var(--arbor-clay-deep)]">Save</button>',
      '<button className="text-white bg-[image:var(--gradient-cta)]">Save</button>',
    ]) {
      const cases = scan(source);
      expect(cases.length).toBeGreaterThan(0);
      expect(cases.every(item => !item.reason)).toBe(true);
    }
  });

  it.each([
    '<button className="text-white bg-white">Save</button>',
    '<button className="text-white bg-[var(--arbor-paper)]">Save</button>',
    label("var(--arbor-paper-elevated)"),
    label("var(--unknown-fill)"),
    label("var(--arbor-peach)"),
    label("var(--arbor-pink)"),
    '<button className="text-white" style={{ backgroundColor: "var(--gradient-cta)" }}>Save</button>',
    '<button className="text-white bg-[var(--gradient-cta)]">Save</button>',
    '<button className="text-white bg-[var(--arbor-clay)] hover:bg-white">Save</button>',
    '<button className="text-white" style={{ background: dynamicFill }}>Save</button>',
    '<button className={`text-white ${extra}`} style={{ background: "var(--arbor-clay)" }}>Save</button>',
    '<button className="text-white" {...props} style={{ background: "var(--arbor-clay)" }}>Save</button>',
    '<button className="text-white/80 bg-[var(--arbor-clay)]">Save</button>',
    '<button className="text-white bg-[var(--arbor-clay)] opacity-50">Save</button>',
    '<button className="hover:text-white bg-white">Save</button>',
    'const classes = "text-white";',
    'const html = `<button class="text-white">Save</button>`;',
  ])("does not silently skip unsafe/unknown source: %s", source => {
    const cases = scan(source);
    expect(cases.length).toBeGreaterThan(0);
    expect(ratchet(cases, []).introduced.length).toBeGreaterThan(0);
  });

  it("invalidates an exemption when an unsafe background changes, without line-number churn", () => {
    const original = label("var(--arbor-peach)");
    const baseline = scan(original);
    expect(baseline[0].reason).not.toBe("");
    expect(ratchet(scan("\n\n// unrelated comment\n" + original), baseline).introduced).toEqual([]);
    expect(ratchet(scan(label("var(--arbor-paper)")), baseline).introduced).toHaveLength(1);
    expect(ratchet(scan("<>" + original + original + "</>"), baseline).introduced).toHaveLength(1);
    expect(ratchet(scan(label("var(--arbor-clay)")), baseline).stale).toHaveLength(1);
  });

  it("fingerprints inherited fills and local dynamic-background dependencies", () => {
    const inherited = '<div style={{ background: "var(--arbor-peach)" }}><span className="text-white">Save</span></div>';
    expect(ratchet(scan(inherited.replace("--arbor-peach", "--arbor-paper")), scan(inherited)).introduced).toHaveLength(1);
    const dynamic = 'const fill = "var(--arbor-peach)"; <button className="text-white" style={{ background: fill }}>Save</button>';
    expect(ratchet(scan(dynamic.replace("--arbor-peach", "--arbor-paper")), scan(dynamic)).introduced).toHaveLength(1);
  });

  it("ignores comments, but sees escaped strings and nested conditional literals", () => {
    expect(scan('// className="text-white"\nconst unrelated = 1;')).toEqual([]);
    // Raw JSX attribute text does not interpret JavaScript Unicode escapes.
    expect(scan('<button className="text-\\u0077hite" />')).toEqual([]);
    // Preserve the backslash in this fixture; the JS expression's string is
    // decoded by TypeScript into the real text-white utility.
    const escaped = scan('<button className={"text-\\u0077hite"} />');
    expect(escaped).toHaveLength(1);
    expect(ratchet(escaped, []).introduced).toHaveLength(1);
    const conditional = '<button className={active ? "text-white" : ""} style={{ background: active ? "var(--arbor-clay)" : "var(--arbor-paper)" }}>Save</button>';
    expect(ratchet(scan(conditional), []).introduced).toHaveLength(1);
  });
});
