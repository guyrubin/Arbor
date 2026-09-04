import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import type { AccountDeletionReceipt } from "../../lib/api";
import { en, he } from "../../lib/i18nElevation/accountSettings";
import { createAccountDeletionLeases } from "../../lib/accountDeletionLease";
import { elevationEn, elevationHe } from "../../lib/i18nElevation";

const read = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8").replace(/\r\n/g, "\n");
const settingsSource = read("components/layout/SettingsModal.tsx");
const deletionSource = read("components/layout/DeleteAccountModal.tsx");
type View = { type: string | symbol | ((props: any) => any); props: Record<string, any> };

/** Execute the actual TSX modules with synthetic React hooks/JSX and explicit
 * external boundaries. This tests production callbacks and rendered props, not
 * a second copy of deletion logic. It does NOT claim browser mount/focus proof.
 * Every import must be supplied; Firebase, HTTP and real storage cannot run. */
function renderer(source: string, imports: Record<string, any>, storage: object = {}) {
  const slots: any[] = [];
  let cursor = 0, dirty = false, disposed = false;
  let effects: (() => void)[] = [];
  let props: any, tree: View;
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const effect = (callback: () => void | (() => void), deps?: unknown[]) => {
    const index = cursor++, previous = slots[index];
    if (!previous || !same(previous.deps, deps)) {
      const slot = { deps, cleanup: undefined as void | (() => void) };
      slots[index] = slot;
      effects.push(() => { previous?.cleanup?.(); slot.cleanup = callback(); });
    }
  };
  const react = {
    Fragment: Symbol("Fragment"),
    createElement: (type: View["type"], attrs: any, ...children: any[]): View => ({
      type, props: { ...attrs, ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) },
    }),
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => {
        if (disposed) throw new Error("state update after unmount");
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef: (initial: any) => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useId: () => { const index = cursor++; return slots[index] ??= "account-test-" + index; },
    useEffect: effect,
    useLayoutEffect: effect,
    useSyncExternalStore: (subscribe: (listener: () => void) => () => void, getSnapshot: () => boolean) => {
      const [, update] = react.useState(0);
      effect(() => subscribe(() => update((n: number) => n + 1)), [subscribe]);
      return getSnapshot();
    },
    useCallback: (callback: any, deps: unknown[]) => {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, callback };
      return slots[index].callback;
    },
  };
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as { default: (props: any) => View } };
  const requireMock = (name: string) => {
    if (name === "react") return { __esModule: true, default: react, ...react };
    if (!(name in imports)) throw new Error("Unmocked boundary: " + name);
    return imports[name];
  };
  new Function("require", "module", "exports", "localStorage", code)(requireMock, module, module.exports, storage);
  const render = (nextProps = props) => {
    props = nextProps;
    for (let i = 0; i < 20; i++) {
      cursor = 0; dirty = false; effects = [];
      tree = module.exports.default(props);
      effects.forEach(run => run());
      if (!dirty) return tree;
    }
    throw new Error("unbounded hook rerenders");
  };
  return { render, unmount: () => { disposed = true; slots.forEach(slot => slot?.cleanup?.()); } };
}
function nodes(tree: any): View[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  if (typeof tree.type === "function") return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props.children)];
}
function text(tree: any): string {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return text(typeof tree.type === "function" ? tree.type(tree.props) : tree.props?.children);
}
const one = (tree: View, predicate: (node: View) => boolean) => {
  const found = nodes(tree).filter(predicate);
  expect(found).toHaveLength(1);
  return found[0];
};
const button = (tree: View, label: string) => one(tree, n => n.type === "button" && text(n) === label);
const modal = (tree: View) => one(tree, n => n.type === "Modal");
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const receipt = (complete = false): AccountDeletionReceipt => ({
  uid: "parent-a", complete, authDeleted: complete, receiptAt: "2026-09-04T10:00:00Z",
  classes: [{ class: "childData", attempted: true, deleted: 7, failed: 0 },
    { class: "storageFiles", attempted: true, deleted: 2, failed: complete ? 0 : 1 }],
});
function boundaries() {
  const order: string[] = [];
  const signOut = vi.fn(async () => { order.push("signOut"); });
  const auth = { firebaseEnabled: true, user: { uid: "parent-a", displayName: "Parent", email: "parent@example.test" } as { uid: string; displayName: string; email: string } | null, signOut };
  const language = { uiLang: "en", aiLang: "en", setUiLang: vi.fn(), setAiLang: vi.fn(), t: (key: string, vars?: Record<string, string>) => {
    if (key === "set.acctDel.confirmWord") return language.uiLang === "he" ? "מחיקה" : "DELETE";
    return key + (vars ? " " + JSON.stringify(vars) : "");
  } };
  const toast = vi.fn((_message: string, kind: string) => { order.push("toast:" + kind); });
  const api = { accountDelete: vi.fn(async () => receipt()) };
  const purgeAllComicPages = vi.fn(async () => { order.push("purge"); });
  const commerceAllowed = vi.fn(() => true);
  const storage: Record<string, any> = { "arbor.child": "private", "arbor.theme": "blue", unrelated: "keep" };
  const removeItem = vi.fn((key: string) => { order.push("remove:" + key); delete storage[key]; });
  Object.defineProperty(storage, "removeItem", { value: removeItem });
  const leases = createAccountDeletionLeases();
  const imports: Record<string, any> = {
    "../ui/Modal": { Modal: "Modal" },
    "../../context/LanguageContext": { useLanguage: () => language },
    "../../context/AuthContext": { useAuth: () => auth },
    "../../context/ToastContext": { useToast: () => ({ toast }) },
    "../../lib/api": { api },
    "../../lib/accountDeletionLease": { accountDeletionLeases: leases },
    "../../lib/comicPageStore": { purgeAllComicPages },
    "../kidmode/parentGate": { commerceAllowed },
  };
  return { imports, leases, auth, language, api, commerceAllowed, purgeAllComicPages, signOut, toast, storage, removeItem, order };
}
function deletion(source = deletionSource, b = boundaries()) {
  const onClose = vi.fn(() => { b.order.push("close"); });
  const r = renderer(source, b.imports, b.storage);
  let open = true;
  let tree = r.render({ open, onClose });
  const refresh = () => tree = r.render({ open, onClose });
  return { ...b, onClose, unmount: r.unmount,
    get tree() { return tree; }, refresh,
    setOpen: (value: boolean) => { open = value; return refresh(); },
    type: (value: string) => { one(tree, n => n.type === "input").props.onChange({ target: { value } }); return refresh(); },
    settle: async () => { await tick(); return refresh(); },
  };
}
function settings(source = settingsSource) {
  const b = boundaries();
  const imports = { ...b.imports,
    "../ui/Icon": { Icon: "Icon" }, "./AdminDashboard": { default: "AdminDashboard", __esModule: true },
    "./ParentalGatePanel": { default: "ParentalGatePanel", __esModule: true },
    "./DeleteAccountModal": { default: "DeleteAccountModal", __esModule: true },
    "../referral/InviteCard": { default: "InviteCard", __esModule: true },
    "../billing/PlanPrices": { PlanPrices: "PlanPrices" }, "../billing/LegalLinks": { LegalLinks: "LegalLinks" },
    "../ui/Skeleton": { Skeleton: "Skeleton" }, "../ui/PlanBadge": { PlanBadge: "PlanBadge" },
    "../../context/ArborContext": { useArbor: () => ({ showAiRail: false, setShowAiRail: vi.fn(), setActiveTab: vi.fn() }) },
    "../../hooks/useEntitlement": { useEntitlement: () => ({ entitlement: { plan: "free", limits: { coachMessagesPerDay: 5 }, usage: { coachMessagesToday: 0 } } }) },
    "../../hooks/useCheckout": { useCheckout: () => ({}) },
    "../../lib/tokens": { T: {} },
    "../../lib/theme": { ACCENT_THEMES: ["green", "teal", "blue"], getSavedTheme: () => "green", setTheme: vi.fn() },
    "../../lib/formatDate": { fmtDay: () => "" },
  };
  const r = renderer(source, imports);
  const onClose = vi.fn();
  return { ...b, render: (open = true) => r.render({ open, onClose }) };
}

