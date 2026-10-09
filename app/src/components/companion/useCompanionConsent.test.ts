import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import * as consentHelpers from "../../lib/companionConsent";
import type { ConsentGrant } from "../../types";

const compiled = ts.transpileModule(readFileSync(resolve(process.cwd(), "src/components/companion/useCompanionConsent.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const recorded = (childId = "child-a"): ConsentGrant => ({ id: `grant-${childId}`, childId, purpose: "companion_attachments", granted: true, policyVersion: "2026-10-companion-attachments-1", actorUid: "parent-a", grantedAt: "2026-10-09T09:00:00Z", expiresAt: "2030-10-09T09:00:00Z", revokedAt: null });

/** Executes the production hook with controlled account, lifecycle and API
 * boundaries. Browser focus and dimensions are validated separately. */
function harness() {
  const identity = { childId: "child-a", uid: "parent-a" };
  const requests: { childId: string; pending: ReturnType<typeof deferred<{ grants: ConsentGrant[] }>> }[] = [];
  const writes: { childId: string; purpose: string; pending: ReturnType<typeof deferred<{ grant: ConsentGrant }>> }[] = [];
  const deletes: { id: string; childId: string; pending: ReturnType<typeof deferred<{ grant: ConsentGrant }>> }[] = [];
  const api = {
    listConsent: vi.fn((childId: string) => { const pending = deferred<{ grants: ConsentGrant[] }>(); requests.push({ childId, pending }); return pending.promise; }),
    grantConsent: vi.fn(({ childId, purpose }: { childId: string; purpose: string }) => { const pending = deferred<{ grant: ConsentGrant }>(); writes.push({ childId, purpose, pending }); return pending.promise; }),
    revokeConsent: vi.fn((id: string, childId: string) => { const pending = deferred<{ grant: ConsentGrant }>(); deletes.push({ id, childId, pending }); return pending.promise; }),
  };
  const slots: any[] = []; let cursor = 0, dirty = false, disposed = false;
  let effects: (() => void)[] = [];
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => {
        if (disposed) throw new Error("State update after unmount");
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef(initial: any) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback: () => void | (() => void), deps?: unknown[]) {
      const index = cursor++, previous = slots[index];
      if (!previous || !same(previous.deps, deps)) {
        const slot = { deps, cleanup: undefined as void | (() => void) }; slots[index] = slot;
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = callback(); });
      }
    },
  };
  const imports: Record<string, unknown> = { react, "../../context/AuthContext": { useAuth: () => ({ user: { uid: identity.uid } }) }, "../../lib/api": { api }, "../../lib/companionConsent": consentHelpers };
  const module = { exports: {} as { useCompanionConsent: (childId: string) => any } };
  new Function("require", "module", "exports", compiled)((name: string) => {
    if (!(name in imports)) throw new Error(`Unexpected boundary ${name}`); return imports[name];
  }, module, module.exports);
  const render = () => {
    for (let i = 0; i < 20; i++) {
      cursor = 0; dirty = false; effects = [];
      const value = module.exports.useCompanionConsent(identity.childId); effects.forEach(effect => effect());
      if (!dirty) return value;
    }
    throw new Error("Unbounded render");
  };
  render();
  return { identity, api, requests, writes, deletes, render, unmount: () => { slots.forEach(slot => slot?.cleanup?.()); disposed = true; } };
}
beforeEach(() => { vi.stubGlobal("window", new EventTarget()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("Explicit companion file permission", () => {
  it("reads only when requested, and a missing grant opens review without writing consent", async () => {
    const view = harness(); expect(view.api.listConsent).not.toHaveBeenCalled();
    const allowed = view.render().requirePermission();
    view.requests[0].pending.resolve({ grants: [] }); await tick();
    expect(await allowed).toBe(false); expect(view.render().reviewing).toBe(true);
    expect(view.render().checked).toBe(false); expect(view.api.grantConsent).not.toHaveBeenCalled();
    view.render().allow(); expect(view.api.grantConsent).not.toHaveBeenCalled();
  });
  it("records one explicit checked grant and returns to the unchanged draft without sending", async () => {
    const view = harness(); view.render().review(); view.requests[0].pending.resolve({ grants: [] }); await tick();
    view.render().setChecked(true); const reviewed = view.render();
    const first = reviewed.allow(); reviewed.allow();
    expect(view.writes).toHaveLength(1); expect(view.writes[0]).toMatchObject({ childId: "child-a", purpose: "companion_attachments" });
    view.writes[0].pending.resolve({ grant: recorded() }); await first;
    expect(view.render()).toMatchObject({ active: true, reviewing: false, checked: false, notice: "saved", busy: null });
    expect(view.api.listConsent).toHaveBeenCalledTimes(1);
  });
  it("keeps consent review retryable when reading or recording fails", async () => {
    const view = harness(); view.render().review(); view.requests[0].pending.reject(new Error("offline")); await tick();
    expect(view.render()).toMatchObject({ active: false, error: true, reviewing: true, busy: null });
    view.render().setChecked(true); const action = view.render().allow();
    view.writes[0].pending.reject(new Error("write refused")); await action;
    expect(view.render()).toMatchObject({ active: false, error: true, reviewing: true, checked: true, busy: null });
  });
  it("rechecks the server for every file send, including an externally revoked grant", async () => {
    const view = harness(); let action = view.render().requirePermission();
    view.requests[0].pending.resolve({ grants: [recorded()] }); expect(await action).toBe(true);
    action = view.render().requirePermission();
    view.requests[1].pending.resolve({ grants: [{ ...recorded(), revokedAt: "2026-10-09T10:00:00Z" }] });
    expect(await action).toBe(false); expect(view.render().reviewing).toBe(true);
  });
  it("revokes only this child's selected file grant and preserves a failed revoke for retry", async () => {
    const view = harness(); view.render().review(); view.requests[0].pending.resolve({ grants: [recorded()] }); await tick();
    let action = view.render().revoke(); expect(view.deletes[0].id).toBe("grant-child-a"); expect(view.deletes[0].childId).toBe("child-a");
    view.deletes[0].pending.reject(new Error("offline")); await action;
    expect(view.render()).toMatchObject({ active: true, error: true, busy: null });
    action = view.render().revoke(); view.deletes[1].pending.resolve({ grant: { ...recorded(), granted: false, revokedAt: "2026-10-09T10:00:00Z" } }); await action;
    expect(view.render()).toMatchObject({ active: false, notice: "revoked", reviewing: false });
  });
  it.each(["child", "account"])("ignores late grants after %s changes", async (change) => {
    const view = harness(); view.render().review(); view.requests[0].pending.resolve({ grants: [] }); await tick();
    view.render().setChecked(true); const action = view.render().allow();
    if (change === "child") view.identity.childId = "child-b"; else view.identity.uid = "parent-b";
    view.render(); view.writes[0].pending.resolve({ grant: recorded() }); await action;
    expect(view.render()).toMatchObject({ active: false, notice: null, reviewing: false, busy: null });
  });
  it("ignores late reads after switching children and late writes after unmount", async () => {
    const view = harness(); const read = view.render().requirePermission();
    view.identity.childId = "child-b"; view.render(); view.requests[0].pending.resolve({ grants: [recorded()] });
    expect(await read).toBe(false); expect(view.render().reviewing).toBe(false);
    view.render().setChecked(true); const write = view.render().allow(); view.unmount();
    view.writes[0].pending.resolve({ grant: recorded("child-b") }); await write;
  });
  it("routes failure-card review only to the matching child", async () => {
    const view = harness(); consentHelpers.requestCompanionConsentReview("child-b"); expect(view.api.listConsent).not.toHaveBeenCalled();
    consentHelpers.requestCompanionConsentReview("child-a"); expect(view.api.listConsent).toHaveBeenCalledWith("child-a");
    view.requests[0].pending.resolve({ grants: [] }); await tick(); expect(view.render().reviewing).toBe(true);
  });
});
