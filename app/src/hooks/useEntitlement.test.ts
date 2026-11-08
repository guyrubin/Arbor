/**
 * MOB-07 / IA-15 / MOB-08 / MOB-13 (wave T) — entitlement truth + the web
 * checkout return handshake.
 *
 *  1. An API failure resolves to the client fallback with source
 *     "client_fallback"; a server answer keeps its own source (negative).
 *  2. childLimitReached NEVER hard-gates on a fallback / loading entitlement;
 *     a verified free plan still gates (negative control).
 *  3. PAID_PLAN_LIMITS mirrors server PLAN_LIMITS.plus (MOB-13 quotes it).
 *  4. Billing return: the flag is read-once; the activation sequence fires
 *     ONE "activating" toast and ONE "activated" toast when the plan flips,
 *     and never "activated" while the plan stays free; no flag → nothing.
 *  5. App.tsx sets the flag BEFORE stripping the param; Shell keys off it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({
  api: { entitlement: vi.fn() },
}));

import { api, type EntitlementInfo } from "../lib/api";
import {
  FALLBACK_FREE,
  PAID_PLAN_LIMITS,
  BILLING_RETURN_KEY,
  ENTITLEMENT_READ_TIMEOUT_MS,
  __resetEntitlementCache,
  cachedEntitlement,
  childLimitReached,
  isVerifiedEntitlement,
  markBillingReturn,
  refreshEntitlement,
  setEntitlementOwner,
  startBillingReturnPoll,
  takeBillingReturn,
} from "./useEntitlement";
import { PLAN_LIMITS } from "../server/entitlements.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");
const mockedEntitlement = api.entitlement as unknown as ReturnType<typeof vi.fn>;

const SERVER_PLUS: EntitlementInfo = {
  plan: "plus",
  limits: { coachMessagesPerDay: null, maxChildren: 6, professionalReports: true, advancedPlans: true, coParentSeats: 0 },
  source: "store",
  enforced: true,
  usage: { coachMessagesToday: 0 },
  status: "active",
  provider: "stripe",
};

const flush = () => new Promise((r) => setTimeout(r, 5));

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

beforeEach(() => {
  __resetEntitlementCache();
  mockedEntitlement.mockReset();
});
afterEach(() => { __resetEntitlementCache(); vi.useRealTimers(); });

describe("account ownership and bounded entitlement reads", () => {
  it("discards A's late paid response after B signs in and fetches B independently", async () => {
    let answerA: (e: EntitlementInfo) => void = () => undefined;
    let answerB: (e: EntitlementInfo) => void = () => undefined;
    mockedEntitlement
      .mockImplementationOnce(() => new Promise<EntitlementInfo>((resolve) => { answerA = resolve; }))
      .mockImplementationOnce(() => new Promise<EntitlementInfo>((resolve) => { answerB = resolve; }));
    setEntitlementOwner("synthetic-parent-a");
    const first = refreshEntitlement();
    const firstSignal = mockedEntitlement.mock.calls[0][0] as AbortSignal;

    setEntitlementOwner("synthetic-parent-b");
    const second = refreshEntitlement();
    expect(second).not.toBe(first);
    expect(firstSignal.aborted).toBe(true);
    expect(mockedEntitlement).toHaveBeenCalledTimes(2);
    const b = { ...FALLBACK_FREE, source: "default" };
    answerB(b);
    expect(await second).toBe(b);
    answerA(SERVER_PLUS);
    expect(await first).toBe(FALLBACK_FREE);
    expect(cachedEntitlement()).toBe(b);
  });

  it("an old completion cannot clear B's still-pending request or create a duplicate", async () => {
    let answerA: (e: EntitlementInfo) => void = () => undefined;
    let answerB: (e: EntitlementInfo) => void = () => undefined;
    mockedEntitlement
      .mockImplementationOnce(() => new Promise<EntitlementInfo>((resolve) => { answerA = resolve; }))
      .mockImplementationOnce(() => new Promise<EntitlementInfo>((resolve) => { answerB = resolve; }));
    setEntitlementOwner("synthetic-parent-a");
    const first = refreshEntitlement();
    setEntitlementOwner("synthetic-parent-b");
    const second = refreshEntitlement();
    answerA(SERVER_PLUS);
    await first;
    expect(refreshEntitlement()).toBe(second);
    expect(mockedEntitlement).toHaveBeenCalledTimes(2);
    answerB({ ...FALLBACK_FREE, source: "default" });
    await second;
  });

  it("sign-out clears cached access and makes no anonymous entitlement read", async () => {
    setEntitlementOwner("synthetic-parent-a");
    mockedEntitlement.mockResolvedValueOnce(SERVER_PLUS);
    await refreshEntitlement();
    expect(cachedEntitlement()).toBe(SERVER_PLUS);
    setEntitlementOwner(null);
    expect(cachedEntitlement()).toBeNull();
    expect(await refreshEntitlement()).toBe(FALLBACK_FREE);
    expect(mockedEntitlement).toHaveBeenCalledTimes(1);
  });

  it("a never-resolving read times out, aborts, and releases the next retry", async () => {
    vi.useFakeTimers();
    let answerLate: (e: EntitlementInfo) => void = () => undefined;
    mockedEntitlement.mockImplementationOnce(() => new Promise<EntitlementInfo>((resolve) => { answerLate = resolve; }));
    const pending = refreshEntitlement();
    const signal = mockedEntitlement.mock.calls[0][0] as AbortSignal;
    await vi.advanceTimersByTimeAsync(ENTITLEMENT_READ_TIMEOUT_MS);
    expect(await pending).toBe(FALLBACK_FREE);
    expect(signal.aborted).toBe(true);

    const current = { ...FALLBACK_FREE, source: "default" };
    mockedEntitlement.mockResolvedValueOnce(current);
    expect(await refreshEntitlement()).toBe(current);
    answerLate(SERVER_PLUS);
    await Promise.resolve();
    expect(cachedEntitlement()).toBe(current);
    expect(mockedEntitlement).toHaveBeenCalledTimes(2);
  });
});

describe("1 · fallback carries source client_fallback", () => {
  it("API failure → FALLBACK_FREE (plan free, source client_fallback, not verified)", async () => {
    mockedEntitlement.mockRejectedValueOnce(new Error("offline"));
    const e = await refreshEntitlement();
    expect(e).toBe(FALLBACK_FREE);
    expect(e.source).toBe("client_fallback");
    expect(isVerifiedEntitlement(e)).toBe(false);
  });

  it("negative control: a server answer keeps its own source and is verified", async () => {
    mockedEntitlement.mockResolvedValueOnce(SERVER_PLUS);
    const e = await refreshEntitlement();
    expect(e.source).toBe("store");
    expect(isVerifiedEntitlement(e)).toBe(true);
  });
});

describe("2 · childLimitReached never hard-gates on an unverified entitlement", () => {
  it("fallback entitlement at/over the free limit → NOT gated", () => {
    expect(childLimitReached({ entitlement: FALLBACK_FREE, loading: false, childCount: 3 })).toBe(false);
  });
  it("still loading → NOT gated", () => {
    expect(childLimitReached({ entitlement: { ...SERVER_PLUS, plan: "free", limits: { ...SERVER_PLUS.limits, maxChildren: 1 } }, loading: true, childCount: 1 })).toBe(false);
  });
  it("negative control: a VERIFIED, enforced free plan at the limit IS gated", () => {
    const verifiedFree: EntitlementInfo = { ...FALLBACK_FREE, source: "entitlements_doc" };
    expect(childLimitReached({ entitlement: verifiedFree, loading: false, childCount: 1 })).toBe(true);
    expect(childLimitReached({ entitlement: verifiedFree, loading: false, childCount: 0 })).toBe(false);
  });
  it("a verified Plus family under its limit is not gated", () => {
    expect(childLimitReached({ entitlement: SERVER_PLUS, loading: false, childCount: 2 })).toBe(false);
  });
});

describe("3 · PAID_PLAN_LIMITS mirrors the server (MOB-13 quotes the Plus child limit)", () => {
  it("maxChildren matches server PLAN_LIMITS.plus", () => {
    expect(PAID_PLAN_LIMITS.maxChildren).toBe(PLAN_LIMITS.plus.maxChildren);
  });
  it("AddChildModal quotes PAID_PLAN_LIMITS, not a literal, and gates through childLimitReached", () => {
    const src = readSrc("components/profile/AddChildModal.tsx");
    expect(src).toContain("{ max: PAID_PLAN_LIMITS.maxChildren }");
    expect(src).not.toMatch(/maxChildren === 1 \? 6/);
    expect(src).toMatch(/childLimitReached\(\{ entitlement, loading: entitlementLoading, childCount: profiles\.length \}\)/);
  });
});

describe("4 · billing return: read-once flag + ONE activating toast", () => {
  it("markBillingReturn → takeBillingReturn true exactly once", () => {
    const s = new MemoryStorage();
    markBillingReturn(s);
    expect(s.getItem(BILLING_RETURN_KEY)).toBe("1");
    expect(takeBillingReturn(s)).toBe(true);
    expect(takeBillingReturn(s)).toBe(false);
  });

  it("negative control: no flag → false, nothing runs", () => {
    expect(takeBillingReturn(new MemoryStorage())).toBe(false);
  });

  it("plan flips → exactly one pw.activating and one pw.activated", async () => {
    const toast = vi.fn();
    const refresh = vi.fn(async () => SERVER_PLUS);
    startBillingReturnPoll({ toast, t: (k) => k, refresh, schedule: (fn) => { fn(); return 0; }, cancel: () => undefined });
    await flush();
    expect(toast.mock.calls.filter((c) => c[0] === "pw.activating")).toHaveLength(1);
    expect(toast.mock.calls.filter((c) => c[0] === "pw.activated")).toHaveLength(1);
    expect(toast).toHaveBeenCalledWith("pw.activated", "success");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("plan stays free → activating once, polls up to maxTries, never activated", async () => {
    const toast = vi.fn();
    const refresh = vi.fn(async () => FALLBACK_FREE);
    startBillingReturnPoll({ toast, t: (k) => k, refresh, schedule: (fn) => { fn(); return 0; }, cancel: () => undefined, maxTries: 3 });
    await flush();
    expect(toast.mock.calls.filter((c) => c[0] === "pw.activating")).toHaveLength(1);
    expect(toast.mock.calls.some((c) => c[0] === "pw.activated")).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("cancel stops the sequence (no activated toast after unmount)", async () => {
    const toast = vi.fn();
    let resolveRefresh: (e: EntitlementInfo) => void = () => undefined;
    const refresh = vi.fn(() => new Promise<EntitlementInfo>((r) => { resolveRefresh = r; }));
    const cancel = startBillingReturnPoll({ toast, t: (k) => k, refresh });
    cancel();
    resolveRefresh(SERVER_PLUS);
    await flush();
    expect(toast.mock.calls.some((c) => c[0] === "pw.activated")).toBe(false);
  });
});

describe("5 · App.tsx leaves the flag BEFORE stripping; Shell keys off it (source contract)", () => {
  it("BillingReturnWatcher calls markBillingReturn() before params.delete('billing')", () => {
    const app = readSrc("App.tsx");
    const mark = app.indexOf("markBillingReturn();");
    const strip = app.indexOf('params.delete("billing")');
    expect(mark).toBeGreaterThan(-1);
    expect(strip).toBeGreaterThan(mark);
  });

  it("Shell delegates to the account-scoped return lifecycle", () => {
    const shell = readSrc("components/layout/Shell.tsx");
    const lifecycle = readSrc("hooks/useBillingReturn.ts");
    expect(shell.match(/useBillingReturn\(\)/g)).toHaveLength(1);
    expect(shell).not.toContain("startBillingReturnPoll(");
    expect(lifecycle).toContain("if (!takeBillingReturn() && !fromParam) return;");
    expect(lifecycle).toContain("refresh: refreshEntitlement");
  });

  it("Firebase changes entitlement ownership before publishing the new auth user", () => {
    const auth = readSrc("context/AuthContext.tsx");
    const ownership = auth.indexOf("setEntitlementOwner(u?.uid ?? null);");
    expect(ownership).toBeGreaterThan(-1);
    expect(ownership).toBeLessThan(auth.indexOf("setUser(u ? toAuthUser(u) : null);"));
  });

  it("Settings shows the skeleton while loading and the unverified + Retry line on fallback", () => {
    const settings = readSrc("components/layout/SettingsModal.tsx");
    expect(settings).toMatch(/\{entitlementLoading \? \(/);
    expect(settings).toContain('data-testid="plan-loading"');
    expect(settings).toMatch(/\{!entitlementLoading && entitlementUnverified && \(/);
    expect(settings).toContain('t("elev.storeshell.plan.unverified")');
    expect(settings).toMatch(/onClick=\{\(\) => void retryEntitlement\(\)\}/);
  });
});