describe("Settings → Account → Delete account", () => {
  it("exposes a named Account section and a 44px discovery control only for a real signed-in account", () => {
    const f = settings();
    let tree = f.render();
    const section = one(tree, n => n.type === "section" && text(n).includes("elev.accountSettings.title"));
    expect(button(section, "set.acctDel.open").props.className).toContain("min-h-[44px]");
    expect(button(section, "set.acctDel.open").props["aria-haspopup"]).toBe("dialog");
    f.auth.firebaseEnabled = false; tree = f.render();
    expect(text(tree)).not.toContain("elev.accountSettings.title");
    expect(text(tree)).not.toContain("set.acctDel.open");
    f.auth.firebaseEnabled = true; f.auth.user = null; tree = f.render();
    expect(text(tree)).not.toContain("set.acctDel.open");
  });
  it("transitions to confirmation, returns to Settings on cancel, and clears it when Settings closes", () => {
    const f = settings();
    let tree = f.render();
    button(tree, "set.acctDel.open").props.onClick(); tree = f.render();
    expect(modal(tree).props.open).toBe(false);
    let child = one(tree, n => n.type === "DeleteAccountModal");
    expect(child.props.open).toBe(true);
    child.props.onClose(); tree = f.render();
    expect(modal(tree).props.open).toBe(true);
    button(tree, "set.acctDel.open").props.onClick(); f.render(); f.render(false); tree = f.render(true);
    child = one(tree, n => n.type === "DeleteAccountModal");
    expect(child.props.open).toBe(false);
  });
  it("negative control: dropping Firebase guard exposes deletion for the local sandbox user", () => {
    const mutant = settingsSource.replace('{firebaseEnabled && user && (', '{user && (');
    expect(mutant).not.toBe(settingsSource);
    const f = settings(mutant); f.auth.firebaseEnabled = false;
    expect(text(f.render())).toContain("set.acctDel.open");
  });
});

