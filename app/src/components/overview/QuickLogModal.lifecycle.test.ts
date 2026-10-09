import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { File as NodeFile } from "node:buffer";
import ts from "typescript";
import * as taxonomy from "../../content/behaviorTaxonomy";
import { createCaptureSession } from "../../lib/captureSession";
import { undoSavedCapture } from "../../lib/savedCaptureUndo";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const modalSource = read("components/overview/QuickLogModal.tsx");
const contextSource = ts.createSourceFile("ArborContext.tsx", read("context/ArborContext.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name: string) {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === name)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(contextSource);
  if (found.length !== 1) throw new Error(`Expected production ${name} once`);
  return found[0].getText(contextSource);
}
type View = { type: string | symbol | ((props: any) => any); props: Record<string, any> };
const compile = (source: string) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
} }).outputText;


/** Repository-style hook/callback harness. The actual production callbacks and
 * rendered props run with controlled I/O. It does not claim DOM, browser focus,
 * speech-permission or React scheduling evidence. No network boundary can run. */
function renderer(code: string, imports: Record<string, unknown> = {}) {
  const slots: any[] = [];
  let cursor = 0, dirty = false, disposed = false;
  let effects: (() => void)[] = [];
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createElement: (type: View["type"], attrs: any, ...children: any[]): View => ({ type, props: { ...attrs, children } }),
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => {
        if (disposed) throw new Error("State update after unmount");
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef: (initial: any) => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect: (callback: () => void | (() => void), deps?: unknown[]) => {
      const index = cursor++, previous = slots[index];
      if (!previous || !same(previous.deps, deps)) {
        const slot = { deps, cleanup: undefined as void | (() => void) };
        slots[index] = slot;
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = callback(); });
      }
    },
  };
  const module = { exports: {} as { default: (props: any) => any } };
  new Function("require", "module", "exports", "File", code)((name: string) => {
    if (name === "react") return { __esModule: true, default: react, ...react };
    if (!(name in imports)) throw new Error(`Unmocked boundary: ${name}`);
    return imports[name];
  }, module, module.exports, NodeFile);
  return {
    render: (props: any) => {
      for (let index = 0; index < 20; index++) {
        cursor = 0; dirty = false; effects = [];
        const result = module.exports.default(props);
        effects.forEach(run => run());
        if (!dirty) return result;
      }
      throw new Error("Unbounded hook rerenders");
    },
    unmount: () => { slots.forEach(slot => slot?.cleanup?.()); disposed = true; },
  };
}
function nodes(tree: any): View[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  return [tree, ...nodes(tree.props.children)];
}
function text(tree: any): string {
  if (Array.isArray(tree)) return tree.map(text).filter(Boolean).join(" ");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
function one(tree: View, predicate: (node: View) => boolean) {
  const matches = nodes(tree).filter(predicate);
  expect(matches).toHaveLength(1);
  return matches[0];
}
const button = (tree: View, label: string) => one(tree, node => node.type === "button" && (node.props["aria-label"] === label || text(node) === label));
const tick = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const modalCode = compile(modalSource);
const formEvent = () => ({ preventDefault: vi.fn() });
const saved = { id: "log-1", behaviorType: "Moment", trigger: "Built a tower", timestamp: "2026-10-09T09:00:00Z", durationMinutes: 0, resolved: true };
function captureHarness(options: { save?: () => Promise<any>; edit?: boolean; child?: string } = {}) {
  const state: Record<string, any> = {
    newLogType: options.edit ? "Moment" : taxonomy.DEFAULT_BEHAVIOR_TYPE, newLogIntensity: 3,
    newLogTrigger: "Built a tower", newLogResponse: "", newLogNotes: "", newLogContext: "", newLogDuration: 0, newLogPhoto: "",
    childProfile: { id: options.child ?? "child-a", name: "Dylan" }, behaviorLogs: [saved], milestones: [],
    addMoment: vi.fn(options.save ?? (async () => saved)), handleAddLog: vi.fn(options.save ?? (async () => saved)),
    deleteLog: vi.fn(async () => {}), seedCoach: vi.fn(), cancelEditLog: vi.fn(), setMilestoneObservation: vi.fn(async () => {}), fileMomentOnShelf: vi.fn(async () => {}),
  };
  for (const key of Object.keys(state).filter(key => key.startsWith("newLog"))) state[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value: any) => { state[key] = value; };
  const photos: ReturnType<typeof deferred<string>>[] = [], extracts: ReturnType<typeof deferred<any>>[] = [], speech: any[] = [];
  const toast = vi.fn(), close = vi.fn();
  const source = ts.createSourceFile("QuickLogModal.tsx", modalSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports: Record<string, any> = {};
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !node.importClause || node.importClause.isTypeOnly) continue;
    const name = (node.moduleSpecifier as ts.StringLiteral).text;
    if (name === "react") continue;
    const values: Record<string, any> = {};
    if (node.importClause.name) values.default = function Boundary() { return null; };
    const bindings = node.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const spec of bindings.elements) if (!spec.isTypeOnly) values[spec.propertyName?.text ?? spec.name.text] = vi.fn(() => null);
    imports[name] = values;
  }
  Object.assign(imports, {
    "../../context/ArborContext": { useArbor: () => state },
    "../../context/LanguageContext": { useLanguage: () => ({ t: (key: string) => key, uiLang: "en" }) },
    "../../context/ToastContext": { useToast: () => ({ toast }) },
    "../../content/behaviorTaxonomy": taxonomy,
    "../../lib/captureSession": { createCaptureSession },
    "../../lib/savedCaptureUndo": { undoSavedCapture },
    "../../lib/image": { fileToThumbnail: () => { const pending = deferred<string>(); photos.push(pending); return pending.promise; } },
    "../../lib/api": { api: { extractLog: () => { const pending = deferred<any>(); extracts.push(pending); return pending.promise; } }, getAiLanguage: () => "en", EscalationRequiredError: class extends Error {} },
    "../../lib/speech": { speechSupported: () => true, startDictation: (callbacks: any) => { const stop = vi.fn(); speech.push({ callbacks, stop }); return stop; } },
  });
  const view = renderer(modalCode, imports);
  const props = { open: true, onClose: close, mode: "text", ...(options.edit ? { editLogId: saved.id } : {}) };
  return { state, props, photos, extracts, speech, toast, close, view, render: () => view.render(props) };
}

