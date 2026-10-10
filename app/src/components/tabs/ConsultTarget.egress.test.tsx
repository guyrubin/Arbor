import React, { useMemo } from "react";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real component functions and collection listener callbacks under deterministic
// hook lifetimes. The real Modal/createPortal target is inspected, never printed.
const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], owners: new Map<string, any[]>(), effects: [] as (() => void)[], dirty: false,
  recordData: null as any, audienceReceipt: null as any, prefill: null as any, remote: true, child: "a", account: "parent-a", query: "appointment=teacher-visit", listeners: [] as any[],
  print: vi.fn(), pdf: vi.fn(), copy: vi.fn(), generate: vi.fn(), toast: vi.fn(), record: vi.fn(), storage: new Map<string, string>(),
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  const memo = (calculate: () => unknown, deps: unknown[]) => {
    const i = h.cursor++, slots = h.slots, prev = slots[i];
    if (!prev || deps.some((d, n) => !Object.is(d, prev.deps[n]))) slots[i] = { deps, value: calculate() };
    return slots[i].value;
  };
  return { ...actual,
    useState: (initial: any) => { const i = h.cursor++, slots = h.slots; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (next: any) => { const value = typeof next === "function" ? next(slots[i]) : next; if (!Object.is(slots[i], value)) { slots[i] = value; h.dirty = true; } }]; },
    useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
    useMemo: memo, useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps), useId: () => "synthetic-id", useSyncExternalStore: () => 0,
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++, slots = h.slots, prev = slots[i]; if (prev && deps.every((d, n) => Object.is(d, prev.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; slots[i] = slot; h.effects.push(() => { prev?.cleanup?.(); slot.cleanup = effect(); }); },
  };
});
const profiles = {
  a: { id: "a", name: "Synthetic A", age: 5, gender: "girl", languages: ["English"], schoolContext: "Gan", strengths: ["Builds towers"], challenges: [], interests: [] },
  b: { id: "b", name: "Synthetic B", age: 5, gender: "boy", languages: ["English"], schoolContext: "Gan", strengths: ["Builds towers"], challenges: [], interests: [] },
};
const empty: any[] = [];
function noop() {}
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: profiles[h.child as keyof typeof profiles], activeTab: "consult", behaviorLogs: h.recordData?.logs ?? empty, milestones: h.recordData?.milestones ?? empty, consultRecordSources: h.recordData?.sources, consultAudienceReceipt: h.audienceReceipt, actionPlans: empty, approvedMemoryItems: empty, actionLoop: empty, setActiveTab: noop, openPaywall: noop, pendingConsultPrefill: h.prefill, consumeConsultPrefill: () => { h.prefill = null; } }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.account } }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", t: translate }) }));
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams(h.query) }));
vi.mock("../../hooks/useDialog", () => ({ useDialog: () => ({ ref: { current: null }, requestClose: noop, onBackdropClick: noop }) }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: noop, step: null }) }));
vi.mock("../sections/Reports", () => ({ useConsultPdf: () => h.pdf }));
vi.mock("../../lib/reportExport", () => ({ openPrintableReport: h.print }));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: noop, trackShareCompleted: noop }));
vi.mock("../../consult/exportHistory", () => ({ getLastExportedAt: () => null, recordExport: (...args: any[]) => h.record(...args) }));
vi.mock("../../lib/api", async original => ({ ...await original<typeof import("../../lib/api")>(), api: { generateBrief: (...args: any[]) => h.generate(...args) } }));
vi.mock("../../lib/firebase", () => ({ db: {}, get firebaseEnabled() { return h.remote; } }));
vi.mock("../../lib/syncStore", () => ({ clearSyncError: noop, reportSyncError: noop, getSyncSnapshot: () => 0, subscribeSyncStatus: noop }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }), doc: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), query: (q: unknown) => q,
  setDoc: vi.fn(), deleteDoc: vi.fn(), writeBatch: vi.fn(),
  onSnapshot: (q: any, ...args: any[]) => { const options = typeof args[0] === "function" ? null : args.shift(); const listener = { path: q.path, options, next: args[0], fail: args[1], stopped: false }; h.listeners.push(listener); return () => { listener.stopped = true; }; },
}));
vi.mock("motion/react", async original => ({ ...await original<typeof import("motion/react")>(), useReducedMotion: () => false }));
import { translate as translateKey } from "../../lib/i18n";
function translate(key: string, vars?: Record<string, any>) { return translateKey("en", key, vars); }
import ConsultTab from "./ConsultTab";
import PracticeSummary from "../consult/PracticeSummary";
import { createConsultAudienceReceipt } from "../../consult/audienceReceipt";
import { hydrateMilestones } from "../../context/milestoneHydration";
import { initialMilestones } from "../../initialData";
import { useChildCollection } from "../../hooks/useChildCollection";
import AskSpecialist from "../sections/AskSpecialist";
import SchoolBrief from "../sections/SchoolBrief";
import { Modal } from "../ui/Modal";