describe("production account-deletion callbacks", () => {
  it("requires localized confirmation in the handler, even if a disabled callback is invoked", async () => {
    const f = deletion();
    button(f.tree, "set.acctDel.confirm").props.onClick();
    expect(f.api.accountDelete).not.toHaveBeenCalled();
    f.language.uiLang = "he"; f.refresh(); f.type("DELETE");
    expect(button(f.tree, "set.acctDel.confirm").props.disabled).toBe(true);
    button(f.tree, "set.acctDel.confirm").props.onClick();
    expect(f.api.accountDelete).not.toHaveBeenCalled();
    f.type(" מחיקה "); button(f.tree, "set.acctDel.confirm").props.onClick(); await f.settle();
    expect(f.api.accountDelete).toHaveBeenCalledOnce();
  });
  it("fresh opening clears confirmation, receipt, retry authorization and error feedback", async () => {
    const f = deletion(); f.type("DELETE");
    button(f.tree, "set.acctDel.confirm").props.onClick(); await f.settle();
    expect(text(f.tree)).toContain('"deleted":"9"');
    const staleRetry = button(f.tree, "set.acctDel.retry").props.onClick;
    modal(f.tree).props.onClose(); expect(f.onClose).toHaveBeenCalledOnce();
    f.setOpen(false); f.setOpen(true);
    expect(one(f.tree, n => n.type === "input").props.value).toBe("");
    expect(button(f.tree, "set.acctDel.confirm").props.disabled).toBe(true);
    expect(text(f.tree)).not.toContain("set.acctDel.receipt");
    staleRetry(); expect(f.api.accountDelete).toHaveBeenCalledOnce();
    f.type("DELETE"); f.api.accountDelete.mockRejectedValueOnce(new Error("network"));
    button(f.tree, "set.acctDel.confirm").props.onClick(); await f.settle();
    expect(text(f.tree)).toContain("elev.accountSettings.network");
    f.setOpen(false); f.setOpen(true); expect(text(f.tree)).not.toContain("elev.accountSettings.network");
  });
  it("locks before paint, blocks duplicate submits/dismissal, and exposes accessible busy state", async () => {
    const f = deletion(), wait = deferred<AccountDeletionReceipt>();
    f.api.accountDelete.mockReturnValueOnce(wait.promise); f.type("DELETE");
    const submit = button(f.tree, "set.acctDel.confirm").props.onClick;
    submit(); submit(); modal(f.tree).props.onClose();
    expect(f.api.accountDelete).toHaveBeenCalledOnce(); expect(f.onClose).not.toHaveBeenCalled();
    f.refresh();
    expect(button(f.tree, "set.acctDel.confirm").props.disabled).toBe(true);
    expect(one(f.tree, n => n.props["aria-busy"] === true)).toBeDefined();
    const status = one(f.tree, n => n.props.role === "status");
    expect(text(status)).toBe("elev.accountSettings.deleting");
    expect(button(f.tree, "set.acctDel.confirm").props["aria-describedby"]).toBe(status.props.id);
    expect(one(f.tree, n => n.type === "label").props.htmlFor).toBe(one(f.tree, n => n.type === "input").props.id);
    wait.resolve(receipt()); await f.settle(); expect(button(f.tree, "set.acctDel.retry").props.disabled).toBe(false);
  });
  it("rejects parental-gate and anonymous/sandbox actions without cleanup or API calls", () => {
    const f = deletion(); f.type("DELETE"); f.commerceAllowed.mockReturnValue(false);
    button(f.tree, "set.acctDel.confirm").props.onClick(); f.refresh();
    expect(text(one(f.tree, n => n.props.role === "alert"))).toBe("elev.gate.blocked");
    expect(f.toast).toHaveBeenCalledWith("elev.gate.blocked", "info");
    f.commerceAllowed.mockReturnValue(true); f.auth.firebaseEnabled = false; f.refresh();
    button(f.tree, "set.acctDel.confirm").props.onClick();
    f.auth.firebaseEnabled = true; f.auth.user = null; f.refresh();
    button(f.tree, "set.acctDel.confirm").props.onClick();
    expect(f.api.accountDelete).not.toHaveBeenCalled(); expect(f.purgeAllComicPages).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled();
  });
  it("keeps real partial counts and the session, rechecks the gate on retry, then retries the existing API", async () => {
    const f = deletion(); f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick(); await f.settle();
    expect(text(f.tree)).toContain('"deleted":"9"'); expect(text(f.tree)).toContain('"classes":"storageFiles"');
    expect(f.purgeAllComicPages).not.toHaveBeenCalled(); expect(f.removeItem).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled();
    f.commerceAllowed.mockReturnValue(false); button(f.tree, "set.acctDel.retry").props.onClick(); f.refresh();
    expect(f.api.accountDelete).toHaveBeenCalledOnce();
    f.commerceAllowed.mockReturnValue(true); button(f.tree, "set.acctDel.retry").props.onClick(); await f.settle();
    expect(f.api.accountDelete).toHaveBeenCalledTimes(2);
  });
  it("network errors announce an unknown result, fabricate no receipt, and permit retry without signing out", async () => {
    const f = deletion(); f.api.accountDelete.mockRejectedValueOnce(new Error("offline"));
    f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick(); await f.settle();
    expect(text(one(f.tree, n => n.props.role === "alert"))).toBe("elev.accountSettings.network");
    expect(text(f.tree)).not.toContain("set.acctDel.receipt"); expect(text(f.tree)).not.toContain("set.acctDel.partialTitle");
    expect(f.purgeAllComicPages).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled();
    button(f.tree, "set.acctDel.retry").props.onClick(); await f.settle(); expect(f.api.accountDelete).toHaveBeenCalledTimes(2);
  });
  it("only a complete receipt invokes the existing local purge, Arbor-key cleanup, close and sign-out sequence", async () => {
    const f = deletion(); f.api.accountDelete.mockResolvedValueOnce(receipt(true));
    f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick(); await f.settle();
    expect(f.order).toEqual(["purge", "remove:arbor.child", "remove:arbor.theme", "toast:success", "close", "signOut"]);
    expect(f.storage.unrelated).toBe("keep"); expect(f.signOut).toHaveBeenCalledOnce();
  });
  it("forced close/reopen keeps the pending lock but ignores the old receipt", async () => {
    const f = deletion(), wait = deferred<AccountDeletionReceipt>(); f.api.accountDelete.mockReturnValueOnce(wait.promise);
    f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick();
    f.setOpen(false); f.setOpen(true); f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick();
    expect(f.api.accountDelete).toHaveBeenCalledOnce();
    wait.resolve(receipt()); await f.settle();
    expect(text(f.tree)).not.toContain("set.acctDel.receipt");
    expect(button(f.tree, "set.acctDel.confirm").props.disabled).toBe(false);
    button(f.tree, "set.acctDel.confirm").props.onClick(); await f.settle(); expect(f.api.accountDelete).toHaveBeenCalledTimes(2);
  });
  it("a completed request still cleans the same account after a forced view close", async () => {
    const f = deletion(), wait = deferred<AccountDeletionReceipt>(); f.api.accountDelete.mockReturnValueOnce(wait.promise);
    f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick(); f.setOpen(false);
    wait.resolve(receipt(true)); await f.settle();
    expect(f.purgeAllComicPages).toHaveBeenCalledOnce(); expect(f.signOut).toHaveBeenCalledOnce();
    expect(f.toast).toHaveBeenCalledWith("set.acctDel.done", "success");
  });
  it("identity changes invalidate confirmation and a pending completion cannot clean another account", async () => {
    const f = deletion(), wait = deferred<AccountDeletionReceipt>(); f.api.accountDelete.mockReturnValueOnce(wait.promise);
    f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick();
    f.auth.user = { uid: "parent-b", displayName: "Other parent", email: "other@example.test" }; f.refresh();
    expect(one(f.tree, n => n.type === "input").props.value).toBe("");
    wait.resolve(receipt(true)); await f.settle();
    expect(f.purgeAllComicPages).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled(); expect(f.onClose).not.toHaveBeenCalled();
  });
  it.each(["identity", "unmount"] as const)("a deferred comic purge cannot clear a later session after %s", async (change) => {
    const f = deletion(), purge = deferred<void>();
    f.api.accountDelete.mockResolvedValueOnce(receipt(true)); f.purgeAllComicPages.mockReturnValueOnce(purge.promise);
    f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick(); await tick();
    expect(f.purgeAllComicPages).toHaveBeenCalledOnce();
    if (change === "identity") {
      f.auth.user = { uid: "parent-b", displayName: "Other", email: "other@example.test" }; f.refresh();
    } else f.unmount();
    f.storage["arbor.nextSession"] = "must survive";
    purge.resolve(); await tick();
    expect(f.storage["arbor.nextSession"]).toBe("must survive");
    expect(f.removeItem).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled();
    expect(f.leases.isPending("parent-a")).toBe(false);
  });
  it("a fresh instance subscribes to the UID lease and cannot start a duplicate pending deletion", async () => {
    const b = boundaries(), wait = deferred<AccountDeletionReceipt>(); b.api.accountDelete.mockReturnValueOnce(wait.promise);
    const first = deletion(deletionSource, b); first.type("DELETE");
    button(first.tree, "set.acctDel.confirm").props.onClick(); first.unmount();
    const next = deletion(deletionSource, b);
    expect(one(next.tree, n => n.type === "input").props.value).toBe("");
    expect(text(one(next.tree, n => n.props.role === "status"))).toBe("elev.accountSettings.deleting");
    expect(one(next.tree, n => n.type === "input").props.disabled).toBe(true);
    next.type("DELETE"); button(next.tree, "set.acctDel.confirm").props.onClick();
    expect(b.api.accountDelete).toHaveBeenCalledOnce();
    wait.resolve(receipt()); await next.settle();
    expect(button(next.tree, "set.acctDel.confirm").props.disabled).toBe(false);
    expect(text(one(next.tree, n => n.props.role === "status"))).toBe("");
    expect(text(next.tree)).not.toContain("set.acctDel.receipt");
    button(next.tree, "set.acctDel.confirm").props.onClick(); await next.settle();
    expect(b.api.accountDelete).toHaveBeenCalledTimes(2);
  });
  it("a response after unmount cannot update state, close, or sign out", async () => {
    const f = deletion(), wait = deferred<AccountDeletionReceipt>(); f.api.accountDelete.mockReturnValueOnce(wait.promise);
    f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick(); f.unmount();
    wait.resolve(receipt(true)); await tick();
    expect(f.purgeAllComicPages).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled(); expect(f.onClose).not.toHaveBeenCalled();
  });
});