function contextHarness(existing?: Record<string, any>) {
  const setters = Object.fromEntries(["Type", "Intensity", "Duration", "Trigger", "Response", "Notes", "Context", "Photo"].map(key => [`setNewLog${key}`, vi.fn()]));
  const scope = { childId: "child-a" };
  const env: Record<string, any> = { ...taxonomy, ...setters,
    childProfile: { id: "child-a" }, captureScope: scope, captureScopeRef: { current: scope },
    captureWritesRef: { current: new Set() }, captureRevisionRef: { current: 0 }, currentCaptureDraftRef: { current: "draft-a" }, editingLogSnapshotRef: { current: existing ?? null },
    newLogType: "Moment", newLogTrigger: "Corrected words", newLogResponse: "", newLogNotes: "A detail", newLogPhoto: "photo", newLogContext: "", newLogDuration: 0, newLogIntensity: 3,
    editingLogId: existing?.id ?? null, behaviorLogs: [], setEditingLogId: vi.fn(),
    track: vi.fn(), trackCaptureSaved: vi.fn(), toast: vi.fn(), t: (key: string) => key,
    logsCol: { upsert: vi.fn(async (_row: any) => {}), remove: vi.fn(async (_id: string) => {}) },
  };
  const code = compile(`export default function Boundaries({ ${Object.keys(env).join(",")} }) {
    ${["resetLogForm", "handleAddLog", "addMoment", "deleteLog"].map(declaration).join("\n")}
    return { handleAddLog, addMoment, deleteLog };
  }`);
  const module = { exports: {} as any };
  new Function("module", "exports", code)(module, module.exports);
  return { env, ...module.exports.default(env) };
}

