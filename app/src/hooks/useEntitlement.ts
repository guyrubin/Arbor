import { useCallback, useEffect, useState } from "react";
import { api, type EntitlementInfo } from "../lib/api";

/** Default while loading / when the API is unreachable: fail closed to Free.
 *  `source: "client_fallback"` is the ONE marker consumers use to tell "the
 *  server said Free" from "we could not ask" (MOB-08). */
export const FALLBACK_FREE: EntitlementInfo = {
  plan: "free",
  limits: { coachMessagesPerDay: 10, maxChildren: 1, professionalReports: false, advancedPlans: false, coParentSeats: 0 },
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
let inflight: Promise<EntitlementInfo> | null = null;
const listeners = new Set<(e: EntitlementInfo) => void>();

const fetchEntitlement = () => {
  if (!inflight) {
    inflight = api.entitlement()
      .then((e) => { cached = e; return e; })
      .catch(() => FALLBACK_FREE)
      .then((e) => { listeners.forEach((fn) => fn(e)); return e; })
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/** Invalidate after an upgrade (billing success redirect, native purchase, restore). */
export const refreshEntitlement = () => { cached = null; return fetchEntitlement(); };

/** Test-only: forget the shared cache between cases. */
export const __resetEntitlementCache = () => { cached = null; inflight = null; listeners.clear(); };

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
};

/**
 * MON-2 activation sequence: ONE "activating" toast, then poll the
 * entitlement until the plan flips (the RevenueCat webhook writes it async),
 * then ONE "activated" toast. Returns a cancel function for the effect cleanup.
 */
export function startBillingReturnPoll(deps: BillingReturnDeps): () => void {
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const maxTries = deps.maxTries ?? 6;
  const intervalMs = deps.intervalMs ?? 2500;
  let tries = 0;
  let handle: unknown;
  let alive = true;
  deps.toast(deps.t("pw.activating"), "info");
  const poll = async () => {
    tries += 1;
    const ent = await deps.refresh();
    if (!alive) return;
    if (ent.plan !== "free") { deps.toast(deps.t("pw.activated"), "success"); return; }
    if (tries < maxTries) handle = schedule(() => void poll(), intervalMs);
  };
  void poll();
  return () => { alive = false; if (handle !== undefined) cancel(handle); };
}
