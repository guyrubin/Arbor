import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/** Actual portrait, picker, goal helper and dialog hook under production React
 * and ReactDOM. The installed XML DOM is a Node host; animation, layout, focus
 * trapping and persistence are bounded test seams, not browser evidence. */
function mountedPortraitProof(duplicateKey: boolean) {
  const fs = require("node:fs"), ts = require("typescript");
  const { DOMParser } = require("@xmldom/xmldom");
  const doc = new DOMParser().parseFromString('<html><head></head><body><div id="root"></div></body></html>', "text/html");
  doc.body = doc.getElementsByTagName("body")[0]; doc.head = doc.getElementsByTagName("head")[0];
  const attach = el => {
    el.addEventListener = el.removeEventListener = () => {};
    el.style = { setProperty() {}, removeProperty() {} };
    el.getRootNode = () => doc; el.ownerDocument = doc;
    if (el.tagName.toLowerCase() === "select") Object.defineProperty(el, "options", { get: () => Array.from(el.getElementsByTagName("option")) });
    el.focus = () => { doc.activeElement = el; };
    return el;
  };
  const create = doc.createElement.bind(doc), createNS = doc.createElementNS.bind(doc);
  doc.createElement = name => attach(create(name)); doc.createElementNS = (namespace, name) => attach(createNS(namespace, name));
  Array.from(doc.getElementsByTagName("*")).forEach(attach);
  doc.addEventListener = doc.removeEventListener = () => {};
  const view = { document: doc, HTMLIFrameElement: class {}, HTMLElement: class {}, addEventListener() {}, removeEventListener() {}, navigator: { userAgent: "node-portrait-proof" }, location: { protocol: "http:" } };
  Object.assign(globalThis, { document: doc, window: view }); doc.defaultView = view; doc.activeElement = doc.body;
  const React = require("react"), ReactDOM = require("react-dom"), { createRoot } = require("react-dom/client");
  const { flushSync } = ReactDOM;
  // Stable host component identities, real AnimatePresence and real portals.
  const hosts = new Map();
  const motion = new Proxy({}, { get: (_, tag) => {
    if (!hosts.has(tag)) hosts.set(tag, React.forwardRef(({ children, initial, animate, exit, transition, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)));
    return hosts.get(tag);
  } });
  const modules = { react: React, "react-dom": ReactDOM, "motion/react": { motion, AnimatePresence: require("motion/react").AnimatePresence } };
  const load = (file, imports, transform = source => source) => {
    const module = { exports: {} as any };
    const source = ts.transpileModule(transform(fs.readFileSync(file, "utf8")), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    new Function("require", "module", "exports", source)(name => {
      if (Object.hasOwn(imports, name)) return Object.hasOwn(imports[name], "default") ? { __esModule: true, ...imports[name] } : imports[name];
      if (Object.hasOwn(modules, name)) return modules[name];
      throw new Error(`UNMOCKED_IMPORT:${file}:${name}`);
    }, module, module.exports);
    return module.exports;
  };
  const goals = load("src/practice/goalBuilder.ts", { "../lib/tokens": { BRAND_HEX: {} } });
  const seed = id => ({ id, name: "Synthetic", activeGoals: [], interests: [], strengths: [] });
  let child = seed("synthetic-a"), session = {}, refresh, setRoute, watchMounts = 0, watchDisposals = 0, registrations = 0, disposals = 0, writes = 0;
  const hook = load("src/hooks/useDialog.ts", { "../lib/dialogStack": { registerDialog: options => {
    registrations++;
    return { close: () => options.onClose(), dispose: () => { disposals++; } };
  } } });
  const language = { useLanguage: () => ({ t: key => key, uiLang: "en" }) };
  const empty = () => null;
  const Picker = load("src/components/practice/GoalBuilderModal.tsx", {
    "../ui/Icon": { Icon: empty }, "../../hooks/useDialog": hook,
    "../../practice/goalBuilder": goals, "../../playbank/select": { domainForBehaviorType: () => null },
    "../../context/LanguageContext": language,
    "../../context/ProfileContext": { useProfile: () => ({
      goalSession: session, getGoalSelection: () => ({ goals: child.activeGoals }), cancelGoalAttempt() {},
      saveChildGoal: async (id, goal) => { writes++; child = { ...child, activeGoals: goals.selectFocusGoal(child.activeGoals, goal, "2026-10-10T00:00:00Z") }; refresh(); return "saved"; },
    }) }, "./GoalFocusLine": { goalGlyph: () => "" },
  }).default;
  const Watch = () => {
    const [identity] = React.useState(() => ++watchMounts);
    React.useEffect(() => () => { watchDisposals++; }, []);
    return React.createElement("button", { "data-testid": "synthetic-watch", "data-identity": identity });
  };
  const copy = new Proxy({}, { get: (_, key) => String(key) });
  const Portrait = load("src/components/companion/ChildPortrait.tsx", {
    "../practice/GoalBuilderModal": { default: Picker },
    "../practice/GoalFocusLine": { GoalFocusLine: ({ onClick, testId }) => React.createElement("button", { onClick, "data-testid": testId }) },
    "../../context/ArborContext": { useArbor: () => ({ childProfile: child, milestones: [], setActiveTab() {}, seedCoach() {}, openCaptureSheet() {}, requestJournalFocus() {} }) },
    "../../context/LanguageContext": language,
    "../../hooks/useObservationRecord": { useObservationRecord: () => ({ observations: [], sources: { behaviorLogs: [] }, loading: true }) },
    "../../lib/domains/registry": { DOMAIN_IDS: [], domainName: id => id },
    "../../lib/domains/icons": load("src/lib/domains/icons.ts", {}),
    "../../lib/milestoneData": {}, "../../content/behaviorTaxonomy": {},
    "../ui/Icon": { Icon: empty }, "../ui/Avatar": { Avatar: empty }, "../ui/Modal": { Modal: empty },
    "./portraitModel": { buildPortraitChapters: () => [], buildPortraitEnvironments: () => [], buildPortraitThreads: () => [] },
    "./portraitCopy": { PORTRAIT_COPY: { en: copy, he: copy } }, "./portraitEvidence": {},
    "../../lib/kpiEvents": { trackCompanionPlaceOpen() {} }, "./PortraitWatchRow": { default: Watch },
    "./PortraitKeepsakes": { default: empty }, "../describe/KeptDescription": { default: empty }, "../../lib/parentArt": {}, "./childPortrait.css": {},
    "../../lib/childPicture": { childPicture: () => ({}) },
  }, source => duplicateKey ? source.replace('key={`goal-picker:${childProfile.id}`}', 'key={childProfile.id}') : source).default;
  function Shell() {
    const [route, changeRoute] = React.useState("development"), [, changeVersion] = React.useState(0);
    setRoute = changeRoute; refresh = () => changeVersion(value => value + 1);
    return route === "development" ? React.createElement(Portrait) : React.createElement("p", null, "profile");
  }
  let fatal;
  const all = () => Array.from(doc.getElementsByTagName("*")) as any[];
  const byId = id => all().find(node => node.getAttribute("data-testid") === id);
  const dialogs = () => all().filter(node => node.getAttribute("role") === "dialog").length;
  const click = node => {
    if (!node) throw new Error("CONTROL_MISSING");
    const props = node[Object.keys(node).find(key => key.startsWith("__reactProps$"))];
    flushSync(() => props.onClick());
    if (fatal) throw fatal;
  };
  const close = () => click(all().find(node => node.getAttribute("aria-label") === "aria.close"));
  const root = createRoot(doc.getElementById("root"), { onUncaughtError: error => { fatal = error; } });
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise<void>(resolve => setImmediate(resolve)); flushSync(() => {}); if (fatal) throw fatal; } };
  (async () => {
    const proof = {} as Record<string, unknown>;
    try {
      flushSync(() => root.render(React.createElement(Shell)));
      if (fatal) throw fatal;
      const watch = byId("synthetic-watch");
      click(byId("portrait-goals-edit")); proof.opened = dialogs(); close();
      proof.afterClose = dialogs(); proof.closedDisposals = disposals;
      proof.watchPreservedOnClose = watch === byId("synthetic-watch");
      if (duplicateKey || dialogs() !== 0) {
        // A real route departure cannot delete a fiber already lost from the
        // keyed child map. Preserve that deterministic pre-fix failure too.
        flushSync(() => setRoute("profile")); proof.afterDeparture = dialogs();
      } else {
        click(byId("portrait-goals-edit")); proof.reopened = dialogs();
        click(byId("goal-choice-big-feelings"));
        const confirmation = byId("goal-confirm"); flushSync(refresh);
        proof.providerRerenderPreservesSelection = dialogs() === 1 && confirmation === byId("goal-confirm");
        click(byId("goal-save")); await settle();
        proof.afterSave = dialogs(); proof.writes = writes; proof.goalIds = child.activeGoals.map(goal => goal.goalId);
        proof.watchPreservedOnSave = watch === byId("synthetic-watch");
        click(byId("portrait-goals-edit")); proof.savedReopen = dialogs();
        proof.noStaleConfirmation = !byId("goal-confirm");
        flushSync(() => setRoute("profile")); proof.afterDeparture = dialogs();
        flushSync(() => setRoute("development")); proof.afterReturn = dialogs();
        click(byId("portrait-goals-edit")); child = seed("synthetic-b"); flushSync(refresh); await settle();
        proof.afterChildSwitch = dialogs(); proof.watchRemountedForChild = watchMounts === 3;
        click(byId("portrait-goals-edit")); proof.newChildOpen = dialogs();
      }
      root.unmount(); proof.afterUnmount = dialogs();
      proof.registrations = registrations; proof.disposals = disposals; proof.watchDisposals = watchDisposals;
      process.stdout.write(JSON.stringify(proof));
    } catch (error) { root.unmount(); throw error; }
  })();
}