describe("capture durability — actual production callbacks", () => {
  it("does not clear, acknowledge or duplicate a pending write; rejection keeps the draft for retry", async () => {
    const h = contextHarness(), pending = deferred<void>();
    h.env.logsCol.upsert.mockImplementationOnce(() => pending.promise);
    const first = h.handleAddLog(formEvent());
    expect(await h.handleAddLog(formEvent())).toBeNull();
    expect(h.env.logsCol.upsert).toHaveBeenCalledTimes(1);
    expect(h.env.setNewLogTrigger).not.toHaveBeenCalled();
    expect(h.env.trackCaptureSaved).not.toHaveBeenCalled();
    pending.reject(new Error("offline"));
    expect(await first).toBeNull();
    expect(h.env.setNewLogTrigger).not.toHaveBeenCalled();
    expect(h.env.toast).toHaveBeenCalledWith("companion.capture.saveError", "error");
    expect(await h.handleAddLog(formEvent())).toMatchObject({ trigger: "Corrected words" });
    expect(h.env.trackCaptureSaved).toHaveBeenCalledTimes(1);
    expect(h.env.setNewLogTrigger).toHaveBeenCalledWith("");
  });
  it("preserves classification, original timestamp and every provenance field when editing an older source", async () => {
    const original = { ...saved, shelf: "words", milestoneId: "ms-7", promptKey: "prompt", conversationProposalId: "proposal", sourceExcerpt: "parent confirmed", authorUid: "co-parent", captureSource: "co-parent", shareGrantId: "grant", resolutionNotes: "settled", customLegacyField: "preserved" };
    const h = contextHarness(original);
    const result = await h.handleAddLog(formEvent());
    expect(result).toMatchObject({ ...original, trigger: "Corrected words", notes: "A detail", photoAttachment: "photo" });
    expect(result.intensity).toBeUndefined();
    expect(h.env.trackCaptureSaved).not.toHaveBeenCalled();
  });
  it("never borrows incident context for a plain moment, and honors explicit place and notes", async () => {
    const h = contextHarness();
    const noPlace = await h.addMoment("Built blocks");
    expect(noPlace).not.toHaveProperty("context");
    expect(await h.addMoment("At school", { context: "School", notes: "With Sam" })).toMatchObject({ context: "School", notes: "With Sam" });
  });
  it("one failed write, one message: the seam toasts unless the caller shows the failure itself", async () => {
    const h = contextHarness();
    h.env.logsCol.upsert.mockRejectedValue(new Error("offline"));
    expect(await h.addMoment("Built blocks", { callerShowsFailure: true })).toBeNull();
    expect(await h.handleAddLog(formEvent(), { callerShowsFailure: true })).toBeNull();
    expect(h.env.toast).not.toHaveBeenCalled();
    // A caller with no failure UI of its own (a Keep button) still hears it, once.
    expect(await h.addMoment("Built blocks")).toBeNull();
    expect(h.env.toast).toHaveBeenCalledTimes(1);
    expect(h.env.toast).toHaveBeenCalledWith("companion.capture.saveError", "error");
  });
  it("the caller's flag never reaches the stored row", async () => {
    const h = contextHarness();
    expect(await h.addMoment("Built blocks", { callerShowsFailure: true })).not.toHaveProperty("callerShowsFailure");
    expect(h.env.logsCol.upsert.mock.calls[0][0]).not.toHaveProperty("callerShowsFailure");
  });
  it("retires A → B → A writes and does not erase a replacement draft", async () => {
    const h = contextHarness(), pending = deferred<void>();
    h.env.logsCol.upsert.mockImplementationOnce(() => pending.promise);
    const first = h.handleAddLog(formEvent());
    h.env.captureScopeRef.current = { childId: "child-a" };
    pending.resolve();
    expect(await first).toBeNull();
    expect(h.env.setNewLogTrigger).not.toHaveBeenCalled();
    expect(h.env.trackCaptureSaved).not.toHaveBeenCalled();
    expect(await h.addMoment("old callback")).toBeNull();
  });
  it("returns the deletion promise so Undo cannot acknowledge a rejected deletion", async () => {
    const h = contextHarness(), pending = deferred<void>();
    h.env.logsCol.remove.mockImplementation(() => pending.promise);
    const result = undoSavedCapture(saved.id, { readLogIds: () => [saved.id], removeLog: h.deleteLog });
    pending.reject(new Error("offline"));
    await expect(result).rejects.toThrow("offline");
  });
});

