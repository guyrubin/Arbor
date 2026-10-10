import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoParentGate from "./CoParentGate";
import CoParentInvite from "./CoParentInvite";
import { CoParentError } from "../../lib/coParentApi";
import { coParentCopy } from "../../lib/i18nElevation/coParent";

// Component-handler lifecycle harness, following WorldScene.test.tsx. The
// real component requests and response handlers run with deferred transport;
// no duplicated controller logic or production scheduler is used here.
const h = vi.hoisted(() => ({
  slots: [] as any[], at: 0, effects: [] as (() => void)[], mountKey: "", lang: "en" as "en" | "he",
  uid: "recipient-a", profileLoading: false, profileError: false, focus: new Set<() => void>(),
  api: { invitations: vi.fn(), workspace: vi.fn(), accept: vi.fn(), note: vi.fn(), complete: vi.fn(), activities: vi.fn(), chooseActivity: vi.fn(), completeOwnedActivity: vi.fn(), invite: vi.fn() },
  signOut: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: (initial: any) => {
      const i = h.at++;
      if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
      return [h.slots[i], (value: any) => { h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value; }];
    },
    useRef: (initial: any) => { const i = h.at++; return h.slots[i] ?? (h.slots[i] = { current: initial }); },
    useCallback: (callback: any, deps: any[]) => {
      const i = h.at++; const prior = h.slots[i];
      if (prior && deps.every((value, index) => Object.is(value, prior.deps[index]))) return prior.callback;
      h.slots[i] = { deps, callback }; return callback;
    },
    useEffect: (effect: () => any, deps: any[]) => {
      const i = h.at++; const prior = h.slots[i];
      if (prior && deps.every((value, index) => Object.is(value, prior.deps[index]))) return;
      prior?.cleanup?.();
      const slot = { deps, cleanup: undefined as any }; h.slots[i] = slot;
      h.effects.push(() => { slot.cleanup = effect(); });
    },
  };
});
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid, email: `${h.uid}@example.test` }, signOut: h.signOut }) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ loading: h.profileLoading, loadError: h.profileError, needsOnboarding: true }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock("../../lib/coParentApi", () => ({
  coParentApi: h.api,
  coParentLink: (id: string) => `https://example.test/?family-invite=${id}`,
  CoParentError: class extends Error { constructor(public status: number, public code: string) { super(code); } },
}));
vi.mock("../../lib/api", () => ({ api: { revokeShare: vi.fn(async () => undefined) } }));
vi.mock("../../lib/practice/todayPin", () => ({ readTodayPin: () => undefined }));
vi.mock("../ui/Icon", () => ({ default: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function unmount() { for (const slot of h.slots) slot?.cleanup?.(); h.slots = []; h.effects = []; h.at = 0; }
function renderSession(element: React.ReactElement<any>) {
  if (element.key !== h.mountKey) { unmount(); h.mountKey = String(element.key); }
  h.at = 0;
  const tree = (element.type as (props: any) => React.ReactNode)(element.props);
  h.effects.splice(0).forEach(run => run());
  return tree;
}
const gate = () => renderSession(CoParentGate({ children: <div data-testid="own-family">Own family</div> }));
const owner = (childId = "child-a") => renderSession(CoParentInvite({ childId, childName: childId, grants: [], onChanged: async () => undefined }));
function nodes(node: React.ReactNode): React.ReactElement<Record<string, any>>[] {
  if (!React.isValidElement(node)) return [];
  const element = node as React.ReactElement<Record<string, any>>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}
const text = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (React.isValidElement(node)) return text((node.props as { children?: React.ReactNode }).children);
  return "";
};
const button = (tree: React.ReactNode, label: string) => nodes(tree).find(node => node.type === "button" && text(node.props.children) === label)!;
const sharedActivity = (tree: React.ReactNode) => nodes(tree).find(node => node.props["data-testid"] === "coparent-activity");
const ownerActivity = (tree: React.ReactNode) => nodes(tree).find(node => node.props["data-testid"] === "coparent-owner-activity")!;
const fireFocus = () => { [...h.focus].forEach(fn => fn()); };
async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
const workspace = (label: string) => ({ childId: "child-a", childName: "Private child", ownerEmail: null, activity: { id: label, text: label, do: label, acceptedAt: "2026-10-08T10:00:00Z", completedAt: null }, moments: [{ id: label, text: `Private moment ${label}`, at: "2026-10-08T10:00:00Z", addedByYou: false }] });
const selection = (label: string | null, completed = false) => ({ activity: label ? { id: label, practiceId: "practice-a", text: label, do: label, acceptedAt: "2026-10-08T10:00:00Z", completedAt: completed ? "2026-10-08T11:00:00Z" : null } : null, choices: [{ id: "practice-a", do: "Choose this activity", say: "Together", minutes: 5 }] });

beforeEach(() => {
  h.slots = []; h.at = 0; h.effects = []; h.mountKey = ""; h.lang = "en"; h.uid = "recipient-a"; h.profileLoading = false; h.profileError = false; h.focus.clear();
  for (const mock of Object.values(h.api)) mock.mockReset();
  h.api.invitations.mockResolvedValue({ shares: [{ id: "grant-a", acceptedAt: "2026-10-08", childId: "child-a", childName: "Private child" }] });
  h.api.workspace.mockResolvedValue(workspace("initial"));
  h.api.accept.mockResolvedValue({}); h.api.note.mockResolvedValue({}); h.api.complete.mockResolvedValue({});
  h.api.activities.mockResolvedValue(selection("initial"));
  h.api.chooseActivity.mockResolvedValue({ saved: true }); h.api.completeOwnedActivity.mockResolvedValue({ saved: true });
  vi.stubGlobal("window", {
    location: { search: "?family-invite=grant-a", href: "https://example.test/?family-invite=grant-a" },
    history: { replaceState: vi.fn() },
    addEventListener: (event: string, callback: () => void) => { if (event === "focus") h.focus.add(callback); },
    removeEventListener: (event: string, callback: () => void) => { if (event === "focus") h.focus.delete(callback); },
    setInterval: vi.fn(() => 1), clearInterval: vi.fn(),
  });
  vi.stubGlobal("document", { visibilityState: "visible" });
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("co-parent recipient authorization lifetime", () => {
  it.each([[403, "revoked"], [404, "child_unavailable"]] as const)("a newer %i %s clears private data and an older success cannot restore it", async (status, code) => {
    gate(); await settle(); expect(sharedActivity(gate())).toBeDefined();
    const old = deferred<ReturnType<typeof workspace>>(); const denied = deferred<ReturnType<typeof workspace>>();
    h.api.workspace.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => denied.promise);
    fireFocus(); fireFocus();
    denied.reject(new CoParentError(status, code)); await settle();
    expect(sharedActivity(gate())).toBeUndefined();
    old.resolve(workspace("OLD PRIVATE CONTENT")); await settle();
    const tree = gate(); expect(sharedActivity(tree)).toBeUndefined();
    expect(text(tree)).toContain(coParentCopy.en.ended);
    expect(text(tree)).not.toContain("OLD PRIVATE CONTENT");
    expect(h.focus.size).toBe(0);
  });

  it("authorization denial dominates even when a newer read returned first", async () => {
    gate(); await settle(); gate();
    const denied = deferred<ReturnType<typeof workspace>>(); const newer = deferred<ReturnType<typeof workspace>>();
    h.api.workspace.mockImplementationOnce(() => denied.promise).mockImplementationOnce(() => newer.promise);
    fireFocus(); fireFocus(); newer.resolve(workspace("newer")); await settle(); expect(text(gate())).toContain("newer");
    denied.reject(new CoParentError(403, "revoked")); await settle();
    expect(sharedActivity(gate())).toBeUndefined();
  });

  it("an older refresh cannot replace the latest activity and moments", async () => {
    gate(); await settle(); gate();
    const old = deferred<ReturnType<typeof workspace>>(); const newer = deferred<ReturnType<typeof workspace>>();
    h.api.workspace.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => newer.promise);
    fireFocus(); fireFocus(); newer.resolve(workspace("latest")); await settle(); old.resolve(workspace("outdated")); await settle();
    expect(text(gate())).toContain("latest"); expect(text(gate())).not.toContain("outdated");
  });

  it("leaving prevents an in-flight response from reopening the shared family", async () => {
    gate(); await settle(); const tree = gate();
    const pending = deferred<ReturnType<typeof workspace>>(); h.api.workspace.mockImplementationOnce(() => pending.promise); fireFocus();
    button(tree, coParentCopy.en.own).props.onClick();
    pending.resolve(workspace("private after leave")); await settle();
    expect(text(gate())).toBe("Own family");
  });

  it("changing authenticated identity creates a fresh session and drops old responses", async () => {
    gate(); await settle(); gate();
    const old = deferred<ReturnType<typeof workspace>>(); h.api.workspace.mockImplementationOnce(() => old.promise); fireFocus();
    h.uid = "recipient-b"; h.api.invitations.mockResolvedValue({ shares: [] });
    gate(); await settle(); old.resolve(workspace("recipient-a private")); await settle();
    expect(sharedActivity(gate())).toBeUndefined(); expect(text(gate())).not.toContain("recipient-a private");
  });

  it("retry remains usable after accepting an invitation fails", async () => {
    h.api.invitations.mockResolvedValue({ shares: [{ id: "grant-a", acceptedAt: null, childId: "child-a", childName: "Private child" }] });
    h.api.accept.mockRejectedValueOnce(new Error("network unavailable"));
    gate(); await settle(); button(gate(), coParentCopy.en.join).props.onClick(); await settle();
    const failed = gate(); expect(text(failed)).toContain(coParentCopy.en.error);
    button(failed, coParentCopy.en.retry).props.onClick(); await settle();
    expect(h.api.invitations).toHaveBeenCalledTimes(2);
    button(gate(), coParentCopy.en.join).props.onClick(); await settle();
    expect(sharedActivity(gate())).toBeDefined();
  });

  it("profile error exposes Retry, discards a late invite response, and resumes the requested family after recovery", async () => {
    const old = deferred<ReturnType<typeof workspace>>(); h.api.workspace.mockReturnValueOnce(old.promise);
    gate(); await settle(); h.profileError = true; h.profileLoading = true;
    expect(text(gate())).toBe("Own family"); // the inner ProfileGate owns its Retry UI
    old.resolve(workspace("stale before profile retry")); await settle();
    expect(text(gate())).toBe("Own family"); expect(h.api.accept).not.toHaveBeenCalled();
    h.profileError = false; expect(text(gate())).toContain(coParentCopy.en.loading);
    const reads = h.api.invitations.mock.calls.length; await settle(); expect(h.api.invitations).toHaveBeenCalledTimes(reads);
    h.profileLoading = false; gate(); await settle();
    expect(sharedActivity(gate())).toBeDefined(); expect(text(gate())).not.toContain("stale before profile retry");
    expect(h.api.workspace).toHaveBeenLastCalledWith("grant-a");
  });
  it("account A→B→A does not revive an old invitation acceptance or open its workspace", async () => {
    h.api.invitations.mockResolvedValue({ shares: [{ id: "grant-a", acceptedAt: null, childId: "child-a", childName: "Private child" }] });
    const old = deferred<unknown>(); h.api.accept.mockReturnValueOnce(old.promise);
    gate(); await settle(); button(gate(), coParentCopy.en.join).props.onClick(); await settle();
    h.uid = "recipient-b"; gate(); await settle(); h.uid = "recipient-a"; gate(); await settle();
    old.resolve({}); await settle(); expect(h.api.workspace).not.toHaveBeenCalled();
    expect(sharedActivity(gate())).toBeUndefined();
    button(gate(), coParentCopy.en.join).props.onClick(); await settle();
    expect(h.api.accept).toHaveBeenCalledTimes(2); expect(h.api.workspace).toHaveBeenCalledExactlyOnceWith("grant-a");
  });

  it("a rejected save clears a later refresh and keeps its private response out", async () => {
    gate(); await settle();
    const draft = nodes(gate()).find(node => node.type === "textarea")!;
    draft.props.onChange({ target: { value: "A private observation" } });
    const saving = deferred<unknown>(); const reading = deferred<ReturnType<typeof workspace>>();
    h.api.note.mockImplementationOnce(() => saving.promise);
    nodes(gate()).find(node => node.type === "form")!.props.onSubmit({ preventDefault: () => undefined });
    h.api.workspace.mockImplementationOnce(() => reading.promise); fireFocus();
    saving.reject(new CoParentError(403, "revoked")); await settle();
    reading.resolve(workspace("must remain private")); await settle();
    expect(sharedActivity(gate())).toBeUndefined(); expect(text(gate())).not.toContain("must remain private");
    expect(text(gate())).toContain(coParentCopy.en.ended);
  });
});

describe("co-parent owner activity lifetime", () => {
  it("a pre-save read cannot replace the activity loaded after successful selection", async () => {
    owner(); await settle(); const tree = owner();
    const old = deferred<ReturnType<typeof selection>>(); const afterSave = deferred<ReturnType<typeof selection>>();
    h.api.activities.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => afterSave.promise);
    fireFocus();
    const form = nodes(ownerActivity(tree)).find(node => node.type === "form")!;
    void form.props.onSubmit({ preventDefault: () => undefined }); await settle();
    afterSave.resolve(selection("new chosen activity")); await settle(); old.resolve(selection("old selection")); await settle();
    expect(h.api.chooseActivity).toHaveBeenCalledTimes(1);
    expect(text(ownerActivity(owner()))).toContain("new chosen activity");
    expect(text(ownerActivity(owner()))).not.toContain("old selection");
  });

  it("a pre-completion read cannot resurrect the completion button", async () => {
    owner(); await settle(); const tree = owner();
    const old = deferred<ReturnType<typeof selection>>(); const afterDone = deferred<ReturnType<typeof selection>>();
    h.api.activities.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => afterDone.promise);
    fireFocus(); button(ownerActivity(tree), coParentCopy.en.done).props.onClick(); await settle();
    afterDone.resolve(selection("initial", true)); await settle(); old.resolve(selection("initial", false)); await settle();
    const updated = ownerActivity(owner()); expect(text(updated)).toContain(coParentCopy.en.completed);
    expect(button(updated, coParentCopy.en.done)).toBeUndefined();
  });

  it("a language change ignores the older locale's response", async () => {
    const old = deferred<ReturnType<typeof selection>>(); const hebrew = deferred<ReturnType<typeof selection>>();
    h.api.activities.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => hebrew.promise);
    owner(); h.lang = "he"; owner();
    hebrew.resolve(selection("הפעילות בעברית")); await settle(); old.resolve(selection("stale English activity")); await settle();
    expect(text(ownerActivity(owner()))).toContain("הפעילות בעברית"); expect(text(ownerActivity(owner()))).not.toContain("stale English activity");
  });

  it("a save finishing after a language switch refreshes in the current language and releases busy", async () => {
    owner(); await settle();
    const saving = deferred<unknown>(); h.api.chooseActivity.mockImplementationOnce(() => saving.promise);
    nodes(ownerActivity(owner())).find(node => node.type === "form")!.props.onSubmit({ preventDefault: () => undefined });
    expect(nodes(ownerActivity(owner())).find(node => node.type === "select")!.props.disabled).toBe(true);
    h.lang = "he"; h.api.activities.mockResolvedValueOnce(selection("לפני השמירה")); owner(); await settle();
    expect(nodes(ownerActivity(owner())).find(node => node.type === "select")!.props.disabled).toBe(true);
    h.api.activities.mockResolvedValue(selection("הפעילות בעברית"));
    saving.resolve({ saved: true }); await settle();
    const tree = ownerActivity(owner());
    expect(nodes(tree).find(node => node.type === "select")!.props.disabled).toBe(false);
    expect(text(tree)).toContain("הפעילות בעברית");
    expect(text(tree)).not.toContain("לפני השמירה");
    expect(h.api.activities.mock.calls.map(call => call[1])).toEqual(["en", "he", "he"]);
    expect(text(owner())).toContain(coParentCopy.he.chooseSaved);
    expect(text(owner())).not.toContain(coParentCopy.en.chooseSaved);
  });

  it("a child switch resets the form and rejects the previous child's request", async () => {
    const old = deferred<ReturnType<typeof selection>>(); const current = deferred<ReturnType<typeof selection>>();
    h.api.activities.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
    let tree = owner("child-a");
    nodes(tree).find(node => node.type === "input" && node.props.id === "coparent-email")!.props.onChange({ target: { value: "for-child-a@example.test" } });
    tree = owner("child-b"); expect(nodes(tree).find(node => node.type === "input" && node.props.id === "coparent-email")!.props.value).toBe("");
    current.resolve(selection("child-b activity")); await settle(); old.resolve(selection("child-a activity")); await settle();
    expect(text(ownerActivity(owner("child-b")))).toContain("child-b activity"); expect(text(ownerActivity(owner("child-b")))).not.toContain("child-a activity");
  });
});
