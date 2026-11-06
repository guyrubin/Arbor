import type { Request, Response } from "express";
import { verifyCheckoutLink, type CheckoutMode } from "./checkoutConfiguration.js";
export type { CheckoutMode } from "./checkoutConfiguration.js";

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
  /** Provider-verified checkout mode. Opaque RevenueCat link tokens do not
   *  identify their environment; an unavailable or unknown provider response
   *  is "unverified", never evidence that real-card checkout works. */
  checkoutMode: CheckoutMode;
  ts: string;
}

const CHECKOUT_ENV = [
  "BILLING_WEB_PURCHASE_LINK",
  "BILLING_URL_PLUS_MONTHLY",
  "BILLING_URL_PLUS_ANNUAL",
] as const;

export function checkoutConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return CHECKOUT_ENV.some((name) => Boolean(env[name]?.trim()));
}

/** Judged on the link checkout actually uses: the Web Purchase Link wins over
 *  the per-plan links (billing.ts `billingCheckoutUrl`). Family is not sold.
 *  Never returns a link or provider key. Provider lookups are bounded and cached. */
export async function checkoutMode(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): Promise<CheckoutMode> {
  const web = env.BILLING_WEB_PURCHASE_LINK?.trim();
  const raw = web ? [web] : CHECKOUT_ENV.map((name) => env[name]?.trim()).filter((value): value is string => Boolean(value));
  if (raw.length === 0) return "none";
  const modes = await Promise.all(raw.map((link) => verifyCheckoutLink(link, fetcher)));
  if (modes.includes("sandbox")) return "sandbox";
  if (modes.includes("unverified")) return "unverified";
  if (modes.includes("none")) return "none";
  return "live";
}

export async function buildHealthPayload(now: Date = new Date(), fetcher: typeof fetch = fetch): Promise<HealthPayload> {
  return {
    status: "ok",
    version: process.env.GITHUB_SHA || process.env.K_REVISION || "dev",
    env: process.env.ARBOR_ENV || process.env.NODE_ENV || "unknown",
    checkout: checkoutConfigured(),
    checkoutMode: await checkoutMode(process.env, fetcher),
    ts: now.toISOString(),
  };
}

export async function healthzHandler(_req: Request, res: Response): Promise<void> {
  res.set("Cache-Control", "no-store");
  res.status(200).json(await buildHealthPayload());
}
