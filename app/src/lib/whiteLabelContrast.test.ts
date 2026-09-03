/**
 * CR-01 / CR-08: white-label SOURCE ratchet, not a computed-CSS contrast audit.
 *
 * Scan every production TS/TSX/JS/JSX string/template (including standalone
 * literals), grouping JSX occurrences by their owning opening tag. Only a
 * static intrinsic element with a direct approved opaque fill is accepted,
 * subject to explicit ancestor effects in the enabled, settled state.
 * Unknown class expressions fail. Arbitrary CSS, portals and caller ancestry across
 * component boundaries still require external/rendered verification.
 * Dynamic own classes/styles, inherited fills, components, alpha and other tokens
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
  "--arbor-gradient-primary", "--gradient-cta",
  // tokens.contrast.test.ts checks FUNCTIONAL ink against opaque white
  // --arbor-paper-elevated in root, theme and flat scopes at >= 4.5:1.
  // Contrast is symmetric for these opaque colours: white-on-ink has the
  // same ratio. This approval does NOT extend to peach/pink accent fills.
  "--arbor-peach-ink", "--arbor-pink-ink",
]);
// --arbor-subtab-active is scope-dependent; it has no global white-label proof.
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

// Resolve lexical bindings, never a same-named const from another function or
// an outer scope hidden by a parameter. This is deliberately not a type checker.
function functionScope(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
}
const scopeBindings = new WeakMap<ts.Node, Map<string, ts.Node[]>>();
function bindings(scope: ts.Node): Map<string, ts.Node[]> {
  const cached = scopeBindings.get(scope);
  if (cached) return cached;
  const result = new Map<string, ts.Node[]>();
  const add = (name: ts.BindingName, declaration: ts.Node) => {
    if (ts.isIdentifier(name)) result.set(name.text, [...(result.get(name.text) ?? []), declaration]);
    else for (const element of name.elements) if (ts.isBindingElement(element)) add(element.name, element);
  };
  const variables = (list: ts.VariableDeclarationList) => list.declarations.forEach(declaration => add(declaration.name, declaration));
  if (functionScope(scope)) {
    scope.parameters.forEach(parameter => add(parameter.name, parameter));
    // var is function-scoped even when declared in a nested block.
    const visit = (node: ts.Node) => {
      if (node !== scope && functionScope(node)) return;
      if (ts.isVariableDeclarationList(node) && !(node.flags & ts.NodeFlags.BlockScoped)) variables(node);
      ts.forEachChild(node, visit);
    };
    visit(scope);
  }
  if (ts.isSourceFile(scope) || ts.isBlock(scope)) {
    for (const statement of scope.statements) {
      if (ts.isVariableStatement(statement)) variables(statement.declarationList);
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) add(statement.name, statement);
      if (ts.isImportDeclaration(statement) && statement.importClause) {
        const clause = statement.importClause;
        if (clause.name) add(clause.name, clause);
        const named = clause.namedBindings;
        if (named && ts.isNamedImports(named)) named.elements.forEach(element => add(element.name, element));
        else if (named) add(named.name, named);
      }
    }
  }
  if (ts.isCatchClause(scope) && scope.variableDeclaration) add(scope.variableDeclaration.name, scope.variableDeclaration);
  if ((ts.isForStatement(scope) || ts.isForOfStatement(scope) || ts.isForInStatement(scope)) && scope.initializer && ts.isVariableDeclarationList(scope.initializer)) variables(scope.initializer);
  scopeBindings.set(scope, result);
  return result;
}
function lexicalBinding(node: ts.Identifier): ts.Node | null | undefined {
  for (let scope: ts.Node | undefined = node.parent; scope; scope = scope.parent) {
    const found = bindings(scope).get(node.text);
    if (found) return found.length === 1 ? found[0] : null;
  }
  return undefined;
}
function constValue(node: ts.Identifier): ts.Expression | undefined {
  const binding = lexicalBinding(node);
  return binding && ts.isVariableDeclaration(binding) && ts.isIdentifier(binding.name) &&
    ts.isVariableDeclarationList(binding.parent) && (binding.parent.flags & ts.NodeFlags.Const) ? binding.initializer : undefined;
}
function alternatives(input: ts.Node, depth = 0): ts.Node[] {
  const node = unwrap(input);
  if (depth > 8) return [];
  if (ts.isConditionalExpression(node)) {
    const yes = alternatives(node.whenTrue, depth + 1), no = alternatives(node.whenFalse, depth + 1);
    return yes.length && no.length ? [...yes, ...no] : [];
  }
  const value = ts.isIdentifier(node) ? constValue(node) : undefined;
  return value ? alternatives(value, depth + 1) : [node];
}
function allValues(node: ts.Node, allowed: string[]): boolean {
  const values = alternatives(node).map(value => ts.isStringLiteral(value) ? value.text : value.getText());
  return values.length > 0 && values.every(value => allowed.includes(value));
}
function properties(input: ts.Node): { name: string; value: ts.Node }[] | undefined {
  const entries: { name: string; value: ts.Node }[] = [];
  const branches = alternatives(input);
  if (!branches.length) return undefined;
  for (const branch of branches) {
    if (branch.getText() === "undefined" || branch.kind === ts.SyntaxKind.FalseKeyword) continue;
    if (!ts.isObjectLiteralExpression(branch)) return undefined;
    for (const prop of branch.properties) {
      if (!ts.isPropertyAssignment(prop)) return undefined;
      const names = staticNames(prop.name);
      if (!names) return undefined;
      entries.push(...names.map(name => ({ name, value: prop.initializer })));
    }
  }
  return entries;
}

const WRAPPERS = [
  { name: "SectionCard", file: "components/ui/kit.tsx", slots: ["children", "action"], params: ["title", "icon", "tone", "children", "action"] },
  { name: "Modal", file: "components/ui/Modal.tsx", slots: ["children"], params: ["open", "onClose", "title", "children", "maxWidth"] },
  { name: "PlayShell", file: "components/ui/playkit.tsx", slots: ["children"], params: ["children", "className"] },
  { name: "KidModeProvider", file: "components/kidmode/KidModeContext.tsx", slots: ["children"], params: ["children"] },
] as const;
function importsModule(source: ts.SourceFile, statement: ts.ImportDeclaration, module: string): boolean {
  if (!ts.isStringLiteral(statement.moduleSpecifier)) return false;
  const specifier = statement.moduleSpecifier.text;
  return specifier === module || (specifier.startsWith(".") &&
    path.resolve(SRC, path.dirname(source.fileName), specifier).replace(/\.[jt]sx?$/, "") === path.resolve(SRC, module).replace(/\.[jt]sx?$/, ""));
}
function imported(node: ts.Node, name: string, module: string): boolean {
  if (!ts.isIdentifier(node)) return false;
  const binding = lexicalBinding(node);
  if (!binding || (!ts.isImportSpecifier(binding) && !ts.isImportClause(binding))) return false;
  const clause = ts.isImportSpecifier(binding) ? binding.parent.parent : binding;
  if (clause.isTypeOnly || (ts.isImportSpecifier(binding) && binding.isTypeOnly)) return false;
  const exported = ts.isImportSpecifier(binding) ? (binding.propertyName ?? binding.name).text : "default";
  // These default aliases are checked against their actual declarations by
  // auditClassInputs; a same-named parameter/local never identifies an import.
  if (exported !== name && !(exported === "default" && CLASS_INPUTS.some(spec =>
    spec.file === module && spec.name === name && spec.defaultExport))) return false;
  return importsModule(node.getSourceFile(), clause.parent, module);
}

// This value is inspected and mutation-tested against its real declaration below.
const CARD_CLASSES = "bg-white rounded-[18px] border border-[var(--arbor-rule)] shadow-[var(--shadow-xs)]";
function forwardsCardClasses(text: string): boolean {
  const source = ts.createSourceFile("components/ui/kit.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return source.statements.some(node => ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) &&
    path.resolve(SRC, "components/ui", node.moduleSpecifier.text).replace(/\.[jt]sx?$/, "") === path.resolve(SRC, "lib/tokens") &&
    node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.some(element => element.name.text === "cardCls" && (element.propertyName ?? element.name).text === "cardCls"));
}
const classProofs = new WeakMap<ts.SourceFile, ClassInputProof>();
function classValues(input: ts.Node, depth = 0): string[] | undefined {
  if (depth > 12) return undefined;
  const node = unwrap(input);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  const join = (a?: string[], b?: string[]) => a && b && a.length * b.length <= 16 ? a.flatMap(x => b.map(y => x + y)) : undefined;
  if (ts.isIdentifier(node)) {
    const binding = lexicalBinding(node);
    const local = constValue(node);
    if (local) return classValues(local, depth + 1);
    if (["lib/tokens.ts", "components/ui/kit.tsx"].some(file => imported(node, "cardCls", file))) return [CARD_CLASSES];
    // Only the exact declared prop of one of the three audited components may
    // use a caller proof. A shadowing parameter/local is never interchangeable.
    if (binding && ts.isBindingElement(binding) && ts.isObjectBindingPattern(binding.parent) && ts.isParameter(binding.parent.parent)) {
      const parameter = binding.parent.parent, fn = parameter.parent;
      if (ts.isFunctionDeclaration(fn) && fn.parent === node.getSourceFile()) {
        const prop = (binding.propertyName ?? binding.name).getText();
        const spec = CLASS_INPUTS.find(spec => spec.file === node.getSourceFile().fileName && spec.name === fn.name?.text && spec.prop === prop);
        if (spec) return classProofs.get(node.getSourceFile())?.values.get(inputKey(spec));
      }
    }
    return undefined;
  }
  if (ts.isConditionalExpression(node)) {
    const yes = classValues(node.whenTrue, depth + 1), no = classValues(node.whenFalse, depth + 1);
    return yes && no && yes.length + no.length <= 16 ? [...yes, ...no] : undefined;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return join(classValues(node.left, depth + 1), classValues(node.right, depth + 1));
  if (ts.isTemplateExpression(node)) {
    let values: string[] | undefined = [node.head.text];
    for (const span of node.templateSpans) values = join(join(values, classValues(span.expression, depth + 1)), [span.literal.text]);
    return values;
  }
  return undefined;
}
// Three concrete class-prop contracts, resolved from actual defaults + all
// import-proven JSX callers. Unknown args, spreads and reference escapes fail;
// this is not permission to substitute arbitrary runtime props with empty text.
const CLASS_INPUTS = [
  { file: "components/ui/HeroAvatar.tsx", name: "HeroAvatar", prop: "className", defaultExport: true },
  { file: "components/ui/playkit.tsx", name: "PlayShell", prop: "className", defaultExport: false },
  { file: "components/ui/Modal.tsx", name: "Modal", prop: "maxWidth", defaultExport: true },
] as const;
type ClassInput = typeof CLASS_INPUTS[number];
type SourceInput = { file: string; text: string };
type ClassInputProof = { values: Map<string, string[]>; failures: string[]; callers: Map<string, number> };
const inputKey = (spec: ClassInput) => spec.file + "#" + spec.name + "." + spec.prop;
function dimensionClasses(values: string[]): boolean {
  return values.some(value => value.trim().split(/\s+/).filter(Boolean).some(token =>
    !/^(?:(?:max-)?(?:sm|md|lg|xl|2xl):)*(?:(?:min-|max-)?[wh])-(?:[\w.-]+|\[[\w.%]+\])$/.test(token)));
}
function auditClassInputs(inputs: Iterable<SourceInput>): ClassInputProof {
  const proof: ClassInputProof = { values: new Map(), failures: [], callers: new Map() };
  const defaults = new Map<string, string[]>(), failed = new Set<string>();
  const fail = (spec: ClassInput, site: string, why: string) => {
    failed.add(inputKey(spec)); proof.failures.push(site + " " + spec.name + "." + spec.prop + ": " + why);
  };
  const accept = (spec: ClassInput, site: string, values: string[] | undefined) => {
    if (!values || classEffect(values) || (spec.prop === "maxWidth" && dimensionClasses(values))) {
      fail(spec, site, "unresolved or unsafe class input"); return;
    }
    const key = inputKey(spec), union = [...new Set([...(proof.values.get(key) ?? []), ...values])];
    if (union.length > 16) fail(spec, site, "class branch bound exceeded");
    else proof.values.set(key, union);
  };
  for (const input of inputs) {
    const source = ts.createSourceFile(input.file, input.text, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(input.file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const imports = new Map<string, ClassInput>();
    for (const spec of CLASS_INPUTS) {
      if (spec.file === input.file) {
        const fn = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === spec.name);
        if (spec.defaultExport) {
          const exports = source.statements.filter(ts.isExportAssignment);
          if (exports.length !== 1 || exports[0].isExportEquals || !ts.isIdentifier(exports[0].expression) ||
              !fn || lexicalBinding(exports[0].expression) !== fn) fail(spec, input.file, "default export must identify the audited declaration");
        }
        const binding = fn?.parameters[0]?.name;
        const element = binding && ts.isObjectBindingPattern(binding) ? binding.elements.find(element => (element.propertyName ?? element.name).getText() === spec.prop) : undefined;
        const values = element?.initializer && classValues(element.initializer);
        if (!element || element.dotDotDotToken || !ts.isIdentifier(element.name) || !values) fail(spec, input.file, "class default/declaration changed");
        else {
          defaults.set(inputKey(spec), values); accept(spec, input.file + " default", values);
          // A caller proof is valid only while the incoming string is retained.
          const writes = (node: ts.Node) => {
            if (ts.isIdentifier(node) && lexicalBinding(node) === element) {
              const parent = node.parent;
              if ((ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
                  ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) && (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken))) fail(spec, input.file, "class parameter is reassigned");
            }
            ts.forEachChild(node, writes);
          };
          if (fn?.body) writes(fn.body);
        }
      }
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
        const clause = statement.importClause, named = clause.namedBindings;
        const locals = [...(clause.name ? [clause.name] : []), ...(named && ts.isNamedImports(named) ? named.elements.map(element => element.name) : [])];
        for (const local of locals) if (imported(local, spec.name, spec.file)) imports.set(local.text, spec);
        if (importsModule(source, statement, spec.file) && !spec.defaultExport &&
            (clause.name || (named && ts.isNamedImports(named) && named.elements.some(element => (element.propertyName ?? element.name).text === "default")))) fail(spec, input.file, "unsupported default component import requires explicit audit");
        if (named && ts.isNamespaceImport(named) && ts.isStringLiteral(statement.moduleSpecifier) &&
            path.resolve(SRC, path.dirname(input.file), statement.moduleSpecifier.text).replace(/\.[jt]sx?$/, "") === path.resolve(SRC, spec.file).replace(/\.[jt]sx?$/, "")) fail(spec, input.file, "namespace component reference requires explicit audit");
      }
    }
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && imports.has(node.text)) {
        const spec = imports.get(node.text)!;
        const isReference = imported(node, spec.name, spec.file);
        const parent = node.parent;
        const tag = (opening(parent) || ts.isJsxClosingElement(parent)) && parent.tagName === node;
        if (isReference && !tag && !ts.isImportSpecifier(parent) && !ts.isImportClause(parent)) fail(spec, input.file, "component reference escapes direct JSX");
        if (isReference && tag && opening(parent)) {
          const key = inputKey(spec), site = input.file + ":" + (source.getLineAndCharacterOfPosition(parent.getStart()).line + 1);
          proof.callers.set(key, (proof.callers.get(key) ?? 0) + 1);
          if (parent.attributes.properties.some(ts.isJsxSpreadAttribute)) fail(spec, site, "spread may replace class input");
          const args = parent.attributes.properties.filter((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === spec.prop);
          if (args.length > 1) fail(spec, site, "duplicate class argument");
          if (args.length) accept(spec, site, args[0].initializer && classValues(args[0].initializer));
        }
      }
      // Re-exports would introduce callers outside this bounded import graph.
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        for (const spec of CLASS_INPUTS) {
          const module = path.resolve(SRC, path.dirname(input.file), node.moduleSpecifier.text).replace(/\.[jt]sx?$/, "");
          if (module === path.resolve(SRC, spec.file).replace(/\.[jt]sx?$/, "") && (!node.exportClause ||
              (ts.isNamedExports(node.exportClause) && node.exportClause.elements.some(element => [spec.name, "default"].includes((element.propertyName ?? element.name).text))))) fail(spec, input.file, "component re-export requires explicit audit");
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const spec of CLASS_INPUTS) {
    const key = inputKey(spec);
    if (!defaults.has(key)) fail(spec, spec.file, "missing class default source");
    if (!proof.callers.get(key)) fail(spec, spec.file, "no proven JSX callers");
    if (failed.has(key)) proof.values.delete(key);
  }
  return proof;
}
let productionProof: ClassInputProof | undefined;
function productionClassInputs(): ClassInputProof {
  return productionProof ??= auditClassInputs((function* () {
    for (const file of productionFiles()) yield { file: path.relative(SRC, file).split(path.sep).join("/"), text: readFileSync(file, "utf8") };
  })());
}

function classEffect(values: string[]): string {
  for (const value of values) for (const token of value.split(/\s+/)) {
    if (token === "opacity-100") continue;
    if (/(?:^|:)!?(?:opacity-|text-opacity-|blur|brightness-|contrast-|grayscale|invert|sepia|saturate-|hue-rotate-|filter|mix-blend-|mask-|animate-)/.test(token) ||
        /\[(?:opacity|filter|mix-blend-mode|mask|animation|--)/.test(token)) return "opacity/filter/token class";
  }
  return "";
}

// Enabled, settled state only. Initial/exit fades are excluded from this source
// contrast contract. Keyframes, loops, unknown variants and reduced interactive
// states never pass merely because one target happens to contain opacity: 1.
function motionReason(entries: { name: string; value: ts.Node }[]): string {
  const targets = entries.filter(entry => entry.name === "animate");
  const initial = entries.filter(entry => entry.name === "initial");
  if (entries.some(entry => ["variants", "whileHover", "whileTap", "whileFocus", "whileInView", "whileDrag"].includes(entry.name))) return "unverified motion state/variants";
  if (initial.length && !targets.length) return "motion initial state has no settled target";
  for (const { value } of [...initial, ...targets]) {
    const props = properties(value);
    if (!props) return "unresolved motion target";
    const settled = targets.some(target => target.value === value);
    for (const prop of props) {
      if (prop.name === "opacity") {
        if (!allValues(prop.value, settled ? ["1"] : ["0", "1"])) return "motion opacity is not settled neutral";
      } else if (/^(?:x|y|z|rotate|rotateX|rotateY|rotateZ|scale|scaleX|scaleY|height|width)$/.test(prop.name)) {
        if (settled && !allValues(prop.value, prop.name.startsWith("scale") ? ["1"] : ["height", "width"].includes(prop.name) ? ["0", "auto"] : ["0"])) return "motion transform is not settled neutral";
      } else return "unverified motion property: " + prop.name;
    }
  }
  if (initial.some(entry => properties(entry.value)?.some(prop => prop.name === "opacity")) &&
      targets.some(entry => !alternatives(entry.value).every(branch => properties(branch)?.some(prop => prop.name === "opacity" && allValues(prop.value, ["1"]))))) return "motion target does not restore opacity";
  for (const entry of entries.filter(entry => entry.name === "transition")) {
    const props = properties(entry.value);
    if (!props) return "unresolved motion transition";
    if (props.some(prop => prop.name === "repeat" && !allValues(prop.value, ["0"]))) return "repeating motion has no settled proof";
    if (props.some(prop => !["duration", "delay", "ease", "type", "damping", "stiffness", "mass", "bounce", "repeat"].includes(prop.name))) return "unverified motion transition";
    if (props.some(prop => ["duration", "delay"].includes(prop.name) && alternatives(prop.value).some(value => !Number.isFinite(Number(value.getText())) || Number(value.getText()) < 0))) return "non-finite motion transition";
  }
  return "";
}

/** Explicit ancestor effects, not a complete CSS/caller-ancestry proof.
 * Backgrounds, borders, shadows, layout and backdrop-only filters cannot alter
 * an opaque child's fill. Known wrappers are guarded at their actual content
 * slots below. Class props need complete finite caller proofs; arbitrary CSS
 * and ancestry outside these concrete component contracts still need review.
 */
