import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { File as NodeFile } from "node:buffer";
import ts from "typescript";
import { MAX_COMPANION_ATTACHMENTS, parseCompanionAttachments, type ComposerAttachment } from "../../lib/companionAttachments";
import { threadForTopic } from "../../lib/topicConversation";
import { translate } from "../../lib/i18n";
import { screenForImmediateEscalation } from "../../safety/escalation";
import { COMPANION_CONSENT_COPY } from "./companionConsentCopy";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const composerSource = read("components/companion/CompanionComposer.tsx");
const coachSource = ts.createSourceFile("CoachTab.tsx", read("components/tabs/CoachTab.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const contextSource = ts.createSourceFile("ArborContext.tsx", read("context/ArborContext.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function find(source: ts.SourceFile, predicate: (node: ts.Node) => boolean): ts.Node[] {
  const matches: ts.Node[] = [];
  const visit = (node: ts.Node) => { if (predicate(node)) matches.push(node); ts.forEachChild(node, visit); };
  visit(source);
  return matches;
}
function oneSource(source: ts.SourceFile, predicate: (node: ts.Node) => boolean) {
  const matches = find(source, predicate);
  if (matches.length !== 1) throw new Error(`Expected one production boundary, got ${matches.length}`);
  return matches[0].getText(source);
}

// Execute the actual integration slot and thread controls, not copies of their
// decisions. This catches conversation-key remounts as well as local hook races.
const composerSlot = oneSource(coachSource, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(coachSource) === "CompanionComposer");
const slotSource = `import React from "react"; import CompanionComposer from "./CompanionComposer";
export default function Slot({ childProfile, activeConversationId, conversationRevision, uiLang, chatInput, setChatInput, isChatLoading, visible, handleChatSend, toggleVoice, voicePhase, voiceLabel, openCaptureSheet }) { return ${composerSlot}; }`;
const controls = ["newConversation", "prepareTopicConversation", "openConversation"].map(name =>
  oneSource(contextSource, node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name)),
).join("\n");
const controlsSource = `export default function Controls({ activeConversationId, chatMessages, activeFamilyTopic, conversationTopicRef, chatAbortRef, conversationsCol, topicState, setConversationRevision, setActiveConversationId, setIsChatLoading, setChatMessages, setChatInput, setApiError, setChatStreamStatus, threadForTopic }) {
${controls}
return { newConversation, prepareTopicConversation, openConversation }; }`;
const voiceEffects = find(coachSource, node => {
  if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) return false;
  const call = node.expression;
  return call.expression.getText(coachSource) === "useEffect" && call.arguments.length === 2
    && ["[conversationRevision]", "[visible]"].includes(call.arguments[1].getText(coachSource))
    && call.arguments[0].getText(coachSource).includes("stopVoice()");
}).map(node => node.getText(coachSource));
if (voiceEffects.length !== 2) throw new Error("Expected the two production voice-lifetime effects");
const voiceSource = `import { useEffect } from "react";
export default function Voice({ conversationRevision, visible, stopVoice }) { ${voiceEffects.join("\n")} return null; }`;

type View = { type: string | symbol | ((props: any) => any); props: Record<string, any> };
const compile = (source: string) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
} }).outputText;
const composerCode = compile(composerSource), slotCode = compile(slotSource), controlsCode = compile(controlsSource), voiceCode = compile(voiceSource);

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
const photo = (id = "photo-a", childId = "child-a"): ComposerAttachment => ({
  id, childId, kind: "photo", name: `${id}.png`, mimeType: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=",
});
type SpeechCallbacks = { onResult: (text: string) => void; onInterim: (text: string) => void; onError: (reason: string) => void; onEnd: () => void };

