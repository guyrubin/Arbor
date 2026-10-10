import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

/** The actual component, hooks and React commits run in the existing Node XML
 * host. This proves callback/ref lifecycle, not browser layout or focus order;
 * exact CI report-close-return remains the rendered acceptance gate. */
async function mountedCloseProof() {
  const fs = require("node:fs"), ts = require("typescript");
  const { DOMParser } = require("@xmldom/xmldom");
  const doc = new DOMParser().parseFromString('<html><head></head><body></body></html>', 'text/html');
  doc.body = doc.getElementsByTagName("body")[0]; doc.head = doc.getElementsByTagName("head")[0];
  const focusCalls = [];
  const attach = el => {
    el.addEventListener = el.removeEventListener = () => {};
    el.style = { setProperty() {}, removeProperty() {} };
    el.getRootNode = () => doc; el.ownerDocument = doc;
    el.closest = () => null;
    el.getBoundingClientRect = () => ({ height: 54 });
    el.focus = options => { doc.activeElement = el; focusCalls.push({ el, options }); };
    return el;
  };
  const create = doc.createElement.bind(doc), createNS = doc.createElementNS.bind(doc);
  doc.createElement = name => attach(create(name)); doc.createElementNS = (namespace, name) => attach(createNS(namespace, name));
  Array.from(doc.getElementsByTagName("*")).forEach(attach);
  doc.addEventListener = doc.removeEventListener = () => {};
  let wide = false, gate = false;
  const view = { document: doc, HTMLIFrameElement: class {}, HTMLElement: class {}, addEventListener() {}, removeEventListener() {}, navigator: { userAgent: "node-workspace-proof" }, location: { protocol: "http:" },
    matchMedia: () => ({ matches: wide, addEventListener() {}, removeEventListener() {} }) };
  const frames = new Map(); let nextFrame = 0;
  Object.assign(globalThis, { document: doc, window: view, requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id) });
  doc.defaultView = view; doc.activeElement = doc.body;
  const React = require("react"), { createRoot } = require("react-dom/client"), { flushSync } = require("react-dom");
  const Context = React.createContext(null);
  const callbacks = { close: null, launch: null };
  const react = { ...React, lazy: () => () => null, createElement: (type, props, ...children) => {
    if (type === "button" && props?.className === "companion-launch-main") callbacks.launch = props.onClick;
    if (type === "button" && props?.className === "companion-chrome-button" && props["aria-label"]?.includes("close-conversation")) callbacks.close = props.onClick;
    return React.createElement(type, props, ...children);
  } };
  const component = { exports: {} as { default: (props: any) => any } };
  const code = ts.transpileModule(fs.readFileSync("src/components/companion/CompanionWorkspace.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(name => {
    if (name === "react") return { __esModule: true, default: react, ...react };
    if (name === "../../context/ArborContext") return { useArbor: () => React.useContext(Context) };
    if (name === "../../context/LanguageContext") return { useLanguage: () => ({ uiLang: "en" }) };
    if (name === "../../hooks/useDialog") return { useDialog: () => ({ ref: React.useRef(null) }) };
    if (name === "../../lib/i18n") return { translate: (_lang, key) => key };
    if (name === "../../lib/kidModeGate") return { isKidModeActive: () => gate };
    if (name === "../../lib/companionConversation") return { COMPANION_CONVERSATION_EVENT: "test-conversation" };
    if (name === "../../lib/kpiEvents") return { trackCompanionPanelOpen() {} };
    if (name === "../../content/selectCards") return { availableHardMomentCards: () => [] };
    if (name === "../../lib/childAge") return { ageMonthsFromProfile: () => 48 };
    if (name === "./nowViewCopy") return { NOW_COPY: { en: { talk: "Ask", captureShort: "Keep" } } };
    if (name === "../ui/Icon") return { __esModule: true, default: () => null };
    if (name === "../ui/ArborMark") return { ArborMark: () => null };
    if (name === "../ErrorBoundary") return { ErrorBoundary: props => props.children };
    if (name.endsWith(".css")) return {};
    throw new Error(`UNMOCKED_IMPORT:${name}`);
  }, component, component.exports);
  const paint = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  function mount(tab, isWide = false) {
    wide = isWide; gate = false; frames.clear(); focusCalls.length = 0;
    const container = doc.createElement("div"); doc.body.appendChild(container);
    const root = createRoot(container);
    let update, current;
    function Driver() {
      const [state, setState] = React.useState({ activeTab: tab, childProfile: { id: "child-a", name: "Noa", age: 4 }, kidLocked: false });
      update = patch => setState(value => ({ ...value, ...patch })); current = state;
      const value = { ...state, activeFamilyTopic: null, chatInput: "", setActiveTab: activeTab => update({ activeTab }), setChatInput() {}, openCaptureSheet() {}, openHardMomentNow() {} };
      return React.createElement(Context.Provider, { value }, React.createElement(component.exports.default, { kidLocked: state.kidLocked }, React.createElement("main", null, "Page")));
    }
    flushSync(() => root.render(React.createElement(Driver)));
    const launcher = () => Array.from(container.getElementsByTagName("button")).find((el: any) => el.getAttribute("class") === "companion-launch-main");
    return {
      update: patch => flushSync(() => update(patch)),
      close: () => flushSync(() => callbacks.close()), launch: () => flushSync(() => callbacks.launch()),
      tab: () => current.activeTab, launcher,
      clearFocus: () => { doc.activeElement = doc.body; focusCalls.length = 0; },
      focused: () => !!launcher() && doc.activeElement === launcher(),
      focusedWithoutScroll: () => !!launcher() && focusCalls.some(call => call.el === launcher() && call.options?.preventScroll === true),
      unmount: () => { flushSync(() => root.unmount()); doc.body.removeChild(container); },
    };
  }
  const returned = [];
  for (const route of ["coach", "scholar"]) for (const isWide of [false, true]) {
    const h = mount(route, isWide); h.clearFocus(); h.close();
    const beforePaint = h.focused(); paint();
    returned.push({ route, wide: isWide, target: h.tab(), beforePaint, focused: h.focused(), preventScroll: h.focusedWithoutScroll() }); h.unmount();
  }
  for (const mode of ["launcher", "sidebar"]) for (const isWide of [false, true]) {
    const h = mount("milestones", isWide);
    if (mode === "launcher") h.launch(); else { h.update({ activeTab: "coach" }); await new Promise(resolve => setImmediate(resolve)); }
    h.clearFocus(); h.close(); const scheduled = frames.size; const beforePaint = h.focused(); paint();
    returned.push({ route: mode, scheduled, launcher: !!h.launcher(), wide: isWide, target: h.tab(), beforePaint, focused: h.focused(), preventScroll: h.focusedWithoutScroll() }); h.unmount();
  }
  const cancelled = {};
  for (const reason of ["child", "kid", "gate", "reopen", "navigate", "unmount"]) for (const entry of ["coach", "launcher"]) {
    const h = mount(entry === "coach" ? "coach" : "milestones");
    if (entry === "launcher") h.launch();
    h.close(); h.clearFocus();
    const scheduled = frames.size > 0;
    if (reason === "child") h.update({ childProfile: { id: "child-b", name: "Other", age: 5 } });
    if (reason === "kid") h.update({ kidLocked: true });
    if (reason === "gate") gate = true; // Global gate can lead the prop commit.
    if (reason === "reopen") h.launch();
    if (reason === "navigate") h.update({ activeTab: "development" });
    if (reason === "unmount") h.unmount();
    paint(); cancelled[reason] = (cancelled[reason] ?? true) && scheduled && focusCalls.length === 0;
    if (reason !== "unmount") { h.update({ kidLocked: false }); h.clearFocus(); paint(); cancelled[reason] &&= focusCalls.length === 0; h.unmount(); }
  }
  const h = mount("milestones"); h.clearFocus(); h.update({ childProfile: { id: "child-b", name: "Other", age: 5 } }); paint();
  const noUnrequestedFocus = focusCalls.length === 0; h.unmount();
  process.stdout.write(JSON.stringify({ returned, cancelled, noUnrequestedFocus }));
}

function proof() {
  const output = execFileSync(process.execPath, ["--input-type=commonjs", "-e", `(${mountedCloseProof.toString()})()`], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", MODEL_PROVIDER: "mock", MEMORY_ADAPTER: "local" }, timeout: 10_000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

describe("CompanionWorkspace explicit close focus after real React commits", () => {
  const result = proof();
  it.each(result.returned.map(row => [row.route, row.wide, row]))("restores the committed launcher from %s (wide=%s), without scrolling", (_route, _wide, row) => {
    expect(result.returned).toHaveLength(8);
    expect(row, JSON.stringify(row)).toMatchObject({ target: ["coach", "scholar"].includes(row.route) ? "overview" : "milestones", beforePaint: false, focused: true, preventScroll: true });
  });
  it("cancels pending returns for newer navigation, reopening, child changes, Kid Mode or unmount", () => {
    expect(result.cancelled).toEqual({ child: true, kid: true, gate: true, reopen: true, navigate: true, unmount: true });
    expect(result.noUnrequestedFocus).toBe(true);
  });
});
