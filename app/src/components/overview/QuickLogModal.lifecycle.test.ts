import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { File as NodeFile } from "node:buffer";
import ts from "typescript";
import * as taxonomy from "../../content/behaviorTaxonomy";
import type { ChildProfile } from "../../types";
import * as captureKeep from "../../lib/kept/captureKeep";
import { keptThings } from "../../lib/kept/keptThings";
import { parentWords } from "../../lib/recordCounts";
import { toObservations } from "../../lib/observations";
import { translate } from "../../lib/i18n";
import { createCaptureSession } from "../../lib/captureSession";
import { undoSavedCapture } from "../../lib/savedCaptureUndo";
import { routeHash } from "../../lib/routes";

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
    useCallback: (callback: unknown) => callback,
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
    render: (props: any, beforeEffects?: (result: any) => void) => {
      for (let index = 0; index < 20; index++) {
        cursor = 0; dirty = false; effects = [];
        const result = module.exports.default(props);
        beforeEffects?.(result);
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
function captureHarness(options: { save?: () => Promise<any>; edit?: boolean; child?: string; review?: "ai-draft"; text?: string; initialText?: string; lang?: "en" | "he"; gender?: ChildProfile["gender"] } = {}) {
  const state: Record<string, any> = {
    newLogType: options.edit ? "Moment" : taxonomy.DEFAULT_BEHAVIOR_TYPE, newLogIntensity: 3,
    newLogTrigger: options.text ?? "Built a tower", newLogResponse: "", newLogNotes: "", newLogContext: "", newLogDuration: 0, newLogPhoto: "",
    childProfile: { id: options.child ?? "child-a", name: "Dylan", gender: options.gender }, behaviorLogs: [saved], milestones: [],
    addMoment: vi.fn(options.save ?? (async () => saved)), handleAddLog: vi.fn(options.save ?? (async () => saved)),
    deleteLog: vi.fn(async () => {}), seedCoach: vi.fn(), cancelEditLog: vi.fn(), setMilestoneObservation: vi.fn(async () => {}), fileMomentOnShelf: vi.fn(async () => {}),
  };
  for (const key of Object.keys(state).filter(key => key.startsWith("newLog"))) state[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value: any) => { state[key] = value; };
  const starterModule = { exports: {} as any };
  const starterSetters = Object.fromEntries(Object.entries(state).filter(([key]) => key.startsWith("setNewLog")));
  const starterCode = compile(`export default function Bind({ ${Object.keys(starterSetters).join(",")} }) { ${declaration("autofillLogTemplate")} return autofillLogTemplate; }`);
  new Function("module", "exports", starterCode)(starterModule, starterModule.exports);
  state.autofillLogTemplate = starterModule.exports.default(starterSetters);
  const photos: ReturnType<typeof deferred<string>>[] = [], extracts: ReturnType<typeof deferred<any>>[] = [], speech: any[] = [];
  const toast = vi.fn(), close = vi.fn();
  class EscalationRequiredError extends Error { category = "self-harm"; }
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
    "../../context/LanguageContext": { useLanguage: () => ({ t: (key: string) => options.lang ? translate(options.lang, key) : key, uiLang: options.lang ?? "en" }) },
    "../../context/ToastContext": { useToast: () => ({ toast }) },
    "../../content/behaviorTaxonomy": taxonomy,
    "../../lib/captureSession": { createCaptureSession },
    "../../lib/kept/captureKeep": captureKeep,
    "../../lib/savedCaptureUndo": { undoSavedCapture },
    "../../lib/routes": { routeHash },
    "../../lib/image": { fileToThumbnail: () => { const pending = deferred<string>(); photos.push(pending); return pending.promise; } },
    "../../lib/api": { api: { extractLog: () => { const pending = deferred<any>(); extracts.push(pending); return pending.promise; } }, getAiLanguage: () => "en", EscalationRequiredError },
    "../../safety/escalation": { escalationCategories: [{ category: "self-harm", label: "Safety", resources: [] }], renderEscalationMarkdown: () => "Seek immediate support" },
    "../../lib/speech": { speechSupported: () => true, startDictation: (callbacks: any) => { const stop = vi.fn(); speech.push({ callbacks, stop }); return stop; } },
  });
  const view = renderer(modalCode, imports);
  const props = { open: true, onClose: close, mode: "text", ...(options.initialText !== undefined ? { initialText: options.initialText } : {}), ...(options.edit ? { editLogId: saved.id } : {}), ...(options.review ? { review: options.review } : {}) };
  return { state, props, photos, extracts, speech, toast, close, view, EscalationRequiredError, render: () => view.render(props) };
}

