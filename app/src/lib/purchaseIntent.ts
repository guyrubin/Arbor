// @icon-font-ignore — URL parameter names only; this module renders no icons.
/** A marketing selection survives sign-in and onboarding. It only opens the
 * plan review; it never starts a purchase or grants an entitlement. */
export type PurchaseIntent = { plan: "plus"; cadence: "monthly" | "annual" };
const KEY = "arbor.purchaseIntent.v1";
let pending: PurchaseIntent | null = null;

export function parsePurchaseIntent(search: string): PurchaseIntent | null {
  const params = new URLSearchParams(search);
  const cadence = params.get("cadence");
  return params.get("plan") === "plus" && (cadence === "monthly" || cadence === "annual")
    ? { plan: "plus", cadence } : null;
}
export function capturePurchaseIntent(): void {
  const intent = parsePurchaseIntent(window.location.search);
  if (!intent) return;
  pending = intent;
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...intent, at: Date.now() })); } catch { /* this page still retains it */ }
  const url = new URL(window.location.href);
  url.searchParams.delete("plan"); url.searchParams.delete("cadence");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
export function readPurchaseIntent(): PurchaseIntent | null {
  if (pending) return pending;
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!value || !Number.isFinite(value.at) || Date.now() - value.at > 24 * 60 * 60 * 1000) return null;
    return parsePurchaseIntent(new URLSearchParams({ plan: value.plan, cadence: value.cadence }).toString());
  } catch { return null; }
}
export function clearPurchaseIntent(): void {
  pending = null;
  try { sessionStorage.removeItem(KEY); } catch { /* storage may be blocked */ }
}
