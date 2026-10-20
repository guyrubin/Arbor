import type { Request, Response } from "express";

/**
 * OPS-A1 — unauthenticated liveness + version probe.
 *
 * Mounted before the /api auth chain so a deploy can be verified from outside the
 * app (CI smoke, uptime check, `curl /api/health`) without a signed-in session — which
 * closes the "deploys go blind / can't confirm the live revision" gap. Carries NO
 * secrets and NO child data — only build/version/env identity, plus one boolean
 * saying whether a checkout destination is configured (never the link itself).
 */

export interface HealthPayload {
  status: "ok";
  /** The deployed build identity. GITHUB_SHA is set by the deploy workflow;
   *  K_REVISION is auto-set by Cloud Run; "dev" locally. */
  version: string;
  env: string;
  /** True when /api/billing/checkout has somewhere to send a parent (the
   *  RevenueCat Web Purchase Link or a per-plan link). The post-deploy smoke
   *  refuses a prod candidate that answers false: from at least 8 Oct to
   *  20 Oct 2026 every prod revision lacked the link and nobody could pay. */
  checkout: boolean;
  /** Which checkout a parent reaches: "live" takes real cards; "sandbox" is a
   *  test checkout (RevenueCat's sandbox Purchase Link, `/sandbox/` before the
   *  token, or a Stripe `test_` link) that declines real cards and whose
   *  events the prod webhook ignores (billing.ts `webhookSkipReason`). */
  checkoutMode: CheckoutMode;
  ts: string;
}

export type CheckoutMode = "live" | "sandbox" | "none";

const CHECKOUT_ENV = [
  "BILLING_WEB_PURCHASE_LINK",
  "BILLING_URL_PLUS_MONTHLY",
  "BILLING_URL_PLUS_ANNUAL",
  "BILLING_URL_FAMILY_MONTHLY",
  "BILLING_URL_FAMILY_ANNUAL",
] as const;

export function checkoutConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return CHECKOUT_ENV.some((name) => Boolean(env[name]?.trim()));
}

const parseLink = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

const isTestCheckout = (url: URL): boolean => {
  const segments = url.pathname.split("/");
  if (segments.includes("sandbox")) return true;
  return url.hostname.endsWith("stripe.com") && segments.some((segment) => segment.startsWith("test_"));
};

/** Judged on the link checkout actually uses: the Web Purchase Link wins over
 *  the per-plan links (billing.ts `billingCheckoutUrl`). Never returns the link. */
export function checkoutMode(env: NodeJS.ProcessEnv = process.env): CheckoutMode {
  const web = env.BILLING_WEB_PURCHASE_LINK?.trim();
  const raw = web ? [web] : CHECKOUT_ENV.map((name) => env[name]?.trim()).filter((value): value is string => Boolean(value));
  const links = raw.map(parseLink).filter((url): url is URL => url !== null);
  if (links.length === 0) return "none";
  return links.some(isTestCheckout) ? "sandbox" : "live";
}

export function buildHealthPayload(now: Date = new Date()): HealthPayload {
  return {
    status: "ok",
    version: process.env.GITHUB_SHA || process.env.K_REVISION || "dev",
    env: process.env.ARBOR_ENV || process.env.NODE_ENV || "unknown",
    checkout: checkoutConfigured(),
    checkoutMode: checkoutMode(),
    ts: now.toISOString(),
  };
}

export function healthzHandler(_req: Request, res: Response): void {
  res.set("Cache-Control", "no-store");
  res.status(200).json(buildHealthPayload());
}