function contextHarness(existing?: Record<string, any>, draft?: Record<string, any>) {
  const setters = Object.fromEntries(["Type", "Intensity", "Duration", "Trigger", "Response", "Notes", "Context", "Photo"].map(key => [`setNewLog${key}`, vi.fn()]));
  const scope = { childId: "child-a" };
  const env: Record<string, any> = { ...taxonomy, ...setters,
    childProfile: { id: "child-a" }, captureScope: scope, captureScopeRef: { current: scope },
    captureWritesRef: { current: new Set() }, captureRevisionRef: { current: 0 }, currentCaptureDraftRef: { current: "draft-a" }, editingLogSnapshotRef: { current: existing ?? null },
    newLogType: "Moment", newLogTrigger: "Corrected words", newLogResponse: "", newLogNotes: "A detail", newLogPhoto: "photo", newLogContext: "", newLogDuration: 0, newLogIntensity: 3,
    editingLogId: existing?.id ?? null, behaviorLogs: [], setEditingLogId: vi.fn(), setLastSavedBehavior: vi.fn(),
    track: vi.fn(), trackCaptureSaved: vi.fn(), toast: vi.fn(), t: (key: string) => key,
    logsCol: { upsert: vi.fn(async (_row: any) => {}), remove: vi.fn(async (_id: string) => {}) },
  };
  Object.assign(env, draft);
  const code = compile(`export default function Boundaries({ ${Object.keys(env).join(",")} }) {
    ${["resetLogForm", "dismissBehaviorEcho", "handleAddLog", "addMoment", "deleteLog"].map(declaration).join("\n")}
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
    expect(h.env.setLastSavedBehavior).not.toHaveBeenCalled();
    pending.reject(new Error("offline"));
    expect(await first).toBeNull();
    expect(h.env.setNewLogTrigger).not.toHaveBeenCalled();
    expect(h.env.toast).toHaveBeenCalledWith("companion.capture.saveError", "error");
    expect(h.env.setLastSavedBehavior).not.toHaveBeenCalled();
    expect(await h.handleAddLog(formEvent())).toMatchObject({ trigger: "Corrected words" });
    expect(h.env.trackCaptureSaved).toHaveBeenCalledTimes(1);
    expect(h.env.setLastSavedBehavior).toHaveBeenCalledTimes(1);
    expect(h.env.setLastSavedBehavior).toHaveBeenCalledWith({ childId: "child-a", id: expect.any(String) });
    expect(h.env.setNewLogTrigger).toHaveBeenCalledWith("");
  });
  it("preserves classification, original timestamp and every provenance field when editing an older source", async () => {
    const original = { ...saved, shelf: "words", milestoneId: "ms-7", promptKey: "prompt", conversationProposalId: "proposal", sourceExcerpt: "parent confirmed", authorUid: "co-parent", captureSource: "co-parent", shareGrantId: "grant", resolutionNotes: "settled", customLegacyField: "preserved" };
    const h = contextHarness(original);
    const result = await h.handleAddLog(formEvent());
    expect(result).toMatchObject({ ...original, trigger: "Corrected words", notes: "A detail", photoAttachment: "photo" });
    expect(result.intensity).toBeUndefined();
    expect(h.env.trackCaptureSaved).not.toHaveBeenCalled();
    expect(h.env.setLastSavedBehavior).toHaveBeenCalledTimes(1);
    const retire = h.env.setLastSavedBehavior.mock.calls[0][0];
    expect(retire({ childId: "child-a", id: original.id })).toBeNull();
    expect(retire({ childId: "child-a", id: "newer-save" })).toEqual({ childId: "child-a", id: "newer-save" });
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
    expect(h.env.setLastSavedBehavior).not.toHaveBeenCalled();
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
  it("safe situation starters preserve the parent's words and cannot bypass valid input and review", async () => {
    const h = captureHarness();
    one(h.render(), n => n.type === "input" && n.props.type === "checkbox").props.onChange({ target: { checked: true } });
    const starter = one(h.render(), n => n.props["data-log-starter"] === "screen");
    starter.props.onClick();
    expect(h.state.newLogType).toBe("Screentime Dispute");
    expect(h.state.newLogTrigger).toBe("Built a tower");
    expect(h.state.newLogResponse).toBe("");
    expect(h.state.newLogNotes).toBe("");
    expect(h.state.newLogIntensity).toBe(3);
    expect(h.state.newLogDuration).toBe(0);
    one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(h.toast).toHaveBeenCalledWith("ql.errToast", "error");
    expect(h.state.handleAddLog).not.toHaveBeenCalled();
    h.state.newLogResponse = "Offered two choices";
    one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    const review = one(h.render(), n => typeof n.props.onConfirm === "function");
    expect(review.props.source).toBe("text");
    expect(review.props.rows.find((row: any) => row.label === "ql.review.response").value).toBe("Offered two choices");
    expect(h.state.handleAddLog).not.toHaveBeenCalled();
    await review.props.onConfirm(formEvent());
    expect(h.state.handleAddLog).toHaveBeenCalledTimes(1);
  });
  it("an extracted voice draft is review-only, with truthful provenance and editable fields before the one confirmed write", async () => {
    const h = captureHarness();
    one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
    h.speech[0].callbacks.onResult("A long parent sentence describing a very difficult transition");
    expect(h.state.handleAddLog).not.toHaveBeenCalled();
    h.extracts[0].resolve({ behaviorType: "Transition Refusal", trigger: "Shoes on", response: "Stayed close", intensity: 4, durationMinutes: 5 });
    await tick();
    let review = one(h.render(), n => typeof n.props.onConfirm === "function");
    expect(review.props.source).toBe("ai-draft");
    expect(review.props.intensity).toBe(4);
    expect(nodes(h.render()).some(n => n.type === "form")).toBe(false);
    expect(h.state.handleAddLog).not.toHaveBeenCalled();
    review.props.rows.find((row: any) => row.label === "ql.review.response").onChange("Offered two choices");
    review = one(h.render(), n => typeof n.props.onConfirm === "function");
    expect(review.props.rows.find((row: any) => row.label === "ql.review.response").value).toBe("Offered two choices");
    await review.props.onConfirm(formEvent());
    expect(h.state.handleAddLog).toHaveBeenCalledTimes(1);
    expect(h.state.addMoment).not.toHaveBeenCalled();
  });
  it("an AI handoff opens directly in review; discarding never writes", () => {
    const h = captureHarness({ review: "ai-draft" });
    const review = one(h.render(), n => typeof n.props.onConfirm === "function");
    expect(review.props.source).toBe("ai-draft");
    expect(nodes(h.render()).some(n => n.type === "form")).toBe(false);
    review.props.onDiscard();
    expect(h.state.newLogTrigger).toBe("");
    expect(h.close).toHaveBeenCalledTimes(1);
    expect(h.state.handleAddLog).not.toHaveBeenCalled();
    expect(h.state.addMoment).not.toHaveBeenCalled();
  });
  it("voice escalation replaces every save/review control with the crisis alert", async () => {
    const h = captureHarness();
    one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
    h.speech[0].callbacks.onResult("A long parent sentence describing a dangerous situation needing support");
    const original = h.state.newLogTrigger;
    h.extracts[0].reject(new h.EscalationRequiredError("blocked"));
    await tick();
    const tree = h.render();
    expect(one(tree, n => n.props["data-testid"] === "quicklog-escalation").props.role).toBe("alert");
    expect(nodes(tree).some(n => n.type === "form" || typeof n.props.onConfirm === "function")).toBe(false);
    expect(h.state.newLogTrigger).toBe(original);
    expect(h.state.handleAddLog).not.toHaveBeenCalled();
    expect(h.state.addMoment).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalled();
    // Negative control: the former ordinary form shape would remain savable.
    expect(nodes({ type: "form", props: { onSubmit: () => {} } }).some(n => n.type === "form")).toBe(true);
  });
  it("late extraction is ignored after closing, unmounting, or replacing the parent's words", async () => {
    for (const retirement of ["close", "unmount", "edit"]) {
      const h = captureHarness();
      one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
      h.speech[0].callbacks.onResult("A long parent sentence describing a very difficult transition");
      if (retirement === "close") { h.props.open = false; h.render(); h.props.open = true; h.render(); }
      if (retirement === "unmount") h.view.unmount();
      if (retirement === "edit") {
        one(h.render(), n => n.props.id === "quick-log-moment").props.onChange({ target: { value: "My replacement words" } });
      }
      const kept = h.state.newLogTrigger;
      h.extracts[0].resolve({ behaviorType: "Aggression", trigger: "Stale model words", response: "Old response", intensity: 5 });
      await tick();
      expect(h.state.newLogTrigger).toBe(kept);
      expect(h.state.handleAddLog).not.toHaveBeenCalled();
      if (retirement !== "unmount") expect(nodes(h.render()).some(n => typeof n.props.onConfirm === "function")).toBe(false);
    }
  });
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
  it.each(["en", "he"] as const)("%s retains the receipt after Save's second click lands on the backdrop", async lang => {
    for (const dismiss of ["done", "open", "backdrop"] as const) {
      const h = captureHarness({ lang });
      h.close.mockImplementation(() => { h.props.open = false; });
      // Compose the production sheet's Modal props with the actual shared
      // hook. This replays the trusted browser trace's target/detail changes;
      // it does not simulate layout, hit testing, or mounted React scheduling.
      const dialog = renderer(compile(read("hooks/useDialog.ts") + "\nexport default useDialog;"), {
        "../lib/dialogStack": { registerDialog: ({ onClose }: { onClose: () => void }) => ({ close: onClose, dispose: vi.fn() }) },
      });
      const root = {}, backdrop = {};
      const bind = (tree: View) => dialog.render(tree.props, result => { result.ref.current = root; });
      const click = (target: object, detail: number) => ({ target, currentTarget: backdrop, detail, stopPropagation: vi.fn() });
      let tree = h.render();
      const first = bind(tree);
      const submit = one(tree, n => n.type === "button" && n.props.type === "submit");
      first.onBackdropClick(click(submit, 1));
      await one(tree, n => n.props["data-testid"] === "quicklog-moment-form").props.onSubmit(formEvent());
      tree = h.render();
      const afterSave = bind(tree);
      expect(nodes(tree).some(n => n.type === "form")).toBe(false);
      expect(one(tree, n => n.props["data-testid"] === "quicklog-reply")).toBeTruthy();
      afterSave.onBackdropClick(click(backdrop, 2));
      expect(h.close).not.toHaveBeenCalled();
      expect(h.props.open).toBe(true);
      tree = h.render();
      expect(one(tree, n => n.type === "fieldset").props.disabled).toBe(false);
      const done = one(tree, n => n.props["data-testid"] === "quicklog-reply-done");
      const receipt = one(tree, n => n.props.testId === "quicklog-reply-line1");
      expect(receipt.props.link).toMatchObject({ testId: "quicklog-reply-open", href: "#/journal" });
      if (dismiss === "done") done.props.onClick();
      if (dismiss === "open") receipt.props.link.onOpen();
      if (dismiss === "backdrop") afterSave.onBackdropClick(click(backdrop, 1));
      expect(h.close).toHaveBeenCalledOnce();
      expect(h.props.open).toBe(false);
      expect(h.state.addMoment).toHaveBeenCalledOnce();
      expect(h.state.handleAddLog).not.toHaveBeenCalled();
      dialog.unmount(); h.view.unmount();
    }
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


const keepChip = (tree: View, kind: string) => one(tree, n => n.props["data-kept-kind"] === kind);
const typeMoment = (h: ReturnType<typeof captureHarness>, value: string) => one(h.render(), n => n.props.id === "quick-log-moment").props.onChange({ target: { value } });
const hardToggle = (h: ReturnType<typeof captureHarness>, checked: boolean) => one(h.render(), n => n.type === "input" && n.props.type === "checkbox").props.onChange({ target: { checked } });

describe("B-ASKJB-36 optional kept capture — production handlers", () => {
  it("starts unselected, uses three native non-submit buttons, and saves only the explicit optional kind", async () => {
    const h = captureHarness({ text: "" });
    expect(nodes(h.render()).filter(n => n.props["data-kept-kind"])).toHaveLength(3);
    for (const kind of ["said", "by_herself", "first"]) {
      const chip = keepChip(h.render(), kind);
      expect(chip.props.type).toBe("button");
      expect(chip.props["aria-pressed"]).toBe(false);
      expect(chip.props.className).toContain("min-h-11");
      expect(chip.props.tabIndex).toBeUndefined();
      expect(chip.props.onKeyDown).toBeUndefined();
    }
    typeMoment(h, "Built a tower");
    keepChip(h.render(), "by_herself").props.onClick();
    expect(keepChip(h.render(), "by_herself").props["aria-pressed"]).toBe(true);
    expect(h.state.addMoment).not.toHaveBeenCalled();
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(h.state.addMoment).toHaveBeenCalledWith("Built a tower", expect.objectContaining({ kept: "by_herself" }));
  });
  it("parent-typed whole quotations alone preselect Said, and explicit deselection stays deselected", () => {
    const h = captureHarness({ text: "" });
    typeMoment(h, '"The moon is following us"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(true);
    keepChip(h.render(), "said").props.onClick();
    typeMoment(h, '"The moon is following us!"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
    typeMoment(h, ""); typeMoment(h, "‘עוד פעם’");
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(true);
    typeMoment(h, "A note with no quotation");
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
  });
  it("all unknown prefills stay unmarked after confirmation, minor edits, and clicks; only an explicit fresh note resets provenance", async () => {
    for (const initialText of ['"Generated quote"', '"Co-parent words"', '"Practice example"', '"Parent plus Arbor seed"']) {
      const h = captureHarness({ text: "", initialText });
      h.render();
      expect(h.state.newLogTrigger).toBe(initialText);
      expect(keepChip(h.render(), "said").props.disabled).toBe(true);
      typeMoment(h, initialText.replace('"', '“').replace(/"$/, '!”'));
      keepChip(h.render(), "said").props.onClick();
      expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
      h.state.addMoment.mockResolvedValueOnce(null);
      await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
      expect(h.state.addMoment.mock.calls[0][1]).not.toHaveProperty("kept");
      typeMoment(h, ""); typeMoment(h, '"My fresh parent note"');
      expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(true);
    }
  });
  it("dictation is parent-authored but never auto-selects Said, even after a punctuation edit", () => {
    const h = captureHarness({ text: "" });
    one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
    h.speech[0].callbacks.onResult('"Hello"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
    typeMoment(h, '"Hello!"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
    keepChip(h.render(), "said").props.onClick();
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(true);
  });
  it("hard-moment on/off drops the selection, and review saves never carry a forced keep marker", async () => {
    const h = captureHarness({ text: "" });
    typeMoment(h, '"My words"'); hardToggle(h, true);
    expect(nodes(h.render()).some(n => n.props["data-testid"] === "quicklog-keep-as")).toBe(false);
    h.state.newLogResponse = "Stayed close";
    one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    const review = one(h.render(), n => typeof n.props.onConfirm === "function");
    h.state.handleAddLog.mockResolvedValueOnce(null);
    await review.props.onConfirm(formEvent());
    expect(h.state.handleAddLog.mock.calls[0][1]).not.toHaveProperty("kept");
    review.props.onEdit(); hardToggle(h, false);
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
    typeMoment(h, '"My words!"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
  });
  it("an extracted draft cannot become a quote by returning from review and toggling back to Moment", async () => {
    const h = captureHarness({ text: "" });
    one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
    h.speech[0].callbacks.onResult("A long parent sentence describing a difficult transition");
    h.extracts[0].resolve({ behaviorType: "Transition Refusal", trigger: '"Invented model words"', response: "Stayed close" });
    await tick();
    one(h.render(), n => typeof n.props.onConfirm === "function").props.onEdit();
    hardToggle(h, false);
    typeMoment(h, '"Invented model words!"');
    expect(keepChip(h.render(), "said").props.disabled).toBe(true);
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(h.state.addMoment.mock.calls[0][1]).not.toHaveProperty("kept");
  });
  it("cancel/reopen and sibling A → B → A retire the selected kind without clearing existing text", () => {
    for (const retirement of ["close", "sibling"]) {
      const h = captureHarness({ text: "" });
      typeMoment(h, '"Only for A"');
      if (retirement === "close") {
        h.render().props.onClose(); h.props.open = false; h.render(); h.props.open = true;
      } else {
        h.state.childProfile = { id: "child-b" }; h.render();
        h.state.childProfile = { id: "child-a" };
      }
      expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
      expect(h.state.newLogTrigger).toBe('"Only for A"');
      expect(h.state.addMoment).not.toHaveBeenCalled();
    }
  });
  it("failed writes retain the selected kind for retry, but a successful save cannot carry it into reopening", async () => {
    const h = captureHarness({ text: "", save: async () => null });
    typeMoment(h, "Tied shoes"); keepChip(h.render(), "first").props.onClick();
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(keepChip(h.render(), "first").props["aria-pressed"]).toBe(true);
    h.state.addMoment.mockResolvedValueOnce(saved);
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(h.state.addMoment.mock.calls[1][1]).toHaveProperty("kept", "first");
    h.props.open = false; h.render(); h.props.open = true;
    expect(keepChip(h.render(), "first").props["aria-pressed"]).toBe(false);
  });
  it("does not mark or rewrite historical edits through the new capture row", async () => {
    const h = captureHarness({ edit: true });
    expect(nodes(h.render()).some(n => n.props["data-testid"] === "quicklog-keep-as")).toBe(false);
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(h.state.handleAddLog.mock.calls[0][1]).not.toHaveProperty("kept");
  });
  it.each(["en", "he"] as const)("%s has gendered and neutral copy, a labeled group, and language-correct direction", lang => {
    for (const gender of ["girl", "boy", "other", "unspecified", undefined] as const) {
      const h = captureHarness({ text: "", lang, gender });
      const tree = h.render();
      const row = one(tree, n => n.props["data-testid"] === "quicklog-keep-as");
      expect(row.type).toBe("fieldset");
      expect(row.props.lang).toBe(lang);
      expect(row.props.dir).toBe(lang === "he" ? "rtl" : "ltr");
      expect(text(one(row, n => n.type === "legend"))).toBe(translate(lang, "kept.capture.label"));
      const suffix = gender === "girl" ? "female" : gender === "boy" ? "male" : "neutral";
      for (const kind of ["said", "by_herself"]) {
        const label = text(keepChip(tree, kind));
        expect(label).toBe(translate(lang, `kept.capture.${kind}.${suffix}`));
        expect(label).not.toContain("kept.capture");
      }
      expect(one(tree, n => n.props.id === "quick-log-moment").props.dir).toBe("auto");
    }
  });
  it("the existing persistence bridge and reader carry all three kinds, without adding a collection or source", async () => {
    const h = contextHarness();
    for (const kept of ["said", "by_herself", "first"]) {
      const row = await h.addMoment("Parent words", { kept });
      expect(h.env.logsCol.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ kept }));
      expect(row).not.toHaveProperty("source");
      expect(keptThings({ behaviorLogs: [row] }, { id: "child-a", name: "Dylan" })).toMatchObject([{ kind: kept, text: "Parent words" }]);
    }
    expect(declaration("addMoment")).toContain('kept?: BehaviorLog["kept"]');
  });
});

// Independent adversarial additions. The above harness reads actual production
// sources and controls I/O, but does not simulate React scheduling or a browser.
describe("independent kept capture adversarial boundaries", () => {
  it("an identical externally supplied prefill retires an already typed quote selection", async () => {
    const h = captureHarness({ text: "" });
    typeMoment(h, '"Same words"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(true);
    Object.assign(h.props, { initialText: '"Same words"' });
    expect(keepChip(h.render(), "said").props.disabled).toBe(true);
    h.state.addMoment.mockResolvedValueOnce(null);
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(h.state.addMoment.mock.calls[0][1]).not.toHaveProperty("kept");
  });
  it("voice replaces typed selection, and retired voice cannot overwrite a later typed quotation", () => {
    const h = captureHarness({ text: "" });
    typeMoment(h, '"Typed first"');
    one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
    h.speech[0].callbacks.onResult('"Voice replaces"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
    expect(keepChip(h.render(), "said").props.disabled).toBe(false);
    typeMoment(h, "");
    typeMoment(h, '"Typed replacement"');
    h.speech[0].callbacks.onResult('"Stale voice"');
    expect(h.state.newLogTrigger).toBe('"Typed replacement"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(true);
  });
  it("a late extraction cannot retire or label the fresh typed quotation after sibling ABA", async () => {
    const h = captureHarness({ text: "" });
    one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
    h.speech[0].callbacks.onResult("A long parent sentence describing a difficult transition");
    h.state.childProfile = { id: "child-b" }; h.render();
    h.state.childProfile = { id: "child-a" }; h.render();
    typeMoment(h, ""); typeMoment(h, '"New words for A"');
    h.extracts[0].resolve({ behaviorType: "Aggression", trigger: '"Stale generated words"', response: "Stayed close" });
    await tick();
    expect(h.state.newLogTrigger).toBe('"New words for A"');
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(true);
    expect(nodes(h.render()).some(n => typeof n.props.onConfirm === "function")).toBe(false);
  });
  it("a thrown save retains the choice and sends it again on a later successful retry", async () => {
    const h = captureHarness({ text: "", save: async () => { throw new Error("offline"); } });
    typeMoment(h, "Tied shoes"); keepChip(h.render(), "first").props.onClick();
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(keepChip(h.render(), "first").props["aria-pressed"]).toBe(true);
    expect(one(h.render(), n => n.props.role === "alert")).toBeTruthy();
    h.state.addMoment.mockResolvedValueOnce(saved);
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(h.state.addMoment.mock.calls[1][1]).toHaveProperty("kept", "first");
  });
  it("a completed old write cannot clear or certify a new capture after close and reopen", async () => {
    const pending = deferred<any>();
    const h = captureHarness({ text: "", save: () => pending.promise });
    typeMoment(h, '"Old words"');
    const saving = one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    h.render().props.onClose(); h.props.open = false; h.render(); h.props.open = true; h.render();
    typeMoment(h, ""); typeMoment(h, "New observation");
    keepChip(h.render(), "by_herself").props.onClick();
    pending.resolve(saved); await saving;
    expect(h.state.newLogTrigger).toBe("New observation");
    expect(keepChip(h.render(), "by_herself").props["aria-pressed"]).toBe(true);
    expect(nodes(h.render()).some(n => n.props["data-testid"] === "quicklog-reply")).toBe(false);
  });
});


describe("independent existing kept-record authorship", () => {
  it("never certifies extracted words as the child's quote after editing a previously kept Moment", async () => {
    const original = { ...saved, trigger: '"Original child words"', kept: "said" };
    const h = captureHarness({ edit: true, text: original.trigger });
    one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
    h.speech[0].callbacks.onResult("A long parent sentence describing a difficult transition");
    h.extracts[0].resolve({ behaviorType: "Transition Refusal", trigger: '"Model-created words"', response: "Stayed close" });
    await tick();
    const review = one(h.render(), n => typeof n.props.onConfirm === "function");
    expect(review.props.source).toBe("ai-draft");
    review.props.onEdit(); hardToggle(h, false);
    expect(h.state.newLogType).toBe("Moment");
    expect(h.state.newLogTrigger).toBe('"Model-created words"');
    const draft = Object.fromEntries(Object.entries(h.state).filter(([key]) => key.startsWith("newLog")));
    const context = contextHarness(original, draft);
    h.state.handleAddLog = vi.fn(context.handleAddLog);
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(context.env.logsCol.upsert).toHaveBeenCalledTimes(1);
    const written = context.env.logsCol.upsert.mock.calls[0][0];
    expect(keptThings({ behaviorLogs: [written] }, { id: "child-a", name: "Dylan" })).toEqual([]);
  });
});

describe("historical kept content lineage is durable", () => {
  it.each(["said", "by_herself", "first"] as const)("preserves %s history while excluding generated and unknown replacements", async kept => {
    for (const transition of ["extraction", "review-edit", "prefill", "parent-typed", "parent-voice"]) {
      const original = Object.freeze({ ...saved, kept, trigger: '"Original parent words"', shelf: "words", promptKey: "prompt", customHistory: "preserved" });
      const h = captureHarness({ edit: true, text: original.trigger, ...(transition === "prefill" ? { initialText: '"Unknown prefilled words"' } : {}) });
      h.render();
      if (transition === "extraction" || transition === "review-edit") {
        one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
        h.speech[0].callbacks.onResult("A long parent sentence describing a difficult transition");
        h.extracts[0].resolve({ behaviorType: "Transition Refusal", trigger: '"Generated replacement"', response: "Stayed close" });
        await tick();
        const review = one(h.render(), n => typeof n.props.onConfirm === "function");
        if (transition === "review-edit") review.props.rows.find((row: any) => row.label === "ql.review.trigger").onChange('"Generated replacement!"');
        review.props.onEdit(); hardToggle(h, false);
      } else if (transition === "parent-typed") typeMoment(h, '"Original parent words!"');
      else if (transition === "parent-voice") {
        one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
        h.speech[0].callbacks.onResult('"Actual parent words"');
      } else typeMoment(h, '"Unknown prefilled words!"');
      const draft = Object.fromEntries(Object.entries(h.state).filter(([key]) => key.startsWith("newLog")));
      const context = contextHarness(original, draft);
      h.state.handleAddLog = vi.fn(context.handleAddLog);
      await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
      const written = context.env.logsCol.upsert.mock.calls[0][0];
      expect(written).toMatchObject({ id: original.id, timestamp: original.timestamp, kept, shelf: "words", promptKey: "prompt", customHistory: "preserved" });
      expect(original.trigger).toBe('"Original parent words"');
      const negative = transition === "prefill" ? "unverified" : transition === "extraction" || transition === "review-edit" ? "ai_draft" : undefined;
      if (negative) {
        expect(written.contentSource).toBe(negative);
        expect(keptThings({ behaviorLogs: [written] }, { id: "child-a" })).toEqual([]);
        expect(parentWords(written)).toBe("");
        expect(toObservations({ behaviorLogs: [written] }, { id: "child-a" })[0].source).toBe(negative === "ai_draft" ? "ai_proposed_parent_confirmed" : "unverified");
      } else {
        expect(written).not.toHaveProperty("contentSource");
        expect(keptThings({ behaviorLogs: [written] }, { id: "child-a" })).toMatchObject([{ kind: kept, text: written.trigger }]);
      }
    }
  });
  it("new extracted-to-Moment and unknown-prefill saves retain negative lineage too", async () => {
    for (const kind of ["ai_draft", "unverified"] as const) {
      const h = captureHarness({ text: "", ...(kind === "ai_draft" ? { review: "ai-draft" as const } : { initialText: "Unknown text" }) });
      if (kind === "ai_draft") {
        h.state.newLogTrigger = "Generated words";
        one(h.render(), n => typeof n.props.onConfirm === "function").props.onEdit(); hardToggle(h, false);
      }
      const context = contextHarness(); h.state.addMoment = vi.fn(context.addMoment);
      await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
      expect(context.env.logsCol.upsert.mock.calls[0][0]).toHaveProperty("contentSource", kind);
    }
  });
  it.each(["said", "by_herself", "first"] as const)("incident conversions cannot resurrect a dormant %s marker", async kept => {
    for (const [from, to] of [["Food Refusal", "Moment"], ["Moment", "Food Refusal"], ["Food Refusal", "Food Refusal"]]) {
      const original = Object.freeze({ ...saved, kept, behaviorType: from });
      const h = contextHarness(original, { newLogType: to, newLogTrigger: original.trigger, newLogResponse: "Stayed close" });
      const written = await h.handleAddLog(formEvent());
      expect(written).not.toHaveProperty("kept");
      expect(original.kept).toBe(kept);
      expect(keptThings({ behaviorLogs: [written] }, { id: "child-a" })).toEqual([]);
    }
  });
  it("preserves negative lineage and all old origin metadata through later manual edits", async () => {
    const original = Object.freeze({ ...saved, kept: "said", contentSource: "ai_draft", source: "kid_practice", observationSource: "document_extracted", authorUid: "parent-b", captureSource: "co_parent", shareGrantId: "grant", conversationProposalId: "proposal", sourceExcerpt: "original context" });
    const h = contextHarness(original);
    const written = await h.handleAddLog(formEvent());
    expect(written).toMatchObject({ ...original, trigger: "Corrected words" });
    expect(keptThings({ behaviorLogs: [written] }, { id: "child-a" })).toEqual([]);
    expect(parentWords(written)).toBe("");
  });
  it("a rejected replacement leaves original history untouched and retry keeps the negative marker", async () => {
    const original = Object.freeze({ ...saved, kept: "said", trigger: '"Original words"' });
    const h = contextHarness(original, { newLogTrigger: '"Generated words"' });
    h.env.logsCol.upsert.mockRejectedValueOnce(new Error("offline"));
    expect(await h.handleAddLog(formEvent(), { contentSource: "ai_draft" })).toBeNull();
    expect(original).not.toHaveProperty("contentSource");
    expect(original.trigger).toBe('"Original words"');
    expect(h.env.setNewLogTrigger).not.toHaveBeenCalled();
    const written = await h.handleAddLog(formEvent(), { contentSource: "ai_draft" });
    expect(written).toMatchObject({ id: original.id, timestamp: original.timestamp, kept: "said", contentSource: "ai_draft", trigger: '"Generated words"' });
    expect(keptThings({ behaviorLogs: [written] }, { id: "child-a" })).toEqual([]);
  });
});

describe("generated fields cannot be laundered through later text or dictation", () => {
  it.each(["typed", "voice"])("%s replacement retains generated draft lineage until a new capture", async replacement => {
    const h = captureHarness({ text: "" });
    one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
    h.speech[0].callbacks.onResult("A long parent sentence describing a difficult transition");
    h.extracts[0].resolve({ behaviorType: "Transition Refusal", trigger: '"Generated words"', response: "Generated response", notes: "Generated notes" });
    await tick();
    one(h.render(), n => typeof n.props.onConfirm === "function").props.onEdit(); hardToggle(h, false);
    if (replacement === "typed") { typeMoment(h, ""); typeMoment(h, '"Fresh parent words"'); }
    else {
      h.speech[0].callbacks.onEnd();
      one(h.render(), n => n.type === "button" && n.props.onClick?.name === "startVoice").props.onClick();
      h.speech[1].callbacks.onResult('"Fresh parent words"');
    }
    expect(h.state.newLogNotes).toBe("Generated notes");
    expect(keepChip(h.render(), "said").props.disabled).toBe(true);
    expect(keepChip(h.render(), "said").props["aria-pressed"]).toBe(false);
    await one(h.render(), n => n.type === "form").props.onSubmit(formEvent());
    expect(h.state.addMoment.mock.calls[0][1]).toMatchObject({ contentSource: "ai_draft", notes: "Generated notes" });
    expect(h.state.addMoment.mock.calls[0][1]).not.toHaveProperty("kept");
  });
});