type El = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
const find = (node: React.ReactNode, predicate: (el: El) => boolean) => elements(node).find(predicate)!;
const byId = (node: React.ReactNode, id: string) => find(node, el => el.props["data-testid"] === id);
function owner(key: string, component: any, props: any = {}) { h.cursor = 0; h.slots = h.owners.get(key) ?? []; h.owners.set(key, h.slots); return component(props); }
function dispose(key: string) { h.owners.get(key)?.forEach(slot => slot?.cleanup?.()); h.owners.delete(key); }
let activeKey = "", schoolMounted = false, summaryMounted = false;
function recordRead() {
  const milestones = useChildCollection<any>(h.child, "milestones", { trackConfirmation: true });
  const logs = useChildCollection<any>(h.child, "behaviorLogs", { trackConfirmation: true, orderByField: "timestamp", orderDir: "desc", max: 300 });
  return { milestones: useMemo(() => hydrateMilestones(milestones.loaded ? milestones.items : empty, initialMilestones), [milestones.loaded ? milestones.items : empty]), logs: logs.loaded ? logs.items : empty, sources: { milestones, behaviorLogs: logs } };
}
function render() {
  let result: { outer: React.ReactNode; ask?: El; packet?: React.ReactNode; brief?: React.ReactNode; summary?: React.ReactNode } = { outer: null };
  for (let n = 0; n < 12; n++) {
    h.dirty = false;
    h.recordData = owner("records", recordRead);
    const content = owner("wrapper", ConsultTab) as El;
    const nextKey = String(content.key);
    if (activeKey && activeKey !== nextKey) { dispose("content"); dispose("ask"); dispose("school"); dispose("summary"); schoolMounted = false; summaryMounted = false; }
    activeKey = nextKey;
    const outer = owner("content", content.type, content.props);
    const ask = find(outer, el => el.type === AskSpecialist);
    const packet = ask ? owner("ask", AskSpecialist, ask.props) : null;
    const school = find(packet, el => el.type === SchoolBrief);
    if (!school && schoolMounted) dispose("school");
    schoolMounted = !!school;
    const brief = school ? owner("school", SchoolBrief, school.props) : null;
    const summaryElement = find(outer, el => el.type === PracticeSummary);
    if (!summaryElement && summaryMounted) dispose("summary");
    summaryMounted = !!summaryElement;
    const summary = summaryElement ? owner("summary", PracticeSummary, summaryElement.props) : null;
    result = { outer, ask, packet, brief, summary };
    h.effects.splice(0).forEach(effect => effect());
    if (!h.dirty) return result;
  }
  throw Error("render did not settle");
}
const visit = (id = "teacher-visit", profession = "teacher") => ({ id, who: "Synthetic teacher", role: "Teacher", profession, whenIso: new Date(Date.now() + 86400000).toISOString(), status: "confirmed" });
function source(rows = [visit()], options: { fromCache?: boolean; hasPendingWrites?: boolean; error?: boolean } = {}) {
  const listener = h.listeners.find(l => !l.stopped && l.path === `users/${h.account}/children/${h.child}/appointments`)!;
  if (options.error) listener.fail();
  else listener.next({ empty: rows.length === 0, docs: rows.map(({ id, ...data }) => ({ id, data: () => data })), metadata: { fromCache: !!options.fromCache, hasPendingWrites: !!options.hasPendingWrites } });
}
function openReview() {
  const brief = render().brief;
  find(brief, el => el.type === "button" && !!el.props["data-primary-move"]).props.onClick();
  const modal = find(render().brief, el => el.type === Modal);
  expect(modal.props.open).toBe(true);
  const portal = owner("modal", Modal, modal.props) as any;
  expect(portal.containerInfo).toBe(document.body);
  return find(modal.props.children, el => el.type === "button" && String(el.props.className).includes("gap-2")).props.onClick as () => void;
}
function start(profession = "teacher") { render(); source([visit("teacher-visit", profession)]); return render(); }
function setAudience(audience: string) { find(render().packet, el => el.props.role === "radio" && elements(el).length > 0 && React.Children.toArray(el.props.children).includes(translate(`elev.carehonesty.consult.audience.${audience}`))).props.onClick(); render(); }
function approvePacket() { byId(render().packet, "consult-reason-input").props.onChange({ target: { value: "What helps with classroom transitions?" } }); byId(render().packet, "consult-reviewed").props.onClick(); return render().packet; }
beforeEach(() => {
  h.recordData = null; h.audienceReceipt = createConsultAudienceReceipt(); h.prefill = null; summaryMounted = false; h.cursor = 0; h.slots = []; h.owners.clear(); h.effects = []; h.dirty = false; h.listeners = []; h.remote = true; h.child = "a"; h.account = "parent-a"; h.query = "appointment=teacher-visit"; activeKey = ""; schoolMounted = false; h.storage.clear();
  for (const mock of [h.print, h.pdf, h.copy, h.generate, h.toast, h.record]) mock.mockReset();
  vi.stubGlobal("localStorage", { getItem: (key: string) => h.storage.get(key) ?? null, setItem: (key: string, value: string) => h.storage.set(key, value) });
  vi.stubGlobal("document", { body: { nodeType: 1, synthetic: true } });
  vi.stubGlobal("navigator", { clipboard: { writeText: h.copy } }); vi.stubGlobal("window", { location: { href: "" } });
});
afterEach(() => { [...h.owners.keys()].forEach(dispose); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const contextSource = ts.createSourceFile("ArborContext.tsx", readFileSync(new URL("../../context/ArborContext.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let prefillDeclaration: ts.VariableDeclaration | undefined;
function findPrefill(node: ts.Node) { if (ts.isVariableDeclaration(node) && node.name.getText(contextSource) === "requestConsultPrefill") prefillDeclaration = node; ts.forEachChild(node, findPrefill); }
findPrefill(contextSource);
const prefillCode = ts.transpileModule(`const ${prefillDeclaration!.getText(contextSource)}; return requestConsultPrefill;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function requestPrefill(prefill: unknown) {
  new Function("consultAudienceReceipt", "setPendingConsultPrefill", prefillCode)(h.audienceReceipt, (value: unknown) => { h.prefill = value; })(prefill);
}

function confirmPracticeSources() {
  for (const listener of h.listeners.filter(l => !l.stopped && !l.path.endsWith("/appointments"))) {
    listener.next({ empty: true, docs: [], metadata: { fromCache: false, hasPendingWrites: false } });
  }
  render();
}
function openPracticeCopy() {
  byId(render().summary, "consult-practice-summary").props.onToggle({ currentTarget: { open: true } });
  return byId(render().summary, "consult-practice-copy").props.onClick as () => Promise<void>;
}
function recordSnapshot(collection: "milestones" | "behaviorLogs", state: "cache" | "pending" | "error" | "change" | "deleted" | "confirmed") {
  const listener = h.listeners.find(l => !l.stopped && l.path === `users/${h.account}/children/${h.child}/${collection}`)!;
  expect(listener.options).toEqual({ includeMetadataChanges: true });
  if (state === "error") listener.fail();
  else listener.next({ empty: state !== "change", docs: state === "change" ? [{ id: "new-record", data: () => collection === "milestones" ? { title: "Parent words", domain: "language_communication", checked: true, ageMonths: 60 } : { timestamp: new Date().toISOString(), behaviorType: "Transition Refusal", intensity: 3 } }] : [], metadata: { fromCache: state === "cache", hasPendingWrites: state === "pending" } });
}

describe("practice summary actual data and audience boundaries", () => {
  it("the actual context readers opt into confirmation and expose their own receipts", () => {
    const declarations = new Map<string, ts.VariableDeclaration>();
    let receipts: ts.PropertyAssignment | undefined;
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node)) declarations.set(node.name.getText(contextSource), node);
      if (ts.isPropertyAssignment(node) && node.name.getText(contextSource) === "consultRecordSources") receipts = node;
      ts.forEachChild(node, visit);
    }
    visit(contextSource);
    const readers = new Map<string, object>();
    const collect = (_child: string, name: string, options: { trackConfirmation?: boolean }) => {
      expect(options.trackConfirmation).toBe(true);
      const receipt = { loaded: true, error: false, confirmed: true, isCurrent: () => name === "milestones" };
      readers.set(name, receipt); return receipt;
    };
    const code = ts.transpileModule(`const ${declarations.get("logsCol")!.getText(contextSource)}; const ${declarations.get("milestonesCol")!.getText(contextSource)}; return ${receipts!.initializer.getText(contextSource)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const exposed = new Function("useChildCollection", "childProfile", "demoSeed", "initialMilestones", code)(collect, { id: "a" }, { logs: [] }, []);
    expect(exposed).toEqual({ milestones: readers.get("milestones"), behaviorLogs: readers.get("behaviorLogs") });
  });
  for (const collection of ["milestones", "behaviorLogs"] as const) {
    it(`${collection}: loading cannot become a hydrated-catalogue export`, async () => {
      start("slp");
      // Confirm every other real listener, leaving the consumed source loading.
      for (const listener of h.listeners.filter(l => !l.stopped && !l.path.endsWith("/appointments") && !l.path.endsWith(`/${collection}`))) listener.next({ empty: true, docs: [], metadata: { fromCache: false, hasPendingWrites: false } });
      const summary = render().summary;
      expect(byId(summary, "consult-practice-copy").props.disabled).toBe(true);
      expect(byId(summary, "consult-practice-preview")).toBeUndefined();
      await openPracticeCopy()(); expect(h.copy).not.toHaveBeenCalled();
    });
    for (const state of ["cache", "pending", "error", "change", "deleted"] as const) it(`${collection} ${state} invalidates a held copy before render and after recovery`, async () => {
      start("slp"); confirmPracticeSources();
      if (state === "deleted") { recordSnapshot(collection, "change"); render(); }
      const held = openPracticeCopy();
      recordSnapshot(collection, state); await held(); expect(h.copy).not.toHaveBeenCalled();
      recordSnapshot(collection, "confirmed"); await held(); expect(h.copy).not.toHaveBeenCalled();
      render(); await openPracticeCopy()(); expect(h.copy).toHaveBeenCalledOnce();
    });
  }
  for (const collection of ["milestones", "behaviorLogs"] as const) it(`${collection}: same-tab sandbox storage changes retire the actual held copy`, async () => {
    h.remote = false; h.query = ""; h.storage.set("arbor.consultExportAudience", "slp");
    render(); const held = openPracticeCopy();
    h.storage.set(`arbor.${collection}.${h.child}`, JSON.stringify([{ id: "external-same-tab-record" }]));
    await held(); expect(h.copy).not.toHaveBeenCalled();
  });
  it("an actual teacher click invalidates a held practice copy before effects or host render", async () => {
    start("slp"); confirmPracticeSources();
    byId(render().summary, "consult-practice-summary").props.onToggle({ currentTarget: { open: true } });
    const current = render();
    const held = byId(current.summary, "consult-practice-copy").props.onClick as () => Promise<void>;
    const audienceClick = (audience: string) => find(current.packet, el => el.props.role === "radio" && React.Children.toArray(el.props.children).includes(translate(`elev.carehonesty.consult.audience.${audience}`))).props.onClick();
    // Positive control from this exact render: no host rerender can retire the
    // callback before the selector boundary we are trying to exercise.
    await held(); expect(h.copy).toHaveBeenCalledOnce(); h.copy.mockClear();
    audienceClick("teacher");
    await held(); expect(h.copy).not.toHaveBeenCalled();
    audienceClick("slp"); await held(); expect(h.copy).not.toHaveBeenCalled();
    audienceClick("teacher");
    render(); expect(render().summary).toBeNull();
    setAudience("slp"); confirmPracticeSources(); await held(); expect(h.copy).not.toHaveBeenCalled();
    await openPracticeCopy()(); expect(h.copy).toHaveBeenCalledOnce();
  });
  it("negative control: removing synchronous audience publication exposes the same-render held copy", async () => {
    start("slp"); confirmPracticeSources();
    byId(render().summary, "consult-practice-summary").props.onToggle({ currentTarget: { open: true } });
    const current = render();
    const held = byId(current.summary, "consult-practice-copy").props.onClick as () => Promise<void>;
    const teacher = find(current.packet, el => el.props.role === "radio" && React.Children.toArray(el.props.children).includes(translate("elev.carehonesty.consult.audience.teacher")));
    // Seed the former delayed-effect-only behavior at the actual receipt seam.
    h.audienceReceipt.publish = noop;
    teacher.props.onClick();
    await held(); expect(h.copy).toHaveBeenCalledOnce();
  });
  it("prefill invalidation blocks held copy before the pending teacher prefill is consumed", async () => {
    start("slp"); confirmPracticeSources(); const held = openPracticeCopy();
    // The real context request seam invalidates synchronously, before setState.
    requestPrefill({ audience: "teacher" });
    await held(); expect(h.copy).not.toHaveBeenCalled();
    render(); expect(render().summary).toBeNull();
  });
});

describe("targeted Consult owns every outgoing action, including the body portal", () => {

  it("keeps the clinician practice disclosure out of the teacher flow and follows the chosen audience", () => {
    const teacher = start();
    expect(find(teacher.outer, el => el.type === PracticeSummary)).toBeUndefined();
    setAudience("slp");
    expect(find(render().outer, el => el.type === PracticeSummary)).toBeDefined();
    setAudience("teacher");
    expect(find(render().outer, el => el.type === PracticeSummary)).toBeUndefined();
  });
  for (const loss of ["cache", "pending", "error", "deleted", "unconfirmed"] as const) it(`${loss}: retires an open review and held approval before React commits, preserves the edited draft on recovery`, () => {
    start();
    byId(render().brief, "school-brief-edit").props.onClick();
    find(render().brief, el => el.type === "textarea").props.onChange({ target: { value: "My unsaved teacher note" } });
    const approve = openReview();
    if (loss === "deleted") source([]);
    else if (loss === "unconfirmed") source([{ ...visit(), status: "requested" }]);
    else source([visit()], { fromCache: loss === "cache", hasPendingWrites: loss === "pending", error: loss === "error" });
    approve(); expect(h.print).not.toHaveBeenCalled();
    const blocked = render();
    expect(elements(blocked.outer).some(el => el.props.hidden && el.props.inert)).toBe(true);
    expect(find(blocked.brief, el => el.type === Modal).props.open).toBe(false);
    source(); render(); approve(); expect(h.print).not.toHaveBeenCalled();
    expect(find(render().brief, el => el.type === "textarea").props.value).toBe("My unsaved teacher note");
    openReview()(); expect(h.print).toHaveBeenCalledTimes(1);
  });
  it("checks target time at the final action, and recovery cannot revive an expired review", () => {
    start(); const approve = openReview(); const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 3 * 86400000);
    approve(); expect(h.print).not.toHaveBeenCalled();
    expect(find(render().brief, el => el.type === Modal).props.open).toBe(false);
    clock.mockReturnValue(now); render(); approve(); expect(h.print).not.toHaveBeenCalled();
    openReview()(); expect(h.print).toHaveBeenCalledTimes(1);
  });
  it("does not revive approval when source loss and recovery both precede the next render", () => {
    start(); const approve = openReview(); source([], { fromCache: true }); source();
    approve(); expect(h.print).not.toHaveBeenCalled(); render(); approve(); expect(h.print).not.toHaveBeenCalled();
    openReview()(); expect(h.print).toHaveBeenCalledTimes(1);
  });
  it("consumes each review once; closing or editing retires a captured approval", () => {
    start(); const approve = openReview(); approve(); approve(); expect(h.print).toHaveBeenCalledTimes(1);
    const closed = openReview(); find(render().brief, el => el.type === Modal).props.onClose(); closed(); expect(h.print).toHaveBeenCalledTimes(1);
    const edited = openReview(); byId(render().brief, "school-brief-edit").props.onClick(); find(render().brief, el => el.type === "textarea").props.onChange({ target: { value: "Another reviewed note" } }); edited(); expect(h.print).toHaveBeenCalledTimes(1);
    openReview()(); expect(h.print).toHaveBeenCalledTimes(2);
  });
  for (const change of ["child", "account", "appointment"] as const) it(`${change} A-B-A never revives an old approval`, () => {
    start(); const approveA = openReview();
    if (change === "child") h.child = "b"; else if (change === "account") h.account = "parent-b"; else h.query = "appointment=other-visit";
    render(); source([visit(change === "appointment" ? "other-visit" : "teacher-visit")]); render(); approveA(); expect(h.print).not.toHaveBeenCalled();
    h.child = "a"; h.account = "parent-a"; h.query = "appointment=teacher-visit"; render(); source(); render(); approveA(); expect(h.print).not.toHaveBeenCalled();
    openReview()(); expect(h.print).toHaveBeenCalledTimes(1);
  });
  for (const action of ["consult-copy", "consult-pdf", "consult-send-trusted"] as const) it(`${action}: held clinician callbacks cannot bypass the source or renewed review`, async () => {
    start("slp"); const packet = approvePacket(); const held = byId(packet, action).props.onClick;
    source([], { hasPendingWrites: true }); await held();
    expect(h.copy).not.toHaveBeenCalled(); expect(h.pdf).not.toHaveBeenCalled(); expect(window.location.href).toBe("");
    render(); source([visit("teacher-visit", "slp")]); render(); await held(); expect(h.copy).not.toHaveBeenCalled(); expect(h.pdf).not.toHaveBeenCalled(); expect(window.location.href).toBe("");
    const fresh = approvePacket(); await byId(fresh, action).props.onClick();
    if (action === "consult-copy") expect(h.copy).toHaveBeenCalledTimes(1);
    if (action === "consult-pdf") expect(h.pdf).toHaveBeenCalledTimes(1);
    if (action === "consult-send-trusted") expect(window.location.href).toMatch(/^mailto:/);
  });
  it("unchanged current clinician review permits repeated deliberate exports", async () => {
    start("slp"); approvePacket(); const copy = byId(render().packet, "consult-copy").props.onClick;
    await copy(); await copy(); expect(h.copy).toHaveBeenCalledTimes(2);
  });
  it("a late generator response cannot replace the retained draft after source loss", async () => {
    start(); let resolve!: (value: unknown) => void;
    h.generate.mockReturnValue(new Promise(value => { resolve = value; }));
    const pending = byId(render().brief, "school-brief-ai-draft").props.onClick();
    source([], { error: true }); render(); resolve({ overview: "Retired generated text" }); await pending;
    source(); render(); expect(JSON.stringify(render().brief)).not.toContain("Retired generated text");
  });
  it("retired generation callbacks make no provider call", () => {
    start(); const generate = byId(render().brief, "school-brief-ai-draft").props.onClick;
    source([], { error: true }); generate(); expect(h.generate).not.toHaveBeenCalled();
  });
  it("leaving the teacher branch or unmounting retires held approvals", () => {
    start(); const approve = openReview(); setAudience("slp"); approve(); expect(h.print).not.toHaveBeenCalled();
    setAudience("teacher"); const next = openReview(); [...h.owners.keys()].forEach(dispose); next(); expect(h.print).not.toHaveBeenCalled();
  });
  it("untargeted Consult retains its independent export flow during appointment source errors", () => {
    h.query = ""; h.storage.set("arbor.consultExportAudience", "teacher"); render(); source([], { error: true }); render(); openReview()(); expect(h.print).toHaveBeenCalledTimes(1);
  });
  it("a default SchoolBrief caller can review and export without a target guard", () => {
    let brief = owner("default", SchoolBrief); find(brief, el => el.type === "button" && el.props["data-primary-move"]).props.onClick();
    brief = owner("default", SchoolBrief); const modal = find(brief, el => el.type === Modal); expect(modal.props.open).toBe(true);
    find(modal.props.children, el => el.type === "button" && String(el.props.className).includes("gap-2")).props.onClick(); expect(h.print).toHaveBeenCalledTimes(1);
  });
});


describe("collection read receipt used by targeted egress", () => {
  const read = () => {
    const value = owner("receipt", () => useChildCollection<{ id: string }>(h.child, "appointments", { trackConfirmation: true }));
    h.effects.splice(0).forEach(effect => effect());
    return value as ReturnType<typeof useChildCollection<{ id: string }>>;
  };
  it("only the committed receipt is current; unchanged rerenders do not retire it", () => {
    read(); source(); const first = read(); expect(first.isCurrent()).toBe(true); read(); expect(first.isCurrent()).toBe(true);
    source(); expect(first.isCurrent()).toBe(false); expect(read().isCurrent()).toBe(true);
    const next = read(); dispose("receipt"); expect(next.isCurrent()).toBe(false);
  });
  it("retire receipts across account and child A-B-A even before a new listener settles", () => {
    read(); source(); const first = read(); h.child = "b"; read(); h.child = "a"; read(); expect(first.isCurrent()).toBe(false);
    source(); const childA = read(); h.account = "parent-b"; read(); h.account = "parent-a"; read(); expect(childA.isCurrent()).toBe(false);
    source(); expect(read().isCurrent()).toBe(true);
  });
  it("revalidates existing sandbox storage without trusting changed, missing, or malformed rows", async () => {
    h.remote = false; h.storage.set("arbor.appointments.a", JSON.stringify([visit()])); read(); const first = read(); expect(first.isCurrent()).toBe(true);
    h.storage.set("arbor.appointments.a", "[]"); expect(first.isCurrent()).toBe(false);
    h.storage.set("arbor.appointments.a", "broken"); expect(first.isCurrent()).toBe(false);
    h.storage.delete("arbor.appointments.a"); expect(first.isCurrent()).toBe(false);
    await first.upsert({ id: "new" }); expect(first.isCurrent()).toBe(false); expect(read().isCurrent()).toBe(true);
  });
});