describe("negative controls run mutated production code", () => {
  it("negative control: a lease scoped per instance allows a duplicate after remount", async () => {
    const b = boundaries(), wait = deferred<AccountDeletionReceipt>(); b.api.accountDelete.mockReturnValue(wait.promise);
    const first = deletion(deletionSource, b); first.type("DELETE");
    button(first.tree, "set.acctDel.confirm").props.onClick(); first.unmount();
    // Reproduce the old component-local lock: the fresh instance loses ownership.
    const isolated = { ...b, imports: { ...b.imports, "../../lib/accountDeletionLease": { accountDeletionLeases: createAccountDeletionLeases() } } };
    const next = deletion(deletionSource, isolated); next.type("DELETE");
    button(next.tree, "set.acctDel.confirm").props.onClick();
    expect(b.api.accountDelete).toHaveBeenCalledTimes(2);
    wait.resolve(receipt()); await next.settle();
  });
  it("negative control: removing the post-purge checks clears a later session's keys", async () => {
    const start = deletionSource.indexOf("  const wipeDeviceData =");
    const end = deletionSource.indexOf("  const runDeletion =", start);
    const wipe = deletionSource.slice(start, end).replaceAll("if (!ownsAccount()) return;", "");
    const mutant = deletionSource.slice(0, start) + wipe + deletionSource.slice(end);
    expect(mutant).not.toBe(deletionSource);
    const f = deletion(mutant), purge = deferred<void>();
    f.api.accountDelete.mockResolvedValueOnce(receipt(true)); f.purgeAllComicPages.mockReturnValueOnce(purge.promise);
    f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick(); await tick();
    f.auth.user = { uid: "parent-b", displayName: "Other", email: "other@example.test" }; f.refresh();
    f.storage["arbor.nextSession"] = "must survive";
    purge.resolve(); await f.settle();
    expect(f.storage["arbor.nextSession"]).toBeUndefined();
  });
  it("removing the opening reset retains a previous receipt and authorizes retry", async () => {
    const mutant = deletionSource.replace('if (open) {\n      setConfirmText("");\n      setPartial(null);\n      setError(null);\n    }', 'if (open) { /* pre-fix: retained form */ }');
    expect(mutant).not.toBe(deletionSource);
    const f = deletion(mutant); f.type("DELETE"); button(f.tree, "set.acctDel.confirm").props.onClick(); await f.settle();
    f.setOpen(false); f.setOpen(true);
    expect(text(f.tree)).toContain("set.acctDel.receipt");
    button(f.tree, "set.acctDel.retry").props.onClick(); await f.settle(); expect(f.api.accountDelete).toHaveBeenCalledTimes(2);
  });
});

it("registers complete English/Hebrew Account strings without replacing the legal deletion copy", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  for (const key of Object.keys(en)) {
    expect(key.startsWith("elev.accountSettings.")).toBe(true);
    expect(elevationEn[key]).toBe(en[key]); expect(elevationHe[key]).toBe(he[key]);
    expect(he[key].trim().length).toBeGreaterThan(0);
  }
  expect(en["elev.accountSettings.title"]).toBe("Account");
  expect(deletionSource).toContain('t("set.acctDel.body")');
});
