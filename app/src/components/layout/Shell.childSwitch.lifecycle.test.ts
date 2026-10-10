import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/** Real production Shell, TimelineTab and JournalTab with installed React and
 * Motion. The existing XML Node host supplies DOM primitives and a controlled
 * animation clock; data, chrome and modal I/O are isolated. This verifies mount,
 * presence, privacy and scroll lifecycle, not browser layout or accessibility. */
async function mountedRouteProof() {
  const fs = require("node:fs"), ts = require("typescript");
  const { DOMParser } = require("@xmldom/xmldom");
  const doc = new DOMParser().parseFromString("<html><head></head><body></body></html>", "text/html");
  doc.body = doc.getElementsByTagName("body")[0]; doc.head = doc.getElementsByTagName("head")[0];
  const Element = doc.documentElement.constructor;
  const scrolls = [];
  const attach = el => {
    el.addEventListener = el.removeEventListener = () => {};
    el.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
    el.getRootNode = () => doc; el.ownerDocument = doc;
    el.getBoundingClientRect = () => ({ top: 0, left: 0, right: 400, bottom: 600, width: 400, height: 600 });
    el.scrollTo = options => scrolls.push({ owner: el.getAttribute("id"), ...options });
    el.focus = () => { doc.activeElement = el; };
    return el;
  };
  const create = doc.createElement.bind(doc), createNS = doc.createElementNS.bind(doc);
  doc.createElement = name => attach(create(name)); doc.createElementNS = (ns, name) => attach(createNS(ns, name));
  Array.from(doc.getElementsByTagName("*")).forEach(attach);
  doc.addEventListener = doc.removeEventListener = () => {};
  let time = 0, frameId = 0, timerId = 0;
  const frames = new Map(), timers = new Map();
  const view = { document: doc, Element, HTMLElement: Element, SVGElement: class {}, HTMLIFrameElement: class {},
    addEventListener() {}, removeEventListener() {}, navigator: { userAgent: "node-shell-presence-proof" },
    location: { protocol: "http:", pathname: "/", search: "", hash: "#/journal?view=all" },
    matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
    scrollTo: (left, top) => scrolls.push({ owner: "window", left, top }),
  };
  Object.assign(globalThis, { document: doc, window: view, Element, HTMLElement: Element, SVGElement: view.SVGElement,
    requestAnimationFrame: callback => { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (callback, delay = 0, ...args) => { const id = ++timerId; timers.set(id, { due: time + delay, run: () => callback(...args) }); return id; },
    clearTimeout: id => timers.delete(id),
    getComputedStyle: el => ({ ...el.style, getPropertyValue: name => el.style[name] ?? "" }),
  });
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => time } });
  doc.defaultView = view; doc.activeElement = doc.body;
  const React = require("react"), { createRoot } = require("react-dom/client"), { flushSync } = require("react-dom");
  const motion = require("motion/react");
  const Context = React.createContext(null);
  const t = (key, args) => args?.name ? `${key}:${args.name}` : key;
  const noOp = () => undefined, empty = [];
  const pass = props => props.children;
  let resolveLazy;
  const lazyMounts = [];
  const SuspendedRoute = React.lazy(() => new Promise(resolve => { resolveLazy = resolve; }));
  let Timeline;
  const react = { ...React, lazy: loader => loader.toString().includes("TimelineTab")
    ? props => React.createElement(Timeline, props)
    : loader.toString().includes("AttributionTab") ? SuspendedRoute
    : () => {
      const state = React.useContext(Context);
      return React.createElement("p", { "data-other-route": state.activeTab }, `${state.activeTab}:${state.childProfile.name}`);
    } };
  const overrides = {
    "react": react,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "motion/react": motion,
    "../../context/ArborContext": { useArbor: () => React.useContext(Context) },
    "../../context/LanguageContext": { useLanguage: () => ({ t, uiLang: "en" }) },
    "../../context/ToastContext": { useToast: () => ({ toast: noOp }) },
    "../../hooks/useHashQuery": { useHashQuery: () => new URLSearchParams("view=all"), goToRoute: noOp },
    "../../lib/companionPlaces": { isCompanionHome: () => true },
    "../../lib/navigation": { sectionForTab: () => ({}), pillRowFor: () => empty },
    "../../lib/surfaceContract": { contractFor: () => undefined },
    "../../lib/kidModeGate": { isKidModeActive: () => false, subscribeKidMode: () => noOp },
    "../../hooks/useEntitlement": { takeBillingReturn: () => false },
    "../kidmode/KidModeContext": { KidModeProvider: pass },
    "../companion/CompanionWorkspace": { default: pass },
    "../ErrorBoundary": { ErrorBoundary: pass },
    "../ui/Skeleton": { Skeleton: () => null, TabSkeleton: () => React.createElement("p", { "data-route-pending": "true" }, "Loading") },
    "../../hooks/useTimeline": { useTimeline: () => empty },
    "../../lib/journalRecordSignals": { journalRecordSignals: () => empty },
    "../../lib/i18nElevation/childsignals": { withChildSignals: () => t },
    "../../lib/captureProvenance": { readCaptureProvenance: () => empty },
    "../../lib/promptBank": { dailyPromptKeys: () => empty },
    "../../lib/age/forChild": { ageYearsOf: () => 5 },
    "../../lib/signalTimeline": { groupByDay: () => empty, weekMomentCount: () => 0, journalFeedCountKey: () => ({ key: "count", n: 0 }) },
    "../../lib/journalFilters": { journalMonthKeys: () => empty },
    "../../lib/journalLastKept": { lastKeptMoment: () => undefined, journalStoryState: () => "empty" },
    "../../lib/i18nElevation/states": { statesText: key => key },
  };
  function load(file, extra = {}) {
    const source = fs.readFileSync(`src/components/${file}.tsx`, "utf8");
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const boundaries = {};
    for (const node of parsed.statements) {
      if (!ts.isImportDeclaration(node) || !node.importClause || node.importClause.isTypeOnly) continue;
      const name = node.moduleSpecifier.text;
      const values: Record<string, any> = { __esModule: true };
      if (node.importClause.name) values.default = () => null;
      const bindings = node.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const spec of bindings.elements) if (!spec.isTypeOnly) values[spec.propertyName?.text ?? spec.name.text] = () => null;
      boundaries[name] = values;
    }
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const module = { exports: {} as any };
    new Function("require", "module", "exports", code)(name => {
      const value = extra[name] ?? overrides[name] ?? boundaries[name];
      if (!value) throw new Error(`UNMOCKED_IMPORT:${name}`);
      return { __esModule: true, ...value };
    }, module, module.exports);
    return module.exports.default;
  }
  const Journal = load("tabs/JournalTab");
  Timeline = load("tabs/TimelineTab", { "./JournalTab": { default: Journal } });
  const Shell = load("layout/Shell");
  async function settle() {
    // Advance animation frames, not wall-clock sleeps. Both real Motion promises
    // and real React commits run. A stuck exit cannot hide behind a timeout.
    for (let step = 0; step < 90; step++) {
      time += 16;
      for (const [id, timer] of timers) if (timer.due <= time) { timers.delete(id); timer.run(); }
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(time));
      await new Promise(resolve => setImmediate(resolve));
      flushSync(() => {});
    }
  }
  function mount() {
    const container = doc.createElement("div"); doc.body.appendChild(container);
    const root = createRoot(container); let change;
    function Driver() {
      const [state, update] = React.useState({ activeTab: "journal", childProfile: { id: "a", name: "Noa", languages: [] } });
      change = patch => update(previous => ({ ...previous, ...patch }));
      const value = { ...state, setActiveTab: tab => change({ activeTab: tab }), showSandboxBanner: false,
        captureSheet: {}, closeCaptureSheet: noOp, activeFamilyTopic: null, conversations: empty,
        milestones: empty, playLogs: empty, behaviorLogs: empty, logsLoaded: true };
      return React.createElement(Context.Provider, { value }, React.createElement(Shell));
    }
    flushSync(() => root.render(React.createElement(Driver)));
    const find = (attribute, value): any => Array.from(container.getElementsByTagName("*")).find((el: any) => el.getAttribute(attribute) === value);
    return {
      child: id => flushSync(() => change({ childProfile: { id, name: id === "a" ? "Noa" : "Mira", languages: [] } })),
      route: activeTab => flushSync(() => change({ activeTab })),
      frame: () => find("data-route", "journal")?.parentNode,
      content: () => find("data-testid", "journal-compose-ask"),
      other: route => find("data-other-route", route),
      pending: () => find("data-route-pending", "true"),
      lazyChild: () => find("data-lazy-child", "b"),
      connected: node => { for (let current = node; current; current = current.parentNode) if (current === container) return true; return false; },
      unmount: () => { flushSync(() => root.unmount()); doc.body.removeChild(container); },
    };
  }
  const h = mount(); await settle();
  const first = h.frame(), firstContent = h.content();
  const initial = !!first && Number(first.style.opacity) === 1 && firstContent?.textContent.includes("Noa");
  scrolls.length = 0;
  h.child("a"); await settle();
  const stable = first === h.frame() && firstContent === h.content();
  const stableScroll = scrolls.length === 0;
  scrolls.length = 0;
  h.child("b");
  const immediate = { retired: !h.connected(first), replaced: h.frame() !== first, newChild: h.content()?.textContent.includes("Mira") === true };
  await settle();
  const afterSwitch = { retired: !h.connected(first), visible: Number(h.frame()?.style.opacity) === 1, newChild: h.content()?.textContent.includes("Mira") === true };
  const childScroll = scrolls.some(row => row.owner === "main") && scrolls.some(row => row.owner === "window");
  const second = h.frame(); h.child("a"); await settle();
  const returned = !h.connected(second) && h.frame() !== first && h.content()?.textContent.includes("Noa") === true && Number(h.frame()?.style.opacity) === 1;
  const rapidFrames = [h.frame()];
  for (const id of ["b", "a", "b"]) { h.child(id); rapidFrames.push(h.frame()); }
  const rapid = rapidFrames.slice(0, -1).every(frame => !h.connected(frame)) && h.content()?.textContent.includes("Mira") === true;
  await settle();
  const rapidVisible = Number(h.frame()?.style.opacity) === 1;
  const beforeRoute = h.frame(); scrolls.length = 0;
  h.route("practice");
  const routeWaits = h.connected(beforeRoute) && !h.other("practice");
  await settle();
  const routeExited = !h.connected(beforeRoute) && !!h.other("practice");
  const routeScroll = scrolls.some(row => row.owner === "main") && scrolls.some(row => row.owner === "window");
  h.route("journal"); await settle();
  const back = !!h.frame() && h.content()?.textContent.includes("Mira") === true;
  const interrupted = h.frame(); h.route("practice"); h.child("a");
  const interruptRetired = !h.connected(interrupted) && !!h.other("practice");
  await settle(); h.route("journal"); await settle();
  const finalChild = h.content()?.textContent.includes("Noa") === true && Number(h.frame()?.style.opacity) === 1;
  const beforeSuspend = h.frame();
  h.route("attribution"); await settle();
  const suspended = !!h.pending();
  // The module request began for A. Keep it pending through B -> A -> B;
  // resolving that old request must mount only the current child's subtree.
  for (const id of ["b", "a", "b"]) h.child(id);
  const suspendedSwitch = !!h.pending() && !h.connected(beforeSuspend) && !h.frame();
  resolveLazy({ default: () => {
    const state = React.useContext(Context);
    React.useLayoutEffect(() => { lazyMounts.push(state.childProfile.id); }, []);
    return React.createElement("p", { "data-lazy-child": state.childProfile.id }, state.childProfile.name);
  } });
  await settle();
  const resolvedCurrentChild = !h.pending() && h.lazyChild()?.textContent === "Mira" && lazyMounts.join(",") === "b";
  h.unmount();
  process.stdout.write(JSON.stringify({ initial, stable, stableScroll, immediate, afterSwitch, childScroll, returned, rapid, rapidVisible, routeWaits, routeExited, routeScroll, back, interruptRetired, finalChild, suspended, suspendedSwitch, resolvedCurrentChild }));
}

describe("Shell child-scoped route lifetime with real React and Motion", () => {
  it("retires the outgoing child without waiting, even across interrupted exits; same-child routes still wait and reset scroll", () => {
    const output = execFileSync(process.execPath, ["--input-type=commonjs", "-e", `(${mountedRouteProof.toString()})()`], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", MODEL_PROVIDER: "mock", MEMORY_ADAPTER: "local" }, timeout: 15_000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    expect(JSON.parse(output)).toEqual({ initial: true, stable: true, stableScroll: true,
      immediate: { retired: true, replaced: true, newChild: true },
      afterSwitch: { retired: true, visible: true, newChild: true }, childScroll: true,
      returned: true, rapid: true, rapidVisible: true, routeWaits: true, routeExited: true,
      routeScroll: true, back: true, interruptRetired: true, finalChild: true,
      suspended: true, suspendedSwitch: true, resolvedCurrentChild: true,
    });
  });
});
