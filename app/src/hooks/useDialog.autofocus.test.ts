import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

/** Real production React/ReactDOM ordering in the existing XML Node host.
 * The actual hook runs; registerDialog is a recording boundary. This proves
 * opener identity at registration, not browser focus/layout acceptance. */
function mountedAutofocusProof() {
  const fs = require("node:fs"), ts = require("typescript");
  const { DOMParser } = require("@xmldom/xmldom");
  const doc = new DOMParser().parseFromString('<html><head></head><body><button id="first"></button><button id="second"></button><div id="root"></div></body></html>', 'text/html');
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
  const view = { document: doc, HTMLIFrameElement: class {}, HTMLElement: class {}, addEventListener() {}, removeEventListener() {}, navigator: { userAgent: "node-dialog-proof" }, location: { protocol: "http:" } };
  Object.assign(globalThis, { document: doc, window: view }); doc.defaultView = view; doc.activeElement = doc.body;
  const React = require("react"), { createRoot } = require("react-dom/client"), { flushSync } = require("react-dom");
  const registrations = [];
  let disposals = 0;
  const module = { exports: {} as { useDialog: (options: unknown) => { ref: unknown } } };
  const source = ts.transpileModule(fs.readFileSync("src/hooks/useDialog.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => {
    if (name === "react") return React;
    if (name === "../lib/dialogStack") return { registerDialog: options => {
      registrations.push({ active: doc.activeElement, opener: options.returnFocus(), root: options.root });
      return { close() {}, dispose() { disposals++; } };
    } };
    throw new Error("UNMOCKED_IMPORT");
  }, module, module.exports);
  function Sheet({ open }) {
    const { ref } = module.exports.useDialog({ open, onClose() {} });
    return open ? React.createElement("div", { ref }, React.createElement("input", { autoFocus: true })) : null;
  }
  const container = doc.getElementById("root"), first = doc.getElementById("first"), second = doc.getElementById("second");
  const root = createRoot(container);
  try {
    flushSync(() => root.render(React.createElement(Sheet, { open: false })));
    first.focus();
    flushSync(() => root.render(React.createElement(Sheet, { open: true })));
    const firstInput = container.getElementsByTagName("input")[0];
    const firstRegistration = registrations[0];
    flushSync(() => root.render(React.createElement(Sheet, { open: true })));
    const stableAcrossRender = registrations.length === 1;
    flushSync(() => root.render(React.createElement(Sheet, { open: false })));
    second.focus();
    flushSync(() => root.render(React.createElement(Sheet, { open: true })));
    const secondInput = container.getElementsByTagName("input")[0];
    const proof = {
      autofocusBeforeRegistration: firstRegistration?.active === firstInput && registrations[1]?.active === secondInput,
      firstOpenerPreserved: firstRegistration?.opener === first,
      reopenedFromLatestOpener: registrations[1]?.opener === second,
      stableAcrossRender, registrations: registrations.length,
    };
    root.unmount();
    process.stdout.write(JSON.stringify({ ...proof, disposals }));
  } catch (error) { root.unmount(); throw error; }
}

describe("useDialog opener identity across mounted React autofocus", () => {
  it("captures each opener before the real child autoFocus commit and keeps one registration", () => {
    const output = execFileSync(process.execPath, ["--input-type=commonjs", "-e", `(${mountedAutofocusProof.toString()})()`], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", MODEL_PROVIDER: "mock", MEMORY_ADAPTER: "local" }, timeout: 10_000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    expect(JSON.parse(output)).toEqual({ autofocusBeforeRegistration: true, firstOpenerPreserved: true, reopenedFromLatestOpener: true, stableAcrossRender: true, registrations: 2, disposals: 2 });
  });
});