function harness(options: { send?: () => Promise<boolean | undefined>; text?: string; permission?: () => Promise<boolean> } = {}) {
  const preparations: { file: File; childId: string; kind: ComposerAttachment["kind"]; pending: ReturnType<typeof deferred<ComposerAttachment>> }[] = [];
  const sessions: { callbacks: SpeechCallbacks; stop: ReturnType<typeof vi.fn> }[] = [];
  const prepare = vi.fn((file: File, childId: string, kind: ComposerAttachment["kind"]) => {
    const pending = deferred<ComposerAttachment>(); preparations.push({ file, childId, kind, pending }); return pending.promise;
  });
  const startDictation = vi.fn((callbacks: SpeechCallbacks) => {
    const stop = vi.fn(); sessions.push({ callbacks, stop }); return stop;
  });
  const thumbnail = vi.fn(async (_file: File) => "data:image/jpeg;base64,bounded-thumbnail");
  const onSend = vi.fn((_prompt?: string, _options?: { attachments?: ComposerAttachment[] }) => options.send ? options.send() : Promise.resolve(true));
  const openCaptureSheet = vi.fn(), stopVoice = vi.fn();
  const requirePermission = vi.fn(options.permission ?? (async () => true));
  const state = {
    childProfile: { id: "child-a" }, activeConversationId: null as string | null,
    conversationRevision: 0, chatMessages: [] as any[], activeFamilyTopic: undefined,
    conversationTopicRef: { current: undefined as string | undefined }, chatAbortRef: { current: null },
    conversationsCol: { items: [{ id: "saved-a", topicId: undefined, messages: [{ sender: "user", text: "Earlier question" }] }, { id: "saved-b", topicId: undefined, messages: [] }] },
    topicState: { familyTopics: [], selectFamilyTopic: vi.fn() },
    uiLang: "en", chatInput: options.text ?? "A moment from today", isChatLoading: false,
    visible: true, voicePhase: "off", voiceLabel: "Talk with Arbor",
    setChatInput: (value: string) => { state.chatInput = value; },
    setConversationRevision: (next: (value: number) => number) => { state.conversationRevision = next(state.conversationRevision); },
    setActiveConversationId: (value: string | null) => { state.activeConversationId = value; },
    setIsChatLoading: (value: boolean) => { state.isChatLoading = value; },
    setChatMessages: (value: any[]) => { state.chatMessages = value; },
    setApiError: vi.fn(), setChatStreamStatus: vi.fn(), threadForTopic,
    handleChatSend: onSend, toggleVoice: vi.fn(), openCaptureSheet, stopVoice,
  };
  const imports = {
    "../ui/Icon": { __esModule: true, default: "Icon" },
    "../../lib/image": { fileToThumbnail: thumbnail },
    "../../lib/i18n": { translate },
    "../../lib/speech": { startDictation, speechSupported: () => true },
    "../../lib/microphoneRecovery": { microphoneRecovery: (reason: string) => `Microphone: ${reason}` },
    "../../lib/companionAttachments": { MAX_COMPANION_ATTACHMENTS, parseCompanionAttachments, prepareCompanionAttachment: prepare },
    "../../safety/escalation": { screenForImmediateEscalation },
    "./useCompanionConsent": { useCompanionConsent: () => ({ accountId: "parent-a", busy: null, requirePermission, review: vi.fn() }) },
    "./CompanionConsentReview": { __esModule: true, default: "CompanionConsentReview" },
    "./companionConsentCopy": { COMPANION_CONSENT_COPY },
    "./companionComposer.css": {},
  };
  const parent = renderer(slotCode, { "./CompanionComposer": { __esModule: true, default: "CompanionComposer" } });
  const controlsView = renderer(controlsCode), voice = renderer(voiceCode);
  let child = renderer(composerCode, imports), key: unknown, mounted = false;
  const render = (): View => {
    const slot = parent.render(state);
    if (mounted && key !== slot.props.key) { child.unmount(); child = renderer(composerCode, imports); }
    key = slot.props.key; mounted = true;
    voice.render(state);
    return child.render(slot.props);
  };
  render(); stopVoice.mockClear();
  return {
    state, render, preparations, prepare, sessions, thumbnail, onSend, openCaptureSheet, stopVoice, requirePermission,
    allocate: () => { controlsView.render(state).prepareTopicConversation(); render(); },
    newConversation: () => { controlsView.render(state).newConversation(); render(); },
    openConversation: (id: string) => { controlsView.render(state).openConversation(id); render(); },
    choose: (kind: ComposerAttachment["kind"] = "photo") => {
      const input = one(render(), node => node.type === "input" && node.props.type === "file" && node.props.accept.startsWith(kind === "photo" ? "image/" : "application/pdf"));
      const target = { files: [new NodeFile(["fixture"], "picked.png", { type: "image/png" })], value: "picked.png" };
      input.props.onChange({ target }); expect(target.value).toBe(""); render();
      return preparations.at(-1)!;
    },
    click: (label: string) => { const action = button(render(), label); expect(action.props.disabled).not.toBe(true); action.props.onClick(); render(); },
    previews: () => nodes(render()).filter(node => node.type === "figcaption").map(text),
    unmount: () => { child.unmount(); voice.unmount(); parent.unmount(); controlsView.unmount(); },
  };
}
async function attach(view: ReturnType<typeof harness>, file = photo()) {
  view.choose(file.kind).pending.resolve(file); await tick(); view.render(); return file;
}