describe("one capture sheet — real rendered handlers with deferred I/O", () => {
  it("keeps words and photo while saving/failing, prevents double submission, and retries to one receipt", async () => {
    const pending = deferred<any>();
    const h = captureHarness({ save: () => pending.promise });
    let tree = h.render();
    const first = one(tree, n => n.props["data-testid"] === "quicklog-moment-form").props.onSubmit(formEvent());
    await one(tree, n => n.props["data-testid"] === "quicklog-moment-form").props.onSubmit(formEvent());
    expect(h.state.addMoment).toHaveBeenCalledTimes(1);
    expect(h.state.newLogTrigger).toBe("Built a tower");
    expect(nodes(h.render()).some(n => n.props["data-testid"] === "quicklog-reply")).toBe(false);
    pending.reject(new Error("offline")); await first;
    tree = h.render();
    expect(one(tree, n => n.props.role === "alert")).toBeTruthy();
    expect(h.state.newLogTrigger).toBe("Built a tower");
    h.state.addMoment.mockResolvedValueOnce(saved);
    await one(tree, n => n.props["data-testid"] === "quicklog-moment-form").props.onSubmit(formEvent());
    expect(nodes(h.render()).some(n => n.props["data-testid"] === "quicklog-reply")).toBe(true);
  });
  it("a failed save shows ONE message: the inline alert beside the kept draft, not the seam's toast too", async () => {
    // Production addMoment resolves null on a failed write; it never throws.
    const h = captureHarness({ save: async () => null });
    await one(h.render(), n => n.props["data-testid"] === "quicklog-moment-form").props.onSubmit(formEvent());
    expect(h.state.addMoment).toHaveBeenCalledWith("Built a tower", expect.objectContaining({ callerShowsFailure: true }));
    expect(text(one(h.render(), n => n.props.role === "alert"))).toBe("companion.capture.saveError");
    expect(h.state.newLogTrigger).toBe("Built a tower");
    expect(h.toast).not.toHaveBeenCalled();
  });
  it("the confirm (edit/incident) path hands the same failure ownership to the sheet", async () => {
    const h = captureHarness({ edit: true, save: async () => null });
    await one(h.render(), n => n.props["data-testid"] === "quicklog-moment-form").props.onSubmit(formEvent());
    expect(h.state.handleAddLog).toHaveBeenCalledWith(expect.anything(), { callerShowsFailure: true });
    expect(text(one(h.render(), n => n.props.role === "alert"))).toBe("companion.capture.saveError");
    expect(h.toast).not.toHaveBeenCalled();
  });
  it("neutral edit stays neutral and uses the edit seam instead of creating a second moment", async () => {
    const h = captureHarness({ edit: true });
    const tree = h.render();
    expect(nodes(tree).some(n => n.props.id === "quick-log-type")).toBe(false);
    await one(tree, n => n.props["data-testid"] === "quicklog-moment-form").props.onSubmit(formEvent());
    expect(h.state.handleAddLog).toHaveBeenCalledTimes(1);
    expect(h.state.addMoment).not.toHaveBeenCalled();
  });
  it("late image preparation cannot cross close/reopen, A → B → A, or unmount", async () => {
    for (const retire of ["reopen", "child", "unmount"]) {
      const h = captureHarness();
      const tree = h.render();
      one(tree, n => n.props["data-testid"] === "quicklog-photo-input").props.onChange({ target: { files: [new NodeFile(["x"], "x.png")], value: "x" } });
      if (retire === "reopen") { h.props.open = false; h.render(); h.props.open = true; h.render(); }
      if (retire === "child") { h.state.childProfile = { id: "child-b" }; h.render(); h.state.childProfile = { id: "child-a" }; h.render(); }
      if (retire === "unmount") h.view.unmount();
      h.photos[0].resolve("old-photo"); await tick();
      expect(h.state.newLogPhoto).toBe("");
    }
  });
  it("retired dictation and extraction cannot overwrite a new child's words", async () => {
    const h = captureHarness(); let tree = h.render();
    const voice = one(tree, n => n.type === "button" && n.props.onClick?.name === "startVoice");
    voice.props.onClick();
    h.speech[0].callbacks.onResult("A long parent sentence describing a very difficult transition");
    expect(h.extracts).toHaveLength(1);
    h.state.childProfile = { id: "child-b" }; h.state.newLogTrigger = "B's words"; h.render();
    h.state.childProfile = { id: "child-a" }; h.render();
    h.speech[0].callbacks.onResult("Old dictation");
    h.extracts[0].resolve({ behaviorType: "Aggression", trigger: "Old extracted words", intensity: 4 });
    await tick();
    expect(h.state.newLogTrigger).toBe("B's words");
    expect(h.speech[0].stop).toHaveBeenCalled();
  });
  it("failed Undo keeps its receipt and retry; successful Undo alone closes", async () => {
    const h = captureHarness();
    await one(h.render(), n => n.props["data-testid"] === "quicklog-moment-form").props.onSubmit(formEvent());
    h.state.deleteLog.mockRejectedValueOnce(new Error("offline"));
    one(h.render(), n => n.props["data-testid"] === "quicklog-reply-undo").props.onClick(); await tick();
    expect(h.close).not.toHaveBeenCalled();
    expect(nodes(h.render()).some(n => n.props["data-testid"] === "quicklog-reply")).toBe(true);
    one(h.render(), n => n.props["data-testid"] === "quicklog-reply-undo").props.onClick(); await tick();
    expect(h.close).toHaveBeenCalledTimes(1);
  });
});
