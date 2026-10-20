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
  ts: string;
}

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

export function buildHealthPayload(now: Date = new Date()): HealthPayload {
  return {
    status: "ok",
    version: process.env.GITHUB_SHA || process.env.K_REVISION || "dev",
    env: process.env.ARBOR_ENV || process.env.NODE_ENV || "unknown",
    checkout: checkoutConfigured(),
    ts: now.toISOString(),
  };
}

export function healthzHandler(_req: Request, res: Response): void {
  res.set("Cache-Control", "no-store");
  res.status(200).json(buildHealthPayload());
}
