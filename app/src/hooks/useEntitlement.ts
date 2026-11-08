import { useCallback, useEffect, useState } from "react";
import { api, type EntitlementInfo } from "../lib/api";

/** Default while loading / when the API is unreachable: fail closed to Free.
 *  `source: "client_fallback"` is the ONE marker consumers use to tell "the
 *  server said Free" from "we could not ask" (MOB-08). */
export const FALLBACK_FREE: EntitlementInfo = {
  plan: "free",
  limits: { coachMessagesPerDay: 10, maxChildren: 1, professionalReports: false, advancedPlans: false, coParentSeats: 1 },
  source: "client_fallback",
  enforced: true,
  usage: { coachMessagesToday: 0 },
  status: "active",
};

/** Limits of the paid plans as the CLIENT may quote them (MOB-13: the
 *  at-limit gate names what Plus adds). Pinned to server/entitlements.ts
 *  PLAN_LIMITS.plus by useEntitlement.test.ts — never hand-edit one side. */
export const PAID_PLAN_LIMITS = { maxChildren: 6 } as const;

/** True when the entitlement came from the server (not the client fallback). */
export const isVerifiedEntitlement = (e: EntitlementInfo): boolean => e.source !== "client_fallback";

/**
 * MOB-08 — the child-limit gate NEVER hard-gates on an unverified entitlement:
 * a Plus family on a flaky connection must not be told "one child only".
 * Free-and-verified still gates (negative control in useEntitlement.test.ts).
 */
export function childLimitReached(args: { entitlement: EntitlementInfo; loading: boolean; childCount: number }): boolean {
  const { entitlement, loading, childCount } = args;
  if (loading || !isVerifiedEntitlement(entitlement)) return false;
  return entitlement.enforced && childCount >= entitlement.limits.maxChildren;
}

// Module-level cache so every consumer shares one fetch per session, plus a
// listener set so a refresh (billing return, native purchase, Retry) updates
// EVERY mounted consumer — Settings must not keep showing "Free" after the
// paywall's purchase resolved.
let cached: EntitlementInfo | null = null;
let inflight: { promise: Promise<EntitlementInfo>; controller: AbortController } | null = null;
let owner: string | null | undefined;
let generation = 0;
const listeners = new Set<(e: EntitlementInfo) => void>();

/** A stalled request must release the shared promise so Retry can try again. */
export const ENTITLEMENT_READ_TIMEOUT_MS = 4000;

const fetchEntitlement = () => {
  if (owner === null) return Promise.resolve(FALLBACK_FREE);
  if (!inflight) {
    const requestGeneration = generation;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let onAbort: () => void;
    const canceled = new Promise<EntitlementInfo>((resolve) => {
      onAbort = () => resolve(FALLBACK_FREE);
      controller.signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => controller.abort(), ENTITLEMENT_READ_TIMEOUT_MS);
    });
    const promise = Promise.race([api.entitlement(controller.signal), canceled])
      .catch(() => FALLBACK_FREE)
      .then((e) => {
        // An old account's response must never reach the new account's UI or
        // cache, including a response that ignores the canceled fetch signal.
        if (generation !== requestGeneration) return FALLBACK_FREE;
        if (e !== FALLBACK_FREE) cached = e;
        listeners.forEach((fn) => fn(e));
        return e;
      })
      .finally(() => {
        clearTimeout(timer);
        controller.signal.removeEventListener("abort", onAbort);
        if (inflight?.promise === promise) inflight = null;
      });
    inflight = { promise, controller };
  }
  return inflight.promise;
};

/** Called by Firebase's auth observer before publishing the new signed-in
 *  user. Requests/cache belong to exactly one auth generation, not a tab. */
export function setEntitlementOwner(uid: string | null): void {
  if (owner === uid) return;
  owner = uid;
  generation += 1;
  inflight?.controller.abort();
  inflight = null;
  cached = null;
  listeners.forEach((fn) => fn(FALLBACK_FREE));
  if (uid && listeners.size > 0) void fetchEntitlement();
}

/** The last server answer, for non-React callers (the checkout names its currency). */
export const cachedEntitlement = (): EntitlementInfo | null => cached;

/** Invalidate after an upgrade (billing success redirect, native purchase, restore). */
export const refreshEntitlement = () => { cached = null; return fetchEntitlement(); };

/** Test-only: forget the shared cache between cases. */
export const __resetEntitlementCache = () => {
  generation += 1;
  inflight?.controller.abort();
  cached = null;
  inflight = null;
  owner = undefined;
  listeners.clear();
};

export type EntitlementState = {
  entitlement: EntitlementInfo;
  /** True until the first server answer (or failure) of this session. */
  loading: boolean;
  /** `entitlement.source`; "client_fallback" = unverified (show last-known + Retry). */
  source: string;
  /** True when the current value is the client fallback, not a server answer. */
  isFallback: boolean;
  /** Re-ask the server (Retry control on the Settings plan row). */
  retry: () => Promise<EntitlementInfo>;
};

/**
 * MON-1 client seam: read the parent's plan, limits, and coach usage. The server
 * can still return beta Plus when enforcement is explicitly disabled; otherwise
 * the client fails closed until the entitlement endpoint answers.
 */
export function useEntitlement(): EntitlementState {
  const [entitlement, setEntitlement] = useState<EntitlementInfo>(cached || FALLBACK_FREE);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let alive = true;
    const onUpdate = (e: EntitlementInfo) => { if (alive) { setEntitlement(e); setLoading(false); } };
    listeners.add(onUpdate);
    if (!cached) void fetchEntitlement();
    return () => { alive = false; listeners.delete(onUpdate); };
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    return refreshEntitlement();
  }, []);

  return { entitlement, loading, source: entitlement.source, isFallback: !isVerifiedEntitlement(entitlement), retry };
}