describe("Companion draft, attachment and speech lifetime", () => {
  it("first conversation allocation preserves the same composer, its files and active dictation", async () => {
    const view = harness(); const file = await attach(view);
    view.click("Dictate"); const session = view.sessions[0];
    view.allocate();
    expect(view.state.activeConversationId).toMatch(/^conv-/);
    expect(view.state.conversationRevision).toBe(0);
    expect(view.previews()).toEqual([file.name]);
    expect(session.stop).not.toHaveBeenCalled(); expect(view.stopVoice).not.toHaveBeenCalled();
    session.callbacks.onResult("She tried again"); view.render();
    expect(view.state.chatInput).toBe("A moment from today She tried again");
    session.callbacks.onEnd(); view.render(); view.click("Send"); await tick();
    expect(view.onSend).toHaveBeenCalledWith(undefined, { attachments: [file] });
    expect(view.previews()).toEqual([]);
  });

  it("explicit new conversation clears a still-unsaved draft, even when both IDs are null", async () => {
    const view = harness(); await attach(view); view.click("Dictate");
    view.newConversation();
    expect(view.state.activeConversationId).toBeNull(); expect(view.state.conversationRevision).toBe(1);
    expect(view.previews()).toEqual([]); expect(view.state.chatInput).toBe("");
    expect(view.sessions[0].stop).toHaveBeenCalledTimes(1); expect(view.stopVoice).toHaveBeenCalledTimes(1);
    view.sessions[0].callbacks.onResult("Old words"); expect(view.state.chatInput).toBe("");
  });

  it("opening saved history from an unsaved draft is a switch, not first-ID allocation", async () => {
    const view = harness(); await attach(view); view.click("Dictate"); view.openConversation("saved-a");
    expect(view.state.activeConversationId).toBe("saved-a"); expect(view.state.conversationRevision).toBe(1);
    expect(view.previews()).toEqual([]); expect(view.sessions[0].stop).toHaveBeenCalledTimes(1);
    expect(view.stopVoice).toHaveBeenCalledTimes(1);
  });

  it("switching real conversations ignores preparation from the previous conversation", async () => {
    const view = harness(); view.allocate(); const pending = view.choose();
    view.openConversation("saved-b"); pending.pending.resolve(photo("stale")); await tick();
    expect(view.previews()).toEqual([]); expect(text(view.render())).not.toContain("Preparing your files");
    const current = await attach(view, photo("current")); expect(view.previews()).toEqual([current.name]);
  });

  it("closing the panel lets file preparation settle without stranding the preparing state", async () => {
    const view = harness(); const pending = view.choose();
    expect(text(view.render())).toContain("Preparing your files");
    view.state.visible = false; view.render(); pending.pending.resolve(photo()); await tick();
    expect(text(view.render())).not.toContain("Preparing your files"); expect(view.previews()).toEqual([photo().name]);
    view.state.visible = true; expect(button(view.render(), "Send").props.disabled).toBe(false);
    view.click("Send"); await tick(); expect(view.onSend).toHaveBeenCalledWith(undefined, { attachments: [photo()] });
  });

  it("a successful send clears attachments even while the panel is hidden", async () => {
    const pending = deferred<boolean>(); const view = harness({ send: () => pending.promise }); await attach(view);
    view.click("Send"); await tick(); view.state.visible = false; view.render(); pending.resolve(true); await tick();
    expect(view.previews()).toEqual([]); view.state.visible = true; expect(view.previews()).toEqual([]);
  });

  it("a failed send retains original bytes and sends the same attachments on retry", async () => {
    let succeed = false; const view = harness({ send: async () => succeed }); const file = await attach(view);
    view.click("Send"); await tick(); expect(view.previews()).toEqual([file.name]);
    expect(view.state.chatInput).toBe("A moment from today");
    succeed = true; view.click("Send"); await tick();
    expect(view.onSend).toHaveBeenCalledTimes(2);
    expect(view.onSend.mock.calls.map(call => call[1]?.attachments)).toEqual([[file], [file]]);
    expect(view.previews()).toEqual([]);
  });

  it("a missing file permission preserves draft and originals without sending to AI", async () => {
    const view = harness({ permission: async () => false }); const file = await attach(view);
    view.click("Send"); await tick();
    expect(view.requirePermission).toHaveBeenCalledOnce();
    expect(view.onSend).not.toHaveBeenCalled(); expect(view.previews()).toEqual([file.name]);
    expect(view.state.chatInput).toBe("A moment from today");
  });

  it("immediate-help text reaches the governed server path without waiting on file permission", async () => {
    const view = harness({ text: "My child says he wants to die", permission: async () => false });
    const file = await attach(view); view.click("Send"); await tick();
    expect(view.requirePermission).not.toHaveBeenCalled();
    expect(view.onSend).toHaveBeenCalledWith(undefined, { attachments: [file] });
  });

  it("closing while checking file permission does not send a draft after the panel is hidden", async () => {
    const pending = deferred<boolean>(); const view = harness({ permission: () => pending.promise });
    const file = await attach(view); view.click("Send"); view.state.visible = false; view.render();
    pending.resolve(true); await tick();
    expect(view.onSend).not.toHaveBeenCalled(); expect(view.previews()).toEqual([file.name]);
    view.state.visible = true; expect(button(view.render(), "Send").props.disabled).toBe(false);
  });

  it("late send success cannot remove files attached in the next conversation", async () => {
    const pending = deferred<boolean>(); const view = harness({ send: () => pending.promise }); await attach(view);
    view.click("Send"); view.newConversation(); const current = await attach(view, photo("current"));
    pending.resolve(true); await tick(); expect(view.previews()).toEqual([current.name]);
  });

  it("hiding stops dictation and ignores every late speech callback, while preserving the text draft", () => {
    const view = harness(); view.click("Dictate"); const session = view.sessions[0];
    session.callbacks.onInterim("half a sentence"); expect(text(view.render())).toContain("half a sentence");
    view.state.visible = false; view.render(); expect(session.stop).toHaveBeenCalledTimes(1);
    session.callbacks.onResult("late words"); session.callbacks.onInterim("late interim");
    session.callbacks.onError("denied"); session.callbacks.onEnd();
    view.state.visible = true;
    expect(view.state.chatInput).toBe("A moment from today"); expect(text(view.render())).not.toMatch(/late|half a sentence|Microphone:/);
    expect(button(view.render(), "Dictate").props["aria-pressed"]).toBe(false);
  });

  it("child changes remount the keyed composer and reject the old child's late media and speech", async () => {
    const view = harness(); await attach(view); view.click("Dictate"); const session = view.sessions[0];
    session.callbacks.onEnd(); view.render(); const oldPreparation = view.choose();
    view.state.childProfile = { id: "child-b" }; view.state.chatInput = "Child B draft"; view.render();
    oldPreparation.pending.resolve(photo("late-a")); session.callbacks.onResult("Child A words"); await tick();
    expect(view.previews()).toEqual([]); expect(view.state.chatInput).toBe("Child B draft");
    const current = await attach(view, photo("child-b-photo", "child-b"));
    expect(view.previews()).toEqual([current.name]); expect(view.preparations.at(-1)?.childId).toBe("child-b");
  });

  it("a rejected preparation is recoverable and does not discard an earlier valid attachment", async () => {
    const view = harness(); const kept = await attach(view); const invalid = view.choose();
    invalid.pending.reject(new Error("Unreadable file")); await tick();
    expect(view.previews()).toEqual([kept.name]); expect(text(one(view.render(), node => node.props.role === "alert"))).toContain("Choose up to 3");
    const current = await attach(view, photo("retry")); expect(view.previews()).toEqual([kept.name, current.name]);
    expect(nodes(view.render()).filter(node => node.props.role === "alert")).toHaveLength(0);
  });

  it("unmount prevents late preparation and dictation from writing into the disposed draft", async () => {
    const view = harness(); const pending = view.choose(); view.click("Dictate"); const session = view.sessions[0];
    view.unmount(); expect(session.stop).toHaveBeenCalledTimes(1);
    pending.pending.resolve(photo()); session.callbacks.onResult("After unmount");
    session.callbacks.onInterim("Late"); session.callbacks.onError("network"); session.callbacks.onEnd(); await tick();
    expect(view.state.chatInput).toBe("A moment from today"); expect(view.onSend).not.toHaveBeenCalled();
  });

  it("keeping a moment passes the existing text and bounded photo through the real Coach integration", async () => {
    const view = harness({ text: "She built a tall tower" }); const file = await attach(view);
    view.click("Just keep a moment"); await tick();
    expect(view.thumbnail).toHaveBeenCalledTimes(1);
    expect(view.thumbnail.mock.calls[0][0]).toMatchObject({ name: file.name, type: file.mimeType, size: 8 });
    expect(view.openCaptureSheet).toHaveBeenCalledWith({ mode: "text", initialText: "She built a tall tower", initialPhoto: "data:image/jpeg;base64,bounded-thumbnail" });
    expect(view.onSend).not.toHaveBeenCalled(); expect(view.previews()).toEqual([file.name]);
  });

  it("a document cannot silently disappear when keeping a moment", async () => {
    const view = harness(); const document: ComposerAttachment = { ...photo("report"), kind: "document", name: "report.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,JVBERi0xLjc=" };
    await attach(view, document); view.click("Just keep a moment"); await tick();
    expect(view.openCaptureSheet).not.toHaveBeenCalled(); expect(view.thumbnail).not.toHaveBeenCalled();
    expect(view.previews()).toEqual([document.name]); expect(text(one(view.render(), node => node.props.role === "alert"))).toContain("one photo");
  });
});