function ancestorPresentationReason(node: Opening): string {
  const tag = node.tagName.getText(), source = node.getSourceFile();
  const isMotion = /^\w+\.[a-z]+$/.test(tag) && ts.isPropertyAccessExpression(node.tagName) && imported(node.tagName.expression, "motion", "motion/react");
  const wrapper = WRAPPERS.find(item => imported(node.tagName, item.name, item.file));
  const presence = imported(node.tagName, "AnimatePresence", "motion/react");
  const contextProvider = tag === "KidModeContext.Provider" && source.fileName === "components/kidmode/KidModeContext.tsx";
  if (!/^[a-z][a-z0-9-]*$/.test(tag) && !isMotion && !wrapper && !presence && !contextProvider) return "component presentation is unverified";
  const entries: { name: string; value: ts.Node }[] = [];
  for (const attribute of node.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute)) {
      const spread = isMotion ? properties(attribute.expression) : undefined;
      if (!spread) return "JSX spread may override presentation";
      entries.push(...spread);
    } else if (attribute.initializer) entries.push({ name: attribute.name.getText(), value: attribute.initializer });
  }
  for (const entry of entries) {
    if (entry.name === "className") {
      const values = classValues(entry.value);
      if (!values) return "unresolved ancestor class expression";
      const reason = classEffect(values);
      if (reason) return reason;
    }
    if (wrapper?.name === "Modal" && entry.name === "maxWidth") {
      const values = classValues(entry.value);
      if (!values) return "Modal maxWidth must have literal class branches";
      const reason = classEffect(values);
      if (reason) return "Modal maxWidth: " + reason;
      if (dimensionClasses(values)) return "Modal maxWidth must contain only dimension utilities";
    }
    if (entry.name === "style") {
      const props = properties(entry.value);
      if (!props) return "dynamic style/spread/computed key";
      for (const prop of props) {
        if (prop.name.startsWith("--")) return "token override: " + prop.name;
        if (prop.name === "opacity") {
          if (!allValues(prop.value, ["1"])) return "opacity is not neutral";
        } else if (/^(?:(?:Webkit|Moz)?(?:filter|mask|mixBlendMode)|animation|all)/i.test(prop.name) && !allValues(prop.value, ["none", "normal"])) return "filter/compositing/animation: " + prop.name;
      }
    }
  }
  return isMotion ? motionReason(entries) : "";
}
function ancestorReason(node: ts.Node): string {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isJsxElement(parent) || parent.openingElement === node) continue;
    const reason = ancestorPresentationReason(parent.openingElement);
    if (reason) return "ancestor <" + parent.openingElement.tagName.getText() + ">: " + reason;
  }
  return "";
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
  return ancestorReason(node);
}