// ── MOB-07 / IA-15: the web checkout return handshake ───────────────────────
// App.tsx's BillingReturnWatcher mounts BEFORE Shell and strips the
// `?billing=success` param on its first effect, so Shell's MON-2 read of the
// same param never fired. The watcher now leaves this session flag; Shell
// takes (and clears) it and runs the activation poll + toasts.

export const BILLING_RETURN_KEY = "arbor.billingReturn";

type FlagStorage = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void };

const sessionStore = (): FlagStorage | null => {
  try {
    const g = globalThis as { sessionStorage?: FlagStorage };
    return g.sessionStorage ?? null;
  } catch {
    return null;
  }
};

export function markBillingReturn(storage: FlagStorage | null = sessionStore()): void {
  try { storage?.setItem(BILLING_RETURN_KEY, "1"); } catch { /* storage unavailable */ }
}

/** Read-once-and-clear: exactly one consumer runs the activation sequence. */
export function takeBillingReturn(storage: FlagStorage | null = sessionStore()): boolean {
  try {
    const flagged = storage?.getItem(BILLING_RETURN_KEY) === "1";
    if (flagged) storage?.removeItem(BILLING_RETURN_KEY);
    return flagged;
  } catch {
    return false;
  }
}

export type BillingReturnDeps = {
  toast: (message: string, type?: "info" | "success" | "error") => void;
  t: (key: string) => string;
  refresh: () => Promise<EntitlementInfo>;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
  maxTries?: number;
  intervalMs?: number;
  /** Wall-clock bound, independent of request duration or the retry scheduler. */
  deadlineMs?: number;
  /** MOB-07: called ONCE when the poll gives up — exhausted or throwing.
   *  Shell uses it to say so; a missing callback still raises the toast. */
  onTimeout?: () => void;
};

/** The key of the message a parent gets when activation did not confirm in
 *  time. Exported so the Shell wiring and the guard test name the same string. */
export const BILLING_PENDING_KEY = "pw.stillConfirming";

/** The web return confirms a purchased subscription, not access already supplied
 *  by Arbor's no-card trial, a comp, beta, or a native-store subscription.
 *  RevenueCat Web Billing is exposed by the API as provider `stripe`.
 *  Canceling renewal does not undo a purchase: that subscription remains valid
 *  through its paid period. Missing/expired cancellation dates cannot confirm it. */
function confirmsWebPurchase(entitlement: EntitlementInfo): boolean {
  if (
    (entitlement.plan !== "plus" && entitlement.plan !== "family")
    || entitlement.source !== "store"
    || entitlement.enforced !== true
    || entitlement.provider !== "stripe"
  ) return false;
  if (entitlement.status === "active") return true;
  if (entitlement.status !== "canceled" || !entitlement.currentPeriodEnd) return false;
  const end = Date.parse(entitlement.currentPeriodEnd);
  return Number.isFinite(end) && end > Date.now();
}

/**
 * MON-2 activation sequence: ONE "activating" toast, then poll the
 * entitlement until a web purchase is confirmed (the RevenueCat webhook writes
 * it async; an app trial can already have the same Plus plan),
 * then ONE "activated" toast. Returns a cancel function for the effect cleanup.
 *
 * MOB-07 / IA-15: the sequence used to have no LOSING branch. `refresh()`
 * rejecting produced an unhandled rejection and stopped the poll dead, and a
 * plan that stayed free simply ran out of tries — in both cases the parent, who
 * had just paid, got one 4-second "Activating…" toast and then silence. Now a
 * failed refresh is caught and counted like any other unconfirmed try, and
 * exhausting the tries raises exactly one honest message that points at the
 * place the answer lives (Settings › Plan, where MOB-08's unverified line and
 * its Retry already are). A separate 15 s deadline covers request time too;
 * a retry count alone cannot bound a request that never settles.
 */
export function startBillingReturnPoll(deps: BillingReturnDeps): () => void {
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const maxTries = deps.maxTries ?? 6;
  const intervalMs = deps.intervalMs ?? 2500;
  let tries = 0;
  let handle: unknown;
  let deadline: ReturnType<typeof setTimeout>;
  let alive = true;
  let settled = false;
  deps.toast(deps.t("pw.activating"), "info");
  const giveUp = () => {
    if (settled || !alive) return;
    settled = true;
    if (handle !== undefined) cancel(handle);
    clearTimeout(deadline);
    deps.toast(deps.t(BILLING_PENDING_KEY), "info");
    deps.onTimeout?.();
  };
  const poll = async () => {
    tries += 1;
    let confirmed = false;
    try {
      const ent = await deps.refresh();
      if (!alive || settled) return;
      confirmed = confirmsWebPurchase(ent);
    } catch {
      // A failed read is an unconfirmed try, never a reason to stop silently.
      if (!alive || settled) return;
    }
    if (confirmed) { settled = true; clearTimeout(deadline); deps.toast(deps.t("pw.activated"), "success"); return; }
    if (tries < maxTries) handle = schedule(() => void poll(), intervalMs);
    else giveUp();
  };
  deadline = setTimeout(giveUp, deps.deadlineMs ?? 15_000);
  void poll();
  return () => { alive = false; clearTimeout(deadline); if (handle !== undefined) cancel(handle); };
}