function proof(duplicateKey = false) {
  return JSON.parse(execFileSync(process.execPath, ["--input-type=commonjs", "-e", `(${mountedPortraitProof.toString()})(${duplicateKey})`], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", MODEL_PROVIDER: "mock", MEMORY_ADAPTER: "local" },
    timeout: 10_000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }));
}

describe("portrait goal picker sibling identity in mounted production React", () => {
  it("retires the actual portal and registration on close, save, departure, child change and unmount", () => {
    expect(proof()).toEqual({ opened: 1, afterClose: 0, closedDisposals: 1, watchPreservedOnClose: true,
      reopened: 1, providerRerenderPreservesSelection: true, afterSave: 0, writes: 1, goalIds: ["big-feelings"], watchPreservedOnSave: true,
      savedReopen: 1, noStaleConfirmation: true, afterDeparture: 0, afterReturn: 0,
      afterChildSwitch: 0, watchRemountedForChild: true, newChildOpen: 1,
      afterUnmount: 0, registrations: 5, disposals: 5, watchDisposals: 3 });
  });
  it("NEGATIVE CONTROL: duplicate child keys orphan the real portal and registration even after departure", () => {
    expect(proof(true)).toMatchObject({ opened: 1, afterClose: 1, closedDisposals: 0,
      watchPreservedOnClose: true, afterDeparture: 1, afterUnmount: 1, registrations: 1, disposals: 0 });
  });
});
