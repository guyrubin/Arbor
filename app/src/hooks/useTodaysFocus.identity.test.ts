import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

/** Real production React/ReactDOM, with the installed XML DOM used only as a
 * Node host. Actual hook and PracticeFocus source run with closed I/O seams.
 * This proves the parent/child effect cycle; it is not browser acceptance. */
function mountedProductionProof() {
  const fs = require("node:fs"), ts = require("typescript");
  const { DOMParser } = require("@xmldom/xmldom");
  const doc = new DOMParser().parseFromString('<html><head></head><body><div id="root"></div></body></html>', 'text/html');
  doc.body = doc.getElementsByTagName("body")[0]; doc.head = doc.getElementsByTagName("head")[0];
  const attach = el => {
    el.addEventListener = el.removeEventListener = () => {};
    el.style = { setProperty() {}, removeProperty() {} };
    el.getRootNode = () => doc; el.ownerDocument = doc;
    el.focus = () => { doc.activeElement = el; };
    return el;
  };
  const create = doc.createElement.bind(doc), createNS = doc.createElementNS.bind(doc);
  doc.createElement = name => attach(create(name)); doc.createElementNS = (namespace, name) => attach(createNS(namespace, name));
  Array.from(doc.getElementsByTagName("*")).forEach(attach);
  doc.addEventListener = doc.removeEventListener = () => {};
  const view = { document: doc, HTMLIFrameElement: class {}, HTMLElement: class {}, addEventListener() {}, removeEventListener() {}, navigator: { userAgent: "node-hook-proof" }, location: { protocol: "http:" } };
  Object.assign(globalThis, { document: doc, window: view }); doc.defaultView = view; doc.activeElement = doc.body;
  const React = require("react"), { createRoot } = require("react-dom/client"), { flushSync } = require("react-dom");
  const DAY = "2026-10-10";
  const environment = { childProfile: { id: "synthetic-a", name: "Synthetic", age: 4 }, behaviorLogs: [{}, {}], playLogs: [], milestones: [], actionLoop: [] };
  const language = { uiLang: "en" };
  const auth = { user: { uid: "synthetic-owner" } };
  const reads: Array<(value: unknown) => void> = [], fetches: Array<(value: unknown) => void> = [];
  let fetchCount = 0, renderCount = 0, fatal = false, hookOutput, mirror, mirrorPending = true, rerender, open;
  const modules = {
    react: React,
    "firebase/firestore": { doc: (_db, path) => path, getDoc: () => new Promise(resolve => reads.push(resolve)), setDoc: async () => {} },
    "../lib/firebase": { db: {}, firebaseEnabled: true },
    "../context/AuthContext": { useAuth: () => auth },
    "../context/LanguageContext": { useLanguage: () => language },
    "../lib/api": { authHeaders: async () => ({}) },
    "../lib/kpiEvents": { trackLoopContinued() {} },
    "../practice/signals": { dayKey: () => DAY }, "../ai/journalContext": { WHY_MAX: 240 },
  };
  const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const hookModule = { exports: {} as { useTodaysFocus: (...args: unknown[]) => unknown } };
  new Function("require", "module", "exports", "fetch", compile(fs.readFileSync("src/hooks/useTodaysFocus.ts", "utf8")))(name => {
    if (!Object.hasOwn(modules, name)) throw new Error("UNMOCKED_IMPORT");
    return modules[name];
  }, hookModule, hookModule.exports, () => { fetchCount++; return new Promise(resolve => fetches.push(resolve)); });
  const nowSource = fs.readFileSync("src/components/companion/NowView.tsx", "utf8");
  const parsed = ts.createSourceFile("NowView.tsx", nowSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bridge = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "PracticeFocus");
  if (!bridge) throw new Error("PRACTICE_FOCUS_SOURCE_MISSING");
  // Execute the real, non-exported bridge rather than rewriting its effect.
  const PracticeFocus = new Function("useArbor", "useMemo", "useEffect", "useTodaysFocus", "focusSignalsForNow", compile(bridge.getText(parsed)) + "\nreturn PracticeFocus;")(
    () => environment, React.useMemo, React.useEffect,
    (...args) => { hookOutput = hookModule.exports.useTodaysFocus(...args); return hookOutput; },
    input => ({ count: input.behaviorLogs.length, topTrigger: "" }),
  );
  let resolveLazy;
  const Lazy = React.lazy(() => new Promise(resolve => { resolveLazy = resolve; }));
  function Parent() {
    if (++renderCount > 100) throw new Error("UNBOUNDED_PARENT_EFFECT_CYCLE");
    const [focus, setFocus] = React.useState(null), [pending, setPending] = React.useState(true);
    const [, setEpoch] = React.useState(0), [show, setShow] = React.useState(false);
    mirror = focus; mirrorPending = pending;
    rerender = () => setEpoch(value => value + 1); open = () => setShow(true);
    return React.createElement(React.Fragment, null,
      React.createElement(PracticeFocus, { journal: undefined, onFocus: setFocus, onPending: setPending }),
      show && React.createElement(React.Suspense, { fallback: React.createElement("p", null, "loading") }, React.createElement(Lazy)));
  }
  const container = doc.getElementById("root");
  const root = createRoot(container, { onUncaughtError: () => { fatal = true; } });
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    for (let n = 0; n < 400; n++) { if (fatal) throw new Error("UNBOUNDED_PARENT_EFFECT_CYCLE"); if (predicate()) return; await delay(2); }
    throw new Error("PROOF_READINESS_TIMEOUT");
  };
  const cache = (text, lang = "en") => ({ text, dateKey: DAY, lang, generatedAt: `${DAY}T08:00:00Z`, inputsUsed: { momentCount: 8 } });
  const answer = (index, record) => reads[index]({ exists: () => true, data: () => record });
  (async () => {
    const proof = {} as Record<string, boolean | number>;
    try {
      root.render(React.createElement(Parent)); await until(() => reads.length === 1);
      answer(0, cache("First cached focus")); await until(() => mirror?.text === "First cached focus" && !mirrorPending);
      const first = mirror, firstRenders = renderCount;
      await delay(30);
      proof.settledAfterCache = !fatal && renderCount === firstRenders;
      flushSync(open); await until(() => typeof resolveLazy === "function");
      resolveLazy({ default: () => React.createElement("textarea", { "data-testid": "composer" }) });
      await until(() => container.getElementsByTagName("textarea").length === 1);
      proof.siblingLazyCommits = true;
      flushSync(rerender); await delay(20); proof.sameUnrelatedIdentity = mirror === first;
      environment.behaviorLogs = [{}]; flushSync(rerender);
      await until(() => mirror !== first && mirror?.inputsUsed?.momentCount === 1);
      const recounted = mirror; flushSync(rerender); await delay(20); proof.sameRecountedIdentity = mirror === recounted;
      proof.liveCountReconciled = recounted.inputsUsed.momentCount === 1;
      const generation = hookOutput.regenerate(); await until(() => fetches.length === 1 && mirrorPending);
      proof.sameIdentityDuringLoading = mirror === recounted;
      fetches[0]({ ok: true, json: async () => ({ text: "New generated focus", inputsUsed: { momentCount: 1 } }) });
      await generation; await until(() => mirror?.text === "New generated focus" && !mirrorPending);
      proof.actualDataInvalidates = mirror !== recounted;
      const generated = mirror; environment.behaviorLogs = []; flushSync(rerender);
      await until(() => mirror !== generated && mirror?.inputsUsed === undefined);
      proof.zeroCountDropsProvenance = true;
      environment.childProfile = { ...environment.childProfile, id: "synthetic-b" }; flushSync(rerender);
      await until(() => reads.length === 2 && mirror === null && mirrorPending);
      proof.childLoadingDropsOldFocus = true;
      answer(1, cache("New child focus")); await until(() => mirror?.text === "New child focus" && !mirrorPending);
      language.uiLang = "he"; flushSync(rerender);
      await until(() => reads.length === 3 && mirror === null && mirrorPending);
      proof.languageLoadingDropsOldFocus = true;
      answer(2, cache("Synthetic Hebrew focus", "he")); await until(() => mirror?.lang === "he" && !mirrorPending);
      auth.user.uid = "synthetic-owner-b"; flushSync(rerender);
      await until(() => reads.length === 4 && mirror === null && mirrorPending);
      proof.ownerOnlyLoadingDropsOldFocus = true;
      answer(3, cache("Synthetic new owner focus", "he")); await until(() => mirror?.text === "Synthetic new owner focus" && !mirrorPending);
      const settled = renderCount; await delay(30);
      proof.settledAfterInvalidation = !fatal && renderCount === settled;
      proof.fetches = fetchCount; proof.renders = renderCount;
      process.stdout.write(JSON.stringify({ ok: true, ...proof }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ ok: false, failure: error instanceof Error && ["UNBOUNDED_PARENT_EFFECT_CYCLE", "PROOF_READINESS_TIMEOUT"].includes(error.message) ? error.message : "PROOF_FAILED", renders: renderCount }));
    } finally { root.unmount(); }
  })();
}

describe("Today's Focus identity across the real parent/child feedback effect", () => {
  it("settles, lets a sibling lazy retry commit, and invalidates only for real focus/scope/count changes", () => {
    const output = execFileSync(process.execPath, ["--input-type=commonjs", "-e", `(${mountedProductionProof.toString()})()`], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", MODEL_PROVIDER: "mock", MEMORY_ADAPTER: "local" }, timeout: 10_000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    const proof = JSON.parse(output);
    expect(proof.ok, JSON.stringify(proof)).toBe(true);
    expect(proof).toMatchObject({ ok: true, settledAfterCache: true, siblingLazyCommits: true, sameUnrelatedIdentity: true, sameRecountedIdentity: true, liveCountReconciled: true, zeroCountDropsProvenance: true, sameIdentityDuringLoading: true, actualDataInvalidates: true, childLoadingDropsOldFocus: true, languageLoadingDropsOldFocus: true, ownerOnlyLoadingDropsOldFocus: true, settledAfterInvalidation: true, fetches: 1 });
    expect(proof.renders).toBeLessThan(30);
  });
});
