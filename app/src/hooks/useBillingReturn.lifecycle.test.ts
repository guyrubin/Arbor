import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/** Real production React and both billing hooks, with a minimal Node DOM and
 * deterministic clock. Only auth, translations, toast display and API I/O are
 * synthetic; this is lifecycle evidence, not a real payment or browser claim. */
async function mountedReturnProof() {
  const fs = require("node:fs"), ts = require("typescript");
  const { DOMParser } = require("@xmldom/xmldom");
  const doc = new DOMParser().parseFromString('<html><head></head><body><div id="root"></div></body></html>', "text/html");
  doc.body = doc.getElementsByTagName("body")[0]; doc.head = doc.getElementsByTagName("head")[0];
  const attach = el => {
    el.addEventListener = el.removeEventListener = () => {};
    el.style = { setProperty() {}, removeProperty() {} };
    el.getRootNode = () => doc; el.ownerDocument = doc;
    return el;
  };
  const create = doc.createElement.bind(doc), createNS = doc.createElementNS.bind(doc);
  doc.createElement = name => attach(create(name)); doc.createElementNS = (namespace, name) => attach(createNS(namespace, name));
  Array.from(doc.getElementsByTagName("*")).forEach(attach);
  doc.addEventListener = doc.removeEventListener = () => {};
  const location = { protocol: "https:", pathname: "/", search: "?billing=success&app_user_id=another-account&keep=1", hash: "#/overview" };
  const view = { document: doc, HTMLIFrameElement: class {}, HTMLElement: class {}, addEventListener() {}, removeEventListener() {}, navigator: { userAgent: "node-billing-return-proof" }, location,
    history: { replaceState(_state, _title, target) { const u = new URL(target, "https://arbor.example.test"); Object.assign(location, { pathname: u.pathname, search: u.search, hash: u.hash }); } },
  };
  let now = 0, timerId = 0;
  const timers = new Map();
  const storage = new Map();
  Object.assign(globalThis, {
    document: doc, window: view,
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout: (run, delay = 0) => { const id = ++timerId; timers.set(id, { due: now + delay, run }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  doc.defaultView = view; doc.activeElement = doc.body;
  Date.now = () => Date.parse("2026-11-08T00:00:00.000Z") + now;
  const React = require("react"), { createRoot } = require("react-dom/client"), { flushSync } = require("react-dom");
  const state = { uid: "synthetic-owner-a", lang: "en" };
  const requests = [], messages = [];
  const api = { entitlement: signal => new Promise(resolve => requests.push({ signal, resolve, uid: state.uid })) };
  const load = (file, modules) => {
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} as any };
    new Function("require", "module", "exports", code)(name => {
      if (!Object.hasOwn(modules, name)) throw new Error(`UNMOCKED_IMPORT:${name}`);
      return modules[name];
    }, module, module.exports);
    return module.exports;
  };
  const entitlement = load("src/hooks/useEntitlement.ts", { react: React, "../lib/api": { api } });
  const lifecycle = load("src/hooks/useBillingReturn.ts", {
    react: React,
    "../context/AuthContext": { useAuth: () => ({ user: { uid: state.uid } }) },
    "../context/LanguageContext": { useLanguage: () => { const lang = state.lang; return { t: key => `${lang}:${key}` }; } },
    "../context/ToastContext": { useToast: () => ({ toast: (message, type, action) => messages.push({ message, type, action }) }) },
    "./useEntitlement": entitlement,
  });
  const trial = { ...entitlement.FALLBACK_FREE, plan: "plus", source: "trial", provider: "none", status: "in_trial" };
  const paid = { ...trial, source: "store", provider: "stripe", status: "active" };
  const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); flushSync(() => {}); };
  const advance = async ms => {
    const target = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= target).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due; timers.delete(next[0]); next[1].run(); await flush();
    }
    now = target; await flush();
  };
  function Probe() { lifecycle.useBillingReturn(); return null; }
  const root = createRoot(doc.getElementById("root"));
  const render = () => flushSync(() => root.render(React.createElement(Probe)));
  const proof = {} as Record<string, boolean | number>;
  try {
    entitlement.setEntitlementOwner(state.uid);
    render(); await flush();
    proof.queryIsOnlyTrigger = requests.length === 1 && requests[0].uid === "synthetic-owner-a" && location.search === "?keep=1" && location.hash === "#/overview";
    requests[0].resolve(trial); await flush();
    proof.trialDoesNotConfirm = !messages.some(message => message.type === "success");
    await advance(2500);
    state.lang = "he"; render(); await flush();
    requests[1].resolve(paid); await flush();
    proof.localePreservesPoll = requests.length === 2 && messages.filter(message => message.type === "success").length === 1 && messages.at(-1).message === "he:pw.activated";

    // A fresh return stays pending through six trial answers, then Retry must
    // keep polling until the delayed webhook's paid answer appears.
    flushSync(() => root.render(null));
    entitlement.markBillingReturn(); render(); await flush();
    for (let i = 0; i < 6; i++) {
      requests.at(-1).resolve(trial); await flush();
      if (i < 5) await advance(2500);
    }
    const pending = messages.at(-1);
    proof.pendingHasRetry = pending.message === "he:pw.stillConfirming" && typeof pending.action?.onClick === "function";
    const beforeRetry = requests.length;
    pending.action.onClick(); await flush();
    requests.at(-1).resolve(trial); await flush(); await advance(2500);
    requests.at(-1).resolve(paid); await flush();
    proof.retryKeepsPolling = requests.length === beforeRetry + 2 && messages.at(-1).message === "he:pw.activated";

    // The old account's retained Retry must be inert after the auth owner moves.
    state.uid = "synthetic-owner-b"; entitlement.setEntitlementOwner(state.uid); render(); await flush();
    const beforeStaleRetry = requests.length;
    pending.action.onClick(); await flush();
    proof.staleRetryCannotStartForNewOwner = requests.length === beforeStaleRetry;

    // A pending A return cannot confirm from A's late response after B signs in.
    flushSync(() => root.render(null));
    state.uid = "synthetic-owner-a"; entitlement.setEntitlementOwner(state.uid);
    entitlement.markBillingReturn(); render(); await flush();
    const old = requests.at(-1), successes = messages.filter(message => message.type === "success").length;
    state.uid = "synthetic-owner-b"; entitlement.setEntitlementOwner(state.uid); render(); await flush();
    old.resolve(paid); await flush(); await advance(15_000);
    proof.ownerChangeCancelsConfirmation = old.signal.aborted && messages.filter(message => message.type === "success").length === successes && entitlement.cachedEntitlement() === null;

    flushSync(() => root.render(null)); location.search = "?billing=cancel";
    const beforeCancel = requests.length, beforeCancelMessages = messages.length;
    render(); await flush();
    proof.cancelDoesNotClaimSuccess = requests.length === beforeCancel && messages.length === beforeCancelMessages;
    process.stdout.write(JSON.stringify({ ok: true, ...proof }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), ...proof }));
  } finally {
    root.unmount(); entitlement.__resetEntitlementCache();
  }
}

describe("mounted web checkout return lifecycle", () => {
  it("survives a locale change, retries delayed confirmation, and cancels old-account callbacks", () => {
    const output = execFileSync(process.execPath, ["--input-type=commonjs", "-e", `(${mountedReturnProof.toString()})()`], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production" }, timeout: 10_000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    expect(JSON.parse(output)).toEqual({
      ok: true, queryIsOnlyTrigger: true, trialDoesNotConfirm: true, localePreservesPoll: true,
      pendingHasRetry: true, retryKeepsPolling: true, staleRetryCannotStartForNewOwner: true,
      ownerChangeCancelsConfirmation: true, cancelDoesNotClaimSuccess: true,
    });
  });
});