/** Small audited-source checks, not a component renderer or CSS cascade engine. */
function wrapperProblems(text: string, spec: typeof WRAPPERS[number], proof?: ClassInputProof): string[] {
  const source = ts.createSourceFile(spec.file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (proof) classProofs.set(source, proof);
  const fn = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === spec.name);
  if (!fn) return ["missing wrapper declaration"];
  const binding = fn.parameters[0]?.name;
  if (!binding || !ts.isObjectBindingPattern(binding) || binding.elements.some(element => element.dotDotDotToken) ||
      binding.elements.map(element => element.name.getText()).sort().join() !== [...spec.params].sort().join()) return ["wrapper prop/forwarding contract changed"];
  const problems: string[] = [];
  // Modal's unrestricted string becomes a className. Both its default and every
  // white-label call site's argument must be width-only literal branches.
  for (const element of binding.elements) {
    if (!["maxWidth", "className"].includes(element.name.getText())) continue;
    const defaults = element.initializer && strings(element.initializer);
    if (!defaults || classEffect(defaults)) problems.push("unsafe wrapper class default");
    if (element.name.getText() === "maxWidth" && defaults?.some(value => !/^max-w-[\w.-]+$/.test(value))) problems.push("unverified Modal width default");
  }
  const seen = new Set<string>();
  const classInputKnown = (input: ts.Node, depth = 0): boolean => {
    if (depth > 8) return false;
    for (const node of alternatives(input)) {
      if (ts.isIdentifier(node)) {
        if (imported(node, "cardCls", "lib/tokens.ts")) continue;
        if (spec.name === "Modal" && node.text === "maxWidth") continue;
        if (spec.name === "PlayShell" && node.text === "className") continue;
        return false;
      }
      let valid = true;
      ts.forEachChild(node, child => { if (!classInputKnown(child, depth + 1)) valid = false; });
      if (!valid) return false;
    }
    return true;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxExpression(node) && node.expression && ts.isIdentifier(node.expression) && (spec.slots as readonly string[]).includes(node.expression.text)) {
      seen.add(node.expression.text);
      const reason = ancestorReason(node);
      if (reason) problems.push(reason);
      for (let parent: ts.Node | undefined = node.parent; parent && parent !== fn; parent = parent.parent) {
        if (!ts.isJsxElement(parent)) continue;
        const classes = attr(parent.openingElement, "className")?.initializer;
        if (classes && !classInputKnown(classes)) problems.push("wrapper forwards unverified class input");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(fn);
  if (spec.slots.some(slot => !seen.has(slot))) problems.push("rendered slot contract changed");
  // Modal portals to body, so its own token scope must survive independently
  // of the caller. Its maxWidth input is checked at every imported call site.
  if (spec.name === "Modal" && (!text.includes("return createPortal(") || !text.includes("document.body") || !text.includes('className="arbor-app fixed'))) problems.push("Modal portal/token scope changed");
  return problems;
}

// Examine only the reviewed classes' own rules/state selectors and two named
// keyframes. Arbitrary CSS/cascade remains outside this deliberately small audit.
const AUDITED_CLASSES = ["arbor-app", "arbor-parent", "arbor-play", "comic-panel", "world-tile", "play-pop-in", "sprout-bob"];
const VERIFIED_TOKEN_SELECTORS = new Set([":root", '[data-theme="teal"]', '[data-theme="blue"]', ".arbor-app", ".arbor-parent"]);
function fillDependencies(css: string): Set<string> {
  const graph = new Map<string, Set<string>>();
  for (const declaration of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) {
    const references = graph.get(declaration[1]) ?? new Set<string>();
    for (const reference of declaration[2].matchAll(/var\(\s*(--[\w-]+)/g)) references.add(reference[1]);
    graph.set(declaration[1], references);
  }
  const protectedTokens = new Set(SAFE_FILLS);
  for (const token of protectedTokens) for (const dependency of graph.get(token) ?? []) protectedTokens.add(dependency);
  return protectedTokens;
}
function cssProblems(input: string): string[] {
  const css = input.replace(/\/\*[\s\S]*?\*\//g, "");
  const protectedTokens = fillDependencies(css);
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(";").at(-1)!.trim().split(",").map(selector => selector.trim());
    for (const selector of selectors) {
      // Inspect protected-token declarations in every simple rule, including
      // new/unreviewed classes. Only the separately contrast-tested cascades
      // may redefine approved fills or any transitive var() dependency.
      for (const declaration of match[2].matchAll(/(--[\w-]+)\s*:/g)) {
        if (protectedTokens.has(declaration[1]) && !VERIFIED_TOKEN_SELECTORS.has(selector)) problems.push(selector + ": protected fill override " + declaration[1]);
      }
      const name = AUDITED_CLASSES.find(name => new RegExp("(?:^|[ >+~])\\." + name + "(?:[.#[:][^ >+~]*)?$").test(selector));
      if (!name) continue;
      seen.add(name);
      const inactive = selector === '.world-tile[aria-disabled="true"]';
      for (const declaration of match[2].split(";")) {
        const colon = declaration.indexOf(":");
        if (colon < 0) continue;
        const property = declaration.slice(0, colon).trim(), value = declaration.slice(colon + 1).trim();
        if (inactive && ((property === "opacity" && value === "0.62") || (property === "filter" && value === "grayscale(0.35)"))) continue;
        if (property === "opacity" && value !== "1") problems.push(selector + ": opacity");
        if (/^(?:-(?:webkit|moz)-)?(?:filter|mix-blend-mode|mask|animation)/.test(property) && !["none", "normal"].includes(value)) {
          if (property === "animation" && selector === ".play-pop-in" && value === "play-pop-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both") continue;
          if (property === "animation" && selector === ".sprout-bob" && value === "sprout-bob 3s ease-in-out infinite") continue;
          problems.push(selector + ": " + property);
        }
        // Root/theme/flat approved colour scopes are covered by tokens.contrast;
        // a different reviewed class must never override a label's colour token.
        if (property.startsWith("--arbor-") && ![".arbor-app", ".arbor-parent"].includes(selector)) problems.push(selector + ": token override");
      }
    }
  }
  for (const name of AUDITED_CLASSES) if (!seen.has(name)) problems.push("missing CSS class: " + name);
  for (const name of ["play-pop-in", "sprout-bob"]) {
    const start = css.indexOf("@keyframes " + name);
    const open = css.indexOf("{", start);
    let end = open + 1, depth = 1;
    for (; open >= 0 && end < css.length && depth; end++) {
      if (css[end] === "{") depth++;
      if (css[end] === "}") depth--;
    }
    const frames = css.slice(open + 1, end - 1);
    if (start < 0 || depth || /(?:filter|mask|mix-blend-mode|--[\w-]+)\s*:/.test(frames)) problems.push(name + ": unverified keyframes");
    if (name === "sprout-bob" && /opacity\s*:/.test(frames)) problems.push("sprout-bob: opacity loop");
    if (name === "play-pop-in" && !/100%\s*\{\s*opacity:\s*1;\s*transform:\s*scale\(1\) translateY\(0\);\s*\}/.test(frames)) problems.push("play-pop-in: non-neutral settled state");
  }
  return problems;
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

export function scanWhiteLabels(file: string, text: string, proof?: ClassInputProof): { cases: Case[]; literalCount: number } {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (proof) classProofs.set(source, proof);
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
    const proof = productionClassInputs();
    expect(proof.failures, "Known component class props require complete caller proofs.").toEqual([]);
    const scanned = files.map(file => scanWhiteLabels(path.relative(SRC, file).split(path.sep).join("/"), readFileSync(file, "utf8"), proof));
    const cases = scanned.flatMap(result => result.cases);
    const debt = FROZEN_DEBT.filter(item => !RETIRED_DEBT.includes(keyOf(item)));
    const result = ratchet(cases, debt);
    const report = result.introduced.map(item => item.file + ":" + item.line + " — " + item.reason + " [" + item.fingerprint + "]");
    expect(report, "Prove the fill and ancestor presentation or resolve the consumer; never grow/reset frozen debt.").toEqual([]);
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

  it("rejects scope-dependent subtab fills even with a static app/parent class", () => {
    for (const source of [
      label("var(--arbor-subtab-active)"),
      '<div className="arbor-app arbor-parent">' + label("var(--arbor-subtab-active)") + '</div>',
    ]) expect(ratchet(scan(source), []).introduced).toHaveLength(1);
  });

  it.each([
    'style={{ opacity: .5 }}',
    'className="opacity-50"',
    'className="disabled:opacity-50"',
    'style={{ "--arbor-clay": "white" }}',
    'className="[--arbor-clay:white]"',
    'className="hover:opacity-50"',
    'style={{ filter: "opacity(.5)" }}',
    'style={{ WebkitMaskImage: "linear-gradient(transparent, white)" }}',
    'style={{ animation: "fade 1s" }}',
    'style={parentStyle}',
    'style={{ ...parentStyle }}',
    'style={{ [property]: value }}',

    '{...parentProps}',
  ])("rejects an otherwise safe child under unresolved ancestor %s", attributes => {
    // Include a neutral intermediate element: every ancestor must be checked.
    const source = '<section ' + attributes + '><div className="p-4">' + label("var(--arbor-clay)") + '</div></section>';
    const cases = scan(source);
    expect(cases).toHaveLength(1);
    expect(cases[0].reason).toMatch(/^ancestor /);
    expect(ratchet(cases, []).introduced).toHaveLength(1);
  });

  it("rejects component ancestors whose presentation cannot be proved locally", () => {
    for (const tag of ["Panel", "motion.div"]) {
      const source = '<' + tag + '>' + label("var(--arbor-clay)") + '</' + tag + '>';
      expect(scan(source)[0].reason).toContain("ancestor <" + tag + ">");
    }
  });

  it("accepts neutral static ancestry and full opacity with an opaque child fill", () => {
    const source = '<section className="flex gap-4 bg-white" style={{ opacity: 1, padding: 16 }}><div className="opacity-100">' + label("var(--arbor-clay)") + '</div></section>';
    expect(scan(source)).toHaveLength(1);
    expect(scan(source)[0].reason).toBe("");
  });

  it("guards the actual shared wrapper slots and fixed card chrome", () => {
    const proof = productionClassInputs();
    for (const spec of WRAPPERS) {
      const source = readFileSync(path.join(SRC, spec.file), "utf8");
      expect(wrapperProblems(source, spec, proof), spec.name).toEqual([]);
      const start = source.indexOf("export function " + spec.name);
      const mutateSlot = (replacement: string) => source.slice(0, start) + source.slice(start).replace("{children}", replacement);
      const changed = mutateSlot( '<div style={{ opacity: .5 }}>{children}</div>');
      expect(wrapperProblems(changed, spec, proof), spec.name + " injected opacity").not.toEqual([]);
      const override = mutateSlot( '<div style={{ "--arbor-clay": "white" }}>{children}</div>');
      expect(wrapperProblems(override, spec, proof), spec.name + " injected token").not.toEqual([]);
      if (spec.name === "SectionCard") {
        expect(wrapperProblems(source.replace('className={`${cardCls} p-6`}', 'className={`${cardCls} p-6 opacity-50`}'), spec, proof)).not.toEqual([]);
        expect(wrapperProblems(source.replace('children, action }:', 'children, action, ...rest }:').replace('className={`${cardCls} p-6`}', 'className={`${cardCls} p-6`} {...rest}'), spec, proof)).not.toEqual([]);
      }
      if (spec.name === "Modal") {
        expect(wrapperProblems(source.replace('maxWidth = "max-w-lg"', 'maxWidth = "max-w-lg opacity-50"'), spec, proof)).not.toEqual([]);
        // Both portal layers must settle neutral, not just the dialog itself.
        expect(wrapperProblems(source.replace('animate={{ opacity: 1 }}', 'animate={{ opacity: .5 }}'), spec, proof)).not.toEqual([]);
        expect(wrapperProblems(source.replace('animate={{ opacity: 1, scale: 1', 'animate={{ opacity: .5, scale: 1'), spec, proof)).not.toEqual([]);
      }
    }
    const tokens = ts.createSourceFile("lib/tokens.ts", readFileSync(path.join(SRC, "lib/tokens.ts"), "utf8"), ts.ScriptTarget.Latest, true);
    let found: string[] | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText() === "cardCls") found = strings(node.initializer);
      ts.forEachChild(node, visit);
    };
    visit(tokens);
    expect(found).toEqual([CARD_CLASSES]);
    const kit = readFileSync(path.join(SRC, "components/ui/kit.tsx"), "utf8");
    expect(forwardsCardClasses(kit)).toBe(true);
    expect(forwardsCardClasses(kit.replace('export { PASTEL, cardCls } from "../../lib/tokens"', 'export { PASTEL, cardCls } from "../../lib/unreviewed"'))).toBe(false);
    expect(classEffect([CARD_CLASSES])).toBe("");
    expect(classEffect([CARD_CLASSES + " opacity-50"])).not.toBe("");
  });

  it("guards audited CSS/state rules, settled pop-in and transform-only bob", () => {
    const css = readFileSync(path.join(SRC, "index.css"), "utf8");
    expect(cssProblems(css)).toEqual([]);
    for (const changed of [
      css.replace(".comic-panel {", ".comic-panel { opacity: .5;"),
      css.replace(".comic-panel {", ".comic-panel { --arbor-clay: white;"),
      css + "\n.world-tile:hover { opacity: .5; }",
      css.replace('.world-tile[aria-disabled="true"] {', '.world-tile {'),
      css.replace(".comic-panel {", ".comic-panel { -webkit-filter: opacity(.5);"),
      css + "\n.arbor-app:hover { --arbor-clay: white; }",
      css.replace("100% { opacity: 1; transform: scale(1)", "100% { opacity: .5; transform: scale(1)"),
      css.replace("50%      { transform: translateY(-6px)", "50%      { opacity: .5; transform: translateY(-6px)"),
    ]) expect(cssProblems(changed)).not.toEqual([]);
  });

  it("fails unresolved identifiers, template fragments and conditional arms", () => {
    for (const expression of ['runtimeClass', '`p-4 ${runtimeClass}`', 'enabled ? "p-4" : runtimeClass', 'getClass("p-4")']) {
      expect(scan('<div className={' + expression + '}>' + label("var(--arbor-clay)") + '</div>')[0].reason, expression).not.toBe("");
    }
    for (const extra of ['const outer = "opacity-50";', 'const outer = enabled ? "p-4" : "opacity-50";', 'const outer = "[--arbor-clay:white]";']) {
      expect(scan(extra + '<div className={outer}>' + label("var(--arbor-clay)") + '</div>')[0].reason).not.toBe("");
    }
  });

  it("resolves finite branches and audited cardCls without crossing shadowed bindings", () => {
    const body = '<div className={outer}>' + label("var(--arbor-clay)") + '</div>';
    for (const source of [
      'const outer = "p-4"; function Example(outer: string) { return ' + body + '; }',
      'const outer = "p-4"; function Example({outer}: Props) { return ' + body + '; }',
      'function Unrelated(){ const outer = "p-4"; } function Example(){ return ' + body + '; }',
      'const outer = "p-4"; function Example(){ if(flag) { var outer = runtimeClass; } return ' + body + '; }',
      'import {cardCls as outer} from "./lib/tokens"; function Example(outer: string){return ' + body + ';}',
    ]) expect(scan(source)[0].reason, source).not.toBe("");
    for (const source of [
      'const outer = enabled ? "p-4" : "p-6"; ' + body,
      'const outer = "opacity-50"; function Example(){ const outer = "p-4"; return ' + body + '; }',
      'import {cardCls} from "./components/ui/kit"; <div className={`${cardCls} ${enabled ? "p-4" : "p-6"}`}>' + label("var(--arbor-clay)") + '</div>',
    ]) expect(scan(source)[0].reason, source).toBe("");
  });

  it("proves known class props from their actual defaults and every import-proven caller", () => {
    const declarations = CLASS_INPUTS.map(spec => ({ file: spec.file, text: readFileSync(path.join(SRC, spec.file), "utf8") }));
    const prefix = 'import {HeroAvatar} from "./components/ui/HeroAvatar"; import {PlayShell} from "./components/ui/playkit"; import {Modal} from "./components/ui/Modal"; <><HeroAvatar/><PlayShell/><Modal/></>; ';
    const audit = (text: string) => auditClassInputs([...declarations, {file: "fixture.tsx", text: prefix + text}]);
    const neutral = audit('<HeroAvatar className={wide ? "p-4" : "p-6"}/>; <PlayShell className="p-4"/>; <Modal maxWidth="max-w-lg max-sm:h-full max-sm:max-h-none"/>;');
    expect(neutral.failures).toEqual([]);
    const hero = declarations.find(input => input.file === "components/ui/HeroAvatar.tsx")!;
    expect(scanWhiteLabels(hero.file, hero.text).cases.some(item => item.reason.includes("unresolved ancestor"))).toBe(true);
    expect(scanWhiteLabels(hero.file, hero.text, neutral).cases.every(item => !item.reason)).toBe(true);
    for (const caller of [
      '<HeroAvatar className={runtimeClass}/>;',
      '<HeroAvatar className={`p-4 ${runtimeClass}`}/>;',
      '<HeroAvatar className={ok ? "p-4" : runtimeClass}/>;',
      '<HeroAvatar className="opacity-50"/>;',
      '<HeroAvatar {...props}/>;',
      'const Alias = HeroAvatar; <Alias/>;',
      'function Forward({className}: Props){ return <PlayShell className={className}/>; }',
      'const className = "p-4"; function Forward(className: string){ return <PlayShell className={className}/>; }',
      '<Modal maxWidth={runtimeWidth}/>;',
      '<Modal maxWidth="max-w-lg opacity-50"/>;',
    ]) expect(audit(caller).failures, caller).not.toEqual([]);
    const reassigned = declarations.map(input => input.file === hero.file ? { ...input, text: input.text.replace("const badge =", 'className = "opacity-50"; const badge =') } : input);
    expect(auditClassInputs([...reassigned, {file: "fixture.tsx", text: prefix}]).failures.some(problem => problem.includes("reassigned"))).toBe(true);
    const unsafeHero = audit('<HeroAvatar className={runtimeClass}/>;');
    expect(scanWhiteLabels(hero.file, hero.text, unsafeHero).cases.some(item => item.reason.includes("unresolved ancestor"))).toBe(true);
  });

  it("audits actual default component aliases instead of skipping their class inputs", () => {
    const declarations = CLASS_INPUTS.map(spec => ({ file: spec.file, text: readFileSync(path.join(SRC, spec.file), "utf8") }));
    const prefix = 'import {HeroAvatar} from "./components/ui/HeroAvatar"; import {PlayShell} from "./components/ui/playkit"; import {Modal} from "./components/ui/Modal"; <><HeroAvatar/><PlayShell/><Modal/></>; ';
    const audit = (caller: string) => auditClassInputs([...declarations, { file: "fixture.tsx", text: prefix + caller }]);
    const hero = declarations.find(input => input.file === "components/ui/HeroAvatar.tsx")!;
    const baselineCallers = audit("").callers.get(inputKey(CLASS_INPUTS[0])) ?? 0;
    for (const declaration of [
      'import Hero from "./components/ui/HeroAvatar"; ',
      'import {default as Hero} from "./components/ui/HeroAvatar"; ',
    ]) {
      const neutral = audit(declaration + '<Hero className={wide ? "p-4" : "p-6"}/>;');
      expect(neutral.failures, declaration).toEqual([]);
      expect(neutral.callers.get(inputKey(CLASS_INPUTS[0]))).toBe(baselineCallers + 1);
      expect(scanWhiteLabels(hero.file, hero.text, neutral).cases.every(item => !item.reason)).toBe(true);
      for (const classes of ['runtimeClass', '"opacity-50"', '"p-4 " + runtimeClass']) {
        const unsafe = audit(declaration + '<Hero className={' + classes + '}/>;');
        expect(unsafe.failures, declaration + classes).toContainEqual(expect.stringContaining("HeroAvatar.className: unresolved or unsafe"));
        expect(unsafe.values.has(inputKey(CLASS_INPUTS[0]))).toBe(false);
        expect(scanWhiteLabels(hero.file, hero.text, unsafe).cases.some(item => item.reason.includes("unresolved ancestor"))).toBe(true);
      }
    }
    expect(audit('import Dialog from "./components/ui/Modal"; <Dialog maxWidth="max-w-lg"/>;').failures).toEqual([]);
    expect(scan('import Dialog from "./components/ui/Modal"; <Dialog>' + label("var(--arbor-clay)") + '</Dialog>')[0].reason).toBe("");
  });

  it("fails unsupported defaults, changed default declarations and default re-exports", () => {
    const declarations = CLASS_INPUTS.map(spec => ({ file: spec.file, text: readFileSync(path.join(SRC, spec.file), "utf8") }));
    const prefix = 'import {HeroAvatar} from "./components/ui/HeroAvatar"; import {PlayShell} from "./components/ui/playkit"; import {Modal} from "./components/ui/Modal"; <><HeroAvatar/><PlayShell/><Modal/></>; ';
    const audit = (inputs: SourceInput[], caller: string) => auditClassInputs([...inputs, { file: "fixture.tsx", text: prefix + caller }]);
    for (const declaration of ['import Play from "./components/ui/playkit"; <Play/>;', 'import {default as Play} from "./components/ui/playkit"; <Play/>;']) {
      expect(audit(declarations, declaration).failures).toContainEqual(expect.stringContaining("unsupported default component import"));
    }
    for (const spec of CLASS_INPUTS.filter(spec => spec.defaultExport)) {
      const changed = declarations.map(input => input.file === spec.file
        ? { ...input, text: input.text.replace("export default " + spec.name + ";", "const Other = runtimeComponent; export default Other;") }
        : input);
      expect(changed.find(input => input.file === spec.file)?.text).not.toBe(declarations.find(input => input.file === spec.file)?.text);
      expect(audit(changed, "").failures).toContainEqual(expect.stringContaining("default export must identify the audited declaration"));
    }
    expect(audit(declarations, 'export {default as Hero} from "./components/ui/HeroAvatar";').failures)
      .toContainEqual(expect.stringContaining("component re-export requires explicit audit"));
  });

  it.each([
    ["SectionCard", "./components/ui/kit", ""],
    ["Modal", "./components/ui/Modal", ""],
    ["PlayShell", "./components/ui/playkit", ""],
    ["KidModeProvider", "./components/kidmode/KidModeContext", ""],
    ["motion", "motion/react", ".div"],
    ["AnimatePresence", "motion/react", ""],
  ])("requires the actual %s import binding for wrapper approval", (name, module, member) => {
    for (const local of [name, "Reviewed"]) {
      const prefix = 'import {' + name + (local === name ? "" : " as " + local) + '} from "' + module + '"; ';
      const body = '<' + local + member + '>' + label("var(--arbor-clay)") + '</' + local + member + '>';
      expect(scan(prefix + 'function Example(){ return ' + body + '; }')[0].reason, prefix).toBe("");
      for (const declaration of [
        'function Example({' + local + '}){ return ',
        'function Example(' + local + '){ return ',
        'function Example(){ const ' + local + ' = runtimeComponent; return ',
      ]) {
        expect(scan(prefix + declaration + body + '; }')[0].reason, prefix + declaration).toContain("component presentation is unverified");
      }
    }
  });

  it("rejects every approved fill alias and transitive dependency outside verified cascades", () => {
    const css = readFileSync(path.join(SRC, "index.css"), "utf8");
    for (const token of fillDependencies(css)) {
      expect(cssProblems(css.replace(".comic-panel {", ".comic-panel { " + token + ": white;")), token).not.toEqual([]);
    }
    expect(cssProblems(css + "\n.new-surface { --gradient-cta: white; }")).not.toEqual([]);
    const dependency = css + "\n:root { --gradient-cta: var(--reviewed-stop); --reviewed-stop: #1558c0; }\n.comic-panel { --reviewed-stop: white; }";
    expect(cssProblems(dependency).some(problem => problem.includes("--reviewed-stop"))).toBe(true);
  });
  it("validates every literal Modal maxWidth branch and actual import provenance", () => {
    const prefix = 'import { Modal } from "./components/ui/Modal"; ';
    for (const arg of ['"max-w-lg opacity-50"', 'wide ? "max-w-xl" : "opacity-50"', '"[--arbor-clay:white]"', 'runtimeWidth']) {
      expect(scan(prefix + '<Modal maxWidth={' + arg + '}>' + label("var(--arbor-clay)") + '</Modal>')[0].reason).not.toBe("");
    }
    expect(scan(prefix + '<Modal maxWidth={wide ? "max-w-xl" : "max-w-lg"}>' + label("var(--arbor-clay)") + '</Modal>')[0].reason).toBe("");
    expect(scan('import { SectionCard } from "./unreviewed"; <SectionCard>' + label("var(--arbor-clay)") + '</SectionCard>')[0].reason).not.toBe("");
    expect(scan('import { SectionCard } from "./components/ui/kit"; <SectionCard>' + label("var(--arbor-clay)") + '</SectionCard>')[0].reason).toBe("");
  });

  it("accepts only known neutral settled motion, including local branch props", () => {
    const prefix = 'import { motion } from "motion/react"; ';
    const wrap = (props: string, locals = "") => scan(prefix + locals + '<motion.div ' + props + '>' + label("var(--arbor-clay)") + '</motion.div>')[0].reason;
    expect(wrap('initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}')).toBe("");
    expect(wrap('{...props}', 'const props = reduce ? { initial: {opacity: 0}, animate: {opacity: 1} } : { initial: {opacity: 0, y: 12}, animate: {opacity: 1, y: 0} };')).toBe("");
    for (const props of [
      'initial={{ opacity: 0 }} animate={{ opacity: .5 }}',
      'initial={{ opacity: 0 }} animate={{ x: 0 }}',
      'initial={{ opacity: 0 }}',
      'animate={{ opacity: [0, 1] }}',
      'animate={{ opacity: 1 }} transition={{ repeat: Infinity }}',
      'animate="visible" variants={variants}',
      'animate={{ opacity: 1 }} whileHover={{ opacity: .5 }}',
      'animate={{ opacity: 1 }} whileTap={{ opacity: .5 }}',
      'animate={{ opacity: 1, "--arbor-clay": "white" }}',
      'animate={{ opacity: 1 }} style={{ opacity: .5 }}',
    ]) expect(wrap(props), props).not.toBe("");
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
